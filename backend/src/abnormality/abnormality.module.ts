import { Module } from '@nestjs/common';
import { AbnormalityController } from './abnormality.controller';
import { AbnormalityService } from './abnormality.service';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [AbnormalityController],
  providers: [AbnormalityService, PrismaService],
  exports: [AbnormalityService],
})
export class AbnormalityModule {}
