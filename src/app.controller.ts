import { Controller, Get, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from './auth/jwt-auth.guard.js';

@Controller('v1')
export class AppController {
  @UseGuards(JwtAuthGuard)
  @Get('prueba')
  getPrueba(@Req() req: any) {
    return { mensaje: 'Token valido', usuario: req.user };
  }
}