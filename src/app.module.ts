import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { AppController } from './app.controller.js';
import { JwtAuthGuard } from './auth/jwt-auth.guard.js';
import { JwtStrategy } from './auth/jwt.strategy.js';
import { RolesGuard } from './auth/roles.guard.js';
import { ScopesGuard } from './auth/scopes.guard.js';
import { ProxyService } from './proxy/proxy.service.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    HttpModule,
  ],
  controllers: [AppController],
  providers: [
    JwtStrategy,
    ProxyService,
    JwtAuthGuard,
    ScopesGuard,
    RolesGuard,
  ],
})
export class AppModule {}
