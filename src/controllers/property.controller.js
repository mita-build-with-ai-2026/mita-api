/**
 * Controlador de propiedades de Mita.
 */
import { db } from '../config/db.js';

export const listProperties = async (req, res, next) => {
  try {
    const {
      zone,
      maxPrice,
      currency,
      propertyType,
      usageType,
      minAreaM2,
      aptFor,
      bedrooms,
      hasGarage,
      petsAllowed,
    } = req.query;

    const filters = {};
    if (zone) filters.zone = zone;
    if (maxPrice !== undefined) filters.maxPrice = parseFloat(maxPrice);
    if (currency) filters.currency = currency;
    if (propertyType) filters.propertyType = propertyType;
    if (usageType) filters.usageType = usageType;
    if (minAreaM2 !== undefined) filters.minAreaM2 = parseFloat(minAreaM2);
    if (aptFor) filters.aptFor = aptFor;
    if (bedrooms !== undefined) filters.bedrooms = parseInt(bedrooms);
    if (hasGarage !== undefined) filters.hasGarage = hasGarage === 'true';
    if (petsAllowed !== undefined) filters.petsAllowed = petsAllowed === 'true';

    const properties = await db.getProperties(filters);

    res.status(200).json({
      data: properties,
      total: properties.length,
    });
  } catch (err) {
    next(err);
  }
};

export const getPropertyById = async (req, res, next) => {
  try {
    const { propertyId } = req.params;
    const property = await db.getPropertyById(propertyId);
    if (!property) {
      return res.status(404).json({ status: 'error', message: 'Propiedad no encontrada.' });
    }
    res.status(200).json({ property });
  } catch (err) {
    next(err);
  }
};

export const createProperty = async (req, res, next) => {
  try {
    const required = ['titulo', 'tipoPropiedad', 'ciudad', 'zona', 'precio', 'moneda'];
    const missing = required.filter((f) => req.body[f] === undefined || req.body[f] === null || req.body[f] === '');
    if (missing.length > 0) {
      return res.status(400).json({ status: 'error', message: `Campos requeridos faltantes: ${missing.join(', ')}` });
    }

    const property = await db.createProperty({
      ...req.body,
      idFuente: req.body.idFuente || 1,
    });

    res.status(201).json({ property });
  } catch (err) {
    next(err);
  }
};

export const patchProperty = async (req, res, next) => {
  try {
    const { propertyId } = req.params;
    const updated = await db.updateProperty(propertyId, req.body);
    if (!updated) {
      return res.status(404).json({ status: 'error', message: 'Propiedad no encontrada.' });
    }
    res.status(200).json({ property: updated });
  } catch (err) {
    next(err);
  }
};
