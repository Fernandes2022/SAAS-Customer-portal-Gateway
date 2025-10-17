import axios from 'axios';
import { prisma } from '../prisma';
import { env } from '../env';
import { CryptoService } from './crypto.service';

export class ChannelsService {
  static async listUserChannels(userId: string) {
    return prisma.channel.findMany({ where: { userId } });
  }

  static async connectChannel(userId: string, payload: { provider: string; providerChannelId: string; displayName?: string }) {
    const res = await axios.post(`${env.BUBBLE_BASE_URL}/api/1.1/wf/connect_channel`, payload, {
      headers: { Authorization: `Bearer ${env.BUBBLE_API_KEY}` },
    });
    const data = res.data;
    // If Bubble returns a refresh token, encrypt before storing
    let encryptedRefreshToken: string | undefined = undefined;
    const refreshToken = (data && (data.refreshToken || data.refresh_token)) as string | undefined;
    if (refreshToken) {
      encryptedRefreshToken = CryptoService.encrypt(refreshToken);
      // Never include raw token in meta
      if (data.refreshToken) delete data.refreshToken;
      if (data.refresh_token) delete data.refresh_token;
    }
    return prisma.channel.upsert({
      where: { userId_provider_providerChannelId: { userId, provider: payload.provider, providerChannelId: payload.providerChannelId } },
      update: { displayName: payload.displayName ?? data?.displayName ?? payload.providerChannelId, encryptedRefreshToken },
      create: {
        userId,
        provider: payload.provider,
        providerChannelId: payload.providerChannelId,
        displayName: payload.displayName ?? data?.displayName ?? payload.providerChannelId,
        metaJson: data ?? {},
        encryptedRefreshToken,
      },
    });
  }
}


