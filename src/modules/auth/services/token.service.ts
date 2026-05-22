import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { Token, TipoToken } from '@/modules/auth/entities/token.entity';
import { Usuario } from '@/modules/auth/entities/usuario.entity';
import { JwtPayload, TokenPair } from '@/modules/auth/interfaces';
import { AUTH_CONSTANTS } from '@/modules/auth/constants/auth.constants';

@Injectable()
export class TokenService {
  constructor(
    @InjectRepository(Token, 'SEGURIDAD_DB')
    private readonly tokenRepository: Repository<Token>,
    private readonly jwtService: JwtService,
  ) {}

  async generateTokenPair(usuario: Usuario, sessionId?: string): Promise<TokenPair> {
    const payload: JwtPayload = {
      sub: usuario.idUsuario,
      email: usuario.email,
      roles: usuario.roles?.map(r => r.nombre) || [],
      permissions: usuario.roles?.flatMap(r => r.permisos?.map(p => p.clave) || []) || [],
      sessionId,
    };

    const accessToken = this.jwtService.sign( payload, {
      secret: AUTH_CONSTANTS.JWT_SECRET ,
      expiresIn: AUTH_CONSTANTS.JWT_EXPIRES_IN,
    });

    const refreshToken = this.jwtService.sign(
      { sub: usuario.idUsuario, sessionId },
      {
        secret: AUTH_CONSTANTS.JWT_REFRESH_SECRET,
        expiresIn: AUTH_CONSTANTS.JWT_REFRESH_EXPIRES_IN,
      },
    );

    // Guardar tokens en BD
    await this.saveToken(usuario.idUsuario, refreshToken, TipoToken.REFRESH);

    return {
      accessToken,
      refreshToken,
      expiresIn: 900, // 15 minutos en segundos
    };
  }

  private async saveToken(
    userId: number,
    token: string,
    tipo: TipoToken,
  ): Promise<Token> {
    const tokenHash = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');

    const expiresAt = new Date();
    expiresAt.setDate(
      expiresAt.getDate() + (tipo === TipoToken.REFRESH ? 7 : 0),
    );

    const tokenEntity = this.tokenRepository.create({
      idUsuario: userId,
      tokenHash,
      tipo,
      expiresAt,
    });

    return this.tokenRepository.save(tokenEntity);
  }

  async verifyRefreshToken(refreshToken: string): Promise<JwtPayload | null> {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: AUTH_CONSTANTS.JWT_REFRESH_SECRET,
      });

      const tokenHash = crypto
        .createHash('sha256')
        .update(refreshToken)
        .digest('hex');

      const token = await this.tokenRepository.findOne({
        where: {
          tokenHash,
          tipo: TipoToken.REFRESH,
          revokedAt: null as any,
        },
      });

      if (!token || token.expiresAt < new Date()) {
        return null;
      }

      return payload;
    } catch {
      return null;
    }
  }

  async revokeToken(tokenHash: string, revokedBy?: number): Promise<void> {
    await this.tokenRepository.update(
      { tokenHash },
      { revokedAt: new Date(), revokedBy },
    );
  }

  async revokeAllUserTokens(userId: number): Promise<void> {
    await this.tokenRepository.update(
      { idUsuario: userId, revokedAt: null as any },
      { revokedAt: new Date() },
    );
  }
}
