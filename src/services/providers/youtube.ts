import { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import { ProviderClient, ChannelLike } from './types';
import axios from 'axios';
import { CryptoService } from '../crypto.service';
import { env } from '../../env';

function getOAuthClient() {
  const client = new OAuth2Client(env.YOUTUBE_CLIENT_ID, env.YOUTUBE_CLIENT_SECRET, env.YOUTUBE_REDIRECT_URI);
  return client;
}

export class YoutubeProvider implements ProviderClient {
  async connect(input: { providerChannelId: string; displayName?: string }) {
    // For ready-made: assume manual paste of refresh token in dashboard later.
    // Here, just store channel ID and name.
    return { displayName: input.displayName ?? input.providerChannelId, meta: { channelId: input.providerChannelId } };
  }

  async refresh(channel: ChannelLike) {
    // Could fetch channel info with API if tokens exist; otherwise no-op
    return { meta: channel.metaJson ?? {}, status: 'ACTIVE' as const };
  }

  async disconnect(_channel: ChannelLike) {
    // Optionally revoke token if present
    return;
  }

  async scheduleUpload(args: { channel: ChannelLike; job: { assetUrl: string; title: string; description?: string; scheduledAt: string } }) {
    const { channel, job } = args;
    if (!channel.encryptedRefreshToken) return;
    const refreshToken = CryptoService.decrypt(channel.encryptedRefreshToken);
    const oauth2Client = getOAuthClient();
    oauth2Client.setCredentials({ refresh_token: refreshToken });
    const youtube = google.youtube({ version: 'v3', auth: oauth2Client as any });

    // Fetch the media to know size/content-type
    const head = await axios.head(job.assetUrl).catch(() => null);
    const contentLength = head?.headers?.['content-length'] ? Number(head.headers['content-length']) : undefined;
    const contentType = (head?.headers?.['content-type'] as string | undefined) || 'video/*';

    // Prepare metadata; schedule via status.publishAt (ISO 8601)
    const requestBody: any = {
      snippet: {
        title: job.title,
        description: job.description || '',
      },
      status: {
        privacyStatus: 'private',
        publishAt: new Date(job.scheduledAt).toISOString(),
        selfDeclaredMadeForKids: false,
      },
    };

    // Initiate resumable upload session
    const init = await youtube.videos.insert(
      {
        part: ['snippet', 'status'],
        requestBody,
      },
      {
        // Use axios to stream data to the upload URL after we get location
        // googleapis returns the upload URL in response headers for resumable uploads
        // We initiate with no media here to get the session URL.
      } as any
    );

    // Location header may be in init.headers if using low-level; as a fallback, use media upload directly
    // Simpler approach: use mediaBody stream with axios GET stream
    const media = await axios.get(job.assetUrl, { responseType: 'stream' });
    await youtube.videos.insert(
      {
        part: ['snippet', 'status'],
        requestBody,
        media: {
          body: media.data as any,
          mimeType: contentType,
        } as any,
      },
      {
        maxContentLength: contentLength,
        onUploadProgress: () => {},
      } as any
    );
  }
}


