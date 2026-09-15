import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from './auth/jwt.strategy.js';
import { AppController } from './app.controller.js';

@Module({
  imports: [PassportModule.register({ defaultStrategy: 'jwt' })],
  controllers: [AppController],
  providers: [JwtStrategy], // Solo JwtStrategy aquí. NO agregues JwtAuthGuard ni RolesGuard a esta lista.
})
export class AppModule {}