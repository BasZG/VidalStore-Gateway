import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SCOPES_KEY } from './scopes.decorator.js';

@Injectable()
export class ScopesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const scopesRequeridos = this.reflector.getAllAndOverride<string[]>(
      SCOPES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!scopesRequeridos || scopesRequeridos.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();

    const scopesToken = String(request.user?.scope ?? '')
      .split(' ')
      .filter(Boolean);

    const autorizado = scopesRequeridos.every((scope) =>
      scopesToken.includes(scope),
    );

    if (!autorizado) {
      throw new ForbiddenException('El token no posee los scopes requeridos');
    }

    return true;
  }
}
