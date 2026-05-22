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
      // Agrupación por sexo con métricas
      const porSexoRaw = await this.sabanaAhorroRepo
        .createQueryBuilder('a')
        .select('a.sexo', 'sexo')
        .addSelect('COUNT(*)', 'total')
        .addSelect('AVG(CAST(a.edad AS FLOAT))', 'promedioEdad')
        .addSelect('AVG(CAST(a.ingresos AS FLOAT))', 'promedioIngresos')
        .where('a.sexo IS NOT NULL')
        .groupBy('a.sexo')
        .orderBy('"total"', 'DESC')
        .getRawMany<{
          sexo: string;
          total: string;
          promedioEdad: string;
          promedioIngresos: string;
        }>();

      // Métricas globales en una sola consulta
      const globalRaw = await this.sabanaAhorroRepo
        .createQueryBuilder('a')
        .select('COUNT(*)', 'total')
        .addSelect('AVG(CAST(a.edad AS FLOAT))', 'promedioEdad')
        .addSelect('AVG(CAST(a.ingresos AS FLOAT))', 'promedioIngresos')
        .getRawOne<{
          total: string;
          promedioEdad: string;
          promedioIngresos: string;
        }>();

      const porSexo: SexoGroupDto[] = porSexoRaw.map((r) => ({
        sexo:             r.sexo,
        total:            parseInt(r.total, 10),
        promedioEdad:     parseFloat(parseFloat(r.promedioEdad ?? '0').toFixed(2)),
        promedioIngresos: parseFloat(parseFloat(r.promedioIngresos ?? '0').toFixed(2)),
      }));

      return {
        porSexo,
        promedioEdadGlobal:     parseFloat(parseFloat(globalRaw?.promedioEdad ?? '0').toFixed(2)),
        promedioIngresosGlobal: parseFloat(parseFloat(globalRaw?.promedioIngresos ?? '0').toFixed(2)),
        totalRegistros:         parseInt(globalRaw?.total ?? '0', 10),
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
          totalCuentas:         0,
        };
      }

      // Paso 2: agregar sobre ese corte específico
      const balancesRaw = await this.sabanaAhorroRepo
        .createQueryBuilder('a')
        .select('SUM(CAST(a.saldoDisponible AS FLOAT))', 'totalSaldo')
        .addSelect('SUM(CAST(a.montoBloq AS FLOAT))',    'totalBloq')
        .addSelect('SUM(CAST(a.ingresos AS FLOAT))',     'totalIngresos')
        .addSelect('SUM(CAST(a.egresos AS FLOAT))',      'totalEgresos')
        .addSelect('COUNT(*)',                           'totalCuentas')
        .where('a.fechaProceso = :maxFecha', { maxFecha })
        .getRawOne<{
          totalSaldo:    string;
          totalBloq:     string;
          totalIngresos: string;
          totalEgresos:  string;
          totalCuentas:  string;
        }>();

      return {
        totalSaldoDisponible: parseFloat(parseFloat(balancesRaw?.totalSaldo    ?? '0').toFixed(2)),
        totalMontoBloqueado:  parseFloat(parseFloat(balancesRaw?.totalBloq     ?? '0').toFixed(2)),
        totalIngresos:        parseFloat(parseFloat(balancesRaw?.totalIngresos ?? '0').toFixed(2)),
        totalEgresos:         parseFloat(parseFloat(balancesRaw?.totalEgresos  ?? '0').toFixed(2)),
        fechaCorte:           maxFecha,
        totalCuentas:         parseInt(balancesRaw?.totalCuentas ?? '0', 10),
      };
    } catch (error) {
      this.logger.error('Error en getGlobalBalances', error);
      throw error;
    }
  }
}
