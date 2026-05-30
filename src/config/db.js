/**
 * Base de datos local persistente en archivos JSON.
 * Simula las tablas del diagrama relacional de Mita usando ficheros en /data.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '../../data');

// Asegurar que el directorio de datos existe
if (!existsSync(DATA_DIR)) {
  mkdirSync(DATA_DIR, { recursive: true });
}

// --- Helpers ---

function readTable(name) {
  const file = join(DATA_DIR, `${name}.json`);
  if (!existsSync(file)) return [];
  return JSON.parse(readFileSync(file, 'utf-8'));
}

function writeTable(name, data) {
  const file = join(DATA_DIR, `${name}.json`);
  writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8');
}

// --- Seed ---

function seedIfEmpty(tableName, seedData) {
  const existing = readTable(tableName);
  if (existing.length === 0) {
    writeTable(tableName, seedData);
    console.log(`  [DB] Tabla '${tableName}' inicializada con ${seedData.length} registros.`);
  }
}

function initDb() {
  console.log('[DB] Inicializando base de datos local...');

  // Usuarios administradores
  seedIfEmpty('admins', [
    {
      id: randomUUID(),
      nombre: 'Admin Mita',
      email: 'admin@mita.ai',
      // hash de "admin123" generado con bcrypt rounds=10
      passwordHash: '$2a$10$nZzwOcT7DY87wf5mT9W8AOE3R6LMc9aA4d5zT7tF3hkPOe3TalO4G',
      rol: 'ADMIN',
      activo: true,
      creadoEn: new Date().toISOString(),
      ultimoAccesoEn: null,
    },
  ]);

  // Fuentes de propiedades
  seedIfEmpty('sources', [
    {
      id: 1,
      nombre: 'Demo Mita',
      urlBase: 'https://demo.mita.ai',
      tipoFuente: 'DEMO',
      activo: true,
      creadoEn: new Date().toISOString(),
    },
    {
      id: 2,
      nombre: 'Facebook Marketplace SCZ',
      urlBase: 'https://facebook.com/marketplace/santa-cruz',
      tipoFuente: 'FACEBOOK',
      activo: true,
      creadoEn: new Date().toISOString(),
    },
  ]);

  // Propiedades demo en Santa Cruz
  seedIfEmpty('properties', [
    {
      id: 'prop-001',
      titulo: 'Local comercial sobre Av. Cañoto - Zona Centro',
      descripcion: 'Local amplio con excelente visibilidad sobre avenida principal. Ideal para tienda, cafetería o showroom. Cuenta con baño privado y depósito trasero.',
      tipoPropiedad: 'LOCAL_COMERCIAL',
      tipoUsoEspacio: 'COMERCIAL',
      ciudad: 'Santa Cruz de la Sierra',
      zona: 'Centro',
      direccionTexto: 'Av. Cañoto entre 1er y 2do anillo',
      precio: 750,
      moneda: 'USD',
      precioBs: 5175,
      cantidadHabitaciones: null,
      cantidadBanos: 1,
      areaM2: 85,
      tieneGaraje: false,
      estaAmoblada: false,
      aceptaMascotas: false,
      expensasIncluidas: true,
      montoExpensas: 0,
      comodidades: ['baño privado', 'depósito', 'vidriera'],
      aptoPara: ['cafetería', 'tienda', 'showroom', 'boutique', 'farmacia'],
      caracteristicasOperativas: {
        sobreAvenida: true,
        altoTransito: true,
        accesoCamion: false,
        parqueo: false,
        seguridad: true,
        banos: 1,
      },
      requisitosFaltantes: ['permiso de actividad gastronómica', 'parqueo'],
      nombreContacto: 'Inmobiliaria Santa Cruz',
      telefonoContacto: '+59170000001',
      idFuente: 1,
      idImportacion: null,
      urlFuente: null,
      idExternoFuente: 'demo-001',
      hashFuente: null,
      urlImagen: null,
      latitud: -17.7834,
      longitud: -63.1821,
      textoCrudo: 'alquilo local zona centro 750$ sobre avenida cañoto ideal negocio baño privado',
      datosCrudos: null,
      datosExtraidosIA: null,
      textoBusqueda: 'local comercial centro avenida cañoto cafetería tienda showroom alto tránsito visibilidad',
      confianzaIA: 0.92,
      estadoNormalizacionIA: 'COMPLETADA',
      estado: 'ACTIVA',
      creadaEn: new Date().toISOString(),
      actualizadaEn: new Date().toISOString(),
      importadaEn: new Date().toISOString(),
    },
    {
      id: 'prop-002',
      titulo: 'Depósito amplio con acceso para camiones - Zona Norte',
      descripcion: 'Galpón de 350m² en zona industrial norte. Portón grande para ingreso de camiones, piso de cemento reforzado, iluminación industrial y vigilancia 24h.',
      tipoPropiedad: 'DEPOSITO',
      tipoUsoEspacio: 'LOGISTICO',
      ciudad: 'Santa Cruz de la Sierra',
      zona: 'Zona Norte',
      direccionTexto: 'Av. Beni entre 4to y 5to anillo',
      precio: 1200,
      moneda: 'USD',
      precioBs: 8280,
      cantidadHabitaciones: null,
      cantidadBanos: 2,
      areaM2: 350,
      tieneGaraje: true,
      estaAmoblada: false,
      aceptaMascotas: false,
      expensasIncluidas: false,
      montoExpensas: 80,
      comodidades: ['portón amplio', 'piso reforzado', 'iluminación industrial', 'vigilancia 24h', 'baños'],
      aptoPara: ['depósito', 'logística', 'distribución', 'almacenamiento', 'industria ligera'],
      caracteristicasOperativas: {
        sobreAvenida: false,
        altoTransito: false,
        accesoCamion: true,
        parqueo: true,
        seguridad: true,
        energiaTrifasica: true,
        banos: 2,
      },
      requisitosFaltantes: ['permiso de actividad industrial', 'tipo de carga permitida'],
      nombreContacto: 'Propietario Directo',
      telefonoContacto: '+59170000002',
      idFuente: 1,
      idImportacion: null,
      urlFuente: null,
      idExternoFuente: 'demo-002',
      hashFuente: null,
      urlImagen: null,
      latitud: -17.7200,
      longitud: -63.1700,
      textoCrudo: 'alquilo galpon deposito zona norte 1200$ acceso camion 350m2 vigilancia',
      datosCrudos: null,
      datosExtraidosIA: null,
      textoBusqueda: 'depósito galpón zona norte logística camión almacenamiento industrial acceso vehículo',
      confianzaIA: 0.95,
      estadoNormalizacionIA: 'COMPLETADA',
      estado: 'ACTIVA',
      creadaEn: new Date().toISOString(),
      actualizadaEn: new Date().toISOString(),
      importadaEn: new Date().toISOString(),
    },
    {
      id: 'prop-003',
      titulo: 'Oficina equipada para startup - Equipetrol',
      descripcion: 'Oficina moderna de 60m² en edificio corporativo en Equipetrol. Recepción compartida, sala de reuniones, WiFi de alta velocidad, parqueo incluido.',
      tipoPropiedad: 'OFICINA',
      tipoUsoEspacio: 'OFICINA',
      ciudad: 'Santa Cruz de la Sierra',
      zona: 'Equipetrol',
      direccionTexto: 'Calle Equipetrol Norte, Edificio Bussiness Center',
      precio: 600,
      moneda: 'USD',
      precioBs: 4140,
      cantidadHabitaciones: null,
      cantidadBanos: 1,
      areaM2: 60,
      tieneGaraje: true,
      estaAmoblada: true,
      aceptaMascotas: false,
      expensasIncluidas: true,
      montoExpensas: 0,
      comodidades: ['WiFi', 'sala de reuniones', 'recepción', 'AC', 'cocina compartida', 'parqueo'],
      aptoPara: ['startup', 'oficina corporativa', 'consultora', 'empresa de servicios'],
      caracteristicasOperativas: {
        sobreAvenida: false,
        altoTransito: false,
        accesoCamion: false,
        parqueo: true,
        seguridad: true,
        wifi: true,
        banos: 1,
      },
      requisitosFaltantes: ['cantidad máxima de personas', 'política de visitas'],
      nombreContacto: 'Business Center SCZ',
      telefonoContacto: '+59170000003',
      idFuente: 1,
      idImportacion: null,
      urlFuente: null,
      idExternoFuente: 'demo-003',
      hashFuente: null,
      urlImagen: null,
      latitud: -17.7744,
      longitud: -63.2018,
      textoCrudo: 'oficina equipetrol 600$ amoblada parqueo incluido wifi sala reuniones',
      datosCrudos: null,
      datosExtraidosIA: null,
      textoBusqueda: 'oficina equipetrol startup empresa corporativo WiFi reuniones parqueo amoblada',
      confianzaIA: 0.90,
      estadoNormalizacionIA: 'COMPLETADA',
      estado: 'ACTIVA',
      creadaEn: new Date().toISOString(),
      actualizadaEn: new Date().toISOString(),
      importadaEn: new Date().toISOString(),
    },
    {
      id: 'prop-004',
      titulo: 'Taller mecánico habilitado - Av. Alemana',
      descripcion: 'Taller de 200m² sobre avenida con fosa mecánica, fuerza trifásica y portón para 2 vehículos simultáneos. Zona consolidada para actividad automotriz.',
      tipoPropiedad: 'TALLER',
      tipoUsoEspacio: 'INDUSTRIAL',
      ciudad: 'Santa Cruz de la Sierra',
      zona: 'Av. Alemana',
      direccionTexto: 'Av. Alemana entre 3er y 4to anillo',
      precio: 900,
      moneda: 'USD',
      precioBs: 6210,
      cantidadHabitaciones: null,
      cantidadBanos: 1,
      areaM2: 200,
      tieneGaraje: true,
      estaAmoblada: false,
      aceptaMascotas: false,
      expensasIncluidas: false,
      montoExpensas: 50,
      comodidades: ['fosa mecánica', 'energía trifásica', 'portón doble', 'depósito de herramientas'],
      aptoPara: ['taller mecánico', 'vulcanizadora', 'servicio automotriz', 'lubricentro'],
      caracteristicasOperativas: {
        sobreAvenida: true,
        altoTransito: true,
        accesoCamion: true,
        parqueo: true,
        seguridad: false,
        energiaTrifasica: true,
        banos: 1,
      },
      requisitosFaltantes: ['permiso de actividad industrial', 'sistema de seguridad', 'manejo de residuos'],
      nombreContacto: 'Propietario',
      telefonoContacto: '+59170000004',
      idFuente: 1,
      idImportacion: null,
      urlFuente: null,
      idExternoFuente: 'demo-004',
      hashFuente: null,
      urlImagen: null,
      latitud: -17.7620,
      longitud: -63.1900,
      textoCrudo: 'alquilo taller av alemana 200m2 900$ fosa mecanica trifasica',
      datosCrudos: null,
      datosExtraidosIA: null,
      textoBusqueda: 'taller mecánico av alemana industrial trifásica fosa mecánica automotriz',
      confianzaIA: 0.88,
      estadoNormalizacionIA: 'COMPLETADA',
      estado: 'ACTIVA',
      creadaEn: new Date().toISOString(),
      actualizadaEn: new Date().toISOString(),
      importadaEn: new Date().toISOString(),
    },
    {
      id: 'prop-005',
      titulo: 'Local comercial en galería - Sirari',
      descripcion: 'Local de 45m² en galería comercial con flujo constante de personas. Ideal para emprendimiento gastronómico o tienda de accesorios.',
      tipoPropiedad: 'LOCAL_COMERCIAL',
      tipoUsoEspacio: 'COMERCIAL',
      ciudad: 'Santa Cruz de la Sierra',
      zona: 'Sirari',
      direccionTexto: 'Galería Sirari, 3er anillo',
      precio: 500,
      moneda: 'USD',
      precioBs: 3450,
      cantidadHabitaciones: null,
      cantidadBanos: 0,
      areaM2: 45,
      tieneGaraje: false,
      estaAmoblada: false,
      aceptaMascotas: false,
      expensasIncluidas: true,
      montoExpensas: 0,
      comodidades: ['vidriera', 'aire acondicionado central', 'baños compartidos de galería'],
      aptoPara: ['emprendimiento', 'cafetería pequeña', 'tienda de accesorios', 'fast food'],
      caracteristicasOperativas: {
        sobreAvenida: false,
        altoTransito: true,
        accesoCamion: false,
        parqueo: true,
        seguridad: true,
        banos: 0,
      },
      requisitosFaltantes: ['permiso de actividad gastronómica', 'instalación de ventilación específica'],
      nombreContacto: 'Administración Galería Sirari',
      telefonoContacto: '+59170000005',
      idFuente: 1,
      idImportacion: null,
      urlFuente: null,
      idExternoFuente: 'demo-005',
      hashFuente: null,
      urlImagen: null,
      latitud: -17.7980,
      longitud: -63.1650,
      textoCrudo: 'local galeria sirari 500$ 45m2 flujo personas ideal emprendimiento',
      datosCrudos: null,
      datosExtraidosIA: null,
      textoBusqueda: 'local comercial galería sirari emprendimiento gastronómico tienda accesorios',
      confianzaIA: 0.85,
      estadoNormalizacionIA: 'COMPLETADA',
      estado: 'ACTIVA',
      creadaEn: new Date().toISOString(),
      actualizadaEn: new Date().toISOString(),
      importadaEn: new Date().toISOString(),
    },
    {
      id: 'prop-006',
      titulo: 'Galpón logístico zona Urubó - Las Palmas',
      descripcion: 'Galpón de 500m² con patio de maniobras, cargas y descargas, 3 accesos vehiculares. Zona de expansión logística al oeste de Santa Cruz.',
      tipoPropiedad: 'GALPON',
      tipoUsoEspacio: 'LOGISTICO',
      ciudad: 'Santa Cruz de la Sierra',
      zona: 'Las Palmas',
      direccionTexto: 'Carretera al Urubó, Km 8',
      precio: 1800,
      moneda: 'USD',
      precioBs: 12420,
      cantidadHabitaciones: null,
      cantidadBanos: 3,
      areaM2: 500,
      tieneGaraje: true,
      estaAmoblada: false,
      aceptaMascotas: false,
      expensasIncluidas: false,
      montoExpensas: 150,
      comodidades: ['patio de maniobras', '3 accesos vehiculares', 'oficina administrativa', 'baños', 'vigilancia'],
      aptoPara: ['centro de distribución', 'logística', 'almacenamiento masivo', 'industria ligera'],
      caracteristicasOperativas: {
        sobreAvenida: false,
        altoTransito: false,
        accesoCamion: true,
        parqueo: true,
        seguridad: true,
        energiaTrifasica: true,
        banos: 3,
        patioManiobras: true,
      },
      requisitosFaltantes: ['tipo de mercancía permitida', 'acceso a autopista'],
      nombreContacto: 'LogiPark SCZ',
      telefonoContacto: '+59170000006',
      idFuente: 1,
      idImportacion: null,
      urlFuente: null,
      idExternoFuente: 'demo-006',
      hashFuente: null,
      urlImagen: null,
      latitud: -17.7400,
      longitud: -63.2500,
      textoCrudo: 'galpon logistico urubo 500m2 1800$ acceso camiones patio maniobras',
      datosCrudos: null,
      datosExtraidosIA: null,
      textoBusqueda: 'galpón logístico urubó las palmas camiones distribución almacenamiento masivo',
      confianzaIA: 0.93,
      estadoNormalizacionIA: 'COMPLETADA',
      estado: 'ACTIVA',
      creadaEn: new Date().toISOString(),
      actualizadaEn: new Date().toISOString(),
      importadaEn: new Date().toISOString(),
    },
    {
      id: 'prop-007',
      titulo: 'Departamento amoblado 2 dorm - Equipetrol',
      descripcion: 'Departamento moderno totalmente amoblado en edificio con seguridad. 2 dormitorios, 2 baños, balcón, garaje, piscina.',
      tipoPropiedad: 'DEPARTAMENTO',
      tipoUsoEspacio: 'RESIDENCIAL',
      ciudad: 'Santa Cruz de la Sierra',
      zona: 'Equipetrol',
      direccionTexto: 'Calle Prolongación Beni, Edificio Mirador',
      precio: 700,
      moneda: 'USD',
      precioBs: 4830,
      cantidadHabitaciones: 2,
      cantidadBanos: 2,
      areaM2: 90,
      tieneGaraje: true,
      estaAmoblada: true,
      aceptaMascotas: false,
      expensasIncluidas: false,
      montoExpensas: 60,
      comodidades: ['piscina', 'gym', 'balcón', 'seguridad 24h', 'ascensor'],
      aptoPara: ['vivienda familiar', 'ejecutivo', 'pareja'],
      caracteristicasOperativas: null,
      requisitosFaltantes: ['política de mascotas', 'garantía requerida'],
      nombreContacto: 'Inmobiliaria Equipetrol',
      telefonoContacto: '+59170000007',
      idFuente: 1,
      idImportacion: null,
      urlFuente: null,
      idExternoFuente: 'demo-007',
      hashFuente: null,
      urlImagen: null,
      latitud: -17.7744,
      longitud: -63.2018,
      textoCrudo: 'depa 2 dorm equipetrol 700$ amoblado garaje piscina gym seguridad',
      datosCrudos: null,
      datosExtraidosIA: null,
      textoBusqueda: 'departamento amoblado equipetrol residencial 2 dormitorios piscina garaje',
      confianzaIA: 0.91,
      estadoNormalizacionIA: 'COMPLETADA',
      estado: 'ACTIVA',
      creadaEn: new Date().toISOString(),
      actualizadaEn: new Date().toISOString(),
      importadaEn: new Date().toISOString(),
    },
    {
      id: 'prop-008',
      titulo: 'Espacio logístico compartido - Zona Norte Industrial',
      descripcion: 'Módulo logístico de 120m² en complejo compartido. Incluye zona de carga, estanterías metálicas, seguridad y administración.',
      tipoPropiedad: 'ESPACIO_LOGISTICO',
      tipoUsoEspacio: 'LOGISTICO',
      ciudad: 'Santa Cruz de la Sierra',
      zona: 'Zona Norte',
      direccionTexto: 'Parque Industrial Norte, Av. Beni 4to anillo',
      precio: 650,
      moneda: 'USD',
      precioBs: 4485,
      cantidadHabitaciones: null,
      cantidadBanos: 1,
      areaM2: 120,
      tieneGaraje: false,
      estaAmoblada: false,
      aceptaMascotas: false,
      expensasIncluidas: true,
      montoExpensas: 0,
      comodidades: ['zona de carga', 'estanterías metálicas', 'seguridad', 'baño', 'cámara frigorífica opcional'],
      aptoPara: ['logística', 'e-commerce', 'distribución pequeña', 'cold storage'],
      caracteristicasOperativas: {
        sobreAvenida: false,
        altoTransito: false,
        accesoCamion: true,
        parqueo: true,
        seguridad: true,
        banos: 1,
      },
      requisitosFaltantes: ['tipo de mercancía', 'horario de operación'],
      nombreContacto: 'Parque Industrial Norte SCZ',
      telefonoContacto: '+59170000008',
      idFuente: 1,
      idImportacion: null,
      urlFuente: null,
      idExternoFuente: 'demo-008',
      hashFuente: null,
      urlImagen: null,
      latitud: -17.7150,
      longitud: -63.1750,
      textoCrudo: 'modulo logistico zona norte 120m2 650$ carga estanterias seguridad',
      datosCrudos: null,
      datosExtraidosIA: null,
      textoBusqueda: 'espacio logístico zona norte industrial módulo carga distribución ecommerce',
      confianzaIA: 0.87,
      estadoNormalizacionIA: 'COMPLETADA',
      estado: 'ACTIVA',
      creadaEn: new Date().toISOString(),
      actualizadaEn: new Date().toISOString(),
      importadaEn: new Date().toISOString(),
    },
  ]);

  // Importaciones vacías al inicio
  seedIfEmpty('imports', []);

  // Leads vacíos al inicio
  seedIfEmpty('leads', []);

  // Embeddings vacíos (se generan al reindexar)
  seedIfEmpty('embeddings', []);

  console.log('[DB] Base de datos local lista.');
}

// --- CRUD genérico ---

export const db = {
  // Admins
  findAdminByEmail(email) {
    return readTable('admins').find((a) => a.email === email) || null;
  },

  findAdminById(id) {
    return readTable('admins').find((a) => a.id === id) || null;
  },

  // Propiedades
  getProperties(filters = {}) {
    let props = readTable('properties');
    if (filters.zone) {
      props = props.filter((p) => p.zona?.toLowerCase().includes(filters.zone.toLowerCase()));
    }
    if (filters.maxPrice !== undefined) {
      props = props.filter((p) => p.precio <= filters.maxPrice);
    }
    if (filters.currency) {
      props = props.filter((p) => p.moneda === filters.currency);
    }
    if (filters.propertyType) {
      props = props.filter((p) => p.tipoPropiedad === filters.propertyType);
    }
    if (filters.usageType) {
      props = props.filter((p) => p.tipoUsoEspacio === filters.usageType);
    }
    if (filters.minAreaM2 !== undefined) {
      props = props.filter((p) => p.areaM2 !== null && p.areaM2 >= filters.minAreaM2);
    }
    if (filters.aptFor) {
      props = props.filter((p) => p.aptoPara?.some((a) => a.toLowerCase().includes(filters.aptFor.toLowerCase())));
    }
    if (filters.bedrooms !== undefined) {
      props = props.filter((p) => p.cantidadHabitaciones === filters.bedrooms);
    }
    if (filters.hasGarage !== undefined) {
      props = props.filter((p) => p.tieneGaraje === filters.hasGarage);
    }
    if (filters.petsAllowed !== undefined) {
      props = props.filter((p) => p.aceptaMascotas === filters.petsAllowed);
    }
    return props.filter((p) => p.estado === 'ACTIVA');
  },

  getPropertyById(id) {
    return readTable('properties').find((p) => p.id === id) || null;
  },

  createProperty(data) {
    const props = readTable('properties');
    const newProp = {
      id: randomUUID(),
      ...data,
      estado: data.estado || 'ACTIVA',
      confianzaIA: null,
      estadoNormalizacionIA: 'PENDIENTE',
      creadaEn: new Date().toISOString(),
      actualizadaEn: new Date().toISOString(),
      importadaEn: new Date().toISOString(),
    };
    props.push(newProp);
    writeTable('properties', props);
    return newProp;
  },

  updateProperty(id, patch) {
    const props = readTable('properties');
    const idx = props.findIndex((p) => p.id === id);
    if (idx === -1) return null;
    props[idx] = { ...props[idx], ...patch, actualizadaEn: new Date().toISOString() };
    writeTable('properties', props);
    return props[idx];
  },

  // Fuentes
  getSources() {
    return readTable('sources');
  },

  // Importaciones
  getImports() {
    return readTable('imports');
  },

  createImport(data) {
    const imports = readTable('imports');
    const newImport = { id: randomUUID(), ...data, iniciadaEn: new Date().toISOString(), finalizadaEn: null };
    imports.push(newImport);
    writeTable('imports', imports);
    return newImport;
  },

  updateImport(id, patch) {
    const imports = readTable('imports');
    const idx = imports.findIndex((i) => i.id === id);
    if (idx === -1) return null;
    imports[idx] = { ...imports[idx], ...patch };
    writeTable('imports', imports);
    return imports[idx];
  },

  // Leads
  getLeads() {
    return readTable('leads');
  },

  createLead(data) {
    const leads = readTable('leads');
    const newLead = { id: randomUUID(), ...data, estado: 'NUEVO', creadoEn: new Date().toISOString() };
    leads.push(newLead);
    writeTable('leads', leads);
    return newLead;
  },

  // Embeddings (simulados como vectores de palabras clave)
  getEmbeddings() {
    return readTable('embeddings');
  },

  setEmbedding(propertyId, embedding) {
    const embeddings = readTable('embeddings');
    const idx = embeddings.findIndex((e) => e.idPropiedad === propertyId);
    const entry = { idPropiedad: propertyId, embedding, modelo: 'mita-keyword-v1', dimension: embedding.length, creadoEn: new Date().toISOString() };
    if (idx === -1) {
      embeddings.push(entry);
    } else {
      embeddings[idx] = entry;
    }
    writeTable('embeddings', embeddings);
  },

  getAllProperties() {
    return readTable('properties');
  },
};

// Inicializar al importar
initDb();

export { randomUUID };
