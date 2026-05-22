import { IsEmail, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'dddelacruzc@utn.edu.ec' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'NuevaPassword123!' })
  @IsString()
  @MinLength(6)
  password: string;
}