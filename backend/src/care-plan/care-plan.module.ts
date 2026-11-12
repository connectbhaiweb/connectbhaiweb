import { Module } from '@nestjs/common';
import { CarePlanController } from './care-plan.controller';
import { CarePlanSyncService } from './care-plan-sync.service';
import { GenieAcsProvider } from './genieacs.provider';
import { SpeedTestRunner } from './speed-test.runner';
import { SpeedtestController } from './speedtest.controller';

@Module({ controllers: [CarePlanController, SpeedtestController], providers: [GenieAcsProvider, CarePlanSyncService, SpeedTestRunner], exports: [GenieAcsProvider] })
export class CarePlanModule {}
