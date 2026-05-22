import { ApiProperty } from '@nestjs/swagger';

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

  @ApiProperty({ example: 'Interna', description: 'Clasificación: Interna (datos coop) | Externa (perfil socio)' })
  tipo: string;

  @ApiProperty({ example: 0.25, description: 'Peso de la dimensión en el score global (0-1)' })
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

  @ApiProperty({ example: 38.5, description: 'Score de dimensiones internas normalizado (0-100): Transaccional + Ahorro + Crediticio + Deterioro' })
  scoreInterno: number;

  @ApiProperty({ example: 51.2, description: 'Score de dimensiones externas normalizado (0-100): Socioecón. + Actividad + Garantías' })
  scoreExterno: number;

  @ApiProperty({ example: 'Medio', description: 'Nivel de riesgo: Bajo / Medio / Alto / Crítico' })
  nivelRiesgo: string;

  @ApiProperty({ example: 'Saldo ahorro cayó 78% en las últimas semanas', description: 'Señal principal de alerta detectada para el socio' })
  senalPrincipal: string;

  @ApiProperty({ example: 1245.80, description: 'Saldo disponible promedio del socio a través de todos los cortes históricos (USD)' })
  saldoPromedio: number;

  @ApiProperty({ example: 34.7, description: 'Probabilidad de caer en mora calculada a partir del score global mediante función sigmoide (%)' })
  probabilidadMora: number;

  @ApiProperty({ type: [DimensionScoreDto], description: 'Desglose por las 7 dimensiones de riesgo (4 internas + 3 externas)' })
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

  @ApiProperty({ example: 48250000.75, description: 'Suma total del saldo de capital de créditos vigentes en el último corte (USD)' })
  carteraTotal: number;

  @ApiProperty({ example: 3.47, description: 'Tasa de mora actual: saldo en mora / cartera total × 100 (definición bancaria estándar, %)' })
  tasaMoraActual: number;

  @ApiProperty({ type: DistribucionRiesgoDto, description: 'Distribución de socios por nivel de riesgo' })
  distribucion: DistribucionRiesgoDto;

  @ApiProperty({ type: [SocioRiesgoDto], description: 'Listado paginado de socios con su nivel de riesgo' })
  data: SocioRiesgoDto[];

  @ApiProperty({ example: 1, description: 'Página actual' })
  page: number;

  @ApiProperty({ example: 20, description: 'Límite por página' })
  limit: number;
}

// ─── Predictions (Predicción de Morosidad) ─────────────────────────────────────

export class SocioPrediccionDto {
  @ApiProperty({ example: '1234567' })
  nroCliente: string;

  @ApiProperty({ example: 'SOCIO 1234567' })
  nombre: string;

  @ApiProperty({ example: '10 días', description: 'Horizonte estimado: 10 días | 20 días | 30 días' })
  horizonte: string;

  @ApiProperty({ example: 72.5 })
  scoreGlobal: number;

  @ApiProperty({ example: 68.4, description: 'Probabilidad de mora en los próximos 10 días (%)' })
  prob10d: number;

  @ApiProperty({ example: 55.1, description: 'Probabilidad de mora en los próximos 20 días (%)' })
  prob20d: number;

  @ApiProperty({ example: 48.3, description: 'Probabilidad de mora en los próximos 30 días (%)' })
  prob30d: number;

  @ApiProperty({ example: 8500.50, description: 'Saldo de capital activo (monto en riesgo, USD)' })
  montoEnRiesgo: number;

  @ApiProperty({ example: 1245.80 })
  saldoPromedio: number;

  @ApiProperty({ example: 'Micro-retraso activo: 8 días', description: 'Factor principal que genera la predicción' })
  factorPrincipal: string;

  @ApiProperty({ example: 'Saldo ahorro cayó 63% + inactividad transaccional' })
  senalPrincipal: string;

  @ApiProperty({ example: 'Alto' })
  nivelRiesgo: string;
}

export class PredictionResumenDto {
  @ApiProperty({ example: 142 })
  total10d: number;

  @ApiProperty({ example: 380 })
  total20d: number;

  @ApiProperty({ example: 720 })
  total30d: number;

  @ApiProperty({ example: 1242 })
  totalGeneral: number;

  @ApiProperty({ example: 1250000.00, description: 'Suma de monto en riesgo — horizonte 10 días (USD)' })
  montoEnRiesgo10d: number;

  @ApiProperty({ example: 3800000.00 })
  montoEnRiesgo20d: number;

  @ApiProperty({ example: 7200000.00 })
  montoEnRiesgo30d: number;

  @ApiProperty({ example: 12250000.00 })
  montoTotalEnRiesgo: number;
}

