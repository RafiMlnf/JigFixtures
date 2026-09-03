// Trigger watch reload for IGS support v2
import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { extname } from 'path';
import { StorageService } from './storage.service';

@Controller('upload')
@UseGuards(JwtAuthGuard)
export class UploadController {
  constructor(private readonly storageService: StorageService) {}

  @Post('pdf')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      fileFilter: (_req, file, cb) => {
        const allowed = ['.pdf', '.step', '.stp', '.igs', '.iges'];
        const ext = extname(file.originalname).toLowerCase();
        if (!allowed.includes(ext)) {
          return cb(new BadRequestException('Hanya file PDF, STEP, STP, atau IGS/IGES yang diizinkan'), false);
        }
        cb(null, true);
      },
      limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB max
    }),
  )
  async uploadFile(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Tidak ada file yang diunggah');
    }
    
    // Save file using StorageService (handles Local/MinIO)
    const fileUrl = await this.storageService.saveFile(file);

    return {
      url: fileUrl,
      filename: file.originalname.replace(/\s+/g, '_'),
      originalname: file.originalname,
      size: file.size,
    };
  }
}
