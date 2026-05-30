import express from 'express';
import cors from 'cors';
import { logger } from './middleware/logger.js';
import { notFound } from './middleware/notFound.js';
import { errorHandler } from './middleware/errorHandler.js';
import apiRouter from './routes/index.js';

const app = express();

// Middlewares globales
app.use(cors());
app.use(express.json()); // Permitir parsear cuerpos de JSON
app.use(logger); // Registrar peticiones en consola

// Montar rutas de la API bajo el prefijo /api
app.use('/', apiRouter);

// Manejo de rutas no encontradas (404)
app.use(notFound);

// Manejador global de errores (Debe registrarse al final)
app.use(errorHandler);

export default app;
