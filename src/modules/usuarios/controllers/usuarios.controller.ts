// src/modules/usuarios/controllers/usuarios.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { UsuariosService } from '../services/usuarios.service';
import {
  CreateUsuarioDto,
  UpdateUsuarioDto,
  UsuarioResponseDto,
  QueryUsuariosDto,
  PaginatedUsuariosResponseDto,
} from '../dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';

@ApiTags('Usuarios')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('usuarios')
export class UsuariosController {
  constructor(private readonly usuariosService: UsuariosService) {}

  @Post()
  @Roles('admin')
  @ApiOperation({ summary: 'Crear un nuevo usuario (Solo Admin)' })
  @ApiResponse({
    status: 201,
    description: 'Usuario creado exitosamente',
    type: UsuarioResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  @ApiResponse({ status: 409, description: 'Email o cédula ya registrados' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  @ApiResponse({ status: 403, description: 'Acceso denegado' })
  create(
    @Body() createUsuarioDto: CreateUsuarioDto,
  ): Promise<UsuarioResponseDto> {
    return this.usuariosService.create(createUsuarioDto);
  }

  @Get()
  @Roles('admin','SUPERVISOR','VENDEDOR')
  @ApiOperation({ summary: 'Obtener lista de usuarios con paginación (Solo Admin, Supervisor VENDEDOR)' })
  @ApiResponse({
    status: 200,
    description: 'Lista de usuarios obtenida exitosamente',
    type: PaginatedUsuariosResponseDto,
  })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  @ApiResponse({ status: 403, description: 'Acceso denegado' })
  findAll(@Query() query: QueryUsuariosDto): Promise<PaginatedUsuariosResponseDto> {
    return this.usuariosService.findAll(query);
  }

  @Get(':id')
  @Roles('admin','SUPERVISOR','VENDEDOR')
  @ApiOperation({ summary: 'Obtener un usuario por ID (Solo Admin o Supervisor)' })
  @ApiParam({ name: 'id', description: 'ID del usuario', example: 1 })
  @ApiResponse({
    status: 200,
    description: 'Usuario encontrado',
    type: UsuarioResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Usuario no encontrado' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  @ApiResponse({ status: 403, description: 'Acceso denegado' })
  async findOne(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<UsuarioResponseDto> {
    const usuario = await this.usuariosService.findOne(id);
    return this.usuariosService['toResponseDto'](usuario);
  }

  @Patch(':id')
  @Roles('admin')
  @ApiOperation({ summary: 'Actualizar un usuario (Solo Admin)' })
  @ApiParam({ name: 'id', description: 'ID del usuario', example: 1 })
  @ApiResponse({
    status: 200,
    description: 'Usuario actualizado exitosamente',
    type: UsuarioResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  @ApiResponse({ status: 404, description: 'Usuario no encontrado' })
  @ApiResponse({ status: 409, description: 'Email o cédula ya registrados' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  @ApiResponse({ status: 403, description: 'Acceso denegado' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateUsuarioDto: UpdateUsuarioDto,
  ): Promise<UsuarioResponseDto> {
    return this.usuariosService.update(id, updateUsuarioDto);
  }

  @Delete(':id')
  @Roles('admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar un usuario (Solo Admin)' })
  @ApiParam({ name: 'id', description: 'ID del usuario', example: 1 })
  @ApiResponse({ status: 204, description: 'Usuario eliminado exitosamente' })
  @ApiResponse({ status: 404, description: 'Usuario no encontrado' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  @ApiResponse({ status: 403, description: 'Acceso denegado' })
  remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.usuariosService.remove(id);
  }

  @Patch(':id/estado')
  @Roles('admin')
  @ApiOperation({ summary: 'Cambiar estado de un usuario (Solo Admin)' })
  @ApiParam({ name: 'id', description: 'ID del usuario', example: 1 })
  @ApiQuery({
    name: 'estado',
    description: 'Nuevo estado del usuario',
    enum: ['activo', 'inactivo', 'suspendido'],
    example: 'inactivo',
  })
  @ApiResponse({
    status: 200,
    description: 'Estado actualizado exitosamente',
    type: UsuarioResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Usuario no encontrado' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  @ApiResponse({ status: 403, description: 'Acceso denegado' })
  changeStatus(
    @Param('id', ParseIntPipe) id: number,
    @Query('estado') estado: string,
  ): Promise<UsuarioResponseDto> {
    return this.usuariosService.changeStatus(id, estado);
  }
}