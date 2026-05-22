import {
  Entity,
  PrimaryColumn,
  Column,
  Index,
} from 'typeorm';

/**
 * Snapshot mensual del estado de las cuentas de ahorro.
 * Cada fila representa UNA cuenta en una fecha de corte.
 * Tabla: sabana_ahorro
 */
@Entity({ name: 'sabana_ahorro' })
@Index(['vAhCliente'])          // JOIN frecuente con sabana_credito y transacciones
@Index(['fechaProceso'])        // filtros por período
export class SabanaAhorro {
  // ── Columnas Primarias Compuestas ─────────────────────────────────────────

  @PrimaryColumn({ name: 'v_ah_cuenta', type: 'double precision' })
  vAhCuenta: number;

  @PrimaryColumn({ name: 'fecha_proceso', type: 'timestamp' })
  fechaProceso: Date;

  // ── Identificadores y Datos del Cliente ────────────────────────────────────

  /** ID del socio ★ Clave de relación con SabanaCredito.nroCliente */
  @Column({ name: 'v_ah_cliente', type: 'double precision', nullable: true })
  vAhCliente: number;

  @Column({ name: 'v_ah_nombre', type: 'text', nullable: true })
  vAhNombre: string;

  // ── Fechas ─────────────────────────────────────────────────────────────────

  @Column({ name: 'fecha_aper', type: 'timestamp', nullable: true })
  fechaAper: Date;

  @Column({ name: 'fecha_ultmov', type: 'timestamp', nullable: true })
  fechaUltmov: Date;

  @Column({ name: 'fecha_ult_capi', type: 'timestamp', nullable: true })
  fechaUltCapi: Date;

  @Column({ name: 'fecha_actualizacion', type: 'timestamp', nullable: true })
  fechaActualizacion: Date;

  @Column({ name: 'v_fecha_nac', type: 'timestamp', nullable: true })
  vFechaNac: Date;

  // ── Oficina / producto ─────────────────────────────────────────────────────

  @Column({ name: 'oficina_cta', type: 'double precision', nullable: true })
  oficinaCta: number;

  @Column({ name: 'estado_cta', type: 'text', nullable: true })
  estadoCta: string;

  @Column({ name: 'prod_bancario', type: 'text', nullable: true })
  prodBancario: string;

  @Column({ name: 'tipo_cuenta', type: 'text', nullable: true })
  tipoCuenta: string;

  // ── Saldos y montos ────────────────────────────────────────────────────────

  @Column({ name: 'saldo_disponible', type: 'double precision', nullable: true })
  saldoDisponible: number;

  @Column({ name: 'monto_bloq', type: 'double precision', nullable: true })
  montoBloq: number;

  @Column({ name: 'ult_tasa_int', type: 'double precision', nullable: true })
  ultTasaInt: number;

  @Column({ name: 'bloqueo_encaje', type: 'double precision', nullable: true })
  bloqueoEncaje: number;

  /** Movimiento de las últimas 24 horas */
  @Column({ name: 'v24h', type: 'double precision', nullable: true })
  v24h: number;

  @Column({ name: 'v12h', type: 'double precision', nullable: true })
  v12h: number;

  @Column({ name: 'v48h', type: 'double precision', nullable: true })
  v48h: number;

  @Column({ name: 'v72h_difer', type: 'double precision', nullable: true })
  v72hDifer: number;

  @Column({ name: 'val_de_creditos', type: 'double precision', nullable: true })
  valDeCreditos: number;

  @Column({ name: 'val_de_debitos', type: 'double precision', nullable: true })
  valDeDebitos: number;

  @Column({ name: 'int_hoy', type: 'double precision', nullable: true })
  intHoy: number;

  @Column({ name: 'int_acumulado', type: 'double precision', nullable: true })
  intAcumulado: number;

  @Column({ name: 'saldo_int_decim', type: 'double precision', nullable: true })
  saldoIntDecim: number;

  @Column({ name: 'certificadosvalor', type: 'double precision', nullable: true })
  certificadosValor: number;

  @Column({ name: 'ingresos', type: 'double precision', nullable: true })
  ingresos: number;

  @Column({ name: 'egresos', type: 'double precision', nullable: true })
  egresos: number;

  // ── Indicadores y Booleanos como Double Precision / Text ───────────────────

  @Column({ name: 'tiene_bloqueos', type: 'double precision', nullable: true })
  tieneBloqueos: number;

  @Column({ name: 'cooplinea', type: 'text', nullable: true })
  cooplinea: string;

  @Column({ name: 'tarjetas', type: 'text', nullable: true })
  tarjetas: string;

  @Column({ name: 'credito', type: 'text', nullable: true })
  credito: string;

  @Column({ name: 'menor_edad', type: 'text', nullable: true })
  menorEdad: string;

  // ── Datos demográficos del socio ───────────────────────────────────────────

  @Column({ name: 'edad', type: 'text', nullable: true })
  edad: string;

  @Column({ name: 'nacionalidad', type: 'text', nullable: true })
  nacionalidad: string;

  @Column({ name: 'sexo', type: 'text', nullable: true })
  sexo: string;

  @Column({ name: 'estado_civil', type: 'text', nullable: true })
  estadoCivil: string;

  // ── Trazabilidad ETL ───────────────────────────────────────────────────────

  @Column({ name: '_archivo_origen', type: 'text', nullable: true })
  archivoOrigen: string;

  @Column({ name: '_fecha_carga', type: 'timestamp', nullable: true })
  fechaCarga: Date;
}
