import { ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/** Rate limiting can be switched off with THROTTLE_ENABLED=false (used by the test-suite only). */
@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  protected async shouldSkip(_ctx: ExecutionContext): Promise<boolean> {
    return process.env.THROTTLE_ENABLED === 'false';
  }
}
