/**
 * Controlador para verificar el estado de la API
 */
export const getStatus = (req, res, next) => {
  try {
    res.status(200).json({
      status: 'success',
      data: {
        message: 'La API está funcionando correctamente',
        environment: process.env.NODE_ENV,
        uptime: `${Math.floor(process.uptime())}s`,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    // Pasar cualquier error inesperado al manejador global de errores
    next(error);
  }
};
