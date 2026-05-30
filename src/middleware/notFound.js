/**
 * Middleware para manejar peticiones a rutas inexistentes (404)
 */
export const notFound = (req, res, next) => {
  res.status(404).json({
    status: 'fail',
    message: `Ruta no encontrada - ${req.method} ${req.originalUrl}`
  });
};
