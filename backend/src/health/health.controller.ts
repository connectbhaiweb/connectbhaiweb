import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../common/decorators';
import { PrismaService } from '../common/prisma/prisma.service';

@ApiTags('health') @Public() @SkipThrottle() @Controller('health')
export class HealthController {
  constructor(private prisma: PrismaService) {}
  /** Liveness: process is up. */
  @Get() live() { return { status: 'ok', uptime_seconds: Math.round(process.uptime()) }; }
  /** Readiness: database reachable. */
  @Get('ready') async ready() {
    try { await this.prisma.$queryRaw`SELECT 1`; return { status: 'ready', database: 'up' }; }
    catch { throw new ServiceUnavailableException({ status: 'not_ready', database: 'down' }); }
  }
}
