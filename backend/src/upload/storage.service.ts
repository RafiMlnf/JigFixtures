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

  async saveBuffer(buffer: Buffer, filename: string, mimetype: string = 'application/pdf'): Promise<string> {
    const sanitizedFilename = filename.replace(/\s+/g, '_');

    if (this.useMinio && this.minioClient) {
      try {
        const putPromise = this.minioClient.putObject(
          this.bucketName,
          sanitizedFilename,
          buffer,
          buffer.length,
          { 'Content-Type': mimetype }
        );
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('MinIO connection timed out')), 2500)
        );
        await Promise.race([putPromise, timeoutPromise]);

        const protocol = process.env.MINIO_USE_SSL === 'true' ? 'https' : 'http';
        const host = process.env.MINIO_ENDPOINT || 'localhost';
        const port = process.env.MINIO_PORT || '9000';
        return `${protocol}://${host}:${port}/${this.bucketName}/${sanitizedFilename}`;
      } catch (err) {
        console.warn('MinIO upload unreachable/error, falling back to local disk storage:', (err as any)?.message || err);
        // Fallback to local storage so upload does not fail!
      }
    }

    const uploadsDir = join(process.cwd(), 'uploads');
    if (!existsSync(uploadsDir)) {
      mkdirSync(uploadsDir, { recursive: true });
    }
    const filePath = join(uploadsDir, sanitizedFilename);
    writeFileSync(filePath, buffer);
    return `/uploads/${sanitizedFilename}`;
  }

  async getFileBuffer(pathOrUrl: string): Promise<Buffer | null> {
    if (!pathOrUrl) return null;

    // 1. Cek jika MinIO
    if (this.useMinio && this.minioClient) {
      try {
        let objectName = pathOrUrl;
        if (objectName.includes(`/${this.bucketName}/`)) {
          objectName = objectName.split(`/${this.bucketName}/`)[1];
        } else if (objectName.startsWith('/uploads/')) {
          objectName = objectName.replace('/uploads/', '');
        }
        objectName = decodeURIComponent(objectName);

        const dataStream = await this.minioClient.getObject(this.bucketName, objectName);
        return new Promise((resolve, reject) => {
          const chunks: Buffer[] = [];
          dataStream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
          dataStream.on('end', () => resolve(Buffer.concat(chunks)));
          dataStream.on('error', reject);
        });
      } catch (e) {
        // Fallback jika belum ada di MinIO
      }
    }

    // 2. Cek jika URL HTTP
    if (pathOrUrl.startsWith('http')) {
      try {
        const resp = await fetch(pathOrUrl);
        if (resp.ok) {
          const arr = await resp.arrayBuffer();
          return Buffer.from(arr);
        }
      } catch (e) {}
    }

    // 3. Cek local uploads folder
    const rawPath = pathOrUrl.startsWith('/uploads/') ? pathOrUrl.replace('/uploads/', '') : pathOrUrl;
    const localFilePath = join(process.cwd(), 'uploads', rawPath);
    if (existsSync(localFilePath)) {
      const fs = await import('fs');
      return fs.readFileSync(localFilePath);
    }

    const altPath = join(process.cwd(), '..', 'frontend', 'assets', 'pdf', rawPath);
    if (existsSync(altPath)) {
      const fs = await import('fs');
      return fs.readFileSync(altPath);
    }

    return null;
  }

  async saveFile(file: Express.Multer.File): Promise<string> {
    return this.saveBuffer(file.buffer, file.originalname, file.mimetype);
  }
}

