/**
 * Controlador RAG (Retrieval-Augmented Generation) de Mita.
 * Generación de embeddings reales y búsquedas vectoriales con pgvector (y fallback léxico).
 */
import { db } from '../config/db.js';
import { aiService } from '../services/ai.service.js';
import { buildKeywordEmbedding, ragSearch } from '../config/aiEngine.js';

export const reindex = async (req, res, next) => {
  try {
    const allProperties = await db.getAllProperties();
    let indexedReal = 0;
    let indexedFallback = 0;
    const isGeminiAvailable = aiService.isAvailable();

    for (const prop of allProperties) {
      if (prop.estado === 'ACTIVA') {
        const searchText = aiService.generateSearchText(prop);
        const embResult = await aiService.generateEmbedding(searchText);

        if (embResult.embedding) {
          // Guardar embedding real en pgvector
          await db.updatePropertyEmbedding(prop.id, embResult.embedding, embResult.modelo);
          indexedReal++;
        } else {
          // Guardar en la tabla de embeddings simulados de palabras clave
          const keywordEmb = buildKeywordEmbedding(prop);
          await db.setEmbedding(prop.id, keywordEmb);
          indexedFallback++;
        }
      }
    }

    res.status(200).json({
      status: 'success',
      message: `Reindexacion completada. ${indexedReal} en pgvector, ${indexedFallback} simulados.`,
      stats: {
        pgvector: indexedReal,
        simulados: indexedFallback,
        total: indexedReal + indexedFallback
      },
      modelo: isGeminiAvailable ? 'gemini-embedding-2' : 'mita-keyword-v1',
      completadoEn: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
};

export const ragSearchEndpoint = async (req, res, next) => {
  try {
    const { query, limit = 10 } = req.body;

    if (!query || typeof query !== 'string' || query.trim().length < 3) {
      return res.status(400).json({ status: 'error', message: 'La consulta es requerida y debe tener al menos 3 caracteres.' });
    }

    const trimmedQuery = query.trim();

    // 1. Intentar búsqueda semántica real con Gemini + pgvector
    if (aiService.isAvailable()) {
      try {
        const embResult = await aiService.generateEmbedding(trimmedQuery);
        
        if (embResult.embedding) {
          const pgvectorResults = await db.searchByEmbedding(embResult.embedding, parseInt(limit));
          
          if (pgvectorResults && pgvectorResults.length > 0) {
            const mappedResults = pgvectorResults.map((row) => {
              const { similitud, embedding, modeloEmbedding, ...propertyFields } = row;
              return {
                property: propertyFields,
                similitud: parseFloat(parseFloat(similitud).toFixed(4)),
              };
            });

            return res.status(200).json({
              query: trimmedQuery,
              results: mappedResults,
              total: mappedResults.length,
              motor: 'gemini-embedding-2 + pgvector',
            });
          }
        }
      } catch (errVector) {
        console.warn('[RAG Controller] Búsqueda por pgvector falló, intentando fallback de palabras clave:', errVector.message);
      }
    }

    // 2. Fallback a RAG-lite léxico
    const embeddings = await db.getEmbeddings();
    const allProperties = await db.getAllProperties();

    if (embeddings.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'No hay embeddings generados. Ejecute primero POST /api/rag/reindex para poblar los indices.',
      });
    }

    const results = ragSearch(trimmedQuery, embeddings, allProperties, parseInt(limit));

    res.status(200).json({
      query: trimmedQuery,
      results: results.map((r) => ({
        property: r.property,
        similitud: parseFloat(r.similarity.toFixed(4)),
      })),
      total: results.length,
      indexSize: embeddings.length,
      motor: 'mita-keyword-v1 (fallback)',
    });
  } catch (err) {
    next(err);
  }
};
