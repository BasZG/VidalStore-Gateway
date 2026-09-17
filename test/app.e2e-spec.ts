import { type INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { createServer, type IncomingMessage, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from './../src/app.module.js';
import { JwtAuthGuard } from './../src/auth/jwt-auth.guard.js';
import { RolesGuard } from './../src/auth/roles.guard.js';
import { ScopesGuard } from './../src/auth/scopes.guard.js';

/*
 * Estos tests mantienen la comprobacion original:
 * todas las rutas del Gateway deben exigir autenticacion.
 */
describe('Gateway autenticacion (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /v1/catalogo sin token debe responder 401', async () => {
    await request(app.getHttpServer()).get('/v1/catalogo').expect(401);
  });

  it('POST /v1/catalogo sin token debe responder 401', async () => {
    await request(app.getHttpServer())
      .post('/v1/catalogo')
      .send({
        titulo: 'Juego prueba',
      })
      .expect(401);
  });

  it('PUT /v1/catalogo/:juegoId sin token debe responder 401', async () => {
    await request(app.getHttpServer())
      .put('/v1/catalogo/juego-1')
      .send({
        precio: 10000,
      })
      .expect(401);
  });

  it('POST /v1/compras sin token debe responder 401', async () => {
    await request(app.getHttpServer())
      .post('/v1/compras')
      .send({
        juegoId: 'juego-1',
      })
      .expect(401);
  });

  it('GET /v1/biblioteca sin token debe responder 401', async () => {
    await request(app.getHttpServer()).get('/v1/biblioteca').expect(401);
  });

  it('GET /v1/licencias sin token debe responder 401', async () => {
    await request(app.getHttpServer()).get('/v1/licencias').expect(401);
  });

  it('DELETE /v1/licencias/:licenciaId sin token debe responder 401', async () => {
    await request(app.getHttpServer())
      .delete('/v1/licencias/licencia-1')
      .expect(401);
  });
});

type Destino = {
  server: Server;
  url: string;
};

async function leerBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];

  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  if (chunks.length === 0) {
    return undefined;
  }

  const contenido = Buffer.concat(chunks).toString('utf8');

  if (!contenido) {
    return undefined;
  }

  try {
    return JSON.parse(contenido);
  } catch {
    return contenido;
  }
}

async function iniciarBffFalso(): Promise<Destino> {
  const server = createServer(async (req, res) => {
    const authorization = req.headers.authorization;

    /*
     * Simula una peticion que demora mas que
     * el timeout configurado en ProxyService.
     */
    if (authorization === 'Bearer timeout') {
      setTimeout(() => {
        if (!res.destroyed) {
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(
            JSON.stringify({
              message: 'respuesta tardia',
            }),
          );
        }
      }, 3500);

      return;
    }

    /*
     * Simula que el BFF corta la conexion
     * sin entregar una respuesta HTTP.
     */
    if (authorization === 'Bearer disconnect') {
      req.socket.destroy();
      return;
    }

    /*
     * Simula un error HTTP real del BFF.
     */
    if (authorization === 'Bearer error-bff') {
      res.statusCode = 422;
      res.setHeader('Content-Type', 'application/json');
      res.end(
        JSON.stringify({
          statusCode: 422,
          message: 'Error del BFF',
        }),
      );

      return;
    }

    const body = await leerBody(req);

    res.statusCode = req.method === 'POST' ? 201 : 200;

    res.setHeader('Content-Type', 'application/json');

    res.end(
      JSON.stringify({
        method: req.method,
        url: req.url,
        authorization: authorization ?? null,
        body: body ?? null,
      }),
    );
  });

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
  });

  const address = server.address() as AddressInfo;

  return {
    server,
    url: `http://127.0.0.1:${address.port}`,
  };
}

