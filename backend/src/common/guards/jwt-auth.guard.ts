import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { IS_PUBLIC } from '../decorators';

/** Global guard. Routes are private unless marked @Public(). A bearer token, if present, is always parsed. */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private reflector: Reflector, private jwt: JwtService, private cfg: ConfigService) {}
  async canActivate(ctx: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [ctx.getHandler(), ctx.getClass()]);
    const req = ctx.switchToHttp().getRequest();
    const header: string | undefined = req.headers['authorization'];
    const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
    if (!token) {
      if (isPublic) return true;
      throw new UnauthorizedException('Missing access token');
    }
    try {
      const p = await this.jwt.verifyAsync(token, { secret: this.cfg.getOrThrow('JWT_SECRET') });
      if (p.typ !== 'access') throw new Error('wrong token type');
      req.user = { id: Number(p.sub), role: p.role, phone: p.phone };
      return true;
    } catch {
      if (isPublic) return true; // optional auth on public routes
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
