import {
  Entity,
  PrimaryColumn,
  Column,
  Index,
} from 'typeorm';

/**
 * Snapshot semanal del estado de la cartera de créditos.
 * Cada fila representa UNA operación de crédito en una fecha de corte.
 * Tabla: sabana_credito
 */
@Entity({ name: 'sabana_credito' })
@Index(['nroCliente'])          // JOIN con sabana_ahorro y transacciones
@Index(['qyFechaproc'])         // filtros por corte semanal
@Index(['calificacion'])        // KPIs de riesgo
export class SabanaCredito {
  // ── Columnas Primarias Compuestas ─────────────────────────────────────────

  /** ID único de la operación crediticia */
  @PrimaryColumn({ name: 'nro_operacion', type: 'text' })
  nroOperacion: string;

  /** Fecha del corte/proceso semanal */
  @PrimaryColumn({ name: 'qy_fechaproc', type: 'timestamp' })
  qyFechaproc: Date;

  // ── Identificadores y Datos del Socio ──────────────────────────────────────

  /** ID del socio ★ Clave de relación con SabanaAhorro.vAhCliente */
  @Column({ name: 'nro_cliente', type: 'text', nullable: true })
  nroCliente: string;

  @Column({ name: 'nombres_socio', type: 'text', nullable: true })
  nombresSocio: string;

  @Column({ name: 'nro_oficina', type: 'text', nullable: true })
  nroOficina: string;

  // ── Fechas ─────────────────────────────────────────────────────────────────

  @Column({ name: 'fecha_concesion_op', type: 'timestamp', nullable: true })
  fechaConcesionOp: Date;

  @Column({ name: 'fecha_fin_op', type: 'timestamp', nullable: true })
  fechaFinOp: Date;

  @Column({ name: 'fecha_ult_pag', type: 'timestamp', nullable: true })
  fechaUltPag: Date;

  // ── Clasificación de la operación ──────────────────────────────────────────

  @Column({ name: 'tipo_operacion', type: 'text', nullable: true })
  tipoOperacion: string;

  @Column({ name: 'estado_op', type: 'text', nullable: true })
  estadoOp: string;

  @Column({ name: 'cod_destino_op', type: 'text', nullable: true })
  codDestinoOp: string;

  @Column({ name: 'destino_op', type: 'text', nullable: true })
  destinoOp: string;

  @Column({ name: 'cod_actividad', type: 'text', nullable: true })
  codActividad: string;

  @Column({ name: 'actividad_socio', type: 'text', nullable: true })
  actividadSocio: string;

  @Column({ name: 'tipo_cartera', type: 'text', nullable: true })
  tipoCartera: string;

  @Column({ name: 'tipo_plazo', type: 'text', nullable: true })
  tipoPlazo: string;

  @Column({ name: 'tgarantia', type: 'text', nullable: true })
  tgarantia: string;

  /**
   * Calificación de riesgo regulatoria (A1, A2, B1, B2, C1, C2, D, E).
   * Es el indicador oficial de mora de la cartera.
   */
  @Column({ name: 'calificacion', type: 'text', nullable: true })
  calificacion: string;

  // ── Montos y saldos principales ────────────────────────────────────────────

  @Column({ name: 'monto_credito', type: 'text', nullable: true })
  montoCredito: string;

  @Column({ name: 'saldo_capital', type: 'double precision', nullable: true })
  saldoCapital: number;

  @Column({ name: 'saldo_por_vencer', type: 'double precision', nullable: true })
  saldoPorVencer: number;

  @Column({ name: 'saldo_no_devenga', type: 'text', nullable: true })
  saldoNoDevenga: string;

  @Column({ name: 'saldo_vencido', type: 'text', nullable: true })
  saldoVencido: string;

  // ── Intereses ──────────────────────────────────────────────────────────────

  @Column({ name: 'int_normal', type: 'double precision', nullable: true })
  intNormal: number;

  @Column({ name: 'int_devengado', type: 'double precision', nullable: true })
  intDevengado: number;

  @Column({ name: 'int_vencido', type: 'text', nullable: true })
  intVencido: string;

