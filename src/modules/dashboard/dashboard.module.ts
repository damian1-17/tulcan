import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { EtlControl }     from './entities/etl-control.entity';
import { SabanaAhorro }   from './entities/sabana-ahorro.entity';
import { Transaccion }    from './entities/transaccion.entity';
import { SabanaCredito }  from './entities/sabana-credito.entity';

import { DashboardService }    from './dashboard.service';
import { DashboardController } from './dashboard.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      EtlControl,
      SabanaAhorro,
      Transaccion,
      SabanaCredito,
    ], 'SEGURIDAD_DB'),
  ],
  controllers: [DashboardController],
  providers:   [DashboardService],
  exports:     [DashboardService],   // exportado por si otros módulos (ej: RiesgoModule) lo necesitan
})
export class DashboardModule {}
