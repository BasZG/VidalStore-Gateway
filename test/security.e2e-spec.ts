import { type INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  generateKeyPairSync,
  type KeyObject,
  sign as cryptoSign,
} from 'node:crypto';
import {
  createServer,
  type IncomingMessage,
  type Server,
} from 'node:http';
import type { AddressInfo } from 'node:net';
import request from 'supertest';
import {
  afterAll,
  beforeAll,
  describe,
  expect,
  it,
} from 'vitest';
import { AppModule } from './../src/app.module.js';
import { corsOptions } from './../src/config/cors.config.js';

const CLIENT_ID = 'cliente-prueba';
const KID = 'clave-prueba';

type ServidorLocal = {
  server: Server;
  url: string;
};

const { privateKey, publicKey } = generateKeyPairSync(
  'rsa',
  {
    modulusLength: 2048,
  },
);

const { privateKey: privateKeyIncorrecta } =
  generateKeyPairSync('rsa', {
    modulusLength: 2048,
  });

let issuer = '';

function codificarJson(valor: unknown): string {
  return Buffer.from(
    JSON.stringify(valor),
  ).toString('base64url');
}

function firmarToken(
  overrides: Record<string, unknown> = {},
  clave: KeyObject = privateKey,
): string {
  const ahora = Math.floor(Date.now() / 1000);

  const header = {
    alg: 'RS256',
    typ: 'JWT',
    kid: KID,
  };

  const payload = {
    sub: 'usuario-prueba',
    iss: issuer,
    client_id: CLIENT_ID,
    token_use: 'access',
    scope:
      'vidalstore/catalogo.leer ' +
      'vidalstore/biblioteca.leer',
    'cognito:groups': ['jugadores'],
    iat: ahora,
    exp: ahora + 300,
    ...overrides,
  };

  const contenido =
    `${codificarJson(header)}.` +
    `${codificarJson(payload)}`;

  const firma = cryptoSign(
    'RSA-SHA256',
    Buffer.from(contenido),
    clave,
  ).toString('base64url');

  return `${contenido}.${firma}`;
}

function alterarToken(token: string): string {
  const [header, payload, firma] = token.split('.');

  const payloadOriginal = JSON.parse(
    Buffer.from(
      payload,
      'base64url',
    ).toString('utf8'),
  );

  payloadOriginal.sub = 'usuario-alterado';

  return [
    header,
    codificarJson(payloadOriginal),
    firma,
  ].join('.');
}

async function iniciarJwks(): Promise<ServidorLocal> {
  const publicJwk = publicKey.export({
    format: 'jwk',
  });

  const server = createServer((req, res) => {
    if (
      req.url ===
      '/.well-known/jwks.json'
    ) {
      res.statusCode = 200;
      res.setHeader(
        'Content-Type',
        'application/json',
      );

      res.end(
        JSON.stringify({
          keys: [
            {
              ...publicJwk,
              kid: KID,
              use: 'sig',
              alg: 'RS256',
            },
          ],
        }),
      );

      return;
    }

    res.statusCode = 404;
    res.end();
  });

  await new Promise<void>((resolve) => {
    server.listen(
      0,
      '127.0.0.1',
      resolve,
    );
  });

  const address =
    server.address() as AddressInfo;

  return {
    server,
    url: `http://127.0.0.1:${address.port}`,
  };
}

async function leerBody(
  req: IncomingMessage,
): Promise<unknown> {
  const chunks: Buffer[] = [];

  for await (const chunk of req) {
    chunks.push(
      Buffer.isBuffer(chunk)
        ? chunk
        : Buffer.from(chunk),
    );
  }

  if (chunks.length === 0) {
    return undefined;
  }

  const contenido =
    Buffer.concat(chunks).toString('utf8');

  if (!contenido) {
    return undefined;
  }

  return JSON.parse(contenido);
}

async function iniciarBffFalso(): Promise<ServidorLocal> {
  const server = createServer(
    async (req, res) => {
      const body = await leerBody(req);

      res.statusCode =
        req.method === 'POST' ? 201 : 200;

      res.setHeader(
        'Content-Type',
        'application/json',
      );

      res.end(
        JSON.stringify({
          method: req.method,
          url: req.url,
          authorization:
            req.headers.authorization ?? null,
          body: body ?? null,
        }),
      );
    },
  );

  await new Promise<void>((resolve) => {
    server.listen(
      0,
      '127.0.0.1',
      resolve,
    );
  });

  const address =
    server.address() as AddressInfo;

  return {
    server,
    url: `http://127.0.0.1:${address.port}`,
  };
}

async function cerrarServidor(
  server: Server,
): Promise<void> {
  await new Promise<void>(
    (resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    },
  );
}

