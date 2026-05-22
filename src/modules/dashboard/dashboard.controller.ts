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
import {
  EtlStatusDto,
  DemographicsSummaryDto,
  TransactionVolumeDto,
  GlobalBalancesDto,
  PreventiveActionSocioDto,
  ActiveCreditsResponseDto,
} from './dto/dashboard-response.dto';

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

  @Get('preventive-actions')
  @ApiOperation({
    summary: 'Socios prioritarios para acción preventiva',
    description: 'Retorna una lista de socios con alta prioridad de acción preventiva, incluyendo su score de riesgo y señales de alerta principales.',
  })
  @ApiResponse({ status: 200, type: [PreventiveActionSocioDto] })
  getPreventiveActions(): Promise<PreventiveActionSocioDto[]> {
    return this.dashboardService.getPreventiveActionSocios();
  }

  @Get('active-credits')
  @ApiOperation({
    summary: 'Socios con crédito activo',
    description: 'Retorna un listado paginado de socios que tienen créditos activos en el corte más reciente, con opción de búsqueda.',
  })
  @ApiQuery({ name: 'page',     required: false, example: 1,  description: 'Número de página (por defecto: 1)' })
  @ApiQuery({ name: 'limit',    required: false, example: 10, description: 'Límite de registros por página (por defecto: 10)' })
  @ApiQuery({ name: 'search',   required: false, example: 'SOCIO', description: 'Buscar por nombre, identificación o número de operación' })
  @ApiResponse({ status: 200, type: ActiveCreditsResponseDto })
  getActiveCredits(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ): Promise<ActiveCreditsResponseDto> {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 10;
    
    if (isNaN(pageNum) || pageNum <= 0) {
      throw new BadRequestException('El parámetro page debe ser un número entero mayor a 0');
    }
    if (isNaN(limitNum) || limitNum <= 0) {
      throw new BadRequestException('El parámetro limit debe ser un número entero mayor a 0');
    }

    return this.dashboardService.getActiveCredits(pageNum, limitNum, search);
  }
}

