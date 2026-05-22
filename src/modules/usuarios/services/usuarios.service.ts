// src/modules/usuarios/services/usuarios.service.ts
import {
    Injectable,
    NotFoundException,
    ConflictException,
    BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, In } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Usuario } from '../../auth/entities/usuario.entity';
import { Rol } from '../../auth/entities/rol.entity';
import {
    CreateUsuarioDto,
    UpdateUsuarioDto,
    QueryUsuariosDto,
    UsuarioResponseDto,
    PaginatedUsuariosResponseDto,
} from '../dto';
import { plainToInstance } from 'class-transformer';

@Injectable()
export class UsuariosService {
    constructor(
        @InjectRepository(Usuario,'SEGURIDAD_DB')
        private readonly usuarioRepository: Repository<Usuario>,
        @InjectRepository(Rol,'SEGURIDAD_DB')
        private readonly rolRepository: Repository<Rol>,
    ) { }

    async create(createUsuarioDto: CreateUsuarioDto): Promise<UsuarioResponseDto> {
        // Verificar si el email ya existe
        const existingEmail = await this.usuarioRepository.findOne({
            where: { email: createUsuarioDto.email },
        });
        if (existingEmail) {
            throw new ConflictException('El email ya está registrado');
        }


        // Hash de la contraseña
        const passwordHash = await bcrypt.hash(createUsuarioDto.password, 10);

        // Crear usuario
        const usuario = this.usuarioRepository.create({
            nombre: createUsuarioDto.nombre,
            email: createUsuarioDto.email,
            passwordHash,
            estado: createUsuarioDto.estado || 'activo',
        });

        // Asignar roles si existen
        if (createUsuarioDto.roleIds && createUsuarioDto.roleIds.length > 0) {
            const roles = await this.rolRepository.findBy({
                idRol: In(createUsuarioDto.roleIds),
            });
            if (roles.length !== createUsuarioDto.roleIds.length) {
                throw new BadRequestException('Uno o más roles no existen');
            }
            usuario.roles = roles;
        }

        const savedUsuario = await this.usuarioRepository.save(usuario);
        return this.toResponseDto(await this.findOne(savedUsuario.idUsuario));
    }

    async findAll(
        query: QueryUsuariosDto,
    ): Promise<PaginatedUsuariosResponseDto> {
        const { page, limit, search, estado, sortBy, sortOrder } = query;

        const queryBuilder = this.usuarioRepository
            .createQueryBuilder('usuario')
            .leftJoinAndSelect('usuario.roles', 'roles');

        // Filtro de búsqueda
        if (search) {
            queryBuilder.andWhere(
                '(usuario.nombre LIKE :search OR usuario.email LIKE :search OR usuario.cedula LIKE :search)',
                { search: `%${search}%` },
            );
        }

        // Filtro por estado
        if (estado) {
            queryBuilder.andWhere('usuario.estado = :estado', { estado });
        }

        // Ordenamiento
        queryBuilder.orderBy(`usuario.${sortBy}`, sortOrder);


        if (!limit || limit <= 0) {
            throw new BadRequestException('El límite debe ser un número positivo mayor que cero');
        }
        if (!page || page <= 0) {
            throw new BadRequestException('La página debe ser un número positivo mayor que cero');
        }

        // Paginación
        const skip = (page - 1) * limit;
        queryBuilder.skip(skip).take(limit);

        const [usuarios, total] = await queryBuilder.getManyAndCount();

        const totalPages = Math.ceil(total / limit);

        return {
            data: usuarios.map((usuario) => this.toResponseDto(usuario)),
            meta: {
                page,
                limit,
                total,
                totalPages,
                hasNextPage: page < totalPages,
                hasPreviousPage: page > 1,
            },
        };
    }

    async findOne(id: number): Promise<Usuario> {
        const usuario = await this.usuarioRepository.findOne({
            where: { idUsuario: id },
            relations: ['roles'],
        });

        if (!usuario) {
            throw new NotFoundException(`Usuario con ID ${id} no encontrado`);
        }

        return usuario;
    }

    async update(
        id: number,
        updateUsuarioDto: UpdateUsuarioDto,
    ): Promise<UsuarioResponseDto> {
        const usuario = await this.findOne(id);

        // Verificar email único (si se está actualizando)
        if (updateUsuarioDto.email && updateUsuarioDto.email !== usuario.email) {
            const existingEmail = await this.usuarioRepository.findOne({
                where: { email: updateUsuarioDto.email },
            });
            if (existingEmail) {
                throw new ConflictException('El email ya está registrado');
            }
        }



        // Actualizar contraseña si se proporciona
        if (updateUsuarioDto.password) {
            usuario.passwordHash = await bcrypt.hash(updateUsuarioDto.password, 10);
        }

        // Actualizar roles si se proporcionan
        if (updateUsuarioDto.roleIds) {
            const roles = await this.rolRepository.findBy({
                idRol: In(updateUsuarioDto.roleIds),
            });
            if (roles.length !== updateUsuarioDto.roleIds.length) {
                throw new BadRequestException('Uno o más roles no existen');
            }
            usuario.roles = roles;
        }

        // Actualizar otros campos
        Object.assign(usuario, {
            nombre: updateUsuarioDto.nombre ?? usuario.nombre,
            email: updateUsuarioDto.email ?? usuario.email,
            estado: updateUsuarioDto.estado ?? usuario.estado,
        });

        await this.usuarioRepository.save(usuario);
        return this.toResponseDto(await this.findOne(id));
    }

    async remove(id: number): Promise<void> {
        const usuario = await this.findOne(id);
        await this.usuarioRepository.remove(usuario);
    }

    async changeStatus(
        id: number,
        estado: string,
    ): Promise<UsuarioResponseDto> {
        const usuario = await this.findOne(id);
        usuario.estado = estado;
        await this.usuarioRepository.save(usuario);
        return this.toResponseDto(usuario);
    }

    private toResponseDto(usuario: Usuario): UsuarioResponseDto {
        return plainToInstance(UsuarioResponseDto, usuario, {
            excludeExtraneousValues: true,
        });
    }
}