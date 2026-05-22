
-- Crear todas las tablas
CREATE TABLE IF NOT EXISTS usuarios (
  id_usuario SERIAL PRIMARY KEY,
  nombre VARCHAR(50) NOT NULL,
  email VARCHAR(80) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  estado VARCHAR(20) DEFAULT 'activo' NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS roles (
  id_rol SERIAL PRIMARY KEY,
  nombre VARCHAR(80) UNIQUE NOT NULL,
  descripcion VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS permisos (
  id_permiso SERIAL PRIMARY KEY,
  clave VARCHAR(120) UNIQUE NOT NULL,
  descripcion VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS roles_permisos (
  id_rol INT NOT NULL,
  id_permiso INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_rol, id_permiso),
  FOREIGN KEY (id_rol) REFERENCES roles(id_rol) ON DELETE CASCADE,
  FOREIGN KEY (id_permiso) REFERENCES permisos(id_permiso) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS usuarios_roles (
  id_usuario INT NOT NULL,
  id_rol INT NOT NULL,
  asignado_por INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_usuario, id_rol),
  FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
  FOREIGN KEY (id_rol) REFERENCES roles(id_rol) ON DELETE CASCADE,
  FOREIGN KEY (asignado_por) REFERENCES usuarios(id_usuario) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS tokens (
  id_token BIGSERIAL PRIMARY KEY,
  id_usuario INT NOT NULL,
  token_hash VARCHAR(255) NOT NULL,
  tipo VARCHAR(20) NOT NULL,
  issued_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  revoked_at TIMESTAMP,
  revoked_by INT,
  meta JSONB,
  FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
  FOREIGN KEY (revoked_by) REFERENCES usuarios(id_usuario) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_token_hash ON tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_usuario_tipo ON tokens(id_usuario, tipo);

CREATE TABLE IF NOT EXISTS sesiones (
  id_sesion UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_usuario INT NOT NULL,
  user_agent VARCHAR(255),
  ip VARCHAR(64),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  last_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  data JSONB,
  FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sesiones_usuario ON sesiones(id_usuario);
CREATE INDEX IF NOT EXISTS idx_sesiones_expires ON sesiones(expires_at);

-- Insertar permisos iniciales
INSERT INTO permisos (clave, descripcion) VALUES
  ('users:read', 'Leer usuarios'),
  ('users:create', 'Crear usuarios'),
  ('users:update', 'Actualizar usuarios'),
  ('users:delete', 'Eliminar usuarios'),
  ('roles:read', 'Leer roles'),
  ('roles:create', 'Crear roles'),
  ('roles:update', 'Actualizar roles'),
  ('roles:delete', 'Eliminar roles'),
  ('permissions:read', 'Leer permisos'),
  ('permissions:create', 'Crear permisos'),
  ('permissions:update', 'Actualizar permisos'),
  ('permissions:delete', 'Eliminar permisos')
ON CONFLICT (clave) DO NOTHING;

-- Insertar roles iniciales
INSERT INTO roles (nombre, descripcion) VALUES
  ('admin', 'Administrador del sistema con acceso total'),
  ('user', 'Usuario estándar del sistema'),
  ('moderator', 'Moderador con permisos intermedios')
ON CONFLICT (nombre) DO NOTHING;

-- Asignar todos los permisos al rol admin
INSERT INTO roles_permisos (id_rol, id_permiso)
SELECT r.id_rol, p.id_permiso
FROM roles r
CROSS JOIN permisos p
WHERE r.nombre = 'admin'
ON CONFLICT DO NOTHING;

-- Asignar permisos de lectura al rol user
INSERT INTO roles_permisos (id_rol, id_permiso)
SELECT r.id_rol, p.id_permiso
FROM roles r
CROSS JOIN permisos p
WHERE r.nombre = 'user' AND p.clave LIKE '%:read'
ON CONFLICT DO NOTHING;

-- Asignar permisos de lectura y actualización al rol moderator
INSERT INTO roles_permisos (id_rol, id_permiso)
SELECT r.id_rol, p.id_permiso
FROM roles r
CROSS JOIN permisos p
WHERE r.nombre = 'moderator' AND (p.clave LIKE '%:read' OR p.clave LIKE '%:update')
ON CONFLICT DO NOTHING;