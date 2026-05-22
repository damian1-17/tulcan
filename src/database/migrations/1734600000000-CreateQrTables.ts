import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from "typeorm";

export class CreateQrTables1734600000000 implements MigrationInterface {
    name = 'CreateQrTables1734600000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Create tipos_qr table
        await queryRunner.createTable(new Table({
            name: "tipos_qr",
            columns: [
                {
                    name: "id_tipo_qr",
                    type: "int",
                    isPrimary: true,
                    isGenerated: true,
                    generationStrategy: "increment"
                },
                {
                    name: "codigo",
                    type: "varchar",
                    length: "50",
                    isUnique: true
                },
                {
                    name: "nombre",
                    type: "varchar",
                    length: "100"
                },
                {
                    name: "descripcion",
                    type: "varchar",
                    length: "255",
                    isNullable: true
                },
                {
                    name: "requiere_unico_uso",
                    type: "boolean",
                    default: true
                },
                {
                    name: "activo",
                    type: "boolean",
                    default: true
                },
                {
                    name: "created_at",
                    type: "timestamp",
                    default: "now()"
                }
            ]
        }), true);

        // Create usuarios_qr table
        await queryRunner.createTable(new Table({
            name: "usuarios_qr",
            columns: [
                {
                    name: "id_usuario_qr",
                    type: "uuid",
                    isPrimary: true,
                    isGenerated: true,
                    generationStrategy: "uuid"
                },
                {
                    name: "id_usuario",
                    type: "int"
                },
                {
                    name: "id_tipo_qr",
                    type: "int"
                },
                {
                    name: "token",
                    type: "uuid",
                    isUnique: true
                },
                {
                    name: "estado",
                    type: "varchar",
                    length: "20",
                    default: "'activo'"
                },
                {
                    name: "usado",
                    type: "boolean",
                    default: false
                },
                {
                    name: "fecha_uso",
                    type: "timestamp",
                    isNullable: true
                },
                {
                    name: "expiracion",
                    type: "timestamp",
                    isNullable: true
                },
                {
                    name: "activo",
                    type: "boolean",
                    default: true
                },
                {
                    name: "created_at",
                    type: "timestamp",
                    default: "now()"
                }
            ]
        }), true);

        // Add indices for usuarios_qr
        await queryRunner.createIndex("usuarios_qr", new TableIndex({
            name: "idx_usuario_tipo_qr",
            columnNames: ["id_usuario", "id_tipo_qr"]
        }));

        await queryRunner.createIndex("usuarios_qr", new TableIndex({
            name: "idx_qr_usuario",
            columnNames: ["id_usuario"]
        }));

        await queryRunner.createIndex("usuarios_qr", new TableIndex({
            name: "idx_qr_tipo",
            columnNames: ["id_tipo_qr"]
        }));

        await queryRunner.createIndex("usuarios_qr", new TableIndex({
            name: "idx_qr_token",
            columnNames: ["token"]
        }));

        // Add Foreign Key for id_tipo_qr
        await queryRunner.createForeignKey("usuarios_qr", new TableForeignKey({
            columnNames: ["id_tipo_qr"],
            referencedColumnNames: ["id_tipo_qr"],
            referencedTableName: "tipos_qr",
            onDelete: "NO ACTION",
            onUpdate: "NO ACTION"
        }));
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        const table = await queryRunner.getTable("usuarios_qr");
        const foreignKey = table?.foreignKeys.find(fk => fk.columnNames.indexOf("id_tipo_qr") !== -1);
        if (foreignKey) {
            await queryRunner.dropForeignKey("usuarios_qr", foreignKey);
        }

        await queryRunner.dropIndex("usuarios_qr", "idx_qr_token");
        await queryRunner.dropIndex("usuarios_qr", "idx_qr_tipo");
        await queryRunner.dropIndex("usuarios_qr", "idx_qr_usuario");
        await queryRunner.dropIndex("usuarios_qr", "idx_usuario_tipo_qr");

        await queryRunner.dropTable("usuarios_qr");
        await queryRunner.dropTable("tipos_qr");
    }
}
