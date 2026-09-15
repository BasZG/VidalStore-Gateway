import { Controller, Get, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from './auth/jwt-auth.guard.js';

@Controller('v1')
export class AppController {
  
  @UseGuards(JwtAuthGuard)
  @Get('prueba')
  getPrueba(@Req() req: any) { // <-- Aquí está el arreglo mágico (: any)
    return { 
      mensaje: '¡Token válido!', 
      usuario: req.user 
    };
  }
}