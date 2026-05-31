import { randomUUID } from 'crypto';

/**
 * Middleware para registrar peticiones HTTP con identificador único de trazabilidad (Correlation ID)
 */
export const logger = (req, res, next) => {
  const start = Date.now();
  // Obtener ID del request de cabecera o generar uno nuevo
  const requestId = req.headers['x-request-id'] || randomUUID();
  req.id = requestId;
  res.setHeader('X-Request-Id', requestId);

  // Helpers de logueo contextual enlazados al Request ID
  req.log = {
    info: (msg, meta = {}) => {
      console.log(`[INFO] [RID: ${requestId}] [${new Date().toISOString()}] ${msg}`, Object.keys(meta).length ? meta : '');
    },
    warn: (msg, meta = {}) => {
      console.warn(`[WARN] [RID: ${requestId}] [${new Date().toISOString()}] ${msg}`, Object.keys(meta).length ? meta : '');
    },
    error: (msg, error = null, meta = {}) => {
      console.error(
        `[ERROR] [RID: ${requestId}] [${new Date().toISOString()}] ${msg}`, 
        error ? (error.stack || error) : '', 
        Object.keys(meta).length ? meta : ''
      );
    }
  };

  const { method, originalUrl } = req;
  req.log.info(`--> ${method} ${originalUrl}`);

  res.on('finish', () => {
    const duration = Date.now() - start;
    const { statusCode } = res;
    
    const logMessage = `<-- ${method} ${originalUrl} ${statusCode} - ${duration}ms`;
    
    if (statusCode >= 400) {
      req.log.error(logMessage);
    } else {
      req.log.info(logMessage);
    }
  });

  next();
};
