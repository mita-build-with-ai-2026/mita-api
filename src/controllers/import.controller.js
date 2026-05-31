/**
 * Controlador de importaciones de propiedades de Mita.
 */
import { db, randomUUID } from '../config/db.js';
import { aiService } from '../services/ai.service.js';
import { buildKeywordEmbedding } from '../config/aiEngine.js';
import {
  PORTAL_SEED_SOURCES,
  SCRAPER_SEARCH_QUERIES,
  isKnownRealEstateSource
} from '../config/scraperSources.js';

// Listings demo de respaldo para simulaciones
const DEMO_RAW_LISTINGS = [
  'alquilo local zona norte 800$ ideal negocio avenida transitada baño privado consultas whatsapp',
  'deposito 300m2 acceso camion galpon zona industrial precio a convenir',
  'oficina equipetrol amoblada 2 ambientes parqueo incluido 650 dolares',
  'local galeria sirari 45m2 500$ flujo personas apto emprendimiento gastronomico',
  'taller mecanico av alemana 200m2 900 usd trifasica fosa',
];

function buildPropertyPayload(propDraft, defaults = {}) {
  return {
    titulo: propDraft.titulo || defaults.titulo || 'Propiedad importada de URL',
    descripcion: propDraft.descripcion || 'Sin descripcion extraida',
    tipoPropiedad: propDraft.tipoPropiedad || 'OTRO',
    tipoUsoEspacio: propDraft.tipoUsoEspacio || 'OTRO',
    ciudad: propDraft.ciudad || 'Santa Cruz de la Sierra',
    zona: propDraft.zona || 'No especificada',
    direccionTexto: propDraft.direccionTexto || null,
    latitud: propDraft.latitud !== undefined ? propDraft.latitud : null,
    longitud: propDraft.longitud !== undefined ? propDraft.longitud : null,
    precio: propDraft.precio || 0,
    moneda: propDraft.moneda || 'USD',
    cantidadHabitaciones: propDraft.cantidadHabitaciones !== undefined ? propDraft.cantidadHabitaciones : null,
    cantidadBanos: propDraft.cantidadBanos !== undefined ? propDraft.cantidadBanos : null,
    areaM2: propDraft.areaM2 || null,
    tieneGaraje: !!propDraft.tieneGaraje,
    estaAmoblada: !!propDraft.estaAmoblada,
    aceptaMascotas: !!propDraft.aceptaMascotas,
    expensasIncluidas: !!propDraft.expensasIncluidas,
    montoExpensas: propDraft.montoExpensas !== undefined ? propDraft.montoExpensas : null,
    comodidades: propDraft.comodidades || [],
    aptoPara: propDraft.aptoPara || [],
    caracteristicasOperativas: propDraft.caracteristicasOperativas || {},
    requisitosFaltantes: propDraft.requisitosFaltantes || [],
    textoCrudo: propDraft.textoCrudo || propDraft.descripcion,
    datosCrudos: propDraft.datosCrudos || null,
    datosExtraidosIA: propDraft,
    confianzaIA: propDraft.confianzaIA !== undefined ? propDraft.confianzaIA : null,
    estadoNormalizacionIA: 'COMPLETADA',
    idFuente: defaults.idFuente || null,
    idImportacion: defaults.idImportacion || null,
    idExternoFuente: propDraft.idExternoFuente || null,
    hashFuente: propDraft.hashFuente || null,
    urlImagen: propDraft.urlImagen || null,
    telefonoContacto: propDraft.telefonoContacto || null,
    nombreContacto: propDraft.nombreContacto || null,
    urlFuente: propDraft.urlFuente || defaults.urlFuente || null,
  };
}

async function getSourcesWithSeedPortals() {
  const existingSources = await db.getSources();
  const existingUrls = new Set(existingSources.map((source) => source.urlBase?.toLowerCase()).filter(Boolean));

  for (const source of PORTAL_SEED_SOURCES) {
    if (!source.urlBase || existingUrls.has(source.urlBase.toLowerCase())) continue;
    try {
      const created = await db.createSource({
        nombre: source.nombre,
        urlBase: source.urlBase,
        tipoFuente: source.tipoFuente || 'PORTAL',
        activo: true
      });
      existingSources.push(created);
      existingUrls.add(source.urlBase.toLowerCase());
    } catch {
      // If another request creates the same source first, the next read will include it.
    }
  }

  return existingSources;
}

