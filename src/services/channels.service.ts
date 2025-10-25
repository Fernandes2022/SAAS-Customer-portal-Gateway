import { prisma } from '../prisma';
import { CryptoService } from './crypto.service';
import { getProviderClient } from './providers/registry';
import { PlanService } from './plan.service';

export class ChannelsService {
  static async listUserChannels(userId: string) {
    return prisma.channel.findMany({ where: { userId } });
  }

  static async connectChannel(userId: string, payload: { provider: string; providerChannelId: string; displayName?: string }) {
    // Enforce channel limit per plan
    await PlanService.ensureWithinChannelLimit(userId);
    const client = getProviderClient(payload.provider);
    const result = await client.connect({ providerChannelId: payload.providerChannelId, displayName: payload.displayName });
    const data = result.meta ?? {};
    // If provider returns a refresh token, encrypt before storing
    let encryptedRefreshToken: string | undefined = undefined;
    const refreshToken = result.refreshToken;
    if (refreshToken) {
      encryptedRefreshToken = CryptoService.encrypt(refreshToken);
    }
    return prisma.channel.upsert({
      where: { userId_provider_providerChannelId: { userId, provider: payload.provider, providerChannelId: payload.providerChannelId } },
      update: { displayName: payload.displayName ?? (result.displayName ?? payload.providerChannelId), encryptedRefreshToken },
      create: {
        userId,
        provider: payload.provider,
        providerChannelId: payload.providerChannelId,
        displayName: payload.displayName ?? (result.displayName ?? payload.providerChannelId),
        metaJson: data,
        encryptedRefreshToken,
      },
    });
  }

  static async disconnectChannel(userId: string, channelId: string) {
    const channel = await prisma.channel.findFirst({ where: { id: channelId, userId } });
    if (!channel) {
      const e = new Error('Channel not found');
      // @ts-ignore
      e.status = 404;
      throw e;
    }
    try {
      const client = getProviderClient(channel.provider);
      await client.disconnect({
        provider: channel.provider,
        providerChannelId: channel.providerChannelId,
        displayName: channel.displayName,
        encryptedRefreshToken: channel.encryptedRefreshToken,
        metaJson: channel.metaJson as unknown,
      });
    } catch {
      // best-effort; continue to remove locally
    }
    await prisma.job.deleteMany({ where: { channelId: channel.id, userId } });
    await prisma.channel.delete({ where: { id: channel.id } });
    return { ok: true };
  }

  static async refreshChannel(userId: string, channelId: string) {
    const channel = await prisma.channel.findFirst({ where: { id: channelId, userId } });
    if (!channel) {
      const e = new Error('Channel not found');
      // @ts-ignore
      e.status = 404;
      throw e;
    }
    const client = getProviderClient(channel.provider);
    const result = await client.refresh({
      provider: channel.provider,
      providerChannelId: channel.providerChannelId,
      displayName: channel.displayName,
      encryptedRefreshToken: channel.encryptedRefreshToken,
      metaJson: channel.metaJson as unknown,
    });
    const data = result.meta ?? {};
    // If token rotated, re-encrypt
    let encryptedRefreshToken: string | undefined = channel.encryptedRefreshToken || undefined;
    const refreshToken = result.refreshToken;
    if (refreshToken) {
      encryptedRefreshToken = CryptoService.encrypt(refreshToken);
    }
    const updated = await prisma.channel.update({
      where: { id: channel.id },
      data: { metaJson: data, encryptedRefreshToken, lastSyncedAt: new Date(), status: result.status ?? 'ACTIVE' },
    });
    return updated;
  }

  static async refreshAllChannels(userId: string) {
    const channels = await prisma.channel.findMany({ where: { userId } });
    const results = await Promise.allSettled(
      channels.map((ch) => this.refreshChannel(userId, ch.id))
    );
    const succeeded = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;
    return { total: channels.length, succeeded, failed };
  }
}


