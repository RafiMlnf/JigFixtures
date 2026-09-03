import { Injectable, OnModuleInit, InternalServerErrorException } from '@nestjs/common';
import * as Minio from 'minio';
import { join } from 'path';
import { existsSync, mkdirSync, writeFileSync } from 'fs';

@Injectable()
export class StorageService implements OnModuleInit {
  private minioClient: Minio.Client | null = null;
  private useMinio = false;
  private bucketName = 'jigfixtures';

  onModuleInit() {
    this.useMinio = process.env.STORAGE_TYPE === 'minio';
    if (this.useMinio) {
      const portVal = process.env.MINIO_PORT ? parseInt(process.env.MINIO_PORT, 10) : 9000;
      const useSSL = process.env.MINIO_USE_SSL === 'true';
      this.bucketName = process.env.MINIO_BUCKET_NAME || 'jigfixtures';

      this.minioClient = new Minio.Client({
        endPoint: process.env.MINIO_ENDPOINT || 'localhost',
        port: portVal,
        useSSL: useSSL,
        accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
        secretKey: process.env.MINIO_SECRET_KEY || 'minioadminpassword',
      });

      // Ensure bucket exists
      this.minioClient.bucketExists(this.bucketName).then((exists) => {
        if (!exists) {
          this.minioClient!.makeBucket(this.bucketName, 'us-east-1').then(() => {
            console.log(`MinIO bucket "${this.bucketName}" created successfully.`);
            // Set bucket policy to public readable so frontend can access files directly
            const policy = {
              Version: '2012-10-17',
              Statement: [
                {
                  Effect: 'Allow',
                  Principal: { AWS: ['*'] },
                  Action: ['s3:GetObject'],
                  Resource: [`arn:aws:s3:::${this.bucketName}/*`],
                },
              ],
            };
            this.minioClient!.setBucketPolicy(this.bucketName, JSON.stringify(policy));
          });
        }
      }).catch((err) => {
        console.error('Failed to initialize MinIO bucket:', err);
      });
    }
  }

  async saveFile(file: Express.Multer.File): Promise<string> {
    const sanitizedFilename = file.originalname.replace(/\s+/g, '_');

    if (this.useMinio && this.minioClient) {
      try {
        await this.minioClient.putObject(
          this.bucketName,
          sanitizedFilename,
          file.buffer,
          file.size,
          { 'Content-Type': file.mimetype }
        );
        const protocol = process.env.MINIO_USE_SSL === 'true' ? 'https' : 'http';
        const host = process.env.MINIO_ENDPOINT || 'localhost';
        const port = process.env.MINIO_PORT || '9000';
        return `${protocol}://${host}:${port}/${this.bucketName}/${sanitizedFilename}`;
      } catch (err) {
        console.error('MinIO upload error:', err);
        throw new InternalServerErrorException('Gagal upload ke object storage');
      }
    } else {
      // Local storage fallback
      const uploadsDir = join(process.cwd(), 'uploads');
      if (!existsSync(uploadsDir)) {
        mkdirSync(uploadsDir, { recursive: true });
      }
      const filePath = join(uploadsDir, sanitizedFilename);
      writeFileSync(filePath, file.buffer);
      return `/uploads/${sanitizedFilename}`;
    }
  }
}
