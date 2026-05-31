# Mita API - Backend de Inteligencia Artificial Inmobiliaria

Mita API es el backend del MVP de Mita, una plataforma inteligente para digitalizar y automatizar el mercado de inmuebles industriales y comerciales en Santa Cruz de la Sierra, Bolivia. Permite normalizar anuncios informales mediante IA, realizar búsquedas semanticas avanzadas con pgvector y Gemini API, comparar inmuebles a nivel tecnico, descubrir nuevas fuentes publicas con Google Search Grounding y analizar enlaces de ofertas en tiempo real.

---

## Tecnologias y Arquitectura

- **Core**: Node.js + Express (ES Modules)
- **Base de Datos**: PostgreSQL (Supabase) con pgvector y el controlador nativo pg
- **SDK de IA**: @google/genai (SDK oficial de Gemini)
- **Modelos de IA**: gemini-3.5-flash (extraccion, clasificacion y razonamiento), gemini-embedding-2 (embeddings vectoriales de 768 dimensiones)
- **Scraping**: Cheerio (parser de HTML de alto rendimiento)
- **Autenticacion**: JWT personalizado usando la libreria crypto nativa de Node.js
- **Arquitectura**: Controladores async/await, servicios centralizados (Gemini Client, AI Service, Scraper Service), y fallbacks robustos basados en algoritmos lexicos locales en caso de fallar o no contar con credenciales de la API de Gemini.

---

## Estructura del Proyecto

```text
mita-api/
├── context/               # Documentacion, diagramas UML y definicion de base de datos
├── data/                  # Historial de respaldos y archivos JSON locales de configuracion
├── src/
│   ├── config/            # Configuraciones globales de entorno, base de datos e IA
│   │   ├── aiEngine.js    # Motor de busqueda conversacional local y NLP (fallback)
│   │   ├── db.js          # Conexion principal y consultas PostgreSQL/Supabase
│   │   ├── env.js         # Validacion y carga de variables de entorno del sistema
│   │   └── setupDb.js     # Script de inicializacion del esquema SQL
│   ├── controllers/       # Controladores de negocio y manejo de endpoints
│   ├── middleware/        # Middlewares (autenticacion JWT, control de errores, logger)
│   ├── routes/            # Definicion y mapeo de rutas Express
│   ├── services/          # Servicios integradores (Gemini API, Scraper, AI helpers)
│   │   ├── ai.service.js      # Capa de integracion centralizada de IA y fallbacks
│   │   ├── gemini.client.js   # Wrapper del SDK oficial de Google GenAI
│   │   └── scraper.service.js # Scraper de paginas web con Cheerio
│   ├── app.js             # Configuracion global de Express
│   └── server.js          # Punto de entrada y graceful shutdown
├── .env.example           # Plantilla de variables de entorno
└── package.json           # Dependencias y scripts de ejecucion
```

---

## Instalacion y Configuracion

### 1. Requisitos Previos

- Node.js (version 18 o superior)
- Instancia activa de PostgreSQL (Supabase) con la extension pgvector habilitada

### 2. Clonacion e Instalacion de Dependencias

Ingresa al directorio del backend e instala las librerias necesarias:

```bash
cd mita-api
npm install
```

### 3. Configuracion del Archivo de Entorno

Copia la plantilla .env.example como un archivo .env en la raiz de mita-api:

```bash
cp .env.example .env
```

Define las siguientes variables de configuracion en tu archivo .env:

```env
PORT=3000
NODE_ENV=development
JWT_SECRET=tu_secreto_para_jwt
DATABASE_URL=postgresql://postgres.[PROYECTO_ID]:[PASSWORD]@aws-1-us-east-1.pooler.supabase.com:5432/postgres
GEMINI_API_KEY=tu_api_key_de_gemini
```

---

## Despliegue de Esquema e Inicializacion

Para crear todas las tablas, enums, indices (incluyendo el indice HNSW para pgvector) y poblar la base de datos con los datos demo iniciales:

```bash
npm run setup-db
```

---

## Ejecucion del Servidor

### Modo Desarrollo (con recarga automatica)
```bash
npm run dev
```

### Modo Produccion
```bash
npm start
```

---

## Documentacion de Endpoints Principales

### Utilidades y Salud
- GET /api/health - Verifica el estado de conexion de la API y la base de datos.
- GET /api/ping - Respuesta rapida ("pong") para test de latencia.

### Autenticacion (JWT)
- POST /api/auth/login - Permite el inicio de sesion del administrador. Retorna el token JWT.
- GET /api/auth/me - Retorna los datos del usuario logueado en base al token de cabecera Authorization: Bearer.

### Propiedades
- GET /api/properties - Lista las propiedades activas con filtrado dinamico (zona, precio, tipo, uso, area, etc.).
- GET /api/properties/:propertyId - Obtiene una propiedad especifica por su ID.
- POST /api/properties - Registra una nueva propiedad en la base de datos (con conversion automatica a Bs). [Requiere Autenticacion]
- PATCH /api/properties/:propertyId - Actualiza campos de una propiedad. [Requiere Autenticacion]

### Inteligencia Artificial (IA / RAG)
- POST /api/ai/search - Realiza busquedas conversacionales (usa extractCriteria y explainResults de Gemini, y registra busquedas en EventoBusqueda y ResultadoBusqueda).
- POST /api/ai/compare - Recibe una consulta y entre 2 y 3 IDs de inmuebles para generar una comparacion tecnica detallada con Gemini.
- POST /api/ai/enhance-listing - Estructura publicaciones informales en JSON limpio. [Requiere Autenticacion]
- POST /api/ai/discover-sources - Descubre paginas y portales activos con Google Search Grounding y agrega fuentes semilla curadas de Bolivia. [Requiere Autenticacion]
- POST /api/ai/analyze-urls - Analiza URLs, extrae JSON-LD/metadatos/tarjetas, recorre paginacion y fichas candidatas, y devuelve ofertas estructuradas. Acepta `crawlListings`, `maxPagesPerUrl`, `maxListingLinksPerUrl`, `maxPaginationPagesPerUrl` y `maxProperties`. [Requiere Autenticacion]
- POST /api/rag/reindex - Genera embeddings vectoriales reales (768 dimensiones) para pgvector o fallbacks lexicos. [Requiere Autenticacion]
- POST /api/rag/search - Busqueda semantica utilizando similitud de coseno en base de datos. [Requiere Autenticacion]

### Leads e Importacion
- POST /api/leads - Registra el contacto de un interesado y genera el link pre-construido de WhatsApp.
- POST /api/imports/run - Ejecuta importaciones desde fuentes configuradas. Usa `limit` como limite de propiedades/fichas a recorrer, guarda la mayor cantidad de campos disponibles y genera embeddings. [Requiere Autenticacion]
- POST /api/imports/auto-discover-and-import - Combina portales semilla, fuentes registradas y descubrimiento con Gemini para importar en masa. Acepta `urlLimit`, `perUrlLimit` e `includeSeedSources`. [Requiere Autenticacion]
