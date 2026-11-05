import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { configureApp, logLevels } from './app.setup';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true, logger: logLevels(process.env.LOG_LEVEL ?? 'log') });
  app.set('trust proxy', 1); // behind a load balancer / reverse proxy
  app.disable('x-powered-by');
  configureApp(app);
  const cfg = app.get(ConfigService);
  const port = cfg.get<number>('PORT')!;
  await app.listen(port, '0.0.0.0');
  Logger.log(`ConnectBhai API [${cfg.get('APP_ENV')}] http://localhost:${port}/${cfg.get('API_PREFIX')}`, 'Bootstrap');
}
bootstrap().catch((e) => { console.error('Fatal start-up error:', e.message ?? e); process.exit(1); });
