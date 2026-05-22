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

  @ApiProperty({ example: 850.75 })
  promedioIngresos: number;
}

export class DemographicsSummaryDto {
  @ApiProperty({ type: [SexoGroupDto] })
  porSexo: SexoGroupDto[];

  @ApiProperty({ example: 37.2 })
  promedioEdadGlobal: number;

  @ApiProperty({ example: 890.5 })
  promedioIngresosGlobal: number;

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

// ─── Global Balances ──────────────────────────────────────────────────────────

export class GlobalBalancesDto {
  @ApiProperty({ example: 28400000.0, description: 'Suma total de saldo_disponible en el corte más reciente' })
  totalSaldoDisponible: number;

  @ApiProperty({ example: 1200000.0, description: 'Suma total de montos bloqueados' })
  totalMontoBloqueado: number;

  @ApiProperty({ example: 350000.0, description: 'Suma de ingresos declarados de socios' })
  totalIngresos: number;

  @ApiProperty({ example: 120000.0, description: 'Suma de egresos declarados de socios' })
  totalEgresos: number;

  @ApiProperty({ example: '2026-05-01T00:00:00.000Z', description: 'Fecha de proceso del corte utilizado' })
  fechaCorte: Date | null;

  @ApiProperty({ example: 114808, description: 'Número de cuentas en el corte' })
  totalCuentas: number;
}

// ─── Preventive Action Socios ──────────────────────────────────────────────────

export class PreventiveActionSocioDto {
  @ApiProperty({ example: 'C-00412', description: 'Número de cliente/socio' })
  nroCliente: string;

  @ApiProperty({ example: 'M. Andrade', description: 'Nombre del socio' })
  nombre: string;

  @ApiProperty({ example: 87, description: 'Score de riesgo preventivo' })
  score: number;

  @ApiProperty({ example: 'Crítico', description: 'Nivel de criticidad' })
  nivel: string;

  @ApiProperty({ example: 0, description: 'Días de mora actuales' })
  diasMora: number;

  @ApiProperty({ example: 'Saldo ahorro cayó 78% en 3 semanas', description: 'Señal principal de alerta' })
  senalPrincipal: string;
}

