/**
 * Controlador de inteligencia artificial de Mita.
 * Búsqueda conversacional, comparador, normalizador de publicaciones, discovery de fuentes y análisis de URLs.
 */
import { db } from '../config/db.js';
import { aiService } from '../services/ai.service.js';
import { scoreProperty } from '../config/aiEngine.js';

export const search = async (req, res, next) => {
  try {
    const { query, limit = 10 } = req.body;

    if (!query || typeof query !== 'string' || query.trim().length < 3) {
      return res.status(400).json({ status: 'error', message: 'La consulta (query) debe tener al menos 3 caracteres.' });
    }

    const start = Date.now();
    const allProperties = await db.getAllProperties();
    
    // 1. Extraer criterios con AI Service (que usa Gemini o fallback léxico)
    const criteria = await aiService.extractCriteria(query.trim());

    // 2. Scorear todas las propiedades activas
    const scoredResults = allProperties
      .filter((p) => p.estado === 'ACTIVA')
      .map((p) => {
        const scoreData = scoreProperty(p, criteria);
        return {
          property: p,
          ...scoreData,
          reasons: scoreData.razones || []
        };
      })
      .filter((r) => r.puntajeCoincidencia > 30)
      .sort((a, b) => b.puntajeCoincidencia - a.puntajeCoincidencia)
      .slice(0, parseInt(limit));

    const elapsed = Date.now() - start;

    // 3. Generar explicación si Gemini está disponible
    let explicacion = '';
    const useIA = aiService.isAvailable();
    if (useIA && scoredResults.length > 0) {
      explicacion = await aiService.explainResults(
        query.trim(),
        criteria,
        scoredResults.map(r => ({
          id: r.property.id,
          titulo: r.property.titulo,
          zona: r.property.zona,
          precio: r.property.precio,
          moneda: r.property.moneda,
          matchScore: r.puntajeCoincidencia
        }))
      );
    }

    // 4. Registrar en la base de datos (EventoBusqueda y ResultadoBusqueda)
    try {
      const eventRecord = await db.createSearchEvent({
        consultaCruda: query.trim(),
        criteriosExtraidos: criteria,
        cantidadResultados: scoredResults.length,
        usoRag: false,
        usoIA: useIA,
        modeloIA: useIA ? 'gemini-3.5-flash' : null,
        tiempoRespuestaMs: elapsed
      });

      for (let i = 0; i < scoredResults.length; i++) {
        const r = scoredResults[i];
        
        // Crear una etiqueta corta para la UI
        let etiquetaCorta = 'Opcion recomendada';
        if (r.puntajeCoincidencia >= 90) etiquetaCorta = 'Coincidencia excelente';
        else if (r.puntajeCoincidencia >= 75) etiquetaCorta = 'Muy buena opcion';
        
        await db.createSearchResult({
          idEventoBusqueda: eventRecord.id,
          idPropiedad: r.property.id,
          puntajeCoincidencia: r.puntajeCoincidencia,
          similitudRag: null,
          resumen: r.property.descripcion ? r.property.descripcion.substring(0, 150) + '...' : null,
          razones: r.razones.map(razon => razon.replace(/^✓\s*/, '')), // Limpiar checkmarks si quedaran
          advertencias: r.advertencias,
          informacionFaltante: r.informacionFaltante,
          recomendacion: i === 0 ? 'Esta es la propiedad que mejor se adapta a tus necesidades inmobiliarias.' : null,
          etiquetaCorta,
          posicionRanking: i + 1
        });
      }
    } catch (dbErr) {
      req.log.error('[AI Controller] Error al registrar evento/resultados de búsqueda en BD:', dbErr);
    }

    res.status(200).json({
      query: query.trim(),
      criteria,
      results: scoredResults,
      explicacion,
      meta: {
        total: scoredResults.length,
        tiempoRespuestaMs: elapsed,
        motor: useIA ? 'gemini-3.5-flash' : 'mita-ai-engine-v1',
      },
    });
  } catch (err) {
    next(err);
  }
};

