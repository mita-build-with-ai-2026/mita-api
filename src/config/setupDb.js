import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { PORTAL_SEED_SOURCES } from './scraperSources.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const schemaPath = path.join(__dirname, '../../context/schema.sql');

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('DATABASE_URL no está configurada en las variables de entorno.');
  process.exit(1);
}

async function run() {
  console.log('Iniciando conexión con Supabase...');
  const pool = new pg.Pool({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('Leyendo schema.sql...');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');

    console.log('Ejecutando schema.sql en la base de datos...');
    await pool.query(schemaSql);
    console.log('Schema creado exitosamente.');

    // Seed de Datos Iniciales (Solo estructura basica)
    console.log('Insertando datos semilla esenciales...');

    // 1. Usuario Admin
    const adminId = '11111111-1111-1111-1111-111111111111';
    await pool.query(`
      INSERT INTO "UsuarioAdmin" (id, nombre, email, "passwordHash", rol, activo)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (email) DO NOTHING
    `, [
      adminId,
      'Admin Mita',
      'admin@mita.ai',
      '$2a$10$nZzwOcT7DY87wf5mT9W8AOE3R6LMc9aA4d5zT7tF3hkPOe3TalO4G', // hash de "admin123"
      'ADMIN',
      true
    ]);
    console.log('Usuario Admin insertado.');

    // 2. Fuentes de propiedades
    await pool.query(`
      INSERT INTO "FuentePropiedad" (id, nombre, "urlBase", "tipoFuente", activo)
      VALUES 
        (1, 'Demo Mita', 'https://demo.mita.ai', 'DEMO', true),
        (2, 'Facebook Marketplace SCZ', 'https://facebook.com/marketplace/santa-cruz', 'FACEBOOK', true)
      ON CONFLICT (id) DO NOTHING
    `);
    await pool.query(`
      SELECT setval(
        pg_get_serial_sequence('"FuentePropiedad"', 'id'),
        COALESCE((SELECT MAX("id") FROM "FuentePropiedad"), 1),
        true
      )
    `);
    for (const source of PORTAL_SEED_SOURCES) {
      await pool.query(`
        INSERT INTO "FuentePropiedad" (nombre, "urlBase", "tipoFuente", activo)
        SELECT $1, $2, $3, true
        WHERE NOT EXISTS (
          SELECT 1 FROM "FuentePropiedad" WHERE "urlBase" = $2
        )
      `, [
        source.nombre,
        source.urlBase,
        source.tipoFuente || 'PORTAL'
      ]);
    }
    console.log('Fuentes de propiedades insertadas.');

  } catch (err) {
    console.error('Error al inicializar la base de datos:', err);
    process.exit(1);
  } finally {
    await pool.end();
    console.log('Conexión cerrada.');
  }
}

run();