  @Column({ name: 'int_resolucion', type: 'text', nullable: true })
  intResolucion: string;

  @Column({ name: 'int_castigado', type: 'text', nullable: true })
  intCastigado: string;

  @Column({ name: 'int_mora', type: 'text', nullable: true })
  intMora: string;

  // ── Plazo y cuotas ─────────────────────────────────────────────────────────

  @Column({ name: 'plazo', type: 'text', nullable: true })
  plazo: string;

  @Column({ name: 'nro_cuotas', type: 'text', nullable: true })
  nroCuotas: string;

  @Column({ name: 'dia_pago', type: 'text', nullable: true })
  diaPago: string;

  /** Días en mora — variable principal para scoring de riesgo */
  @Column({ name: 'dias_mora', type: 'text', nullable: true })
  diasMora: string;

  /** Cuotas atrasadas — señal directa de incumplimiento */
  @Column({ name: 'nro_cuotas_atra', type: 'text', nullable: true })
  nroCuotasAtra: string;

  // ── Tasas ──────────────────────────────────────────────────────────────────

  @Column({ name: 'tasa_int_con', type: 'double precision', nullable: true })
  tasaIntCon: number;

  @Column({ name: 'tasa_int_vig', type: 'double precision', nullable: true })
  tasaIntVig: number;

  // ── Garantías ──────────────────────────────────────────────────────────────

  @Column({ name: 'valgarantias', type: 'text', nullable: true })
  valGarantias: string;

  @Column({ name: 'fecha_garantias', type: 'text', nullable: true })
  fechaGarantias: string;

  // ── Ingresos / egresos del socio ───────────────────────────────────────────

  @Column({ name: 'ingresos_socio', type: 'text', nullable: true })
  ingresosSocio: string;

  @Column({ name: 'egresos_socio', type: 'text', nullable: true })
  egresosSocio: string;

  // ── Datos demográficos del socio ───────────────────────────────────────────

  @Column({ name: 'fech_nacimiento', type: 'timestamp', nullable: true })
  fechNacimiento: Date;

  @Column({ name: 'sexo', type: 'text', nullable: true })
  sexo: string;

  @Column({ name: 'estado_civil', type: 'text', nullable: true })
  estadoCivil: string;

  /** Número de cargas familiares — factor externo de riesgo */
  @Column({ name: 'nro_cargas_fam', type: 'text', nullable: true })
  nroCargasFam: string;

  @Column({ name: 'nivel_educa', type: 'text', nullable: true })
  nivelEduca: string;

  /** Tipo de vivienda — factor externo de riesgo */
  @Column({ name: 'tipo_vivien', type: 'text', nullable: true })
  tipoVivien: string;

  @Column({ name: 'fech_ult_viv', type: 'timestamp', nullable: true })
  fechUltViv: Date;

  @Column({ name: 'fech_utl_tra', type: 'text', nullable: true })
  fechUtlTra: string;

  /** Ciudad de origen — factor externo de riesgo */
  @Column({ name: 'cidudad_orig', type: 'text', nullable: true })
  ciudadOrig: string;

  @Column({ name: 'nro_creditos', type: 'text', nullable: true })
  nroCreditos: string;

  // ── Valores de deuda ───────────────────────────────────────────────────────

  @Column({ name: 'val_capd', type: 'text', nullable: true })
  valCapd: string;

  @Column({ name: 'val_intd', type: 'text', nullable: true })
  valIntd: string;

  @Column({ name: 'val_morad', type: 'text', nullable: true })
  valMorad: string;

  @Column({ name: 'val_notd', type: 'text', nullable: true })
  valNotd: string;

  @Column({ name: 'val_gnot2d', type: 'text', nullable: true })
  valGnot2d: string;

  @Column({ name: 'val_intresd', type: 'text', nullable: true })
  valIntresd: string;

  // ── Trazabilidad ETL ───────────────────────────────────────────────────────

  @Column({ name: '_archivo_origen', type: 'text', nullable: true })
  archivoOrigen: string;

  @Column({ name: '_fecha_carga', type: 'timestamp', nullable: true })
  fechaCarga: Date;
}
