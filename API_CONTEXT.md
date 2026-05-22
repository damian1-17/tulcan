# Contexto Backend para Front

## Resumen ejecutivo

Esta app base es un backend NestJS con prefijo global `api/v1` y 4 áreas principales:

- `auth`: registro, login, sesión por cookies, perfil y recuperación de contraseña.
- `usuarios`: CRUD de usuarios con paginación.
- `roles`: consulta de roles y detalle con permisos.
- `qr`: catálogo de tipos QR, asignación a usuarios y validación por escaneo.

Base URL local esperada:

```txt
http://localhost:3000/api/v1
```

Swagger:

```txt
http://localhost:3000/api/docs
```

## Cómo autentica

La autenticación principal usa cookies, no tokens en el body.

- Cookie de acceso: `accessToken`
- Cookie de refresh: `refreshToken`
- Ambas son `HttpOnly`
- Ambas están configuradas con `secure: true`
- Ambas usan `sameSite: 'none'`

Implicaciones para el front:

- Todas las requests autenticadas deben enviarse con credenciales.
- En `fetch` hay que usar `credentials: 'include'`.
- En Axios hay que usar `withCredentials: true`.
- En local sin HTTPS estas cookies podrían no persistir correctamente porque `secure` está fijo en `true`.

También existe fallback por header `Authorization: Bearer ...` para el access token, pero el diseño principal del proyecto está pensado para cookies.

## Infraestructura HTTP

- Prefijo global: `/api/v1`
- Assets estáticos: `/assets/*`
- Validación global:
  - `whitelist: true`
  - `forbidNonWhitelisted: true`
  - `transform: true`
- CORS habilitado con `credentials: true`
- Orígenes explícitamente permitidos:
  - `https://front-pedidos-vue.vercel.app`
  - `http://localhost:3000`
  - `http://localhost:4200`
  - `https://front-pedidos-vue-zgyj.vercel.app`
  - `https://frontpedidosvue.onrender.com`

## Guards y control de acceso

Hay guards globales en `AppModule`:

- `JwtAuthGuard`
- `RolesGuard`
- `PermissionsGuard`

Comportamiento real:

- Todas las rutas son privadas por defecto.
- Las rutas marcadas con `@Public()` sí permiten acceso anónimo.
- Los roles se validan con el array `user.roles`.
- Los permisos se validan con el array `user.permissions`.

Observación importante:

- En el módulo `qr` los guards y decorators de roles están comentados. Hoy esos endpoints parecen públicos a nivel de controlador, aunque Swagger los marque como autenticados.

## Modelo funcional

### Auth

- Registra usuarios.
- Inicia sesión.
- Refresca tokens.
- Cierra sesión.
- Devuelve perfil actual.
- Permite cambiar contraseña estando autenticado.
- Permite recuperación de contraseña por código de 6 dígitos enviado por email.

### Usuarios

- Crear usuario.
- Listar usuarios con paginación, búsqueda y filtros.
- Ver detalle de usuario.
- Actualizar usuario.
- Eliminar usuario.
- Cambiar estado.

### Roles

- Listar roles.
- Listar roles “activos” para selects.
- Ver detalle de un rol con permisos.

### QR

- Crear y listar tipos de QR.
- Asignar QRs a usuarios.
- Asignar en lote.
- Asignar un tipo a todos los usuarios con rol `user`.
- Escanear y validar QR.
- Cancelar QR.
- Consultar QR por usuario o por token.

---

## Endpoints

## 1. Auth

Base: `/api/v1/auth`

### `POST /register`

Público.

Body:

```json
{
  "nombre": "Juan Pérez",
  "email": "usuario@ejemplo.com",
  "password": "Password123!"
}
```

Validaciones:

- `nombre`: string, 3 a 50 chars
- `email`: email válido, máximo 80
- `password`: mínimo 8, con mayúsculas, minúsculas y números

Respuesta:

```json
{
  "user": {
    "idUsuario": 1,
    "nombre": "Juan Pérez",
    "email": "usuario@ejemplo.com",
    "estado": "activo",
    "roles": []
  }
}
```

Notas:

- Setea `accessToken` y `refreshToken` en cookies.
- No devuelve tokens en el body.

### `POST /login`

Público.

Body:

