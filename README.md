# MoraCero - Backend

Este repositorio contiene el **backend oficial de MoraCero**, construido con NestJS. Está diseñado para gestionar de manera centralizada la seguridad, la autenticación, la autorización y la administración general de la plataforma.

## 🚀 Características Principales

- **Autenticación Segura:** Implementación de JWT y Refresh tokens.
- **Control de Accesos:** Gestión robusta de usuarios, roles y permisos.
- **Gestión de Cuentas:** Sistema de recuperación de contraseñas mediante correo electrónico.
- **Base de Datos:** Integración avanzada con PostgreSQL a través de TypeORM.
- **Módulo de Códigos QR:** Generación, asignación y escaneo de códigos QR.
- **Datos Iniciales:** Migraciones y seeders listos para poblar datos base de manera automática.

## 🛠️ Stack Tecnológico

- **Entorno de Ejecución:** Node.js (>= 20)
- **Framework:** NestJS
- **Lenguaje:** TypeScript
- **Base de Datos:** PostgreSQL
- **ORM:** TypeORM
- **Seguridad:** JWT, Passport
- **Testing:** Jest
- **Gestor de Paquetes:** pnpm

## 📋 Requisitos Previos

Asegúrate de tener instalado en tu entorno local:
- [Node.js](https://nodejs.org/) (versión 20 o superior)
- [pnpm](https://pnpm.io/) (gestor de paquetes recomendado)
- [PostgreSQL](https://www.postgresql.org/)

## ⚙️ Instalación y Configuración

1. **Clonar e instalar dependencias:**
   ```bash
   cd app_registro
   pnpm install
   ```

2. **Variables de Entorno:**
   Crea un archivo `.env` en la raíz del proyecto copiando las variables necesarias. Al menos debes configurar lo siguiente:

   ```env
   SEGURIDAD_DB_HOST=localhost
   SEGURIDAD_DB_PORT=5432
   SEGURIDAD_DB_USER=tu_usuario
   SEGURIDAD_DB_PASS=tu_contraseña
   SEGURIDAD_DB_NAME=tu_base_de_datos
   
   # Opcional: Soporte para conexiones directas del data source de TypeORM
   SEGURIDAD_DB_DIRECT_HOST=localhost
   SEGURIDAD_DB_DIRECT_PORT=5432
   SEGURIDAD_DB_DIRECT_USER=tu_usuario
   ```

3. **Preparar la Base de Datos:**
   El proyecto incluye un comando para ejecutar las migraciones y los seeders automáticamente.
   ```bash
   pnpm db:setup
   ```
   > 💡 `pnpm db:setup` ejecuta las migraciones necesarias y luego inserta los datos iniciales (seeders) de usuarios y roles.

## 💻 Uso y Comandos Disponibles

Para iniciar el servidor, utiliza uno de los siguientes comandos según tu entorno:

```bash
# Desarrollo
pnpm start:dev

# Producción
pnpm build
pnpm start:prod

# Básico
pnpm start
```

### Comandos de Base de Datos y Migraciones

```bash
pnpm migration:create -- <NombreDeLaMigracion> # Crear una nueva migración
pnpm migration:run                             # Ejecutar migraciones pendientes
pnpm migration:revert                          # Revertir la última migración
pnpm migration:show                            # Mostrar el estado de las migraciones
pnpm seed                                      # Ejecutar solo los seeders
```

### Pruebas (Testing)

```bash
pnpm test          # Ejecutar pruebas unitarias
pnpm test:watch    # Modo observación
pnpm test:cov      # Reporte de cobertura
pnpm test:debug    # Modo depuración
```

## 📂 Estructura del Proyecto

- `src/app.module.ts` - Archivo raíz y configuración principal de NestJS.
- `src/database/` - Configuración de TypeORM, junto con las migraciones y seeders.
- `src/modules/auth/` - Lógica de autenticación, guards, estrategias de Passport, servicios y entidades.
- `src/modules/usuarios/` - Endpoints y lógica de gestión de usuarios.
- `src/modules/roles/` - Endpoints y lógica de gestión de roles.
- `src/modules/qr/` - Generación y gestión de funcionalidades QR.

## 📝 Notas Adicionales

- Este proyecto está pensado para gestionarse exclusivamente con **pnpm**.
- En `src/config/seguridadDS.config.ts` y `src/database/database.module.ts` (con `TypeOrmModule.forRootAsync`) está la configuración principal de la base de datos.
- Por defecto, la sincronización automática de TypeORM (`synchronize`) está desactivada (`false`) y se confía en las migraciones para estructurar la BD. Además, `ssl.rejectUnauthorized` está en `false`.
- Asegúrate de que el servicio de PostgreSQL local esté accesible mediante los datos configurados en tu `.env`.
