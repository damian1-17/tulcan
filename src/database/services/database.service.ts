// src/database/database.service.ts
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Injectable()
export class DatabaseService implements OnModuleInit {
  private readonly logger = new Logger(DatabaseService.name);

  constructor(
    // @InjectDataSource('PEDIDOS_DB')
    // private readonly pedidosDS: DataSource,

    @InjectDataSource('SEGURIDAD_DB')
    private readonly seguridadDS: DataSource,
  ) {}

  onModuleInit() {
    // this.checkConnection(this.pedidosDS,     'PEDIDOS_DB');
    
    this.checkConnection(this.seguridadDS,   'SEGURIDAD_DB');
  }

  private checkConnection(dataSource: DataSource, name: string) {
    if (dataSource.isInitialized) {
      this.logger.log(`✅ ${name} conectada correctamente`);
    } else {
      this.logger.error(`❌ ${name} no se pudo conectar`);
    }
  }
}