```json
{
  "email": "usuario@ejemplo.com",
  "password": "Password123!"
}
```

Respuesta:

```json
{
  "user": {
    "idUsuario": 1,
    "nombre": "Juan Pérez",
    "email": "usuario@ejemplo.com",
    "estado": "activo",
    "roles": ["admin"]
  }
}
```

Errores típicos:

- `401`: credenciales inválidas
- `401`: usuario inactivo

### `POST /refresh`

Público, pero protegido con `JwtRefreshGuard`.

Fuente del refresh token:

- Primero desde cookie `refreshToken`
- Fallback: body `refreshToken`

Body opcional por fallback:

```json
{
  "refreshToken": "..."
}
```

Respuesta:

```json
{
  "user": {
    "idUsuario": 1,
    "nombre": "Juan Pérez",
    "email": "usuario@ejemplo.com",
    "estado": "activo",
    "roles": ["admin"]
  }
}
```

Notas:

- Renueva ambas cookies.
- No devuelve tokens en el body aunque el DTO interno sí los contemple.

### `POST /logout`

Privado.

Body: sin body.

Respuesta:

- `204 No Content`

Notas:

- Invalida sesión y revoca tokens del usuario.
- Limpia cookies de access y refresh.

### `GET /profile`

Privado.

Respuesta:

```json
{
  "idUsuario": 1,
  "email": "usuario@ejemplo.com",
  "nombre": "Juan Pérez",
  "roles": ["admin"],
  "permissions": ["users:read", "users:create"],
  "sessionId": "uuid-opcional"
}
```

### `POST /change-password`

Privado.

Body:

```json
{
  "currentPassword": "Actual123!",
  "newPassword": "NuevaPassword123!"
}
```

Reglas:

- `newPassword` mínimo 8
- Debe incluir mayúscula, minúscula y número

Respuesta:

- `204 No Content`

Notas:

- Revoca todos los tokens del usuario después del cambio.

### `GET /check`

Privado.

Respuesta:

```json
{
  "authenticated": true,
  "user": {
    "idUsuario": 1,
    "email": "usuario@ejemplo.com",
    "nombre": "Juan Pérez",
    "roles": ["admin"]
  }
}
```

Uso sugerido en front:

- Bootstrap de sesión al cargar la app.
- Rehidratación de usuario actual.

### `POST /password-recovery/request`

Público.

Body:

```json
{
  "email": "usuario@ejemplo.com"
}
```

Respuesta:

```json
{
  "message": "Si el email está registrado, recibirás un código de recuperación en tu bandeja de entrada"
}
```

Notas:

- Siempre responde el mismo mensaje, incluso si el email no existe o el usuario está inactivo.
- El código es de 6 dígitos.
- Expira en 15 minutos.

### `POST /password-recovery/reset`

Público.

Body:

```json
{
  "email": "usuario@ejemplo.com",
  "code": "123456",
  "newPassword": "NuevaPassword123!"
}
```

Respuesta:

```json
{
  "message": "Contraseña restablecida exitosamente. Ya puedes iniciar sesión."
}
```

Errores típicos:

- `400`: código inválido o expirado
- `400`: contraseña inválida

---

## 2. Usuarios

Base: `/api/v1/usuarios`

Guardas esperadas:

- JWT requerido
- Roles requeridos según endpoint

### `POST /`

Rol requerido: `admin`

Body:

```json
{
  "nombre": "Juan Pérez",
  "cedula": "1234567890",
  "email": "usuario@ejemplo.com",
  "password": "Password123!",
  "estado": "activo",
  "roleIds": [1, 2]
}
```

Campos:

- `nombre`: requerido
- `cedula`: requerido en DTO
- `email`: requerido
- `password`: requerido
- `estado`: opcional, default `activo`
- `roleIds`: opcional

Respuesta:

```json
{
  "idUsuario": 1,
  "nombre": "Juan Pérez",
  "email": "usuario@ejemplo.com",
  "estado": "activo",
  "roles": [
    {
      "idRol": 1,
      "nombre": "admin",
      "descripcion": "Administrador del sistema con acceso total",
      "createdAt": "2024-01-15T10:30:00.000Z"
    }
  ],
  "createdAt": "2024-01-15T10:30:00.000Z",
  "updatedAt": "2024-01-15T10:30:00.000Z"
}
```

