import { DataSource } from 'typeorm';
import { Rol } from '@/modules/auth/entities/rol.entity';
import { Permiso } from '@/modules/auth/entities/permiso.entity';

export async function seedInitialData(dataSource: DataSource) {
  const rolRepository = dataSource.getRepository(Rol);
  const permisoRepository = dataSource.getRepository(Permiso);

  console.log('🌱 Iniciando seeding inicial...');

  // ----------------------------
  // 1. Definir lista de permisos
  // ----------------------------
  const permisos = [
    // Usuarios
    { clave: 'users:read', descripcion: 'Leer usuarios' },
    { clave: 'users:create', descripcion: 'Crear usuarios' },
    { clave: 'users:update', descripcion: 'Actualizar usuarios' },
    { clave: 'users:delete', descripcion: 'Eliminar usuarios' },

    // Roles
    { clave: 'roles:read', descripcion: 'Leer roles' },
    { clave: 'roles:create', descripcion: 'Crear roles' },
    { clave: 'roles:update', descripcion: 'Actualizar roles' },
    { clave: 'roles:delete', descripcion: 'Eliminar roles' },

    // Permisos
    { clave: 'permissions:read', descripcion: 'Leer permisos' },
    { clave: 'permissions:create', descripcion: 'Crear permisos' },
    { clave: 'permissions:update', descripcion: 'Actualizar permisos' },
    { clave: 'permissions:delete', descripcion: 'Eliminar permisos' },

    // Productos
    { clave: 'products:read', descripcion: 'Leer productos' },
    { clave: 'products:create', descripcion: 'Crear productos' },
    { clave: 'products:update', descripcion: 'Actualizar productos' },
    { clave: 'products:delete', descripcion: 'Eliminar productos' },

    // Pedidos
    { clave: 'orders:read', descripcion: 'Leer pedidos' },
    { clave: 'orders:create', descripcion: 'Crear pedidos' },
    { clave: 'orders:update', descripcion: 'Actualizar pedidos' },
    { clave: 'orders:delete', descripcion: 'Eliminar pedidos' },
  ];

  // -------------------------------------
  // 2. Insertar permisos si no existen
  // -------------------------------------
  for (const permisoData of permisos) {
    const exists = await permisoRepository.findOne({
      where: { clave: permisoData.clave },
    });

    if (!exists) {
      const permiso = permisoRepository.create(permisoData);
      await permisoRepository.save(permiso);
      console.log(`  ✔ Permiso creado: ${permisoData.clave}`);
    }
  }

  // Recuperar permisos actualizados
  const allPermisos = await permisoRepository.find();

  console.log(`🔎 Total permisos registrados: ${allPermisos.length}`);

  // -------------------------
  // 3. Crear roles base
  // -------------------------

  // ADMIN – acceso total
  if (!(await rolRepository.findOne({ where: { nombre: 'admin' } }))) {
    await rolRepository.save(
      rolRepository.create({
        nombre: 'admin',
        descripcion: 'Administrador del sistema con acceso total',
        permisos: allPermisos,      // OK: esto asigna todos los permisos
      }),
    );

    console.log('  ✔ Rol creado: admin');
  }

  // USER – solo lectura
  if (!(await rolRepository.findOne({ where: { nombre: 'user' } }))) {
    await rolRepository.save(
      rolRepository.create({
        nombre: 'user',
        descripcion: 'Usuario estándar del sistema',
        permisos: allPermisos.filter(p => p.clave.includes('read')),
      }),
    );
    console.log('  ✔ Rol creado: user');
  }

  // MODERATOR – lectura y actualización
  if (!(await rolRepository.findOne({ where: { nombre: 'moderator' } }))) {
    await rolRepository.save(
      rolRepository.create({
        nombre: 'moderator',
        descripcion: 'Moderador con permisos intermedios',
        permisos: allPermisos.filter(
          p => p.clave.includes('read') || p.clave.includes('update'),
        ),
      }),
    );
    console.log('  ✔ Rol creado: moderator');
  }

  console.log('🎉 Seeding inicial completado!');
}
