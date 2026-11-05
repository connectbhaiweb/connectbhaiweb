import { Module } from '@nestjs/common';
import { PaymentsModule } from '../payments/payments.module';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({ imports: [PaymentsModule], controllers: [UsersController], providers: [UsersService], exports: [UsersService] })
export class UsersModule {}
