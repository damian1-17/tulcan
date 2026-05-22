import {
  Entity,
  PrimaryColumn,
  Column,
  Index,
} from 'typeorm';

/**
 * Log de movimientos transaccionales por cuenta.
 * Cada fila representa UNA transacción (débito o crédito).
 * Tabla: transacciones
 */
@Entity({ name: 'transacciones' })
@Index(['nroCliente'])             // JOIN con otras tablas por socio
@Index(['cuenta'])                 // JOIN con sabana_ahorro.v_ah_cuenta
@Index(['fechaTrn'])               // filtros por rango de fechas
export class Transaccion {
  // ── Columnas Primarias Compuestas ─────────────────────────────────────────

  @PrimaryColumn({ name: 'fecha_trn', type: 'timestamp' })
  fechaTrn: Date;

  @PrimaryColumn({ name: 'cuenta', type: 'double precision' })
  cuenta: number;

  // ── Identificadores y Datos de Transacción ────────────────────────────────

  /** ID socio ★ se relaciona con SabanaCredito.nroCliente o SabanaAhorro.vAhCliente */
  @Column({ name: 'nro_cliente', type: 'double precision', nullable: true })
  nroCliente: number;

  // ── Valores ────────────────────────────────────────────────────────────────

  @Column({ name: 'valor_trn', type: 'double precision', nullable: true })
  valorTrn: number;

  /**
   * Tipo de movimiento:
   * 'C' = Crédito (entrada de dinero)
   * 'D' = Débito  (salida de dinero)
   */
  @Column({ name: 'signo_nc_nd', type: 'text', nullable: true })
  signoNcNd: string;

  @Column({ name: 'causal_trn', type: 'text', nullable: true })
  causalTrn: string;

  @Column({ name: 'correccion', type: 'text', nullable: true })
  correccion: string;

  @Column({ name: 'saldo_contable', type: 'double precision', nullable: true })
  saldoContable: number;

  @Column({ name: 'saldo_disponible', type: 'double precision', nullable: true })
  saldoDisponible: number;

  // ── Trazabilidad ETL ───────────────────────────────────────────────────────

  @Column({ name: '_archivo_origen', type: 'text', nullable: true })
  archivoOrigen: string;

  @Column({ name: '_fecha_carga', type: 'timestamp', nullable: true })
  fechaCarga: Date;
}
