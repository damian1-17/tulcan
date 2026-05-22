import { TypeOrmModuleOptions } from '@nestjs/typeorm';

export const seguridadDS = (): TypeOrmModuleOptions => ({
  type: 'postgres',
  host: process.env.SEGURIDAD_DB_HOST,
  port: Number(process.env.SEGURIDAD_DB_PORT),
  username: process.env.SEGURIDAD_DB_USER,
  password: String(process.env.SEGURIDAD_DB_PASS),
  database: process.env.SEGURIDAD_DB_NAME,
  synchronize: false,
  logging: true,
  ssl: false
});