Notas:

- Puede fallar con `409` si email ya existe.
- Puede fallar con `400` si algún rol no existe.

### `GET /`

Roles requeridos en código: `admin`, `SUPERVISOR`, `VENDEDOR`

Query params:

```txt
page=1
limit=10
search=Juan
estado=activo
sortBy=nombre|email|createdAt
sortOrder=ASC|DESC
```

Respuesta:

```json
{
  "data": [
    {
      "idUsuario": 1,
      "nombre": "Juan Pérez",
      "email": "usuario@ejemplo.com",
      "estado": "activo",
      "roles": []
    }
  ],
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 50,
    "totalPages": 5,
    "hasNextPage": true,
    "hasPreviousPage": false
  }
}
```

Notas UX:

- Este endpoint sí necesita tabla paginada.
- `search` busca por `nombre`, `email` y `cedula`.

### `GET /:id`

Roles requeridos en código: `admin`, `SUPERVISOR`, `VENDEDOR`

Respuesta:

```json
{
  "idUsuario": 1,
  "nombre": "Juan Pérez",
  "email": "usuario@ejemplo.com",
  "estado": "activo",
  "roles": []
}
```

### `PATCH /:id`

Rol requerido: `admin`

Body parcial:

```json
{
  "nombre": "Juan Pérez Actualizado",
  "email": "nuevo@ejemplo.com",
  "password": "NuevaPassword123!",
  "estado": "inactivo",
  "roleIds": [1]
}
```

Notas:

- `password` es opcional.
- Reemplaza roles si se envía `roleIds`.

### `DELETE /:id`

Rol requerido: `admin`

Respuesta:

- `204 No Content`

### `PATCH /:id/estado?estado=inactivo`

Rol requerido: `admin`

Estados documentados:

- `activo`
- `inactivo`
- `suspendido`

Respuesta:

- Retorna el usuario actualizado.

Uso sugerido:

- Toggle o acción rápida desde listado.

---

## 3. Roles

Base: `/api/v1/roles`

Todos los endpoints exigen rol `admin`.

### `GET /`

Query params:

```txt
search=admin
```

Respuesta:

```json
[
  {
    "idRol": 1,
    "nombre": "admin",
    "descripcion": "Administrador del sistema con acceso total",
    "createdAt": "2024-01-15T10:30:00.000Z"
  }
]
```

### `GET /activos`

Respuesta:

```json
[
  {
    "idRol": 1,
    "nombre": "admin",
    "descripcion": "Administrador del sistema con acceso total",
    "createdAt": "2024-01-15T10:30:00.000Z"
  }
]
```

Notas:

- No hay campo `activo` en la entidad `roles`.
- “activos” realmente devuelve todos los roles ordenados por nombre.
- Puede servir para selects de asignación de roles.

### `GET /:id`

Respuesta:

```json
{
  "idRol": 1,
  "nombre": "admin",
  "descripcion": "Administrador del sistema con acceso total",
  "createdAt": "2024-01-15T10:30:00.000Z",
  "permisos": [
    {
      "idPermiso": 1,
      "nombre": "users:read",
      "descripcion": "Leer usuarios"
    }
  ]
}
```

Nota:

- En `PermisoSimpleDto` la propiedad expuesta se llama `nombre`, pero la entidad usa `clave`.
- En la práctica ese campo merece validación manual cuando se conecte el front.

---

## 4. QR Tipos

Base: `/api/v1/qr/tipos`

Hoy no tiene guards activos.

### `POST /`

Body:

```json
{
  "codigo": "ALMUERZO",
  "nombre": "Almuerzo del evento",
  "descripcion": "Válido para el almuerzo del día principal",
  "requiereUnicoUso": true
}
```

Respuesta:

```json
{
  "idTipoQr": 1,
  "codigo": "ALMUERZO",
  "nombre": "Almuerzo del evento",
  "descripcion": "Válido para el almuerzo del día principal",
  "requiereUnicoUso": true,
  "activo": true,
  "createdAt": "2024-01-15T10:30:00.000Z"
}
```

Notas:

- `codigo` se guarda en mayúsculas.
- `codigo` es único.

### `GET /`

Query params:

```txt
search=almuerzo
```

Respuesta:

- Lista de `TipoQrResponseDto`

### `GET /activos`

Respuesta:

- Lista de tipos con `activo = true`

### `GET /:id`

Respuesta:

- Un `TipoQrResponseDto`

### `PATCH /:id`

Body parcial:

```json
{
  "nombre": "Nuevo nombre",
  "descripcion": "Nueva descripción",
  "requiereUnicoUso": false,
  "activo": false
}
```

---

## 5. QR Usuarios

Base: `/api/v1/qr`

Hoy no tiene guards activos.

### `POST /asignar-rol-user`

Asigna un tipo de QR a todos los usuarios activos que tengan el rol `user`.

Body:

```json
{
  "idTipoQr": 1,
  "expiracion": "2025-12-31T23:59:59Z"
}
```

Respuesta:

```json
{
  "asignados": 10,
  "omitidos": 2,
  "detalle": []
}
```

Notas:

- Si un usuario ya tiene ese QR activo, se omite.
- Si no existen usuarios activos con rol `user`, devuelve `404`.

### `POST /asignar`

Asigna un tipo QR a un usuario.

Body:

```json
{
  "idUsuario": 1,
  "idTipoQr": 2,
  "expiracion": "2025-12-31T23:59:59Z"
}
```

Errores típicos:

- `404`: tipo QR no existe o está inactivo
- `409`: ya existe una asignación activa para ese usuario y tipo

### `POST /asignar/todos`

Asigna todos los tipos QR activos a un usuario.

Body:

```json
{
  "idUsuario": 1,
  "expiracion": "2025-12-31T23:59:59Z"
}
```

Respuesta:

- Lista de asignaciones creadas

Notas:

- Si una asignación ya existía, la omite.
- Si no hay tipos activos, devuelve `404`.

### `POST /asignar/lote`

Asignación masiva usuarios × tipos.

Body:

```json
{
  "idUsuarios": [1, 2, 3],
  "idTiposQr": [1, 2],
  "expiracion": "2025-12-31T23:59:59Z"
}
```

Respuesta:

```json
{
  "asignados": 4,
  "omitidos": 2,
  "detalle": []
}
```

### `POST /escanear`

Valida el QR escaneado.

Body:

```json
{
  "token": "550e8400-e29b-41d4-a716-446655440000",
  "idStaff": 5
}
```

Respuesta exitosa:

```json
{
  "valido": true,
  "mensaje": "QR válido ✓ — Almuerzo del evento",
  "idUsuarioQr": "uuid",
  "idUsuario": 1,
  "estado": "activo",
  "fechaUso": null,
  "tipoQr": {
    "idTipoQr": 1,
    "codigo": "ALMUERZO",
    "nombre": "Almuerzo del evento",
    "requiereUnicoUso": true,
    "activo": true
  }
}
```

Respuesta inválida:

```json
{
  "valido": false,
  "mensaje": "QR expirado"
}
```

Reglas de negocio:

- Si no existe o está inactivo: inválido.
- Si ya fue usado: inválido, con fecha de uso.
- Si está cancelado: inválido.
- Si expiró: marca estado `expirado` y responde inválido.
- Si el tipo requiere único uso:
  - marca `usado = true`
  - cambia estado a `usado`
  - guarda `fechaUso`

Implicación UX:

- El flujo de escaneo debe manejar estado visual por `valido`, no solo por status HTTP.

### `PATCH /cancelar`

Body:

```json
{
  "idUsuarioQr": "550e8400-e29b-41d4-a716-446655440000"
}
```

Respuesta:

- Retorna la asignación cancelada

Efecto:

- `estado = cancelado`
- `activo = false`

### `GET /`

Lista QRs activos con filtros opcionales.

Query params:

```txt
idUsuario=1
idTipoQr=2
estado=activo|usado|expirado|cancelado
```

Notas:

- El query builder filtra `activo = true` de base.
- Aunque `estado=cancelado` existe en enum, como `cancelar` también pone `activo = false`, probablemente no aparecerá en este listado general.

### `GET /usuario/:idUsuario`

Devuelve todos los QRs activos de un usuario.

### `GET /token/:token`

Busca un QR activo por token.

---

## Roles y permisos semilla

El seeder base crea estos roles:

- `admin`
- `user`
- `moderator`