async function cerrarServidor(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

/*
 * Aqui no se mockea HttpService.
 *
 * Flujo real del test:
 *
 * Supertest
 *   -> Controller Gateway real
 *   -> ProxyService real
 *   -> Axios/HTTP real
 *   -> BFF falso escuchando en un puerto real
 *
 * Los guards se sustituyen para aislar las pruebas
 * de forwarding. La autenticacion real ya se prueba
 * en el bloque anterior.
 */
describe('Gateway forwarding (e2e)', () => {
  let app: INestApplication;
  let bff: Destino;
  let bffUrlAnterior: string | undefined;

  beforeAll(async () => {
    bff = await iniciarBffFalso();

    bffUrlAnterior = process.env.BFF_URL;

    process.env.BFF_URL = bff.url;

    const guardPermitido = {
      canActivate: () => true,
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(guardPermitido)
      .overrideGuard(ScopesGuard)
      .useValue(guardPermitido)
      .overrideGuard(RolesGuard)
      .useValue(guardPermitido)
      .compile();

    app = moduleFixture.createNestApplication();

    await app.init();
  });

  afterAll(async () => {
    await app.close();

    await cerrarServidor(bff.server);

    if (bffUrlAnterior === undefined) {
      delete process.env.BFF_URL;
    } else {
      process.env.BFF_URL = bffUrlAnterior;
    }
  });

  it('GET /v1/catalogo reenvia metodo, path y Authorization', async () => {
    const response = await request(app.getHttpServer())
      .get('/v1/catalogo')
      .set('Authorization', 'Bearer token-prueba')
      .expect(200);

    expect(response.body.method).toBe('GET');

    expect(response.body.url).toBe('/v1/catalogo');

    expect(response.body.authorization).toBe('Bearer token-prueba');
  });

  it('POST /v1/catalogo reenvia metodo, path y body', async () => {
    const body = {
      titulo: 'Vidal Quest',
      precio: 12990,
    };

    const response = await request(app.getHttpServer())
      .post('/v1/catalogo')
      .send(body)
      .expect(201);

    expect(response.body.method).toBe('POST');

    expect(response.body.url).toBe('/v1/catalogo');

    expect(response.body.body).toEqual(body);
  });

  it('PUT /v1/catalogo/:juegoId codifica el identificador', async () => {
    const response = await request(app.getHttpServer())
      .put('/v1/catalogo/juego%2Fespecial')
      .send({
        precio: 14990,
      })
      .expect(200);

    expect(response.body.method).toBe('PUT');

    expect(response.body.url).toBe('/v1/catalogo/juego%2Fespecial');
  });

  it('POST /v1/compras reenvia metodo, path y body', async () => {
    const response = await request(app.getHttpServer())
      .post('/v1/compras')
      .send({
        juegoId: 'juego-1',
      })
      .expect(201);

    expect(response.body.method).toBe('POST');

    expect(response.body.url).toBe('/v1/compras');

    expect(response.body.body).toEqual({
      juegoId: 'juego-1',
    });
  });

  it('GET /v1/biblioteca reenvia metodo y path', async () => {
    const response = await request(app.getHttpServer())
      .get('/v1/biblioteca')
      .expect(200);

    expect(response.body.method).toBe('GET');

    expect(response.body.url).toBe('/v1/biblioteca');
  });

  it('GET /v1/licencias reenvia metodo y path', async () => {
    const response = await request(app.getHttpServer())
      .get('/v1/licencias')
      .expect(200);

    expect(response.body.method).toBe('GET');

    expect(response.body.url).toBe('/v1/licencias');
  });

  it('DELETE /v1/licencias/:licenciaId codifica el identificador', async () => {
    const response = await request(app.getHttpServer())
      .delete('/v1/licencias/licencia%2Fespecial')
      .expect(200);

    expect(response.body.method).toBe('DELETE');

    expect(response.body.url).toBe('/v1/licencias/licencia%2Fespecial');
  });

  it('conserva status y body de un error HTTP del BFF', async () => {
    const response = await request(app.getHttpServer())
      .get('/v1/catalogo')
      .set('Authorization', 'Bearer error-bff')
      .expect(422);

    expect(response.body).toEqual({
      statusCode: 422,
      message: 'Error del BFF',
    });
  });

  it('timeout del BFF devuelve 504', async () => {
    const response = await request(app.getHttpServer())
      .get('/v1/catalogo')
      .set('Authorization', 'Bearer timeout')
      .expect(504);

    expect(response.body).toEqual({
      statusCode: 504,
      message: 'Gateway Timeout',
    });
  }, 5000);

  it('BFF sin respuesta devuelve 502', async () => {
    const response = await request(app.getHttpServer())
      .get('/v1/catalogo')
      .set('Authorization', 'Bearer disconnect')
      .expect(502);

    expect(response.body).toEqual({
      statusCode: 502,
      message: 'Bad Gateway',
    });
  });
});
