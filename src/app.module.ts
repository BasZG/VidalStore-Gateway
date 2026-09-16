import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { HttpModule } from '@nestjs/axios';
import { JwtStrategy } from './auth/jwt.strategy.js';
import { AppController } from './app.controller.js';
import { ProxyService } from './proxy/proxy.service.js';
import { JwtAuthGuard } from './auth/jwt-auth.guard.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    HttpModule,
  ],
  controllers: [AppController],
  providers: [JwtStrategy, ProxyService,JwtAuthGuard],
})
export class AppModule {}