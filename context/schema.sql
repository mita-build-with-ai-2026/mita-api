-- ===========================================================================
-- MITA - SCRIPT DE CREACIÓN DE BASE DE DATOS (POSTGRESQL / SUPABASE)
-- ===========================================================================
-- Este script crea todas las tablas, tipos enums, índices y funciones
-- necesarios para el MVP de Mita, incluyendo la extensión pgvector
-- integrada directamente en la tabla Propiedad.
-- ===========================================================================

-- 1. HABILITAR EXTENSIONES NECESARIAS
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. ELIMINAR TABLAS SI EXISTEN (Para recrear la base de datos limpia)
DROP TABLE IF EXISTS "LeadContacto" CASCADE;
DROP TABLE IF EXISTS "ResultadoBusqueda" CASCADE;
DROP TABLE IF EXISTS "EventoBusqueda" CASCADE;
DROP TABLE IF EXISTS "Propiedad" CASCADE;
DROP TABLE IF EXISTS "ImportacionPropiedades" CASCADE;
DROP TABLE IF EXISTS "FuentePropiedad" CASCADE;
DROP TABLE IF EXISTS "UsuarioAdmin" CASCADE;

-- 3. ELIMINAR ENUMS SI EXISTEN
DROP TYPE IF EXISTS "RolUsuario" CASCADE;
DROP TYPE IF EXISTS "TipoFuente" CASCADE;
DROP TYPE IF EXISTS "EstadoImportacion" CASCADE;
DROP TYPE IF EXISTS "TipoPropiedad" CASCADE;
DROP TYPE IF EXISTS "TipoUsoEspacio" CASCADE;
DROP TYPE IF EXISTS "Moneda" CASCADE;
DROP TYPE IF EXISTS "EstadoPropiedad" CASCADE;
DROP TYPE IF EXISTS "EstadoNormalizacionIA" CASCADE;
DROP TYPE IF EXISTS "FuenteLead" CASCADE;
DROP TYPE IF EXISTS "EstadoLead" CASCADE;

-- 4. CREAR TIPOS ENUMS
CREATE TYPE "RolUsuario" AS ENUM ('ADMIN', 'OPERADOR');
CREATE TYPE "TipoFuente" AS ENUM ('PORTAL', 'FACEBOOK', 'MANUAL', 'DEMO', 'HTML_CACHE', 'OTRO');
CREATE TYPE "EstadoImportacion" AS ENUM ('PENDIENTE', 'EJECUTANDO', 'COMPLETADA', 'FALLIDA', 'PARCIAL');
CREATE TYPE "TipoPropiedad" AS ENUM (
  'DEPARTAMENTO', 'GARZONIER', 'CASA', 'HABITACION', 'MONOAMBIENTE', 
  'OFICINA', 'LOCAL_COMERCIAL', 'DEPOSITO', 'GALPON', 'TALLER', 
  'ESPACIO_LOGISTICO', 'TERRENO', 'OTRO'
);
CREATE TYPE "TipoUsoEspacio" AS ENUM ('RESIDENCIAL', 'COMERCIAL', 'INDUSTRIAL', 'LOGISTICO', 'OFICINA', 'MIXTO', 'OTRO');
CREATE TYPE "Moneda" AS ENUM ('USD', 'BOB');
CREATE TYPE "EstadoPropiedad" AS ENUM ('ACTIVA', 'INACTIVA', 'RESERVADA', 'ALQUILADA');
CREATE TYPE "EstadoNormalizacionIA" AS ENUM ('PENDIENTE', 'COMPLETADA', 'FALLIDA', 'PARCIAL');
CREATE TYPE "FuenteLead" AS ENUM ('WHATSAPP_CLICK', 'FORMULARIO_CONTACTO', 'DEMO');
CREATE TYPE "EstadoLead" AS ENUM ('NUEVO', 'CONTACTADO', 'DESCARTADO');

-- 5. CREAR TABLA: UsuarioAdmin
CREATE TABLE "UsuarioAdmin" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "nombre" VARCHAR(150) NOT NULL,
  "email" VARCHAR(150) UNIQUE NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "rol" "RolUsuario" NOT NULL DEFAULT 'OPERADOR',
  "activo" BOOLEAN NOT NULL DEFAULT TRUE,
  "creadoEn" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ultimoAccesoEn" TIMESTAMP
);

