import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.setGlobalPrefix('api');
  app.enableCors();

  // Serve the extracted CAD images from excel
  app.useStaticAssets(join(__dirname, '..', '..', 'xlsx_images'), {
    prefix: '/images/',
  });

  // Serve uploaded PDF / 3D files
  const uploadsDir = join(process.cwd(), 'uploads');
  if (!existsSync(uploadsDir)) {
    mkdirSync(uploadsDir, { recursive: true });
  }
  app.useStaticAssets(uploadsDir, {
    prefix: '/uploads/',
  });

  const port = process.env.PORT ?? 3002;
  await app.listen(port);
  console.log(`NestJS backend listening on port ${port}`);
}
bootstrap();
