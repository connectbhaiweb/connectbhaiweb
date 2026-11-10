import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { GenieAcsProvider } from '../care-plan/genieacs.provider';
import { Public } from '../common/decorators';
import { PrismaService } from '../common/prisma/prisma.service';

@ApiTags('health') @Public() @SkipThrottle() @Controller('health')
export class HealthController {
  constructor(private prisma: PrismaService, private acs: GenieAcsProvider) {}
  /** Liveness: process is up. */
  @Get() live() { return { status: 'ok', uptime_seconds: Math.round(process.uptime()) }; }
  /** Readiness: database reachable. (Deliberately does NOT include the ACS: a modem-server outage must not take the API out of rotation.) */
  @Get('ready') async ready() {
    try { await this.prisma.$queryRaw`SELECT 1`; return { status: 'ready', database: 'up' }; }
    catch { throw new ServiceUnavailableException({ status: 'not_ready', database: 'down' }); }
  }
  /** GenieACS (modem server) NBI reachable? 200 when up (or mock mode), 503 when down. Safe for uptime monitors. */
  @Get('acs') async acsHealth() {
    const h = await this.acs.health();
    if (h.status === 'down') throw new ServiceUnavailableException(h);
    return h;
  }
}
