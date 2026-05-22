import { ApiProperty } from '@nestjs/swagger';

// ─── ETL Status ───────────────────────────────────────────────────────────────

export class EtlRecentFileDto {
  @ApiProperty({ example: 'DataSabanaCred18Mayo2026.xls' })
  nombre: string;

  @ApiProperty({ example: 'credito' })
  tipo: string;

  @ApiProperty({ example: 35343 })
  filas: number;

  @ApiProperty({ example: '2026-05-21T19:38:00.000Z' })
  cargadoEn: Date;
}

export class EtlStatusDto {
  @ApiProperty({ description: 'Últimos 5 archivos procesados por el ETL' })
  ultimosArchivos: EtlRecentFileDto[];

  @ApiProperty({ example: 1200000, description: 'Total de filas cargadas históricamente' })
  totalFilasHistoricas: number;

  @ApiProperty({ example: '2026-05-21T19:38:00.000Z', description: 'Fecha de la última ejecución ETL' })
  ultimaEjecucion: Date | null;
}

// ─── Demographics Summary ─────────────────────────────────────────────────────

export class SexoGroupDto {
  @ApiProperty({ example: 'F' })
  sexo: string;

  @ApiProperty({ example: 48230 })
  total: number;

  @ApiProperty({ example: 38.4 })
  promedioEdad: number;
}

export class DemographicsSummaryDto {
  @ApiProperty({ type: [SexoGroupDto] })
  porSexo: SexoGroupDto[];

  @ApiProperty({ example: 37.2 })
  promedioEdadGlobal: number;

  @ApiProperty({ example: 350502, description: 'Total de registros analizados' })
  totalRegistros: number;
}

// ─── Transaction Volume ───────────────────────────────────────────────────────

export class TransactionVolumeDto {
  @ApiProperty({ example: '2026-03-01' })
  desde: string;

  @ApiProperty({ example: '2026-05-21' })
  hasta: string;

  @ApiProperty({ example: 814181 })
  totalTransacciones: number;

  @ApiProperty({ example: 45820300.75, description: 'Suma total de valor_trn en el período' })
  sumaValorTotal: number;

  @ApiProperty({ example: 285670.22, description: 'Promedio de valor por transacción' })
  promedioValor: number;

  @ApiProperty({ example: 425000.5, description: 'Suma de créditos (signo C)' })
  totalCreditos: number;

  @ApiProperty({ example: 389300.25, description: 'Suma de débitos (signo D)' })
  totalDebitos: number;
}

// ─── Active Credits ─────────────────────────────────────────────────────────────

export class ActiveCreditDto {
  @ApiProperty({ example: '1587508', description: 'Número de cliente/socio' })
  nroCliente: string;

  @ApiProperty({ example: 'SOCIO 1587508', description: 'Nombre del socio' })
  nombresSocio: string;

  @ApiProperty({ example: '6572929246', description: 'Número de operación de crédito' })
  nroOperacion: string;

  @ApiProperty({ example: 'VIGENTE', description: 'Estado de la operación' })
  estadoOp: string;

  @ApiProperty({ example: 10000.0, description: 'Monto del crédito original' })
  montoCredito: number;

  @ApiProperty({ example: 8500.5, description: 'Saldo de capital actual' })
  saldoCapital: number;

  @ApiProperty({ example: 0, description: 'Días de mora del crédito' })
  diasMora: number;

  @ApiProperty({ example: 'A1', description: 'Calificación de riesgo' })
  calificacion: string;

  @ApiProperty({ example: '2026-05-18T00:00:00.000Z', description: 'Fecha de concesión de la operación' })
  fechaConcesionOp: Date | null;
}

export class ActiveCreditsResponseDto {
  @ApiProperty({ type: [ActiveCreditDto] })
  data: ActiveCreditDto[];

  @ApiProperty({ example: 35316, description: 'Total de créditos activos' })
  total: number;

  @ApiProperty({ example: 1, description: 'Página actual' })
  page: number;

  @ApiProperty({ example: 10, description: 'Límite de elementos por página' })
  limit: number;
}

// ─── Delinquency Risk (Riesgo de Morosidad por Socio) ─────────────────────────

export class DimensionScoreDto {
  @ApiProperty({ example: 'Perfil Crediticio', description: 'Nombre de la dimensión' })
  dimension: string;

  @ApiProperty({ example: 0.35, description: 'Peso de la dimensión en el score global (0-1)' })
  peso: number;

  @ApiProperty({ example: 18.5, description: 'Score de la dimensión (0-100)' })
  score: number;

  @ApiProperty({ example: 6.48, description: 'Contribución al score global (score * peso)' })
  contribucion: number;
}

export class SocioRiesgoDto {
  @ApiProperty({ example: '1234567', description: 'Número de cliente/socio' })
  nroCliente: string;

  @ApiProperty({ example: 'SOCIO 1234567', description: 'Nombre del socio' })
  nombre: string;

  @ApiProperty({ example: 42.3, description: 'Score global de riesgo (0-100)' })
  scoreGlobal: number;

  @ApiProperty({ example: 'Medio', description: 'Nivel de riesgo: Bajo / Medio / Alto / Crítico' })
  nivelRiesgo: string;

  @ApiProperty({ example: 'Saldo ahorro cayó 78% en las últimas semanas', description: 'Señal principal de alerta detectada para el socio' })
  senalPrincipal: string;

  @ApiProperty({ type: [DimensionScoreDto], description: 'Desglose por cada dimensión de riesgo' })
  dimensiones: DimensionScoreDto[];
}

export class DistribucionRiesgoDto {
  @ApiProperty({ example: 72000 })
  bajo: number;

  @ApiProperty({ example: 22000 })
  medio: number;

  @ApiProperty({ example: 4500 })
  alto: number;

  @ApiProperty({ example: 1136 })
  critico: number;
}

export class DelinquencyRiskResponseDto {
  @ApiProperty({ example: '2026-05-01', description: 'Fecha del corte de ahorro utilizado' })
  fechaCorteAhorro: string;

  @ApiProperty({ example: '2026-11-05', description: 'Fecha del corte de crédito utilizado' })
  fechaCorteCredito: string;

  @ApiProperty({ example: 99636, description: 'Total de socios analizados' })
  totalSocios: number;

  @ApiProperty({ type: DistribucionRiesgoDto, description: 'Distribución de socios por nivel de riesgo' })
  distribucion: DistribucionRiesgoDto;

  @ApiProperty({ type: [SocioRiesgoDto], description: 'Listado paginado de socios con su nivel de riesgo' })
  data: SocioRiesgoDto[];

  @ApiProperty({ example: 1, description: 'Página actual' })
  page: number;

  @ApiProperty({ example: 20, description: 'Límite por página' })
  limit: number;
}
