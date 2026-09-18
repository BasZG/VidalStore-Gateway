import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Response } from 'express';
import { AppController } from './app.controller.js';
import { JwtAuthGuard } from './auth/jwt-auth.guard.js';
import { RolesGuard } from './auth/roles.guard.js';
import { ScopesGuard } from './auth/scopes.guard.js';
import { ProxyService } from './proxy/proxy.service.js';

describe('AppController', () => {
  let controller: AppController;
  let proxyService: {
    forward: ReturnType<typeof vi.fn>;
  };

  const crearResponse = () => {
    const send = vi.fn();
    const status = vi.fn().mockReturnValue({ send });

    const response = {
      status,
    } as unknown as Response;

    return {
      response,
      status,
      send,
    };
  };

  beforeEach(async () => {
    proxyService = {
      forward: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        {
          provide: ProxyService,
          useValue: proxyService,
        },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => {
              if (key === 'BFF_URL') {
                return 'http://localhost:3001';
              }

              return undefined;
            },
          },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: () => true,
      })
      .overrideGuard(ScopesGuard)
      .useValue({
        canActivate: () => true,
      })
      .overrideGuard(RolesGuard)
      .useValue({
        canActivate: () => true,
      })
      .compile();

    controller = module.get<AppController>(AppController);
  });

  it('debe estar definido', () => {
    expect(controller).toBeDefined();
  });

  it('debe reenviar GET catalogo al BFF', async () => {
    proxyService.forward.mockResolvedValue({
      status: 200,
      data: [],
    });

    const { response, status, send } = crearResponse();

    await controller.obtenerCatalogo(
      'Bearer token-prueba',
      response,
    );

    expect(proxyService.forward).toHaveBeenCalledWith(
      'http://localhost:3001',
      '/v1/catalogo',
      'GET',
      undefined,
      'Bearer token-prueba',
    );

    expect(status).toHaveBeenCalledWith(200);
    expect(send).toHaveBeenCalledWith([]);
  });

  it('debe reenviar POST catalogo al BFF', async () => {
    const body = {
      titulo: 'Juego prueba',
      descripcion: 'Descripcion',
      imagen: 'imagen.jpg',
      precio: 10000,
    };

    const juego = {
      id: 'juego-1',
      ...body,
    };

    proxyService.forward.mockResolvedValue({
      status: 201,
      data: juego,
    });

    const { response, status, send } = crearResponse();

    await controller.crearJuego(
      'Bearer token-editor',
      body,
      response,
    );

    expect(proxyService.forward).toHaveBeenCalledWith(
      'http://localhost:3001',
      '/v1/catalogo',
      'POST',
      body,
      'Bearer token-editor',
    );

    expect(status).toHaveBeenCalledWith(201);
    expect(send).toHaveBeenCalledWith(juego);
  });

  it('debe reenviar PUT catalogo al BFF conservando juegoId', async () => {
    const body = {
      precio: 15000,
    };

    proxyService.forward.mockResolvedValue({
      status: 200,
      data: {
        id: 'juego-123',
        precio: 15000,
      },
    });

    const { response, status } = crearResponse();

    await controller.actualizarJuego(
      'juego-123',
      'Bearer token-editor',
      body,
      response,
    );

    expect(proxyService.forward).toHaveBeenCalledWith(
      'http://localhost:3001',
      '/v1/catalogo/juego-123',
      'PUT',
      body,
      'Bearer token-editor',
    );

    expect(status).toHaveBeenCalledWith(200);
  });

  it('debe reenviar POST compras al BFF', async () => {
    const body = {
      juegoId: 'juego-123',
    };

    proxyService.forward.mockResolvedValue({
      status: 201,
      data: {
        id: 'licencia-1',
        juegoId: 'juego-123',
      },
    });

    const { response, status } = crearResponse();

    await controller.crearCompra(
      'Bearer token-jugador',
      body,
      response,
    );

    expect(proxyService.forward).toHaveBeenCalledWith(
      'http://localhost:3001',
      '/v1/compras',
      'POST',
      body,
      'Bearer token-jugador',
    );

    expect(status).toHaveBeenCalledWith(201);
  });

  it('debe reenviar GET biblioteca al BFF', async () => {
    proxyService.forward.mockResolvedValue({
      status: 200,
      data: [],
    });

    const { response, status } = crearResponse();

    await controller.obtenerBiblioteca(
      'Bearer token-jugador',
      response,
    );

    expect(proxyService.forward).toHaveBeenCalledWith(
      'http://localhost:3001',
      '/v1/biblioteca',
      'GET',
      undefined,
      'Bearer token-jugador',
    );

    expect(status).toHaveBeenCalledWith(200);
  });

  it('debe reenviar GET licencias al BFF', async () => {
    proxyService.forward.mockResolvedValue({
      status: 200,
      data: [],
    });

    const { response, status } = crearResponse();

    await controller.obtenerLicencias(
      'Bearer token-admin',
      response,
    );

    expect(proxyService.forward).toHaveBeenCalledWith(
      'http://localhost:3001',
      '/v1/licencias',
      'GET',
      undefined,
      'Bearer token-admin',
    );

    expect(status).toHaveBeenCalledWith(200);
  });

  it('debe reenviar DELETE licencia al BFF conservando licenciaId', async () => {
    proxyService.forward.mockResolvedValue({
      status: 200,
      data: {
        mensaje: 'Licencia revocada',
      },
    });

    const { response, status } = crearResponse();

    await controller.revocarLicencia(
      'licencia-123',
      'Bearer token-admin',
      response,
    );

    expect(proxyService.forward).toHaveBeenCalledWith(
      'http://localhost:3001',
      '/v1/licencias/licencia-123',
      'DELETE',
      undefined,
      'Bearer token-admin',
    );

    expect(status).toHaveBeenCalledWith(200);
  });
});
