import { Module } from '@nestjs/common';
import { PincodeService } from './pincode.service';
import { LocationsController } from './locations.controller';

@Module({ controllers: [LocationsController], providers: [PincodeService], exports: [PincodeService] })
export class LocationsModule {}
