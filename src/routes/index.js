import { Router } from 'express';

// Controllers
import { getStatus } from '../controllers/status.controller.js';
import { login, me } from '../controllers/auth.controller.js';
import { getZones, getSearchExamples } from '../controllers/metadata.controller.js';
import { listProperties, getPropertyById, createProperty, patchProperty } from '../controllers/property.controller.js';
import { listSources, listImports, runImport } from '../controllers/import.controller.js';
import { search, compare, enhanceListing } from '../controllers/ai.controller.js';
import { reindex, ragSearchEndpoint } from '../controllers/rag.controller.js';
import { createLead, listLeads } from '../controllers/lead.controller.js';
import { getScenarios } from '../controllers/demo.controller.js';

// Middleware
import { requireAuth } from '../middleware/auth.middleware.js';

const router = Router();

// --- Utilitarios ---
router.get('/', (req, res) => res.json({ name: 'Mita API', version: '0.2.0', status: 'online' }));
router.get('/api/ping', (req, res) => res.send('pong'));
router.get('/api/health', getStatus);

// --- Auth ---
router.post('/api/auth/login', login);
router.get('/api/auth/me', requireAuth, me);

// --- Metadata ---
router.get('/api/metadata/zones', getZones);
router.get('/api/metadata/search-examples', getSearchExamples);

// --- Properties ---
router.get('/api/properties', listProperties);
router.post('/api/properties', requireAuth, createProperty);
router.get('/api/properties/:propertyId', getPropertyById);
router.patch('/api/properties/:propertyId', requireAuth, patchProperty);

// --- Imports ---
router.get('/api/sources', requireAuth, listSources);
router.get('/api/imports', requireAuth, listImports);
router.post('/api/imports/run', requireAuth, runImport);

// --- AI ---
router.post('/api/ai/search', search);
router.post('/api/ai/compare', compare);
router.post('/api/ai/enhance-listing', requireAuth, enhanceListing);

// --- RAG ---
router.post('/api/rag/reindex', requireAuth, reindex);
router.post('/api/rag/search', requireAuth, ragSearchEndpoint);

// --- Leads ---
router.post('/api/leads', createLead);
router.get('/api/leads', requireAuth, listLeads);

// --- Demo ---
router.get('/api/demo/scenarios', getScenarios);

export default router;
