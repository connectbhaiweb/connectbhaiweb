import { Body, Controller, Get, HttpCode, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthUser, CurrentUser, Roles } from '../common/decorators';
import { BookingQuery, CompleteBookingDto, CreateBookingDto, UpdateBookingDto } from './bookings.dto';
import { BookingsService } from './bookings.service';

@ApiTags('bookings') @ApiBearerAuth() @Controller('bookings')
export class BookingsController {
  constructor(private s: BookingsService) {}
  @Roles('admin', 'tip') @Post() create(@Body() d: CreateBookingDto, @CurrentUser() u: AuthUser) { return this.s.create(d, u); }
  @Get() list(@Query() q: BookingQuery, @CurrentUser() u: AuthUser) { return this.s.list(q, u); }
  @Get(':id') one(@Param('id', ParseIntPipe) id: number, @CurrentUser() u: AuthUser) { return this.s.one(id, u); }
  @Roles('admin', 'tip') @Patch(':id') update(@Param('id', ParseIntPipe) id: number, @Body() d: UpdateBookingDto, @CurrentUser() u: AuthUser) { return this.s.update(id, d, u); }
  @Roles('admin', 'tip') @Post(':id/start') @HttpCode(200) start(@Param('id', ParseIntPipe) id: number, @CurrentUser() u: AuthUser) { return this.s.start(id, u); }
  @Roles('admin', 'tip') @Post(':id/complete') @HttpCode(200)
  complete(@Param('id', ParseIntPipe) id: number, @Body() d: CompleteBookingDto, @CurrentUser() u: AuthUser) { return this.s.complete(id, d, u); }
}
