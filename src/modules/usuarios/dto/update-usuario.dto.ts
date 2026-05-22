// src/modules/usuarios/dto/update-usuario.dto.ts
import { PartialType, OmitType, ApiProperty } from '@nestjs/swagger';
import { CreateUsuarioDto } from './create-usuario.dto';

export class UpdateUsuarioDto extends PartialType(
  OmitType(CreateUsuarioDto, ['password'] as const),
) {
  @ApiProperty({
    description: 'Nueva contraseña del usuario (opcional)',
    example: 'NuevaPassword123!',
    required: false,
    minLength: 8,
  })
  password?: string;
}