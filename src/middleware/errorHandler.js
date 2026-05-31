import { config } from '../config/env.js';

/**
 * Middleware centralizado de manejo de errores
 */
export const errorHandler = (err, req, res, next) => {
  // Si el código de estado es 200 (éxito), asumimos un error interno (500)
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  const requestId = req.id || 'N/A';
  
  if (req.log) {
    req.log.error('Error capturado en request:', err);
  } else {
    console.error(`[ERROR] [RID: ${requestId}] [${new Date().toISOString()}] Error capturado en request:`, err.stack || err);
  }

  res.status(statusCode).json({
    status: 'error',
    message: err.message || 'Error interno del servidor',
    requestId,
    // Solo mostrar el stack trace en entorno de desarrollo para evitar fugar información sensible
    ...(config.isDevelopment && { stack: err.stack })
  });
};
