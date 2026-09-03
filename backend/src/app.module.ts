import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaService } from './prisma.service';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { InventoryModule } from './inventory/inventory.module';
import { NotificationModule } from './notification/notification.module';
import { ApprovalModule } from './approval/approval.module';
import { DesignModule } from './design/design.module';
import { AbnormalityModule } from './abnormality/abnormality.module';
import { UploadModule } from './upload/upload.module';

@Module({
  imports: [AuthModule, UserModule, InventoryModule, NotificationModule, ApprovalModule, DesignModule, AbnormalityModule, UploadModule],
  controllers: [AppController],
  providers: [AppService, PrismaService],
})
export class AppModule {}
