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
import { DrawingParserService } from './drawing-parser.service';

@Controller('upload')
@UseGuards(JwtAuthGuard)
export class UploadController {
  constructor(
    private readonly storageService: StorageService,
    private readonly drawingParserService: DrawingParserService,
  ) {}

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

  @Post('parse-drawing')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      fileFilter: (_req, file, cb) => {
        const ext = extname(file.originalname).toLowerCase();
        if (ext !== '.pdf') {
          return cb(new BadRequestException('Hanya file PDF drawing yang dapat dianalisis'), false);
        }
        cb(null, true);
      },
      limits: { fileSize: 50 * 1024 * 1024 },
    }),
  )
  async parseDrawing(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Tidak ada file PDF drawing yang diunggah');
    }

    // 1. Save the file to storage so it is immediately available
    let fileUrl: string;
    try {
      fileUrl = await this.storageService.saveFile(file);
    } catch (saveErr) {
      console.warn('Storage saving failed, using local upload path:', saveErr);
      fileUrl = `/uploads/${file.originalname.replace(/\s+/g, '_')}`;
    }

    // 2. Parse drawing (Page 1 E-Tiket + BOM, and Pages 2..N)
    let parsed: any;
    try {
      parsed = await this.drawingParserService.parseDrawingPdf(file.buffer);
    } catch (parseErr) {
      console.warn('Drawing parsing error, returning fallback empty metadata:', parseErr);
      parsed = {
        jig: { partName: '', partNumber: '', title: '', model: '', qty: '1 Set' },
        cellParts: [],
        totalPages: 1,
      };
    }

    return {
      url: fileUrl,
      filename: file.originalname.replace(/\s+/g, '_'),
      originalname: file.originalname,
      size: file.size,
      parsed,
    };
  }
}
