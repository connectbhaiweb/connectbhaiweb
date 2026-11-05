import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthUser, CurrentUser, Public, Roles } from '../common/decorators';
import { AssignDto, CreateLeadDto, LeadQuery, LeadStatusDto, NoteDto, TrackQuery } from './leads.dto';
import { LeadsService } from './leads.service';

@ApiTags('leads') @Controller('leads')
export class LeadsController {
  constructor(private leads: LeadsService) {}

  /** Public (website / callback form). If a token is sent, a DSA/admin/customer is recorded as the origin. */
  @Public() @Throttle({ default: { limit: 20, ttl: 60_000 } }) @Post()
  create(@Body() d: CreateLeadDto, @CurrentUser() u?: AuthUser) { return this.leads.create(d, u); }

  @Public() @Throttle({ default: { limit: 20, ttl: 60_000 } }) @Get('track')
  track(@Query() q: TrackQuery) { return this.leads.track(q.ref_code, q.phone); }

  @ApiBearerAuth() @Get()
  list(@Query() q: LeadQuery, @CurrentUser() u: AuthUser) { return this.leads.list(q, u); }

  @ApiBearerAuth() @Get(':id')
  one(@Param('id', ParseIntPipe) id: number, @CurrentUser() u: AuthUser) { return this.leads.getScoped(id, u); }

  @ApiBearerAuth() @Get(':id/events')
  events(@Param('id', ParseIntPipe) id: number, @CurrentUser() u: AuthUser) { return this.leads.events(id, u); }

  @ApiBearerAuth() @Roles('admin', 'tip', 'customer') @Patch(':id/status')
  status(@Param('id', ParseIntPipe) id: number, @Body() d: LeadStatusDto, @CurrentUser() u: AuthUser) { return this.leads.changeStatus(id, d, u); }

  @ApiBearerAuth() @Roles('admin') @Patch(':id/assign')
  assign(@Param('id', ParseIntPipe) id: number, @Body() d: AssignDto, @CurrentUser() u: AuthUser) { return this.leads.assign(id, d, u); }

  @ApiBearerAuth() @Post(':id/notes')
  note(@Param('id', ParseIntPipe) id: number, @Body() d: NoteDto, @CurrentUser() u: AuthUser) { return this.leads.addNote(id, d.note, u); }
}
