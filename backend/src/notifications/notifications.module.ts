import { Global, Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { FeedbackRequestService } from './feedback-request.service';
import { PaymentReminderService } from './payment-reminder.service';
import { NotificationsService } from './notifications.service';

@Global()
@Module({ controllers: [NotificationsController], providers: [NotificationsService, FeedbackRequestService, PaymentReminderService], exports: [NotificationsService, FeedbackRequestService, PaymentReminderService] })
export class NotificationsModule {}
