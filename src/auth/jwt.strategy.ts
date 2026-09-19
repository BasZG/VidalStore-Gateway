import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import {
  ExtractJwt,
  Strategy,
} from 'passport-jwt';
import { passportJwtSecret } from 'jwks-rsa';
import { obtenerGruposEfectivos } from './grupos-efectivos.js';

const COGNITO_ISSUER_DEFAULT =
  'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_kEQF95sY0';

const COGNITO_CLIENT_ID_DEFAULT =
  '43e5hri7r4d1cet653qume2l64';

@Injectable()
export class JwtStrategy extends PassportStrategy(
  Strategy,
) {
  private readonly clientId: string;

  constructor(configService: ConfigService) {
    const issuer =
      configService.get<string>('COGNITO_ISSUER') ??
      COGNITO_ISSUER_DEFAULT;

    const clientId =
      configService.get<string>('COGNITO_CLIENT_ID') ??
      COGNITO_CLIENT_ID_DEFAULT;

    const jwksUri =
      configService.get<string>('COGNITO_JWKS_URI') ??
      `${issuer}/.well-known/jwks.json`;

    super({
      jwtFromRequest:
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,

      secretOrKeyProvider: passportJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 5,
        jwksUri,
      }),

      issuer,
      algorithms: ['RS256'],
    });

    this.clientId = clientId;
  }

  async validate(payload: any) {
    if (payload.token_use !== 'access') {
      throw new UnauthorizedException(
        'El token debe ser de tipo access',
      );
    }

    if (payload.client_id !== this.clientId) {
      throw new UnauthorizedException(
        'Token emitido para una aplicación no reconocida',
      );
    }

    return {
      ...payload,
      gruposEfectivos: obtenerGruposEfectivos(
        payload['cognito:groups'],
      ),
    };
  }
}
