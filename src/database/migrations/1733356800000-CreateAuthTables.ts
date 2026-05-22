import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAuthTables1733356800000 implements MigrationInterface {
  name = 'CreateAuthTables1733356800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Tabla: usuarios
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "usuarios" (
        "id_usuario" SERIAL NOT NULL,
        "nombre" VARCHAR(50) NOT NULL,
        "email" VARCHAR(80) NOT NULL,
        "password_hash" VARCHAR(255) NOT NULL,
        "estado" VARCHAR(20) NOT NULL DEFAULT 'activo',
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_usuarios_email" UNIQUE ("email"),
        CONSTRAINT "PK_usuarios" PRIMARY KEY ("id_usuario")
      )
    `);

    // Tabla: roles
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "roles" (
        "id_rol" SERIAL NOT NULL,
        "nombre" VARCHAR(80) NOT NULL,
        "descripcion" VARCHAR(255) NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_roles_nombre" UNIQUE ("nombre"),
        CONSTRAINT "PK_roles" PRIMARY KEY ("id_rol")
      )
    `);

    // Tabla: permisos
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "permisos" (
        "id_permiso" SERIAL NOT NULL,
        "clave" VARCHAR(120) NOT NULL,
        "descripcion" VARCHAR(255),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_permisos_clave" UNIQUE ("clave"),
        CONSTRAINT "PK_permisos" PRIMARY KEY ("id_permiso")
      )
    `);

    // Tabla intermedia: roles_permisos
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "roles_permisos" (
        "id_rol" INT NOT NULL,
        "id_permiso" INT NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_roles_permisos" PRIMARY KEY ("id_rol", "id_permiso")
      )
    `);

    // Tabla intermedia: usuarios_roles
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "usuarios_roles" (
        "id_usuario" INT NOT NULL,
        "id_rol" INT NOT NULL,
        "asignado_por" INT,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_usuarios_roles" PRIMARY KEY ("id_usuario", "id_rol")
      )
    `);

    // Tabla: tokens
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "tokens" (
        "id_token" BIGSERIAL NOT NULL,
        "id_usuario" INT NOT NULL,
        "token_hash" VARCHAR(255) NOT NULL,
        "tipo" VARCHAR(20) NOT NULL,
        "issued_at" TIMESTAMP NOT NULL DEFAULT now(),
        "expires_at" TIMESTAMP NOT NULL,
        "revoked_at" TIMESTAMP,
        "revoked_by" INT,
        "meta" JSONB,
        CONSTRAINT "PK_tokens" PRIMARY KEY ("id_token")
      )
    `);

    // Tabla: sesiones
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "sesiones" (
        "id_sesion" UUID NOT NULL DEFAULT gen_random_uuid(),
        "id_usuario" INT NOT NULL,
        "user_agent" VARCHAR(255),
        "ip" VARCHAR(64),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "last_seen_at" TIMESTAMP NOT NULL DEFAULT now(),
        "expires_at" TIMESTAMP NOT NULL,
        "data" JSONB,
        CONSTRAINT "PK_sesiones" PRIMARY KEY ("id_sesion")
      )
    `);

    // Foreign Keys - con verificación
    await queryRunner.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_roles_permisos_rol') THEN
          ALTER TABLE "roles_permisos" 
          ADD CONSTRAINT "FK_roles_permisos_rol" 
          FOREIGN KEY ("id_rol") REFERENCES "roles"("id_rol") 
          ON DELETE CASCADE ON UPDATE NO ACTION;
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_roles_permisos_permiso') THEN
          ALTER TABLE "roles_permisos" 
          ADD CONSTRAINT "FK_roles_permisos_permiso" 
          FOREIGN KEY ("id_permiso") REFERENCES "permisos"("id_permiso") 
          ON DELETE CASCADE ON UPDATE NO ACTION;
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_usuarios_roles_usuario') THEN
          ALTER TABLE "usuarios_roles" 
          ADD CONSTRAINT "FK_usuarios_roles_usuario" 
          FOREIGN KEY ("id_usuario") REFERENCES "usuarios"("id_usuario") 
          ON DELETE CASCADE ON UPDATE NO ACTION;
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_usuarios_roles_rol') THEN
          ALTER TABLE "usuarios_roles" 
          ADD CONSTRAINT "FK_usuarios_roles_rol" 
          FOREIGN KEY ("id_rol") REFERENCES "roles"("id_rol") 
          ON DELETE CASCADE ON UPDATE NO ACTION;
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_usuarios_roles_asignado_por') THEN
          ALTER TABLE "usuarios_roles" 
          ADD CONSTRAINT "FK_usuarios_roles_asignado_por" 
          FOREIGN KEY ("asignado_por") REFERENCES "usuarios"("id_usuario") 
          ON DELETE SET NULL ON UPDATE NO ACTION;
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_tokens_usuario') THEN
          ALTER TABLE "tokens" 
          ADD CONSTRAINT "FK_tokens_usuario" 
          FOREIGN KEY ("id_usuario") REFERENCES "usuarios"("id_usuario") 
          ON DELETE CASCADE ON UPDATE NO ACTION;
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_tokens_revoked_by') THEN
          ALTER TABLE "tokens" 
          ADD CONSTRAINT "FK_tokens_revoked_by" 
          FOREIGN KEY ("revoked_by") REFERENCES "usuarios"("id_usuario") 
          ON DELETE SET NULL ON UPDATE NO ACTION;
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_sesiones_usuario') THEN
          ALTER TABLE "sesiones" 
          ADD CONSTRAINT "FK_sesiones_usuario" 
          FOREIGN KEY ("id_usuario") REFERENCES "usuarios"("id_usuario") 
          ON DELETE CASCADE ON UPDATE NO ACTION;
        END IF;
      END $$;
    `);

    // Índices - con verificación
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_token_hash" ON "tokens" ("token_hash")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_usuario_tipo" ON "tokens" ("id_usuario", "tipo")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_sesiones_usuario" ON "sesiones" ("id_usuario")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_sesiones_expires" ON "sesiones" ("expires_at")
    `);

    console.log('✅ Tablas de autenticación creadas/verificadas exitosamente');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indices
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_sesiones_expires"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_sesiones_usuario"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_usuario_tipo"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_token_hash"`);

    // Drop foreign keys
    await queryRunner.query(`ALTER TABLE "sesiones" DROP CONSTRAINT IF EXISTS "FK_sesiones_usuario"`);
    await queryRunner.query(`ALTER TABLE "tokens" DROP CONSTRAINT IF EXISTS "FK_tokens_revoked_by"`);
    await queryRunner.query(`ALTER TABLE "tokens" DROP CONSTRAINT IF EXISTS "FK_tokens_usuario"`);
    await queryRunner.query(`ALTER TABLE "usuarios_roles" DROP CONSTRAINT IF EXISTS "FK_usuarios_roles_asignado_por"`);
    await queryRunner.query(`ALTER TABLE "usuarios_roles" DROP CONSTRAINT IF EXISTS "FK_usuarios_roles_rol"`);
    await queryRunner.query(`ALTER TABLE "usuarios_roles" DROP CONSTRAINT IF EXISTS "FK_usuarios_roles_usuario"`);
    await queryRunner.query(`ALTER TABLE "roles_permisos" DROP CONSTRAINT IF EXISTS "FK_roles_permisos_permiso"`);
    await queryRunner.query(`ALTER TABLE "roles_permisos" DROP CONSTRAINT IF EXISTS "FK_roles_permisos_rol"`);

    // Drop tables
    await queryRunner.query(`DROP TABLE IF EXISTS "sesiones"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "tokens"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "usuarios_roles"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "roles_permisos"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "permisos"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "roles"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "usuarios"`);

    console.log('✅ Tablas de autenticación eliminadas exitosamente');
  }
}