// src/modules/roles/roles.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RolesController } from '@/modules/roles/controllers/roles.controller';
import { RolesService } from '@/modules/roles/services/roles.service';
import { Rol } from '../auth/entities/rol.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Rol], 'SEGURIDAD_DB')],
  controllers: [RolesController],
  providers: [RolesService],
  exports: [RolesService],
})
export class RolesModule { }