import { Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const logger = new Logger('fulltext');
const MAX_IDS = 3000;

/**
 * ids of the rows whose searchable columns (leads: name, phone, reference code; users: name, phone, partner code) contain `text`
 * (any fragment of 2+ characters, case-insensitive), newest first, answered from the ngram full-text index
 * (migration 20261111100000_fulltext_search).
 *
 * Returns null when the index cannot answer (a 1-character search, or the index is missing): the caller then uses its ordinary
 * "contains" filter, so the results are the same, only slower.
 */
export async function fulltextIds(prisma: PrismaService, table: 'leads' | 'users', text: string): Promise<number[] | null> {
  const raw = text.trim();
  // a reference code keeps its hyphen ("CB-000142"); anything else loses the boolean-mode operators so it is searched as plain text
  const phrase = /^[A-Za-z]{2,4}-\d+$/.test(raw) ? raw : raw.replace(/["\\+\-<>()~*@]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (phrase.replace(/\s/g, '').length < 2) return null;
  const against = `"${phrase}"`;
  try {
    const rows = table === 'leads'
      ? await prisma.$queryRaw<{ id: bigint }[]>`SELECT id FROM leads WHERE MATCH(customer_name, customer_phone, ref_code) AGAINST (${against} IN BOOLEAN MODE) ORDER BY id DESC LIMIT ${MAX_IDS}`
      : await prisma.$queryRaw<{ id: bigint }[]>`SELECT id FROM users WHERE MATCH(name, phone, partner_code) AGAINST (${against} IN BOOLEAN MODE) ORDER BY id DESC LIMIT ${MAX_IDS}`;
    return rows.map((r) => Number(r.id));
  } catch (e: any) {
    logger.warn(`full-text search on ${table} unavailable, using LIKE: ${String(e?.message ?? e).slice(0, 120)}`);
    return null;
  }
}

/** WHERE clause for "lead matches this search text" (reference code, name, phone), shared by every list that searches through its lead. */
export async function leadTextWhere(prisma: PrismaService, text: string): Promise<Prisma.LeadWhereInput> {
  const s = text.trim();
  if (/^CB-\d{6,}$/i.test(s)) return { ref_code: s.toUpperCase() };
  const ids = await fulltextIds(prisma, 'leads', s);
  if (ids) return { id: { in: ids } };
  return { OR: [{ customer_name: { contains: s } }, { customer_phone: { contains: s } }, { ref_code: { contains: s } }] };
}
