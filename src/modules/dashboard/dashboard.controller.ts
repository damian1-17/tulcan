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

import { DashboardService }          from './dashboard.service';
import {
  ActiveCreditsResponseDto,
  DelinquencyRiskResponseDto,
  PredictionsResponseDto,
  CuotasRiesgoResponseDto,
  ConcentracionResponseDto,
  RetencionResponseDto,
  RecuperabilidadResponseDto,
} from './dto/dashboard-response.dto';

@ApiTags('Dashboard')
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('active-credits')
  @ApiOperation({
    summary: 'Socios con crédito activo',
    description: 'Retorna un listado paginado de socios que tienen créditos activos en el corte más reciente, con opción de búsqueda.',
  })
  @ApiQuery({ name: 'page',   required: false, example: 1,       description: 'Número de página (por defecto: 1)' })
  @ApiQuery({ name: 'limit',  required: false, example: 10,      description: 'Límite de registros por página (por defecto: 10)' })
  @ApiQuery({ name: 'search', required: false, example: 'SOCIO', description: 'Buscar por nombre, identificación o número de operación' })
  @ApiResponse({ status: 200, type: ActiveCreditsResponseDto })
  getActiveCredits(
    @Query('page')   page?:   string,
    @Query('limit')  limit?:  string,
    @Query('search') search?: string,
  ): Promise<ActiveCreditsResponseDto> {
    const pageNum  = page  ? parseInt(page,  10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 10;

    if (isNaN(pageNum)  || pageNum  <= 0) throw new BadRequestException('El parámetro page debe ser un número entero mayor a 0');
    if (isNaN(limitNum) || limitNum <= 0) throw new BadRequestException('El parámetro limit debe ser un número entero mayor a 0');

    return this.dashboardService.getActiveCredits(pageNum, limitNum, search);
  }

  @Get('delinquency-risk')
  @ApiOperation({
    summary: 'Riesgo de morosidad por socio',
    description: 'Calcula el score de riesgo de morosidad individual para cada socio desglosado en 5 dimensiones: Comportamiento Transaccional (20%), Perfil Crediticio (35%), Estabilidad Ahorro (25%), Factores Externos (10%) y Señales de Deterioro (10%). Retorna la lista paginada con la distribución por nivel de riesgo.',
  })
  @ApiQuery({ name: 'page',  required: false, example: 1,      description: 'Número de página (por defecto: 1)' })
  @ApiQuery({ name: 'limit', required: false, example: 20,     description: 'Límite de registros por página (por defecto: 20)' })
  @ApiQuery({ name: 'nivel', required: false, example: 'Alto', description: 'Filtrar por nivel: Bajo | Medio | Alto | Crítico' })
  @ApiResponse({ status: 200, type: DelinquencyRiskResponseDto })
  getDelinquencyRisk(
    @Query('page')  page?:  string,
    @Query('limit') limit?: string,
    @Query('nivel') nivel?: string,
  ): Promise<DelinquencyRiskResponseDto> {
    const pageNum  = page  ? parseInt(page,  10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 20;

    if (isNaN(pageNum)  || pageNum  <= 0) throw new BadRequestException('El parámetro page debe ser mayor a 0');
    if (isNaN(limitNum) || limitNum <= 0) throw new BadRequestException('El parámetro limit debe ser mayor a 0');
    if (limitNum > 100)                   throw new BadRequestException('El parámetro limit no puede superar 100');

    return this.dashboardService.getDelinquencyRisk(pageNum, limitNum, nivel);
  }

  @Get('predictions')
  @ApiOperation({
    summary: 'Predicción de morosidad a 10, 20 y 30 días',
    description: 'Identifica socios con alta probabilidad de caer en mora en los próximos 10, 20 o 30 días utilizando el modelo de 7 dimensiones más probabilidades sigmóide por horizonte temporal.',
  })
  @ApiQuery({ name: 'page',      required: false, example: 1,    description: 'Página (por defecto: 1)' })
  @ApiQuery({ name: 'limit',     required: false, example: 20,   description: 'Límite por página (por defecto: 20)' })
  @ApiQuery({ name: 'horizonte', required: false, example: '10', description: 'Filtrar por horizonte: 10 | 20 | 30 (días). Sin valor = todos' })
  @ApiResponse({ status: 200, type: PredictionsResponseDto })
  getPredictions(
    @Query('page')      page?:      string,
    @Query('limit')     limit?:     string,
    @Query('horizonte') horizonte?: string,
  ): Promise<PredictionsResponseDto> {
    const pageNum  = page  ? parseInt(page,  10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 20;

    if (isNaN(pageNum)  || pageNum  <= 0) throw new BadRequestException('El parámetro page debe ser mayor a 0');
    if (isNaN(limitNum) || limitNum <= 0) throw new BadRequestException('El parámetro limit debe ser mayor a 0');
    if (limitNum > 100)                   throw new BadRequestException('El parámetro limit no puede superar 100');
    if (horizonte && !['10','20','30'].includes(horizonte))
      throw new BadRequestException('El horizonte debe ser 10, 20 o 30');

    return this.dashboardService.getPredictions(pageNum, limitNum, horizonte);
  }

  @Get('cuotas-riesgo')
  @ApiOperation({
    summary: 'Cuotas próximas en riesgo',
    description: 'Lista las cuotas de crédito que vencen en los próximos 7, 15 o 30 días ordenadas por prioridad de atención (CRÍTICA, ALTA, MEDIA, BAJA). La fecha de próximo pago se estima a partir de la última cuota pagada más un mes.',
  })
  @ApiQuery({ name: 'page',      required: false, example: 1,    description: 'Página (por defecto: 1)' })
  @ApiQuery({ name: 'limit',     required: false, example: 20,   description: 'Límite por página (por defecto: 20, máx 100)' })
  @ApiQuery({ name: 'ventana',   required: false, example: 30,   description: 'Ventana de días hacia adelante: 7 | 15 | 30 (por defecto: 30)' })
  @ApiQuery({ name: 'prioridad', required: false, example: 'ALTA', description: 'Filtrar por prioridad: CRÍTICA | ALTA | MEDIA | BAJA' })
  @ApiResponse({ status: 200, type: CuotasRiesgoResponseDto })
  getCuotasEnRiesgo(
    @Query('page')      page?:      string,
    @Query('limit')     limit?:     string,
    @Query('ventana')   ventana?:   string,
    @Query('prioridad') prioridad?: string,
  ): Promise<CuotasRiesgoResponseDto> {
    const pageNum    = page    ? parseInt(page,    10) : 1;
    const limitNum   = limit   ? parseInt(limit,   10) : 20;
    const ventanaNum = ventana ? parseInt(ventana, 10) : 30;

    if (isNaN(pageNum)    || pageNum    <= 0) throw new BadRequestException('El parámetro page debe ser mayor a 0');
    if (isNaN(limitNum)   || limitNum   <= 0) throw new BadRequestException('El parámetro limit debe ser mayor a 0');
    if (limitNum > 100)                       throw new BadRequestException('El parámetro limit no puede superar 100');
    if (![7, 15, 30].includes(ventanaNum))    throw new BadRequestException('ventana debe ser 7, 15 o 30');
    if (prioridad && !['CRÍTICA','ALTA','MEDIA','BAJA'].includes(prioridad))
      throw new BadRequestException('prioridad debe ser CRÍTICA, ALTA, MEDIA o BAJA');

    return this.dashboardService.getCuotasEnRiesgo(pageNum, limitNum, ventanaNum, prioridad);
  }

  @Get('concentracion')
  @ApiOperation({
    summary: 'Concentración de Cartera',
    description: 'Obtiene las métricas de concentración de cartera por actividad económica, destino del crédito y ciudad de origen, junto con sus respectivos índices de mora.',
  })
  @ApiResponse({ status: 200, type: ConcentracionResponseDto })
  getConcentracionCartera(): Promise<ConcentracionResponseDto> {
    return this.dashboardService.getConcentracionCartera();
  }

  @Get('retencion')
  @ApiOperation({
    summary: 'Retención de Socios',
    description: 'Identifica socios con riesgo de desvinculación y fuga de liquidez, basado en inactividad transaccional, saldo disponible, vinculación crediticia y uso de canales digitales.',
  })
  @ApiQuery({ name: 'page',   required: false, example: 1,      description: 'Página (por defecto: 1)' })
  @ApiQuery({ name: 'limit',  required: false, example: 20,     description: 'Límite por página (por defecto: 20, máx 100)' })
  @ApiQuery({ name: 'riesgo', required: false, example: 'Alto', description: 'Filtrar por nivel: Bajo | Medio | Alto' })
  @ApiResponse({ status: 200, type: RetencionResponseDto })
  getRetencionSocios(
    @Query('page')   page?:   string,
    @Query('limit')  limit?:  string,
    @Query('riesgo') riesgo?: string,
  ): Promise<RetencionResponseDto> {
    const pageNum  = page  ? parseInt(page,  10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 20;

    if (isNaN(pageNum)  || pageNum  <= 0) throw new BadRequestException('El parámetro page debe ser mayor a 0');
    if (isNaN(limitNum) || limitNum <= 0) throw new BadRequestException('El parámetro limit debe ser mayor a 0');
    if (limitNum > 100)                   throw new BadRequestException('El parámetro limit no puede superar 100');
    if (riesgo && !['Bajo', 'Medio', 'Alto'].includes(riesgo))
      throw new BadRequestException('riesgo debe ser Bajo, Medio o Alto');

    return this.dashboardService.getRetencionSocios(pageNum, limitNum, riesgo);
  }

  @Get('recuperabilidad')
  @ApiOperation({
    summary: 'Recuperabilidad de Cartera Vencida',
    description: 'Predice la probabilidad de recuperación de créditos vencidos basándose en garantías, ingresos declarados, saldo de ahorro disponible y días de mora.',
  })
  @ApiQuery({ name: 'page',     required: false, example: 1,      description: 'Página (por defecto: 1)' })
  @ApiQuery({ name: 'limit',    required: false, example: 20,     description: 'Límite por página (por defecto: 20, máx 100)' })
  @ApiQuery({ name: 'segmento', required: false, example: 'Alta', description: 'Filtrar por segmento: Alta | Media | Baja' })
  @ApiResponse({ status: 200, type: RecuperabilidadResponseDto })
  getRecuperabilidadCartera(
    @Query('page')     page?:     string,
    @Query('limit')    limit?:    string,
    @Query('segmento') segmento?: string,
  ): Promise<RecuperabilidadResponseDto> {
    const pageNum  = page  ? parseInt(page,  10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 20;

    if (isNaN(pageNum)  || pageNum  <= 0) throw new BadRequestException('El parámetro page debe ser mayor a 0');
    if (isNaN(limitNum) || limitNum <= 0) throw new BadRequestException('El parámetro limit debe ser mayor a 0');
    if (limitNum > 100)                   throw new BadRequestException('El parámetro limit no puede superar 100');
    if (segmento && !['Alta', 'Media', 'Baja'].includes(segmento))
      throw new BadRequestException('segmento debe ser Alta, Media o Baja');

    return this.dashboardService.getRecuperabilidadCartera(pageNum, limitNum, segmento);
  }
}
