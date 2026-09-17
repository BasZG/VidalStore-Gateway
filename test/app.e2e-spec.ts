import type { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import {
  afterAll,
  beforeAll,
  describe,
  it,
} from 'vitest';
import { AppModule } from './../src/app.module.js';

describe('Gateway (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule =
      await Test.createTestingModule({
        imports: [AppModule],
      }).compile();

    app = moduleFixture.createNestApplication();

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /v1/catalogo sin token debe responder 401', async () => {
    await request(app.getHttpServer())
      .get('/v1/catalogo')
      .expect(401);
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
    await request(app.getHttpServer())
      .get('/v1/biblioteca')
      .expect(401);
  });

  it('GET /v1/licencias sin token debe responder 401', async () => {
    await request(app.getHttpServer())
      .get('/v1/licencias')
      .expect(401);
  });

  it('DELETE /v1/licencias/:licenciaId sin token debe responder 401', async () => {
    await request(app.getHttpServer())
      .delete('/v1/licencias/licencia-1')
      .expect(401);
  });
});
