import { Router } from 'express';
import { getStatus } from '../controllers/status.controller.js';

const router = Router();

// Ruta de health check / verificación de estado
router.get('/status', getStatus);
router.get("/ping", (req, res) => res.send("pong"));
router.get("/", (req, res) => res.send("hola ar1"));

export default router;
