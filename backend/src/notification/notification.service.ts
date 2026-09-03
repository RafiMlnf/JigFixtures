import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class NotificationService {
  constructor(private prisma: PrismaService) {}

  async findAllForUser(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId },
      include: {
        design: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
  }

  async markAsRead(id: string, userId: string) {
    const notification = await this.prisma.notification.findUnique({
      where: { id },
    });
    if (!notification) {
      throw new NotFoundException(`Notification with ID ${id} not found`);
    }
    if (notification.userId !== userId) {
      throw new NotFoundException(`Notification not found for this user`);
    }
    return this.prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });
  }
}