export const compare = async (req, res, next) => {
  try {
    const { query, propertyIds } = req.body;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({ status: 'error', message: 'La consulta (query) es requerida.' });
    }

    if (!Array.isArray(propertyIds) || propertyIds.length < 2 || propertyIds.length > 3) {
      return res.status(400).json({ status: 'error', message: 'Se requieren entre 2 y 3 IDs de propiedades para comparar.' });
    }

    const properties = (await Promise.all(
      propertyIds.map((id) => db.getPropertyById(id))
    )).filter(Boolean);

    if (properties.length < 2) {
      return res.status(404).json({ status: 'error', message: 'No se encontraron suficientes propiedades con los IDs proporcionados.' });
    }

    const comparisonResult = await aiService.compareProperties(query.trim(), properties);

    res.status(200).json({
      ...comparisonResult,
      query: query.trim(),
      properties,
      meta: {
        motor: aiService.isAvailable() ? 'gemini-3.5-flash' : 'mita-ai-engine-v1'
      }
    });
  } catch (err) {
    next(err);
  }
};

export const enhanceListing = async (req, res, next) => {
  try {
    const { rawText } = req.body;

    if (!rawText || typeof rawText !== 'string' || rawText.trim().length < 10) {
      return res.status(400).json({ status: 'error', message: 'rawText debe tener al menos 10 caracteres.' });
    }

    const result = await aiService.normalizeRawListing(rawText.trim());

    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

export const discoverSources = async (req, res, next) => {
  try {
    const { query, city } = req.body;

    if (!query || typeof query !== 'string' || query.trim().length < 3) {
      return res.status(400).json({ status: 'error', message: 'La consulta (query) debe tener al menos 3 caracteres.' });
    }

    const result = await aiService.discoverSources(query.trim(), city);

    // Si encontramos fuentes, agregarlas a la base de datos para registrar nuevas fuentes
    const createdSources = [];
    if (result.fuentesDescubiertas && result.fuentesDescubiertas.length > 0) {
      const activeSources = await db.getSources();
      const existingUrls = activeSources.map(s => s.urlBase?.toLowerCase());

      for (const src of result.fuentesDescubiertas) {
        if (!src.urlBase) continue;
        if (!existingUrls.includes(src.urlBase.toLowerCase())) {
          try {
            const newSrc = await db.createSource({
              nombre: src.nombre,
              urlBase: src.urlBase,
              tipoFuente: src.tipoFuente || 'HTML_CACHE',
              activo: true
            });
            createdSources.push(newSrc);
          } catch (dbErr) {
            req.log.error('[AI Controller] Error al registrar nueva fuente en BD:', dbErr);
          }
        }
      }
    }

    res.status(200).json({
      status: 'success',
      query: query.trim(),
      explicacion: result.explicacion,
      fuentesDescubiertas: result.fuentesDescubiertas,
      nuevasFuentesRegistradas: createdSources
    });
  } catch (err) {
    next(err);
  }
};

export const analyzeUrls = async (req, res, next) => {
  try {
    const {
      urls,
      crawlListings,
      maxPagesPerUrl,
      maxListingLinksPerUrl,
      maxPaginationPagesPerUrl,
      maxProperties
    } = req.body;

    if (!Array.isArray(urls) || urls.length === 0) {
      return res.status(400).json({ status: 'error', message: 'Se requiere una lista de URLs en el campo "urls".' });
    }

    const results = await aiService.analyzeUrls(urls, {
      crawlListings,
      maxPagesPerUrl,
      maxListingLinksPerUrl,
      maxPaginationPagesPerUrl,
      maxProperties
    });

    res.status(200).json({
      status: 'success',
      totalUrlsProcesadas: urls.length,
      results
    });
  } catch (err) {
    next(err);
  }
};
