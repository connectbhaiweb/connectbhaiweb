import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/** Prisma's default pool is (CPU cores x 2 + 1) connections, only 3-5 on a small host. Requests and the background jobs share it, so they queue behind each other. DB_POOL_SIZE (default 15) raises it; a connection_limit already in DATABASE_URL wins. */
export function withPool(url: string | undefined, size: number): string | undefined {
  if (!url || /[?&]connection_limit=/.test(url)) return url;
  return `${url}${url.includes('?') ? '&' : '?'}connection_limit=${size}&pool_timeout=20`;
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  constructor() {
    const url = withPool(process.env.DATABASE_URL, Number(process.env.DB_POOL_SIZE ?? 15));
    super(url ? { datasourceUrl: url } : undefined);
  }
  async onModuleInit() {
    await this.$connect();
    this.logger.log('Database connected');
  }
  async onModuleDestroy() {
    await this.$disconnect();
  }
}
