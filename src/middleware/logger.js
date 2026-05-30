/**
 * Middleware simple para registrar peticiones HTTP
 */
export const logger = (req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    const { method, originalUrl } = req;
    const { statusCode } = res;
    
    // Usar colores en consola opcionalmente o formato limpio
    const logMessage = `[${new Date().toISOString()}] ${method} ${originalUrl} ${statusCode} - ${duration}ms`;
    
    if (statusCode >= 400) {
      console.error(logMessage);
    } else {
      console.log(logMessage);
    }
  });
  next();
};
