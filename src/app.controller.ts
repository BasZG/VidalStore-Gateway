import { Controller, Get, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from './auth/jwt-auth.guard.js';
import { RolesGuard } from './auth/roles.guard.js';
import { Roles } from './auth/roles.decorator.js';

@Controller('v1')
export class AppController {
  @UseGuards(JwtAuthGuard)
  @Get('prueba')
  getPrueba(@Req() req: any) {
    return { mensaje: 'Token valido', usuario: req.user };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('administradores')
  @Get('admin')
  getAdmin(@Req() req: any) {
    return { mensaje: 'Acceso autorizado como administrador', usuario: req.user };
  }
}