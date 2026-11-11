import { Controller, Get, Query, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { Response } from 'express';
import { Public } from '../common/decorators';

const MB = 1024 * 1024;

/**
 * Test file for the modem's own TR-143 download test (the Care Plan speed test). The modem fetches it over plain http
 * (set SPEEDTEST_FILE_URL to this route on a plain-http address, e.g. a Railway TCP proxy). Public and unthrottled on
 * purpose: the modem sends no login. Size is capped so it cannot be used to pull large amounts of data.
 */
@ApiTags('speedtest') @Public() @SkipThrottle() @Controller('speedtest')
export class SpeedtestController {
  @Get('file')
  async file(@Query('mb') mb: string | undefined, @Res() res: Response) {
    const size = Math.min(Math.max(Math.floor(Number(mb)) || 10, 1), 25) * MB;
    res.status(200).set({ 'Content-Type': 'application/octet-stream', 'Content-Length': String(size), 'Cache-Control': 'no-store, no-transform', 'Content-Encoding': 'identity' });
    const chunk = Buffer.alloc(64 * 1024);
    async function* body() { for (let sent = 0; sent < size; sent += chunk.length) yield chunk.subarray(0, Math.min(chunk.length, size - sent)); }
    await pipeline(Readable.from(body()), res).catch(() => undefined);   // the modem may hang up early: not an error
  }
}
