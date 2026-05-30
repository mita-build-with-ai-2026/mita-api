import app from './app.js';
import { config } from './config/env.js';

// Levantar el servidor HTTP
const server = app.listen(config.port, () => {
  console.log(`Servidor corriendo en http://localhost:${config.port}`);
  console.log(`Entorno actual: ${config.nodeEnv}`);
});

// Manejo de apagado limpio / elegante (Graceful Shutdown)
const shutdown = (signal) => {
  console.log(`\nRecibida señal ${signal}. Iniciando apagado elegante...`);
  server.close(() => {
    console.log('Servidor HTTP cerrado. Proceso finalizado.');
    process.exit(0);
  });

  // Forzar el cierre después de 10 segundos si no responde
  setTimeout(() => {
    console.error('Apagado forzado por tiempo de espera excedido.');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
