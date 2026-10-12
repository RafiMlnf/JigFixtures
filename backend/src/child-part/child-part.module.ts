import { Module } from '@nestjs/common';
import { ChildPartController } from './child-part.controller';
import { ChildPartService } from './child-part.service';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [ChildPartController],
  providers: [ChildPartService, PrismaService],
  exports: [ChildPartService],
})
export class ChildPartModule {}
