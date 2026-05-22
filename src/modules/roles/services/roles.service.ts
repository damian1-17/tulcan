// src/modules/roles/services/roles.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Rol } from '../../auth/entities/rol.entity';
import { RolResponseDto, RolDetalleResponseDto, QueryRolesDto } from '../dto/index';

import { plainToInstance } from 'class-transformer';

@Injectable()
export class RolesService {
  constructor(
    @InjectRepository(Rol, 'SEGURIDAD_DB')
    private readonly rolRepository: Repository<Rol>,
  ) {}

  /**
   * Obtener todos los roles con búsqueda opcional
   */
  async findAll(query: QueryRolesDto): Promise<RolResponseDto[]> {
    const { search } = query;

    const queryBuilder = this.rolRepository.createQueryBuilder('rol');

    // Filtro de búsqueda
    if (search) {
      queryBuilder.where(
        '(rol.nombre LIKE :search OR rol.descripcion LIKE :search)',
        { search: `%${search}%` },
      );
    }

    // Ordenar por nombre
    queryBuilder.orderBy('rol.nombre', 'ASC');

    const roles = await queryBuilder.getMany();

    return roles.map((rol) => this.toResponseDto(rol));
  }

  /**
   * Obtener un rol por ID con sus permisos
   */
  async findOne(id: number): Promise<RolDetalleResponseDto> {
    const rol = await this.rolRepository.findOne({
      where: { idRol: id },
      relations: ['permisos'],
    });

    if (!rol) {
      throw new NotFoundException(`Rol con ID ${id} no encontrado`);
    }

    return this.toDetalleResponseDto(rol);
  }

  /**
   * Obtener solo los roles activos (útil para selects)
   */
  async findAllActive(): Promise<RolResponseDto[]> {
    const roles = await this.rolRepository.find({
      order: { nombre: 'ASC' },
    });

    return roles.map((rol) => this.toResponseDto(rol));
  }

  /**
   * Transformar entidad a DTO simple
   */
  private toResponseDto(rol: Rol): RolResponseDto {
    return plainToInstance(RolResponseDto, rol, {
      excludeExtraneousValues: true,
    });
  }

  /**
   * Transformar entidad a DTO con detalles
   */
  private toDetalleResponseDto(rol: Rol): RolDetalleResponseDto {
    return plainToInstance(RolDetalleResponseDto, rol, {
      excludeExtraneousValues: true,
    });
  }
}