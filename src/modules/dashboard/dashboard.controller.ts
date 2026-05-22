import {
  Controller,
  Get,
  Query,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
} from '@nestjs/swagger';

import { DashboardService }        from './dashboard.service';
import { EtlStatusDto }            from './dto/dashboard-response.dto';
import { DemographicsSummaryDto }  from './dto/dashboard-response.dto';
import { TransactionVolumeDto }    from './dto/dashboard-response.dto';
import { GlobalBalancesDto }       from './dto/dashboard-response.dto';

@ApiTags('Dashboard')
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('etl-status')
  @ApiOperation({
    summary: 'Estado del ETL',
    description: 'Retorna los últimos 5 archivos procesados, total de filas históricas y fecha de la última ejecución.',
  })
  @ApiResponse({ status: 200, type: EtlStatusDto })
  getEtlStatus(): Promise<EtlStatusDto> {
    return this.dashboardService.getEtlStatus();
  }

  @Get('demographics')
  @ApiOperation({
    summary: 'Resumen demográfico de socios',
    description: 'Agrupa socios por sexo con promedio de edad e ingresos. Fuente: sabana_ahorro.',
  })
  @ApiResponse({ status: 200, type: DemographicsSummaryDto })
  getDemographics(): Promise<DemographicsSummaryDto> {
    return this.dashboardService.getDemographicsSummary();
  }

  @Get('transaction-volume')
  @ApiOperation({
    summary: 'Volumen transaccional por período',
    description: 'Total y suma de transacciones entre dos fechas, desglosado en créditos y débitos.',
  })
  @ApiQuery({ name: 'startDate', required: true, example: '2026-03-01', description: 'Fecha inicio (YYYY-MM-DD)' })
  @ApiQuery({ name: 'endDate',   required: true, example: '2026-05-21', description: 'Fecha fin (YYYY-MM-DD)' })
  @ApiResponse({ status: 200, type: TransactionVolumeDto })
  getTransactionVolume(
    @Query('startDate') startDate: string,
    @Query('endDate')   endDate: string,
  ): Promise<TransactionVolumeDto> {
    if (!startDate || !endDate) {
      throw new BadRequestException('startDate y endDate son requeridos (formato YYYY-MM-DD)');
    }
    if (isNaN(Date.parse(startDate)) || isNaN(Date.parse(endDate))) {
      throw new BadRequestException('Formato de fecha inválido. Use YYYY-MM-DD');
    }
    if (new Date(startDate) > new Date(endDate)) {
      throw new BadRequestException('startDate no puede ser mayor que endDate');
    }
    return this.dashboardService.getTransactionVolume(startDate, endDate);
  }

  @Get('global-balances')
  @ApiOperation({
    summary: 'Saldos globales de ahorro',
    description: 'Suma de saldos disponibles, montos bloqueados e ingresos/egresos en el corte más reciente.',
  })
  @ApiResponse({ status: 200, type: GlobalBalancesDto })
  getGlobalBalances(): Promise<GlobalBalancesDto> {
    return this.dashboardService.getGlobalBalances();
  }
}
