// src/modules/usuarios/dto/create-usuario.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MinLength,
  MaxLength,
  Matches,
  IsArray,
  IsOptional,
  IsNumber,
} from 'class-validator';

export class CreateUsuarioDto {
  @ApiProperty({
    description: 'Nombre completo del usuario',
    example: 'Juan Pérez',
    maxLength: 50,
  })
  @IsNotEmpty({ message: 'El nombre es requerido' })
  @IsString()
  @MaxLength(50, { message: 'El nombre no puede exceder 50 caracteres' })
  nombre: string;

  @ApiProperty({
    description: 'Número de cédula del usuario',
    example: '1234567890',
    maxLength: 10,
  })
  @IsNotEmpty({ message: 'La cédula es requerida' })
  @IsString()
  @MaxLength(10, { message: 'La cédula no puede exceder 10 caracteres' })
  @Matches(/^[0-9]+$/, { message: 'La cédula solo debe contener números' })
  cedula: string;

  @ApiProperty({
    description: 'Correo electrónico del usuario',
    example: 'usuario@ejemplo.com',
    maxLength: 80,
  })
  @IsNotEmpty({ message: 'El email es requerido' })
  @IsEmail({}, { message: 'Debe ser un email válido' })
  @MaxLength(80, { message: 'El email no puede exceder 80 caracteres' })
  email: string;

  @ApiProperty({
    description: 'Contraseña del usuario (mínimo 8 caracteres)',
    example: 'Password123!',
    minLength: 8,
  })
  @IsNotEmpty({ message: 'La contraseña es requerida' })
  @IsString()
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  password: string;

  @ApiProperty({
    description: 'Estado del usuario',
    example: 'activo',
    enum: ['activo', 'inactivo', 'suspendido'],
    default: 'activo',
    required: false,
  })
  @IsOptional()
  @IsString()
  estado?: string;

  @ApiProperty({
    description: 'IDs de los roles asignados al usuario',
    example: [1, 2],
    type: [Number],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  roleIds?: number[];
}