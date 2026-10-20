import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UserService } from './user.service';

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @UseGuards(JwtAuthGuard)
  @Get('me')
  getMe(@Request() req: any) {
    const { password, ...user } = req.user;
    return user;
  }

  @UseGuards(JwtAuthGuard)
  @Get('roles')
  getRoles() {
    return this.userService.getAllRoles();
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  getAllUsers() {
    return this.userService.getAllUsers();
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  createUser(@Body() body: any) {
    return this.userService.createUser(body);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  updateUser(@Param('id') id: string, @Body() body: any) {
    return this.userService.updateUser(id, body);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  deleteUser(@Param('id') id: string, @Request() req: any) {
    return this.userService.deleteUser(id, req.user?.id);
  }
}
