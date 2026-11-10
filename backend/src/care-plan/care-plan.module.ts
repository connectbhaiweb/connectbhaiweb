import { Module } from '@nestjs/common';
import { CarePlanController } from './care-plan.controller';
import { GenieAcsProvider } from './genieacs.provider';

@Module({ controllers: [CarePlanController], providers: [GenieAcsProvider], exports: [GenieAcsProvider] })
export class CarePlanModule {}
