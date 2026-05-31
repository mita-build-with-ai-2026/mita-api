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
  if (token === 'mock-jwt-token-mita-ai-2026') {
    throw new Error('Se detectó el token de simulación (mock-jwt-token-mita-ai-2026) que no es válido en el backend real. Por favor, limpie el almacenamiento local (localStorage) del navegador o cierre sesión e inicie sesión de nuevo para generar un token válido.');
  }
  if (token === 'su_token_jwt_aqui') {
    throw new Error('Se recibió el valor de plantilla "su_token_jwt_aqui" desde Postman. Ejecute primero la petición POST /api/auth/login (Admin Login) en Postman para que el script actualice la variable global/entorno {{token}}, o copie el accessToken de la respuesta y péguelo manualmente en sus variables.');
  }
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error(`El token no tiene los 3 componentes del formato JWT (encontrados ${parts.length} componentes). Asegúrese de copiar el token completo.`);
  }
  const [header, payload, signature] = parts;
  const expectedSig = createHmac('sha256', secret).update(`${header}.${payload}`).digest('base64url');
  if (expectedSig !== signature) {
    throw new Error('La firma digital del token no coincide (Firma inválida). Esto ocurre si el JWT_SECRET cambió o el token fue alterado.');
  }
  let decoded;
  try {
    decoded = JSON.parse(base64urlDecode(payload));
  } catch (e) {
    throw new Error(`El payload del token no se pudo decodificar como JSON válido: ${e.message}`);
  }
  if (decoded.exp < Math.floor(Date.now() / 1000)) {
    throw new Error('El token de sesión ha expirado.');
  }
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

export const requireAuth = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  try {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      const msg = 'Token de autorización requerido en la cabecera Authorization con formato Bearer.';
      if (req.log) {
        req.log.warn(`Autenticación fallida: Cabecera Authorization incorrecta o ausente. Recibido: "${authHeader}"`);
      } else {
        console.warn(`[WARN] Autenticación fallida: Cabecera Authorization incorrecta o ausente. Recibido: "${authHeader}"`);
      }
      return res.status(401).json({ status: 'error', message: msg });
    }
    
    // Separar usando expresiones regulares para tolerar múltiples espacios
    const parts = authHeader.trim().split(/\s+/);
    if (parts.length < 2 || parts[0].toLowerCase() !== 'bearer') {
      const msg = 'Formato de cabecera Authorization incorrecto. Debe ser "Bearer <token>".';
      if (req.log) {
        req.log.warn(`Autenticación fallida: Formato de Bearer incorrecto. Recibido: "${authHeader}"`);
      } else {
        console.warn(`[WARN] Autenticación fallida: Formato de Bearer incorrecto. Recibido: "${authHeader}"`);
      }
      return res.status(401).json({ status: 'error', message: msg });
    }
    
    const token = parts[1].trim();
    const decoded = verifyToken(token);
    
    const admin = await db.findAdminById(decoded.id);
    if (!admin || !admin.activo) {
      const msg = 'Usuario administrador no encontrado o inactivo.';
      if (req.log) {
        req.log.warn(`Autenticación fallida: Admin no encontrado o inactivo para el ID: ${decoded.id}`);
      } else {
        console.warn(`[WARN] Autenticación fallida: Admin no encontrado o inactivo para el ID: ${decoded.id}`);
      }
      return res.status(401).json({ status: 'error', message: msg });
    }
    
    req.admin = admin;
    next();
  } catch (err) {
    if (req.log) {
      req.log.warn(`Autenticación fallida (excepción): ${err.message}. Header recibido: "${authHeader}"`);
    } else {
      console.warn(`[WARN] Autenticación fallida (excepción): ${err.message}. Header recibido: "${authHeader}"`);
    }
    return res.status(401).json({ status: 'error', message: `Token inválido: ${err.message}` });
  }
};
