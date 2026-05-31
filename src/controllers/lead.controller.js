/**
 * Controlador de leads de contacto.
 */
import { db } from '../config/db.js';

function buildWhatsappUrl(phone, message) {
  const cleaned = phone.replace(/[^0-9+]/g, '');
  const encoded = encodeURIComponent(message);
  return `https://wa.me/${cleaned}?text=${encoded}`;
}

export const createLead = async (req, res, next) => {
  try {
    const { propertyId, origen, nombreUsuario, telefonoUsuario, mensaje } = req.body;

    if (!propertyId || !origen) {
      return res.status(400).json({ status: 'error', message: 'propertyId y origen son requeridos.' });
    }

    const validOrigens = ['WHATSAPP_CLICK', 'FORMULARIO_CONTACTO', 'DEMO'];
    if (!validOrigens.includes(origen)) {
      return res.status(400).json({ status: 'error', message: `origen debe ser: ${validOrigens.join(', ')}` });
    }

    const property = await db.getPropertyById(propertyId);
    if (!property) {
      return res.status(404).json({ status: 'error', message: 'Propiedad no encontrada.' });
    }

    // Generar mensaje de WhatsApp personalizado
    const whatsappMessage =
      mensaje ||
      `Hola! Me interesa la propiedad "${property.titulo}" en ${property.zona} que vi en Mita. ¿Podría darme más información?`;

    const urlWhatsapp = property.telefonoContacto
      ? buildWhatsappUrl(property.telefonoContacto, whatsappMessage)
      : null;

    const lead = await db.createLead({
      propertyId,
      origen,
      nombreUsuario: nombreUsuario || null,
      telefonoUsuario: telefonoUsuario || null,
      mensaje: whatsappMessage,
      urlWhatsapp,
    });

    res.status(201).json({
      lead: {
        id: lead.id,
        propertyId: lead.idPropiedad,
        urlWhatsapp: lead.urlWhatsapp,
        creadoEn: lead.creadoEn,
      },
    });
  } catch (err) {
    next(err);
  }
};

export const listLeads = async (req, res, next) => {
  try {
    const leads = await db.getLeads();
    res.status(200).json({ data: leads, total: leads.length });
  } catch (err) {
    next(err);
  }
};
