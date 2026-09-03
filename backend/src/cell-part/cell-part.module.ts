import { Module } from '@nestjs/common';
import { CellPartController } from './cell-part.controller';
import { CellPartService } from './cell-part.service';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [CellPartController],
  providers: [CellPartService, PrismaService],
  exports: [CellPartService],
})
export class CellPartModule {}
