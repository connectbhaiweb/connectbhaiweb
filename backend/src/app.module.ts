import './common/utils/serialize';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { AssetUrlInterceptor } from './common/interceptors/asset-url.interceptor';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppThrottlerGuard } from './common/guards/app-throttler.guard';
import { AuthModule } from './auth/auth.module';
import { BookingsModule } from './bookings/bookings.module';
import { CarePlanModule } from './care-plan/care-plan.module';
import { CatalogueModule } from './catalogue/catalogue.module';
import { ChatModule } from './chat/chat.module';
import { CommissionsModule } from './commissions/commissions.module';
import { JobsModule } from './common/jobs/jobs.service';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { PrismaModule } from './common/prisma/prisma.module';
import { envValidationSchema } from './config/env.validation';
import { HealthController } from './health/health.controller';
import { LeadsModule } from './leads/leads.module';
import { LocationsModule } from './locations/locations.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PaymentsModule } from './payments/payments.module';
import { ReportsModule } from './reports/reports.module';
import { SettingsModule } from './settings/settings.module';
import { UploadsModule } from './uploads/uploads.module';
import { TicketsModule } from './tickets/tickets.module';
import { UsersModule } from './users/users.module';
import { WaitlistModule } from './waitlist/waitlist.module';

@Module({
  imports: [JobsModule, 
    ConfigModule.forRoot({ isGlobal: true, cache: true, envFilePath: ['.env'], validationSchema: envValidationSchema, validationOptions: { abortEarly: false } as any }),
    ThrottlerModule.forRoot([{ ttl: Number(process.env.THROTTLE_TTL_SECONDS ?? 60) * 1000, limit: Number(process.env.THROTTLE_LIMIT ?? 120) }]),
    PrismaModule, SettingsModule, UploadsModule, NotificationsModule, AuthModule,
    LocationsModule, CatalogueModule, UsersModule, LeadsModule, BookingsModule, PaymentsModule, CommissionsModule,
    TicketsModule, ChatModule, CarePlanModule, WaitlistModule, ReportsModule,
  ],
  controllers: [HealthController],
  providers: [
    // order matters: rate-limit -> authenticate -> authorise by role
    { provide: APP_GUARD, useClass: AppThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_INTERCEPTOR, useClass: AssetUrlInterceptor },
  ],
})
export class AppModule {}
