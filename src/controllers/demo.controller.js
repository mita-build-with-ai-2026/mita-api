/**
 * Controlador de escenarios demo de Mita.
 * Provee flujos predefinidos para la demostración del hackathon.
 */

const DEMO_SCENARIOS = [
  {
    id: 'escena-1-publicacion-desordenada',
    titulo: 'Escena 1: Publicación desordenada',
    descripcion: 'Muestra cómo una publicación informal desordenada llega al sistema.',
    accion: 'normalizar',
    payload: {
      rawText: 'alquilo local zona norte 800$ ideal negocio avenida transitada baño privado consultas whatsapp',
    },
    endpoint: 'POST /api/ai/enhance-listing',
  },
  {
    id: 'escena-2-busqueda-conversacional',
    titulo: 'Escena 2: Búsqueda conversacional',
    descripcion: 'Un emprendedor busca un local para abrir una cafetería.',
    accion: 'buscar',
    payload: {
      query: 'Busco un local comercial cerca de una avenida transitada, máximo 800 dólares, ideal para abrir una cafetería.',
      limit: 5,
    },
    endpoint: 'POST /api/ai/search',
  },
  {
    id: 'escena-3-busqueda-deposito',
    titulo: 'Escena 3: Búsqueda de depósito logístico',
    descripcion: 'Una empresa de distribución busca un galpón con acceso para camiones.',
    accion: 'buscar',
    payload: {
      query: 'Necesito un depósito o galpón de al menos 200m² en zona norte, con acceso para camión y seguridad.',
      limit: 5,
    },
    endpoint: 'POST /api/ai/search',
  },
  {
    id: 'escena-4-busqueda-oficina',
    titulo: 'Escena 4: Búsqueda de oficina para startup',
    descripcion: 'Una startup busca oficina amoblada cerca de Equipetrol.',
    accion: 'buscar',
    payload: {
      query: 'Quiero una oficina pequeña para una startup de 5 personas cerca de Equipetrol.',
      limit: 5,
    },
    endpoint: 'POST /api/ai/search',
  },
  {
    id: 'escena-5-comparador',
    titulo: 'Escena 5: Comparador de propiedades',
    descripcion: 'El usuario compara dos opciones para elegir la mejor para su cafetería.',
    accion: 'comparar',
    payload: {
      query: '¿Cuál me conviene más si quiero abrir una cafetería pequeña y necesito buena visibilidad?',
      propertyIds: ['00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000005'],
    },
    endpoint: 'POST /api/ai/compare',
  },
  {
    id: 'escena-6-lead-whatsapp',
    titulo: 'Escena 6: Contacto por WhatsApp',
    descripcion: 'El usuario genera un lead para contactar al propietario.',
    accion: 'lead',
    payload: {
      propertyId: '00000000-0000-0000-0000-000000000001',
      origen: 'WHATSAPP_CLICK',
    },
    endpoint: 'POST /api/leads',
  },
];

export const getScenarios = (req, res, next) => {
  try {
    res.status(200).json({
      escenarios: DEMO_SCENARIOS,
      total: DEMO_SCENARIOS.length,
      descripcion: 'Flujo completo de demostración de Mita para Build With AI 2026.',
    });
  } catch (err) {
    next(err);
  }
};