describe('Gateway seguridad JWT real (e2e)', () => {
  let app: INestApplication;
  let jwks: ServidorLocal;
  let bff: ServidorLocal;

  const envAnterior = {
    issuer: process.env.COGNITO_ISSUER,
    jwks: process.env.COGNITO_JWKS_URI,
    clientId: process.env.COGNITO_CLIENT_ID,
    bff: process.env.BFF_URL,
  };

  beforeAll(async () => {
    jwks = await iniciarJwks();
    bff = await iniciarBffFalso();

    issuer = jwks.url;

    process.env.COGNITO_ISSUER =
      issuer;

    process.env.COGNITO_JWKS_URI =
      `${issuer}/.well-known/jwks.json`;

    process.env.COGNITO_CLIENT_ID =
      CLIENT_ID;

    process.env.BFF_URL =
      bff.url;

    const moduleFixture: TestingModule =
      await Test.createTestingModule({
        imports: [AppModule],
      }).compile();

    app =
      moduleFixture.createNestApplication();

    app.enableCors(corsOptions);

    await app.init();
  });

  afterAll(async () => {
    await app.close();

    await cerrarServidor(jwks.server);
    await cerrarServidor(bff.server);

    restaurarEnv(
      'COGNITO_ISSUER',
      envAnterior.issuer,
    );

    restaurarEnv(
      'COGNITO_JWKS_URI',
      envAnterior.jwks,
    );

    restaurarEnv(
      'COGNITO_CLIENT_ID',
      envAnterior.clientId,
    );

    restaurarEnv(
      'BFF_URL',
      envAnterior.bff,
    );
  });

  it('acepta Access Token RS256 valido', async () => {
    const token = firmarToken();

    await request(app.getHttpServer())
      .get('/v1/catalogo')
      .set(
        'Authorization',
        `Bearer ${token}`,
      )
      .expect(200);
  });

  it('rechaza token con firma incorrecta', async () => {
    const token = firmarToken(
      {},
      privateKeyIncorrecta,
    );

    await request(app.getHttpServer())
      .get('/v1/catalogo')
      .set(
        'Authorization',
        `Bearer ${token}`,
      )
      .expect(401);
  });

  it('rechaza token alterado despues de firmarlo', async () => {
    const token =
      alterarToken(firmarToken());

    await request(app.getHttpServer())
      .get('/v1/catalogo')
      .set(
        'Authorization',
        `Bearer ${token}`,
      )
      .expect(401);
  });

  it('rechaza token vencido', async () => {
    const ahora =
      Math.floor(Date.now() / 1000);

    const token = firmarToken({
      exp: ahora - 60,
    });

    await request(app.getHttpServer())
      .get('/v1/catalogo')
      .set(
        'Authorization',
        `Bearer ${token}`,
      )
      .expect(401);
  });

  it('rechaza issuer incorrecto', async () => {
    const token = firmarToken({
      iss: 'https://issuer-invalido',
    });

    await request(app.getHttpServer())
      .get('/v1/catalogo')
      .set(
        'Authorization',
        `Bearer ${token}`,
      )
      .expect(401);
  });

  it('rechaza ID Token', async () => {
    const token = firmarToken({
      token_use: 'id',
    });

    await request(app.getHttpServer())
      .get('/v1/catalogo')
      .set(
        'Authorization',
        `Bearer ${token}`,
      )
      .expect(401);
  });

  it('rechaza token de otro App Client', async () => {
    const token = firmarToken({
      client_id: 'otro-cliente',
    });

    await request(app.getHttpServer())
      .get('/v1/catalogo')
      .set(
        'Authorization',
        `Bearer ${token}`,
      )
      .expect(401);
  });

  it('rechaza scope insuficiente con 403', async () => {
    const token = firmarToken({
      scope:
        'vidalstore/biblioteca.leer',
    });

    await request(app.getHttpServer())
      .get('/v1/catalogo')
      .set(
        'Authorization',
        `Bearer ${token}`,
      )
      .expect(403);
  });

  it('asigna jugador por defecto a JWT sin grupos', async () => {
    const token = firmarToken({
      'cognito:groups': undefined,
    });

    await request(app.getHttpServer())
      .get('/v1/catalogo')
      .set(
        'Authorization',
        `Bearer ${token}`,
      )
      .expect(200);
  });

  it('no concede permisos editoriales a JWT sin grupos', async () => {
    const token = firmarToken({
      'cognito:groups': undefined,
    });

    await request(app.getHttpServer())
      .post('/v1/catalogo')
      .set(
        'Authorization',
        `Bearer ${token}`,
      )
      .send({
        titulo: 'Juego sin privilegios',
      })
      .expect(403);
  });

  it('no concede permisos administrativos a JWT sin grupos', async () => {
    const token = firmarToken({
      'cognito:groups': undefined,
    });

    await request(app.getHttpServer())
      .get('/v1/licencias')
      .set(
        'Authorization',
        `Bearer ${token}`,
      )
      .expect(403);
  });

  it('asigna jugador por defecto a grupos vacios', async () => {
    const token = firmarToken({
      'cognito:groups': [],
    });

    await request(app.getHttpServer())
      .get('/v1/catalogo')
      .set(
        'Authorization',
        `Bearer ${token}`,
      )
      .expect(200);
  });

  it('conserva grupos conocidos y descarta desconocidos', async () => {
    const token = firmarToken({
      'cognito:groups': [
        'editores',
        'grupo-externo',
      ],
    });

    await request(app.getHttpServer())
      .post('/v1/catalogo')
      .set(
        'Authorization',
        `Bearer ${token}`,
      )
      .send({
        titulo: 'Juego de editor valido',
      })
      .expect(201);
  });

  it('rechaza grupos exclusivamente desconocidos', async () => {
    const token = firmarToken({
      'cognito:groups': ['grupo-externo'],
    });

    await request(app.getHttpServer())
      .post('/v1/catalogo')
      .set(
        'Authorization',
        `Bearer ${token}`,
      )
      .send({
        titulo: 'Juego de grupo desconocido',
      })
      .expect(403);
  });

  it('rechaza claim de grupos con formato incorrecto', async () => {
    const token = firmarToken({
      'cognito:groups': 'editores',
    });

    await request(app.getHttpServer())
      .post('/v1/catalogo')
      .set(
        'Authorization',
        `Bearer ${token}`,
      )
      .send({
        titulo: 'Juego con claim invalido',
      })
      .expect(403);
  });

  it('ignora grupos efectivos inyectados en el JWT', async () => {
    const token = firmarToken({
      'cognito:groups': ['jugadores'],
      gruposEfectivos: ['administradores'],
    });

    await request(app.getHttpServer())
      .get('/v1/licencias')
      .set(
        'Authorization',
        `Bearer ${token}`,
      )
      .expect(403);
  });

  it('permite a editor crear juegos', async () => {
    const token = firmarToken({
      'cognito:groups': ['editores'],
    });

    await request(app.getHttpServer())
      .post('/v1/catalogo')
      .set(
        'Authorization',
        `Bearer ${token}`,
      )
      .send({
        titulo: 'Juego de prueba',
      })
      .expect(201);
  });

  it('rechaza a jugador en ruta de editor', async () => {
    const token = firmarToken({
      'cognito:groups': ['jugadores'],
    });

    await request(app.getHttpServer())
      .post('/v1/catalogo')
      .set(
        'Authorization',
        `Bearer ${token}`,
      )
      .send({
        titulo: 'Juego prohibido',
      })
      .expect(403);
  });

  it('permite administrador en licencias', async () => {
    const token = firmarToken({
      'cognito:groups': [
        'administradores',
      ],
    });

    await request(app.getHttpServer())
      .get('/v1/licencias')
      .set(
        'Authorization',
        `Bearer ${token}`,
      )
      .expect(200);
  });

  it('rechaza editor en ruta solo de administradores', async () => {
    const token = firmarToken({
      'cognito:groups': ['editores'],
    });

    await request(app.getHttpServer())
      .get('/v1/licencias')
      .set(
        'Authorization',
        `Bearer ${token}`,
      )
      .expect(403);
  });

  it('permite CORS para Angular localhost:4200', async () => {
    const response =
      await request(app.getHttpServer())
        .options('/v1/catalogo')
        .set(
          'Origin',
          'http://localhost:4200',
        )
        .set(
          'Access-Control-Request-Method',
          'GET',
        )
        .expect(204);

    expect(
      response.headers[
        'access-control-allow-origin'
      ],
    ).toBe('http://localhost:4200');
  });

  it('no autoriza otro origen mediante CORS', async () => {
    const response =
      await request(app.getHttpServer())
        .options('/v1/catalogo')
        .set(
          'Origin',
          'https://origen-invalido.example',
        )
        .set(
          'Access-Control-Request-Method',
          'GET',
        )
        .expect(204);

    expect(
      response.headers[
        'access-control-allow-origin'
      ],
    ).not.toBe(
      'https://origen-invalido.example',
    );
  });
});

function restaurarEnv(
  nombre: string,
  valor: string | undefined,
): void {
  if (valor === undefined) {
    delete process.env[nombre];
    return;
  }

  process.env[nombre] = valor;
}
