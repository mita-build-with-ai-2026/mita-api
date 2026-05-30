/**
 * Controlador de inteligencia artificial de Mita.
 * Búsqueda conversacional, comparador y normalizador de publicaciones.
 */
import { db } from '../config/db.js';
import { aiSearch, aiCompare, aiEnhanceListing } from '../config/aiEngine.js';

export const search = (req, res, next) => {
  try {
    const { query, limit = 10 } = req.body;

    if (!query || typeof query !== 'string' || query.trim().length < 3) {
      return res.status(400).json({ status: 'error', message: 'La consulta (query) debe tener al menos 3 caracteres.' });
    }

    const start = Date.now();
    const allProperties = db.getAllProperties();
    const { criteria, results } = aiSearch(query.trim(), allProperties, parseInt(limit));
    const elapsed = Date.now() - start;

    res.status(200).json({
      query: query.trim(),
      criteria,
      results,
      meta: {
        total: results.length,
        tiempoRespuestaMs: elapsed,
        motor: 'mita-ai-engine-v1',
      },
    });
  } catch (err) {
    next(err);
  }
};

export const compare = (req, res, next) => {
  try {
    const { query, propertyIds } = req.body;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({ status: 'error', message: 'La consulta (query) es requerida.' });
    }

    if (!Array.isArray(propertyIds) || propertyIds.length < 2 || propertyIds.length > 3) {
      return res.status(400).json({ status: 'error', message: 'Se requieren entre 2 y 3 IDs de propiedades para comparar.' });
    }

    const properties = propertyIds
      .map((id) => db.getPropertyById(id))
      .filter(Boolean);

    if (properties.length < 2) {
      return res.status(404).json({ status: 'error', message: 'No se encontraron suficientes propiedades con los IDs proporcionados.' });
    }

    const result = aiCompare(query.trim(), properties);

    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

export const enhanceListing = (req, res, next) => {
  try {
    const { rawText } = req.body;

    if (!rawText || typeof rawText !== 'string' || rawText.trim().length < 10) {
      return res.status(400).json({ status: 'error', message: 'rawText debe tener al menos 10 caracteres.' });
    }

    const result = aiEnhanceListing(rawText.trim());

    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};
