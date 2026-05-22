
import { SeguridadDataSource }   from '@/config/typeorm.seguridad';

const dataSources = [
  { name: 'Seguridad',   ds: SeguridadDataSource },

];

async function showMigrations() {
  for (const { name, ds } of dataSources) {
    try {
      await ds.initialize();
      console.log(`\n📊 Estado de migraciones — ${name}:`);
      const hasPending = await ds.showMigrations();
      if (hasPending) {
        console.log(`⚠️  Hay migraciones pendientes en ${name}.`);
      } else {
        console.log(`✅ Todas las migraciones de ${name} están aplicadas.`);
      }
    } catch (error) {
      console.error(`❌ Error al mostrar migraciones de ${name}:`, error);
      process.exit(1);
    } finally {
      if (ds.isInitialized) await ds.destroy();
    }
  }
}

showMigrations();