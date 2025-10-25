import { ProviderClient, ChannelLike } from './types';

// RSS provider: connect just stores the feed URL; scheduleUpload would add an item to an internal feed store.
// For now, it is a no-op to keep flows working end-to-end.
export class RssProvider implements ProviderClient {
  async connect(input: { providerChannelId: string; displayName?: string }) {
    // providerChannelId is the RSS feed URL
    return { displayName: input.displayName ?? input.providerChannelId, meta: { url: input.providerChannelId } };
  }

  async refresh(channel: ChannelLike) {
    return { meta: channel.metaJson ?? {}, status: 'ACTIVE' as const };
  }

  async disconnect(_channel: ChannelLike) {
    return;
  }

  async scheduleUpload(_args: { channel: ChannelLike; job: { assetUrl: string; title: string; description?: string; scheduledAt: string } }) {
    // In a real implementation, push an item to your feed DB and regenerate XML.
    return;
  }
}


