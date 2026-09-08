import { Module } from '@nestjs/common';
import { DesignController } from './design.controller';
import { DesignService } from './design.service';
import { PrismaService } from '../prisma.service';

import { UploadModule } from '../upload/upload.module';

@Module({
  imports: [UploadModule],
  controllers: [DesignController],
  providers: [DesignService, PrismaService],
  exports: [DesignService],
})
export class DesignModule {}
