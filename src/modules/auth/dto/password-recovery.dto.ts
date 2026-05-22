import { IsEmail, IsString, MinLength, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO para solicitar recuperación de contraseña
 */
export class RequestPasswordRecoveryDto {
  @ApiProperty({
    description: 'Email del usuario',
    example: 'dddelacruzc@utn.edu.ec',
  })
  @IsEmail({}, { message: 'El email debe ser válido' })
  email: string;
}

/**
 * DTO para restablecer la contraseña con el código
 */
export class ResetPasswordDto {
  @ApiProperty({
    description: 'Email del usuario',
    example: 'dddelacruzc@utn.edu.ec',
  })
  @IsEmail({}, { message: 'El email debe ser válido' })
  email: string;

  @ApiProperty({
    description: 'Código de recuperación enviado por email',
    example: '123456',
  })
  @IsString()
  @MinLength(6, { message: 'El código debe tener al menos 6 caracteres' })
  code: string;

  @ApiProperty({
    description: 'Nueva contraseña',
    example: 'NuevaPassword123!',
    minLength: 8,
  })
  @IsString()
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message: 'La contraseña debe contener al menos una mayúscula, una minúscula y un número',
  })
  newPassword: string;
}