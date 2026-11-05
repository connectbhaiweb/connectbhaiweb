import { BadRequestException, ForbiddenException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { AuthUser } from '../common/decorators';

export type UploadPurpose = 'kyc' | 'ticket' | 'chat' | 'logo' | 'sheet';

interface PurposeRule { folder: string; type: 'authenticated' | 'upload'; who: 'anyone' | 'login' | 'admin' | 'admin_or_tip'; formats: string }

/** Every upload in the product goes to Cloudinary, in one folder per purpose. KYC documents are `authenticated` (never public). */
export const PURPOSES: Record<UploadPurpose, PurposeRule> = {
  kyc:    { folder: 'connectbhai/kyc',     type: 'authenticated', who: 'anyone',       formats: 'jpg,jpeg,png,pdf' },   // partners upload before they have a login
  ticket: { folder: 'connectbhai/tickets', type: 'authenticated', who: 'login',        formats: 'jpg,jpeg,png,pdf' },
  chat:   { folder: 'connectbhai/chat',    type: 'authenticated', who: 'login',        formats: 'jpg,jpeg,png,pdf' },
  logo:   { folder: 'connectbhai/logos',   type: 'upload',        who: 'admin',        formats: 'jpg,jpeg,png,svg,webp' },
  sheet:  { folder: 'connectbhai/sheets',  type: 'authenticated', who: 'admin_or_tip', formats: 'xlsx,csv' },
};

export interface UploadedAsset { public_id: string; version: number; signature: string; format?: string; resource_type?: string; bytes?: number }

const sha1 = (s: string) => createHash('sha1').update(s).digest('hex');
/** Cloudinary signing: sort params, join as k=v&k=v, append the API secret, SHA-1. */
export const signParams = (params: Record<string, string | number>, secret: string) =>
  sha1(Object.keys(params).filter((k) => params[k] !== '' && params[k] != null).sort().map((k) => `${k}=${params[k]}`).join('&') + secret);

@Injectable()
export class UploadsService {
  constructor(private cfg: ConfigService) {}

  private get cloud() { return this.cfg.get<string>('CLOUDINARY_CLOUD_NAME') || ''; }
  private get key() { return this.cfg.get<string>('CLOUDINARY_API_KEY') || ''; }
  private get secret() { return this.cfg.get<string>('CLOUDINARY_API_SECRET') || ''; }
  private get apiBase() { return (this.cfg.get<string>('CLOUDINARY_API_URL') || 'https://api.cloudinary.com/v1_1').replace(/\/$/, ''); }
  get configured() { return !!(this.cloud && this.key && this.secret); }
  get maxBytes() { return Number(this.cfg.get('UPLOAD_MAX_MB') || 5) * 1024 * 1024; }

  /** Parameters the browser needs to upload straight to Cloudinary. The secret never leaves the server. */
  sign(purpose: UploadPurpose, user?: AuthUser) {
    const rule = PURPOSES[purpose];
    if (!rule) throw new BadRequestException('Unknown upload purpose');
    if (rule.who !== 'anyone' && !user) throw new ForbiddenException('Log in to upload');
    if (rule.who === 'admin' && user?.role !== 'admin') throw new ForbiddenException('Only admin can upload this');
    if (rule.who === 'admin_or_tip' && !['admin', 'tip'].includes(user?.role ?? '')) throw new ForbiddenException('Only admin or TIP can upload this');
    if (!this.configured) throw new ServiceUnavailableException('File uploads are not configured yet (Cloudinary keys missing)');
    const timestamp = Math.floor(Date.now() / 1000);
    const params: Record<string, string | number> = { allowed_formats: rule.formats, folder: rule.folder, timestamp, type: rule.type };
    return {
      cloud_name: this.cloud, api_key: this.key, timestamp, signature: signParams(params, this.secret),
      folder: rule.folder, type: rule.type, allowed_formats: rule.formats, max_bytes: this.maxBytes,
      upload_url: `${this.apiBase}/${this.cloud}/auto/upload`,
    };
  }

  /** Cloudinary signs every upload response: sha1("public_id=..&version=.." + secret). Proves the asset really came from us. */
  verifyAsset(purpose: UploadPurpose, a: UploadedAsset): boolean {
    if (!this.configured || !a?.public_id || !a.signature) return false;
    if (!a.public_id.startsWith(PURPOSES[purpose].folder + '/')) return false;
    return sha1(`public_id=${a.public_id}&version=${a.version}${this.secret}`) === a.signature;
  }

  /** Short-lived (10 min) download link for a private asset, for admin review. Built with Cloudinary's private-download signature. */
  downloadUrl(a: { public_id: string; format?: string; resource_type?: string }, ttlSeconds = 600) {
    if (!this.configured) throw new ServiceUnavailableException('File uploads are not configured yet');
    const now = Math.floor(Date.now() / 1000);
    const params: Record<string, string | number> = { expires_at: now + ttlSeconds, format: a.format ?? '', public_id: a.public_id, timestamp: now, type: 'authenticated' };
    const signature = signParams(params, this.secret);
    const q = new URLSearchParams(Object.fromEntries(Object.entries({ ...params, api_key: this.key, signature }).filter(([, v]) => v !== '').map(([k, v]) => [k, String(v)])));
    return `${this.apiBase}/${this.cloud}/${a.resource_type ?? 'image'}/download?${q.toString()}`;
  }
}
