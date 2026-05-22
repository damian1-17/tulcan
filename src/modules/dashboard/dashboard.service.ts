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
   *  1. Comportamiento Transaccional (20%) — actividad reciente en transacciones
   *  2. Perfil Crediticio             (35%) — calificación, días mora, cuotas atrasadas
   *  3. Estabilidad de Ahorro         (25%) — evolución del saldo Mar→May
   *  4. Factores Externos             (10%) — cargas familiares, tipo vivienda, capacidad pago
   *  5. Señales de Deterioro          (10%) — combinación cruzada de señales
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
          ORDER BY fecha_proceso
          LIMIT 1
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

        -- ─── Perfil crediticio en el corte más reciente ───────────────────────
        credit_profile AS (
          SELECT
            nro_cliente,
            MAX(CASE calificacion
              WHEN 'A1' THEN 5  WHEN 'A2' THEN 25 WHEN 'A3' THEN 45
              WHEN 'B1' THEN 60 WHEN 'B2' THEN 75
              WHEN 'C1' THEN 85 WHEN 'C2' THEN 90
              WHEN 'D'  THEN 95 WHEN 'E'  THEN 100
              ELSE 0 END)                                                AS cal_score,
            MAX(COALESCE(CAST(NULLIF(dias_mora,'') AS FLOAT), 0))       AS max_dias_mora,
            MAX(COALESCE(CAST(NULLIF(nro_cuotas_atra,'') AS FLOAT), 0)) AS max_cuotas_atra,
            MAX(COALESCE(CAST(NULLIF(nro_cargas_fam,'') AS FLOAT), 0))  AS max_cargas,
            MAX(CASE tipo_vivien
              WHEN 'ARRENDADA' THEN 30 WHEN 'PROPIA' THEN 0
              WHEN 'FAMILIAR'  THEN 15 ELSE 10 END)                     AS vivienda_score,
            MAX(COALESCE(CAST(NULLIF(ingresos_socio,'') AS FLOAT), 0))  AS ingresos,
            MAX(COALESCE(CAST(NULLIF(egresos_socio,'')  AS FLOAT), 0))  AS egresos
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

        -- ─── Scoring por socio ────────────────────────────────────────────────
        scoring AS (
          SELECT
            a.v_ah_cliente,
            a.v_ah_nombre,

            /* D1: Comportamiento Transaccional (20%) */
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

            /* D2: Perfil Crediticio (35%) */
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
            ) AS d2_crediticio,

            /* D3: Estabilidad de Ahorro (25%) */
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
            )) AS d3_ahorro,

            /* D4: Factores Externos (10%) */
            COALESCE(
              LEAST(100,
                (CASE
                  WHEN c.max_cargas = 0            THEN 0
                  WHEN c.max_cargas BETWEEN 1 AND 2 THEN 15
                  WHEN c.max_cargas BETWEEN 3 AND 4 THEN 35
                  ELSE 60
                END * 0.40) +
                (c.vivienda_score * 0.20) +
                (CASE
                  WHEN c.ingresos = 0 THEN 50
                  WHEN (c.egresos / NULLIF(c.ingresos, 0)) > 0.85 THEN 70
                  WHEN (c.egresos / NULLIF(c.ingresos, 0)) > 0.60 THEN 35
                  ELSE 10
                END * 0.40)
              ),
              20
            ) AS d4_externo,

            /* D5: Señales de Deterioro (10%) */
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
            )) AS d5_deterioro,

            /* Señal principal — señal específica con valores reales de la BD */
            CASE
              /* 1. Mora activa + caída severa de ahorros (señal combinada crítica) */
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
        ),

        -- ─── Score global por socio ───────────────────────────────────────────
        resultado AS (
          SELECT
            v_ah_cliente,
            v_ah_nombre,
            d1_transaccional,
            d2_crediticio,
            d3_ahorro,
            d4_externo,
            d5_deterioro,
            senal_principal,
            ROUND(CAST(
              (d1_transaccional * 0.20) +
              (d2_crediticio    * 0.35) +
              (d3_ahorro        * 0.25) +
              (d4_externo       * 0.10) +
              (d5_deterioro     * 0.10)
            AS NUMERIC), 2) AS score_global
          FROM scoring
        )

        SELECT
          v_ah_cliente,
          v_ah_nombre,
          d1_transaccional,
          d2_crediticio,
          d3_ahorro,
          d4_externo,
          d5_deterioro,
          senal_principal,
          score_global,
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
          GROUP BY fecha_proceso ORDER BY fecha_proceso LIMIT 1
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
            MAX(CASE tipo_vivien WHEN 'ARRENDADA' THEN 30 WHEN 'PROPIA' THEN 0
              WHEN 'FAMILIAR' THEN 15 ELSE 10 END)                        AS vivienda_score,
            MAX(COALESCE(CAST(NULLIF(ingresos_socio,'') AS FLOAT), 0))   AS ingresos,
            MAX(COALESCE(CAST(NULLIF(egresos_socio,'')  AS FLOAT), 0))   AS egresos
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
            COALESCE(LEAST(100,
              (CASE WHEN c.max_cargas=0 THEN 0 WHEN c.max_cargas<=2 THEN 15
                WHEN c.max_cargas<=4 THEN 35 ELSE 60 END*0.40)+
              (c.vivienda_score*0.20)+
              (CASE WHEN c.ingresos=0 THEN 50
                WHEN (c.egresos/NULLIF(c.ingresos,0))>0.85 THEN 70
                WHEN (c.egresos/NULLIF(c.ingresos,0))>0.60 THEN 35
                ELSE 10 END*0.40)),20) AS d4,
            LEAST(100,GREATEST(0,
              CASE WHEN COALESCE(c.max_dias_mora,0)>0 AND p.saldo_prev IS NOT NULL
                AND a.saldo_disponible<p.saldo_prev*0.75 THEN 90 ELSE 0 END+
              CASE WHEN tx.num_tx IS NULL AND p.saldo_prev IS NOT NULL
                AND a.saldo_disponible<p.saldo_prev*0.80 THEN 60 ELSE 0 END+
              CASE WHEN a.monto_bloq>0 AND COALESCE(c.max_dias_mora,0)>0 THEN 40 ELSE 0 END
            )) AS d5
          FROM base_ahorro a
          LEFT JOIN prev_base      p  ON a.v_ah_cliente = p.v_ah_cliente
          LEFT JOIN credit_profile c  ON CAST(a.v_ah_cliente AS BIGINT)::TEXT = c.nro_cliente
          LEFT JOIN tx_activity    tx ON a.v_ah_cliente = tx.v_ah_cliente
        ),
        resultado AS (
          SELECT ROUND(CAST((d1*0.20)+(d2*0.35)+(d3*0.25)+(d4*0.10)+(d5*0.10) AS NUMERIC),2) AS sg
          FROM scoring
        )
        SELECT
          COUNT(*) AS total,
          SUM(CASE WHEN sg <= 30 THEN 1 ELSE 0 END) AS bajo,
          SUM(CASE WHEN sg BETWEEN 31 AND 60 THEN 1 ELSE 0 END) AS medio,
          SUM(CASE WHEN sg BETWEEN 61 AND 80 THEN 1 ELSE 0 END) AS alto,
          SUM(CASE WHEN sg > 80 THEN 1 ELSE 0 END) AS critico,
          (SELECT fecha FROM max_ahorro)  AS fecha_ahorro,
          (SELECT fecha FROM max_credito) AS fecha_credito
        FROM resultado;
      `;

      const [rows, distRows] = await Promise.all([
        this.sabanaAhorroRepo.query(sql, [limit, offset]),
        this.sabanaAhorroRepo.query(sqlDistribucion),
      ]);

      const dist = distRows[0];

      const data: SocioRiesgoDto[] = rows.map((r: any) => {
        const d1 = parseFloat(r.d1_transaccional ?? '0');
        const d2 = parseFloat(r.d2_crediticio    ?? '0');
        const d3 = parseFloat(r.d3_ahorro        ?? '0');
        const d4 = parseFloat(r.d4_externo       ?? '0');
        const d5 = parseFloat(r.d5_deterioro     ?? '0');

        const dimensiones: DimensionScoreDto[] = [
          { dimension: 'Comportamiento Transaccional', peso: 0.20, score: parseFloat(d1.toFixed(2)), contribucion: parseFloat((d1 * 0.20).toFixed(2)) },
          { dimension: 'Perfil Crediticio',            peso: 0.35, score: parseFloat(d2.toFixed(2)), contribucion: parseFloat((d2 * 0.35).toFixed(2)) },
          { dimension: 'Estabilidad Ahorro',           peso: 0.25, score: parseFloat(d3.toFixed(2)), contribucion: parseFloat((d3 * 0.25).toFixed(2)) },
          { dimension: 'Factores Externos',            peso: 0.10, score: parseFloat(d4.toFixed(2)), contribucion: parseFloat((d4 * 0.10).toFixed(2)) },
          { dimension: 'Señales de Deterioro',         peso: 0.10, score: parseFloat(d5.toFixed(2)), contribucion: parseFloat((d5 * 0.10).toFixed(2)) },
        ];

        return {
          nroCliente:     String(Math.floor(parseFloat(r.v_ah_cliente))),
          nombre:         r.v_ah_nombre ?? '',
          scoreGlobal:    parseFloat(r.score_global),
          nivelRiesgo:    r.nivel_riesgo,
          senalPrincipal: r.senal_principal ?? 'Sin señal crítica identificada',
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
        totalSocios:       parseInt(dist?.total ?? '0', 10),
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
}
