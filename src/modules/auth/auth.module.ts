import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';

// Entities
import { Usuario } from './entities/usuario.entity';
import { Rol } from './entities/rol.entity';
import { Permiso } from './entities/permiso.entity';
import { Token } from './entities/token.entity';
import { Sesion } from './entities/sesion.entity';
import { PasswordRecoveryCode } from './entities/password-recovery-code.entity';

// Services
import { AuthService } from './services/auth.service';
import { TokenService } from './services/token.service';
import { SesionService } from './services/sesion.service';
import { PasswordRecoveryService } from './services/password-recovery.service';
import { EmailService } from './services/email.service';

// Strategies
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtRefreshStrategy } from './strategies/jwt-refresh.strategy';

// Controller
import { AuthController } from './controllers/auth.controller';



@Module({
  imports: [
    TypeOrmModule.forFeature([
      Usuario,
      Rol,
      Permiso,
      Token,
      Sesion,
      PasswordRecoveryCode, // ✅ Nueva entidad
    ], 'SEGURIDAD_DB'),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({
      global: true,
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    TokenService,
    SesionService,
    PasswordRecoveryService, // ✅ Nuevo servicio
    EmailService,             // ✅ Nuevo servicio
    JwtStrategy,
    JwtRefreshStrategy,
  ],
  exports: [
    AuthService,
    TokenService,
    SesionService,
  ],
})
export class AuthModule { }