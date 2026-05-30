import { config } from '../config/env.js';

/**
 * Middleware centralizado de manejo de errores
 */
export const errorHandler = (err, req, res, next) => {
  // Si el código de estado es 200 (éxito), asumimos un error interno (500)
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  
  // Loguear el error en la consola
  console.error('Error capturado:', err);

  res.status(statusCode).json({
    status: 'error',
    message: err.message || 'Error interno del servidor',
    // Solo mostrar el stack trace en entorno de desarrollo para evitar fugar información sensible
    ...(config.isDevelopment && { stack: err.stack })
  });
};