-- 6. CREAR TABLA: FuentePropiedad
CREATE TABLE "FuentePropiedad" (
  "id" SERIAL PRIMARY KEY,
  "nombre" VARCHAR(100) NOT NULL,
  "urlBase" TEXT,
  "tipoFuente" "TipoFuente" NOT NULL DEFAULT 'OTRO',
  "activo" BOOLEAN NOT NULL DEFAULT TRUE,
  "creadoEn" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 7. CREAR TABLA: ImportacionPropiedades
CREATE TABLE "ImportacionPropiedades" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "idFuente" INTEGER REFERENCES "FuentePropiedad"("id") ON DELETE CASCADE,
  "idUsuarioAdmin" UUID REFERENCES "UsuarioAdmin"("id") ON DELETE SET NULL,
  "estado" "EstadoImportacion" NOT NULL DEFAULT 'PENDIENTE',
  "urlSolicitada" TEXT,
  "totalEncontrados" INTEGER NOT NULL DEFAULT 0,
  "totalImportados" INTEGER NOT NULL DEFAULT 0,
  "totalFallidos" INTEGER NOT NULL DEFAULT 0,
  "mensajeError" TEXT,
  "iniciadaEn" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finalizadaEn" TIMESTAMP
);

-- 8. CREAR TABLA: Propiedad (Con embedding optimizado integrado de 768 dimensiones para Gemini)
CREATE TABLE "Propiedad" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "titulo" VARCHAR(255) NOT NULL,
  "descripcion" TEXT,
  
  -- Clasificación
  "tipoPropiedad" "TipoPropiedad" NOT NULL,
  "tipoUsoEspacio" "TipoUsoEspacio" NOT NULL,
  
  -- Ubicación
  "ciudad" VARCHAR(100) NOT NULL DEFAULT 'Santa Cruz de la Sierra',
  "zona" VARCHAR(120) NOT NULL,
  "direccionTexto" TEXT,
  "latitud" NUMERIC(10,7),
  "longitud" NUMERIC(10,7),
  
  -- Precios (Precalculados a BOB para filtros uniformes en backend)
  "precio" NUMERIC(12,2) NOT NULL,
  "moneda" "Moneda" NOT NULL,
  "precioBs" NUMERIC(12,2) NOT NULL,
  
  -- Características físicas y operativas
  "cantidadHabitaciones" INTEGER,
  "cantidadBanos" INTEGER,
  "areaM2" NUMERIC(10,2),
  "tieneGaraje" BOOLEAN NOT NULL DEFAULT FALSE,
  "estaAmoblada" BOOLEAN NOT NULL DEFAULT FALSE,
  "aceptaMascotas" BOOLEAN NOT NULL DEFAULT FALSE,
  "expensasIncluidas" BOOLEAN NOT NULL DEFAULT FALSE,
  "montoExpensas" NUMERIC(12,2),
  
  -- Estructura de metadatos flexibles (JSONB)
  "comodidades" JSONB NOT NULL DEFAULT '[]'::jsonb,                 -- ej: ["aire acondicionado", "churrasquera"]
  "aptoPara" JSONB NOT NULL DEFAULT '[]'::jsonb,                    -- ej: ["cafeteria", "tienda", "oficina"]
  "caracteristicasOperativas" JSONB NOT NULL DEFAULT '{}'::jsonb,   -- ej: {"accesoCamion": true, "trifasica": true}
  "requisitosFaltantes" JSONB NOT NULL DEFAULT '[]'::jsonb,         -- ej: ["metros cuadrados", "permiso comercial"]
  
  -- Contacto original
  "nombreContacto" VARCHAR(150),
  "telefonoContacto" VARCHAR(50),
  
  -- Información de la fuente / Importación
  "idFuente" INTEGER REFERENCES "FuentePropiedad"("id") ON DELETE SET NULL,
  "idImportacion" UUID REFERENCES "ImportacionPropiedades"("id") ON DELETE SET NULL,
  "urlFuente" TEXT,
  "idExternoFuente" VARCHAR(255),
  "hashFuente" VARCHAR(255),
  "urlImagen" TEXT,
  
  -- Textos para indexación y AI processing
  "textoCrudo" TEXT,
  "datosCrudos" JSONB,
  "datosExtraidosIA" JSONB,
  "textoBusqueda" TEXT,
  
  -- Estado e Inteligencia Artificial
  "confianzaIA" NUMERIC(5,4),
  "estadoNormalizacionIA" "EstadoNormalizacionIA" NOT NULL DEFAULT 'PENDIENTE',
  "estado" "EstadoPropiedad" NOT NULL DEFAULT 'ACTIVA',
  
  -- Embedding optimizado integrado (768 dimensiones para Gemini text-embedding-004)
  "embedding" vector(768),
  "modeloEmbedding" VARCHAR(100),
  
  -- Trazabilidad temporal
  "creadaEn" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "actualizadaEn" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "importadaEn" TIMESTAMP
);

