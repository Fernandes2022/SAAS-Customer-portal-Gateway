import { ProviderClient, ChannelLike } from './types';

// Minimal stub provider that pretends to schedule an upload successfully.
export class GenericProvider implements ProviderClient {
  async connect(input: { providerChannelId: string; displayName?: string }) {
    return { displayName: input.displayName ?? input.providerChannelId, meta: { connected: true } };
  }

  async refresh(_channel: ChannelLike) {
    return { meta: { ok: true }, status: 'ACTIVE' as const };
  }

  async disconnect(_channel: ChannelLike) {
    return;
  }

  async scheduleUpload(_args: { channel: ChannelLike; job: { assetUrl: string; title: string; description?: string; scheduledAt: string } }) {
    // Simulate an async call
    await new Promise((r) => setTimeout(r, 200));
    return;
  }
}


