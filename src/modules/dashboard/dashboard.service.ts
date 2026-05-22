import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { SabanaAhorro }   from './entities/sabana-ahorro.entity';
import { SabanaCredito }  from './entities/sabana-credito.entity';

import {
  ActiveCreditDto,
  ActiveCreditsResponseDto,
  DelinquencyRiskResponseDto,
  SocioRiesgoDto,
  DimensionScoreDto,
  DistribucionRiesgoDto,
  SocioPrediccionDto,
  PredictionResumenDto,
  PredictionsResponseDto,
  CuotasRiesgoResumenDto,
  CuotasRiesgoResponseDto,
  ConcentracionResponseDto,
  CuotaRiesgoDto,
  SocioRetencionDto,
  RetencionResumenDto,
  RetencionResponseDto,
  SocioRecuperableDto,
  RecuperabilidadResumenDto,
  RecuperabilidadResponseDto,
} from './dto/dashboard-response.dto';

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(
    @InjectRepository(SabanaAhorro, 'SEGURIDAD_DB')
    private readonly sabanaAhorroRepo: Repository<SabanaAhorro>,

    @InjectRepository(SabanaCredito, 'SEGURIDAD_DB')
    private readonly sabanaCreditoRepo: Repository<SabanaCredito>,
  ) {}


  /**
   * Obtiene la lista paginada de socios con crédito activo en el corte más reciente.
   *
   * Definición de activo:
   * - qy_fechaproc = (último corte disponible)
   * - estado_op = 'VIGENTE'
   * - saldo_capital > 0
   */
  async getActiveCredits(
    page: number,
    limit: number,
    search?: string,
  ): Promise<ActiveCreditsResponseDto> {
    try {
      // 1. Obtener la fecha del corte más reciente para créditos
      const maxDateRaw = await this.sabanaCreditoRepo
        .createQueryBuilder('c')
        .select('MAX(c.qyFechaproc)', 'maxDate')
        .getRawOne<{ maxDate: string }>();

      const maxDate = maxDateRaw?.maxDate ? new Date(maxDateRaw.maxDate) : null;

      if (!maxDate) {
        return {
          data: [],
          total: 0,
          page,
          limit,
        };
      }

      // 2. Construir la consulta principal
      const query = this.sabanaCreditoRepo
        .createQueryBuilder('c')
        .where('c.qyFechaproc = :maxDate', { maxDate })
        .andWhere("c.estadoOp = 'VIGENTE'")
        .andWhere('c.saldoCapital > 0');

      if (search && search.trim() !== '') {
        const term = `%${search.trim()}%`;
        query.andWhere(
          '(c.nombresSocio ILIKE :term OR c.nroCliente ILIKE :term OR c.nroOperacion ILIKE :term)',
          { term },
        );
      }

      const total = await query.getCount();

      const rawItems = await query
        .orderBy('c.saldoCapital', 'DESC')
        .offset((page - 1) * limit)
        .limit(limit)
        .getMany();

      const data: ActiveCreditDto[] = rawItems.map((item) => ({
        nroCliente: item.nroCliente ?? '',
        nombresSocio: item.nombresSocio ?? '',
        nroOperacion: item.nroOperacion,
        estadoOp: item.estadoOp,
        montoCredito: item.montoCredito ? parseFloat(item.montoCredito) : 0,
        saldoCapital: item.saldoCapital ?? 0,
        diasMora: item.diasMora ? parseInt(item.diasMora, 10) : 0,
        calificacion: item.calificacion ?? '',
        fechaConcesionOp: item.fechaConcesionOp,
      }));

      return {
        data,
        total,
        page,
        limit,
      };
    } catch (error) {
      this.logger.error('Error en getActiveCredits', error);
      throw error;
    }
  }

  // ─── KPI 7: Riesgo de Morosidad por Socio ─────────────────────────────────

  /**
   * Calcula el score de riesgo de morosidad por socio, desglosado en 5 dimensiones.
   *
   * Dimensiones (pesos):
   *  1. Comportamiento Transaccional (15%) — actividad reciente
   *  2. Estabilidad de Ahorro         (20%) — evolución del saldo
   *  3. Historial Crediticio          (25%) — calificación, mora, atrasos
   *  4. Señales de Deterioro          (10%) — combinación de señales
   *  5. Perfil Socioeconómico         (15%) — capacidad de pago, vivienda
   *  6. Actividad Económica           (10%) — sector y destino del crédito
   *  7. Garantías y Patrimonio        (5%)  — cobertura
   *
   * Score 0-30 = Bajo | 31-60 = Medio | 61-80 = Alto | 81-100 = Crítico
   *
   * @param page  Número de página (1-indexed)
   * @param limit Registros por página
   * @param nivel Filtro opcional por nivel: 'Bajo' | 'Medio' | 'Alto' | 'Crítico'
   */
  async getDelinquencyRisk(
    page: number,
    limit: number,
    nivel?: string,
  ): Promise<DelinquencyRiskResponseDto> {
    try {
      const offset = (page - 1) * limit;

      // Condición de nivel como filtro SQL
      let nivelFilter = '';
      if (nivel) {
        switch (nivel) {
          case 'Bajo':    nivelFilter = 'AND score_global BETWEEN 0 AND 30';   break;
          case 'Medio':   nivelFilter = 'AND score_global BETWEEN 31 AND 60';  break;
          case 'Alto':    nivelFilter = 'AND score_global BETWEEN 61 AND 80';  break;
          case 'Crítico': nivelFilter = 'AND score_global BETWEEN 81 AND 100'; break;
        }
      }

      const sql = `
        WITH
        -- ─── Cortes más recientes ──────────────────────────────────────────────
        max_ahorro AS (
          SELECT MAX(fecha_proceso) AS fecha FROM sabana_ahorro
        ),
        prev_ahorro AS (
          SELECT fecha_proceso AS fecha
          FROM sabana_ahorro
          GROUP BY fecha_proceso
          ORDER BY fecha_proceso DESC
          OFFSET 1 LIMIT 1
        ),
        max_credito AS (
          SELECT MAX(qy_fechaproc) AS fecha FROM sabana_credito
        ),

        -- ─── Corte reciente de ahorro (socio único por v_ah_cliente) ──────────
        base_ahorro AS (
          SELECT DISTINCT ON (v_ah_cliente)
            v_ah_cliente,
            v_ah_nombre,
            saldo_disponible,
            monto_bloq,
            val_de_creditos,
            val_de_debitos
          FROM sabana_ahorro
          WHERE fecha_proceso = (SELECT fecha FROM max_ahorro)
          ORDER BY v_ah_cliente, saldo_disponible DESC
        ),

        -- ─── Corte anterior de ahorro (para calcular tendencia) ───────────────
        prev_base AS (
          SELECT DISTINCT ON (v_ah_cliente)
            v_ah_cliente,
            saldo_disponible AS saldo_prev
          FROM sabana_ahorro
          WHERE fecha_proceso = (SELECT fecha FROM prev_ahorro)
          ORDER BY v_ah_cliente
        ),

        -- ─── Perfil crediticio + datos socioeconómicos del socio ───────────────
        credit_profile AS (
          SELECT
            nro_cliente,
            -- Historial crediticio interno
            MAX(CASE calificacion
              WHEN 'A1' THEN 5  WHEN 'A2' THEN 25 WHEN 'A3' THEN 45
              WHEN 'B1' THEN 60 WHEN 'B2' THEN 75
              WHEN 'C1' THEN 85 WHEN 'C2' THEN 90
              WHEN 'D'  THEN 95 WHEN 'E'  THEN 100
              ELSE 0 END)                                                AS cal_score,
            MAX(COALESCE(CAST(NULLIF(dias_mora,'') AS FLOAT), 0))       AS max_dias_mora,
            MAX(COALESCE(CAST(NULLIF(nro_cuotas_atra,'') AS FLOAT), 0)) AS max_cuotas_atra,
            -- Factores socioeconómicos externos
            MAX(COALESCE(CAST(NULLIF(nro_cargas_fam,'') AS FLOAT), 0))  AS max_cargas,
            MAX(COALESCE(CAST(NULLIF(ingresos_socio,'') AS FLOAT), 0))  AS ingresos,
            MAX(COALESCE(CAST(NULLIF(egresos_socio,'')  AS FLOAT), 0))  AS egresos,
            MAX(COALESCE(tipo_vivien,  ''))                              AS tipo_vivien,
            MAX(COALESCE(nivel_educa,  ''))                             AS nivel_educa,
            MAX(COALESCE(estado_civil, ''))                             AS estado_civil,
            -- Actividad económica externa
            MAX(COALESCE(actividad_socio, ''))                          AS actividad_socio,
            MAX(COALESCE(destino_op,     ''))                           AS destino_op,
            -- Garantías
            MAX(COALESCE(tgarantia, ''))                                AS tgarantia,
            MAX(COALESCE(CAST(NULLIF(valgarantias,'') AS FLOAT), 0))    AS valgarantias,
            MAX(COALESCE(CAST(NULLIF(monto_credito,'') AS FLOAT), 0))   AS monto_credito_max
          FROM sabana_credito
          WHERE qy_fechaproc = (SELECT fecha FROM max_credito)
          GROUP BY nro_cliente
        ),

        -- ─── Actividad transaccional por socio (últimos 60 días) ──────────────
        tx_activity AS (
          SELECT
            CAST(nro_cliente AS BIGINT)  AS v_ah_cliente,
            COUNT(*)                     AS num_tx,
            MAX(fecha_trn)               AS ultima_tx
          FROM transacciones
          WHERE fecha_trn >= NOW() - INTERVAL '60 days'
            AND nro_cliente IS NOT NULL
          GROUP BY nro_cliente
        ),

        -- ─── Saldo promedio histórico por socio ─────────────────────────────
        avg_saldo AS (
          SELECT
            v_ah_cliente,
            ROUND(CAST(AVG(saldo_disponible) AS NUMERIC), 2) AS saldo_promedio
          FROM sabana_ahorro
          GROUP BY v_ah_cliente
        ),

        -- ─── Scoring por socio (7 dimensiones: 4 internas + 3 externas) ─────
        scoring AS (
          SELECT
            a.v_ah_cliente,
            a.v_ah_nombre,
            COALESCE(av.saldo_promedio, a.saldo_disponible) AS saldo_promedio,

            /* ─ D1: Comportamiento Transaccional (15%) ─ INTERNA */
            LEAST(100, GREATEST(0,
              CASE
                WHEN tx.num_tx IS NULL  THEN 75
                WHEN tx.num_tx < 3      THEN 55
                WHEN tx.num_tx < 10     THEN 30
                WHEN tx.num_tx < 20     THEN 15
                ELSE 5
              END +
              CASE
                WHEN (a.val_de_debitos > 0 AND a.val_de_creditos = 0) THEN 15
                WHEN (a.val_de_debitos > a.val_de_creditos * 2)       THEN 10
                ELSE 0
              END
            )) AS d1_transaccional,

            /* ─ D2: Estabilidad de Ahorro (20%) ─ INTERNA */
            LEAST(100, GREATEST(0,
              CASE
                WHEN p.saldo_prev IS NULL OR p.saldo_prev <= 0 THEN
                  CASE WHEN a.saldo_disponible < 50 THEN 60 ELSE 15 END
                WHEN ((p.saldo_prev - a.saldo_disponible) / p.saldo_prev) >= 0.70 THEN 90
                WHEN ((p.saldo_prev - a.saldo_disponible) / p.saldo_prev) >= 0.50 THEN 70
                WHEN ((p.saldo_prev - a.saldo_disponible) / p.saldo_prev) >= 0.25 THEN 45
                WHEN a.saldo_disponible < 50  THEN 35
                WHEN a.monto_bloq > 0         THEN 20
                WHEN a.saldo_disponible > p.saldo_prev THEN 5
                ELSE 10
              END
            )) AS d2_ahorro,

            /* ─ D3: Historial Crediticio (25%) ─ INTERNA */
            COALESCE(
              LEAST(100,
                (c.cal_score * 0.50) +
                (CASE
                  WHEN c.max_dias_mora = 0    THEN 0
                  WHEN c.max_dias_mora <= 15  THEN 20
                  WHEN c.max_dias_mora <= 30  THEN 40
                  WHEN c.max_dias_mora <= 60  THEN 70
                  ELSE 100
                END * 0.30) +
                (CASE
                  WHEN c.max_cuotas_atra = 0 THEN 0
                  WHEN c.max_cuotas_atra = 1 THEN 20
                  WHEN c.max_cuotas_atra = 2 THEN 45
                  ELSE 80
                END * 0.20)
              ),
              0
            ) AS d3_credito,

            /* ─ D4: Señales de Deterioro (10%) ─ INTERNA */
            LEAST(100, GREATEST(0,
              CASE WHEN COALESCE(c.max_dias_mora, 0) > 0
                        AND p.saldo_prev IS NOT NULL
                        AND a.saldo_disponible < p.saldo_prev * 0.75
                   THEN 90 ELSE 0 END +
              CASE WHEN tx.num_tx IS NULL
                        AND p.saldo_prev IS NOT NULL
                        AND a.saldo_disponible < p.saldo_prev * 0.80
                   THEN 60 ELSE 0 END +
              CASE WHEN a.monto_bloq > 0 AND COALESCE(c.max_dias_mora, 0) > 0
                   THEN 40 ELSE 0 END
            )) AS d4_deterioro,

            /* ─ D5: Perfil Socioeconómico (15%) ─ EXTERNA */
            LEAST(100, GREATEST(0,
              (CASE
                WHEN COALESCE(c.ingresos, 0) = 0          THEN 45
                WHEN (c.egresos / NULLIF(c.ingresos,0)) > 0.85 THEN 65
                WHEN (c.egresos / NULLIF(c.ingresos,0)) > 0.60 THEN 35
                ELSE 10
              END * 0.30) +
              (CASE
                WHEN c.max_cargas = 0                        THEN 0
                WHEN c.max_cargas BETWEEN 1 AND 2            THEN 15
                WHEN c.max_cargas BETWEEN 3 AND 4            THEN 35
                ELSE 55
              END * 0.20) +
              (CASE UPPER(COALESCE(c.tipo_vivien,''))
                WHEN 'PROPIA'    THEN 0
                WHEN 'FAMILIAR'  THEN 15
                WHEN 'ARRENDADA' THEN 30
                ELSE 20
              END * 0.15) +
              (CASE
                WHEN UPPER(COALESCE(c.nivel_educa,'')) IN ('SUPERIOR','POSTGRADO','TERCER NIVEL','4TO NIVEL','CUARTO NIVEL') THEN 5
                WHEN UPPER(COALESCE(c.nivel_educa,'')) IN ('BACHILLERATO','SECUNDARIA','BACHILLER') THEN 15
                WHEN UPPER(COALESCE(c.nivel_educa,'')) IN ('PRIMARIA','BASICA','BÁSICA') THEN 28
                WHEN UPPER(COALESCE(c.nivel_educa,'')) IN ('NINGUNA','NINGUNO') THEN 45
                WHEN c.nivel_educa IS NULL OR c.nivel_educa = '' THEN 25
                ELSE 20
              END * 0.20) +
              (CASE
                WHEN UPPER(COALESCE(c.estado_civil,'')) IN ('CASADO','CASADA','UNION LIBRE','UNION DE HECHO','UNIÓN LIBRE') THEN 5
                WHEN UPPER(COALESCE(c.estado_civil,'')) IN ('SOLTERO','SOLTERA') THEN 15
                WHEN UPPER(COALESCE(c.estado_civil,'')) IN ('DIVORCIADO','DIVORCIADA','SEPARADO','SEPARADA') THEN 22
                WHEN UPPER(COALESCE(c.estado_civil,'')) IN ('VIUDO','VIUDA') THEN 28
                WHEN c.estado_civil IS NULL OR c.estado_civil = '' THEN 15
                ELSE 15
              END * 0.15)
            )) AS d5_socioeconomico,

            /* ─ D6: Actividad Económica (10%) ─ EXTERNA */
            LEAST(100, GREATEST(0,
              (CASE
                WHEN UPPER(COALESCE(c.actividad_socio,'')) LIKE '%AGRICULTUR%' THEN 40
                WHEN UPPER(COALESCE(c.actividad_socio,'')) LIKE '%GANADERIA%'  THEN 38
                WHEN UPPER(COALESCE(c.actividad_socio,'')) LIKE '%PESCA%'      THEN 42
                WHEN UPPER(COALESCE(c.actividad_socio,'')) LIKE '%CONSTRUCCI%' THEN 30
                WHEN UPPER(COALESCE(c.actividad_socio,'')) LIKE '%COMERCIO%'   THEN 25
                WHEN UPPER(COALESCE(c.actividad_socio,'')) LIKE '%SERVICIO%'   THEN 20
                WHEN UPPER(COALESCE(c.actividad_socio,'')) LIKE '%INDUSTRI%'   THEN 22
                WHEN UPPER(COALESCE(c.actividad_socio,'')) LIKE '%ARTESANAL%'  THEN 30
                WHEN c.actividad_socio IS NULL OR c.actividad_socio = ''       THEN 35
                ELSE 28
              END * 0.50) +
              (CASE
                WHEN UPPER(COALESCE(c.destino_op,'')) LIKE '%VIVIENDA%'     THEN 10
                WHEN UPPER(COALESCE(c.destino_op,'')) LIKE '%CAPITAL%'      THEN 20
                WHEN UPPER(COALESCE(c.destino_op,'')) LIKE '%PRODUCTI%'     THEN 18
                WHEN UPPER(COALESCE(c.destino_op,'')) LIKE '%CONSUMO%'      THEN 35
                WHEN UPPER(COALESCE(c.destino_op,'')) LIKE '%AGRICULT%'     THEN 38
                WHEN UPPER(COALESCE(c.destino_op,'')) LIKE '%COMERCI%'      THEN 25
                WHEN c.destino_op IS NULL OR c.destino_op = ''              THEN 30
                ELSE 28
              END * 0.50)
            )) AS d6_actividad,

            /* ─ D7: Garantías y Patrimonio (5%) ─ EXTERNA */
            LEAST(100, GREATEST(0,
              (CASE
                WHEN UPPER(COALESCE(c.tgarantia,'')) LIKE '%HIPOTECARIA%'    THEN 5
                WHEN UPPER(COALESCE(c.tgarantia,'')) LIKE '%PRENDARIA%'      THEN 15
                WHEN UPPER(COALESCE(c.tgarantia,'')) LIKE '%PERSONAL%'       THEN 25
                WHEN UPPER(COALESCE(c.tgarantia,'')) LIKE '%QUIROGRAFARIA%'  THEN 35
                WHEN UPPER(COALESCE(c.tgarantia,'')) LIKE '%QUIROG%'         THEN 35
                WHEN c.tgarantia IS NULL OR c.tgarantia = ''                 THEN 40
                ELSE 30
              END * 0.60) +
              (CASE
                WHEN COALESCE(c.monto_credito_max,0) = 0                              THEN 35
                WHEN c.valgarantias >= c.monto_credito_max * 1.5                      THEN 5
                WHEN c.valgarantias >= c.monto_credito_max                            THEN 12
                WHEN c.valgarantias >= c.monto_credito_max * 0.5                      THEN 25
                WHEN c.valgarantias > 0                                               THEN 40
                ELSE 55
              END * 0.40)
            )) AS d7_garantias,

            /* Señal principal */
            CASE
              WHEN COALESCE(c.max_dias_mora, 0) > 30
                   AND p.saldo_prev > 0
                   AND a.saldo_disponible < p.saldo_prev * 0.75
                   THEN 'Mora de ' || c.max_dias_mora::TEXT || ' días + saldo cayó ' ||
                        ROUND(CAST((p.saldo_prev - a.saldo_disponible) / p.saldo_prev * 100 AS NUMERIC), 0)::TEXT ||
                        '% en el último mes'
              WHEN COALESCE(c.max_dias_mora, 0) BETWEEN 1 AND 30
                   AND p.saldo_prev > 0
                   AND a.saldo_disponible < p.saldo_prev * 0.75
                   THEN 'Mora de ' || c.max_dias_mora::TEXT || ' días + caída de ahorros del ' ||
                        ROUND(CAST((p.saldo_prev - a.saldo_disponible) / p.saldo_prev * 100 AS NUMERIC), 0)::TEXT || '%'

              /* 2. Cuotas atrasadas múltiples */
              WHEN COALESCE(c.max_cuotas_atra, 0) >= 3
                   THEN COALESCE(c.max_cuotas_atra::TEXT, '0') || ' cuotas vencidas sin regularizar'
              WHEN COALESCE(c.max_cuotas_atra, 0) = 2
                   THEN '2 cuotas vencidas — micro-retrasos 2 meses consecutivos'

              /* 3. Caída severa de ahorros ≥ 70% */
              WHEN p.saldo_prev > 0
                   AND ((p.saldo_prev - a.saldo_disponible) / p.saldo_prev) >= 0.70
                   THEN 'Saldo ahorro cayó ' ||
                        ROUND(CAST((p.saldo_prev - a.saldo_disponible) / p.saldo_prev * 100 AS NUMERIC), 0)::TEXT ||
                        '% — pérdida crítica de liquidez'

              /* 4. Caída severa de ahorros 50-70% */
              WHEN p.saldo_prev > 0
                   AND ((p.saldo_prev - a.saldo_disponible) / p.saldo_prev) >= 0.50
                   THEN 'Saldo ahorro cayó ' ||
                        ROUND(CAST((p.saldo_prev - a.saldo_disponible) / p.saldo_prev * 100 AS NUMERIC), 0)::TEXT ||
                        '% en las últimas semanas'

              /* 5. Inactividad total + saldo bajo */
              WHEN tx.num_tx IS NULL AND a.saldo_disponible < 50
                   THEN 'Sin movimientos + saldo disponible crítico ($' ||
                        ROUND(a.saldo_disponible::NUMERIC, 2)::TEXT || ')'

              /* 6. Inactividad total */
              WHEN tx.num_tx IS NULL
                   THEN 'Sin débitos/créditos en los últimos 60 días'

              /* 7. Muy poca actividad: 1 transacción */
              WHEN tx.num_tx = 1
                   THEN 'Solo 1 transacción registrada en los últimos 60 días'

              /* 8. Muy poca actividad: 2 transacciones */
              WHEN tx.num_tx = 2
                   THEN 'Solo 2 transacciones en 60 días — actividad mínima'

              /* 9. Mora alta > 30 días */
              WHEN COALESCE(c.max_dias_mora, 0) > 30
                   THEN 'Mora de ' || c.max_dias_mora::TEXT || ' días — nivel de riesgo elevado'

              /* 10. Micro-retrasos 1-30 días con calificación A2/A3 */
              WHEN COALESCE(c.max_dias_mora, 0) BETWEEN 1 AND 30
                   AND COALESCE(c.cal_score, 0) IN (25, 45)
                   THEN 'Micro-retrasos: ' || c.max_dias_mora::TEXT || ' días mora — calificación A2/A3'

              /* 11. Calificación B2 o peor */
              WHEN COALESCE(c.cal_score, 0) >= 85
                   THEN 'Calificación C1/C2 — alto riesgo regulatorio'

              /* 12. Calificación B2 */
              WHEN COALESCE(c.cal_score, 0) >= 75
                   THEN 'Calificación B2 — en zona de riesgo'

              /* 13. Calificación B1 */
              WHEN COALESCE(c.cal_score, 0) >= 60
                   THEN 'Calificación B1 — señal temprana de deterioro'

              /* 14. Bloqueo que supera 50% del saldo */
              WHEN a.monto_bloq > 0 AND a.saldo_disponible > 0
                   AND a.monto_bloq > a.saldo_disponible * 0.5
                   THEN 'Bloqueo de $' || ROUND(a.monto_bloq::NUMERIC, 0)::TEXT ||
                        ' representa más del 50% del saldo disponible'

              /* 15. Bloqueo con mora */
              WHEN a.monto_bloq > 0 AND COALESCE(c.max_dias_mora, 0) > 0
                   THEN 'Cuenta bloqueada ($' || ROUND(a.monto_bloq::NUMERIC, 0)::TEXT || ') con mora activa'

              /* 16. Saldo disponible muy bajo */
              WHEN a.saldo_disponible < 50
                   THEN 'Saldo disponible crítico: $' || ROUND(a.saldo_disponible::NUMERIC, 2)::TEXT

              /* 17. Caída moderada de ahorros 25-50% */
              WHEN p.saldo_prev > 0
                   AND ((p.saldo_prev - a.saldo_disponible) / p.saldo_prev) >= 0.25
                   THEN 'Tendencia negativa: saldo cayó ' ||
                        ROUND(CAST((p.saldo_prev - a.saldo_disponible) / p.saldo_prev * 100 AS NUMERIC), 0)::TEXT ||
                        '% en las últimas semanas'

              /* 18. Egresos superan ingresos marcadamente */
              WHEN COALESCE(c.ingresos, 0) > 0
                   AND (COALESCE(c.egresos, 0) / NULLIF(c.ingresos, 0)) > 0.85
                   THEN 'Egresos representan el ' ||
                        ROUND(CAST(c.egresos / NULLIF(c.ingresos, 0) * 100 AS NUMERIC), 0)::TEXT ||
                        '% de sus ingresos declarados'

              /* 19. Relación egresos/ingresos deteriorada */
              WHEN COALESCE(c.ingresos, 0) > 0
                   AND (COALESCE(c.egresos, 0) / NULLIF(c.ingresos, 0)) > 0.60
                   THEN 'Relación egresos/ingresos deteriorada (' ||
                        ROUND(CAST(c.egresos / NULLIF(c.ingresos, 0) * 100 AS NUMERIC), 0)::TEXT || '%)'

              /* 20. Actividad reducida 3-5 transacciones */
              WHEN tx.num_tx IS NOT NULL AND tx.num_tx BETWEEN 3 AND 5
                   THEN 'Actividad muy reducida: ' || tx.num_tx::TEXT || ' movimientos en los últimos 60 días'

              /* 21. Saldo bajo sin señal directa */
              WHEN a.saldo_disponible < 200
                   THEN 'Saldo disponible bajo: $' || ROUND(a.saldo_disponible::NUMERIC, 2)::TEXT

              ELSE 'Sin señal crítica identificada'
            END AS senal_principal

          FROM base_ahorro a
          LEFT JOIN prev_base      p  ON a.v_ah_cliente = p.v_ah_cliente
          LEFT JOIN credit_profile c  ON CAST(a.v_ah_cliente AS BIGINT)::TEXT = c.nro_cliente
          LEFT JOIN tx_activity    tx ON a.v_ah_cliente = tx.v_ah_cliente
          LEFT JOIN avg_saldo      av ON a.v_ah_cliente = av.v_ah_cliente
        ),

        -- ─── Score global + scores normalizados por grupo ─────────────────────────────────
        resultado AS (
          SELECT
            v_ah_cliente,
            v_ah_nombre,
            d1_transaccional,
            d2_ahorro,
            d3_credito,
            d4_deterioro,
            d5_socioeconomico,
            d6_actividad,
            d7_garantias,
            senal_principal,
            saldo_promedio,
            -- Score global ponderado (suma de 7 dimensiones)
            ROUND(CAST(
              (d1_transaccional  * 0.15) +
              (d2_ahorro         * 0.20) +
              (d3_credito        * 0.25) +
              (d4_deterioro      * 0.10) +
              (d5_socioeconomico * 0.15) +
              (d6_actividad      * 0.10) +
              (d7_garantias      * 0.05)
            AS NUMERIC), 2) AS score_global,
            -- Score interno: dimensiones 1-4 normalizadas sobre su peso total (0.70)
            ROUND(CAST(
              ((d1_transaccional * 0.15) + (d2_ahorro * 0.20) + (d3_credito * 0.25) + (d4_deterioro * 0.10)) / 0.70
            AS NUMERIC), 2) AS score_interno,
            -- Score externo: dimensiones 5-7 normalizadas sobre su peso total (0.30)
            ROUND(CAST(
              ((d5_socioeconomico * 0.15) + (d6_actividad * 0.10) + (d7_garantias * 0.05)) / 0.30
            AS NUMERIC), 2) AS score_externo
          FROM scoring
        )

        SELECT
          v_ah_cliente,
          v_ah_nombre,
          d1_transaccional,
          d2_ahorro,
          d3_credito,
          d4_deterioro,
          d5_socioeconomico,
          d6_actividad,
          d7_garantias,
          senal_principal,
          saldo_promedio,
          score_global,
          score_interno,
          score_externo,
          ROUND(CAST(
            100.0 / (1.0 + EXP(-0.09 * (score_global - 45)))
          AS NUMERIC), 1) AS prob_mora,
          CASE
            WHEN score_global <= 30 THEN 'Bajo'
            WHEN score_global <= 60 THEN 'Medio'
            WHEN score_global <= 80 THEN 'Alto'
            ELSE 'Crítico'
          END AS nivel_riesgo
        FROM resultado
        WHERE 1=1 ${nivelFilter}
        ORDER BY score_global DESC
        LIMIT $1 OFFSET $2;
      `;

      // Consulta de totales y distribución (sin paginación)
      const sqlDistribucion = `
        WITH
        max_ahorro  AS (SELECT MAX(fecha_proceso) AS fecha FROM sabana_ahorro),
        prev_ahorro AS (
          SELECT fecha_proceso AS fecha FROM sabana_ahorro
          GROUP BY fecha_proceso ORDER BY fecha_proceso DESC OFFSET 1 LIMIT 1
        ),
        max_credito AS (SELECT MAX(qy_fechaproc) AS fecha FROM sabana_credito),
        base_ahorro AS (
          SELECT DISTINCT ON (v_ah_cliente)
            v_ah_cliente, saldo_disponible, monto_bloq, val_de_creditos, val_de_debitos
          FROM sabana_ahorro WHERE fecha_proceso = (SELECT fecha FROM max_ahorro)
          ORDER BY v_ah_cliente, saldo_disponible DESC
        ),
        prev_base AS (
          SELECT DISTINCT ON (v_ah_cliente) v_ah_cliente, saldo_disponible AS saldo_prev
          FROM sabana_ahorro WHERE fecha_proceso = (SELECT fecha FROM prev_ahorro)
          ORDER BY v_ah_cliente
        ),
        credit_profile AS (
          SELECT nro_cliente,
            MAX(CASE calificacion WHEN 'A1' THEN 5  WHEN 'A2' THEN 25 WHEN 'A3' THEN 45
              WHEN 'B1' THEN 60 WHEN 'B2' THEN 75 WHEN 'C1' THEN 85 WHEN 'C2' THEN 90
              WHEN 'D' THEN 95  WHEN 'E'  THEN 100 ELSE 0 END) AS cal_score,
            MAX(COALESCE(CAST(NULLIF(dias_mora,'') AS FLOAT), 0))        AS max_dias_mora,
            MAX(COALESCE(CAST(NULLIF(nro_cuotas_atra,'') AS FLOAT), 0))  AS max_cuotas_atra,
            MAX(COALESCE(CAST(NULLIF(nro_cargas_fam,'') AS FLOAT), 0))   AS max_cargas,
            MAX(COALESCE(CAST(NULLIF(ingresos_socio,'') AS FLOAT), 0))   AS ingresos,
            MAX(COALESCE(CAST(NULLIF(egresos_socio,'')  AS FLOAT), 0))   AS egresos,
            MAX(COALESCE(tipo_vivien,  ''))                               AS tipo_vivien,
            MAX(COALESCE(nivel_educa,  ''))                               AS nivel_educa,
            MAX(COALESCE(estado_civil, ''))                               AS estado_civil,
            MAX(COALESCE(actividad_socio, ''))                            AS actividad_socio,
            MAX(COALESCE(destino_op,     ''))                             AS destino_op,
            MAX(COALESCE(tgarantia, ''))                                  AS tgarantia,
            MAX(COALESCE(CAST(NULLIF(valgarantias,'') AS FLOAT), 0))      AS valgarantias,
            MAX(COALESCE(CAST(NULLIF(monto_credito,'') AS FLOAT), 0))     AS monto_credito_max
          FROM sabana_credito WHERE qy_fechaproc = (SELECT fecha FROM max_credito)
          GROUP BY nro_cliente
        ),
        tx_activity AS (
          SELECT CAST(nro_cliente AS BIGINT) AS v_ah_cliente, COUNT(*) AS num_tx
          FROM transacciones WHERE fecha_trn >= NOW() - INTERVAL '60 days'
            AND nro_cliente IS NOT NULL GROUP BY nro_cliente
        ),
        scoring AS (
          SELECT
            LEAST(100,GREATEST(0,
              CASE WHEN tx.num_tx IS NULL THEN 75 WHEN tx.num_tx<3 THEN 55
                   WHEN tx.num_tx<10 THEN 30 WHEN tx.num_tx<20 THEN 15 ELSE 5 END +
              CASE WHEN (a.val_de_debitos>0 AND a.val_de_creditos=0) THEN 15
                   WHEN (a.val_de_debitos>a.val_de_creditos*2) THEN 10 ELSE 0 END
            )) AS d1,
            COALESCE(LEAST(100,(c.cal_score*0.50)+
              (CASE WHEN c.max_dias_mora=0 THEN 0 WHEN c.max_dias_mora<=15 THEN 20
                WHEN c.max_dias_mora<=30 THEN 40 WHEN c.max_dias_mora<=60 THEN 70
                ELSE 100 END*0.30)+
              (CASE WHEN c.max_cuotas_atra=0 THEN 0 WHEN c.max_cuotas_atra=1 THEN 20
                WHEN c.max_cuotas_atra=2 THEN 45 ELSE 80 END*0.20)),0) AS d2,
            LEAST(100,GREATEST(0,CASE
              WHEN p.saldo_prev IS NULL OR p.saldo_prev<=0 THEN
                CASE WHEN a.saldo_disponible<50 THEN 60 ELSE 15 END
              WHEN ((p.saldo_prev-a.saldo_disponible)/p.saldo_prev)>=0.70 THEN 90
              WHEN ((p.saldo_prev-a.saldo_disponible)/p.saldo_prev)>=0.50 THEN 70
              WHEN ((p.saldo_prev-a.saldo_disponible)/p.saldo_prev)>=0.25 THEN 45
              WHEN a.saldo_disponible<50 THEN 35 WHEN a.monto_bloq>0 THEN 20
              WHEN a.saldo_disponible>p.saldo_prev THEN 5 ELSE 10 END
            )) AS d3,
            /* D4: Señales de deterioro */
            LEAST(100,GREATEST(0,
              CASE WHEN COALESCE(c.max_dias_mora,0)>0 AND p.saldo_prev IS NOT NULL
                AND a.saldo_disponible<p.saldo_prev*0.75 THEN 90 ELSE 0 END+
              CASE WHEN tx.num_tx IS NULL AND p.saldo_prev IS NOT NULL
                AND a.saldo_disponible<p.saldo_prev*0.80 THEN 60 ELSE 0 END+
              CASE WHEN a.monto_bloq>0 AND COALESCE(c.max_dias_mora,0)>0 THEN 40 ELSE 0 END
            )) AS d4,
            /* D5: Perfil socioeconómico */
            LEAST(100,GREATEST(0,
              (CASE WHEN COALESCE(c.ingresos,0)=0 THEN 45
                WHEN (c.egresos/NULLIF(c.ingresos,0))>0.85 THEN 65
                WHEN (c.egresos/NULLIF(c.ingresos,0))>0.60 THEN 35 ELSE 10 END*0.30)+
              (CASE WHEN c.max_cargas=0 THEN 0 WHEN c.max_cargas<=2 THEN 15
                WHEN c.max_cargas<=4 THEN 35 ELSE 55 END*0.20)+
              (CASE UPPER(COALESCE(c.tipo_vivien,'')) WHEN 'PROPIA' THEN 0
                WHEN 'FAMILIAR' THEN 15 WHEN 'ARRENDADA' THEN 30 ELSE 20 END*0.15)+
              (CASE WHEN UPPER(COALESCE(c.nivel_educa,'')) IN ('SUPERIOR','POSTGRADO','TERCER NIVEL','4TO NIVEL','CUARTO NIVEL') THEN 5
                WHEN UPPER(COALESCE(c.nivel_educa,'')) IN ('BACHILLERATO','SECUNDARIA','BACHILLER') THEN 15
                WHEN UPPER(COALESCE(c.nivel_educa,'')) IN ('PRIMARIA','BASICA','BÁSICA') THEN 28
                WHEN UPPER(COALESCE(c.nivel_educa,'')) IN ('NINGUNA','NINGUNO') THEN 45
                WHEN c.nivel_educa IS NULL OR c.nivel_educa='' THEN 25 ELSE 20 END*0.20)+
              (CASE WHEN UPPER(COALESCE(c.estado_civil,'')) IN ('CASADO','CASADA','UNION LIBRE','UNION DE HECHO','UNIÓN LIBRE') THEN 5
                WHEN UPPER(COALESCE(c.estado_civil,'')) IN ('SOLTERO','SOLTERA') THEN 15
                WHEN UPPER(COALESCE(c.estado_civil,'')) IN ('DIVORCIADO','DIVORCIADA','SEPARADO','SEPARADA') THEN 22
                WHEN UPPER(COALESCE(c.estado_civil,'')) IN ('VIUDO','VIUDA') THEN 28
                ELSE 15 END*0.15)
            )) AS d5,
            /* D6: Actividad económica */
            LEAST(100,GREATEST(0,
              (CASE WHEN UPPER(COALESCE(c.actividad_socio,'')) LIKE '%AGRICULTUR%' THEN 40
                WHEN UPPER(COALESCE(c.actividad_socio,'')) LIKE '%GANADERIA%' THEN 38
                WHEN UPPER(COALESCE(c.actividad_socio,'')) LIKE '%PESCA%' THEN 42
                WHEN UPPER(COALESCE(c.actividad_socio,'')) LIKE '%CONSTRUCCI%' THEN 30
                WHEN UPPER(COALESCE(c.actividad_socio,'')) LIKE '%COMERCIO%' THEN 25
                WHEN UPPER(COALESCE(c.actividad_socio,'')) LIKE '%SERVICIO%' THEN 20
                WHEN UPPER(COALESCE(c.actividad_socio,'')) LIKE '%INDUSTRI%' THEN 22
                WHEN c.actividad_socio IS NULL OR c.actividad_socio='' THEN 35 ELSE 28 END*0.50)+
              (CASE WHEN UPPER(COALESCE(c.destino_op,'')) LIKE '%VIVIENDA%' THEN 10
                WHEN UPPER(COALESCE(c.destino_op,'')) LIKE '%CAPITAL%' THEN 20
                WHEN UPPER(COALESCE(c.destino_op,'')) LIKE '%PRODUCTI%' THEN 18
                WHEN UPPER(COALESCE(c.destino_op,'')) LIKE '%CONSUMO%' THEN 35
                WHEN UPPER(COALESCE(c.destino_op,'')) LIKE '%AGRICULT%' THEN 38
                WHEN c.destino_op IS NULL OR c.destino_op='' THEN 30 ELSE 28 END*0.50)
            )) AS d6,
            /* D7: Garantías */
            LEAST(100,GREATEST(0,
              (CASE WHEN UPPER(COALESCE(c.tgarantia,'')) LIKE '%HIPOTECARIA%' THEN 5
                WHEN UPPER(COALESCE(c.tgarantia,'')) LIKE '%PRENDARIA%' THEN 15
                WHEN UPPER(COALESCE(c.tgarantia,'')) LIKE '%PERSONAL%' THEN 25
                WHEN UPPER(COALESCE(c.tgarantia,'')) LIKE '%QUIROG%' THEN 35
                WHEN c.tgarantia IS NULL OR c.tgarantia='' THEN 40 ELSE 30 END*0.60)+
              (CASE WHEN COALESCE(c.monto_credito_max,0)=0 THEN 35
                WHEN c.valgarantias>=c.monto_credito_max*1.5 THEN 5
                WHEN c.valgarantias>=c.monto_credito_max THEN 12
                WHEN c.valgarantias>=c.monto_credito_max*0.5 THEN 25
                WHEN c.valgarantias>0 THEN 40 ELSE 55 END*0.40)
            )) AS d7
          FROM base_ahorro a
          LEFT JOIN prev_base      p  ON a.v_ah_cliente = p.v_ah_cliente
          LEFT JOIN credit_profile c  ON CAST(a.v_ah_cliente AS BIGINT)::TEXT = c.nro_cliente
          LEFT JOIN tx_activity    tx ON a.v_ah_cliente = tx.v_ah_cliente
        ),
        resultado AS (
          SELECT ROUND(CAST(
            (d1*0.15)+(d3*0.20)+(d2*0.25)+(d4*0.10)+(d5*0.15)+(d6*0.10)+(d7*0.05)
          AS NUMERIC),2) AS sg
          FROM scoring
        )
        SELECT
          COUNT(*) AS total,
          SUM(CASE WHEN sg <= 30 THEN 1 ELSE 0 END) AS bajo,
          SUM(CASE WHEN sg BETWEEN 31 AND 60 THEN 1 ELSE 0 END) AS medio,
          SUM(CASE WHEN sg BETWEEN 61 AND 80 THEN 1 ELSE 0 END) AS alto,
          SUM(CASE WHEN sg > 80 THEN 1 ELSE 0 END) AS critico,
          (SELECT fecha FROM max_ahorro)  AS fecha_ahorro,
          (SELECT fecha FROM max_credito) AS fecha_credito,

          /* Cartera total: suma de saldo capital de créditos vigentes en el último corte */
          (
            SELECT ROUND(CAST(SUM(saldo_capital) AS NUMERIC), 2)
            FROM sabana_credito
            WHERE qy_fechaproc = (SELECT MAX(qy_fechaproc) FROM sabana_credito)
              AND estado_op = 'VIGENTE'
              AND saldo_capital IS NOT NULL
          ) AS cartera_total,

          /* Tasa de mora: saldo en mora / cartera total * 100 (definición bancaria estándar) */
          (
            SELECT ROUND(CAST(
              SUM(CASE
                WHEN COALESCE(CAST(NULLIF(dias_mora, '') AS FLOAT), 0) > 0
                     THEN saldo_capital ELSE 0
              END) /
              NULLIF(SUM(saldo_capital), 0) * 100
            AS NUMERIC), 2)
            FROM sabana_credito
            WHERE qy_fechaproc = (SELECT MAX(qy_fechaproc) FROM sabana_credito)
              AND estado_op = 'VIGENTE'
              AND saldo_capital IS NOT NULL
          ) AS tasa_mora

        FROM resultado;
      `;

      const [rows, distRows] = await Promise.all([
        this.sabanaAhorroRepo.query(sql, [limit, offset]),
        this.sabanaAhorroRepo.query(sqlDistribucion),
      ]);

      const dist = distRows[0];

      const data: SocioRiesgoDto[] = rows.map((r: any) => {
        const d1 = parseFloat(r.d1_transaccional    ?? '0');
        const d2 = parseFloat(r.d2_ahorro           ?? '0');
        const d3 = parseFloat(r.d3_credito          ?? '0');
        const d4 = parseFloat(r.d4_deterioro        ?? '0');
        const d5 = parseFloat(r.d5_socioeconomico   ?? '0');
        const d6 = parseFloat(r.d6_actividad        ?? '0');
        const d7 = parseFloat(r.d7_garantias        ?? '0');

        const dimensiones: DimensionScoreDto[] = [
          // ─ INTERNAS ─
          { tipo: 'Interna', dimension: 'Comportamiento Transaccional', peso: 0.15, score: parseFloat(d1.toFixed(2)), contribucion: parseFloat((d1 * 0.15).toFixed(2)) },
          { tipo: 'Interna', dimension: 'Estabilidad de Ahorro',        peso: 0.20, score: parseFloat(d2.toFixed(2)), contribucion: parseFloat((d2 * 0.20).toFixed(2)) },
          { tipo: 'Interna', dimension: 'Historial Crediticio',         peso: 0.25, score: parseFloat(d3.toFixed(2)), contribucion: parseFloat((d3 * 0.25).toFixed(2)) },
          { tipo: 'Interna', dimension: 'Señales de Deterioro',         peso: 0.10, score: parseFloat(d4.toFixed(2)), contribucion: parseFloat((d4 * 0.10).toFixed(2)) },
          // ─ EXTERNAS ─
          { tipo: 'Externa', dimension: 'Perfil Socioeconómico',        peso: 0.15, score: parseFloat(d5.toFixed(2)), contribucion: parseFloat((d5 * 0.15).toFixed(2)) },
          { tipo: 'Externa', dimension: 'Actividad Económica',          peso: 0.10, score: parseFloat(d6.toFixed(2)), contribucion: parseFloat((d6 * 0.10).toFixed(2)) },
          { tipo: 'Externa', dimension: 'Garantías y Patrimonio',       peso: 0.05, score: parseFloat(d7.toFixed(2)), contribucion: parseFloat((d7 * 0.05).toFixed(2)) },
        ];

        return {
          nroCliente:       String(Math.floor(parseFloat(r.v_ah_cliente))),
          nombre:           r.v_ah_nombre ?? '',
          scoreGlobal:      parseFloat(r.score_global),
          scoreInterno:     parseFloat(parseFloat(r.score_interno ?? '0').toFixed(2)),
          scoreExterno:     parseFloat(parseFloat(r.score_externo ?? '0').toFixed(2)),
          nivelRiesgo:      r.nivel_riesgo,
          senalPrincipal:   r.senal_principal ?? 'Sin señal crítica identificada',
          saldoPromedio:    parseFloat(parseFloat(r.saldo_promedio ?? '0').toFixed(2)),
          probabilidadMora: parseFloat(parseFloat(r.prob_mora     ?? '0').toFixed(1)),
          dimensiones,
        };
      });

      const distribucion: DistribucionRiesgoDto = {
        bajo:    parseInt(dist?.bajo    ?? '0', 10),
        medio:   parseInt(dist?.medio   ?? '0', 10),
        alto:    parseInt(dist?.alto    ?? '0', 10),
        critico: parseInt(dist?.critico ?? '0', 10),
      };

      return {
        fechaCorteAhorro:  dist?.fecha_ahorro  ? (new Date(dist.fecha_ahorro).toISOString().split('T')[0]  ?? '') : '',
        fechaCorteCredito: dist?.fecha_credito ? (new Date(dist.fecha_credito).toISOString().split('T')[0] ?? '') : '',
        totalSocios:       parseInt(dist?.total        ?? '0', 10),
        carteraTotal:      parseFloat(parseFloat(dist?.cartera_total ?? '0').toFixed(2)),
        tasaMoraActual:    parseFloat(parseFloat(dist?.tasa_mora     ?? '0').toFixed(2)),
        distribucion,
        data,
        page,
        limit,
      };
    } catch (error) {
      this.logger.error('Error en getDelinquencyRisk', error);
      throw error;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Predicción de morosidad (horizonte 10, 20, 30 días)
  // ─────────────────────────────────────────────────────────────────────────────
  async getPredictions(
    page:     number,
    limit:    number,
    horizonte?: string,  // '10' | '20' | '30'
  ): Promise<PredictionsResponseDto> {
    try {
      const offset = (page - 1) * limit;

      let horizonteFilter = '';
      if (horizonte === '10') horizonteFilter = `AND horizonte = '10 días'`;
      if (horizonte === '20') horizonteFilter = `AND horizonte = '20 días'`;
      if (horizonte === '30') horizonteFilter = `AND horizonte = '30 días'`;

      // ─── SQL base (mismas CTEs que delinquency-risk) ──────────────────────
      const baseCtes = `
        max_ahorro  AS (SELECT MAX(fecha_proceso) AS fecha FROM sabana_ahorro),
        prev_ahorro AS (
          SELECT fecha_proceso AS fecha FROM sabana_ahorro
          GROUP BY fecha_proceso ORDER BY fecha_proceso LIMIT 1
        ),
        max_credito AS (SELECT MAX(qy_fechaproc) AS fecha FROM sabana_credito),
        base_ahorro AS (
          SELECT DISTINCT ON (v_ah_cliente)
            v_ah_cliente, v_ah_nombre, saldo_disponible, monto_bloq,
            val_de_creditos, val_de_debitos
          FROM sabana_ahorro WHERE fecha_proceso = (SELECT fecha FROM max_ahorro)
          ORDER BY v_ah_cliente, saldo_disponible DESC
        ),
        prev_base AS (
          SELECT DISTINCT ON (v_ah_cliente) v_ah_cliente,
            saldo_disponible AS saldo_prev
          FROM sabana_ahorro WHERE fecha_proceso = (SELECT fecha FROM prev_ahorro)
          ORDER BY v_ah_cliente
        ),
        credit_profile AS (
          SELECT nro_cliente,
            MAX(CASE calificacion WHEN 'A1' THEN 5  WHEN 'A2' THEN 25 WHEN 'A3' THEN 45
              WHEN 'B1' THEN 60 WHEN 'B2' THEN 75 WHEN 'C1' THEN 85 WHEN 'C2' THEN 90
              WHEN 'D' THEN 95 WHEN 'E' THEN 100 ELSE 0 END)            AS cal_score,
            MAX(COALESCE(CAST(NULLIF(dias_mora,'') AS FLOAT), 0))        AS max_dias_mora,
            MAX(COALESCE(CAST(NULLIF(nro_cuotas_atra,'') AS FLOAT), 0)) AS max_cuotas_atra,
            MAX(COALESCE(CAST(NULLIF(nro_cargas_fam,'') AS FLOAT), 0))  AS max_cargas,
            MAX(COALESCE(CAST(NULLIF(ingresos_socio,'') AS FLOAT), 0))  AS ingresos,
            MAX(COALESCE(CAST(NULLIF(egresos_socio,'')  AS FLOAT), 0))  AS egresos,
            MAX(COALESCE(tipo_vivien,  ''))                              AS tipo_vivien,
            MAX(COALESCE(nivel_educa,  ''))                              AS nivel_educa,
            MAX(COALESCE(estado_civil, ''))                              AS estado_civil,
            MAX(COALESCE(actividad_socio, ''))                           AS actividad_socio,
            MAX(COALESCE(destino_op, ''))                                AS destino_op,
            MAX(COALESCE(tgarantia, ''))                                 AS tgarantia,
            MAX(COALESCE(CAST(NULLIF(valgarantias,'') AS FLOAT), 0))     AS valgarantias,
            MAX(COALESCE(CAST(NULLIF(monto_credito,'') AS FLOAT), 0))    AS monto_credito_max,
            MAX(COALESCE(saldo_capital, 0))                              AS saldo_capital
          FROM sabana_credito WHERE qy_fechaproc = (SELECT fecha FROM max_credito)
          GROUP BY nro_cliente
        ),
        tx_activity AS (
          SELECT CAST(nro_cliente AS BIGINT) AS v_ah_cliente, COUNT(*) AS num_tx
          FROM transacciones WHERE fecha_trn >= NOW() - INTERVAL '60 days'
            AND nro_cliente IS NOT NULL GROUP BY nro_cliente
        ),
        avg_saldo AS (
          SELECT v_ah_cliente,
            ROUND(CAST(AVG(saldo_disponible) AS NUMERIC), 2) AS saldo_promedio
          FROM sabana_ahorro GROUP BY v_ah_cliente
        ),
        scoring AS (
          SELECT
            a.v_ah_cliente, a.v_ah_nombre,
            COALESCE(av.saldo_promedio, a.saldo_disponible) AS saldo_promedio,
            COALESCE(c.max_dias_mora, 0)  AS max_dias_mora,
            COALESCE(c.saldo_capital, 0)  AS saldo_capital,
            -- D1: Comportamiento Transaccional (15%)
            LEAST(100, GREATEST(0,
              CASE WHEN tx.num_tx IS NULL THEN 75 WHEN tx.num_tx<3 THEN 55
                   WHEN tx.num_tx<10 THEN 30 WHEN tx.num_tx<20 THEN 15 ELSE 5 END +
              CASE WHEN (a.val_de_debitos>0 AND a.val_de_creditos=0) THEN 15
                   WHEN (a.val_de_debitos>a.val_de_creditos*2) THEN 10 ELSE 0 END
            )) AS d1,
            -- D2: Estabilidad de Ahorro (20%)
            LEAST(100, GREATEST(0, CASE
              WHEN p.saldo_prev IS NULL OR p.saldo_prev<=0 THEN
                CASE WHEN a.saldo_disponible<50 THEN 60 ELSE 15 END
              WHEN ((p.saldo_prev-a.saldo_disponible)/p.saldo_prev)>=0.70 THEN 90
              WHEN ((p.saldo_prev-a.saldo_disponible)/p.saldo_prev)>=0.50 THEN 70
              WHEN ((p.saldo_prev-a.saldo_disponible)/p.saldo_prev)>=0.25 THEN 45
              WHEN a.saldo_disponible<50 THEN 35 WHEN a.monto_bloq>0 THEN 20
              WHEN a.saldo_disponible>p.saldo_prev THEN 5 ELSE 10 END
            )) AS d2,
            -- D3: Historial Crediticio (25%)
            COALESCE(LEAST(100,(c.cal_score*0.50)+
              (CASE WHEN COALESCE(c.max_dias_mora,0)=0 THEN 0
                WHEN c.max_dias_mora<=15 THEN 20 WHEN c.max_dias_mora<=30 THEN 40
                WHEN c.max_dias_mora<=60 THEN 70 ELSE 100 END*0.30)+
              (CASE WHEN COALESCE(c.max_cuotas_atra,0)=0 THEN 0
                WHEN c.max_cuotas_atra=1 THEN 20 WHEN c.max_cuotas_atra=2 THEN 45
                ELSE 80 END*0.20)),0) AS d3,
            -- D4: Señales de Deterioro (10%)
            LEAST(100, GREATEST(0,
              CASE WHEN COALESCE(c.max_dias_mora,0)>0
                        AND p.saldo_prev IS NOT NULL
                        AND a.saldo_disponible<p.saldo_prev*0.75 THEN 90 ELSE 0 END+
              CASE WHEN tx.num_tx IS NULL AND p.saldo_prev IS NOT NULL
                        AND a.saldo_disponible<p.saldo_prev*0.80 THEN 60 ELSE 0 END+
              CASE WHEN a.monto_bloq>0 AND COALESCE(c.max_dias_mora,0)>0
                   THEN 40 ELSE 0 END
            )) AS d4,
            -- D5: Perfil Socioeconómico (15%)
            LEAST(100, GREATEST(0,
              (CASE WHEN COALESCE(c.ingresos,0)=0 THEN 45
                WHEN (c.egresos/NULLIF(c.ingresos,0))>0.85 THEN 65
                WHEN (c.egresos/NULLIF(c.ingresos,0))>0.60 THEN 35 ELSE 10 END*0.30)+
              (CASE WHEN c.max_cargas=0 THEN 0 WHEN c.max_cargas<=2 THEN 15
                WHEN c.max_cargas<=4 THEN 35 ELSE 55 END*0.20)+
              (CASE UPPER(COALESCE(c.tipo_vivien,''))
                WHEN 'PROPIA' THEN 0 WHEN 'FAMILIAR' THEN 15
                WHEN 'ARRENDADA' THEN 30 ELSE 20 END*0.15)+
              (CASE
                WHEN UPPER(COALESCE(c.nivel_educa,'')) IN ('SUPERIOR','POSTGRADO','TERCER NIVEL','4TO NIVEL','CUARTO NIVEL') THEN 5
                WHEN UPPER(COALESCE(c.nivel_educa,'')) IN ('BACHILLERATO','SECUNDARIA','BACHILLER') THEN 15
                WHEN UPPER(COALESCE(c.nivel_educa,'')) IN ('PRIMARIA','BASICA','BÁSICA') THEN 28
                WHEN UPPER(COALESCE(c.nivel_educa,'')) IN ('NINGUNA','NINGUNO') THEN 45
                ELSE 20 END*0.20)+
              (CASE
                WHEN UPPER(COALESCE(c.estado_civil,'')) IN ('CASADO','CASADA','UNION LIBRE','UNION DE HECHO','UNIÓN LIBRE') THEN 5
                WHEN UPPER(COALESCE(c.estado_civil,'')) IN ('SOLTERO','SOLTERA') THEN 15
                WHEN UPPER(COALESCE(c.estado_civil,'')) IN ('DIVORCIADO','DIVORCIADA','SEPARADO','SEPARADA') THEN 22
                WHEN UPPER(COALESCE(c.estado_civil,'')) IN ('VIUDO','VIUDA') THEN 28
                ELSE 15 END*0.15)
            )) AS d5,
            -- D6: Actividad Económica (10%)
            LEAST(100, GREATEST(0,
              (CASE WHEN UPPER(COALESCE(c.actividad_socio,'')) LIKE '%AGRICULTUR%' THEN 40
                WHEN UPPER(COALESCE(c.actividad_socio,'')) LIKE '%GANADERIA%' THEN 38
                WHEN UPPER(COALESCE(c.actividad_socio,'')) LIKE '%PESCA%' THEN 42
                WHEN UPPER(COALESCE(c.actividad_socio,'')) LIKE '%CONSTRUCCI%' THEN 30
                WHEN UPPER(COALESCE(c.actividad_socio,'')) LIKE '%COMERCIO%' THEN 25
                WHEN UPPER(COALESCE(c.actividad_socio,'')) LIKE '%SERVICIO%' THEN 20
                WHEN UPPER(COALESCE(c.actividad_socio,'')) LIKE '%INDUSTRI%' THEN 22
                WHEN c.actividad_socio IS NULL OR c.actividad_socio='' THEN 35 ELSE 28 END*0.50)+
              (CASE WHEN UPPER(COALESCE(c.destino_op,'')) LIKE '%VIVIENDA%' THEN 10
                WHEN UPPER(COALESCE(c.destino_op,'')) LIKE '%CAPITAL%' THEN 20
                WHEN UPPER(COALESCE(c.destino_op,'')) LIKE '%PRODUCTI%' THEN 18
                WHEN UPPER(COALESCE(c.destino_op,'')) LIKE '%CONSUMO%' THEN 35
                WHEN UPPER(COALESCE(c.destino_op,'')) LIKE '%AGRICULT%' THEN 38
                WHEN c.destino_op IS NULL OR c.destino_op='' THEN 30 ELSE 28 END*0.50)
            )) AS d6,
            -- D7: Garantías (5%)
            LEAST(100, GREATEST(0,
              (CASE WHEN UPPER(COALESCE(c.tgarantia,'')) LIKE '%HIPOTECARIA%' THEN 5
                WHEN UPPER(COALESCE(c.tgarantia,'')) LIKE '%PRENDARIA%' THEN 15
                WHEN UPPER(COALESCE(c.tgarantia,'')) LIKE '%PERSONAL%' THEN 25
                WHEN UPPER(COALESCE(c.tgarantia,'')) LIKE '%QUIROG%' THEN 35
                WHEN c.tgarantia IS NULL OR c.tgarantia='' THEN 40 ELSE 30 END*0.60)+
              (CASE WHEN COALESCE(c.monto_credito_max,0)=0 THEN 35
                WHEN c.valgarantias>=c.monto_credito_max*1.5 THEN 5
                WHEN c.valgarantias>=c.monto_credito_max THEN 12
                WHEN c.valgarantias>=c.monto_credito_max*0.5 THEN 25
                WHEN c.valgarantias>0 THEN 40 ELSE 55 END*0.40)
            )) AS d7,
            -- Señal principal
            CASE
              WHEN COALESCE(c.max_dias_mora,0) BETWEEN 1 AND 15
                THEN 'Micro-retraso activo: ' || FLOOR(COALESCE(c.max_dias_mora,0))::TEXT || ' días'
              WHEN COALESCE(c.max_dias_mora,0) BETWEEN 16 AND 30
                THEN 'En mora: ' || FLOOR(COALESCE(c.max_dias_mora,0))::TEXT || ' días sin regularizar'
              WHEN p.saldo_prev IS NOT NULL AND p.saldo_prev > 0
                AND a.saldo_disponible < p.saldo_prev * 0.40
                THEN 'Ahorro cayó más del 60% — alerta crítica'
              WHEN tx.num_tx IS NULL AND p.saldo_prev IS NOT NULL
                AND a.saldo_disponible < p.saldo_prev * 0.80
                THEN 'Sin actividad transaccional + ahorro en declive'
              WHEN a.saldo_disponible < 50
                THEN 'Saldo disponible prácticamente en cero'
              ELSE 'Riesgo compuesto: múltiples factores elevados'
            END AS senal_principal
          FROM base_ahorro a
          LEFT JOIN prev_base     p  ON a.v_ah_cliente = p.v_ah_cliente
          LEFT JOIN credit_profile c ON CAST(a.v_ah_cliente AS BIGINT)::TEXT = c.nro_cliente
          LEFT JOIN tx_activity   tx ON a.v_ah_cliente = tx.v_ah_cliente
          LEFT JOIN avg_saldo     av ON a.v_ah_cliente = av.v_ah_cliente
        ),
        resultado AS (
          SELECT
            v_ah_cliente, v_ah_nombre, saldo_promedio, senal_principal,
            max_dias_mora, saldo_capital, d1, d2, d3, d4, d5, d6, d7,
            ROUND(CAST((d1*0.15)+(d2*0.20)+(d3*0.25)+(d4*0.10)+(d5*0.15)+(d6*0.10)+(d7*0.05) AS NUMERIC),2) AS sg,
            -- Probabilidades sigmoides por horizonte
            ROUND(100.0/(1.0+EXP(-0.12*(((d1*0.15)+(d2*0.20)+(d3*0.25)+(d4*0.10)+(d5*0.15)+(d6*0.10)+(d7*0.05))-70))) ::NUMERIC,1) AS prob_10d,
            ROUND(100.0/(1.0+EXP(-0.11*(((d1*0.15)+(d2*0.20)+(d3*0.25)+(d4*0.10)+(d5*0.15)+(d6*0.10)+(d7*0.05))-57))) ::NUMERIC,1) AS prob_20d,
            ROUND(100.0/(1.0+EXP(-0.09*(((d1*0.15)+(d2*0.20)+(d3*0.25)+(d4*0.10)+(d5*0.15)+(d6*0.10)+(d7*0.05))-45))) ::NUMERIC,1) AS prob_30d
          FROM scoring
        ),
        predicciones AS (
          SELECT *,
            -- ─ Horizonte de predicción ─
            CASE
              /* 10 días: ya tiene micro-mora activa o señales de deterioro críticas */
              WHEN (max_dias_mora BETWEEN 1 AND 20) AND prob_10d >= 55 THEN '10 días'
              /* 20 días: mora incipiente o sin mora formal pero ahorro cayendo + inactividad */
              WHEN max_dias_mora <= 15 AND d2 >= 62 AND d4 >= 35 AND prob_20d >= 48 THEN '20 días'
              /* 30 días: riesgo compuesto moderado sin señales inmediatas */
              WHEN max_dias_mora <= 15 AND sg >= 40 AND prob_30d >= 40 THEN '30 días'
              ELSE NULL
            END AS horizonte,
            -- ─ Factor principal ─
            CASE
              WHEN max_dias_mora BETWEEN 1 AND 10
                THEN 'Micro-retraso activo: ' || FLOOR(max_dias_mora)::TEXT || ' días sin pagar'
              WHEN max_dias_mora BETWEEN 11 AND 20
                THEN 'Retraso moderado: ' || FLOOR(max_dias_mora)::TEXT || ' días — riesgo de formalización'
              WHEN d4 >= 80
                THEN 'Tres señales de deterioro activas simultáneamente'
              WHEN d2 >= 70
                THEN 'Caída drástica del ahorro (>50%) en período reciente'
              WHEN d3 >= 75
                THEN 'Calificación crediticia deteriorada (B2, C o peor)'
              WHEN d5 >= 65
                THEN 'Alta presión económica familiar y laboral'
              WHEN d6 >= 65
                THEN 'Sector laboral de ingresos variables (agro, pesca, etc.)'
              ELSE 'Score compuesto elevado: varios factores de riesgo combinados'
            END AS factor_principal,
            CASE
              WHEN sg <= 30 THEN 'Bajo'
              WHEN sg <= 60 THEN 'Medio'
              WHEN sg <= 80 THEN 'Alto'
              ELSE 'Crítico'
            END AS nivel_riesgo
          FROM resultado
          WHERE sg > 30  -- excluir socios de riesgo bajo absoluto
        )
      `;

      // ─── Query paginada ───────────────────────────────────────────────────
      const sql = `
        WITH ${baseCtes}
        SELECT
          v_ah_cliente, v_ah_nombre, horizonte, sg,
          prob_10d, prob_20d, prob_30d,
          saldo_capital, saldo_promedio,
          factor_principal, senal_principal, nivel_riesgo
        FROM predicciones
        WHERE horizonte IS NOT NULL ${horizonteFilter}
        ORDER BY
          CASE horizonte WHEN '10 días' THEN 1 WHEN '20 días' THEN 2 ELSE 3 END,
          sg DESC
        LIMIT $1 OFFSET $2;
      `;

      // ─── Query resumen (totales por horizonte + montos) ────────────────────
      const sqlResumen = `
        WITH ${baseCtes}
        SELECT
          COUNT(*) FILTER (WHERE horizonte = '10 días') AS total_10d,
          COUNT(*) FILTER (WHERE horizonte = '20 días') AS total_20d,
          COUNT(*) FILTER (WHERE horizonte = '30 días') AS total_30d,
          COUNT(*) FILTER (WHERE horizonte IS NOT NULL) AS total_general,
          COALESCE(SUM(saldo_capital) FILTER (WHERE horizonte = '10 días'), 0) AS monto_10d,
          COALESCE(SUM(saldo_capital) FILTER (WHERE horizonte = '20 días'), 0) AS monto_20d,
          COALESCE(SUM(saldo_capital) FILTER (WHERE horizonte = '30 días'), 0) AS monto_30d,
          COALESCE(SUM(saldo_capital) FILTER (WHERE horizonte IS NOT NULL), 0) AS monto_total
        FROM predicciones;
      `;

      const [rows, [resRow]] = await Promise.all([
        this.sabanaAhorroRepo.query(sql, [limit, offset]),
        this.sabanaAhorroRepo.query(sqlResumen),
      ]);

      const resumen: PredictionResumenDto = {
        total10d:           parseInt(resRow?.total_10d     ?? '0', 10),
        total20d:           parseInt(resRow?.total_20d     ?? '0', 10),
        total30d:           parseInt(resRow?.total_30d     ?? '0', 10),
        totalGeneral:       parseInt(resRow?.total_general ?? '0', 10),
        montoEnRiesgo10d:   parseFloat(parseFloat(resRow?.monto_10d    ?? '0').toFixed(2)),
        montoEnRiesgo20d:   parseFloat(parseFloat(resRow?.monto_20d    ?? '0').toFixed(2)),
        montoEnRiesgo30d:   parseFloat(parseFloat(resRow?.monto_30d    ?? '0').toFixed(2)),
        montoTotalEnRiesgo: parseFloat(parseFloat(resRow?.monto_total  ?? '0').toFixed(2)),
      };

      const data: SocioPrediccionDto[] = rows.map((r: any) => ({
        nroCliente:     String(Math.floor(parseFloat(r.v_ah_cliente))),
        nombre:         r.v_ah_nombre ?? '',
        horizonte:      r.horizonte,
        scoreGlobal:    parseFloat(r.sg),
        prob10d:        parseFloat(r.prob_10d ?? '0'),
        prob20d:        parseFloat(r.prob_20d ?? '0'),
        prob30d:        parseFloat(r.prob_30d ?? '0'),
        montoEnRiesgo:  parseFloat(parseFloat(r.saldo_capital  ?? '0').toFixed(2)),
        saldoPromedio:  parseFloat(parseFloat(r.saldo_promedio ?? '0').toFixed(2)),
        factorPrincipal: r.factor_principal ?? '',
        senalPrincipal:  r.senal_principal  ?? '',
        nivelRiesgo:     r.nivel_riesgo,
      }));

      return { resumen, data, page, limit, total: resumen.totalGeneral };
    } catch (error) {
      this.logger.error('Error en getPredictions', error);
      throw error;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Cuotas Próximas en Riesgo (ventana 7, 15, 30 días)
  // ─────────────────────────────────────────────────────────────────────────────
  async getCuotasEnRiesgo(
    page:      number,
    limit:     number,
    ventana:   number = 30,   // días hacia adelante
    prioridad?: string,       // 'CRÍTICA' | 'ALTA' | 'MEDIA' | 'BAJA'
  ): Promise<CuotasRiesgoResponseDto> {
    try {
      const offset = (page - 1) * limit;
      const prioridadFilter = prioridad ? `AND prioridad = '${prioridad}'` : '';

      const baseSql = `
        WITH max_credito AS (
          SELECT MAX(qy_fechaproc) AS fecha FROM sabana_credito
        ),
        cuotas AS (
          SELECT
            COALESCE(c.nro_cliente, '')                                       AS nro_cliente,
            COALESCE(c.nombres_socio, '')                                     AS nombres_socio,
            COALESCE(c.nro_operacion, '')                                     AS nro_operacion,
            COALESCE(c.calificacion, '')                                      AS calificacion,
            COALESCE(c.saldo_capital, 0)                                      AS saldo_capital,
            COALESCE(c.saldo_por_vencer, 0)                                   AS saldo_por_vencer,
            COALESCE(CAST(NULLIF(c.dias_mora, '') AS FLOAT), 0)               AS dias_mora,
            COALESCE(CAST(NULLIF(c.nro_cuotas, '') AS FLOAT), 12)             AS nro_cuotas_total,
            COALESCE(CAST(NULLIF(c.nro_cuotas_atra, '') AS FLOAT), 0)         AS cuotas_atra,
            COALESCE(CAST(NULLIF(c.dia_pago, '') AS INT), 15)                 AS dia_pago_num,
            c.fecha_ult_pag,
            c.fecha_concesion_op,
            c.fecha_fin_op,
            COALESCE(c.destino_op, '')                                        AS destino_op,
            COALESCE(c.actividad_socio, '')                                   AS actividad_socio,
            COALESCE(c.plazo, '')                                             AS plazo,

            -- ─ Próxima fecha de pago ─
            -- Tomamos el mes actual o el próximo basado en el día de pago para evitar fechas pasadas
            (
              DATE_TRUNC('month', NOW()) +
              (LEAST(
                COALESCE(CAST(NULLIF(c.dia_pago,'') AS INT), 15),
                DATE_PART('days', DATE_TRUNC('month', NOW() + INTERVAL '1 month') - INTERVAL '1 day')::INT
              ) - 1) * INTERVAL '1 day' +
              CASE 
                WHEN EXTRACT(DAY FROM NOW()) > COALESCE(CAST(NULLIF(c.dia_pago,'') AS INT), 15) THEN INTERVAL '1 month'
                ELSE INTERVAL '0'
              END
            )::DATE AS fecha_prox_pago,

            -- ─ Cuota estimada ─
            ROUND(CAST(
              COALESCE(c.saldo_por_vencer, c.saldo_capital, 0) /
              GREATEST(
                COALESCE(CAST(NULLIF(c.nro_cuotas,'') AS FLOAT), 12) -
                COALESCE(CAST(NULLIF(c.nro_cuotas_atra,'') AS FLOAT), 0),
                1
              )
            AS NUMERIC), 2) AS cuota_estimada,

            -- ─ Score de riesgo por calificación ─
            CASE c.calificacion
              WHEN 'A1' THEN 10  WHEN 'A2' THEN 25  WHEN 'A3' THEN 40
              WHEN 'B1' THEN 55  WHEN 'B2' THEN 70  WHEN 'C1' THEN 80
              WHEN 'C2' THEN 90  WHEN 'D'  THEN 95  WHEN 'E'  THEN 100
              ELSE 30
            END AS score_riesgo,

            -- ─ Nivel de riesgo textual ─
            CASE c.calificacion
              WHEN 'A1' THEN 'Bajo'     WHEN 'A2' THEN 'Bajo'
              WHEN 'A3' THEN 'Medio'    WHEN 'B1' THEN 'Medio'
              WHEN 'B2' THEN 'Alto'     WHEN 'C1' THEN 'Alto'
              WHEN 'C2' THEN 'Crítico'  WHEN 'D'  THEN 'Crítico'
              WHEN 'E'  THEN 'Crítico'  ELSE 'Sin clasificar'
            END AS nivel_riesgo

          FROM sabana_credito c
          WHERE c.qy_fechaproc = (SELECT fecha FROM max_credito)
            AND c.estado_op = 'VIGENTE'
            AND c.saldo_capital IS NOT NULL
            AND c.saldo_capital > 0
        ),
        resultado AS (
          SELECT
            *,
            -- ─ Días hasta el pago (negativo = ya vencida) ─
            (fecha_prox_pago - NOW()::DATE)::INT AS dias_hasta_pago,

            -- ─ Prioridad de atención ─
            CASE
              WHEN score_riesgo >= 80
                   AND (fecha_prox_pago - NOW()::DATE) <= 7   THEN 'CRÍTICA'
              WHEN score_riesgo >= 55
                   AND (fecha_prox_pago - NOW()::DATE) <= 15  THEN 'ALTA'
              WHEN score_riesgo >= 40
                   AND (fecha_prox_pago - NOW()::DATE) <= 30  THEN 'MEDIA'
              ELSE 'BAJA'
            END AS prioridad
          FROM cuotas
          WHERE (fecha_prox_pago - NOW()::DATE) BETWEEN -10 AND 30
        )
      `;

      // ─── Query paginada ────────────────────────────────────────────────────
      const sql = `
        ${baseSql}
        SELECT
          nro_cliente, nombres_socio, nro_operacion,
          fecha_prox_pago::TEXT AS fecha_prox_pago,
          dias_hasta_pago, cuota_estimada,
          saldo_capital, saldo_por_vencer,
          calificacion, nivel_riesgo, dias_mora,
          prioridad, destino_op, actividad_socio, plazo,
          cuotas_atra AS cuotas_atrasadas,
          fecha_ult_pag::TEXT AS fecha_ult_pag
        FROM resultado
        WHERE dias_hasta_pago <= $3
          ${prioridadFilter}
        ORDER BY
          CASE prioridad
            WHEN 'CRÍTICA' THEN 1 WHEN 'ALTA' THEN 2
            WHEN 'MEDIA'   THEN 3 ELSE 4
          END,
          dias_hasta_pago ASC,
          score_riesgo DESC
        LIMIT $1 OFFSET $2;
      `;

      // ─── Query resumen ─────────────────────────────────────────────────────
      const sqlResumen = `
        ${baseSql}
        SELECT
          COUNT(*) FILTER (WHERE dias_hasta_pago BETWEEN -10 AND 7)  AS total_7d,
          COUNT(*) FILTER (WHERE dias_hasta_pago BETWEEN -10 AND 15) AS total_15d,
          COUNT(*) FILTER (WHERE dias_hasta_pago BETWEEN -10 AND 30) AS total_30d,
          COUNT(*) FILTER (WHERE prioridad = 'CRÍTICA')              AS total_critica,
          COALESCE(SUM(cuota_estimada) FILTER (WHERE dias_hasta_pago BETWEEN -10 AND 7),  0) AS monto_7d,
          COALESCE(SUM(cuota_estimada) FILTER (WHERE dias_hasta_pago BETWEEN -10 AND 15), 0) AS monto_15d,
          COALESCE(SUM(cuota_estimada) FILTER (WHERE dias_hasta_pago BETWEEN -10 AND 30), 0) AS monto_30d
        FROM resultado;
      `;

      const [rows, [res]] = await Promise.all([
        this.sabanaAhorroRepo.query(sql, [limit, offset, ventana]),
        this.sabanaAhorroRepo.query(sqlResumen),
      ]);

      const resumen: CuotasRiesgoResumenDto = {
        total7d:       parseInt(res?.total_7d      ?? '0', 10),
        total15d:      parseInt(res?.total_15d     ?? '0', 10),
        total30d:      parseInt(res?.total_30d     ?? '0', 10),
        totalCritica:  parseInt(res?.total_critica ?? '0', 10),
        monto7d:       parseFloat(parseFloat(res?.monto_7d  ?? '0').toFixed(2)),
        monto15d:      parseFloat(parseFloat(res?.monto_15d ?? '0').toFixed(2)),
        monto30d:      parseFloat(parseFloat(res?.monto_30d ?? '0').toFixed(2)),
      };

      const data: CuotaRiesgoDto[] = rows.map((r: any) => ({
        nroCliente:      String(r.nro_cliente ?? ''),
        nombresSocio:    r.nombres_socio ?? '',
        nroOperacion:    r.nro_operacion ?? '',
        fechaProxPago:   r.fecha_prox_pago ?? '',
        diasHastaPago:   parseInt(r.dias_hasta_pago ?? '0', 10),
        cuotaEstimada:   parseFloat(parseFloat(r.cuota_estimada ?? '0').toFixed(2)),
        saldoCapital:    parseFloat(parseFloat(r.saldo_capital  ?? '0').toFixed(2)),
        saldoPorVencer:  parseFloat(parseFloat(r.saldo_por_vencer ?? '0').toFixed(2)),
        calificacion:    r.calificacion  ?? '',
        nivelRiesgo:     r.nivel_riesgo  ?? '',
        diasMora:        parseFloat(r.dias_mora ?? '0'),
        prioridad:       r.prioridad     ?? 'BAJA',
        destinoOp:       r.destino_op    ?? '',
        actividadSocio:  r.actividad_socio ?? '',
        plazo:           r.plazo         ?? '',
        cuotasAtrasadas: parseFloat(r.cuotas_atrasadas ?? '0'),
        fechaUltPago:    r.fecha_ult_pag ?? null,
      }));

      const total = ventana <= 7 ? resumen.total7d
                  : ventana <= 15 ? resumen.total15d
                  : resumen.total30d;

      return { resumen, data, page, limit, total };
    } catch (error) {
      this.logger.error('Error en getCuotasEnRiesgo', error);
      throw error;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Concentración de Cartera (por actividad, destino y ciudad)
  // ─────────────────────────────────────────────────────────────────────────────
  async getConcentracionCartera(): Promise<ConcentracionResponseDto> {
    try {
      const baseSql = `
        WITH max_credito AS (
          SELECT MAX(qy_fechaproc) AS fecha FROM sabana_credito
        ),
        base AS (
          SELECT
            COALESCE(NULLIF(actividad_socio, ''), 'OTRO') AS actividad,
            COALESCE(NULLIF(destino_op, ''), 'OTRO') AS destino,
            COALESCE(NULLIF(cidudad_orig, ''), 'OTRO') AS ciudad,
            COALESCE(saldo_capital, 0) AS saldo_capital,
            -- Consideramos en mora si días_mora > 0 (o podría ser calificacion no A)
            CASE WHEN CAST(NULLIF(dias_mora, '') AS FLOAT) > 0 THEN COALESCE(saldo_capital, 0) ELSE 0 END AS saldo_mora
          FROM sabana_credito
          WHERE qy_fechaproc = (SELECT fecha FROM max_credito)
            AND estado_op = 'VIGENTE'
            AND saldo_capital IS NOT NULL
            AND saldo_capital > 0
        ),
        totales AS (
          SELECT
            SUM(saldo_capital) AS cartera_total,
            SUM(saldo_mora) AS mora_total
          FROM base
        ),
        por_actividad AS (
          SELECT
            actividad AS categoria,
            COUNT(*) AS cantidad,
            SUM(saldo_capital) AS capital_total,
            SUM(saldo_mora) AS capital_mora
          FROM base
          GROUP BY actividad
          ORDER BY capital_total DESC
          LIMIT 10
        ),
        por_destino AS (
          SELECT
            destino AS categoria,
            COUNT(*) AS cantidad,
            SUM(saldo_capital) AS capital_total,
            SUM(saldo_mora) AS capital_mora
          FROM base
          GROUP BY destino
          ORDER BY capital_total DESC
          LIMIT 10
        ),
        por_ciudad AS (
          SELECT
            ciudad AS categoria,
            COUNT(*) AS cantidad,
            SUM(saldo_capital) AS capital_total,
            SUM(saldo_mora) AS capital_mora
          FROM base
          GROUP BY ciudad
          ORDER BY capital_total DESC
          LIMIT 10
        )
        SELECT
          (SELECT json_build_object('cartera_total', cartera_total, 'mora_total', mora_total) FROM totales) AS totales_globales,
          (SELECT json_agg(por_actividad.*) FROM por_actividad) AS agg_actividad,
          (SELECT json_agg(por_destino.*) FROM por_destino) AS agg_destino,
          (SELECT json_agg(por_ciudad.*) FROM por_ciudad) AS agg_ciudad;
      `;

      const [res] = await this.sabanaAhorroRepo.query(baseSql);

      const globales = res?.totales_globales || { cartera_total: 0, mora_total: 0 };
      const carteraTotal = parseFloat(globales.cartera_total || 0);
      const moraTotal    = parseFloat(globales.mora_total || 0);
      const indiceGlobal = carteraTotal > 0 ? (moraTotal / carteraTotal) * 100 : 0;

      const mapItems = (arr: any[]) => {
        if (!arr) return [];
        return arr.map(item => {
          const capTotal = parseFloat(item.capital_total || 0);
          const capMora  = parseFloat(item.capital_mora || 0);
          return {
            categoria: item.categoria,
            cantidadOperaciones: parseInt(item.cantidad || 0, 10),
            saldoCapitalTotal: capTotal,
            saldoCapitalMora: capMora,
            indiceMora: capTotal > 0 ? (capMora / capTotal) * 100 : 0,
            participacion: carteraTotal > 0 ? (capTotal / carteraTotal) * 100 : 0,
          };
        });
      };

      return {
        carteraTotal,
        moraTotal,
        indiceMoraGlobal: indiceGlobal,
        porActividad: mapItems(res?.agg_actividad),
        porDestino: mapItems(res?.agg_destino),
        porCiudad: mapItems(res?.agg_ciudad),
      };

    } catch (error) {
      this.logger.error('Error en getConcentracionCartera', error);
      throw error;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Retención de Socios (Riesgo de Fuga y Liquidez)
  // ─────────────────────────────────────────────────────────────────────────────
  async getRetencionSocios(
    page:  number,
    limit: number,
    riesgo?: string, // 'Alto' | 'Medio' | 'Bajo'
  ): Promise<RetencionResponseDto> {
    try {
      const offset = (page - 1) * limit;
      const riesgoFilter = riesgo ? `AND nivel_riesgo = '${riesgo}'` : '';

      // Usamos sabana_ahorro como base para retención
      const baseSql = `
        WITH max_ahorro AS (
          SELECT MAX(fecha_proceso) AS fecha FROM sabana_ahorro
        ),
        socios_base AS (
          SELECT
            a.v_ah_cliente::TEXT AS nro_cliente,
            COALESCE(a.v_ah_nombre, '') AS nombres_socio,
            COALESCE(a.saldo_disponible, 0) AS saldo_ahorro,
            a.fecha_ultmov,
            COALESCE(a.credito, 'NO') AS credito,
            COALESCE(a.cooplinea, 'NO') AS cooplinea,

            -- Cálculo de inactividad
            COALESCE(
              DATE_PART('days', NOW() - COALESCE(a.fecha_ultmov, a.fecha_aper, NOW())),
              0
            )::INT AS dias_inactividad

          FROM sabana_ahorro a
          WHERE a.fecha_proceso = (SELECT fecha FROM max_ahorro)
            -- Excluimos saldos negativos (sobregiros)
            AND COALESCE(a.saldo_disponible, 0) >= 0
            -- Solo consideramos clientes con cuenta principal (ahorro a la vista / libre disponibilidad)
            AND a.estado_cta = 'A'
            -- Agrupamos por cliente para evitar duplicados si tienen múltiples cuentas
            -- Nos quedamos con la cuenta de mayor saldo
        ),
        socios_agrupados AS (
          SELECT DISTINCT ON (nro_cliente)
            *
          FROM socios_base
          ORDER BY nro_cliente, saldo_ahorro DESC
        ),
        scoring AS (
          SELECT
            *,
            -- Puntos por inactividad
            CASE
              WHEN dias_inactividad > 180 THEN 40
              WHEN dias_inactividad > 90  THEN 25
              WHEN dias_inactividad > 30  THEN 10
              ELSE 0
            END +
            -- Puntos por falta de vinculación cruzada
            CASE WHEN UPPER(credito) IN ('NO', 'N', '0', '') THEN 30 ELSE 0 END +
            -- Puntos por bajo saldo (indica vaciado de cuenta)
            CASE
              WHEN saldo_ahorro < 5   THEN 20
              WHEN saldo_ahorro < 50  THEN 10
              ELSE 0
            END +
            -- Puntos por falta de canales digitales
            CASE WHEN UPPER(cooplinea) IN ('NO', 'N', '0', '') THEN 10 ELSE 0 END
            AS prob_base
          FROM socios_agrupados
        ),
        resultado AS (
          SELECT
            nro_cliente,
            nombres_socio,
            saldo_ahorro,
            dias_inactividad,
            fecha_ultmov::TEXT AS fecha_ultmov,
            UPPER(credito) NOT IN ('NO', 'N', '0', '') AS tiene_credito,
            UPPER(cooplinea) NOT IN ('NO', 'N', '0', '') AS tiene_cooplinea,
            
            -- Normalizamos probabilidad al 100%
            LEAST(prob_base, 100) AS probabilidad_fuga,

            -- Nivel de Riesgo
            CASE
              WHEN prob_base >= 70 THEN 'Alto'
              WHEN prob_base >= 40 THEN 'Medio'
              ELSE 'Bajo'
            END AS nivel_riesgo,

            -- Determinación del motivo principal
            CASE
              WHEN prob_base >= 70 AND saldo_ahorro < 10 THEN 'Cuenta vaciada y sin obligaciones cruzadas'
              WHEN prob_base >= 70 AND dias_inactividad > 180 THEN 'Inactividad prolongada (>6 meses)'
              WHEN prob_base >= 40 AND UPPER(credito) IN ('NO', 'N', '0', '') THEN 'Baja transaccionalidad y sin crédito activo'
              ELSE 'Factores combinados moderados'
            END AS motivo_principal

          FROM scoring
          -- Filtramos a los que tienen al menos riesgo Medio para no saturar la tabla con socios sanos
          WHERE prob_base >= 40
        )
      `;

      const sqlQuery = `
        ${baseSql}
        SELECT *
        FROM resultado
        WHERE 1=1 ${riesgoFilter}
        ORDER BY probabilidad_fuga DESC, saldo_ahorro DESC
        LIMIT $1 OFFSET $2;
      `;

      const sqlResumen = `
        ${baseSql}
        SELECT
          COUNT(*) FILTER (WHERE nivel_riesgo = 'Alto') AS total_alto,
          COUNT(*) FILTER (WHERE nivel_riesgo = 'Medio') AS total_medio,
          COALESCE(SUM(saldo_ahorro), 0) AS saldo_riesgo
        FROM resultado;
      `;

      const [rows, [res]] = await Promise.all([
        this.sabanaAhorroRepo.query(sqlQuery, [limit, offset]),
        this.sabanaAhorroRepo.query(sqlResumen),
      ]);

      const resumen: RetencionResumenDto = {
        totalRiesgoAlto:  parseInt(res?.total_alto ?? '0', 10),
        totalRiesgoMedio: parseInt(res?.total_medio ?? '0', 10),
        saldoEnRiesgo:    parseFloat(parseFloat(res?.saldo_riesgo ?? '0').toFixed(2)),
      };

      const data: SocioRetencionDto[] = rows.map((r: any) => ({
        nroCliente:         r.nro_cliente ?? '',
        nombresSocio:       r.nombres_socio ?? '',
        saldoAhorro:        parseFloat(parseFloat(r.saldo_ahorro ?? '0').toFixed(2)),
        diasInactividad:    parseInt(r.dias_inactividad ?? '0', 10),
        fechaUltMovimiento: r.fecha_ultmov ?? null,
        tieneCredito:       Boolean(r.tiene_credito),
        tieneCooplinea:     Boolean(r.tiene_cooplinea),
        probabilidadFuga:   parseInt(r.probabilidad_fuga ?? '0', 10),
        nivelRiesgo:        r.nivel_riesgo ?? 'Bajo',
        motivoPrincipal:    r.motivo_principal ?? '',
      }));

      const total = riesgo === 'Alto'  ? resumen.totalRiesgoAlto
                  : riesgo === 'Medio' ? resumen.totalRiesgoMedio
                  : resumen.totalRiesgoAlto + resumen.totalRiesgoMedio;

      return { resumen, data, page, limit, total };

    } catch (error) {
      this.logger.error('Error en getRetencionSocios', error);
      throw error;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Recuperabilidad de Cartera Vencida
  // ─────────────────────────────────────────────────────────────────────────────
  async getRecuperabilidadCartera(
    page:  number,
    limit: number,
    segmento?: string, // 'Alta' | 'Media' | 'Baja'
  ): Promise<RecuperabilidadResponseDto> {
    try {
      const offset = (page - 1) * limit;
      const segmentFilter = segmento ? `AND segmento = '${segmento}'` : '';

      const baseSql = `
        WITH max_credito AS (
          SELECT MAX(qy_fechaproc) AS fecha FROM sabana_credito
        ),
        creditos_mora AS (
          SELECT
            nro_cliente::TEXT,
            nombres_socio,
            nro_operacion,
            COALESCE(CAST(NULLIF(dias_mora, '') AS FLOAT), 0) AS dias,
            COALESCE(saldo_capital, 0) AS saldo,
            UPPER(COALESCE(NULLIF(tgarantia, ''), 'QUIROGRAFARIA')) AS garantia,
            COALESCE(CAST(NULLIF(ingresos_socio, '') AS FLOAT), 0) AS ingresos,
            COALESCE(CAST(NULLIF(egresos_socio, '') AS FLOAT), 0) AS egresos,
            fecha_ult_pag
          FROM sabana_credito
          WHERE qy_fechaproc = (SELECT fecha FROM max_credito)
            AND estado_op = 'VIGENTE'
            AND CAST(NULLIF(dias_mora, '') AS FLOAT) > 0
        ),
        scoring AS (
          SELECT
            *,
            -- Score Base: 50%
            50
            -- Ajuste por Días de Mora (mientras más antiguo, más difícil)
            + CASE
                WHEN dias <= 30 THEN 30
                WHEN dias <= 90 THEN 10
                WHEN dias <= 180 THEN -10
                ELSE -30
              END
            -- Ajuste por Garantía
            + CASE
                WHEN garantia LIKE '%HIPOTECARI%' THEN 25
                WHEN garantia LIKE '%PRENDARI%' THEN 15
                WHEN garantia LIKE '%QUIROGRAFARI%' THEN -10
                ELSE 0
              END
            -- Ajuste por Ingresos Netos (Capacidad de pago)
            + CASE
                WHEN (ingresos - egresos) > 500 THEN 15
                WHEN (ingresos - egresos) > 0 THEN 5
                ELSE -15
              END
            -- Ajuste por Fecha de último pago (si pagó hace poco, hay voluntad)
            + CASE
                WHEN fecha_ult_pag IS NOT NULL 
                     AND DATE_PART('days', NOW() - fecha_ult_pag) < 60 THEN 10
                ELSE 0
              END
            AS raw_score
          FROM creditos_mora
        ),
        resultado AS (
          SELECT
            nro_cliente,
            nombres_socio,
            nro_operacion,
            dias AS dias_mora,
            saldo AS saldo_vencido,
            garantia AS tipo_garantia,
            ingresos,
            
            LEAST(GREATEST(raw_score, 0), 100) AS score_recuperacion,

            CASE
              WHEN raw_score >= 70 THEN 'Alta'
              WHEN raw_score >= 40 THEN 'Media'
              ELSE 'Baja'
            END AS segmento,

            CASE
              WHEN raw_score >= 70 AND (ingresos - egresos) > 0 AND garantia NOT LIKE '%QUIROGRAFARI%' THEN 'Garantía real e ingresos positivos'
              WHEN raw_score >= 70 AND dias <= 30 THEN 'Mora temprana de fácil gestión'
              WHEN raw_score < 40 AND (ingresos - egresos) <= 0 THEN 'Sin capacidad de pago aparente'
              WHEN raw_score < 40 AND dias > 180 THEN 'Mora muy antigua'
              ELSE 'Factores de recuperación estándar'
            END AS factor_positivo

          FROM scoring
        )
      `;

      const sqlQuery = `
        ${baseSql}
        SELECT *
        FROM resultado
        WHERE 1=1 ${segmentFilter}
        ORDER BY score_recuperacion DESC, saldo_vencido DESC
        LIMIT $1 OFFSET $2;
      `;

      const sqlResumen = `
        ${baseSql}
        SELECT
          COUNT(*) FILTER (WHERE segmento = 'Alta') AS total_alta,
          COUNT(*) FILTER (WHERE segmento = 'Media') AS total_media,
          COUNT(*) FILTER (WHERE segmento = 'Baja') AS total_baja,
          COALESCE(SUM(saldo_vencido) FILTER (WHERE segmento = 'Alta'), 0) AS monto_alta,
          COALESCE(SUM(saldo_vencido) FILTER (WHERE segmento = 'Media'), 0) AS monto_media,
          COALESCE(SUM(saldo_vencido) FILTER (WHERE segmento = 'Baja'), 0) AS monto_baja
        FROM resultado;
      `;

      const [rows, [res]] = await Promise.all([
        this.sabanaCreditoRepo.query(sqlQuery, [limit, offset]),
        this.sabanaCreditoRepo.query(sqlResumen),
      ]);

      const resumen: RecuperabilidadResumenDto = {
        totalAlta:  parseInt(res?.total_alta ?? '0', 10),
        totalMedia: parseInt(res?.total_media ?? '0', 10),
        totalBaja:  parseInt(res?.total_baja ?? '0', 10),
        montoAlta:  parseFloat(parseFloat(res?.monto_alta ?? '0').toFixed(2)),
        montoMedia: parseFloat(parseFloat(res?.monto_media ?? '0').toFixed(2)),
        montoBaja:  parseFloat(parseFloat(res?.monto_baja ?? '0').toFixed(2)),
      };

      const data: SocioRecuperableDto[] = rows.map((r: any) => ({
        nroCliente:        r.nro_cliente ?? '',
        nombresSocio:      r.nombres_socio ?? '',
        nroOperacion:      r.nro_operacion ?? '',
        diasMora:          parseInt(r.dias_mora ?? '0', 10),
        saldoVencido:      parseFloat(parseFloat(r.saldo_vencido ?? '0').toFixed(2)),
        tipoGarantia:      r.tipo_garantia ?? '',
        segmento:          r.segmento ?? 'Baja',
        scoreRecuperacion: parseInt(r.score_recuperacion ?? '0', 10),
        factorPositivo:    r.factor_positivo ?? '',
        ingresos:          parseFloat(parseFloat(r.ingresos ?? '0').toFixed(2)),
      }));

      const total = segmento === 'Alta'  ? resumen.totalAlta
                  : segmento === 'Media' ? resumen.totalMedia
                  : segmento === 'Baja'  ? resumen.totalBaja
                  : resumen.totalAlta + resumen.totalMedia + resumen.totalBaja;

      return { resumen, data, page, limit, total };

    } catch (error) {
      this.logger.error('Error en getRecuperabilidadCartera', error);
      throw error;
    }
  }
}
