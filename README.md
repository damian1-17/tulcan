# Security Module

Proyecto backend construido con NestJS para gestión de seguridad, autenticación y autorización en una aplicación.

## Descripción

Este repositorio contiene un módulo de seguridad con:
- Autenticación JWT
- Refresh tokens
- Gestión de usuarios, roles y permisos
- Recuperación de contraseña por correo
- Integración con PostgreSQL mediante TypeORM
- Módulo de códigos QR para asignación y escaneo
- Migraciones y seeders para inicializar datos

## Tecnologías

- Node.js
- NestJS
- TypeScript
- PostgreSQL
- TypeORM
- JWT
- Passport
- Jest

## Requisitos

- Node.js >= 20
- pnpm
- PostgreSQL

## Instalación

```bash
cd security_module
pnpm install
```

## Variables de entorno

Crea un archivo `.env` en la raíz del proyecto con al menos las siguientes variables:

```bash
SEGURIDAD_DB_HOST=localhost
SEGURIDAD_DB_PORT=5432
SEGURIDAD_DB_USER=tu_usuario
SEGURIDAD_DB_PASS=tu_contraseña
SEGURIDAD_DB_NAME=tu_base_de_datos
```

También se soportan variables directas para el data source de TypeORM:

```bash
SEGURIDAD_DB_DIRECT_HOST=localhost
SEGURIDAD_DB_DIRECT_PORT=5432
SEGURIDAD_DB_DIRECT_USER=tu_usuario
```

## Comandos disponibles

```bash
pnpm build
pnpm start
pnpm start:dev
pnpm start:prod
pnpm test
pnpm test:watch
pnpm test:cov
pnpm test:debug
```

## Migraciones y base de datos

```bash
pnpm migration:create -- <NombreDeLaMigracion>
pnpm migration:run
pnpm migration:revert
pnpm migration:show
pnpm seed
pnpm db:setup
```

> `pnpm db:setup` ejecuta migraciones y luego corre los seeders.

## Estructura principal

- `src/app.module.ts` - Configuración principal de NestJS
- `src/database/` - Configuración de TypeORM, migraciones y seeders
- `src/modules/auth/` - Autenticación, autorizaciones, guards, estrategias, servicios y entidades
- `src/modules/usuarios/` - Gestión de usuarios
- `src/modules/roles/` - Gestión de roles
- `src/modules/qr/` - Funcionalidad de códigos QR

## Configuración de base de datos

El proyecto usa `TypeOrmModule.forRootAsync` en `src/database/database.module.ts` y el archivo de configuración `src/config/seguridadDS.config.ts`.

- Base de datos: PostgreSQL
- `synchronize`: false
- `ssl.rejectUnauthorized`: false

## Uso

1. Configura las variables de entorno.
2. Instala dependencias: `pnpm install`.
3. Prepara la base de datos: `pnpm db:setup`.
4. Inicia en modo desarrollo: `pnpm start:dev`.

## Pruebas

```bash
pnpm test
pnpm test:watch
pnpm test:cov
```

## Notas

- El proyecto está pensado para ejecutarse con `pnpm`.
- Asegúrate de que PostgreSQL esté accesible desde las variables de entorno configuradas.
- Las migraciones se encuentran en `src/database/migrations`.
- Los seeders iniciales de usuarios y roles están en `src/database/seeders`.
