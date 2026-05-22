import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Usuario } from '@/modules/auth/entities/usuario.entity';
import { TokenService } from '@/modules/auth/services/token.service';
import { SesionService } from '@/modules/auth/services/sesion.service';
import { RegisterDto, LoginDto, ChangePasswordDto } from '@/modules/auth/dto/request';
import { AuthResponseDto, UserResponseDto } from '@/modules/auth/dto/response/auth-response.dto';
import { AUTH_CONSTANTS } from '@/modules/auth/constants/auth.constants';
import { plainToClass } from 'class-transformer';


@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(Usuario, 'SEGURIDAD_DB')
    private readonly usuarioRepository: Repository<Usuario>,
    private readonly tokenService: TokenService,
    private readonly sesionService: SesionService,
  ) { }

  async register(registerDto: RegisterDto): Promise<AuthResponseDto> {
    const { email, password, nombre } = registerDto;



    // Verificar si el usuario ya existe
    const existingUser = await this.usuarioRepository.findOne({
      where: { email },
    });
    if (existingUser) {
      throw new ConflictException('El email ya está registrado');
    }





    // Hash de la contraseña
    const passwordHash = await bcrypt.hash(password, AUTH_CONSTANTS.BCRYPT_ROUNDS);

    // Crear usuario
    const usuario = this.usuarioRepository.create({
      nombre,
      email,
      passwordHash,
      estado: 'activo',
    });

    const savedUser = await this.usuarioRepository.save(usuario);

    // Crear sesión
    const sesion = await this.sesionService.createSesion(savedUser.idUsuario);

    // Generar tokens
    const tokens = await this.tokenService.generateTokenPair(
      savedUser,
      sesion.idSesion,
    );




    // Cargar usuario con relaciones para la respuesta
    const userWithRoles = await this.usuarioRepository.findOne({
      where: { idUsuario: savedUser.idUsuario },
      relations: ['roles'],
    });

    if (!userWithRoles) {
      throw new Error('Error al cargar el usuario con roles');
    }

    return {
      ...tokens,
      user: this.mapToUserResponse(userWithRoles),
    };




    function validarCedula(ced: string | undefined): boolean {
      if (!ced || ced.length !== 10) return false;

      const digitoVerificador = parseInt(ced.charAt(9), 10);
      let suma = 0;

      for (let i = 0; i < 9; i++) {
        let num = parseInt(ced.charAt(i), 10);
        if (i % 2 === 0) {
          num *= 2;
          if (num > 9) num -= 9;
        }
        suma += num;
      }

      const resultado = (10 - (suma % 10)) % 10;
      return resultado === digitoVerificador;
    }
  }



  async login(
    loginDto: LoginDto,
    ip?: string,
    userAgent?: string,
  ): Promise<AuthResponseDto> {
    const { email, password } = loginDto;

    // Buscar usuario con relaciones
    const usuario = await this.usuarioRepository.findOne({
      where: { email },
      relations: ['roles', 'roles.permisos'],
    });

    if (!usuario) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    // Verificar estado
    if (usuario.estado !== 'activo') {
      throw new UnauthorizedException('Usuario inactivo');
    }

    // Verificar contraseña
    const isPasswordValid = await bcrypt.compare(password, usuario.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    // Crear sesión
    const sesion = await this.sesionService.createSesion(
      usuario.idUsuario,
      ip,
      userAgent,
    );

    // Generar tokens
    const tokens = await this.tokenService.generateTokenPair(
      usuario,
      sesion.idSesion,
    );


    return { ...tokens, user: this.mapToUserResponse(usuario) };
  }

  async refreshTokens(refreshToken: string): Promise<AuthResponseDto> {
    const payload = await this.tokenService.verifyRefreshToken(refreshToken);

    if (!payload) {
      throw new UnauthorizedException('Refresh token inválido o expirado');
    }

    const usuario = await this.usuarioRepository.findOne({
      where: { idUsuario: payload.sub },
      relations: ['roles', 'roles.permisos'],
    });

    if (!usuario || usuario.estado !== 'activo') {
      throw new UnauthorizedException('Usuario no encontrado o inactivo');
    }

    // Generar nuevos tokens
    const tokens = await this.tokenService.generateTokenPair(
      usuario,
      payload.sessionId,
    );

    return {
      ...tokens,
      user: this.mapToUserResponse(usuario),
    };
  }

  async logout(userId: number, sessionId?: string): Promise<void> {
    if (sessionId) {
      await this.sesionService.invalidateSesion(sessionId);
    }
    await this.tokenService.revokeAllUserTokens(userId);

  }

  async changePassword(
    userId: number,
    changePasswordDto: ChangePasswordDto,
  ): Promise<void> {
    const { currentPassword, newPassword } = changePasswordDto;

    const usuario = await this.usuarioRepository.findOne({
      where: { idUsuario: userId },
    });

    if (!usuario) {
      throw new BadRequestException('Usuario no encontrado');
    }

    const isPasswordValid = await bcrypt.compare(
      currentPassword,
      usuario.passwordHash,
    );

    if (!isPasswordValid) {
      throw new BadRequestException('Contraseña actual incorrecta');
    }

    const newPasswordHash = await bcrypt.hash(
      newPassword,
      AUTH_CONSTANTS.BCRYPT_ROUNDS,
    );

    await this.usuarioRepository.update(
      { idUsuario: userId },
      { passwordHash: newPasswordHash },
    );

    // Revocar todos los tokens del usuario
    await this.tokenService.revokeAllUserTokens(userId);

  }

  async validateUser(userId: number): Promise<Usuario | null> {
    return this.usuarioRepository.findOne({
      where: { idUsuario: userId },
      relations: ['roles', 'roles.permisos'],
    });
  }

  private mapToUserResponse(usuario: Usuario): UserResponseDto {
    return plainToClass(UserResponseDto, {
      ...usuario,
      roles: usuario.roles?.map(r => r.nombre) || [],
    }, { excludeExtraneousValues: true });
  }
}

