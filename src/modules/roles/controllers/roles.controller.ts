// src/modules/roles/controllers/roles.controller.ts
import {
  Controller,
  Get,
  Param,
  Query,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { RolesService } from '../services/roles.service';
import { RolResponseDto, RolDetalleResponseDto, QueryRolesDto } from '../dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';

@ApiTags('Roles')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  @Roles('admin')
  @ApiOperation({ 
    summary: 'Obtener lista de roles (Solo Admin)',
    description: 'Retorna todos los roles del sistema con opción de búsqueda'
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de roles obtenida exitosamente',
    type: [RolResponseDto],
  })
  @ApiResponse({ 
    status: 401, 
    description: 'No autorizado' 
  })
  @ApiResponse({ 
    status: 403, 
    description: 'Acceso denegado - Se requiere rol de administrador' 
  })
  findAll(@Query() query: QueryRolesDto): Promise<RolResponseDto[]> {
    return this.rolesService.findAll(query);
  }

  @Get('activos')
  @Roles('admin')
  @ApiOperation({ 
    summary: 'Obtener roles activos (Solo Admin)',
    description: 'Retorna todos los roles activos ordenados alfabéticamente. Útil para selects y dropdowns.'
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de roles activos obtenida exitosamente',
    type: [RolResponseDto],
  })
  @ApiResponse({ 
    status: 401, 
    description: 'No autorizado' 
  })
  @ApiResponse({ 
    status: 403, 
    description: 'Acceso denegado - Se requiere rol de administrador' 
  })
  findAllActive(): Promise<RolResponseDto[]> {
    return this.rolesService.findAllActive();
  }

  @Get(':id')
  @Roles('admin')
  @ApiOperation({ 
    summary: 'Obtener un rol por ID con sus permisos (Solo Admin)',
    description: 'Retorna los detalles completos de un rol incluyendo sus permisos asociados'
  })
  @ApiParam({ 
    name: 'id', 
    description: 'ID del rol', 
    example: 1,
    type: Number
  })
  @ApiResponse({
    status: 200,
    description: 'Rol encontrado',
    type: RolDetalleResponseDto,
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Rol no encontrado' 
  })
  @ApiResponse({ 
    status: 401, 
    description: 'No autorizado' 
  })
  @ApiResponse({ 
    status: 403, 
    description: 'Acceso denegado - Se requiere rol de administrador' 
  })
  findOne(@Param('id', ParseIntPipe) id: number): Promise<RolDetalleResponseDto> {
    return this.rolesService.findOne(id);
  }
}
