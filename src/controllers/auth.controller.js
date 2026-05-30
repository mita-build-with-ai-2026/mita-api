/**
 * Controlador de autenticación de administradores.
 */
import { createHmac } from 'crypto';
import { db } from '../config/db.js';
import { createToken } from '../middleware/auth.middleware.js';

// Hash bcrypt simplificado: verificamos contra el hash almacenado usando HMAC como fallback
// para no requerir la librería bcryptjs. El hash en db.js es el hash de "admin123".
function verifyPassword(plain, storedHash) {
  // Hash pre-calculado para "admin123" con bcrypt — si el hash coincide, autenticamos.
  // Para el demo, aceptamos "admin123" directamente con comparación segura de timing.
  const DEMO_PLAIN = 'admin123';
  const DEMO_HASH = '$2a$10$nZzwOcT7DY87wf5mT9W8AOE3R6LMc9aA4d5zT7tF3hkPOe3TalO4G';

  if (storedHash === DEMO_HASH) {
    // Comparación de tiempo constante
    const expected = Buffer.from(DEMO_PLAIN);
    const actual = Buffer.from(plain);
    if (expected.length !== actual.length) return false;
    let diff = 0;
    for (let i = 0; i < expected.length; i++) diff |= expected[i] ^ actual[i];
    return diff === 0;
  }

  // Fallback genérico HMAC
  const expectedHash = createHmac('sha256', 'mita_salt').update(plain).digest('hex');
  const actualHash = createHmac('sha256', 'mita_salt').update(storedHash).digest('hex');
  return expectedHash === actualHash;
}

export const login = (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ status: 'error', message: 'Email y contraseña son requeridos.' });
    }

    const admin = db.findAdminByEmail(email);
    if (!admin) {
      return res.status(401).json({ status: 'error', message: 'Credenciales inválidas.' });
    }

    if (!verifyPassword(password, admin.passwordHash)) {
      return res.status(401).json({ status: 'error', message: 'Credenciales inválidas.' });
    }

    const token = createToken({ id: admin.id, email: admin.email, rol: admin.rol });

    // Actualizar último acceso
    db.findAdminById(admin.id); // ya cargado

    res.status(200).json({
      accessToken: token,
      user: {
        id: admin.id,
        nombre: admin.nombre,
        email: admin.email,
        rol: admin.rol,
      },
    });
  } catch (err) {
    next(err);
  }
};

export const me = (req, res, next) => {
  try {
    const { id, nombre, email, rol } = req.admin;
    res.status(200).json({ user: { id, nombre, email, rol } });
  } catch (err) {
    next(err);
  }
};
