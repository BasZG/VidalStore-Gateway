import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from './auth/jwt.strategy.js';
import { JwtAuthGuard } from './auth/jwt-auth.guard.js';
import { AppController } from './app.controller.js';

@Module({
  imports: [PassportModule],
  controllers: [AppController],
  providers: [JwtStrategy, JwtAuthGuard],
})
export class AppModule {}