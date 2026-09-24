import { Module } from '@nestjs/common';
import { TpmController } from './tpm.controller';
import { TpmService } from './tpm.service';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [TpmController],
  providers: [TpmService, PrismaService],
  exports: [TpmService],
})
export class TpmModule {}
