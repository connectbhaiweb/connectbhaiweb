import { Module } from '@nestjs/common';
import { CarePlanController } from './care-plan.controller';
import { CarePlanSyncService } from './care-plan-sync.service';
import { GenieAcsProvider } from './genieacs.provider';
import { DeviceActionRunner } from './device-action.runner';
import { SpeedTestRunner } from './speed-test.runner';
import { SpeedtestController } from './speedtest.controller';

@Module({ controllers: [CarePlanController, SpeedtestController], providers: [GenieAcsProvider, CarePlanSyncService, SpeedTestRunner, DeviceActionRunner], exports: [GenieAcsProvider] })
export class CarePlanModule {}
