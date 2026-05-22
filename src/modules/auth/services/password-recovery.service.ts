import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Usuario } from '@/modules/auth/entities/usuario.entity';
import { PasswordRecoveryCode } from '@/modules/auth/entities/password-recovery-code.entity';
import { EmailService } from '@/modules/auth/services/email.service';

import { AUTH_CONSTANTS } from '@/modules/auth/constants/auth.constants';
import {
  RequestPasswordRecoveryDto,
  ResetPasswordDto,
} from '@/modules/auth/dto/password-recovery.dto';

@Injectable()
export class PasswordRecoveryService {
  private readonly logger = new Logger(PasswordRecoveryService.name);

  constructor(
    @InjectRepository(Usuario, 'SEGURIDAD_DB')
    private readonly usuarioRepository: Repository<Usuario>,
    @InjectRepository(PasswordRecoveryCode, 'SEGURIDAD_DB')
    private readonly recoveryCodeRepository: Repository<PasswordRecoveryCode>,
    private readonly emailService: EmailService,
  ) { }

  /**
   * Solicita recuperación de contraseña y envía código por email
   */
  async requestPasswordRecovery(
    dto: RequestPasswordRecoveryDto,
    ip?: string,
  ): Promise<{ message: string }> {
    const { email } = dto;

    // Buscar usuario
    const usuario = await this.usuarioRepository.findOne({
      where: { email },
    });

    // Por seguridad, siempre retornar el mismo mensaje aunque el usuario no exista
    // Esto evita que atacantes puedan descubrir qué emails están registrados
    if (!usuario) {
      this.logger.warn(`Intento de recuperación para email no registrado: ${email}`);
      return {
        message:
          'Si el email está registrado, recibirás un código de recuperación en tu bandeja de entrada',
      };
    }

    // Verificar que el usuario esté activo
    if (usuario.estado !== 'activo') {
      this.logger.warn(
        `Intento de recuperación para usuario inactivo: ${email}`,
      );
      return {
        message:
          'Si el email está registrado, recibirás un código de recuperación en tu bandeja de entrada',
      };
    }

    // Invalidar códigos anteriores no usados
    await this.recoveryCodeRepository.update(
      {
        usuarioId: usuario.idUsuario,
        used: false,
      } as any,
      {
        used: true,
      },
    );

    // Generar código aleatorio de 6 dígitos
    const code = this.generateRecoveryCode();

    // Calcular fecha de expiración (15 minutos)
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 15);

    // Guardar código en base de datos
    const recoveryCode = this.recoveryCodeRepository.create({
      usuarioId: usuario.idUsuario,
      code,
      expiresAt,
      ip: ip ?? '',
    });

    await this.recoveryCodeRepository.save(recoveryCode);

    // Enviar email con el código
    try {
      await this.emailService.sendPasswordRecoveryCode(
        usuario.email,
        code,
        usuario.nombre,
      );
    } catch (error) {
      this.logger.error('Error al enviar email de recuperación:', error);
      throw new BadRequestException(
        'No se pudo enviar el email de recuperación. Por favor, intenta más tarde.',
      );
    }


    return {
      message:
        'Si el email está registrado, recibirás un código de recuperación en tu bandeja de entrada',
    };
  }

  /**
   * Restablece la contraseña usando el código de recuperación
   */
  async resetPassword(
    dto: ResetPasswordDto,
    ip?: string,
  ): Promise<{ message: string }> {
    const { email, code, newPassword } = dto;

    // Buscar usuario
    const usuario = await this.usuarioRepository.findOne({
      where: { email },
    });

    if (!usuario) {
      throw new BadRequestException('Código de recuperación inválido o expirado');
    }

    // Buscar código de recuperación válido
    const recoveryCode = await this.recoveryCodeRepository.findOne({
      where: {
        usuarioId: usuario.idUsuario,
        code,
        used: false,
      } as any,
      order: {
        createdAt: 'DESC',
      },
    });

    if (!recoveryCode) {

      throw new BadRequestException('Código de recuperación inválido o expirado');
    }

    // Verificar si el código expiró
    if (new Date() > recoveryCode.expiresAt) {
      throw new BadRequestException('Código de recuperación inválido o expirado');
    }

    // Hashear nueva contraseña
    const passwordHash = await bcrypt.hash(
      newPassword,
      AUTH_CONSTANTS.BCRYPT_ROUNDS,
    );

    // Actualizar contraseña
    await this.usuarioRepository.update(
      { idUsuario: usuario.idUsuario },
      { passwordHash },
    );

    // Marcar código como usado
    await this.recoveryCodeRepository.update(
      { idRecovery: recoveryCode.idRecovery },
      { used: true },
    );

    // Enviar email de confirmación
    try {
      await this.emailService.sendPasswordChangedConfirmation(
        usuario.email,
        usuario.nombre,
      );
    } catch (error) {
      this.logger.error('Error al enviar email de confirmación:', error);
      // No lanzar error, la contraseña ya fue cambiada
    }

    this.logger.log(
      `Contraseña restablecida exitosamente para usuario: ${usuario.email}`,
    );

    return {
      message: 'Contraseña restablecida exitosamente. Ya puedes iniciar sesión.',
    };
  }

  /**
   * Limpia códigos expirados (puede ejecutarse con un cron job)
   */
  async cleanExpiredCodes(): Promise<void> {
    const result = await this.recoveryCodeRepository.delete({
      expiresAt: LessThan(new Date()),
    });

    this.logger.log(`Códigos expirados eliminados: ${result.affected || 0}`);
  }

  /**
   * Genera un código aleatorio de 6 dígitos
   */
  private generateRecoveryCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }
}