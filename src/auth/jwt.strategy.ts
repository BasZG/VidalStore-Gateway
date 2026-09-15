import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { passportJwtSecret } from 'jwks-rsa';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      // Extrae el token de la cabecera
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      
      // Descarga las llaves de tu Cognito usando el User Pool ID que me diste
      secretOrKeyProvider: passportJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 5,
        jwksUri: 'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_kEQF95sY0/.well-known/jwks.json',
      }),

      // Valida el emisor
      issuer: 'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_kEQF95sY0',
      algorithms: ['RS256'],
    });
  }

  async validate(payload: any) {
    if (payload.token_use !== 'access') {
      throw new UnauthorizedException('El token debe ser de tipo access');
    }

    // Valida tu App Client ID
    if (payload.client_id !== '43e5hri7r4d1cet653qume2l64') {
      throw new UnauthorizedException('Token emitido para una aplicación no reconocida');
    }

    return payload; 
  }
}