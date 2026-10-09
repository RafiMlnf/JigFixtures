import { Controller, Get, Post, Patch, Delete, Param, Body, Request, Res, UseGuards } from '@nestjs/common';
import { DesignService } from './design.service';
import { UpdateDesignDto } from './dto/update-design.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('design')
@UseGuards(JwtAuthGuard)
export class DesignController {
  constructor(private readonly designService: DesignService) {}

  /** List all items for dropdown selection */
  @Get('items')
  getAllItems() {
    return this.designService.getAllItems();
  }

  /** List all vendors for dropdown selection */
  @Get('vendors')
  getVendors() {
    return this.designService.getVendors();
  }

  /** Get complete master list with relations for View Data */
  @Get('master-list')
  getMasterList() {
    return this.designService.getMasterList();
  }

  /** Get lines and processes metadata */
  @Get('lines-processes')
  getLinesAndProcesses() {
    return this.designService.getLinesAndProcesses();
  }

  /** Create a new master design item directly */
  @Post()
  createDesign(
    @Body() dto: any,
    @Request() req: any,
  ) {
    return this.designService.createDesign(dto, req.user.id);
  }

  /** Update design revision for an item — also auto-creates Approval */
  @Patch(':id')
  updateDesign(
    @Param('id') id: string,
    @Body() dto: UpdateDesignDto,
    @Request() req: any,
  ) {
    return this.designService.updateDesignRevision(id, dto, req.user.id);
  }

  /** Log or set usage counter for a Design (Jig) item */
  @Patch(':id/usage')
  logUsage(
    @Param('id') id: string,
    @Body() body: { amount: number; mode?: 'ADD' | 'SET' },
  ) {
    return this.designService.logUsage(id, body.amount, body.mode || 'ADD');
  }

  /** Renew a Design item's lifetime */
  @Patch(':id/renew')
  renew(
    @Param('id') id: string,
    @Body() body?: { resetDays?: boolean; resetUsage?: boolean },
  ) {
    return this.designService.renewLifetime(id, body);
  }

  /** Get revision history for a specific item */
  @Get(':id/history')
  getHistory(@Param('id') id: string) {
    return this.designService.getDesignHistory(id);
  }

  /** Download single page (Hal 1 for Induk, Hal N for CellPart) as standalone PDF */
  @Get(':id/pdf-page/:page')
  async downloadPdfPage(
    @Param('id') id: string,
    @Param('page') page: string,
    @Res() res: any,
  ) {
    const pageNum = parseInt(page, 10) || 1;
    const { buffer, filename } = await this.designService.getSinglePagePdf(id, pageNum);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  /** Download full multi-page PDF with official legal stamp on every page */
  @Get(':id/pdf-full')
  async downloadPdfFull(
    @Param('id') id: string,
    @Res() res: any,
  ) {
    const { buffer, filename } = await this.designService.getFullPdf(id);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  /** Merge multiple drawing PDFs into a single combined PDF file */
  @Post('pdf-merge')
  async downloadPdfMerge(
    @Body() body: { targets: Array<{ designId: string; pageNumber?: number }> },
    @Res() res: any,
  ) {
    const { buffer, filename } = await this.designService.getMergedPdf(body.targets || []);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  /** Delete a design item and all its related records */
  @Delete(':id')
  deleteDesign(@Param('id') id: string) {
    return this.designService.deleteDesign(id);
  }
}
