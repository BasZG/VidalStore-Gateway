import { HttpService } from '@nestjs/axios';
import { HttpException } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
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

  it('debe conservar 200 y usar timeout explicito', async () => {
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

    expect(requestMock).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'GET',
        url: 'http://localhost:3001/v1/catalogo',
        timeout: 3000,
        validateStatus: expect.any(Function),
        headers: {
          Authorization: 'Bearer token',
        },
      }),
    );

    expect(resultado).toEqual({
      status: 200,
      data: [],
    });
  });

  it('debe conservar 201 y reenviar body y Authorization', async () => {
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
        timeout: 3000,
        headers: {
          Authorization: 'Bearer token',
          'Content-Type': 'application/json',
        },
      }),
    );

    expect(resultado.status).toBe(201);
  });

  it.each([
    {
      nombre: 'JSON',
      codigo: 422,
      data: {
        statusCode: 422,
        message: 'Entidad invalida',
      },
    },
    {
      nombre: 'texto',
      codigo: 418,
      data: 'Error upstream en texto',
    },
    {
      nombre: 'vacio',
      codigo: 404,
      data: '',
    },
  ])(
    'debe conservar error HTTP con cuerpo $nombre',
    async ({ codigo, data }) => {
      requestMock.mockReturnValue(
        of({
          status: codigo,
          data,
        }),
      );

      const resultado = await service.forward(
        'http://localhost:3001',
        '/v1/prueba',
        'GET',
      );

      expect(resultado).toEqual({
        status: codigo,
        data,
      });
    },
  );

  it('conserva una respuesta HTTP si Axios la entrega como error', async () => {
    requestMock.mockReturnValue(
      throwError(() => ({
        response: {
          status: 409,
          data: 'Conflicto',
        },
      })),
    );

    await expect(
      service.forward(
        'http://localhost:3001',
        '/v1/prueba',
        'GET',
      ),
    ).resolves.toEqual({
      status: 409,
      data: 'Conflicto',
    });
  });

  it('debe devolver 504 cuando ocurre timeout', async () => {
    requestMock.mockReturnValue(
      throwError(() => ({
        code: 'ECONNABORTED',
      })),
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

      expect(httpError.getStatus()).toBe(504);
      expect(httpError.getResponse()).toEqual({
        statusCode: 504,
        message: 'Gateway Timeout',
      });
    }
  });

  it('debe devolver 502 si el BFF no responde', async () => {
    requestMock.mockReturnValue(
      throwError(() => ({
        code: 'ECONNREFUSED',
      })),
    );

    try {
      await service.forward(
        'http://localhost:3001',
        '/v1/catalogo',
        'GET',
        undefined,
        'Bearer token-no-debe-registrarse',
      );

      throw new Error('La llamada debio fallar');
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);

      const httpError = error as HttpException;

      expect(httpError.getStatus()).toBe(502);
      expect(httpError.getResponse()).toEqual({
        statusCode: 502,
        message: 'Bad Gateway',
      });
    }
  });
});
