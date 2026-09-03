import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma.service';
import * as bcrypt from 'bcrypt';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async login(dto: LoginDto) {
    // Find user by NPK (username) or Email
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { npk: dto.email },
          { email: dto.email }
        ]
      },
      include: { role: true },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid NPK/Email or password');
    }

    const isPasswordValid = bcrypt.compareSync(dto.password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid NPK/Email or password');
    }

    const payload = { email: user.email, sub: user.id, role: user.role.name };
    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role.name,
      },
    };
  }
}
