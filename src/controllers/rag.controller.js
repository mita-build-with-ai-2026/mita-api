/**
 * Controlador RAG (Retrieval-Augmented Generation) lite de Mita.
 * Gestión de embeddings de propiedades y búsqueda semántica.
 */
import { db } from '../config/db.js';
import { buildKeywordEmbedding, ragSearch } from '../config/aiEngine.js';

export const reindex = (req, res, next) => {
  try {
    const allProperties = db.getAllProperties();
    let indexed = 0;

    for (const prop of allProperties) {
      if (prop.estado === 'ACTIVA') {
        const embedding = buildKeywordEmbedding(prop);
        db.setEmbedding(prop.id, embedding);
        indexed++;
      }
    }

    res.status(200).json({
      status: 'success',
      message: `Reindexación completada. ${indexed} propiedades indexadas.`,
      indexed,
      modelo: 'mita-keyword-v1',
      completadoEn: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
};

export const ragSearchEndpoint = (req, res, next) => {
  try {
    const { query, limit = 10 } = req.body;

    if (!query || typeof query !== 'string' || query.trim().length < 3) {
      return res.status(400).json({ status: 'error', message: 'La consulta es requerida.' });
    }

    const embeddings = db.getEmbeddings();
    const allProperties = db.getAllProperties();

    if (embeddings.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'No hay embeddings generados. Ejecuta primero POST /api/rag/reindex.',
      });
    }

    const results = ragSearch(query.trim(), embeddings, allProperties, parseInt(limit));

    res.status(200).json({
      query: query.trim(),
      results: results.map((r) => ({
        property: r.property,
        similitud: parseFloat(r.similarity.toFixed(4)),
      })),
      total: results.length,
      indexSize: embeddings.length,
    });
  } catch (err) {
    next(err);
  }
};
