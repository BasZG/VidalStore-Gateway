import { Controller, Get, Headers, Res, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { JwtAuthGuard } from './auth/jwt-auth.guard.js';
import { Scopes } from './auth/scopes.decorator.js';
import { ScopesGuard } from './auth/scopes.guard.js';
import { ProxyService } from './proxy/proxy.service.js';

@Controller('v1')
export class AppController {
  private readonly bffUrl: string;

  constructor(
    private readonly proxyService: ProxyService,
    private readonly configService: ConfigService,
  ) {
    this.bffUrl =
      this.configService.get<string>('BFF_URL') ?? 'http://localhost:3001';
  }

  @Get('catalogo')
  @UseGuards(JwtAuthGuard, ScopesGuard)
  @Scopes('vidalstore/catalogo.leer')
  async obtenerCatalogo(
    @Headers('authorization')
    authorization: string | undefined,
    @Res() res: Response,
  ) {
    const resultado = await this.proxyService.forward(
      this.bffUrl,
      '/v1/catalogo',
      'GET',
      undefined,
      authorization,
    );

    return res.status(resultado.status).send(resultado.data);
  }
}
