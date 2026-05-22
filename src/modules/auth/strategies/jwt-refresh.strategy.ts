import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { AuthService } from '@/modules/auth/services/auth.service';
import { JwtPayload } from '@/modules/auth/interfaces';
import { AUTH_CONSTANTS } from '@/modules/auth/constants/auth.constants';

const extractRefreshTokenFromCookie = (req: Request): string | null => {
  if (req && req.cookies) {
    return req.cookies[AUTH_CONSTANTS.COOKIE_REFRESH_TOKEN];
  }
  return null;
};

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor(private readonly authService: AuthService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        extractRefreshTokenFromCookie,
        ExtractJwt.fromBodyField('refreshToken'), // Fallback
      ]),
      ignoreExpiration: false,
      secretOrKey: AUTH_CONSTANTS.JWT_REFRESH_SECRET,
      passReqToCallback: true,
    });
  }

  async validate(req: Request, payload: JwtPayload) {
    const refreshToken = req.cookies?.[AUTH_CONSTANTS.COOKIE_REFRESH_TOKEN] || req.body?.refreshToken;

    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token no proporcionado');
    }

    const usuario = await this.authService.validateUser(payload.sub);

    if (!usuario || usuario.estado !== 'activo') {
      throw new UnauthorizedException('Usuario no autorizado');
    }

    return {
      idUsuario: usuario.idUsuario,
      email: usuario.email,
      refreshToken,
    };
  }
}
