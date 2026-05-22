import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
} from 'typeorm';

/**
 * Registra cada ejecución del proceso ETL.
 * Tabla: _etl_control
 */
@Entity({ name: '_etl_control' })
export class EtlControl {
  @PrimaryGeneratedColumn()
  id: number;

  /** Nombre del archivo procesado */
  @Column({ type: 'text' })
  nombre: string;

  /** Tipo de dato: 'credito' | 'ahorro' | 'transaccion' */
  @Column({ type: 'text' })
  tipo: string;

  /** Hash MD5 del archivo — garantiza idempotencia en el ETL */
  @Column({ name: 'hash_md5', type: 'text', unique: true })
  hashMd5: string;

  /** Cantidad de filas insertadas en esa ejecución */
  @Column({ type: 'integer', nullable: true })
  filas: number;

  /** Timestamp de cuando fue cargado */
  @Column({ name: 'cargado_en', type: 'timestamp', default: () => 'NOW()' })
  cargadoEn: Date;
}
