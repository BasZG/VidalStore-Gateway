import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Response } from 'express';
import { AppController } from './app.controller.js';
import { JwtAuthGuard } from './auth/jwt-auth.guard.js';
import { ScopesGuard } from './auth/scopes.guard.js';
import { ProxyService } from './proxy/proxy.service.js';

describe('AppController', () => {
  let controller: AppController;
  let proxyService: {
    forward: ReturnType<typeof vi.fn>;
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

    const send = vi.fn();

    const status = vi.fn().mockReturnValue({
      send,
    });

    const response = {
      status,
    } as unknown as Response;

    await controller.obtenerCatalogo('Bearer token-prueba', response);

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
});
