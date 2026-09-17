import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Post,
  Put,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { JwtAuthGuard } from './auth/jwt-auth.guard.js';
import { Roles } from './auth/roles.decorator.js';
import { RolesGuard } from './auth/roles.guard.js';
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
    @Headers('authorization') authorization: string | undefined,
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

  @Post('catalogo')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('editores', 'administradores')
  async crearJuego(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
    @Res() res: Response,
  ) {
    const resultado = await this.proxyService.forward(
      this.bffUrl,
      '/v1/catalogo',
      'POST',
      body,
      authorization,
    );

    return res.status(resultado.status).send(resultado.data);
  }

  @Put('catalogo/:juegoId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('editores', 'administradores')
  async actualizarJuego(
    @Param('juegoId') juegoId: string,
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
    @Res() res: Response,
  ) {
    const resultado = await this.proxyService.forward(
      this.bffUrl,
      `/v1/catalogo/${juegoId}`,
      'PUT',
      body,
      authorization,
    );

    return res.status(resultado.status).send(resultado.data);
  }

  @Post('compras')
  @UseGuards(JwtAuthGuard, ScopesGuard)
  @Scopes('vidalstore/biblioteca.leer')
  async crearCompra(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
    @Res() res: Response,
  ) {
    const resultado = await this.proxyService.forward(
      this.bffUrl,
      '/v1/compras',
      'POST',
      body,
      authorization,
    );

    return res.status(resultado.status).send(resultado.data);
  }

  @Get('biblioteca')
  @UseGuards(JwtAuthGuard, ScopesGuard)
  @Scopes('vidalstore/biblioteca.leer')
  async obtenerBiblioteca(
    @Headers('authorization') authorization: string | undefined,
    @Res() res: Response,
  ) {
    const resultado = await this.proxyService.forward(
      this.bffUrl,
      '/v1/biblioteca',
      'GET',
      undefined,
      authorization,
    );

    return res.status(resultado.status).send(resultado.data);
  }

  @Get('licencias')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('administradores')
  async obtenerLicencias(
    @Headers('authorization') authorization: string | undefined,
    @Res() res: Response,
  ) {
    const resultado = await this.proxyService.forward(
      this.bffUrl,
      '/v1/licencias',
      'GET',
      undefined,
      authorization,
    );

    return res.status(resultado.status).send(resultado.data);
  }

  @Delete('licencias/:licenciaId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('administradores')
  async revocarLicencia(
    @Param('licenciaId') licenciaId: string,
    @Headers('authorization') authorization: string | undefined,
    @Res() res: Response,
  ) {
    const resultado = await this.proxyService.forward(
      this.bffUrl,
      `/v1/licencias/${licenciaId}`,
      'DELETE',
      undefined,
      authorization,
    );

    return res.status(resultado.status).send(resultado.data);
  }
}
