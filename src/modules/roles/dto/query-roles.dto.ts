// src/modules/roles/dto/query-roles.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class QueryRolesDto {
  @ApiProperty({
    description: 'Buscar por nombre o descripción',
    example: 'admin',
    required: false,
  })
  @IsOptional()
  @IsString()
  search?: string;
}