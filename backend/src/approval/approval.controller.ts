import { Controller, Get, Post, Patch, Param, Body, UseGuards, Request } from '@nestjs/common';
import { ApprovalService } from './approval.service';
import { SubmitApprovalDto } from './dto/submit-approval.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../auth/user-role.enum';

@Controller('approvals')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ApprovalController {
  constructor(private readonly approvalService: ApprovalService) {}

  @Roles(UserRole.PE_JIG_FIXTURE)
  @Post()
  submit(@Body() dto: SubmitApprovalDto, @Request() req: any) {
    return this.approvalService.submit(dto, req.user.id);
  }

  @Get()
  findAll(@Request() req: any) {
    return this.approvalService.findAll(req.user.id, req.user.role);
  }

  @Roles(UserRole.PE_JIG_FIXTURE)
  @Get('my-submissions')
  findMySubmissions(@Request() req: any) {
    return this.approvalService.findMySubmissions(req.user.id);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.approvalService.findOne(id);
  }

  @Roles(UserRole.PE_SECTION_HEAD, UserRole.PE_DEPT_HEAD)
  @Patch(':id/approve')
  approve(
    @Param('id') id: string,
    @Body() dto: { comment?: string },
    @Request() req: any,
  ) {
    return this.approvalService.process(
      id,
      { action: 'APPROVE', comment: dto.comment },
      req.user.id,
      req.user.role,
    );
  }

  @Roles(UserRole.PE_SECTION_HEAD, UserRole.PE_DEPT_HEAD)
  @Patch(':id/reject')
  reject(
    @Param('id') id: string,
    @Body() dto: { comment: string },
    @Request() req: any,
  ) {
    return this.approvalService.process(
      id,
      { action: 'REJECT', comment: dto.comment },
      req.user.id,
      req.user.role,
    );
  }
}
