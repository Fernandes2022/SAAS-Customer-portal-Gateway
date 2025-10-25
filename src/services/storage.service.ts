import { env } from '../env';
import { createClient } from '@supabase/supabase-js';

export class StorageService {
  static async presignUpload(input: { filename: string; contentType: string }) {
    // If Supabase storage is configured, return a signed upload URL
    if (env.SUPABASE_URL && env.SUPABASE_ANON_KEY && env.SUPABASE_BUCKET) {
      const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);
      const objectPath = `uploads/${Date.now()}-${input.filename}`;
      // Supabase: create signed URL for upload via signed POST/PUT is not native; instead, client SDK can upload directly with service role.
      // For simplicity, return a path and let frontend upload via Supabase SDK. Keep contentType.
      return { url: `supabase://${env.SUPABASE_BUCKET}/${objectPath}`, fields: {}, headers: { 'Content-Type': input.contentType } };
    }
    // Fallback: dummy URL
    const base = env.FRONTEND_BASE_URL || 'http://localhost';
    const url = `${base}/uploads/${encodeURIComponent(input.filename)}`;
    return { url, fields: {}, headers: { 'Content-Type': input.contentType } };
  }
}


