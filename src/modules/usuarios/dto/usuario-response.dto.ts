// src/modules/usuarios/dto/usuario-response.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose, Type } from 'class-transformer';
import { RolResponseDto } from '@/modules/roles/dto/rol-response.dto'; // ✅ importar en lugar de redefinir



export class UsuarioResponseDto {
  @ApiProperty({ example: 1 })
  @Expose()
  idUsuario: number;

  @ApiProperty({ example: 'Juan Pérez' })
  @Expose()
  nombre: string;

  @ApiProperty({ example: '1234567890' } )
  @Expose()
  cedula: string;

  @ApiProperty({ example: 'usuario@ejemplo.com' })
  @Expose()
  email: string;

  @ApiProperty({ example: 'activo' })
  @Expose()
  estado: string;

  @ApiProperty({ type: [RolResponseDto] })
  @Expose()
  @Type(() => RolResponseDto)
  roles: RolResponseDto[];

  @ApiProperty({ example: '2024-01-15T10:30:00.000Z' })
  @Expose()
  createdAt: Date;

  @ApiProperty({ example: '2024-01-15T10:30:00.000Z' })
  @Expose()
  updatedAt: Date;

  @Exclude()
  passwordHash: string;

  @Exclude()
  tokens: any;

  @Exclude()
  sesiones: any;
}