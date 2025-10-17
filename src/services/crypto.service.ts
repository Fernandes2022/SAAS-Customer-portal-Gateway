import crypto from 'crypto';
import { env } from '../env';

const IV_LENGTH = 12; // AES-GCM recommended 12 bytes

export class CryptoService {
  static encrypt(plaintext: string): string {
    const iv = crypto.randomBytes(IV_LENGTH);
    const key = Buffer.from(env.ENCRYPTION_KEY.substring(0, 32));
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return Buffer.concat([iv, authTag, encrypted]).toString('base64');
  }

  static decrypt(ciphertextB64: string): string {
    const data = Buffer.from(ciphertextB64, 'base64');
    const iv = data.subarray(0, IV_LENGTH);
    const authTag = data.subarray(IV_LENGTH, IV_LENGTH + 16);
    const encrypted = data.subarray(IV_LENGTH + 16);
    const key = Buffer.from(env.ENCRYPTION_KEY.substring(0, 32));
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString('utf8');
  }
}


