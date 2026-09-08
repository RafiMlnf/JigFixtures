import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { UploadController } from './upload.controller';
import { StorageService } from './storage.service';

import { DrawingParserService } from './drawing-parser.service';
import { DrawingStamperService } from './drawing-stamper.service';

@Module({
  imports: [MulterModule.register({})],
  controllers: [UploadController],
  providers: [StorageService, DrawingParserService, DrawingStamperService],
  exports: [StorageService, DrawingParserService, DrawingStamperService],
})
export class UploadModule {}

