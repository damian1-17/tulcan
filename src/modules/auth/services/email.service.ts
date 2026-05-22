import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { Transporter } from 'nodemailer';
import { getPasswordRecoveryTemplate } from '../templates/password-recovery.template';
import { getPasswordChangedTemplate } from '../templates/password-changed.template';
import { readFileSync } from 'fs';
import { join } from 'path';

@Injectable()
export class EmailService {
  private readonly logoPngUTN = `data:image/png;base64,${readFileSync(
    join(process.cwd(), 'src', 'assets', 'ieee-utn-color.png'),
  ).toString('base64')}`;

    private readonly logoPngUnificado = `data:image/png;base64,${readFileSync(
    join(process.cwd(), 'src', 'assets', 'unificado.png'),
  ).toString('base64')}`;
  private readonly logoUrl = `${process.env.APP_URL}/assets/ieee-utn-color.png`;

  private readonly logger = new Logger(EmailService.name);
  private transporter: Transporter;

  constructor(private readonly configService: ConfigService) {
    this.initializeTransporter();
  }

  /**
   * Inicializa el transporter de nodemailer
   */
  private initializeTransporter(): void {
    const smtpHost = this.configService.get<string>('SMTP_HOST');
    const smtpPort = this.configService.get<number>('SMTP_PORT', 465);
    const smtpUser = this.configService.get<string>('SMTP_USER');
    const smtpPass = this.configService.get<string>('SMTP_PASS');
    const smtpSecure = this.configService.get<boolean>('SMTP_SECURE', false);

    // Validar que las credenciales estén configuradas
    if (!smtpHost || !smtpUser || !smtpPass) {
      this.logger.warn(
        '⚠️  Credenciales SMTP no configuradas. Los emails se loguearan en consola.',
      );
      this.transporter = null as any;
      return;
    }

    try {
      this.transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpSecure, // true para 465, false para otros puertos
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
        // Opciones adicionales para mejor compatibilidad
        requireTLS: true,
        tls: {
          rejectUnauthorized: false, // Solo en desarrollo
          minVersion: 'TLSv1.2',
        },
      });

      this.logger.log(`✅ Email service inicializado: ${smtpHost}:${smtpPort}`);
    } catch (error) {
      this.logger.error('❌ Error al inicializar el transporter de email:', error);
      this.transporter = null as any;
    }
  }

  /**
   * Envía el código de recuperación de contraseña
   */
  async sendPasswordRecoveryCode(
    email: string,
    code: string,
    nombre: string,
  ): Promise<void> {
    try {
      // Si no hay transporter configurado, loguear en consola
      if (!this.transporter) {
        this.logEmailToConsole(email, nombre, code, 'recuperación');
        return;
      }

      const emailFrom = this.configService.get<string>(
        'EMAIL_FROM',
        'noreply@app.com',
      );
      console.log('logoPng length:', this.logoPngUTN?.length); // ← debe mostrar un número > 0
      console.log('logoPng preview:', this.logoPngUTN?.substring(0, 50)); // ← debe empezar con data:image/png;base64,

      await this.transporter.sendMail({
        from: emailFrom,
        to: email,
        subject: 'Recuperación de contraseña',
        html: getPasswordRecoveryTemplate(nombre, code, this.logoPngUnificado),
      });

      this.logger.log(`📧 Email de recuperación enviado a: ${email}`);
    } catch (error) {
      this.logger.error('❌ Error al enviar email de recuperación:', error);
      // Fallback: loguear en consola si falla el envío
      this.logEmailToConsole(email, nombre, code, 'recuperación');
      throw new Error('No se pudo enviar el email de recuperación');
    }
  }

  /**
   * Envía confirmación de cambio de contraseña exitoso
   */
  async sendPasswordChangedConfirmation(
    email: string,
    nombre: string,
  ): Promise<void> {
    try {
      // Si no hay transporter configurado, loguear en consola
      if (!this.transporter) {
        this.logEmailToConsole(email, nombre, '', 'confirmación');
        return;
      }

      const emailFrom = this.configService.get<string>(
        'EMAIL_FROM',
        'noreply@app.com',
      );

      await this.transporter.sendMail({
        from: emailFrom,
        to: email,
        subject: 'Contraseña actualizada exitosamente',
        html: getPasswordChangedTemplate(nombre, this.logoPngUTN),
      });

      this.logger.log(`📧 Email de confirmación enviado a: ${email}`);
    } catch (error) {
      this.logger.error('❌ Error al enviar email de confirmación:', error);
      // No lanzar error aquí, la contraseña ya fue cambiada
    }
  }

  /**
   * Loguea el email en consola cuando no hay configuración SMTP
   */
  private logEmailToConsole(
    email: string,
    nombre: string,
    code: string,
    tipo: 'recuperación' | 'confirmación',
  ): void {
    this.logger.log(`
      ═══════════════════════════════════════════════════════════
      📧 EMAIL DE ${tipo.toUpperCase()} (MODO DESARROLLO)
      ═══════════════════════════════════════════════════════════
      Para: ${email}
      Nombre: ${nombre}
      ${code ? `Código: ${code}` : 'Tipo: Confirmación de cambio de contraseña'}
      ═══════════════════════════════════════════════════════════
      ⚠️  Para enviar emails reales, configura las variables:
      SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, EMAIL_FROM
      ═══════════════════════════════════════════════════════════
    `);
  }

  /**
   * Verifica la conexión SMTP (útil para testing)
   */
  async verifyConnection(): Promise<boolean> {
    if (!this.transporter) {
      this.logger.warn('No hay transporter configurado para verificar');
      return false;
    }

    try {
      await this.transporter.verify();
      this.logger.log('✅ Conexión SMTP verificada exitosamente');
      return true;
    } catch (error) {
      this.logger.error('❌ Error al verificar conexión SMTP:', error);
      return false;
    }
  }
}