import { config } from 'dotenv';
import { SeguridadDataSource } from '@/config/typeorm.seguridad';

config(); // ← debe ir antes de cualquier import que use process.env

const dataSources = [
  { name: 'Seguridad', ds: SeguridadDataSource },
];

async function runMigrations() {
  for (const { name, ds } of dataSources) {
    try {
      await ds.initialize();
      console.log(`📦 Ejecutando migraciones de ${name}...`);
      await ds.runMigrations();
      console.log(`✅ Migraciones de ${name} ejecutadas correctamente.`);
    } catch (error) {
      console.error(`❌ Error en migraciones de ${name}:`, error);
      process.exit(1);
    } finally {
      if (ds.isInitialized) await ds.destroy();
    }
  }
}

runMigrations();