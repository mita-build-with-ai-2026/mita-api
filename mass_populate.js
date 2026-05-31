import { db } from './src/config/db.js';
import { aiService } from './src/services/ai.service.js';
import { buildKeywordEmbedding } from './src/config/aiEngine.js';
import { createHash } from 'crypto';
import {
  PORTAL_SEED_SOURCES,
  SCRAPER_SEARCH_QUERIES,
  isKnownRealEstateSource
} from './src/config/scraperSources.js';

const TARGET_PROPERTIES = Math.max(1, parseInt(process.env.TARGET_PROPERTIES || '500', 10));
const PER_URL_LIMIT = Math.max(1, Math.min(parseInt(process.env.PER_URL_LIMIT || '50', 10), 100));
const URL_LIMIT = Math.max(1, Math.min(parseInt(process.env.URL_LIMIT || '80', 10), 200));
const EMBED_IMPORTED = process.env.EMBED_IMPORTED !== 'false';
const DISCOVER_WITH_GEMINI = process.env.DISCOVER_WITH_GEMINI !== 'false';
const BETWEEN_URLS_MS = Math.max(0, parseInt(process.env.BETWEEN_URLS_MS || '1500', 10));
const BETWEEN_INSERTS_MS = Math.max(0, parseInt(process.env.BETWEEN_INSERTS_MS || '250', 10));

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function normalizeKey(value = '') {
  return String(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function sourceFingerprint(property) {
  return createHash('sha1')
    .update([
      property.urlFuente,
      property.idExternoFuente,
      property.titulo,
      property.zona,
      property.precio,
      property.areaM2
    ].filter(Boolean).join('|'))
    .digest('hex');
}

function propertyKey(property) {
  return normalizeKey([
    property.urlFuente,
    property.idExternoFuente,
    property.titulo,
    property.zona,
    property.precio,
    property.areaM2
  ].filter(Boolean).join('|'));
}

async function ensureSeedSources() {
  const sources = await db.getSources();
  const existingUrls = new Set(sources.map((source) => source.urlBase?.toLowerCase()).filter(Boolean));

  for (const source of PORTAL_SEED_SOURCES) {
    if (!source.urlBase || existingUrls.has(source.urlBase.toLowerCase())) continue;
    try {
      const created = await db.createSource({
        nombre: source.nombre,
        urlBase: source.urlBase,
        tipoFuente: source.tipoFuente || 'PORTAL',
        activo: true
      });
      sources.push(created);
      existingUrls.add(source.urlBase.toLowerCase());
      console.log(`[Fuentes] Registrada fuente semilla: ${source.nombre}`);
    } catch (error) {
      console.warn(`[Fuentes] No se pudo registrar ${source.urlBase}: ${error.message}`);
    }
  }

  return sources;
}

function findSourceIdForUrl(url, sources) {
  const normalizedUrl = String(url || '').toLowerCase();
  const exact = sources.find((source) => source.urlBase && normalizedUrl === source.urlBase.toLowerCase());
  if (exact) return exact.id;

  const byHost = sources.find((source) => {
    try {
      const sourceHost = new URL(source.urlBase).hostname.replace(/^www\./, '');
      const urlHost = new URL(url).hostname.replace(/^www\./, '');
      return sourceHost === urlHost;
    } catch {
      return false;
    }
  });
  return byHost?.id || null;
}

function buildPropertyPayload(p, sourceId, importId, fallbackUrl) {
  const caracteristicasOperativas = p.caracteristicasOperativas || {};
  return {
    titulo: p.titulo || 'Propiedad importada de scraping masivo',
    descripcion: p.descripcion || 'Sin descripcion extraida',
    tipoPropiedad: p.tipoPropiedad || 'OTRO',
    tipoUsoEspacio: p.tipoUsoEspacio || 'OTRO',
    ciudad: p.ciudad || 'Santa Cruz de la Sierra',
    zona: p.zona || 'No especificada',
    direccionTexto: p.direccionTexto || null,
    latitud: p.latitud !== undefined ? p.latitud : null,
    longitud: p.longitud !== undefined ? p.longitud : null,
    precio: p.precio || 0,
    moneda: p.moneda || 'USD',
    cantidadHabitaciones: p.cantidadHabitaciones !== undefined ? p.cantidadHabitaciones : null,
    cantidadBanos: p.cantidadBanos !== undefined ? p.cantidadBanos : null,
    areaM2: p.areaM2 || null,
    tieneGaraje: !!p.tieneGaraje,
    estaAmoblada: !!p.estaAmoblada,
    aceptaMascotas: !!p.aceptaMascotas,
    expensasIncluidas: !!p.expensasIncluidas,
    montoExpensas: p.montoExpensas !== undefined ? p.montoExpensas : null,
    comodidades: p.comodidades || [],
    aptoPara: p.aptoPara || [],
    caracteristicasOperativas,
    requisitosFaltantes: p.requisitosFaltantes || [],
    textoCrudo: p.textoCrudo || p.descripcion,
    datosCrudos: p.datosCrudos || null,
    datosExtraidosIA: p,
    confianzaIA: p.confianzaIA !== undefined ? p.confianzaIA : null,
    estadoNormalizacionIA: 'COMPLETADA',
    idFuente: sourceId,
    idImportacion: importId,
    idExternoFuente: p.idExternoFuente || null,
    hashFuente: sourceFingerprint({ ...p, urlFuente: p.urlFuente || fallbackUrl }),
    telefonoContacto: p.telefonoContacto || null,
    nombreContacto: p.nombreContacto || null,
    urlFuente: p.urlFuente || fallbackUrl,
    urlImagen: p.urlImagen || null
  };
}

async function run() {
  console.log(`Iniciando script de autodescubrimiento y carga masiva. Objetivo: ${TARGET_PROPERTIES} propiedades.`);
  const sources = await ensureSeedSources();
  const existingProperties = await db.getAllProperties();
  const seenKeys = new Set(existingProperties.map(propertyKey).filter(Boolean));
  console.log(`[Dedupe] Propiedades existentes detectadas: ${existingProperties.length}`);

  const discoveredUrls = new Set();

  for (const source of PORTAL_SEED_SOURCES) {
    discoveredUrls.add(source.urlBase);
  }

  // 1. Descubrir URLs usando Grounding
  if (DISCOVER_WITH_GEMINI && aiService.isAvailable()) {
    for (const q of SCRAPER_SEARCH_QUERIES) {
      try {
        console.log(`[Grounding] Buscando fuentes para: "${q}"...`);
        const result = await aiService.discoverSources(q, 'Santa Cruz de la Sierra, Bolivia');
        if (result.fuentesDescubiertas) {
          for (const src of result.fuentesDescubiertas) {
            if (src.urlBase && isKnownRealEstateSource(src.urlBase)) {
              discoveredUrls.add(src.urlBase);
            }
          }
        }
        await sleep(1000);
      } catch (e) {
        console.error(`Error descubriendo fuentes para "${q}":`, e.message);
        await sleep(1500);
      }
    }
  } else {
    console.log('[Grounding] Omitido: Gemini no está disponible o DISCOVER_WITH_GEMINI=false.');
  }

  for (const source of sources) {
    if (source.activo && source.urlBase && source.tipoFuente !== 'DEMO') {
      discoveredUrls.add(source.urlBase);
    }
  }

  const urls = Array.from(discoveredUrls).slice(0, URL_LIMIT);
  console.log(`\nURLs a procesar para scraping (${urls.length}):`);
  console.log(urls);

  const importRecord = await db.createImport({
    idFuente: null,
    idUsuarioAdmin: null,
    estado: 'EJECUTANDO',
    urlSolicitada: `MASS_POPULATE_TARGET_${TARGET_PROPERTIES}`,
    totalEncontrados: 0,
    totalImportados: 0,
    totalFallidos: 0,
    mensajeError: null,
  });

  let totalFound = 0;
  let totalImported = 0;
  let totalFailed = 0;
  let totalSkippedDuplicates = 0;

  // 2. Procesar cada URL
  for (const url of urls) {
    if (totalImported >= TARGET_PROPERTIES) break;
    try {
      console.log(`\n[Scraper] Raspando y extrayendo de la URL: ${url}`);
      const results = await aiService.analyzeUrls([url], {
        crawlListings: true,
        maxPagesPerUrl: Math.min(PER_URL_LIMIT + 1, 60),
        maxListingLinksPerUrl: Math.min(PER_URL_LIMIT, 50),
        maxPaginationPagesPerUrl: Math.min(Math.ceil(PER_URL_LIMIT / 10), 5),
        maxProperties: Math.min(PER_URL_LIMIT, TARGET_PROPERTIES - totalImported)
      });
      const processResult = results[0];

      if (processResult && processResult.success && processResult.properties) {
        totalFound += processResult.properties.length;
        console.log(`[Scraper] Se extrajeron ${processResult.properties.length} propiedades de ${url}. Guardando...`);

        const sourceId = findSourceIdForUrl(url, sources);
        for (const p of processResult.properties) {
          if (totalImported >= TARGET_PROPERTIES) break;
          const key = propertyKey({ ...p, urlFuente: p.urlFuente || url });
          if (key && seenKeys.has(key)) {
            totalSkippedDuplicates++;
            continue;
          }

          try {
            const created = await db.createProperty(buildPropertyPayload(p, sourceId, importRecord.id, url));

            // Generar embedding
            if (EMBED_IMPORTED) {
              const searchText = aiService.generateSearchText(created);
              const emb = await aiService.generateEmbedding(searchText);

              if (emb.embedding) {
                await db.updatePropertyEmbedding(created.id, emb.embedding, emb.modelo);
                console.log(`-> Guardada e indexada (${totalImported + 1}/${TARGET_PROPERTIES}): "${created.titulo}"`);
              } else {
                const kw = buildKeywordEmbedding(created);
                await db.setEmbedding(created.id, kw);
                console.log(`-> Guardada con fallback (${totalImported + 1}/${TARGET_PROPERTIES}): "${created.titulo}"`);
              }
            } else {
              const kw = buildKeywordEmbedding(created);
              await db.setEmbedding(created.id, kw);
              console.log(`-> Guardada sin embedding remoto (${totalImported + 1}/${TARGET_PROPERTIES}): "${created.titulo}"`);
            }

            if (key) seenKeys.add(key);
            totalImported++;
            await sleep(BETWEEN_INSERTS_MS);
          } catch (errInsert) {
            console.error(`Error guardando propiedad "${p.titulo}":`, errInsert.message);
            totalFailed++;
          }
        }
      } else {
        console.error(`Fallo scraping o extraccion en URL: ${url}`, processResult?.error);
        totalFailed++;
      }
      await sleep(BETWEEN_URLS_MS);
    } catch (errUrl) {
      console.error(`Error procesando URL ${url}:`, errUrl.message);
      totalFailed++;
    }
  }

  await db.updateImport(importRecord.id, {
    estado: totalImported >= TARGET_PROPERTIES ? 'COMPLETADA' : (totalImported > 0 ? 'PARCIAL' : 'FALLIDA'),
    totalEncontrados: totalFound,
    totalImportados: totalImported,
    totalFallidos: totalFailed,
    mensajeError: totalImported >= TARGET_PROPERTIES ? null : `No se alcanzó el objetivo de ${TARGET_PROPERTIES}. Duplicados omitidos: ${totalSkippedDuplicates}.`,
    finalizadaEn: new Date().toISOString(),
  });

  console.log(`\nProceso finalizado. Importadas: ${totalImported}. Encontradas: ${totalFound}. Fallidas: ${totalFailed}. Duplicadas omitidas: ${totalSkippedDuplicates}.`);
  await db.closePool();
}

run();
