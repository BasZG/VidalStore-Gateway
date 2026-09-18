import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { corsOptions } from './config/cors.config.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors(corsOptions);

  await app.listen(8080);
}

bootstrap();
