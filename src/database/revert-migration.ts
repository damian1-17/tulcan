import { SeguridadDataSource } from '@/config/typeorm.seguridad';

async function revertMigration() {
  try {
    await SeguridadDataSource.initialize();
    console.log('⏪ Revirtiendo última migración...');
    await SeguridadDataSource.undoLastMigration();
    console.log('✅ Migración revertida correctamente.');
  } catch (error) {
    console.error('❌ Error al revertir migración:', error);
    process.exit(1);
  } finally {
    if (SeguridadDataSource.isInitialized) {
      await SeguridadDataSource.destroy();
    }
  }
}

revertMigration();