-- 9. CREAR TABLA: EventoBusqueda (Registro analítico para auditorías y RAG performance)
CREATE TABLE "EventoBusqueda" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "consultaCruda" TEXT NOT NULL,
  "criteriosExtraidos" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "cantidadResultados" INTEGER NOT NULL DEFAULT 0,
  "usoRag" BOOLEAN NOT NULL DEFAULT FALSE,
  "usoIA" BOOLEAN NOT NULL DEFAULT FALSE,
  "modeloIA" VARCHAR(100),
  "tiempoRespuestaMs" INTEGER,
  "creadoEn" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 10. CREAR TABLA: ResultadoBusqueda (Cache y explicaciones personalizadas)
CREATE TABLE "ResultadoBusqueda" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "idEventoBusqueda" UUID REFERENCES "EventoBusqueda"("id") ON DELETE CASCADE,
  "idPropiedad" UUID REFERENCES "Propiedad"("id") ON DELETE CASCADE,
  "puntajeCoincidencia" INTEGER NOT NULL, -- matchScore de 0 a 100
  "similitudRag" NUMERIC(10,6),           -- Distancia coseno obtenida en RAG
  "resumen" TEXT,
  "razones" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "advertencias" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "informacionFaltante" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "recomendacion" TEXT,
  "etiquetaCorta" VARCHAR(100),           -- ej: "Mejor opción para tu cafetería"
  "posicionRanking" INTEGER,
  "creadoEn" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 11. CREAR TABLA: LeadContacto
CREATE TABLE "LeadContacto" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "idPropiedad" UUID REFERENCES "Propiedad"("id") ON DELETE CASCADE,
  "origen" "FuenteLead" NOT NULL,
  "nombreUsuario" VARCHAR(150) NOT NULL,
  "telefonoUsuario" VARCHAR(50) NOT NULL,
  "mensaje" TEXT,
  "urlWhatsapp" TEXT,
  "estado" "EstadoLead" NOT NULL DEFAULT 'NUEVO',
  "creadoEn" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ===========================================================================
-- 12. TRIGGERS PARA ACTUALIZACIÓN DE FECHAS (actualizadaEn)
-- ===========================================================================

CREATE OR REPLACE FUNCTION update_actualizada_en_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW."actualizadaEn" = NOW();
   RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_propiedad_actualizada_en
BEFORE UPDATE ON "Propiedad"
FOR EACH ROW
EXECUTE PROCEDURE update_actualizada_en_column();

-- ===========================================================================
-- 13. ÍNDICES DE BASE DE DATOS PARA VELOCIDAD Y RENDIMIENTO (INDEXES)
-- ===========================================================================

-- Índices de filtrado recurrente en Propiedad
CREATE INDEX idx_propiedad_estado ON "Propiedad"("estado");
CREATE INDEX idx_propiedad_tipo_uso ON "Propiedad"("tipoPropiedad", "tipoUsoEspacio");
CREATE INDEX idx_propiedad_precio_bs ON "Propiedad"("precioBs");
CREATE INDEX idx_propiedad_zona ON "Propiedad"("zona");

-- Índices para búsqueda semántica Cosine Distance (pgvector)
-- Nota: HNSW se usa para indexar embeddings y mejorar la búsqueda semántica rápida
CREATE INDEX idx_propiedad_embedding ON "Propiedad" USING hnsw ("embedding" vector_cosine_ops);

-- Índices de relaciones (Foreign Keys)
CREATE INDEX idx_resultado_busqueda_evento ON "ResultadoBusqueda"("idEventoBusqueda");
CREATE INDEX idx_resultado_busqueda_propiedad ON "ResultadoBusqueda"("idPropiedad");
CREATE INDEX idx_lead_propiedad ON "LeadContacto"("idPropiedad");
CREATE INDEX idx_importacion_fuente ON "ImportacionPropiedades"("idFuente");
