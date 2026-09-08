import { Module } from '@nestjs/common';
import { ApprovalService } from './approval.service';
import { ApprovalController } from './approval.controller';
import { PrismaService } from '../prisma.service';

import { UploadModule } from '../upload/upload.module';

@Module({
  imports: [UploadModule],
  controllers: [ApprovalController],
  providers: [ApprovalService, PrismaService],
})
export class ApprovalModule {}
