import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';

/** One consistent error shape: { statusCode, error, message, path, timestamp }. Never leaks stack traces. */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exceptions');
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse();
    const req = ctx.getRequest();
    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const r = exception.getResponse();
      message = typeof r === 'string' ? r : ((r as any).message ?? exception.message);
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      switch (exception.code) {
        case 'P2002': status = HttpStatus.CONFLICT; message = `Already exists (${(exception.meta?.target as string[] | string) ?? 'duplicate'})`; break;
        case 'P2025': status = HttpStatus.NOT_FOUND; message = 'Record not found'; break;
        case 'P2003': status = HttpStatus.BAD_REQUEST; message = 'Related record does not exist'; break;
        default: this.logger.error(`${exception.code}: ${exception.message}`);
      }
    } else if (typeof (exception as any)?.status === 'number' && (exception as any).status >= 400 && (exception as any).status < 500) {
      // http-errors raised by Express / body-parser (payload too large, malformed JSON, unsupported charset ...)
      status = (exception as any).status;
      message = status === HttpStatus.PAYLOAD_TOO_LARGE ? 'Request body is too large' : status === 400 ? 'Malformed request' : ((exception as any).message ?? 'Bad request');
    } else {
      this.logger.error(exception instanceof Error ? exception.stack : String(exception));
    }
    res.status(status).json({
      statusCode: status,
      error: HttpStatus[status] ?? 'Error',
      message,
      path: req.url,
      timestamp: new Date().toISOString(),
    });
  }
}
