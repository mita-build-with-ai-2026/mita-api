import { geminiClient } from './gemini.client.js';
import { scraperService } from './scraper.service.js';
import {
  PORTAL_SEED_SOURCES,
  SCRAPER_SEARCH_QUERIES,
  isKnownRealEstateSource
} from '../config/scraperSources.js';
import { 
  extractCriteria as lexicalExtractCriteria, 
  aiEnhanceListing as lexicalEnhanceListing,
  aiCompare as lexicalCompare,
  buildKeywordEmbedding as lexicalBuildKeywordEmbedding
} from '../config/aiEngine.js';

const PROPERTY_TYPES = new Set([
  'DEPARTAMENTO',
  'GARZONIER',
  'CASA',
  'HABITACION',
  'MONOAMBIENTE',
  'OFICINA',
  'LOCAL_COMERCIAL',
  'DEPOSITO',
  'GALPON',
  'TALLER',
  'ESPACIO_LOGISTICO',
  'TERRENO',
  'OTRO'
]);

const USAGE_TYPES = new Set(['RESIDENCIAL', 'COMERCIAL', 'INDUSTRIAL', 'LOGISTICO', 'OFICINA', 'MIXTO', 'OTRO']);

function normalizeText(value = '') {
  return String(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeEnum(value, allowedValues, fallback = 'OTRO') {
  const normalized = String(value || fallback)
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '_');
  return allowedValues.has(normalized) ? normalized : fallback;
}

function toNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const numeric = String(value).replace(/[^\d.,-]/g, '').replace(/\./g, '').replace(',', '.');
  const parsed = Number(numeric);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeCurrency(value) {
  const normalized = normalizeText(value);
  if (normalized.includes('bs') || normalized.includes('bob') || normalized.includes('boliviano')) return 'BOB';
  return 'USD';
}

function uniqueStrings(values = [], limit = 40) {
  const seen = new Set();
  const output = [];
  for (const value of values) {
    const clean = String(value || '').trim();
    if (!clean) continue;
    const key = normalizeText(clean);
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(clean);
    if (output.length >= limit) break;
  }
  return output;
}

function compactObject(value, maxLength = 12000) {
  try {
    const json = JSON.stringify(value);
    return json.length > maxLength ? `${json.slice(0, maxLength)}...` : json;
  } catch {
    return '';
  }
}

function buildExtractionCorpus(scrapePages, maxChars = 60000) {
  const pieces = [];
  let used = 0;

  for (const page of scrapePages) {
    const pagePayload = {
      url: page.url,
      metadata: page.metadata,
      contactHints: page.contactHints,
      numericHints: page.numericHints,
      jsonLd: (page.jsonLd || []).slice(0, 25),
      candidateBlocks: (page.candidateBlocks || []).slice(0, 30),
      visibleText: String(page.text || '').slice(0, 18000)
    };
    const serialized = compactObject(pagePayload, 24000);
    if (!serialized) continue;
    const remaining = maxChars - used;
    if (remaining <= 0) break;
    pieces.push(serialized.slice(0, remaining));
    used += Math.min(serialized.length, remaining);
  }

  return pieces.join('\n\n--- PAGINA SCRAPEADA ---\n\n');
}

function dedupeProperties(properties = []) {
  const seen = new Set();
  const output = [];
  for (const property of properties) {
    const key = normalizeText([
      property.urlFuente,
      property.idExternoFuente,
      property.titulo,
      property.zona,
      property.precio,
      property.areaM2
    ].filter(Boolean).join('|'));
    if (!key || seen.has(key)) continue;
    seen.add(key);
    output.push(property);
  }
  return output;
}

function normalizePropertyDraft(property, fallbackUrl, fallbackImage, scrapePages) {
  const sourcePage = scrapePages.find((page) => page.url === property.urlFuente) || scrapePages[0] || {};
  const comodidades = uniqueStrings(property.comodidades || []);
  const aptoPara = uniqueStrings(property.aptoPara || []);
  const precio = toNumber(property.precio);
  const areaM2 = toNumber(property.areaM2);
  const caracteristicasOperativas = property.caracteristicasOperativas || {};

  return {
    ...property,
    titulo: property.titulo || sourcePage.metadata?.title || 'Propiedad extraída de URL',
    descripcion: property.descripcion || property.textoCrudo || sourcePage.metadata?.metaDescription || 'Sin descripción extraída',
    tipoPropiedad: normalizeEnum(property.tipoPropiedad, PROPERTY_TYPES),
    tipoUsoEspacio: normalizeEnum(property.tipoUsoEspacio, USAGE_TYPES),
    ciudad: property.ciudad || 'Santa Cruz de la Sierra',
    zona: property.zona || 'No especificada',
    direccionTexto: property.direccionTexto || null,
    latitud: toNumber(property.latitud),
    longitud: toNumber(property.longitud),
    precio,
    moneda: normalizeCurrency(property.moneda),
    areaM2,
    cantidadHabitaciones: toNumber(property.cantidadHabitaciones),
    cantidadBanos: toNumber(property.cantidadBanos),
    tieneGaraje: !!property.tieneGaraje || !!caracteristicasOperativas.parqueo,
    estaAmoblada: !!property.estaAmoblada,
    aceptaMascotas: !!property.aceptaMascotas,
    expensasIncluidas: !!property.expensasIncluidas,
    montoExpensas: toNumber(property.montoExpensas),
    comodidades,
    aptoPara,
    caracteristicasOperativas: {
      accesoCamion: !!caracteristicasOperativas.accesoCamion,
      sobreAvenida: !!caracteristicasOperativas.sobreAvenida,
      altoTransito: !!caracteristicasOperativas.altoTransito,
      parqueo: !!caracteristicasOperativas.parqueo || !!property.tieneGaraje,
      seguridad: !!caracteristicasOperativas.seguridad,
      energiaTrifasica: !!caracteristicasOperativas.energiaTrifasica,
      wifi: !!caracteristicasOperativas.wifi,
      alturaPortonM: toNumber(caracteristicasOperativas.alturaPortonM),
      oficinaAdministrativa: !!caracteristicasOperativas.oficinaAdministrativa,
      accesoIndependiente: !!caracteristicasOperativas.accesoIndependiente
    },
    requisitosFaltantes: uniqueStrings(property.requisitosFaltantes || []),
    nombreContacto: property.nombreContacto || null,
    telefonoContacto: property.telefonoContacto || sourcePage.contactHints?.phones?.[0] || null,
    emailContacto: property.emailContacto || sourcePage.contactHints?.emails?.[0] || null,
    urlFuente: property.urlFuente || fallbackUrl,
    idExternoFuente: property.idExternoFuente || null,
    hashFuente: property.hashFuente || null,
    urlImagen: property.urlImagen || fallbackImage || sourcePage.imageUrl || null,
    fechaPublicacion: property.fechaPublicacion || null,
    confianzaIA: toNumber(property.confianzaIA),
    datosCrudos: {
      ...property.datosCrudos,
      operacion: property.operacion || null,
      whatsappLinks: sourcePage.contactHints?.whatsappLinks || [],
      imagenesFuente: sourcePage.images || [],
      jsonLdFuente: sourcePage.jsonLd || [],
      scrapeStats: sourcePage.stats || null,
      emailContacto: property.emailContacto || sourcePage.contactHints?.emails?.[0] || null
    }
  };
}

function fallbackExtractProperties(scrapePages, fallbackUrl) {
  const rawInputs = [];
  for (const page of scrapePages) {
    for (const block of (page.candidateBlocks || []).slice(0, 25)) {
      rawInputs.push({ text: block.text, url: block.link || page.url, image: block.image || page.imageUrl, page });
    }
    if (rawInputs.length === 0 && page.text) {
      rawInputs.push({ text: page.text, url: page.url, image: page.imageUrl, page });
    }
  }

  return rawInputs.map((input) => {
    const enhanced = lexicalEnhanceListing(input.text);
    return normalizePropertyDraft({
      titulo: enhanced.propertyDraft.titulo || 'Propiedad extraída de URL',
      descripcion: enhanced.descripcionLimpia,
      tipoPropiedad: enhanced.propertyDraft.tipoPropiedad || 'OTRO',
      tipoUsoEspacio: enhanced.propertyDraft.tipoUsoEspacio || 'OTRO',
      zona: enhanced.propertyDraft.zona || 'No especificada',
      precio: enhanced.propertyDraft.precio,
      moneda: enhanced.propertyDraft.moneda || 'USD',
      areaM2: enhanced.propertyDraft.areaM2,
      aptoPara: enhanced.propertyDraft.aptoPara || [],
      caracteristicasOperativas: enhanced.propertyDraft.caracteristicasOperativas || {},
      requisitosFaltantes: enhanced.informacionFaltante || [],
      urlFuente: input.url || fallbackUrl,
      urlImagen: input.image || input.page?.imageUrl || null,
      textoCrudo: input.text
    }, fallbackUrl, input.image, [input.page].filter(Boolean));
  });
}

function hasUsefulPropertySignal(property) {
  return !!(
    property?.titulo &&
    (
      property.precio ||
      property.areaM2 ||
      property.urlFuente ||
      property.tipoPropiedad !== 'OTRO'
    )
  );
}

export const aiService = {
  isAvailable() {
    return geminiClient.isAvailable();
  },

  async extractCriteria(query) {
    if (geminiClient.isAvailable()) {
      try {
        const systemPrompt = `Eres el extractor de criterios de búsqueda de Mita, el agente inmobiliario inteligente con IA de Santa Cruz de la Sierra, Bolivia.
Tu tarea es analizar la consulta del usuario y estructurar los criterios de búsqueda en un formato JSON específico.

Devuelve estrictamente un objeto JSON con las siguientes propiedades:
- tipoPropiedad: Un string que coincida exactamente con uno de estos tipos: DEPARTAMENTO, GARZONIER, CASA, HABITACION, MONOAMBIENTE, OFICINA, LOCAL_COMERCIAL, DEPOSITO, GALPON, TALLER, ESPACIO_LOGISTICO, TERRENO, OTRO o null si no se especifica.
- tipoUsoEspacio: Un string que coincida exactamente con uno de estos: RESIDENCIAL, COMERCIAL, INDUSTRIAL, LOGISTICO, OFICINA, MIXTO, OTRO o null si no se especifica.
- zonas: Array de strings con los nombres de las zonas de Santa Cruz de la Sierra mencionadas (ej. "Equipetrol", "Zona Norte", "Centro", "Las Palmas", "Urbari", "Sirari", "Hamacas").
- precioMaximo: Número entero que representa el presupuesto máximo en dólares (o equivalente en Bs) especificado en la consulta, o null si no se especifica.
- areaM2: Número entero con los metros cuadrados mínimos solicitados, o null si no se especifica.
- aptoPara: Array de strings con los usos sugeridos o indicados (ej. ["cafeteria", "tienda de ropa", "consultorio"]).
- caracteristicasOperativas: Objeto con booleanos para estas propiedades (debes detectar si se solicitan en la consulta):
  - accesoCamion
  - sobreAvenida
  - altoTransito
  - parqueo
  - seguridad
  - energiaTrifasica
  - wifi
- prioridades: Array de strings con las prioridades de búsqueda expresadas por el usuario. No uses emojis.

Consulta: "${query}"`;

        const response = await geminiClient.generateContent(systemPrompt, {
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: 'OBJECT',
              properties: {
                tipoPropiedad: { type: 'STRING' },
                tipoUsoEspacio: { type: 'STRING' },
                zonas: { type: 'ARRAY', items: { type: 'STRING' } },
                precioMaximo: { type: 'INTEGER' },
                areaM2: { type: 'INTEGER' },
                aptoPara: { type: 'ARRAY', items: { type: 'STRING' } },
                caracteristicasOperativas: {
                  type: 'OBJECT',
                  properties: {
                    accesoCamion: { type: 'BOOLEAN' },
                    sobreAvenida: { type: 'BOOLEAN' },
                    altoTransito: { type: 'BOOLEAN' },
                    parqueo: { type: 'BOOLEAN' },
                    seguridad: { type: 'BOOLEAN' },
                    energiaTrifasica: { type: 'BOOLEAN' },
                    wifi: { type: 'BOOLEAN' }
                  }
                },
                prioridades: { type: 'ARRAY', items: { type: 'STRING' } }
              }
            }
          }
        });
        
        const data = JSON.parse(response.text);
        return {
          consultaCruda: query,
          tipoPropiedad: data.tipoPropiedad || null,
          tipoUsoEspacio: data.tipoUsoEspacio || null,
          zonas: data.zonas || [],
          precioMaximo: data.precioMaximo || null,
          areaM2: data.areaM2 || null,
          aptoPara: data.aptoPara || [],
          caracteristicasOperativas: {
            accesoCamion: !!data.caracteristicasOperativas?.accesoCamion,
            sobreAvenida: !!data.caracteristicasOperativas?.sobreAvenida,
            altoTransito: !!data.caracteristicasOperativas?.altoTransito,
            parqueo: !!data.caracteristicasOperativas?.parqueo,
            seguridad: !!data.caracteristicasOperativas?.seguridad,
            energiaTrifasica: !!data.caracteristicasOperativas?.energiaTrifasica,
            wifi: !!data.caracteristicasOperativas?.wifi,
          },
          prioridades: data.prioridades || []
        };
      } catch (err) {
        console.warn('[AI Service] Error al usar Gemini para extractCriteria, usando fallback léxico:', err.message);
      }
    }
    return lexicalExtractCriteria(query);
  },

  async normalizeRawListing(rawText) {
    if (geminiClient.isAvailable()) {
      try {
        const systemPrompt = `Eres el normalizador de publicaciones de Mita, el agente inmobiliario inteligente de Santa Cruz de la Sierra, Bolivia.
Tu tarea es analizar un texto crudo de una oferta inmobiliaria y estructurarla en el formato JSON de base de datos de Mita.

Devuelve estrictamente un objeto JSON con las siguientes propiedades:
- titulo: Un título corto, descriptivo y atractivo de la propiedad.
- descripcion: Una descripción limpia, clara y bien redacturada de la propiedad.
- tipoPropiedad: Uno de estos enums obligatorios: DEPARTAMENTO, GARZONIER, CASA, HABITACION, MONOAMBIENTE, OFICINA, LOCAL_COMERCIAL, DEPOSITO, GALPON, TALLER, ESPACIO_LOGISTICO, TERRENO, OTRO.
- tipoUsoEspacio: Uno de estos enums obligatorios: RESIDENCIAL, COMERCIAL, INDUSTRIAL, LOGISTICO, OFICINA, MIXTO, OTRO.
- zona: La zona o barrio de Santa Cruz (ej. Equipetrol, Zona Norte, Centro, Las Palmas, Urbari, Sirari, Hamacas). Si no se menciona o infiere, usa "No especificada".
- precio: Número que representa el precio de alquiler o venta. Si no hay precio, usa null.
- moneda: "USD" o "BOB". Por defecto usa "USD" si se indica $ o dólares.
- areaM2: Número entero de metros cuadrados. Si no se especifica, usa null.
- tieneGaraje: boolean.
- estaAmoblada: boolean.
- aceptaMascotas: boolean.
- expensasIncluidas: boolean.
- montoExpensas: número o null.
- comodidades: Array de strings (ej. ["aire acondicionado", "churrasquera", "piscina"]).
- aptoPara: Array de strings indicando para qué negocios o actividades es apta la propiedad (ej. ["cafeteria", "almacenamiento", "tienda"]).
- caracteristicasOperativas: Objeto con booleanos:
  - accesoCamion
  - sobreAvenida
  - altoTransito
  - parqueo
  - seguridad
  - energiaTrifasica
  - wifi
- requisitosFaltantes: Array de strings indicando qué información clave FALTA en el texto original para tener una ficha completa (ej. ["monto de expensas", "precio", "metros cuadrados"]).
- nombreContacto: Nombre de contacto si aparece, o null.
- telefonoContacto: Teléfono de contacto si aparece, o null.
- confianzaIA: Un número flotante entre 0.0 y 1.0.

Texto de la publicación:
"${rawText}"`;

        const response = await geminiClient.generateContent(systemPrompt, {
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: 'OBJECT',
              properties: {
                titulo: { type: 'STRING' },
                descripcion: { type: 'STRING' },
                tipoPropiedad: { type: 'STRING' },
                tipoUsoEspacio: { type: 'STRING' },
                zona: { type: 'STRING' },
                precio: { type: 'INTEGER' },
                moneda: { type: 'STRING' },
                areaM2: { type: 'INTEGER' },
                tieneGaraje: { type: 'BOOLEAN' },
                estaAmoblada: { type: 'BOOLEAN' },
                aceptaMascotas: { type: 'BOOLEAN' },
                expensasIncluidas: { type: 'BOOLEAN' },
                montoExpensas: { type: 'INTEGER' },
                comodidades: { type: 'ARRAY', items: { type: 'STRING' } },
                aptoPara: { type: 'ARRAY', items: { type: 'STRING' } },
                caracteristicasOperativas: {
                  type: 'OBJECT',
                  properties: {
                    accesoCamion: { type: 'BOOLEAN' },
                    sobreAvenida: { type: 'BOOLEAN' },
                    altoTransito: { type: 'BOOLEAN' },
                    parqueo: { type: 'BOOLEAN' },
                    seguridad: { type: 'BOOLEAN' },
                    energiaTrifasica: { type: 'BOOLEAN' },
                    wifi: { type: 'BOOLEAN' }
                  }
                },
                requisitosFaltantes: { type: 'ARRAY', items: { type: 'STRING' } },
                nombreContacto: { type: 'STRING' },
                telefonoContacto: { type: 'STRING' },
                confianzaIA: { type: 'NUMBER' }
              },
              required: ['titulo', 'descripcion', 'tipoPropiedad', 'tipoUsoEspacio', 'zona']
            }
          }
        });
        
        const data = JSON.parse(response.text);
        const titulo = data.titulo || 'Propiedad normalizada';
        const precio = data.precio;
        const moneda = data.moneda || 'USD';
        const areaM2 = data.areaM2;
        const zona = data.zona || 'No especificada';
        const aptoPara = data.aptoPara || [];
        const descripcionLimpia = data.descripcion || rawText;

        const versionWhatsapp =
          `*${titulo}*\n` +
          (precio ? `$${precio} ${moneda}/mes\n` : '') +
          (areaM2 ? `${areaM2}m²\n` : '') +
          `${zona}\n` +
          (aptoPara.length ? `Ideal para: ${aptoPara.join(', ')}\n` : '') +
          `Consultas por WhatsApp`;

        const versionFacebook =
          `SE ALQUILA: ${titulo}\n\n` +
          descripcionLimpia +
          `\n\nContactar por WhatsApp para más información.`;

        return {
          titulo,
          descripcionLimpia,
          propertyDraft: data,
          informacionFaltante: data.requisitosFaltantes || [],
          versionWhatsapp,
          versionFacebook,
        };
      } catch (err) {
        console.warn('[AI Service] Error al usar Gemini para normalizeRawListing, usando fallback léxico:', err.message);
      }
    }
    return lexicalEnhanceListing(rawText);
  },

  async compareProperties(query, properties) {
    if (geminiClient.isAvailable()) {
      try {
        const systemPrompt = `Eres el comparador de propiedades de Mita, el agente inmobiliario inteligente con IA de Santa Cruz de la Sierra, Bolivia.
Compara las siguientes propiedades inmobiliarias en base a la consulta de búsqueda o necesidades del usuario.

Consulta: "${query}"

Propiedades a comparar:
${JSON.stringify(properties)}

Devuelve estrictamente un objeto JSON con las siguientes propiedades (no uses emojis en las respuestas):
- recommendedPropertyId: El ID de la propiedad que es la mejor recomendación. Debe ser uno de los IDs de las propiedades comparadas.
- decisionSummary: Un resumen claro de la decisión y por qué se recomienda esta propiedad en particular (1-2 párrafos).
- comparisonTable: Un array de objetos para representar en una tabla comparativa de doble entrada. Cada objeto debe representar una propiedad y tener las siguientes claves en español:
  - "Propiedad": El título corto de la propiedad.
  - "Precio Mensual": El precio formateado (ej: "$800 USD").
  - "Área Total": Los metros cuadrados formateados (ej: "80 m²").
  - "Zona": La zona donde se encuentra.
  - "Tipo de Uso": El tipo de uso de la propiedad.
  - "Trifásica": "Sí" o "No" indicando si tiene energía trifásica.
  - "Acceso Camión": "Sí" o "No" indicando si tiene acceso para camiones.
  - "Faltantes": El número de requisitos o información faltante.
- tradeoffs: Un array de strings con los tradeoffs o detalles de cada opción (puntos fuertes y débiles).
- finalRecommendation: Una recomendación final detallada y el llamado a la acción (ej: contactar por WhatsApp).`;

        const response = await geminiClient.generateContent(systemPrompt, {
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: 'OBJECT',
              properties: {
                recommendedPropertyId: { type: 'STRING' },
                decisionSummary: { type: 'STRING' },
                comparisonTable: {
                  type: 'ARRAY',
                  items: {
                    type: 'OBJECT',
                    properties: {
                      "Propiedad": { type: 'STRING' },
                      "Precio Mensual": { type: 'STRING' },
                      "Área Total": { type: 'STRING' },
                      "Zona": { type: 'STRING' },
                      "Tipo de Uso": { type: 'STRING' },
                      "Trifásica": { type: 'STRING' },
                      "Acceso Camión": { type: 'STRING' },
                      "Faltantes": { type: 'INTEGER' }
                    },
                    required: ["Propiedad", "Precio Mensual", "Área Total", "Zona", "Tipo de Uso", "Trifásica", "Acceso Camión", "Faltantes"]
                  }
                },
                tradeoffs: {
                  type: 'ARRAY',
                  items: { type: 'STRING' }
                },
                finalRecommendation: { type: 'STRING' }
              },
              required: ["recommendedPropertyId", "decisionSummary", "comparisonTable", "tradeoffs", "finalRecommendation"]
            }
          }
        });
        return JSON.parse(response.text);
      } catch (err) {
        console.warn('[AI Service] Error al usar Gemini para compareProperties, usando fallback léxico:', err.message);
      }
    }
    return lexicalCompare(query, properties);
  },

  async explainResults(query, criteria, results) {
    if (geminiClient.isAvailable()) {
      try {
        const prompt = `Analiza los siguientes resultados de búsqueda de propiedades para la consulta del usuario.
Consulta del usuario: "${query}"
Criterios extraídos: ${JSON.stringify(criteria)}

Resultados de búsqueda:
${JSON.stringify(results.map(r => ({ id: r.id, titulo: r.titulo, zona: r.zona, precio: r.precio, moneda: r.moneda, score: r.matchScore || r.puntajeCoincidencia })))}

Genera una breve explicación de por qué estas propiedades son las mejores opciones para el usuario, destacando las ventajas clave del primer resultado y haciendo recomendaciones específicas de uso. Mantén el tono profesional, útil y centrado en la narrativa de Mita: "Mita te ayuda a encontrar tu espacio". No uses emojis en la respuesta.`;

        const response = await geminiClient.generateContent(prompt);
        return response.text;
      } catch (err) {
        console.warn('[AI Service] Error en explainResults con Gemini:', err.message);
      }
    }
    return 'Explicación no disponible (Gemini no configurado).';
  },

  async discoverSources(query, city = 'Santa Cruz de la Sierra, Bolivia') {
    const seedSources = PORTAL_SEED_SOURCES.map((source, index) => ({
      id: `seed-${index + 1}`,
      nombre: source.nombre,
      urlBase: source.urlBase,
      tipoFuente: source.tipoFuente,
      activo: true,
      prioridad: source.prioridad,
      tags: source.tags || []
    }));

    if (geminiClient.isAvailable()) {
      try {
        const prompt = `Encuentra la mayor cantidad posible de fuentes públicas, portales inmobiliarios, inmobiliarias, páginas de clasificados y páginas con ofertas de alquiler o venta de inmuebles en ${city}.
Consulta del usuario: "${query}"

Prioriza páginas específicas con listados activos de departamentos, casas, monoambientes, oficinas, locales comerciales, depósitos, galpones, terrenos y espacios logísticos.
Incluye portales nacionales, inmobiliarias locales, clasificados y páginas especializadas. No uses emojis.`;

        const response = await geminiClient.generateWithSearchGrounding(prompt);
        
        // Extraer metadatos de grounding de la respuesta
        const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
        const sources = chunks.map((chunk, index) => {
          if (chunk.web) {
            return {
              id: index + 1,
              nombre: chunk.web.title || 'Sitio web descubierto',
              urlBase: chunk.web.uri || '',
              tipoFuente: 'HTML_CACHE',
              activo: true
            };
          }
          return null;
        }).filter(Boolean);

        const mergedSources = [...sources, ...seedSources]
          .filter((src) => src.urlBase)
          .filter((src, index, arr) => {
            const url = src.urlBase.toLowerCase();
            return arr.findIndex((candidate) => candidate.urlBase?.toLowerCase() === url) === index;
          })
          .sort((a, b) => (a.prioridad || 99) - (b.prioridad || 99));

        return {
          explicacion: response.text,
          fuentesDescubiertas: mergedSources
        };
      } catch (err) {
        console.error('[AI Service] Error al hacer discoverSources:', err);
      }
    }

    return {
      explicacion: 'Gemini Search Grounding no está disponible. Se devuelven fuentes semilla curadas del mercado inmobiliario boliviano para scraping.',
      fuentesDescubiertas: seedSources
    };
  },

  async analyzeUrls(urls, options = {}) {
    const crawlListings = options.crawlListings !== false;
    const maxPagesPerUrl = Math.max(1, Math.min(parseInt(options.maxPagesPerUrl || 12), 60));
    const maxListingLinksPerUrl = Math.max(0, Math.min(parseInt(options.maxListingLinksPerUrl || 20), maxPagesPerUrl - 1));
    const maxPaginationPagesPerUrl = Math.max(0, Math.min(parseInt(options.maxPaginationPagesPerUrl || 3), 10));
    const maxProperties = options.maxProperties ? Math.max(1, parseInt(options.maxProperties)) : null;
    const results = [];

    for (const url of urls) {
      try {
        const scrapeResult = await scraperService.scrapeUrl(url);
        if (!scrapeResult.success) {
          results.push({
            url,
            success: false,
            error: scrapeResult.error
          });
          continue;
        }

        const scrapePages = [scrapeResult];
        const indexPages = [scrapeResult];

        const paginationLinks = crawlListings
          ? (scrapeResult.paginationLinks || []).slice(0, maxPaginationPagesPerUrl)
          : [];

        for (const pageLink of paginationLinks) {
          if (scrapePages.length >= maxPagesPerUrl) break;
          try {
            const pageScrape = await scraperService.scrapeUrl(pageLink.url);
            if (pageScrape.success) {
              scrapePages.push(pageScrape);
              indexPages.push(pageScrape);
            }
          } catch (pageErr) {
            console.warn(`[AI Service] No se pudo scrapear página paginada ${pageLink.url}:`, pageErr.message);
          }
        }

        const linkMap = new Map();
        for (const page of indexPages) {
          for (const link of (page.listingLinks || [])) {
            const key = String(link.url || '').toLowerCase();
            if (!key || linkMap.has(key)) continue;
            linkMap.set(key, link);
          }
        }

        const remainingPageBudget = Math.max(0, maxPagesPerUrl - scrapePages.length);
        const linksToCrawl = crawlListings
          ? Array.from(linkMap.values()).slice(0, Math.min(maxListingLinksPerUrl, remainingPageBudget))
          : [];

        for (const link of linksToCrawl) {
          if (scrapePages.length >= maxPagesPerUrl) break;
          try {
            const detailScrape = await scraperService.scrapeUrl(link.url);
            if (detailScrape.success) {
              scrapePages.push(detailScrape);
            }
          } catch (linkErr) {
            console.warn(`[AI Service] No se pudo scrapear ficha candidata ${link.url}:`, linkErr.message);
          }
        }

        let properties = [];

        if (geminiClient.isAvailable()) {
          const extractionCorpus = buildExtractionCorpus(scrapePages);
          const systemPrompt = `Analiza el contenido scrapeado de una o varias páginas web y extrae TODAS las ofertas inmobiliarias reales que encuentres.
Puedes recibir una página índice con tarjetas, fichas individuales, JSON-LD, textos visibles, teléfonos, precios y enlaces.
No inventes propiedades: si una señal corresponde a navegación, filtros, anuncios genéricos o texto institucional, ignórala.

Devuelve estrictamente un objeto JSON con una propiedad "properties" que sea un array de objetos, donde cada objeto tenga:
- titulo: Título descriptivo e identificativo de la oferta.
- descripcion: Descripción detallada.
- tipoPropiedad: DEPARTAMENTO, GARZONIER, CASA, HABITACION, MONOAMBIENTE, OFICINA, LOCAL_COMERCIAL, DEPOSITO, GALPON, TALLER, ESPACIO_LOGISTICO, TERRENO, OTRO.
- tipoUsoEspacio: RESIDENCIAL, COMERCIAL, INDUSTRIAL, LOGISTICO, OFICINA, MIXTO, OTRO.
- operacion: ALQUILER, VENTA, ANTICRETICO u OTRO.
- ciudad: Ciudad si aparece.
- zona: Zona o barrio. Si no se especifica, usa "No especificada".
- direccionTexto: Dirección textual si aparece, o null.
- latitud: número o null.
- longitud: número o null.
- precio: número o null.
- moneda: "USD" o "BOB".
- areaM2: número o null.
- cantidadHabitaciones: número o null.
- cantidadBanos: número o null.
- tieneGaraje: boolean.
- estaAmoblada: boolean.
- aceptaMascotas: boolean.
- expensasIncluidas: boolean.
- montoExpensas: número o null.
- comodidades: array de strings.
- aptoPara: array de strings.
- caracteristicasOperativas: objeto con accesoCamion, sobreAvenida, altoTransito, parqueo, seguridad, energiaTrifasica, wifi, alturaPortonM, oficinaAdministrativa, accesoIndependiente.
- requisitosFaltantes: array de strings con información importante que no aparece.
- nombreContacto: string o null.
- telefonoContacto: string o null.
- emailContacto: string o null.
- urlFuente: URL exacta de la ficha si aparece; si no, usa la URL fuente más cercana.
- idExternoFuente: identificador del portal si aparece, o null.
- urlImagen: imagen principal si aparece, o null.
- fechaPublicacion: fecha de publicación si aparece, o null.
- confianzaIA: número entre 0 y 1.

Contenido scrapeado:
${extractionCorpus}`;

          const response = await geminiClient.generateContent(systemPrompt, {
            config: { responseMimeType: 'application/json' }
          });
          
          const data = JSON.parse(response.text);
          properties = (data.properties || []).map((p) =>
            normalizePropertyDraft(p, url, scrapeResult.imageUrl, scrapePages)
          );
        } else {
          properties = fallbackExtractProperties(scrapePages, url);
        }

        if (!maxProperties || properties.length < maxProperties) {
          const fallbackProperties = fallbackExtractProperties(scrapePages, url);
          properties = [...properties, ...fallbackProperties];
        }

        properties = dedupeProperties(properties)
          .filter(hasUsefulPropertySignal)
          .slice(0, maxProperties || undefined);

        results.push({
          url,
          success: true,
          properties,
          pagesAnalyzed: scrapePages.length,
          crawledUrls: scrapePages.map((page) => page.url),
          listingLinksFound: scrapeResult.listingLinks?.length || 0,
          paginationLinksFound: scrapeResult.paginationLinks?.length || 0,
          candidateBlocksFound: scrapePages.reduce((sum, page) => sum + (page.candidateBlocks?.length || 0), 0),
          scrapeStats: scrapePages.map((page) => page.stats).filter(Boolean)
        });
      } catch (error) {
        console.error(`[AI Service] Error al procesar URL ${url}:`, error);
        results.push({
          url,
          success: false,
          error: error.message
        });
      }
    }
    return results;
  },

  async generateEmbedding(text) {
    if (geminiClient.isAvailable()) {
      try {
        const values = await geminiClient.generateEmbedding(text);
        return {
          embedding: values,
          modelo: 'gemini-embedding-2',
          dimension: values.length
        };
      } catch (err) {
        console.warn('[AI Service] Falló la generación de embedding real de Gemini. Retornando fallback:', err.message);
      }
    }
    return {
      embedding: null,
      modelo: 'mita-keyword-v1',
      dimension: 0
    };
  },

  generateSearchText(property) {
    const text = [
      property.titulo,
      property.descripcion,
      property.zona,
      property.tipoPropiedad,
      property.tipoUsoEspacio,
      ...(property.aptoPara || []),
      ...(property.comodidades || []),
      property.textoBusqueda,
    ]
      .filter(Boolean)
      .join(' ');
    
    return text;
  }
};
