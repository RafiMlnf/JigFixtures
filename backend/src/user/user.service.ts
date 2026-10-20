import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async getAllUsers() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        name: true,
        npk: true,
        email: true,
        roleId: true,
        role: {
          select: {
            id: true,
            name: true,
          },
        },
        createdAt: true,
        updatedAt: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });
  }

  async getAllRoles() {
    return this.prisma.role.findMany({
      include: {
        _count: {
          select: { users: true },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });
  }

  async createUser(data: {
    name: string;
    npk: string;
    email: string;
    password?: string;
    roleId: string;
  }) {
    const existingEmail = await this.prisma.user.findUnique({
      where: { email: data.email },
    });
    if (existingEmail) {
      throw new BadRequestException('Email sudah terdaftar.');
    }

    const existingNpk = await this.prisma.user.findUnique({
      where: { npk: data.npk },
    });
    if (existingNpk) {
      throw new BadRequestException('NPK sudah terdaftar.');
    }

    const rawPassword = data.password && data.password.trim() ? data.password : data.npk;
    const passwordHash = bcrypt.hashSync(rawPassword, 10);

    const user = await this.prisma.user.create({
      data: {
        name: data.name,
        npk: data.npk,
        email: data.email,
        password: passwordHash,
        roleId: data.roleId,
      },
      select: {
        id: true,
        name: true,
        npk: true,
        email: true,
        roleId: true,
        role: true,
        createdAt: true,
      },
    });

    return user;
  }

  async updateUser(
    id: string,
    data: {
      name?: string;
      npk?: string;
      email?: string;
      password?: string;
      roleId?: string;
    },
  ) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('User tidak ditemukan.');
    }

    if (data.email && data.email !== user.email) {
      const existingEmail = await this.prisma.user.findUnique({
        where: { email: data.email },
      });
      if (existingEmail) {
        throw new BadRequestException('Email sudah dipakai oleh user lain.');
      }
    }

    if (data.npk && data.npk !== user.npk) {
      const existingNpk = await this.prisma.user.findUnique({
        where: { npk: data.npk },
      });
      if (existingNpk) {
        throw new BadRequestException('NPK sudah dipakai oleh user lain.');
      }
    }

    const updatePayload: any = {};
    if (data.name) updatePayload.name = data.name;
    if (data.npk) updatePayload.npk = data.npk;
    if (data.email) updatePayload.email = data.email;
    if (data.roleId) updatePayload.roleId = data.roleId;
    if (data.password && data.password.trim()) {
      updatePayload.password = bcrypt.hashSync(data.password.trim(), 10);
    }

    return this.prisma.user.update({
      where: { id },
      data: updatePayload,
      select: {
        id: true,
        name: true,
        npk: true,
        email: true,
        roleId: true,
        role: true,
        updatedAt: true,
      },
    });
  }

  async deleteUser(id: string, currentUserId: string) {
    if (id === currentUserId) {
      throw new ForbiddenException('Tidak dapat menghapus akun Anda sendiri.');
    }

    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            submittedApprovals: true,
            sectionApprovals: true,
            deptApprovals: true,
            inventoryLogs: true,
            reportedAbnormalities: true,
            revisionHistories: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User tidak ditemukan.');
    }

    // Check if user has active foreign key records
    const totalRelations =
      user._count.submittedApprovals +
      user._count.sectionApprovals +
      user._count.deptApprovals +
      user._count.inventoryLogs +
      user._count.reportedAbnormalities +
      user._count.revisionHistories;

    if (totalRelations > 0) {
      throw new BadRequestException(
        `User ini memiliki ${totalRelations} data terkait (approval / revisi / log). Untuk menjaga integritas data, user tidak dapat dihapus permanen. Ubah role user menjadi TAMU jika ingin menonaktifkan akses.`,
      );
    }

    await this.prisma.user.delete({ where: { id } });
    return { success: true, message: 'User berhasil dihapus.' };
  }
}
