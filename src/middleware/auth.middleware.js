/**
 * Middleware de autenticación JWT para Mita API.
 * Implementado con crypto nativo de Node.js (sin dependencias externas).
 */
import { createHmac } from 'crypto';
import { config } from '../config/env.js';
import { db } from '../config/db.js';

// --- JWT manual (HS256) usando crypto nativo ---

function base64urlEncode(str) {
  return Buffer.from(str).toString('base64url');
}

function base64urlDecode(str) {
  return Buffer.from(str, 'base64url').toString('utf-8');
}

function sign(payload, secret, expiresInSeconds = 604800) {
  const header = base64urlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const now = Math.floor(Date.now() / 1000);
  const fullPayload = base64urlEncode(JSON.stringify({ ...payload, iat: now, exp: now + expiresInSeconds }));
  const signature = createHmac('sha256', secret).update(`${header}.${fullPayload}`).digest('base64url');
  return `${header}.${fullPayload}.${signature}`;
}

function verify(token, secret) {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Token inválido');
  const [header, payload, signature] = parts;
  const expectedSig = createHmac('sha256', secret).update(`${header}.${payload}`).digest('base64url');
  if (expectedSig !== signature) throw new Error('Firma inválida');
  const decoded = JSON.parse(base64urlDecode(payload));
  if (decoded.exp < Math.floor(Date.now() / 1000)) throw new Error('Token expirado');
  return decoded;
}

// --- Exportar funciones de JWT ---

export function createToken(payload) {
  const seconds = 7 * 24 * 60 * 60; // 7 días
  return sign(payload, config.jwtSecret, seconds);
}

export function verifyToken(token) {
  return verify(token, config.jwtSecret);
}

// --- Middleware requireAuth ---

export const requireAuth = (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ status: 'error', message: 'Token de autorización requerido.' });
    }
    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);
    const admin = db.findAdminById(decoded.id);
    if (!admin || !admin.activo) {
      return res.status(401).json({ status: 'error', message: 'Usuario no autorizado.' });
    }
    req.admin = admin;
    next();
  } catch (err) {
    return res.status(401).json({ status: 'error', message: `Token inválido: ${err.message}` });
  }
};
