// src/modules/usuarios/usuarios.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsuariosController } from '@/modules/usuarios/controllers/usuarios.controller';
import { UsuariosService } from '@/modules/usuarios/services/usuarios.service';
import { Usuario } from '../auth/entities/usuario.entity';
import { Rol } from '../auth/entities/rol.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Usuario, Rol], 'SEGURIDAD_DB')],
  controllers: [UsuariosController],
  providers: [UsuariosService],
  exports: [UsuariosService],
})
export class UsuariosModule { }