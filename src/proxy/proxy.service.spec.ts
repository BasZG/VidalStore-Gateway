import { HttpException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProxyService } from './proxy.service.js';

describe('ProxyService', () => {
  let service: ProxyService;
  let requestMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    requestMock = vi.fn();

    const httpService = {
      request: requestMock,
    } as unknown as HttpService;

    service = new ProxyService(httpService);
  });

  it('debe conservar una respuesta 200', async () => {
    requestMock.mockReturnValue(
      of({
        status: 200,
        data: [],
      }),
    );

    const resultado = await service.forward(
      'http://localhost:3001',
      '/v1/catalogo',
      'GET',
      undefined,
      'Bearer token',
    );

    expect(resultado).toEqual({
      status: 200,
      data: [],
    });
  });

  it('debe conservar una respuesta 201 y reenviar body y Authorization', async () => {
    const body = {
      titulo: 'Juego prueba',
    };

    requestMock.mockReturnValue(
      of({
        status: 201,
        data: {
          id: 'juego-1',
          ...body,
        },
      }),
    );

    const resultado = await service.forward(
      'http://localhost:3001',
      '/v1/catalogo',
      'POST',
      body,
      'Bearer token',
    );

    expect(requestMock).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'POST',
        url: 'http://localhost:3001/v1/catalogo',
        data: body,
        headers: {
          Authorization: 'Bearer token',
          'Content-Type': 'application/json',
        },
      }),
    );

    expect(resultado.status).toBe(201);
  });

  it.each([400, 401, 403, 404])(
    'debe conservar error HTTP %i recibido desde el BFF',
    async (codigo) => {
      const respuestaError = {
        message: `Error ${codigo}`,
      };

      requestMock.mockReturnValue(
        throwError(() => ({
          response: {
            status: codigo,
            data: respuestaError,
          },
        })),
      );

      try {
        await service.forward(
          'http://localhost:3001',
          '/v1/prueba',
          'GET',
          undefined,
          'Bearer token',
        );

        throw new Error('La llamada debio fallar');
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException);

        const httpError = error as HttpException;

        expect(httpError.getStatus()).toBe(codigo);
        expect(httpError.getResponse()).toEqual(respuestaError);
      }
    },
  );

  it('debe devolver 502 si el BFF no esta disponible', async () => {
    requestMock.mockReturnValue(
      throwError(() => new Error('ECONNREFUSED')),
    );

    try {
      await service.forward(
        'http://localhost:3001',
        '/v1/catalogo',
        'GET',
      );

      throw new Error('La llamada debio fallar');
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);

      const httpError = error as HttpException;

      expect(httpError.getStatus()).toBe(502);
    }
  });
});
