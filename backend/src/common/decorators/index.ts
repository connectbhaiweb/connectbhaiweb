import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import { UserRole } from '@prisma/client';

export const IS_PUBLIC = 'isPublic';
export const ROLES_KEY = 'roles';
/** Skip JWT auth for this route. */
export const Public = () => SetMetadata(IS_PUBLIC, true);
/** Restrict route to these roles. */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

export interface AuthUser { id: number; role: UserRole; phone?: string }
export const CurrentUser = createParamDecorator((_d: unknown, ctx: ExecutionContext): AuthUser => ctx.switchToHttp().getRequest().user);
