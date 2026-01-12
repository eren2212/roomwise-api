import {
  Body,
  Controller,
  Post,
  UseGuards,
  Request,
  Get,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { SupabaseGuard } from './supabase.guard';
import type { RequestWithUser } from './supabase.guard';
import type { Request as ExpressRequest } from 'express'; // Express tipini aldık

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  kayitOl(@Body() body: LoginDto) {
    return this.authService.kayitOl(body);
  }

  @Post('login')
  girisYap(@Body() body: LoginDto) {
    return this.authService.girisYap(body);
  }

  @UseGuards(SupabaseGuard)
  @Get('profile')
  getProfile(@Request() req: RequestWithUser) {
    return req.user;
  }

  @UseGuards(SupabaseGuard)
  @Post('logout')
  // Request tipini 'ExpressRequest' yaptık
  async logout(@Request() req: ExpressRequest) {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      throw new UnauthorizedException('Token bulunamadı');
    }

    // Artık split işlemine kızmaz çünkü string olduğunu biliyor
    const token = authHeader.split(' ')[1];

    return this.authService.cikisYap(token);
  }
}
