import pg from 'pg';
import { config } from './env.js';
import { randomUUID } from 'crypto';

const pool = new pg.Pool({
  connectionString: config.databaseUrl,
  ssl: { rejectUnauthorized: false }
});

console.log('[DB] Conectando a PostgreSQL...');

// Asegurar que exista la tabla para embeddings simulados
async function initDb() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "EmbeddingsSimulados" (
        "idPropiedad" UUID PRIMARY KEY REFERENCES "Propiedad"("id") ON DELETE CASCADE,
        "embedding" JSONB NOT NULL,
        "modelo" VARCHAR(100) NOT NULL,
        "dimension" INTEGER NOT NULL,
        "creadoEn" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('[DB] Tabla de embeddings simulados verificada/creada.');
  } catch (err) {
    console.error('[DB] Error al inicializar tablas auxiliares:', err);
  }
}

initDb();

export const db = {
  // Admins
  async findAdminByEmail(email) {
    const res = await pool.query('SELECT * FROM "UsuarioAdmin" WHERE "email" = $1', [email]);
    return res.rows[0] || null;
  },

  async findAdminById(id) {
    const res = await pool.query('SELECT * FROM "UsuarioAdmin" WHERE "id" = $1', [id]);
    return res.rows[0] || null;
  },

  // Propiedades
  async getProperties(filters = {}) {
    let query = 'SELECT * FROM "Propiedad" WHERE "estado" = \'ACTIVA\'';
    const values = [];
    let paramCount = 1;

    if (filters.zone) {
      query += ` AND "zona" ILIKE $${paramCount++}`;
      values.push(`%${filters.zone}%`);
    }
    if (filters.maxPrice !== undefined) {
      query += ` AND "precio" <= $${paramCount++}`;
      values.push(filters.maxPrice);
    }
    if (filters.currency) {
      query += ` AND "moneda" = $${paramCount++}`;
      values.push(filters.currency);
    }
    if (filters.propertyType) {
      query += ` AND "tipoPropiedad" = $${paramCount++}`;
      values.push(filters.propertyType);
    }
    if (filters.usageType) {
      query += ` AND "tipoUsoEspacio" = $${paramCount++}`;
      values.push(filters.usageType);
    }
    if (filters.minAreaM2 !== undefined) {
      query += ` AND "areaM2" >= $${paramCount++}`;
      values.push(filters.minAreaM2);
    }
    if (filters.aptFor) {
      query += ` AND "aptoPara"::text ILIKE $${paramCount++}`;
      values.push(`%${filters.aptFor}%`);
    }
    if (filters.bedrooms !== undefined) {
      query += ` AND "cantidadHabitaciones" = $${paramCount++}`;
      values.push(filters.bedrooms);
    }
    if (filters.hasGarage !== undefined) {
      query += ` AND "tieneGaraje" = $${paramCount++}`;
      values.push(filters.hasGarage);
    }
    if (filters.petsAllowed !== undefined) {
      query += ` AND "aceptaMascotas" = $${paramCount++}`;
      values.push(filters.petsAllowed);
    }

    const res = await pool.query(query, values);
    return res.rows;
  },

  async getPropertyById(id) {
    const res = await pool.query('SELECT * FROM "Propiedad" WHERE "id" = $1', [id]);
    return res.rows[0] || null;
  },

  async createProperty(data) {
    const id = randomUUID();
    const precioBs = data.moneda === 'USD' ? data.precio * 6.9 : data.precio;

    const query = `
      INSERT INTO "Propiedad" (
        "id", "titulo", "descripcion", "tipoPropiedad", "tipoUsoEspacio", "ciudad", "zona", "direccionTexto",
        "latitud", "longitud", "precio", "moneda", "precioBs", "cantidadHabitaciones", "cantidadBanos", "areaM2",
        "tieneGaraje", "estaAmoblada", "aceptaMascotas", "expensasIncluidas", "montoExpensas", "comodidades",
        "aptoPara", "caracteristicasOperativas", "requisitosFaltantes", "nombreContacto", "telefonoContacto",
        "idFuente", "idImportacion", "urlFuente", "idExternoFuente", "hashFuente", "urlImagen", "textoCrudo",
        "datosCrudos", "datosExtraidosIA", "textoBusqueda", "confianzaIA", "estadoNormalizacionIA", "estado"
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35, $36, $37, $38, $39, $40
      ) RETURNING *
    `;

    const values = [
      id,
      data.titulo,
      data.descripcion || null,
      data.tipoPropiedad,
      data.tipoUsoEspacio || 'OTRO',
      data.ciudad || 'Santa Cruz de la Sierra',
      data.zona,
      data.direccionTexto || null,
      data.latitud !== undefined ? data.latitud : null,
      data.longitud !== undefined ? data.longitud : null,
      data.precio,
      data.moneda,
      precioBs,
      data.cantidadHabitaciones !== undefined ? data.cantidadHabitaciones : null,
      data.cantidadBanos !== undefined ? data.cantidadBanos : null,
      data.areaM2 !== undefined ? data.areaM2 : null,
      data.tieneGaraje || false,
      data.estaAmoblada || false,
      data.aceptaMascotas || false,
      data.expensasIncluidas || false,
      data.montoExpensas !== undefined ? data.montoExpensas : null,
      data.comodidades ? JSON.stringify(data.comodidades) : '[]',
      data.aptoPara ? JSON.stringify(data.aptoPara) : '[]',
      data.caracteristicasOperativas ? JSON.stringify(data.caracteristicasOperativas) : '{}',
      data.requisitosFaltantes ? JSON.stringify(data.requisitosFaltantes) : '[]',
      data.nombreContacto || null,
      data.telefonoContacto || null,
      data.idFuente || null,
      data.idImportacion || null,
      data.urlFuente || null,
      data.idExternoFuente || null,
      data.hashFuente || null,
      data.urlImagen || null,
      data.textoCrudo || null,
      data.datosCrudos ? JSON.stringify(data.datosCrudos) : null,
      data.datosExtraidosIA ? JSON.stringify(data.datosExtraidosIA) : null,
      data.textoBusqueda || null,
      data.confianzaIA !== undefined ? data.confianzaIA : null,
      data.estadoNormalizacionIA || 'PENDIENTE',
      data.estado || 'ACTIVA'
    ];

    const res = await pool.query(query, values);
    return res.rows[0];
  },

  async updateProperty(id, patch) {
    const fields = [];
    const values = [];
    let paramCount = 1;

    // Obtener propiedad existente si necesitamos calcular precioBs
    let precio = patch.precio;
    let moneda = patch.moneda;

    if ((precio !== undefined && moneda === undefined) || (moneda !== undefined && precio === undefined)) {
      const existing = await this.getPropertyById(id);
      if (existing) {
        if (precio === undefined) precio = existing.precio;
        if (moneda === undefined) moneda = existing.moneda;
      }
    }

    if (precio !== undefined && moneda !== undefined) {
      const precioBs = moneda === 'USD' ? precio * 6.9 : precio;
      fields.push(`"precioBs" = $${paramCount++}`);
      values.push(precioBs);
    }

    for (const [key, val] of Object.entries(patch)) {
      // Evitar sobreescribir campos especiales manualmente de forma errónea
      if (key === 'precioBs') continue;

      if (['comodidades', 'aptoPara', 'caracteristicasOperativas', 'requisitosFaltantes', 'datosCrudos', 'datosExtraidosIA'].includes(key)) {
        fields.push(`"${key}" = $${paramCount++}`);
        values.push(val ? JSON.stringify(val) : null);
      } else {
        fields.push(`"${key}" = $${paramCount++}`);
        values.push(val);
      }
    }

    if (fields.length === 0) {
      return this.getPropertyById(id);
    }

    values.push(id);
    const query = `UPDATE "Propiedad" SET ${fields.join(', ')} WHERE "id" = $${paramCount} RETURNING *`;
    const res = await pool.query(query, values);
    return res.rows[0] || null;
  },

  // Fuentes
  async getSources() {
    const res = await pool.query('SELECT * FROM "FuentePropiedad"');
    return res.rows;
  },

  // Importaciones
  async getImports() {
    const res = await pool.query(`
      SELECT i.*, 
             COALESCE(f."nombre", 'Descubrimiento Automático') AS "fuente",
             i."iniciadaEn" AS "fecha"
      FROM "ImportacionPropiedades" i
      LEFT JOIN "FuentePropiedad" f ON i."idFuente" = f."id"
      ORDER BY i."iniciadaEn" DESC
    `);
    return res.rows;
  },

  async createImport(data) {
    const id = data.id || randomUUID();
    const query = `
      INSERT INTO "ImportacionPropiedades" (
        "id", "idFuente", "idUsuarioAdmin", "estado", "urlSolicitada",
        "totalEncontrados", "totalImportados", "totalFallidos", "mensajeError", "iniciadaEn", "finalizadaEn"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *
    `;
    const values = [
      id,
      data.idFuente,
      data.idUsuarioAdmin || null,
      data.estado || 'PENDIENTE',
      data.urlSolicitada || null,
      data.totalEncontrados || 0,
      data.totalImportados || 0,
      data.totalFallidos || 0,
      data.mensajeError || null,
      data.iniciadaEn || new Date().toISOString(),
      data.finalizadaEn || null
    ];
    const res = await pool.query(query, values);
    return res.rows[0];
  },

  async updateImport(id, patch) {
    const fields = [];
    const values = [];
    let paramCount = 1;

    for (const [key, val] of Object.entries(patch)) {
      fields.push(`"${key}" = $${paramCount++}`);
      values.push(val);
    }

    if (fields.length === 0) {
      const res = await pool.query('SELECT * FROM "ImportacionPropiedades" WHERE "id" = $1', [id]);
      return res.rows[0] || null;
    }

    values.push(id);
    const query = `UPDATE "ImportacionPropiedades" SET ${fields.join(', ')} WHERE "id" = $${paramCount} RETURNING *`;
    const res = await pool.query(query, values);
    return res.rows[0] || null;
  },

  // Leads
  async getLeads() {
    const res = await pool.query(`
      SELECT l.*, l."idPropiedad" AS "propertyId", p."titulo" AS "propertyTitulo", p."zona" AS "propertyZona", p."precio" AS "propertyPrecio"
      FROM "LeadContacto" l
      LEFT JOIN "Propiedad" p ON l."idPropiedad" = p."id"
    `);
    return res.rows;
  },

  async createLead(data) {
    const id = randomUUID();
    const query = `
      INSERT INTO "LeadContacto" (
        "id", "idPropiedad", "origen", "nombreUsuario", "telefonoUsuario", "mensaje", "urlWhatsapp", "estado", "creadoEn"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *
    `;
    const values = [
      id,
      data.propertyId,
      data.origen,
      data.nombreUsuario || null,
      data.telefonoUsuario || null,
      data.mensaje || null,
      data.urlWhatsapp || null,
      data.estado || 'NUEVO',
      data.creadoEn || new Date().toISOString()
    ];
    const res = await pool.query(query, values);
    return res.rows[0];
  },

  // Embeddings simulados
  async getEmbeddings() {
    const res = await pool.query('SELECT * FROM "EmbeddingsSimulados"');
    return res.rows.map(row => ({
      idPropiedad: row.idPropiedad,
      embedding: row.embedding,
      modelo: row.modelo,
      dimension: row.dimension,
      creadoEn: row.creadoEn
    }));
  },

  async setEmbedding(propertyId, embedding) {
    const query = `
      INSERT INTO "EmbeddingsSimulados" ("idPropiedad", "embedding", "modelo", "dimension", "creadoEn")
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT ("idPropiedad") DO UPDATE 
      SET "embedding" = EXCLUDED."embedding", "modelo" = EXCLUDED."modelo", "dimension" = EXCLUDED."dimension", "creadoEn" = EXCLUDED."creadoEn"
    `;
    await pool.query(query, [
      propertyId,
      JSON.stringify(embedding),
      'mita-keyword-v1',
      embedding.length,
      new Date().toISOString()
    ]);
  },

  async getAllProperties() {
    const res = await pool.query('SELECT * FROM "Propiedad"');
    return res.rows;
  },

  async createSearchEvent(data) {
    const id = randomUUID();
    const query = `
      INSERT INTO "EventoBusqueda" (
        "id", "consultaCruda", "criteriosExtraidos", "cantidadResultados", "usoRag", "usoIA", "modeloIA", "tiempoRespuestaMs"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *
    `;
    const values = [
      id,
      data.consultaCruda,
      data.criteriosExtraidos ? JSON.stringify(data.criteriosExtraidos) : '{}',
      data.cantidadResultados || 0,
      data.usoRag || false,
      data.usoIA || false,
      data.modeloIA || null,
      data.tiempoRespuestaMs || null
    ];
    const res = await pool.query(query, values);
    return res.rows[0];
  },

  async createSearchResult(data) {
    const id = randomUUID();
    const query = `
      INSERT INTO "ResultadoBusqueda" (
        "id", "idEventoBusqueda", "idPropiedad", "puntajeCoincidencia", "similitudRag", "resumen", "razones", "advertencias", "informacionFaltante", "recomendacion", "etiquetaCorta", "posicionRanking"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *
    `;
    const values = [
      id,
      data.idEventoBusqueda,
      data.idPropiedad,
      data.puntajeCoincidencia,
      data.similitudRag !== undefined ? data.similitudRag : null,
      data.resumen || null,
      data.razones ? JSON.stringify(data.razones) : '[]',
      data.advertencias ? JSON.stringify(data.advertencias) : '[]',
      data.informacionFaltante ? JSON.stringify(data.informacionFaltante) : '[]',
      data.recomendacion || null,
      data.etiquetaCorta || null,
      data.posicionRanking !== undefined ? data.posicionRanking : null
    ];
    const res = await pool.query(query, values);
    return res.rows[0];
  },

  async searchByEmbedding(embedding, limit = 10) {
    const vectorStr = '[' + embedding.join(',') + ']';
    const query = `
      SELECT *, (1 - ("embedding" <=> $1::vector)) AS "similitud"
      FROM "Propiedad"
      WHERE "estado" = 'ACTIVA' AND "embedding" IS NOT NULL
      ORDER BY "embedding" <=> $1::vector ASC
      LIMIT $2
    `;
    const res = await pool.query(query, [vectorStr, limit]);
    return res.rows;
  },

  async updatePropertyEmbedding(id, embedding, model = 'gemini-embedding-2') {
    const vectorStr = '[' + embedding.join(',') + ']';
    const query = `
      UPDATE "Propiedad"
      SET "embedding" = $1::vector, "modeloEmbedding" = $2, "actualizadaEn" = NOW()
      WHERE "id" = $3
      RETURNING *
    `;
    const res = await pool.query(query, [vectorStr, model, id]);
    return res.rows[0] || null;
  },

  async createSource(data) {
    await pool.query(`
      SELECT setval(
        pg_get_serial_sequence('"FuentePropiedad"', 'id'),
        COALESCE((SELECT MAX("id") FROM "FuentePropiedad"), 1),
        true
      )
    `);
    const query = `
      INSERT INTO "FuentePropiedad" (
        "nombre", "urlBase", "tipoFuente", "activo"
      ) VALUES ($1, $2, $3, $4) RETURNING *
    `;
    const values = [
      data.nombre,
      data.urlBase,
      data.tipoFuente || 'OTRO',
      data.activo !== undefined ? data.activo : true
    ];
    const res = await pool.query(query, values);
    return res.rows[0];
  },

  async closePool() {
    await pool.end();
    console.log('[DB] Conexiones cerradas.');
  }
};

export { randomUUID };
