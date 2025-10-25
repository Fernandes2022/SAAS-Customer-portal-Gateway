export type ChannelLike = {
  provider: string;
  providerChannelId: string;
  displayName: string;
  encryptedRefreshToken?: string | null;
  metaJson?: unknown;
};

export interface ProviderClient {
  connect(input: { providerChannelId: string; displayName?: string }): Promise<{
    displayName?: string;
    refreshToken?: string;
    meta?: unknown;
  }>;

  refresh(channel: ChannelLike): Promise<{
    meta?: unknown;
    status?: 'ACTIVE' | 'REVOKED' | 'ERROR';
    refreshToken?: string;
  }>;

  disconnect(channel: ChannelLike): Promise<void>;

  scheduleUpload(args: {
    channel: ChannelLike;
    job: { assetUrl: string; title: string; description?: string; scheduledAt: string };
  }): Promise<void>;
}


