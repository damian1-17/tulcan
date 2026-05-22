import { MigrationInterface, QueryRunner, Table, TableForeignKey } from 'typeorm';

export class CreatePasswordRecoveryCodesTable1234567890123
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'password_recovery_codes',
        columns: [
          {
            name: 'id_recovery',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'usuario_id',
            type: 'int',
            isNullable: false,
          },
          {
            name: 'code',
            type: 'varchar',
            length: '10',
            isNullable: false,
          },
          {
            name: 'expires_at',
            type: 'timestamp',
            isNullable: false,
          },
          {
            name: 'used',
            type: 'boolean',
            default: false,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'ip',
            type: 'varchar',
            length: '45',
            isNullable: true,
          },
        ],
      }),
      true, // ← IF NOT EXISTS
    );

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_password_recovery_usuario_code ON password_recovery_codes(usuario_id, code, used)`,
    );

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_password_recovery_expires ON password_recovery_codes(expires_at)`,
    );

    const table = await queryRunner.getTable('password_recovery_codes');
    const fkExists = table?.foreignKeys.some(fk =>
      fk.columnNames.includes('usuario_id'),
    );

    if (!fkExists) {
      await queryRunner.createForeignKey(
        'password_recovery_codes',
        new TableForeignKey({
          columnNames: ['usuario_id'],
          referencedTableName: 'usuarios',
          referencedColumnNames: ['id_usuario'],
          onDelete: 'CASCADE',
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('password_recovery_codes');
  }
}