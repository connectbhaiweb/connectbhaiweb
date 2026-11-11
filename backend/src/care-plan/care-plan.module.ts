import { Module } from '@nestjs/common';
import { CarePlanController } from './care-plan.controller';
import { CarePlanSyncService } from './care-plan-sync.service';
import { GenieAcsProvider } from './genieacs.provider';
import { SpeedtestController } from './speedtest.controller';

@Module({ controllers: [CarePlanController, SpeedtestController], providers: [GenieAcsProvider, CarePlanSyncService], exports: [GenieAcsProvider] })
export class CarePlanModule {}
