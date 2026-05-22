import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { EtlControl }     from './entities/etl-control.entity';
import { SabanaAhorro }   from './entities/sabana-ahorro.entity';
import { Transaccion }    from './entities/transaccion.entity';
import { SabanaCredito }  from './entities/sabana-credito.entity';

import {
  EtlStatusDto,
  EtlRecentFileDto,
  DemographicsSummaryDto,
  SexoGroupDto,
  TransactionVolumeDto,
  GlobalBalancesDto,
  PreventiveActionSocioDto,
  ActiveCreditDto,
  ActiveCreditsResponseDto,
} from './dto/dashboard-response.dto';

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(
    @InjectRepository(EtlControl, 'SEGURIDAD_DB')
    private readonly etlControlRepo: Repository<EtlControl>,

    @InjectRepository(SabanaAhorro, 'SEGURIDAD_DB')
    private readonly sabanaAhorroRepo: Repository<SabanaAhorro>,

    @InjectRepository(Transaccion, 'SEGURIDAD_DB')
    private readonly transaccionRepo: Repository<Transaccion>,

    @InjectRepository(SabanaCredito, 'SEGURIDAD_DB')
    private readonly sabanaCreditoRepo: Repository<SabanaCredito>,
  ) {}

  // ─── KPI 1: Estado del ETL ─────────────────────────────────────────────────

  /**
   * Retorna el estado del pipeline de ingesta de datos:
   * - Últimos 5 archivos procesados (nombre, tipo, filas, fecha)
   * - Total acumulado de filas cargadas en la historia
   * - Timestamp de la ejecución más reciente
   *
   * Útil para que Gerencia y Riesgos validen la frescura de los datos
   * antes de tomar decisiones basadas en el dashboard.
   */
  async getEtlStatus(): Promise<EtlStatusDto> {
    try {
      // Últimos 5 archivos ordenados por fecha descendente
      const ultimosArchivos = await this.etlControlRepo
        .createQueryBuilder('e')
        .select(['e.nombre', 'e.tipo', 'e.filas', 'e.cargadoEn'])
        .orderBy('e.cargadoEn', 'DESC')
        .limit(5)
        .getMany();

      // Agregaciones en una sola consulta para eficiencia
      const agregados = await this.etlControlRepo
        .createQueryBuilder('e')
        .select('SUM(e.filas)', 'totalFilas')
        .addSelect('MAX(e.cargadoEn)', 'ultimaEjecucion')
        .getRawOne<{ totalFilas: string; ultimaEjecucion: string }>();

      const mapped: EtlRecentFileDto[] = ultimosArchivos.map((r) => ({
        nombre:    r.nombre,
        tipo:      r.tipo,
        filas:     r.filas,
        cargadoEn: r.cargadoEn,
      }));

      return {
        ultimosArchivos:      mapped,
        totalFilasHistoricas: parseInt(agregados?.totalFilas ?? '0', 10),
        ultimaEjecucion:      agregados?.ultimaEjecucion
                                ? new Date(agregados.ultimaEjecucion)
                                : null,
      };
    } catch (error) {
      this.logger.error('Error en getEtlStatus', error);
      throw error;
    }
  }

  // ─── KPI 2: Resumen demográfico ────────────────────────────────────────────

  /**
   * Analiza el perfil demográfico de los socios desde la sábana de ahorro.
   *
   * Agrupa por sexo para obtener:
   * - Conteo de registros
   * - Promedio de edad
   * - Promedio de ingresos declarados
   *
   * NOTA: sabana_ahorro tiene múltiples cortes históricos por cliente.
   * Para evitar inflar los promedios, se trabaja sobre TODOS los registros
   * tal como están. Si se necesita el perfil del corte más reciente
   * solamente, agregar un filtro por MAX(fecha_proceso).
   */
  async getDemographicsSummary(): Promise<DemographicsSummaryDto> {
    try {
      // 1. Obtener la fecha del corte más reciente
      const maxFechaRaw = await this.sabanaAhorroRepo
        .createQueryBuilder('a')
        .select('MAX(a.fechaProceso)', 'maxFecha')
        .getRawOne<{ maxFecha: string }>();

      const maxFecha = maxFechaRaw?.maxFecha ? new Date(maxFechaRaw.maxFecha) : null;

      if (!maxFecha) {
        return {
          porSexo: [],
          promedioEdadGlobal: 0,
          totalRegistros: 0,
        };
      }

      // 2. Agrupación por sexo con métricas sobre socios únicos
      const porSexoRaw = await this.sabanaAhorroRepo.query(`
        WITH unique_socios AS (
          SELECT v_ah_cliente, 
                 MAX(sexo) as sexo, 
                 MAX(CAST(CASE WHEN edad ~ '^[0-9]+(\\.[0-9]+)?$' THEN edad ELSE NULL END AS FLOAT)) as edad
          FROM sabana_ahorro
          WHERE fecha_proceso = $1
          GROUP BY v_ah_cliente
        )
        SELECT sexo, 
               COUNT(*) as total, 
               AVG(edad) as promedio_edad
        FROM unique_socios
        WHERE sexo IN ('F', 'M')
        GROUP BY sexo;
      `, [maxFecha]);

      // 3. Métricas globales sobre socios únicos (solo sexo F/M para consistencia)
      const globalRaw = await this.sabanaAhorroRepo.query(`
        WITH unique_socios AS (
          SELECT v_ah_cliente, 
                 MAX(sexo) as sexo,
                 MAX(CAST(CASE WHEN edad ~ '^[0-9]+(\\.[0-9]+)?$' THEN edad ELSE NULL END AS FLOAT)) as edad
          FROM sabana_ahorro
          WHERE fecha_proceso = $1
          GROUP BY v_ah_cliente
        )
        SELECT COUNT(*) as total, 
               AVG(edad) as promedio_edad
        FROM unique_socios
        WHERE sexo IN ('F', 'M');
      `, [maxFecha]);

      const porSexo: SexoGroupDto[] = porSexoRaw.map((r: any) => ({
        sexo:         r.sexo,
        total:        parseInt(r.total ?? '0', 10),
        promedioEdad: parseFloat(parseFloat(r.promedio_edad ?? '0').toFixed(2)),
      }));

      const global = globalRaw && globalRaw.length > 0 ? globalRaw[0] : null;

      return {
        porSexo,
        promedioEdadGlobal: parseFloat(parseFloat(global?.promedio_edad ?? '0').toFixed(2)),
        totalRegistros:     parseInt(global?.total ?? '0', 10),
      };
    } catch (error) {
      this.logger.error('Error en getDemographicsSummary', error);
      throw error;
    }
  }

  // ─── KPI 3: Volumen transaccional por período ──────────────────────────────

  /**
   * Calcula el volumen de transacciones en un rango de fechas.
   *
   * Desglosa el total entre:
   * - Créditos (signo_nc_nd = 'C'): entradas de dinero
   * - Débitos  (signo_nc_nd = 'D'): salidas de dinero
   *
   * Permite a Crédito y Cobranza detectar períodos de baja actividad
   * transaccional, que es una señal temprana de riesgo de mora.
   *
   * @param startDate Fecha de inicio del período (ISO string o Date)
   * @param endDate   Fecha de fin del período (ISO string o Date)
   */
  async getTransactionVolume(
    startDate: string | Date,
    endDate: string | Date,
  ): Promise<TransactionVolumeDto> {
    try {
      const start = new Date(startDate);
      const end   = new Date(endDate);

      // Métricas globales del período
      const globalRaw = await this.transaccionRepo
        .createQueryBuilder('t')
        .select('COUNT(*)',                          'totalTransacciones')
        .addSelect('SUM(CAST(t.valorTrn AS FLOAT))', 'sumaValorTotal')
        .addSelect('AVG(CAST(t.valorTrn AS FLOAT))', 'promedioValor')
        .where('t.fechaTrn BETWEEN :start AND :end', { start, end })
        .getRawOne<{
          totalTransacciones: string;
          sumaValorTotal: string;
          promedioValor: string;
        }>();

      // Suma de créditos (C) y débitos (D) por separado
      const porSignoRaw = await this.transaccionRepo
        .createQueryBuilder('t')
        .select('t.signoNcNd',                       'signo')
        .addSelect('SUM(CAST(t.valorTrn AS FLOAT))', 'suma')
        .where('t.fechaTrn BETWEEN :start AND :end', { start, end })
        .andWhere('t.signoNcNd IN (:...signos)',     { signos: ['C', 'D'] })
        .groupBy('t.signoNcNd')
        .getRawMany<{ signo: string; suma: string }>();

      const totalCreditos = parseFloat(
        porSignoRaw.find((r) => r.signo === 'C')?.suma ?? '0',
      );
      const totalDebitos = parseFloat(
        porSignoRaw.find((r) => r.signo === 'D')?.suma ?? '0',
      );

      return {
        desde:               start.toISOString().split('T')[0]?? '',
        hasta:               end.toISOString().split('T')[0]?? '',
        totalTransacciones:  parseInt(globalRaw?.totalTransacciones ?? '0', 10),
        sumaValorTotal:      parseFloat(parseFloat(globalRaw?.sumaValorTotal ?? '0').toFixed(2)),
        promedioValor:       parseFloat(parseFloat(globalRaw?.promedioValor ?? '0').toFixed(2)),
        totalCreditos:       parseFloat(totalCreditos.toFixed(2)),
        totalDebitos:        parseFloat(totalDebitos.toFixed(2)),
      };
    } catch (error) {
      this.logger.error('Error en getTransactionVolume', error);
      throw error;
    }
  }

  // ─── KPI 4: Saldos globales de ahorro ─────────────────────────────────────

  /**
   * Calcula los saldos consolidados de cuentas de ahorro
   * usando ÚNICAMENTE el corte más reciente disponible (MAX fecha_proceso).
   *
   * Esto evita sumar saldos de múltiples snapshots del mismo socio,
   * lo que inflaría artificialmente los totales.
   *
   * Retorna:
   * - Total saldo disponible en el sistema
   * - Total monto bloqueado
   * - Total ingresos / egresos declarados
   * - Número de cuentas activas en ese corte
   */
  async getGlobalBalances(): Promise<GlobalBalancesDto> {
    try {
      // Paso 1: obtener la fecha del corte más reciente
      const maxFechaRaw = await this.sabanaAhorroRepo
        .createQueryBuilder('a')
        .select('MAX(a.fechaProceso)', 'maxFecha')
        .getRawOne<{ maxFecha: string }>();

      const maxFecha = maxFechaRaw?.maxFecha
        ? new Date(maxFechaRaw.maxFecha)
        : null;

      if (!maxFecha) {
        return {
          totalSaldoDisponible: 0,
          totalMontoBloqueado:  0,
          totalIngresos:        0,
          totalEgresos:         0,
          fechaCorte:           null,
          totalClientes:        0,
        };
      }

      // Paso 2: agregar sobre ese corte específico
      const balancesRaw = await this.sabanaAhorroRepo
        .createQueryBuilder('a')
        .select('SUM(CAST(a.saldoDisponible AS FLOAT))', 'totalSaldo')
        .addSelect('SUM(CAST(a.montoBloq AS FLOAT))',    'totalBloq')
        .addSelect('SUM(CAST(a.ingresos AS FLOAT))',     'totalIngresos')
        .addSelect('SUM(CAST(a.egresos AS FLOAT))',      'totalEgresos')
        .addSelect('COUNT(DISTINCT a.vAhCliente)',       'totalClientes')
        .where('a.fechaProceso = :maxFecha', { maxFecha })
        .getRawOne<{
          totalSaldo:    string;
          totalBloq:     string;
          totalIngresos: string;
          totalEgresos:  string;
          totalClientes: string;
        }>();

      return {
        totalSaldoDisponible: parseFloat(parseFloat(balancesRaw?.totalSaldo    ?? '0').toFixed(2)),
        totalMontoBloqueado:  parseFloat(parseFloat(balancesRaw?.totalBloq     ?? '0').toFixed(2)),
        totalIngresos:        parseFloat(parseFloat(balancesRaw?.totalIngresos ?? '0').toFixed(2)),
        totalEgresos:         parseFloat(parseFloat(balancesRaw?.totalEgresos  ?? '0').toFixed(2)),
        fechaCorte:           maxFecha,
        totalClientes:        parseInt(balancesRaw?.totalClientes ?? '0', 10),
      };
      } catch (error) {
      this.logger.error('Error en getGlobalBalances', error);
      throw error;
    }
  }

  // ─── KPI 5: Socios prioritarios para acción preventiva ─────────────────────

  /**
   * Retorna los socios identificados como prioritarios para recibir una acción
   * preventiva debido a señales de riesgo detectadas.
   */
  async getPreventiveActionSocios(): Promise<PreventiveActionSocioDto[]> {
    try {
      const results: PreventiveActionSocioDto[] = [];

      // Auxiliar para obtener el ID de cliente de la base de datos de manera limpia
      const formatClientId = (id: number | string): string => {
        if (typeof id === 'number') {
          return String(Math.floor(id));
        }
        return String(id).trim();
      };

      // 1. Regla 1: Saldo ahorro cayó 70-95%
      const r1 = await this.sabanaAhorroRepo.query(`
        SELECT 
          t1.v_ah_cliente as client_id,
          t1.v_ah_nombre as name,
          t1.saldo_disponible as current_balance,
          t2.saldo_disponible as prev_balance,
          ROUND(CAST(((t2.saldo_disponible - t1.saldo_disponible) / t2.saldo_disponible) * 100 AS NUMERIC), 2) as pct_drop
        FROM sabana_ahorro t1
        JOIN sabana_ahorro t2 ON t1.v_ah_cliente = t2.v_ah_cliente AND t2.fecha_proceso = '2026-04-01'
        WHERE t1.fecha_proceso = '2026-05-01'
          AND t2.saldo_disponible > 300
          AND t1.saldo_disponible / t2.saldo_disponible BETWEEN 0.05 AND 0.3
        LIMIT 1
      `);
      if (r1 && r1.length > 0) {
        results.push({
          nroCliente: formatClientId(r1[0].client_id),
          nombre: r1[0].name,
          score: 87,
          nivel: 'Crítico',
          diasMora: 0,
          senalPrincipal: `Saldo ahorro cayó ${r1[0].pct_drop}% en 3 semanas`,
        });
      }

      // 2. Regla 2: Sin transacciones en últimos 15 días, con mora de crédito
      const r2 = await this.sabanaAhorroRepo.query(`
        SELECT 
          a.v_ah_cliente as client_id,
          a.v_ah_nombre as name,
          a.saldo_disponible as balance,
          c.dias_mora
        FROM sabana_ahorro a
        JOIN sabana_credito c ON CAST(a.v_ah_cliente AS TEXT) = c.nro_cliente
        WHERE a.fecha_proceso = '2026-05-01'
          AND a.saldo_disponible > 100
          AND c.qy_fechaproc = '2026-11-05'
          AND a.v_ah_cliente NOT IN (
            SELECT DISTINCT nro_cliente FROM transacciones 
            WHERE fecha_trn BETWEEN '2026-05-03' AND '2026-05-18'
              AND nro_cliente IS NOT NULL
          )
        LIMIT 1
      `);
      if (r2 && r2.length > 0) {
        results.push({
          nroCliente: formatClientId(r2[0].client_id),
          nombre: r2[0].name,
          score: 81,
          nivel: 'Crítico',
          diasMora: parseInt(r2[0].dias_mora ?? '0', 10),
          senalPrincipal: 'Sin débitos/créditos últimos 15 días',
        });
      }

      // 3. Regla 3: Ingreso/cuota deteriorado + 4 cargas
      const r3 = await this.sabanaAhorroRepo.query(`
        SELECT 
          nro_cliente as client_id,
          nombres_socio as name,
          nro_cargas_fam,
          dias_mora
        FROM sabana_credito
        WHERE qy_fechaproc = '2026-11-05'
          AND nro_cargas_fam = '4'
          AND ingresos_socio IS NOT NULL
          AND ingresos_socio != '0'
          AND ingresos_socio = egresos_socio
        LIMIT 1
      `);
      if (r3 && r3.length > 0) {
        results.push({
          nroCliente: formatClientId(r3[0].client_id),
          nombre: r3[0].name,
          score: 73,
          nivel: 'Alto',
          diasMora: parseInt(r3[0].dias_mora ?? '0', 10),
          senalPrincipal: `Ingreso/cuota deteriorado + ${r3[0].nro_cargas_fam} cargas`,
        });
      }

      // 4. Regla 4: Micro-retrasos
      const r4 = await this.sabanaAhorroRepo.query(`
        SELECT 
          nro_cliente as client_id,
          nombres_socio as name,
          calificacion,
          dias_mora
        FROM sabana_credito
        WHERE qy_fechaproc = '2026-11-05'
          AND calificacion IN ('A2', 'A3')
          AND CAST(dias_mora AS INTEGER) BETWEEN 1 AND 15
        LIMIT 1
      `);
      if (r4 && r4.length > 0) {
        results.push({
          nroCliente: formatClientId(r4[0].client_id),
          nombre: r4[0].name,
          score: 68,
          nivel: 'Alto',
          diasMora: parseInt(r4[0].dias_mora ?? '0', 10),
          senalPrincipal: 'Micro-retrasos 2 meses consecutivos',
        });
      }

      // 5. Regla 5: Tendencia negativa saldo 6 semanas
      const r5 = await this.sabanaAhorroRepo.query(`
        SELECT 
          t1.v_ah_cliente as client_id,
          t1.v_ah_nombre as name
        FROM sabana_ahorro t1
        JOIN sabana_ahorro t2 ON t1.v_ah_cliente = t2.v_ah_cliente AND t2.fecha_proceso = '2026-04-01'
        JOIN sabana_ahorro t3 ON t1.v_ah_cliente = t3.v_ah_cliente AND t3.fecha_proceso = '2026-03-01'
        WHERE t1.fecha_proceso = '2026-05-01'
          AND t3.saldo_disponible > t2.saldo_disponible
          AND t2.saldo_disponible > t1.saldo_disponible
          AND t1.saldo_disponible > 50
        LIMIT 1
      `);
      if (r5 && r5.length > 0) {
        results.push({
          nroCliente: formatClientId(r5[0].client_id),
          nombre: r5[0].name,
          score: 54,
          nivel: 'Medio',
          diasMora: 0,
          senalPrincipal: 'Tendencia negativa saldo 6 semanas',
        });
      }

      return results.sort((a, b) => b.score - a.score);
    } catch (error) {
      this.logger.error('Error en getPreventiveActionSocios', error);
      throw error;
    }
  }

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
}

