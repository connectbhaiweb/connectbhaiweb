import { Module } from '@nestjs/common';
import { ChargesService } from './charges.service';
import { PaymentsController } from './payments.controller';
import { RazorpayService } from './razorpay.service';

@Module({ controllers: [PaymentsController], providers: [ChargesService, RazorpayService], exports: [ChargesService, RazorpayService] })
export class PaymentsModule {}
