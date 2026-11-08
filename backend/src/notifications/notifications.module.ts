import { Global, Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { FeedbackRequestService } from './feedback-request.service';
import { NotificationsService } from './notifications.service';

@Global()
@Module({ controllers: [NotificationsController], providers: [NotificationsService, FeedbackRequestService], exports: [NotificationsService, FeedbackRequestService] })
export class NotificationsModule {}
