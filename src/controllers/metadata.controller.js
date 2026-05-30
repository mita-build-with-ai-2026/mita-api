/**
 * Controlador de metadata de Mita.
 * Zonas de Santa Cruz y ejemplos de búsqueda conversacional.
 */

const ZONES = [
  'Equipetrol',
  'Zona Norte',
  'Centro',
  'Sirari',
  'Las Palmas',
  'Urubó',
  'Urbari',
  'Cristo Redentor',
  'Hamacas',
  'Av. Alemana',
  'Av. Busch',
  'Av. San Martin',
  'Av. Beni',
  'Av. Roca y Coronado',
  'Doble Vía La Guardia',
  'Banzer',
];

const SEARCH_EXAMPLES = [
  'Busco un local comercial cerca de una avenida transitada, máximo 800 dólares, ideal para abrir una cafetería.',
  'Necesito un depósito o galpón de al menos 200m² en zona norte, con acceso para camión y seguridad.',
  'Quiero una oficina pequeña para una startup de 5 personas cerca de Equipetrol.',
  'Busco un taller mecánico habilitado en avenida con energía trifásica.',
  'Local comercial en Sirari, máximo 600 dólares, ideal para emprendimiento gastronómico.',
  'Galpón para distribución logística con patio de maniobras y acceso a carretera.',
  'Departamento amoblado 2 dormitorios en Equipetrol con garaje.',
  'Espacio logístico compartido con vigilancia 24h, zona norte.',
];

export const getZones = (req, res, next) => {
  try {
    res.status(200).json({ zones: ZONES });
  } catch (err) {
    next(err);
  }
};

export const getSearchExamples = (req, res, next) => {
  try {
    res.status(200).json({ examples: SEARCH_EXAMPLES });
  } catch (err) {
    next(err);
  }
};
