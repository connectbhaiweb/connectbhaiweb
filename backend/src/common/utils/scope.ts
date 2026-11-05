import { Prisma } from '@prisma/client';
import { AuthUser } from '../decorators';

/** Which leads a user may see: admin all, TIP assigned, DSA the ones they brought, customer their own. */
export function leadScope(u: AuthUser): Prisma.LeadWhereInput {
  switch (u.role) {
    case 'admin': return {};
    case 'tip': return { tip_user_id: u.id };
    case 'dsa': return { brought_by_user_id: u.id };
    default: return { OR: [{ customer_user_id: u.id }, ...(u.phone ? [{ customer_phone: u.phone }] : [])] };
  }
}
