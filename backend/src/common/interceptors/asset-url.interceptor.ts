import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Observable, map } from 'rxjs';
import { assetUrl } from '../utils/asset-url';

/**
 * The database stores only the Cloudinary path of an image (e.g. "v1793905280/connectbhai/logos/bsnl.svg").
 * This turns every `logo_url` in an API response into a full URL, using CLOUDINARY_CLOUD_NAME and CLOUDINARY_DELIVERY_URL from the
 * environment, so changing the host (custom domain / CDN) or the account never needs a data migration.
 */
@Injectable()
export class AssetUrlInterceptor implements NestInterceptor {
  constructor(private cfg: ConfigService) {}
  intercept(_: ExecutionContext, next: CallHandler): Observable<any> {
    const cloud = this.cfg.get<string>('CLOUDINARY_CLOUD_NAME') || '';
    const base = this.cfg.get<string>('CLOUDINARY_DELIVERY_URL') || 'https://res.cloudinary.com';
    const walk = (v: any): any => {
      if (Array.isArray(v)) return v.map(walk);
      if (v && typeof v === 'object' && !(v instanceof Date) && typeof v.toJSON !== 'function' && !Buffer.isBuffer(v)) {
        const o: Record<string, any> = {};
        for (const k of Object.keys(v)) o[k] = k === 'logo_url' && typeof v[k] === 'string' ? assetUrl(v[k], cloud, base) : walk(v[k]);
        return o;
      }
      return v;
    };
    return next.handle().pipe(map(walk));
  }
}
