// src/modules/roles/dto/rol-response.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

export class PermisoSimpleDto {
  @ApiProperty({ example: 1 })
  @Expose()
  idPermiso: number;

  @ApiProperty({ example: 'crear_usuario' })
  @Expose()
  nombre: string;

  @ApiProperty({ example: 'Permite crear nuevos usuarios' })
  @Expose()
  descripcion: string;
}

export class RolResponseDto {
  @ApiProperty({ 
    description: 'ID del rol',
    example: 1 
  })
  @Expose()
  idRol: number;

  @ApiProperty({ 
    description: 'Nombre del rol',
    example: 'Administrador' 
  })
  @Expose()
  nombre: string;

  @ApiProperty({ 
    description: 'Descripción del rol',
    example: 'Acceso completo al sistema' 
  })
  @Expose()
  descripcion: string;

  @ApiProperty({ 
    description: 'Fecha de creación',
    example: '2024-01-15T10:30:00.000Z' 
  })
  @Expose()
  createdAt: Date;

  @ApiProperty({ 
    description: 'Fecha de última actualización',
    example: '2024-01-15T10:30:00.000Z' 
  })
  @Expose()
  updatedAt: Date;
}

export class RolDetalleResponseDto extends RolResponseDto {
  @ApiProperty({ 
    description: 'Lista de permisos asociados al rol',
    type: [PermisoSimpleDto],
    required: false
  })
  @Expose()
  permisos?: PermisoSimpleDto[];
}