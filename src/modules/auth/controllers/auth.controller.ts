import {
  Controller,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Req,
  Get,
  Res,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiCookieAuth, ApiResponse } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { AuthService } from '@/modules/auth/services/auth.service';
import { PasswordRecoveryService } from '@/modules/auth/services/password-recovery.service';
import { RegisterDto, LoginDto, ChangePasswordDto } from '@/modules/auth/dto/request';
import {
  RequestPasswordRecoveryDto,
  ResetPasswordDto,
} from '@/modules/auth/dto/password-recovery.dto';
import { JwtRefreshGuard } from '@/modules/auth/guards/jwt-refresh.guard';
import { Public } from '@/modules/auth/decorators/public.decorator';
import { CurrentUser } from '@/modules/auth/decorators/current-user.decorator';
import { AuthUser } from '@/modules/auth/interfaces';
import {
  AUTH_CONSTANTS,
  ACCESS_TOKEN_COOKIE_OPTIONS,
  REFRESH_TOKEN_COOKIE_OPTIONS,
} from '../constants/auth.constants';

@ApiTags('Autenticación')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly passwordRecoveryService: PasswordRecoveryService,
  ) { }


  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Registrar nuevo usuario' })
  @ApiResponse({ status: 201, description: 'Usuario registrado exitosamente' })
  @ApiResponse({ status: 409, description: 'El email ya está registrado' })
  async register(
    @Body() registerDto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ user: any }> {
    const result = await this.authService.register(registerDto);

    // ✅ Guardar tokens en cookies
    res.cookie(
      AUTH_CONSTANTS.COOKIE_ACCESS_TOKEN,
      result.accessToken,
      ACCESS_TOKEN_COOKIE_OPTIONS,
    );
    res.cookie(
      AUTH_CONSTANTS.COOKIE_REFRESH_TOKEN,
      result.refreshToken,
      REFRESH_TOKEN_COOKIE_OPTIONS,
    );

    // No devolver tokens en el body (ya están en cookies)
    return { user: result.user };
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Iniciar sesión' })
  @ApiResponse({ status: 200, description: 'Login exitoso' })
  @ApiResponse({ status: 401, description: 'Credenciales inválidas' })
  async login(
    @Body() loginDto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ user: any }> {
    const ip = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    const result = await this.authService.login(loginDto, ip, userAgent);

    // ✅ Guardar tokens en cookies
    res.cookie(
      AUTH_CONSTANTS.COOKIE_ACCESS_TOKEN,
      result.accessToken,
      ACCESS_TOKEN_COOKIE_OPTIONS,
    );
    res.cookie(
      AUTH_CONSTANTS.COOKIE_REFRESH_TOKEN,
      result.refreshToken,
      REFRESH_TOKEN_COOKIE_OPTIONS,
    );

    return { user: result.user };
  }

  @Public()
  @Post('refresh')
  @UseGuards(JwtRefreshGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refrescar tokens' })
  @ApiCookieAuth('refreshToken')
  @ApiResponse({ status: 200, description: 'Tokens refrescados' })
  @ApiResponse({ status: 401, description: 'Refresh token inválido' })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ user: any }> {
    const refreshToken = req.cookies[AUTH_CONSTANTS.COOKIE_REFRESH_TOKEN];
    const result = await this.authService.refreshTokens(refreshToken);

    // ✅ Actualizar cookies con nuevos tokens
    res.cookie(
      AUTH_CONSTANTS.COOKIE_ACCESS_TOKEN,
      result.accessToken,
      ACCESS_TOKEN_COOKIE_OPTIONS,
    );
    res.cookie(
      AUTH_CONSTANTS.COOKIE_REFRESH_TOKEN,
      result.refreshToken,
      REFRESH_TOKEN_COOKIE_OPTIONS,
    );

    return { user: result.user };
  }

  @Post('logout')
  @ApiCookieAuth('accessToken')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Cerrar sesión' })
  @ApiResponse({ status: 204, description: 'Sesión cerrada exitosamente' })
  async logout(
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.authService.logout(user.idUsuario, user.sessionId);

    // ✅ Eliminar cookies
    res.clearCookie(AUTH_CONSTANTS.COOKIE_ACCESS_TOKEN, ACCESS_TOKEN_COOKIE_OPTIONS);
    res.clearCookie(AUTH_CONSTANTS.COOKIE_REFRESH_TOKEN, REFRESH_TOKEN_COOKIE_OPTIONS);
  }

  @Get('profile')
  @ApiCookieAuth('accessToken')
  @ApiOperation({ summary: 'Obtener perfil del usuario actual' })
  @ApiResponse({ status: 200, description: 'Perfil del usuario' })
  getProfile(@CurrentUser() user: AuthUser) {
    return user;
  }

  @Post('change-password')
  @ApiCookieAuth('accessToken')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Cambiar contraseña' })
  @ApiResponse({ status: 204, description: 'Contraseña cambiada exitosamente' })
  @ApiResponse({ status: 400, description: 'Contraseña actual incorrecta' })
  async changePassword(
    @CurrentUser('idUsuario') userId: number,
    @Body() changePasswordDto: ChangePasswordDto,
  ): Promise<void> {
    await this.authService.changePassword(userId, changePasswordDto);
  }

  @Get('check')
  @ApiCookieAuth('accessToken')
  @ApiOperation({ summary: 'Verificar si el usuario está autenticado' })
  @ApiResponse({ status: 200, description: 'Usuario autenticado' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  checkAuth(@CurrentUser() user: AuthUser) {
    return {
      authenticated: true,
      user: {
        idUsuario: user.idUsuario,
        email: user.email,
        nombre: user.nombre,
        roles: user.roles,
      },
    };
  }

  // ========================================
  // 🔐 ENDPOINTS DE RECUPERACIÓN DE CONTRASEÑA
  // ========================================

  @Public()
  @Post('password-recovery/request')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Solicitar código de recuperación de contraseña',
    description:
      'Envía un código de recuperación de 6 dígitos al email del usuario. El código expira en 15 minutos.',
  })
  @ApiResponse({
    status: 200,
    description: 'Código enviado (siempre retorna este mensaje por seguridad)',
    schema: {
      example: {
        message:
          'Si el email está registrado, recibirás un código de recuperación en tu bandeja de entrada',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Error al enviar el email',
  })
  async requestPasswordRecovery(
    @Body() dto: RequestPasswordRecoveryDto,
    @Req() req: Request,
  ): Promise<{ message: string }> {
    const ip = req.ip || req.socket.remoteAddress;
    return this.passwordRecoveryService.requestPasswordRecovery(dto, ip);
  }

  @Public()
  @Post('password-recovery/reset')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Restablecer contraseña con código de recuperación',
    description:
      'Valida el código de recuperación y establece una nueva contraseña para el usuario.',
  })
  @ApiResponse({
    status: 200,
    description: 'Contraseña restablecida exitosamente',
    schema: {
      example: {
        message:
          'Contraseña restablecida exitosamente. Ya puedes iniciar sesión.',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Código inválido, expirado o contraseña no cumple requisitos',
  })
  async resetPassword(
    @Body() dto: ResetPasswordDto,
    @Req() req: Request,
  ): Promise<{ message: string }> {
    const ip = req.ip || req.socket.remoteAddress;
    return this.passwordRecoveryService.resetPassword(dto, ip);
  }





}