// src/database/database.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DatabaseService } from './services/database.service';


@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      name: 'SEGURIDAD_DB',
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host:     config.get<string>('SEGURIDAD_DB_HOST'),
        port:     config.get<number>('SEGURIDAD_DB_PORT'),
        username: config.get<string>('SEGURIDAD_DB_USER'),
        password: config.get<string>('SEGURIDAD_DB_PASS'),
        database: config.get<string>('SEGURIDAD_DB_NAME'),
        synchronize: false,
        logging: true,
        entities: [],
        autoLoadEntities: true,
      }),
    }),
  ],
  providers: [DatabaseService],
  exports: [DatabaseService, TypeOrmModule],
})
export class DatabaseModule {}