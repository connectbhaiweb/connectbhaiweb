import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { IS_PUBLIC, ROLES_KEY } from '../decorators';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './roles.guard';

const ctx = (req: any, meta: Record<string, any> = {}) => ({
  switchToHttp: () => ({ getRequest: () => req }), getHandler: () => ({ meta }), getClass: () => ({}),
}) as any;
const reflectorFor = (meta: Record<string, any>) => ({ getAllAndOverride: (k: string) => meta[k] }) as unknown as Reflector;
const cfg = { getOrThrow: () => 'secret-secret-secret' } as any;
const jwt = new JwtService({});
const token = (p: any) => jwt.signAsync(p, { secret: 'secret-secret-secret', expiresIn: '5m' });

describe('JwtAuthGuard', () => {
  it('blocks private routes without a token', async () => {
    const g = new JwtAuthGuard(reflectorFor({}), jwt, cfg);
    await expect(g.canActivate(ctx({ headers: {} }))).rejects.toBeInstanceOf(UnauthorizedException);
  });
  it('lets public routes through, with or without a token', async () => {
    const g = new JwtAuthGuard(reflectorFor({ [IS_PUBLIC]: true }), jwt, cfg);
    expect(await g.canActivate(ctx({ headers: {} }))).toBe(true);
    const req: any = { headers: { authorization: 'Bearer ' + (await token({ sub: 5, role: 'dsa', typ: 'access' })) } };
    expect(await g.canActivate(ctx(req))).toBe(true);
    expect(req.user).toMatchObject({ id: 5, role: 'dsa' });
  });
  it('rejects refresh tokens used as access tokens', async () => {
    const g = new JwtAuthGuard(reflectorFor({}), jwt, cfg);
    const req = { headers: { authorization: 'Bearer ' + (await token({ sub: 5, role: 'tip', typ: 'refresh' })) } };
    await expect(g.canActivate(ctx(req))).rejects.toBeInstanceOf(UnauthorizedException);
  });
  it('rejects tampered tokens', async () => {
    const g = new JwtAuthGuard(reflectorFor({}), jwt, cfg);
    const t = await token({ sub: 1, role: 'admin', typ: 'access' });
    await expect(g.canActivate(ctx({ headers: { authorization: `Bearer ${t}x` } }))).rejects.toBeInstanceOf(UnauthorizedException);
  });
});

describe('RolesGuard', () => {
  it('allows when no roles are required', () => expect(new RolesGuard(reflectorFor({})).canActivate(ctx({ user: { role: 'customer' } }))).toBe(true));
  it('allows a matching role and blocks others', () => {
    const g = new RolesGuard(reflectorFor({ [ROLES_KEY]: ['admin'] }));
    expect(g.canActivate(ctx({ user: { role: 'admin' } }))).toBe(true);
    expect(() => g.canActivate(ctx({ user: { role: 'dsa' } }))).toThrow(ForbiddenException);
    expect(() => g.canActivate(ctx({}))).toThrow(ForbiddenException);
  });
});
