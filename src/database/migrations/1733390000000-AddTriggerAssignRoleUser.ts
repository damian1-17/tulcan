import { MigrationInterface, QueryRunner } from "typeorm";

export class AddTriggerAssignRoleUser1734660000000 implements MigrationInterface {
  name = 'AddTriggerAssignRoleUser1733390000000'

  public async up(queryRunner: QueryRunner): Promise<void> {

    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION asignar_rol_usuario()
          RETURNS TRIGGER AS
      $$
      DECLARE
          rol_user_id INTEGER;
      BEGIN
          -- Obtener ID del rol "user"
          SELECT id_rol
          INTO rol_user_id
          FROM roles
          WHERE nombre = 'user'
          LIMIT 1;

          IF rol_user_id IS NULL THEN
              RAISE EXCEPTION 'El rol "user" no existe en la tabla roles.';
          END IF;

          -- Insertar relación en usuario_roles
          INSERT INTO usuarios_roles (id_usuario, id_rol)
          VALUES (NEW.id_usuario, rol_user_id);

          RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    await queryRunner.query(`
      CREATE TRIGGER asignar_rol_user_trigger
          AFTER INSERT
          ON usuarios
          FOR EACH ROW
      EXECUTE FUNCTION asignar_rol_usuario();
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TRIGGER IF EXISTS asignar_rol_user_trigger ON usuarios;
    `);

    await queryRunner.query(`
      DROP FUNCTION IF EXISTS asignar_rol_usuario();
    `);
  }
}
