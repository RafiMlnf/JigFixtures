import { Controller, Get, Post, Patch, Delete, Param, Body, Query, Request, UseGuards } from '@nestjs/common';
import { AbnormalityService } from './abnormality.service';
import { CreateAbnormalityDto } from './dto/create-abnormality.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('abnormality')
@UseGuards(JwtAuthGuard)
export class AbnormalityController {
  constructor(private readonly abnormalityService: AbnormalityService) {}

  /** Submit a new abnormality report */
  @Post()
  create(@Body() dto: CreateAbnormalityDto, @Request() req: any) {
    return this.abnormalityService.create(dto, req.user.id);
  }

  /** Get all abnormality reports */
  @Get()
  findAll() {
    return this.abnormalityService.findAll();
  }

  /** Update abnormality status */
  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body('status') status: 'OPEN' | 'MONITORING' | 'CLOSED',
  ) {
    return this.abnormalityService.updateStatus(id, status);
  }

  /** Get Machine Dashboard Cards (with 2-circle status) */
  @Get('machines')
  getMachines(@Query('line') line?: string) {
    return this.abnormalityService.getMachinesDashboard(line);
  }

  /** Register a new machine */
  @Post('machines')
  createMachine(
    @Body()
    dto: {
      name: string;
      code: string;
      lineId: string;
      designId?: string;
      location?: string;
      description?: string;
    },
  ) {
    return this.abnormalityService.createMachine(dto);
  }

  /** Update machine manual status (Jig Condition and TPM Schedule) */
  @Patch('machines/:id/status')
  updateMachineStatus(
    @Param('id') id: string,
    @Body()
    dto: {
      jigCondition?: 'SAFE' | 'WARNING' | 'OVERDUE' | 'AUTO';
      tpmSchedule?: 'SAFE' | 'WARNING' | 'OVERDUE' | 'AUTO';
    },
  ) {
    return this.abnormalityService.updateMachineStatus(id, dto);
  }

  /** Delete a machine */
  @Delete('machines/:id')
  deleteMachine(@Param('id') id: string) {
    return this.abnormalityService.deleteMachine(id);
  }
}