Permisos semilla:

- `users:*`
- `roles:*`
- `permissions:*`
- `products:*`
- `orders:*`

Asignación:

- `admin`: todos los permisos
- `user`: permisos `read`
- `moderator`: permisos `read` y `update`

## Inconsistencias detectadas

Estas son importantes para diseñar el front con criterio:

### 1. `cedula` está en DTOs pero no en entidad ni migración de usuarios

Impacto:

- `POST /usuarios` exige `cedula` por validación.
- El servicio no la persiste.
- `GET /usuarios` intenta buscar por `usuario.cedula`, pero la columna no existe en la entidad mostrada.
- `UsuarioResponseDto` expone `cedula`, pero la entidad `Usuario` no la tiene.

Conclusión:

- Este punto parece incompleto o roto del lado backend.
- Para el front conviene tratar `cedula` como campo incierto hasta validarlo en ejecución.

### 2. Roles requeridos no coinciden con roles sembrados

En controladores de usuarios se usan:

- `admin`
- `SUPERVISOR`
- `VENDEDOR`

Pero el seeder crea:

- `admin`
- `user`
- `moderator`

Impacto:

- Un usuario con roles seed estándar probablemente no podrá entrar a endpoints que exigen `SUPERVISOR` o `VENDEDOR`.

### 3. `GET /roles/activos` no filtra por “activo”

No existe columna `activo` en roles.

Impacto:

- El nombre del endpoint induce a pensar que hay estado activo/inactivo, pero no.

### 4. DTO de permisos usa `nombre`, entidad usa `clave`

Impacto:

- El front debería inspeccionar la respuesta real para confirmar cómo serializa Swagger/transformer ese campo.

### 5. Módulo QR sin seguridad aplicada

En ambos controladores QR están comentados:

- `@UseGuards(...)`
- `@Roles(...)`

Impacto:

- Hoy podría estar accesible sin autenticación.
- No diseñar todavía la UX de permisos QR como definitiva.

### 6. Cookies `secure: true` fijas

Impacto:

- En desarrollo local por HTTP puede haber problemas de sesión.

## Recomendaciones para el front

### Flujos prioritarios

1. Login
2. Check de sesión
3. Layout autenticado con perfil y roles
4. Listado paginado de usuarios
5. CRUD de usuarios
6. Catálogo de tipos QR
7. Asignación y consulta de QR
8. Pantalla de escaneo con feedback de éxito/error

### Suposiciones seguras para arrancar UI

- La sesión se maneja por cookies.
- `GET /auth/check` puede ser el endpoint de bootstrap.
- Usuarios necesita tabla con filtros y paginación.
- Roles puede alimentar selects.
- Escaneo QR necesita mensajes claros de estado.

### Riesgos a validar antes de cerrar front

- Si `cedula` realmente existe o no en BD real.
- Qué roles reales usa el ambiente donde desplegarán.
- Si el módulo QR terminará siendo privado o público.
- Si el entorno local soporta cookies `secure`.

## Archivos clave revisados

- [src/main.ts](/D:/Programacion/RegistroApp/app_registro/src/main.ts)
- [src/app.module.ts](/D:/Programacion/RegistroApp/app_registro/src/app.module.ts)
- [src/modules/auth/controllers/auth.controller.ts](/D:/Programacion/RegistroApp/app_registro/src/modules/auth/controllers/auth.controller.ts)
- [src/modules/usuarios/controllers/usuarios.controller.ts](/D:/Programacion/RegistroApp/app_registro/src/modules/usuarios/controllers/usuarios.controller.ts)
- [src/modules/roles/controllers/roles.controller.ts](/D:/Programacion/RegistroApp/app_registro/src/modules/roles/controllers/roles.controller.ts)
- [src/modules/qr/controllers/tipos-qr.controller.ts](/D:/Programacion/RegistroApp/app_registro/src/modules/qr/controllers/tipos-qr.controller.ts)
- [src/modules/qr/controllers/usuarios-qr.controller.ts](/D:/Programacion/RegistroApp/app_registro/src/modules/qr/controllers/usuarios-qr.controller.ts)
- [src/database/seeders/initial-seed.ts](/D:/Programacion/RegistroApp/app_registro/src/database/seeders/initial-seed.ts)

