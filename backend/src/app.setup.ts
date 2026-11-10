import { INestApplication, Logger, LogLevel, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import compression from 'compression';
import helmet from 'helmet';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

/** Everything that makes the HTTP app production-ready. Shared by main.ts and the e2e tests so they behave identically. */
export function configureApp(app: INestApplication) {
  const cfg = app.get(ConfigService);
  const prefix = cfg.get<string>('API_PREFIX')!;
  const origins = cfg.get<string>('FRONTEND_URL')!.split(',').map((s) => s.trim()).filter(Boolean);

  app.setGlobalPrefix(prefix, { exclude: ['health', 'health/ready'] });
  // how long every request took, so a slow screen can be traced to the exact call (slow ones, over 400 ms, are logged as warnings)
  if (cfg.get('APP_ENV') !== 'test') {
    const log = new Logger('http');
    app.use((req: any, res: any, next: () => void) => {
      const t0 = process.hrtime.bigint();
      res.on('finish', () => {
        const ms = Number(process.hrtime.bigint() - t0) / 1e6;
        if (req.originalUrl?.startsWith('/health')) return;
        const line = `${req.method} ${String(req.originalUrl).split('?')[0]} ${res.statusCode} ${Math.round(ms)}ms`;
        ms > 400 ? log.warn(`SLOW ${line}`) : log.log(line);
      });
      next();
    });
  }
  app.use(helmet());
  app.use(compression());
  app.enableCors({ origin: origins, credentials: true, methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'] });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true, transformOptions: { enableImplicitConversion: false } }));
  app.useGlobalFilters(new AllExceptionsFilter());
  app.enableShutdownHooks();

  if (cfg.get('SWAGGER_ENABLED') && cfg.get('APP_ENV') !== 'production') {
    const doc = SwaggerModule.createDocument(app, new DocumentBuilder().setTitle('ConnectBhai API').setVersion('1.0').addBearerAuth().build());
    SwaggerModule.setup('docs', app, doc);
  }
}
export const logLevels = (level: string): LogLevel[] => {
  const all: LogLevel[] = ['error', 'warn', 'log', 'debug', 'verbose'];
  return all.slice(0, Math.max(1, all.indexOf(level as LogLevel) + 1));
};
