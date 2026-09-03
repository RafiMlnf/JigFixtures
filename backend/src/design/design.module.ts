import { Module } from '@nestjs/common';
import { DesignController } from './design.controller';
import { DesignService } from './design.service';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [DesignController],
  providers: [DesignService, PrismaService],
  exports: [DesignService],
})
export class DesignModule {}
