/**
 * Motor de Inteligencia Artificial de Mita.
 * Simula capacidades de IA usando análisis léxico avanzado, scoring semántico
 * por palabras clave y lógica de dominio del mercado inmobiliario de Santa Cruz.
 *
 * Sin dependencias de APIs externas. Diseñado para demo del hackathon Build With AI 2026.
 */

// ---- Vocabulario de dominio de Santa Cruz ----

const PROPERTY_TYPE_KEYWORDS = {
  LOCAL_COMERCIAL: ['local', 'comercial', 'tienda', 'showroom', 'boutique', 'negocio', 'local comercial'],
  DEPOSITO: ['depósito', 'deposito', 'almacén', 'almacen', 'storage', 'bodega'],
  GALPON: ['galpón', 'galpon', 'nave', 'hangar'],
  TALLER: ['taller', 'mecánico', 'mecanico', 'workshop', 'automotriz'],
  OFICINA: ['oficina', 'office', 'coworking', 'corporativo', 'despacho'],
  ESPACIO_LOGISTICO: ['logístico', 'logistico', 'logística', 'logistica', 'distribución', 'distribucion', 'módulo logístico'],
  DEPARTAMENTO: ['departamento', 'depa', 'dpto', 'apartamento'],
  GARZONIER: ['garzonier', 'garsonera', 'estudio'],
  CASA: ['casa', 'chalet', 'vivienda unifamiliar'],
  HABITACION: ['habitación', 'habitacion', 'cuarto', 'pieza'],
  MONOAMBIENTE: ['monoambiente', 'studio'],
  TERRENO: ['terreno', 'lote', 'solar'],
};

const USAGE_TYPE_KEYWORDS = {
  COMERCIAL: ['cafetería', 'cafeteria', 'tienda', 'restaurante', 'negocio', 'comercial', 'venta', 'atención al público', 'fast food'],
  INDUSTRIAL: ['taller', 'industrial', 'manufactura', 'producción', 'produccion', 'fábrica', 'fabrica'],
  LOGISTICO: ['depósito', 'deposito', 'logística', 'logistica', 'distribución', 'distribucion', 'almacenamiento', 'galpón', 'galpon'],
  OFICINA: ['oficina', 'startup', 'empresa', 'coworking', 'reuniones', 'corporativo'],
  RESIDENCIAL: ['vivir', 'residencial', 'familia', 'dormitorio', 'dorm', 'amoblado', 'departamento'],
};

const ZONE_KEYWORDS = {
  'Equipetrol': ['equipetrol', 'ucb'],
  'Zona Norte': ['zona norte', 'norte', 'av. beni', 'avenida beni'],
  'Centro': ['centro', 'cañoto', 'casco viejo'],
  'Sirari': ['sirari'],
  'Las Palmas': ['las palmas', 'urubó', 'urubo'],
  'Av. Alemana': ['alemana', 'av alemana', 'avenida alemana'],
  'Av. Busch': ['busch', 'av busch'],
  'Av. San Martin': ['san martin', 'san martín'],
  'Cristo Redentor': ['cristo redentor', 'redentor'],
  'Urbari': ['urbari'],
  'Hamacas': ['hamacas'],
};

const OPERATIONAL_KEYWORDS = {
  accesoCamion: ['camión', 'camion', 'acceso camión', 'portón', 'porton', 'carga y descarga'],
  sobreAvenida: ['avenida', 'sobre avenida', 'av.', 'transitada', 'alto tránsito', 'alto transito', 'calle principal'],
  altoTransito: ['alto tránsito', 'alto transito', 'transitada', 'flujo de personas', 'mucho tráfico'],
  parqueo: ['parqueo', 'parking', 'garaje', 'estacionamiento'],
  seguridad: ['seguridad', 'vigilancia', '24h', 'cámara', 'camara'],
  energiaTrifasica: ['trifásica', 'trifasica', 'trifásico', 'trifasico', 'fuerza industrial'],
  wifi: ['wifi', 'internet', 'fibra óptica'],
};

// ---- Utilidades ----