export class PredictionsResponseDto {
  @ApiProperty({ type: PredictionResumenDto })
  resumen: PredictionResumenDto;

  @ApiProperty({ type: [SocioPrediccionDto] })
  data: SocioPrediccionDto[];

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 20 })
  limit: number;

  @ApiProperty({ example: 1242 })
  total: number;
}

// ─── Cuotas Próximas en Riesgo ─────────────────────────────────────────────────

export class CuotaRiesgoDto {
  @ApiProperty({ example: '1234567' })
  nroCliente: string;

  @ApiProperty({ example: 'JUAN PÉREZ' })
  nombresSocio: string;

  @ApiProperty({ example: 'OP-00123456' })
  nroOperacion: string;

  @ApiProperty({ example: '2026-05-28', description: 'Fecha estimada de la próxima cuota' })
  fechaProxPago: string;

  @ApiProperty({ example: 5, description: 'Días hasta el próximo vencimiento (negativo = ya vencida)' })
  diasHastaPago: number;

  @ApiProperty({ example: 320.50, description: 'Cuota estimada a pagar (USD)' })
  cuotaEstimada: number;

  @ApiProperty({ example: 8500.00, description: 'Saldo de capital pendiente (USD)' })
  saldoCapital: number;

  @ApiProperty({ example: 7200.00, description: 'Saldo por vencer (USD)' })
  saldoPorVencer: number;

  @ApiProperty({ example: 'A3' })
  calificacion: string;

  @ApiProperty({ example: 'Medio' })
  nivelRiesgo: string;

  @ApiProperty({ example: 5, description: 'Días en mora actuales' })
  diasMora: number;

  @ApiProperty({ example: 'ALTA', description: 'Prioridad de atención: CRÍTICA | ALTA | MEDIA | BAJA' })
  prioridad: string;

  @ApiProperty({ example: 'CONSUMO' })
  destinoOp: string;

  @ApiProperty({ example: 'COMERCIO' })
  actividadSocio: string;

  @ApiProperty({ example: '24', description: 'Plazo original en meses' })
  plazo: string;

  @ApiProperty({ example: '12', description: 'Cuotas atrasadas actualmente' })
  cuotasAtrasadas: number;

  @ApiProperty({ example: '2025-04-15', description: 'Fecha del último pago registrado' })
  fechaUltPago: string | null;
}

export class CuotasRiesgoResumenDto {
  @ApiProperty({ example: 42, description: 'Cuotas que vencen en los próximos 7 días' })
  total7d: number;

  @ApiProperty({ example: 115, description: 'Cuotas que vencen en los próximos 15 días' })
  total15d: number;

  @ApiProperty({ example: 280, description: 'Cuotas que vencen en los próximos 30 días' })
  total30d: number;

  @ApiProperty({ example: 18, description: 'Cuotas con prioridad CRÍTICA en los próximos 30 días' })
  totalCritica: number;

  @ApiProperty({ example: 13440.50, description: 'Suma de cuotas que vencen en 7 días (USD)' })
  monto7d: number;

  @ApiProperty({ example: 36800.00 })
  monto15d: number;

  @ApiProperty({ example: 89600.00 })
  monto30d: number;
}

export class CuotasRiesgoResponseDto {
  @ApiProperty({ type: CuotasRiesgoResumenDto })
  resumen: CuotasRiesgoResumenDto;

  @ApiProperty({ type: [CuotaRiesgoDto] })
  data: CuotaRiesgoDto[];

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 20 })
  limit: number;

  @ApiProperty({ example: 280 })
  total: number;
}

// ─── Concentración de Cartera ─────────────────────────────────────────────────

export class ConcentracionItemDto {
  @ApiProperty({ example: 'Agricultura' })
  categoria: string;

  @ApiProperty({ example: 150 })
  cantidadOperaciones: number;

  @ApiProperty({ example: 1500000.50 })
  saldoCapitalTotal: number;

  @ApiProperty({ example: 45000.00 })
  saldoCapitalMora: number;

  @ApiProperty({ example: 3.0, description: 'Porcentaje de mora (saldo_mora / saldo_total * 100)' })
  indiceMora: number;

  @ApiProperty({ example: 25.5, description: 'Participación de esta categoría en el total de la cartera (%)' })
  participacion: number;
}

export class ConcentracionResponseDto {
  @ApiProperty({ example: 5500000.00, description: 'Saldo total de la cartera vigente analizada' })
  carteraTotal: number;

  @ApiProperty({ example: 220000.00, description: 'Saldo total en mora' })
  moraTotal: number;

  @ApiProperty({ example: 4.0, description: 'Índice de mora global (%)' })
  indiceMoraGlobal: number;

