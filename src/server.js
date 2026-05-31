import app from './app.js';
import { config } from './config/env.js';
import { db } from './config/db.js';

// Levantar el servidor HTTP
const server = app.listen(config.port, () => {
  console.log(`Servidor corriendo en http://localhost:${config.port}`);
  console.log(`Entorno actual: ${config.nodeEnv}`);
});

// Manejo de apagado limpio / elegante (Graceful Shutdown)
const shutdown = (signal) => {
  console.log(`\nRecibida señal ${signal}. Iniciando apagado elegante...`);
  server.close(async () => {
    console.log('Servidor HTTP cerrado. Cerrando pool de base de datos...');
    try {
      await db.closePool();
      console.log('Pool de base de datos cerrado. Proceso finalizado.');
      process.exit(0);
    } catch (err) {
      console.error('Error al cerrar el pool de base de datos:', err);
      process.exit(1);
    }
  });

  // Forzar el cierre después de 10 segundos si no responde
  setTimeout(() => {
    console.error('Apagado forzado por tiempo de espera excedido.');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
