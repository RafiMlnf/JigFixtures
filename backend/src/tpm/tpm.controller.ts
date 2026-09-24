import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { TpmService } from './tpm.service';
import { CreateTpmChecklistDto } from './dto/create-tpm-checklist.dto';
import { CreateTpmLogDto } from './dto/create-tpm-log.dto';
import { UpdateTpmScheduleDto } from './dto/update-tpm-schedule.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('tpm')
@UseGuards(JwtAuthGuard)
export class TpmController {
  constructor(private readonly tpmService: TpmService) {}

  /** Get overall TPM summary & health score */
  @Get('summary')
  getSummary() {
    return this.tpmService.getSummary();
  }

  /** Get list of schedules and 2-way lifetime statuses */
  @Get('schedules')
  getSchedules(
    @Query('search') search?: string,
    @Query('lineId') lineId?: string,
    @Query('processId') processId?: string,
    @Query('status') status?: string,
    @Query('type') type?: 'ALL' | 'DESIGN' | 'CELL_PART',
  ) {
    return this.tpmService.getSchedules({ search, lineId, processId, status, type });
  }

  /** Update schedule deadlines or lifetime thresholds */
  @Patch('schedule/:id')
  updateSchedule(@Param('id') id: string, @Body() dto: UpdateTpmScheduleDto) {
    return this.tpmService.updateSchedule(id, dto);
  }

  /** Get checklists history */
  @Get('checklists')
  getChecklists(
    @Query('designId') designId?: string,
    @Query('result') result?: string,
    @Query('search') search?: string,
  ) {
    return this.tpmService.getChecklists({ designId, result, search });
  }

  /** Create a new checklist report */
  @Post('checklists')
  createChecklist(@Body() dto: CreateTpmChecklistDto, @Request() req: any) {
    return this.tpmService.createChecklist(dto, req.user?.id);
  }

  /** Delete a checklist report */
  @Delete('checklists/:id')
  deleteChecklist(@Param('id') id: string) {
    return this.tpmService.deleteChecklist(id);
  }

  /** Get maintenance logs */
  @Get('logs')
  getLogs(
    @Query('designId') designId?: string,
    @Query('actionType') actionType?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    return this.tpmService.getLogs({ designId, actionType, status, search });
  }

  /** Create a new maintenance log */
  @Post('logs')
  createLog(@Body() dto: CreateTpmLogDto) {
    return this.tpmService.createLog(dto);
  }

  /** Delete a maintenance log */
  @Delete('logs/:id')
  deleteLog(@Param('id') id: string) {
    return this.tpmService.deleteLog(id);
  }
}
