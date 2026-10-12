import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ChildPartService } from './child-part.service';
import { CreateChildPartDto } from './dto/create-child-part.dto';
import { UpdateChildPartDto } from './dto/update-child-part.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller(['child-part', 'cell-part'])
@UseGuards(JwtAuthGuard)
export class ChildPartController {
  constructor(private readonly childPartService: ChildPartService) {}

  /** List ChildParts for a parent Design/Jig */
  @Get('by-design/:designId')
  findByDesign(@Param('designId') designId: string) {
    return this.childPartService.findByDesign(designId);
  }

  /** Get all ChildParts approaching or past due date (reminders) */
  @Get('reminders')
  getReminders() {
    return this.childPartService.getReminders();
  }

  /** Get part replacement historical log */
  @Get('replacement-history')
  getReplacementHistory(
    @Query('designId') designId?: string,
    @Query('childPartId') childPartId?: string,
    @Query('search') search?: string,
  ) {
    return this.childPartService.getReplacementHistory({ designId, childPartId, search });
  }

  /** Delete a replacement log entry */
  @Delete('replacement-history/:id')
  deleteReplacementLog(@Param('id') id: string) {
    return this.childPartService.deleteReplacementLog(id);
  }

  /** Create a new ChildPart */
  @Post()
  create(@Body() dto: CreateChildPartDto) {
    return this.childPartService.create(dto);
  }

  /** Record a part replacement */
  @Post(':id/replace')
  recordReplacement(
    @Param('id') id: string,
    @Body()
    body: {
      replacedAt?: string;
      replacedBy: string;
      reason: string;
      notes?: string;
      resetUsage?: boolean;
    },
  ) {
    return this.childPartService.recordReplacement(id, body);
  }

  /** Update an existing ChildPart */
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateChildPartDto) {
    return this.childPartService.update(id, dto);
  }

  /** Renew a ChildPart's lifetime */
  @Patch(':id/renew')
  renew(
    @Param('id') id: string,
    @Body() body?: { resetDays?: boolean; resetUsage?: boolean },
  ) {
    return this.childPartService.renew(id, body);
  }

  /** Log or set usage for a ChildPart */
  @Patch(':id/usage')
  logUsage(
    @Param('id') id: string,
    @Body() body: { amount: number; mode?: 'ADD' | 'SET' },
  ) {
    return this.childPartService.logUsage(id, body.amount, body.mode || 'ADD');
  }

  /** Delete a ChildPart */
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.childPartService.remove(id);
  }
}
