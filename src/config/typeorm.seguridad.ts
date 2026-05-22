import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { seguridadDS } from '@/config/seguridadDS.config';

config();

export const SeguridadDataSource = new DataSource({
  ...(seguridadDS() as any),
  host:     process.env.SEGURIDAD_DB_DIRECT_HOST ?? process.env.SEGURIDAD_DB_HOST,
  port:     Number(process.env.SEGURIDAD_DB_DIRECT_PORT ?? process.env.SEGURIDAD_DB_PORT),
  username: process.env.SEGURIDAD_DB_DIRECT_USER ?? process.env.SEGURIDAD_DB_USER,
  entities:   ['src/seguridad/**/*.entity{.ts,.js}'],
  migrations: ['src/database/migrations/*{.ts,.js}'],
  ssl:false
});