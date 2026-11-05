import { Module } from '@nestjs/common';
import { LeadsModule } from '../leads/leads.module';
import { PaymentsModule } from '../payments/payments.module';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';

@Module({ imports: [LeadsModule, PaymentsModule], controllers: [BookingsController], providers: [BookingsService] })
export class BookingsModule {}
