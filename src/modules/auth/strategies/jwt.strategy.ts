import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { AuthService } from '@/modules/auth/services/auth.service';
import { JwtPayload, AuthUser } from '@/modules/auth/interfaces';
import { AUTH_CONSTANTS } from '@/modules/auth/constants/auth.constants';

// Función para extraer JWT de cookies
const extractJwtFromCookie = (req: Request): string | null => {
  if (req && req.cookies) {
    return req.cookies[AUTH_CONSTANTS.COOKIE_ACCESS_TOKEN];
  }
  return null;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(private readonly authService: AuthService) {
    super({
      // ✅ Extraer de cookies en lugar de header Authorization
      jwtFromRequest: ExtractJwt.fromExtractors([
        extractJwtFromCookie,
        ExtractJwt.fromAuthHeaderAsBearerToken(), // Fallback para APIs
      ]),
      ignoreExpiration: false,
      secretOrKey: AUTH_CONSTANTS.JWT_SECRET,
      passReqToCallback: false,
    });
  }

  async validate(payload: JwtPayload): Promise<AuthUser> {
    const usuario = await this.authService.validateUser(payload.sub);

    if (!usuario || usuario.estado !== 'activo') {
      throw new UnauthorizedException('Usuario no autorizado');
    }

    return {
      idUsuario: usuario.idUsuario,
      email: usuario.email,
      nombre: usuario.nombre,
      roles: usuario.roles?.map(r => r.nombre) || [],
      permissions: usuario.roles?.flatMap(r => r.permisos?.map(p => p.clave) || []) || [],
      sessionId: payload.sessionId,
    };
  }
}