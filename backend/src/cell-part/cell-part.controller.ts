import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { CellPartService } from './cell-part.service';
import { CreateCellPartDto } from './dto/create-cell-part.dto';
import { UpdateCellPartDto } from './dto/update-cell-part.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('cell-part')
@UseGuards(JwtAuthGuard)
export class CellPartController {
  constructor(private readonly cellPartService: CellPartService) {}

  /** List CellParts for a parent Design/Jig */
  @Get('by-design/:designId')
  findByDesign(@Param('designId') designId: string) {
    return this.cellPartService.findByDesign(designId);
  }

  /** Get all CellParts approaching or past due date (reminders) */
  @Get('reminders')
  getReminders() {
    return this.cellPartService.getReminders();
  }

  /** Create a new CellPart */
  @Post()
  create(@Body() dto: CreateCellPartDto) {
    return this.cellPartService.create(dto);
  }

  /** Update an existing CellPart */
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCellPartDto) {
    return this.cellPartService.update(id, dto);
  }

  /** Renew a CellPart's lifetime */
  @Patch(':id/renew')
  renew(
    @Param('id') id: string,
    @Body() body?: { resetDays?: boolean; resetUsage?: boolean },
  ) {
    return this.cellPartService.renew(id, body);
  }

  /** Log or set usage for a CellPart */
  @Patch(':id/usage')
  logUsage(
    @Param('id') id: string,
    @Body() body: { amount: number; mode?: 'ADD' | 'SET' },
  ) {
    return this.cellPartService.logUsage(id, body.amount, body.mode || 'ADD');
  }

  /** Delete a CellPart */
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.cellPartService.remove(id);
  }
}
