import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';

// Entidades
import { Usuario } from '@/modules/auth/entities/usuario.entity';
import { Rol } from '@/modules/auth/entities/rol.entity';

export class CreateUsersSeeder {
    public async run(dataSource: DataSource): Promise<void> {
        const usuarioRepo = dataSource.getRepository(Usuario);
        const rolRepo = dataSource.getRepository(Rol);

        // Buscar roles ya creados previamente
        const adminRole = await rolRepo.findOne({
            where: { nombre: 'admin' },
            relations: ['permisos'],     // << ESTA ES LA CLAVE
        });
        const userRole = await rolRepo.findOne({
            where: { nombre: 'user' },
            relations: ['permisos'],
        });

        const moderatorRole = await rolRepo.findOne({
            where: { nombre: 'moderator' },
            relations: ['permisos'],
        });

        if (!adminRole || !userRole || !moderatorRole) {
            throw new Error('Error: Los roles admin, user y moderator deben existir antes de ejecutar este seeder.');
        }

        // Función utilitaria interna para crear usuario
        const createUser = async (
            nombre: string,
            email: string,
            password: string,
            roles: Rol[],
        ) => {
            const existente = await usuarioRepo.findOne({ where: { email } });
            if (existente) {
                console.log(`Usuario ${email} ya existe. Omitiendo...`);
                return;
            }

            const passwordHash = await bcrypt.hash(password, 10);

            const nuevoUsuario = usuarioRepo.create({
                nombre,
                email,
                passwordHash,
                estado: 'activo',
                roles,
            });

            await usuarioRepo.save(nuevoUsuario);

            console.log(`Usuario creado: ${email}`);
        };

        // Crear usuarios
        await createUser('Administrador del sistema', 'admin@sistema.com', 'admin123', [adminRole]);
        await createUser('Usuario estándar del sistema', 'user@sistema.com', 'user123', [userRole]);
        await createUser('Moderador del sistema', 'moderator@sistema.com', 'moderator123', [moderatorRole]);

        console.log('Seeder de usuarios ejecutado correctamente.');
    }
}
