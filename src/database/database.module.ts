// src/database/database.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DatabaseService } from './services/database.service';

// Entidades de seguridad
import { Usuario } from '@/modules/auth/entities/usuario.entity';
import { Rol } from '@/modules/auth/entities/rol.entity';
import { Permiso } from '@/modules/auth/entities/permiso.entity';
import { Token } from '@/modules/auth/entities/token.entity';
import { Sesion } from '@/modules/auth/entities/sesion.entity';
import { PasswordRecoveryCode } from '@/modules/auth/entities/password-recovery-code.entity';


@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      name: 'SEGURIDAD_DB',
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host:     config.get<string>('SEGURIDAD_DB_HOST'),
        port:     config.get<number>('SEGURIDAD_DB_PORT'),
        username: config.get<string>('SEGURIDAD_DB_USER'),
        password: config.get<string>('SEGURIDAD_DB_PASS'),
        database: config.get<string>('SEGURIDAD_DB_NAME'),
        synchronize: false,
        logging: true,
        ssl: false,
        entities: [Usuario, Rol, Permiso, Token, Sesion, PasswordRecoveryCode],
      }),
    }),
  ],
  providers: [DatabaseService],
  exports: [DatabaseService, TypeOrmModule],
})
export class DatabaseModule {}