import { NestFactory } from '@nestjs/core';
import { AppModule } from '@/app.module';
import { DataSource } from 'typeorm';
import { SeguridadDataSource } from '@/config/typeorm.seguridad';

import { seedInitialData } from './initial-seed';
import { CreateUsersSeeder } from './user.seeder';

async function bootstrap() {
  await SeguridadDataSource.initialize();
  console.log('🌱 Iniciando seeders...');

  const app = await NestFactory.createApplicationContext(AppModule);
  const dataSource = app.get(DataSource);

  try {
    console.log('----------------------------------------');
    console.log('    EJECUTANDO SEED INITIAL (ROLES + PERMISOS)');
    console.log('----------------------------------------');

    await seedInitialData(dataSource);

    console.log('----------------------------------------');
    console.log('    EJECUTANDO SEED USERS');
    console.log('----------------------------------------');

    const userSeeder = new CreateUsersSeeder();
    await userSeeder.run(dataSource);

    console.log('🎉 Usuarios creados correctamente');

        console.log('----------------------------------------');
    console.log('    EJECUTANDO SEED PERMISO AUDIT READ');
    console.log('----------------------------------------');


  } catch (error) {
    console.error('❌ Error ejecutando seeders:', error);
  } finally {
    await app.close();
    await SeguridadDataSource.destroy();
  }
}

bootstrap();