  @ApiProperty({ type: [ConcentracionItemDto], description: 'Concentración por actividad económica' })
  porActividad: ConcentracionItemDto[];

  @ApiProperty({ type: [ConcentracionItemDto], description: 'Concentración por destino del crédito' })
  porDestino: ConcentracionItemDto[];

  @ApiProperty({ type: [ConcentracionItemDto], description: 'Concentración por ciudad de origen' })
  porCiudad: ConcentracionItemDto[];
}

// ─── Retención de Socios (Riesgo de Fuga / Liquidez) ─────────────────────────

export class SocioRetencionDto {
  @ApiProperty({ example: '1234567' })
  nroCliente: string;

  @ApiProperty({ example: 'JUAN PÉREZ' })
  nombresSocio: string;

  @ApiProperty({ example: 450.50, description: 'Saldo disponible en su cuenta de ahorros principal' })
  saldoAhorro: number;

  @ApiProperty({ example: 120, description: 'Días desde el último movimiento transaccional' })
  diasInactividad: number;

  @ApiProperty({ example: '2025-10-15', description: 'Fecha del último movimiento' })
  fechaUltMovimiento: string | null;

  @ApiProperty({ example: false, description: '¿Tiene algún crédito activo?' })
  tieneCredito: boolean;

  @ApiProperty({ example: true, description: '¿Tiene canales digitales activos (Cooplinea)?' })
  tieneCooplinea: boolean;

  @ApiProperty({ example: 85, description: 'Probabilidad de desvinculación o fuga (0-100)' })
  probabilidadFuga: number;

  @ApiProperty({ example: 'Alto', description: 'Nivel de riesgo de pérdida del socio' })
  nivelRiesgo: string;

  @ApiProperty({ example: 'Alta inactividad y sin obligaciones cruzadas' })
  motivoPrincipal: string;
}

export class RetencionResumenDto {
  @ApiProperty({ example: 120 })
  totalRiesgoAlto: number;

  @ApiProperty({ example: 450 })
  totalRiesgoMedio: number;

  @ApiProperty({ example: 25000.50, description: 'Saldo total de ahorros perteneciente a los socios en riesgo Alto/Medio (Impacto a liquidez)' })
  saldoEnRiesgo: number;
}

export class RetencionResponseDto {
  @ApiProperty({ type: RetencionResumenDto })
  resumen: RetencionResumenDto;

  @ApiProperty({ type: [SocioRetencionDto] })
  data: SocioRetencionDto[];

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 20 })
  limit: number;

  @ApiProperty({ example: 570 })
  total: number;
}

// ─── Recuperabilidad de Cartera Vencida ──────────────────────────────────────

export class SocioRecuperableDto {
  @ApiProperty({ example: '1234567' })
  nroCliente: string;

  @ApiProperty({ example: 'MARÍA GÓMEZ' })
  nombresSocio: string;

  @ApiProperty({ example: 'OP-00987654' })
  nroOperacion: string;

  @ApiProperty({ example: 45, description: 'Días actuales de mora' })
  diasMora: number;

  @ApiProperty({ example: 12500.50, description: 'Saldo de capital vencido' })
  saldoVencido: number;

  @ApiProperty({ example: 'HIPOTECARIA', description: 'Tipo de garantía (factor clave de recuperabilidad)' })
  tipoGarantia: string;

  @ApiProperty({ example: 'Alta', description: 'Probabilidad de recuperar el pago (Alta, Media, Baja)' })
  segmento: string;

  @ApiProperty({ example: 85, description: 'Score porcentual de recuperabilidad' })
  scoreRecuperacion: number;

  @ApiProperty({ example: 'Garantía real e ingresos netos positivos' })
  factorPositivo: string;

  @ApiProperty({ example: 1200.0, description: 'Ingresos reportados del socio' })
  ingresos: number;
}

export class RecuperabilidadResumenDto {
  @ApiProperty({ example: 15 })
  totalAlta: number;

  @ApiProperty({ example: 45 })
  totalMedia: number;

  @ApiProperty({ example: 120 })
  totalBaja: number;

  @ApiProperty({ example: 150000.00, description: 'Monto total (USD) en segmento de Alta Recuperabilidad' })
  montoAlta: number;

  @ApiProperty({ example: 450000.00 })
  montoMedia: number;

  @ApiProperty({ example: 850000.00 })
  montoBaja: number;
}

export class RecuperabilidadResponseDto {
  @ApiProperty({ type: RecuperabilidadResumenDto })
  resumen: RecuperabilidadResumenDto;

  @ApiProperty({ type: [SocioRecuperableDto] })
  data: SocioRecuperableDto[];

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 20 })
  limit: number;

  @ApiProperty({ example: 180 })
  total: number;
}