export const listSources = async (req, res, next) => {
  try {
    const sources = await getSourcesWithSeedPortals();
    res.status(200).json({ data: sources, total: sources.length });
  } catch (err) {
    next(err);
  }
};

export const listImports = async (req, res, next) => {
  try {
    const imports = await db.getImports();
    res.status(200).json({ data: imports, total: imports.length });
  } catch (err) {
    next(err);
  }
};

export const runImport = async (req, res, next) => {
  try {
    const { sourceId, url, limit = 30 } = req.body;

    if (!sourceId) {
      return res.status(400).json({ status: 'error', message: 'sourceId es requerido.' });
    }

    const sources = await getSourcesWithSeedPortals();
    const source = sources.find((s) => s.id === sourceId);
    if (!source) {
      return res.status(404).json({ status: 'error', message: 'Fuente no encontrada.' });
    }

    const targetUrl = url || source.urlBase;

    // Crear registro de importación
    const importRecord = await db.createImport({
      id: randomUUID(),
      idFuente: sourceId,
      idUsuarioAdmin: req.admin?.id || null,
      estado: 'EJECUTANDO',
      urlSolicitada: targetUrl,
      totalEncontrados: 0,
      totalImportados: 0,
      totalFallidos: 0,
      mensajeError: null,
    });

    let listingsToProcess = [];
    let importados = 0;
    let fallidos = 0;

    // Si la fuente es de tipo DEMO y no se pasa una URL real, usamos la simulación
    if (source.tipoFuente === 'DEMO' && (!url || url.includes('demo.mita.ai'))) {
      const selectedListings = DEMO_RAW_LISTINGS.slice(0, Math.min(limit, DEMO_RAW_LISTINGS.length));
      
      for (const rawText of selectedListings) {
        try {
          const enhanced = await aiService.normalizeRawListing(rawText);
          const draft = enhanced.propertyDraft;

          // Solo crear si tiene info suficiente
          if (draft.tipoPropiedad && (draft.zona !== 'No especificada' || draft.precio)) {
            const created = await db.createProperty({
              titulo: draft.titulo,
              descripcion: enhanced.descripcionLimpia,
              tipoPropiedad: draft.tipoPropiedad || 'OTRO',
              tipoUsoEspacio: draft.tipoUsoEspacio || 'OTRO',
              ciudad: 'Santa Cruz de la Sierra',
              zona: draft.zona || 'No especificada',
              precio: draft.precio || 0,
              moneda: draft.moneda || 'USD',
              areaM2: draft.areaM2 || null,
              aptoPara: draft.aptoPara || [],
              caracteristicasOperativas: draft.caracteristicasOperativas || {},
              requisitosFaltantes: enhanced.informacionFaltante || [],
              textoCrudo: rawText,
              datosExtraidosIA: draft,
              estadoNormalizacionIA: 'COMPLETADA',
              idFuente: sourceId,
              idImportacion: importRecord.id,
              urlImagen: draft.urlImagen || null,
              telefonoContacto: draft.telefonoContacto || null,
              nombreContacto: draft.nombreContacto || null,
            });

            // Generar embedding (real si hay Gemini, fallback de keywords en caso contrario)
            const searchText = aiService.generateSearchText(created);
            const embResult = await aiService.generateEmbedding(searchText);
            
            if (embResult.embedding) {
              await db.updatePropertyEmbedding(created.id, embResult.embedding, embResult.modelo);
            } else {
              const kwEmbedding = buildKeywordEmbedding(created);
              await db.setEmbedding(created.id, kwEmbedding);
            }

            importados++;
          } else {
            fallidos++;
          }
        } catch (e) {
          req.log.error('[Import Controller] Error procesando publicacion demo:', e);
          fallidos++;
        }
      }

      listingsToProcess = selectedListings;
    } else {
      // Realizar scraping real a la URL especificada
      try {
        const importLimit = Math.max(1, Math.min(parseInt(limit || 30), 100));
        const analyzeResult = await aiService.analyzeUrls([targetUrl], {
          crawlListings: true,
          maxPagesPerUrl: Math.min(importLimit + 1, 60),
          maxListingLinksPerUrl: Math.min(importLimit, 50),
          maxPaginationPagesPerUrl: Math.min(Math.ceil(importLimit / 10), 5),
          maxProperties: importLimit
        });
        const urlProcess = analyzeResult[0];

        if (urlProcess && urlProcess.success && urlProcess.properties) {
          listingsToProcess = urlProcess.properties;
          
          for (const propDraft of listingsToProcess) {
            try {
              const created = await db.createProperty(buildPropertyPayload(propDraft, {
                idFuente: sourceId,
                idImportacion: importRecord.id,
                urlFuente: targetUrl
              }));

              // Generar embedding
              const searchText = aiService.generateSearchText(created);
              const embResult = await aiService.generateEmbedding(searchText);
              
              if (embResult.embedding) {
                await db.updatePropertyEmbedding(created.id, embResult.embedding, embResult.modelo);
              } else {
                const kwEmbedding = buildKeywordEmbedding(created);
                await db.setEmbedding(created.id, kwEmbedding);
              }

              importados++;
            } catch (errProp) {
              req.log.error('[Import Controller] Error al insertar propiedad extraida:', errProp);
              fallidos++;
            }
          }
        } else {
          throw new Error(urlProcess?.error || 'No se pudieron extraer listados de la URL.');
        }
      } catch (errScrape) {
        req.log.error('[Import Controller] Error en scraping real:', errScrape);
        fallidos = 1;
        
        await db.updateImport(importRecord.id, {
          estado: 'FALLIDA',
          mensajeError: errScrape.message,
          finalizadaEn: new Date().toISOString(),
        });

        return res.status(500).json({ status: 'error', message: `Fallo el scraping: ${errScrape.message}` });
      }
    }

    // Actualizar registro de importación
    const totalEncontrados = listingsToProcess.length;
    const finalRecord = await db.updateImport(importRecord.id, {
      estado: fallidos === totalEncontrados && totalEncontrados > 0 ? 'FALLIDA' : (importados > 0 && fallidos > 0 ? 'PARCIAL' : 'COMPLETADA'),
      totalEncontrados,
      totalImportados: importados,
      totalFallidos: fallidos,
      finalizadaEn: new Date().toISOString(),
    });

    res.status(201).json(finalRecord);
  } catch (err) {
    next(err);
  }
};

