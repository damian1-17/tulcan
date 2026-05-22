import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { Sesion } from '@/modules/auth/entities/sesion.entity';

@Injectable()
export class SesionService {
  constructor(
    @InjectRepository(Sesion, 'SEGURIDAD_DB')
    private readonly sesionRepository: Repository<Sesion>,
  ) {}

  async createSesion(
    userId: number,
    ip?: string,
    userAgent?: string,
  ): Promise<Sesion> {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 días

    const sesion = this.sesionRepository.create({
      idUsuario: userId,
      ip,
      userAgent,
      expiresAt,
    });

    return this.sesionRepository.save(sesion);
  }

  async updateLastSeen(sessionId: string): Promise<void> {
    await this.sesionRepository.update(
      { idSesion: sessionId },
      { lastSeenAt: new Date() },
    );
  }

  async invalidateSesion(sessionId: string): Promise<void> {
    await this.sesionRepository.delete({ idSesion: sessionId });
  }

  async cleanExpiredSesions(): Promise<void> {
    await this.sesionRepository.delete({
      expiresAt: LessThan(new Date()),
    });
  }

  async getUserActiveSesions(userId: number): Promise<Sesion[]> {
    return this.sesionRepository.find({
      where: { idUsuario: userId },
      order: { lastSeenAt: 'DESC' },
    });
  }
}