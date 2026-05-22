// src/modules/usuarios/dto/query-usuarios.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsNumber, Min, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';

export class QueryUsuariosDto {
  @ApiProperty({
    description: 'Número de página',
    example: 1,
    required: false,
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiProperty({
    description: 'Cantidad de registros por página',
    example: 10,
    required: false,
    default: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number = 10;

  @ApiProperty({
    description: 'Buscar por nombre, email o cédula',
    example: 'Juan',
    required: false,
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiProperty({
    description: 'Filtrar por estado',
    example: 'activo',
    enum: ['activo', 'inactivo', 'suspendido'],
    required: false,
  })
  @IsOptional()
  @IsEnum(['activo', 'inactivo', 'suspendido'])
  estado?: string;

  @ApiProperty({
    description: 'Ordenar por campo',
    example: 'nombre',
    enum: ['nombre', 'email', 'createdAt'],
    required: false,
    default: 'createdAt',
  })
  @IsOptional()
  @IsEnum(['nombre', 'email', 'createdAt'])
  sortBy?: string = 'createdAt';

  @ApiProperty({
    description: 'Dirección del ordenamiento',
    example: 'DESC',
    enum: ['ASC', 'DESC'],
    required: false,
    default: 'DESC',
  })
  @IsOptional()
  @IsEnum(['ASC', 'DESC'])
  sortOrder?: 'ASC' | 'DESC' = 'DESC';
}