export const autoDiscoverAndImport = async (req, res, next) => {
  try {
    req.log.info('[Auto Import] Iniciando auto-descubrimiento y scraping masivo...');
    const {
      urlLimit = 8,
      perUrlLimit = 25,
      includeSeedSources = true
    } = req.body || {};
    
    const discoveredUrls = new Set();

    // 1. Cargar portales semilla curados para no depender únicamente del descubrimiento.
    if (includeSeedSources) {
      for (const source of PORTAL_SEED_SOURCES) {
        if (source.urlBase) discoveredUrls.add(source.urlBase);
      }
    }

    // 2. Ejecutar Grounding de Gemini para descubrir URLs activas en tiempo real.
    if (aiService.isAvailable()) {
      for (const q of SCRAPER_SEARCH_QUERIES) {
        try {
          req.log.info(`[Auto Import] Buscando fuentes para: "${q}"...`);
          const result = await aiService.discoverSources(q, 'Santa Cruz de la Sierra, Bolivia');
          if (result.fuentesDescubiertas) {
            for (const src of result.fuentesDescubiertas) {
              if (src.urlBase && isKnownRealEstateSource(src.urlBase)) {
                discoveredUrls.add(src.urlBase);
              }
            }
          }
        } catch (errDisc) {
          req.log.warn(`[Auto Import] Falló descubrimiento de fuentes para "${q}":`, errDisc);
        }
      }
    }

    // 3. Obtener también las URLs registradas y activas de la base de datos
    try {
      const activeSources = await db.getSources();
      for (const src of activeSources) {
        if (src.activo && src.urlBase && src.tipoFuente !== 'DEMO') {
          discoveredUrls.add(src.urlBase);
        }
      }
    } catch (errDb) {
      req.log.warn('[Auto Import] Error cargando fuentes registradas de la base de datos:', errDb);
    }

    const urlsToScrape = Array.from(discoveredUrls);
    req.log.info(`[Auto Import] Total de URLs a procesar: ${urlsToScrape.length}`);

    if (urlsToScrape.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'No se descubrieron ni configuraron URLs activas para realizar el scraping masivo.'
      });
    }

    const selectedUrls = urlsToScrape.slice(0, Math.max(1, Math.min(parseInt(urlLimit), 30)));
    const normalizedPerUrlLimit = Math.max(1, Math.min(parseInt(perUrlLimit), 100));
    const importStats = {
      totalUrlsProcesadas: selectedUrls.length,
      urls: selectedUrls,
      propiedadesImportadas: 0,
      fallidos: 0,
      detalles: []
    };

    // 4. Crear registro de importación global en la base de datos
    const importRecord = await db.createImport({
      id: randomUUID(),
      idFuente: null,
      idUsuarioAdmin: req.admin?.id || null,
      estado: 'EJECUTANDO',
      urlSolicitada: 'AUTO_DISCOVER_MASSIVE',
      totalEncontrados: 0,
      totalImportados: 0,
      totalFallidos: 0,
      mensajeError: null,
    });

    // 5. Procesar cada URL descubierta secuencialmente
    for (const url of selectedUrls) {
      try {
        req.log.info(`[Auto Import] Procesando scraping y extracción de IA de la URL: ${url}`);
        const analyzeResult = await aiService.analyzeUrls([url], {
          crawlListings: true,
          maxPagesPerUrl: Math.min(normalizedPerUrlLimit + 1, 60),
          maxListingLinksPerUrl: Math.min(normalizedPerUrlLimit, 50),
          maxPaginationPagesPerUrl: Math.min(Math.ceil(normalizedPerUrlLimit / 10), 5),
          maxProperties: normalizedPerUrlLimit
        });
        const urlProcess = analyzeResult[0];

        if (urlProcess && urlProcess.success && urlProcess.properties) {
          let urlImportedCount = 0;
          let urlFailedCount = 0;

          for (const propDraft of urlProcess.properties) {
            try {
              const created = await db.createProperty(buildPropertyPayload(propDraft, {
                titulo: 'Propiedad descubierta automáticamente',
                idFuente: null,
                idImportacion: importRecord.id,
                urlFuente: url
              }));

              // Generar e indexar embedding en pgvector
              const searchText = aiService.generateSearchText(created);
              const embResult = await aiService.generateEmbedding(searchText);
              
              if (embResult.embedding) {
                await db.updatePropertyEmbedding(created.id, embResult.embedding, embResult.modelo);
              } else {
                const kwEmbedding = buildKeywordEmbedding(created);
                await db.setEmbedding(created.id, kwEmbedding);
              }

              urlImportedCount++;
              importStats.propiedadesImportadas++;
            } catch (errProp) {
              req.log.error(`[Auto Import] Error insertando propiedad de ${url}:`, errProp);
              urlFailedCount++;
              importStats.fallidos++;
            }
          }

          importStats.detalles.push({
            url,
            success: true,
            encontrados: urlProcess.properties.length,
            importados: urlImportedCount,
            fallidos: urlFailedCount,
            pagesAnalyzed: urlProcess.pagesAnalyzed,
            listingLinksFound: urlProcess.listingLinksFound
          });

        } else {
          throw new Error(urlProcess?.error || 'Extracción fallida.');
        }
      } catch (errUrl) {
        req.log.error(`[Auto Import] Error procesando URL ${url}:`, errUrl);
        importStats.fallidos++;
        importStats.detalles.push({
          url,
          success: false,
          error: errUrl.message
        });
      }
    }

    // 6. Actualizar registro de importación global en BD
    await db.updateImport(importRecord.id, {
      estado: importStats.propiedadesImportadas > 0 ? 'COMPLETADA' : 'FALLIDA',
      totalEncontrados: importStats.propiedadesImportadas + importStats.fallidos,
      totalImportados: importStats.propiedadesImportadas,
      totalFallidos: importStats.fallidos,
      finalizadaEn: new Date().toISOString(),
    });

    res.status(200).json({
      status: 'success',
      message: 'Scraping masivo y auto-descubrimiento finalizado con éxito.',
      data: importStats
    });

  } catch (err) {
    next(err);
  }
};
