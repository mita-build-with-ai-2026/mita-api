/**
 * Controlador de importaciones de propiedades.
 */
import { db, randomUUID } from '../config/db.js';
import { aiEnhanceListing, buildKeywordEmbedding } from '../config/aiEngine.js';

// Datos de ejemplo que simula un scraper/importador
const DEMO_RAW_LISTINGS = [
  'alquilo local zona norte 800$ ideal negocio avenida transitada baño privado consultas whatsapp',
  'deposito 300m2 acceso camion galpon zona industrial precio a convenir',
  'oficina equipetrol amoblada 2 ambientes parqueo incluido 650 dolares',
  'local galeria sirari 45m2 500$ flujo personas apto emprendimiento gastronomico',
  'taller mecanico av alemana 200m2 900 usd trifasica fosa',
];

export const listSources = (req, res, next) => {
  try {
    res.status(200).json({ data: db.getSources(), total: db.getSources().length });
  } catch (err) {
    next(err);
  }
};

export const listImports = (req, res, next) => {
  try {
    res.status(200).json({ data: db.getImports(), total: db.getImports().length });
  } catch (err) {
    next(err);
  }
};

export const runImport = (req, res, next) => {
  try {
    const { sourceId, url, limit = 5 } = req.body;

    if (!sourceId) {
      return res.status(400).json({ status: 'error', message: 'sourceId es requerido.' });
    }

    const source = db.getSources().find((s) => s.id === sourceId);
    if (!source) {
      return res.status(404).json({ status: 'error', message: 'Fuente no encontrada.' });
    }

    // Crear registro de importación
    const importRecord = db.createImport({
      id: randomUUID(),
      idFuente: sourceId,
      idUsuarioAdmin: req.admin?.id || null,
      estado: 'EJECUTANDO',
      urlSolicitada: url || source.urlBase,
      totalEncontrados: 0,
      totalImportados: 0,
      totalFallidos: 0,
      mensajeError: null,
    });

    // Simular importación procesando listings demo con el motor IA
    const listings = DEMO_RAW_LISTINGS.slice(0, Math.min(limit, DEMO_RAW_LISTINGS.length));
    let importados = 0;
    let fallidos = 0;

    for (const rawText of listings) {
      try {
        const enhanced = aiEnhanceListing(rawText);
        const draft = enhanced.propertyDraft;

        // Solo crear si tiene info suficiente
        if (draft.tipoPropiedad && (draft.zona !== 'No especificada' || draft.precio)) {
          db.createProperty({
            titulo: draft.titulo,
            descripcion: enhanced.descripcionLimpia,
            tipoPropiedad: draft.tipoPropiedad || 'OTRO',
            tipoUsoEspacio: draft.tipoUsoEspacio || 'OTRO',
            ciudad: 'Santa Cruz de la Sierra',
            zona: draft.zona || 'No especificada',
            precio: draft.precio,
            moneda: draft.moneda || 'USD',
            areaM2: draft.areaM2,
            aptoPara: draft.aptoPara || [],
            caracteristicasOperativas: draft.caracteristicasOperativas || {},
            requisitosFaltantes: enhanced.informacionFaltante || [],
            textoCrudo: rawText,
            datosExtraidosIA: draft,
            estadoNormalizacionIA: 'COMPLETADA',
            idFuente: sourceId,
            idImportacion: importRecord.id,
            telefonoContacto: null,
            nombreContacto: null,
          });
          importados++;
        } else {
          fallidos++;
        }
      } catch (e) {
        fallidos++;
      }
    }

    // Actualizar registro de importación
    const finalRecord = db.updateImport(importRecord.id, {
      estado: fallidos === listings.length ? 'FALLIDA' : importados > 0 && fallidos > 0 ? 'PARCIAL' : 'COMPLETADA',
      totalEncontrados: listings.length,
      totalImportados: importados,
      totalFallidos: fallidos,
      finalizadaEn: new Date().toISOString(),
    });

    // Regenerar embeddings para propiedades nuevas
    const allProps = db.getAllProperties();
    const existingEmbeddings = db.getEmbeddings().map((e) => e.idPropiedad);
    for (const prop of allProps) {
      if (!existingEmbeddings.includes(prop.id)) {
        const embedding = buildKeywordEmbedding(prop);
        db.setEmbedding(prop.id, embedding);
      }
    }

    res.status(201).json(finalRecord);
  } catch (err) {
    next(err);
  }
};
