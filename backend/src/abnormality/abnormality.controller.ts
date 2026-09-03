import { Controller, Get, Post, Patch, Param, Body, Request, UseGuards } from '@nestjs/common';
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
}
