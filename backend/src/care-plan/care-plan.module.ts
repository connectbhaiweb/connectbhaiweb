import { Module } from '@nestjs/common';
import { CarePlanController } from './care-plan.controller';
import { CarePlanSyncService } from './care-plan-sync.service';
import { GenieAcsProvider } from './genieacs.provider';

@Module({ controllers: [CarePlanController], providers: [GenieAcsProvider, CarePlanSyncService], exports: [GenieAcsProvider] })
export class CarePlanModule {}