function normalizeText(text) {
  return (text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // quitar acentos
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractPrice(text) {
  const normalized = normalizeText(text);
  // Buscar patrones como "800$", "800 dolares", "$800", "800 usd"
  const patterns = [
    /(\d+)\s*\$/,
    /\$\s*(\d+)/,
    /(\d+)\s*(?:dolares|dólares|usd)/i,
    /(\d+)\s*(?:bolivianos|bs\.?)/i,
  ];
  for (const p of patterns) {
    const m = normalized.match(p);
    if (m) return parseInt(m[1]);
  }
  // Buscar cualquier número de 3+ dígitos como precio probable
  const nums = normalized.match(/\b(\d{3,5})\b/g);
  if (nums) return parseInt(nums[0]);
  return null;
}

function extractAreaM2(text) {
  const normalized = normalizeText(text);
  const m = normalized.match(/(\d+)\s*(?:m2|m²|metros|metros cuadrados)/i);
  if (m) return parseInt(m[1]);
  return null;
}

function detectPropertyType(text) {
  const normalized = normalizeText(text);
  for (const [type, keywords] of Object.entries(PROPERTY_TYPE_KEYWORDS)) {
    if (keywords.some((kw) => normalized.includes(normalizeText(kw)))) {
      return type;
    }
  }
  return 'OTRO';
}

function detectUsageType(text) {
  const normalized = normalizeText(text);
  for (const [usage, keywords] of Object.entries(USAGE_TYPE_KEYWORDS)) {
    if (keywords.some((kw) => normalized.includes(normalizeText(kw)))) {
      return usage;
    }
  }
  return 'OTRO';
}

function detectZones(text) {
  const normalized = normalizeText(text);
  const found = [];
  for (const [zone, keywords] of Object.entries(ZONE_KEYWORDS)) {
    if (keywords.some((kw) => normalized.includes(normalizeText(kw)))) {
      found.push(zone);
    }
  }
  return found;
}

function detectOperationalFeatures(text) {
  const normalized = normalizeText(text);
  const features = {};
  for (const [feature, keywords] of Object.entries(OPERATIONAL_KEYWORDS)) {
    features[feature] = keywords.some((kw) => normalized.includes(normalizeText(kw)));
  }
  return features;
}

function detectAptFor(text, usageType) {
  const normalized = normalizeText(text);
  const suggestions = [];
  const aptForMap = {
    cafeteria: ['cafeteria', 'cafe', 'coffee', 'gastronomia', 'restaurante', 'comida'],
    tienda: ['tienda', 'venta', 'retail', 'boutique'],
    showroom: ['showroom', 'exhibicion', 'exposicion'],
    'oficina pequeña': ['startup', 'oficina', 'empresa', 'coworking'],
    almacenamiento: ['deposito', 'almacen', 'almacenamiento', 'bodega'],
    logística: ['logistica', 'distribucion', 'galpon'],
    'taller mecánico': ['taller', 'mecanico', 'automotriz'],
    farmacia: ['farmacia', 'botica'],
    'fast food': ['fast food', 'comida rapida'],
  };
  for (const [apt, keywords] of Object.entries(aptForMap)) {
    if (keywords.some((kw) => normalized.includes(kw))) {
      suggestions.push(apt);
    }
  }
  return suggestions;
}

// ---- Extracción de criterios desde consulta en lenguaje natural ----

export function extractCriteria(query) {
  const normalized = normalizeText(query);

  const tipoPropiedad = detectPropertyType(query);
  const tipoUsoEspacio = detectUsageType(query);
  const zonas = detectZones(query);
  const precioMaximo = extractPrice(query);
  const areaM2 = extractAreaM2(query);
  const operacional = detectOperationalFeatures(query);
  const aptoPara = detectAptFor(query, tipoUsoEspacio);

  const prioridades = [];
  if (operacional.sobreAvenida || operacional.altoTransito) prioridades.push('visibilidad y tránsito');
  if (operacional.accesoCamion) prioridades.push('acceso para vehículos de carga');
  if (operacional.seguridad) prioridades.push('seguridad');
  if (operacional.parqueo) prioridades.push('parqueo');
  if (areaM2) prioridades.push(`mínimo ${areaM2}m²`);

  return {
    consultaCruda: query,
    tipoPropiedad: tipoPropiedad !== 'OTRO' ? tipoPropiedad : null,
    tipoUsoEspacio: tipoUsoEspacio !== 'OTRO' ? tipoUsoEspacio : null,
    zonas,
    precioMaximo,
    areaM2,
    aptoPara,
    caracteristicasOperativas: operacional,
    prioridades,
  };
}

// ---- Scoring de compatibilidad ----

export function scoreProperty(property, criteria) {
  let score = 0;
  let maxScore = 0;
  const razones = [];
  const advertencias = [];
  const informacionFaltante = [...(property.requisitosFaltantes || [])];

  // Tipo de propiedad (peso: 25)
  maxScore += 25;
  if (criteria.tipoPropiedad && property.tipoPropiedad === criteria.tipoPropiedad) {
    score += 25;
    razones.push(`✓ Tipo de espacio coincide: ${property.tipoPropiedad.replace(/_/g, ' ').toLowerCase()}`);
  } else if (!criteria.tipoPropiedad) {
    score += 15; // sin criterio explícito, puntuación parcial
  } else {
    advertencias.push(`El tipo de espacio (${property.tipoPropiedad}) no coincide exactamente con lo buscado.`);
  }

  // Precio (peso: 25)
  maxScore += 25;
  if (criteria.precioMaximo && property.precio) {
    if (property.precio <= criteria.precioMaximo) {
      const pctBudget = property.precio / criteria.precioMaximo;
      const pts = Math.round(25 * (1 - pctBudget * 0.3)); // más barato = más puntos
      score += Math.max(15, pts);
      razones.push(`✓ Precio dentro del presupuesto: $${property.precio} ${property.moneda} (máximo $${criteria.precioMaximo})`);
    } else {
      const exceso = Math.round(((property.precio - criteria.precioMaximo) / criteria.precioMaximo) * 100);
      advertencias.push(`El precio ($${property.precio}) supera el presupuesto en un ${exceso}%.`);
    }
  } else if (!criteria.precioMaximo) {
    score += 15;
  }

  // Zona (peso: 20)
  maxScore += 20;
  if (criteria.zonas.length > 0) {
    const propZonaNorm = normalizeText(property.zona);
    const match = criteria.zonas.some((z) => propZonaNorm.includes(normalizeText(z)));
    if (match) {
      score += 20;
      razones.push(`✓ Zona coincide: ${property.zona}`);
    } else {
      advertencias.push(`La zona (${property.zona}) no es la zona preferida de la búsqueda.`);
      score += 5; // algo de puntos por ser activa igualmente
    }
  } else {
    score += 12; // sin zona especificada
  }

  // Área (peso: 10)
  maxScore += 10;
  if (criteria.areaM2 && property.areaM2) {
    if (property.areaM2 >= criteria.areaM2) {
      score += 10;
      razones.push(`✓ Tamaño suficiente: ${property.areaM2}m² (mínimo requerido: ${criteria.areaM2}m²)`);
    } else {
      advertencias.push(`El espacio (${property.areaM2}m²) es menor al mínimo buscado (${criteria.areaM2}m²).`);
    }
  } else if (property.areaM2 === null) {
    informacionFaltante.push('metros cuadrados');
  } else {
    score += 7;
  }

  // Características operativas (peso: 20)
  maxScore += 20;
  const opCrit = criteria.caracteristicasOperativas || {};
  const opProp = property.caracteristicasOperativas || {};
  let opScore = 0;
  let opMax = 0;
  for (const [feat, needed] of Object.entries(opCrit)) {
    if (needed) {
      opMax++;
      if (opProp[feat] === true) {
        opScore++;
        razones.push(`✓ Característica presente: ${feat}`);
      } else if (opProp[feat] === null || opProp[feat] === undefined) {
        advertencias.push(`No se confirma si tiene: ${feat}.`);
        informacionFaltante.push(feat);
      }
    }
  }
  if (opMax > 0) {
    score += Math.round((opScore / opMax) * 20);
  } else {
    score += 12;
  }

  // Apto para (bonus: 10)
  maxScore += 10;
  if (criteria.aptoPara.length > 0 && property.aptoPara?.length > 0) {
    const propAptNorm = property.aptoPara.map(normalizeText);
    const match = criteria.aptoPara.some((a) => propAptNorm.some((b) => b.includes(normalizeText(a)) || normalizeText(a).includes(b)));
    if (match) {
      score += 10;
      razones.push(`✓ Espacio apto para: ${criteria.aptoPara.join(', ')}`);
    }
  } else {
    score += 5;
  }

  const puntaje = Math.min(100, Math.round((score / maxScore) * 100));

  // Generar resumen
  const resumen = generateMatchSummary(property, criteria, puntaje, razones, advertencias);

  return {
    puntajeCoincidencia: puntaje,
    similitudRag: parseFloat((puntaje / 100).toFixed(4)),
    resumen,
    razones,
    advertencias,
    informacionFaltante: [...new Set(informacionFaltante)],
    recomendacion: puntaje >= 80 ? 'Muy recomendado' : puntaje >= 60 ? 'Recomendado con observaciones' : 'Revisar con cautela',
    etiquetaCorta: puntaje >= 85 ? '🔥 Mejor match' : puntaje >= 70 ? '✅ Buen match' : '⚠️ Match parcial',
  };
}

function generateMatchSummary(property, criteria, puntaje, razones, advertencias) {
  const lines = [];
  lines.push(`Este espacio en ${property.zona} tiene un ${puntaje}% de compatibilidad con tu búsqueda.`);
  if (razones.length > 0) {
    lines.push(`Encaja porque: ${razones.slice(0, 2).map((r) => r.replace(/^✓\s*/, '')).join('; ')}.`);
  }
  if (advertencias.length > 0) {
    lines.push(`Puntos a verificar: ${advertencias[0]}`);
  }
  return lines.join(' ');
}

// ---- Búsqueda completa ----

export function aiSearch(query, allProperties, limit = 10) {
  const criteria = extractCriteria(query);

  const results = allProperties
    .filter((p) => p.estado === 'ACTIVA')
    .map((p) => ({
      property: p,
      ...scoreProperty(p, criteria),
    }))
    .filter((r) => r.puntajeCoincidencia > 30)
    .sort((a, b) => b.puntajeCoincidencia - a.puntajeCoincidencia)
    .slice(0, limit);

  return { criteria, results };
}

// ---- Comparador ----

export function aiCompare(query, properties) {
  const criteria = extractCriteria(query);
  const scored = properties.map((p) => ({ property: p, ...scoreProperty(p, criteria) }));
  scored.sort((a, b) => b.puntajeCoincidencia - a.puntajeCoincidencia);

  const best = scored[0];
  const comparisonTable = scored.map((r) => ({
    id: r.property.id,
    titulo: r.property.titulo,
    zona: r.property.zona,
    precio: `$${r.property.precio} ${r.property.moneda}`,
    areaM2: r.property.areaM2 ? `${r.property.areaM2}m²` : 'No especificado',
    puntaje: `${r.puntajeCoincidencia}%`,
    etiqueta: r.etiquetaCorta,
    ventajas: r.razones.slice(0, 2),
    desventajas: r.advertencias.slice(0, 2),
  }));

  const tradeoffs = scored.slice(1).map((r) =>
    `${r.property.titulo}: ${r.advertencias[0] || 'Opción viable, pero con menor compatibilidad.'}`
  );

  const finalRecommendation =
    `Basado en tu búsqueda "${query}", la mejor opción es "${best.property.titulo}" en ${best.property.zona} ` +
    `con un ${best.puntajeCoincidencia}% de compatibilidad. ${best.razones.slice(0, 2).map((r) => r.replace(/^✓\s*/, '')).join('. ')}.`;

  return {
    recommendedPropertyId: best.property.id,
    decisionSummary: `Analizadas ${scored.length} propiedades. Recomendación clara: "${best.property.titulo}".`,
    comparisonTable,
    tradeoffs,
    finalRecommendation,
  };
}

// ---- Normalizador de publicaciones ----

export function aiEnhanceListing(rawText) {
  const tipoPropiedad = detectPropertyType(rawText);
  const tipoUsoEspacio = detectUsageType(rawText);
  const zonas = detectZones(rawText);
  const precio = extractPrice(rawText);
  const areaM2 = extractAreaM2(rawText);
  const operacional = detectOperationalFeatures(rawText);
  const aptoPara = detectAptFor(rawText, tipoUsoEspacio);

  const faltantes = [];
  if (!precio) faltantes.push('precio');
  if (!areaM2) faltantes.push('metros cuadrados');
  if (zonas.length === 0) faltantes.push('zona exacta');
  if (!operacional.parqueo) faltantes.push('parqueo');
  if (tipoUsoEspacio === 'COMERCIAL' && !operacional.sobreAvenida) faltantes.push('visibilidad o tránsito');
  faltantes.push('condiciones de alquiler', 'servicios básicos');

  const zonaTxt = zonas[0] || 'No especificada';
  const tipoTxt = tipoPropiedad.replace(/_/g, ' ').toLowerCase();

  const titulo = `${tipoTxt.charAt(0).toUpperCase() + tipoTxt.slice(1)} en ${zonaTxt}${precio ? ` - $${precio} USD` : ''}`;

  const descripcionLimpia =
    `${tipoTxt.charAt(0).toUpperCase() + tipoTxt.slice(1)} disponible para alquiler en ${zonaTxt}. ` +
    (precio ? `Precio: $${precio} USD/mes. ` : '') +
    (areaM2 ? `Superficie: ${areaM2}m². ` : '') +
    (operacional.sobreAvenida ? 'Ubicado sobre avenida principal con buen tránsito. ' : '') +
    (operacional.parqueo ? 'Cuenta con parqueo. ' : '') +
    (aptoPara.length ? `Ideal para: ${aptoPara.join(', ')}. ` : '');

  const propertyDraft = {
    titulo,
    tipoPropiedad: tipoPropiedad !== 'OTRO' ? tipoPropiedad : null,
    tipoUsoEspacio: tipoUsoEspacio !== 'OTRO' ? tipoUsoEspacio : null,
    zona: zonaTxt,
    precio: precio || null,
    moneda: 'USD',
    areaM2: areaM2 || null,
    aptoPara,
    caracteristicasOperativas: operacional,
  };

  const caracteristicas = Object.entries(operacional)
    .filter(([, v]) => v === true)
    .map(([k]) => k);

  const preguntasSugeridas = [
    '¿Cuántos metros cuadrados tiene exactamente?',
    '¿Cuáles son las condiciones de alquiler (garantía, mes adelantado)?',
    '¿Cuenta con todos los servicios básicos (luz, agua, gas)?',
    '¿Permite actividad comercial o tiene restricciones?',
    '¿Hay parqueo disponible para clientes?',
  ].filter((q, i) => {
    if (i === 0 && areaM2) return false;
    if (i === 4 && operacional.parqueo) return false;
    return true;
  });

  const versionWhatsapp =
    `🏢 *${titulo}*\n` +
    (precio ? `💰 $${precio} USD/mes\n` : '') +
    (areaM2 ? `📐 ${areaM2}m²\n` : '') +
    `📍 ${zonaTxt}\n` +
    (aptoPara.length ? `✅ Ideal para: ${aptoPara.join(', ')}\n` : '') +
    `📞 Consultas por WhatsApp`;

  const versionFacebook =
    `🔑 SE ALQUILA: ${titulo}\n\n` +
    descripcionLimpia +
    `\n\n📲 Contactar por WhatsApp para más información.`;

  return {
    titulo,
    descripcionLimpia,
    propertyDraft,
    caracteristicas,
    informacionFaltante: [...new Set(faltantes)],
    preguntasSugeridas,
    versionWhatsapp,
    versionFacebook,
  };
}

// ---- RAG-lite: motor semántico simple ----

export function buildKeywordEmbedding(property) {
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

  return normalizeText(text).split(/\s+/).filter((w) => w.length > 2);
}

export function ragSearch(query, embeddings, allProperties, limit = 10) {
  const queryWords = normalizeText(query).split(/\s+/).filter((w) => w.length > 2);

  const results = embeddings
    .map((emb) => {
      const prop = allProperties.find((p) => p.id === emb.idPropiedad);
      if (!prop || prop.estado !== 'ACTIVA') return null;
      const intersection = queryWords.filter((w) => emb.embedding.includes(w));
      const similarity = intersection.length / Math.max(queryWords.length, 1);
      return { property: prop, similarity };
    })
    .filter(Boolean)
    .filter((r) => r.similarity > 0)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);

  return results;
}
