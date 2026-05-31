import * as cheerio from 'cheerio';

const DEFAULT_IMAGE_URL = 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=800&q=80';
const DEFAULT_TIMEOUT_MS = 15000;
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

const PROPERTY_LINK_HINTS = [
  'alquiler',
  'venta',
  'anticretico',
  'anticrético',
  'inmueble',
  'propiedad',
  'departamento',
  'apartamento',
  'casa',
  'oficina',
  'local',
  'comercial',
  'deposito',
  'depósito',
  'galpon',
  'galpón',
  'terreno',
  'lote',
  'monoambiente',
  'garzonier'
];

const PROPERTY_TEXT_HINTS = [
  ...PROPERTY_LINK_HINTS,
  'm2',
  'm²',
  'dorm',
  'baño',
  'bano',
  'parqueo',
  'garaje',
  'usd',
  'us$',
  '$us',
  'bs',
  'whatsapp',
  'contactar'
];

const IGNORED_LINK_HINTS = [
  'mailto:',
  'tel:',
  'javascript:',
  '#',
  '/login',
  '/registro',
  '/register',
  '/publicar',
  '/contact',
  '/contacto',
  '/terminos',
  '/privacidad',
  '/privacy',
  '/blog',
  '/noticia',
  '/news',
  '/cdn-cgi/',
  'facebook.com/sharer',
  'twitter.com/intent',
  'wa.me/',
  'whatsapp'
];

const IGNORED_EXTENSIONS = /\.(?:jpg|jpeg|png|webp|gif|svg|pdf|zip|rar|mp4|mp3|avi|mov)(?:$|\?)/i;

function normalizeWhitespace(value = '') {
  return String(value).replace(/\s+/g, ' ').trim();
}

function normalizeForMatch(value = '') {
  return normalizeWhitespace(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function truncate(value, maxLength) {
  const text = normalizeWhitespace(value);
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

function resolveUrl(value, baseUrl) {
  if (!value) return null;
  const firstSrc = String(value).split(',')[0].trim().split(/\s+/)[0];
  if (!firstSrc || firstSrc.startsWith('data:') || firstSrc.startsWith('blob:')) return null;
  try {
    const resolved = new URL(firstSrc, baseUrl);
    resolved.hash = '';
    return resolved.toString();
  } catch {
    return null;
  }
}

function uniqueStrings(values, limit = 50) {
  const seen = new Set();
  const output = [];
  for (const value of values) {
    const normalized = normalizeWhitespace(value);
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(normalized);
    if (output.length >= limit) break;
  }
  return output;
}

function uniqueByUrl(items, limit = 80) {
  const seen = new Set();
  const output = [];
  for (const item of items) {
    if (!item?.url) continue;
    const key = item.url.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(item);
    if (output.length >= limit) break;
  }
  return output;
}

function safeJsonStringify(value, maxLength = 2500) {
  try {
    return truncate(JSON.stringify(value), maxLength);
  } catch {
    return '';
  }
}

function flattenJsonLd(value, output = []) {
  if (!value) return output;
  if (Array.isArray(value)) {
    value.forEach((item) => flattenJsonLd(item, output));
    return output;
  }
  if (typeof value !== 'object') return output;

  if (Array.isArray(value['@graph'])) {
    flattenJsonLd(value['@graph'], output);
  }
  if (Array.isArray(value.itemListElement)) {
    flattenJsonLd(value.itemListElement, output);
  }
  if (value.item && typeof value.item === 'object') {
    flattenJsonLd(value.item, output);
  }
  output.push(value);
  return output;
}

function compactJsonLdItem(item, baseUrl) {
  if (!item || typeof item !== 'object') return null;
  const type = Array.isArray(item['@type']) ? item['@type'].join(', ') : item['@type'];
  const image = Array.isArray(item.image) ? item.image[0] : item.image?.url || item.image;
  const offers = Array.isArray(item.offers) ? item.offers[0] : item.offers;
  const address = typeof item.address === 'object'
    ? [
        item.address.streetAddress,
        item.address.addressLocality,
        item.address.addressRegion,
        item.address.addressCountry
      ].filter(Boolean).join(', ')
    : item.address;

  const compact = {
    type,
    name: item.name || item.headline || item.title,
    description: item.description,
    url: resolveUrl(item.url || item['@id'], baseUrl),
    image: resolveUrl(image, baseUrl),
    address,
    price: offers?.price || item.price || item.rentPrice,
    priceCurrency: offers?.priceCurrency || item.priceCurrency,
    floorSize: item.floorSize?.value || item.floorSize,
    numberOfRooms: item.numberOfRooms || item.numberOfBedrooms,
    telephone: item.telephone || item.phone
  };

  if (!Object.values(compact).some(Boolean)) return null;
  return compact;
}

function extractJsonLd($, baseUrl) {
  const parsed = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).contents().text();
    if (!raw) return;
    try {
      const data = JSON.parse(raw.trim());
      parsed.push(...flattenJsonLd(data));
    } catch {
      // Some sites ship malformed JSON-LD. Ignore it and continue with HTML signals.
    }
  });

  const compact = parsed
    .map((item) => compactJsonLdItem(item, baseUrl))
    .filter(Boolean)
    .filter((item, index, arr) => {
      const key = [item.url, item.name, item.price].filter(Boolean).join('|').toLowerCase();
      return key && arr.findIndex((candidate) => [candidate.url, candidate.name, candidate.price].filter(Boolean).join('|').toLowerCase() === key) === index;
    })
    .slice(0, 60);

  return compact;
}

function extractMetadata($, baseUrl) {
  const canonical = resolveUrl($('link[rel="canonical"]').attr('href'), baseUrl);
  const h1 = uniqueStrings($('h1').map((_, el) => $(el).text()).get(), 5);
  const h2 = uniqueStrings($('h2').map((_, el) => $(el).text()).get(), 8);

  return {
    title: truncate($('title').first().text(), 220),
    canonicalUrl: canonical,
    metaDescription: truncate($('meta[name="description"]').attr('content'), 500),
    ogTitle: truncate($('meta[property="og:title"]').attr('content'), 220),
    ogType: truncate($('meta[property="og:type"]').attr('content'), 100),
    h1,
    h2,
    lang: $('html').attr('lang') || null
  };
}

function extractImages($, baseUrl) {
  const candidates = [
    $('meta[property="og:image"]').attr('content'),
    $('meta[name="twitter:image"]').attr('content')
  ];

  $('img').each((_, el) => {
    const src =
      $(el).attr('src') ||
      $(el).attr('data-src') ||
      $(el).attr('data-lazy-src') ||
      $(el).attr('srcset') ||
      $(el).attr('data-srcset');
    candidates.push(src);
  });

  return uniqueStrings(
    candidates
      .map((src) => resolveUrl(src, baseUrl))
      .filter((src) => src && !/logo|avatar|icon|sprite|placeholder/i.test(src)),
    30
  );
}

function extractContactHints($, text, baseUrl) {
  const whatsappLinks = uniqueStrings(
    $('a[href]').map((_, el) => {
      const href = $(el).attr('href') || '';
      if (!/wa\.me|whatsapp/i.test(href)) return null;
      return resolveUrl(href, baseUrl) || href;
    }).get(),
    20
  );

  const emailMatches = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [];
  const phoneMatches = text.match(/(?:\+?591[\s.-]?)?(?:[2367]\d[\s.-]?){3,5}\d/g) || [];
  const phones = phoneMatches
    .map((phone) => phone.replace(/[^\d+]/g, ''))
    .filter((phone) => phone.replace(/\D/g, '').length >= 7);

  return {
    phones: uniqueStrings(phones, 20),
    emails: uniqueStrings(emailMatches, 20),
    whatsappLinks
  };
}

function extractNumericHints(text) {
  const prices = uniqueStrings(
    [
      ...(text.match(/(?:us\$|\$us|\$|usd)\s*[\d.,]+/gi) || []),
      ...(text.match(/[\d.,]+\s*(?:us\$|\$us|usd|d[oó]lares|bs\.?|bob|bolivianos)/gi) || [])
    ],
    25
  );
  const areas = uniqueStrings(text.match(/\b\d{1,6}(?:[.,]\d{1,2})?\s*(?:m2|m²|metros cuadrados|mts2)\b/gi) || [], 25);
  return { prices, areas };
}

function linkScore(url, label, pageHost) {
  const normalizedUrl = normalizeForMatch(url);
  const normalizedLabel = normalizeForMatch(label);
  if (!url || IGNORED_EXTENSIONS.test(url)) return 0;
  if (IGNORED_LINK_HINTS.some((hint) => normalizedUrl.includes(normalizeForMatch(hint)))) return 0;

  let score = 0;
  let pathname = '';
  for (const hint of PROPERTY_LINK_HINTS) {
    const normalizedHint = normalizeForMatch(hint);
    if (normalizedUrl.includes(normalizedHint)) score += 3;
    if (normalizedLabel.includes(normalizedHint)) score += 2;
  }
  if (/(?:us\$|\$us|\$|usd|bs\.?|bob)\s*\d/i.test(label)) score += 3;
  if (/\d+\s*(?:m2|m²|metros)/i.test(label)) score += 2;
  try {
    const parsed = new URL(url);
    pathname = parsed.pathname;
    if (parsed.hostname === pageHost) score += 2;
    if (parsed.pathname.split('/').filter(Boolean).length >= 2) score += 1;
  } catch {
    return 0;
  }

  const hasLongNumericId = /\/\d{6,}(?:$|[/?#])/.test(pathname);
  const looksLikeCategory = /\/(?:alquiler|venta|anticretico|anticr[eé]tico)\/[a-z0-9-]+(?:\/[a-z0-9-]+){0,3}\/?$/i.test(pathname);

  if (hasLongNumericId) score += 8;
  if (looksLikeCategory && !hasLongNumericId) score -= 5;
  if (/\/pagina\d+\/?$/i.test(pathname)) return 0;

  return score;
}

function extractListingLinks($, baseUrl) {
  const pageHost = new URL(baseUrl).hostname;
  const links = [];
  $('a[href]').each((_, el) => {
    const rawHref = $(el).attr('href');
    const url = resolveUrl(rawHref, baseUrl);
    const label = truncate($(el).text() || $(el).attr('title') || $(el).attr('aria-label') || '', 280);
    const score = linkScore(url, label, pageHost);
    if (score <= 0) return;
    links.push({
      url,
      label,
      score
    });
  });

  return uniqueByUrl(
    links
      .sort((a, b) => b.score - a.score)
      .filter((link) => link.score >= 4),
    120
  );
}

function extractPaginationLinks($, baseUrl) {
  const pageHost = new URL(baseUrl).hostname;
  const links = [];

  $('a[href]').each((_, el) => {
    const rawHref = $(el).attr('href');
    const url = resolveUrl(rawHref, baseUrl);
    if (!url || IGNORED_EXTENSIONS.test(url)) return;

    const label = normalizeWhitespace($(el).text() || $(el).attr('aria-label') || $(el).attr('title') || '');
    const normalizedUrl = normalizeForMatch(url);
    const normalizedLabel = normalizeForMatch(label);
    let score = 0;

    if (/pagina|page|p=|offset|desde|next|siguiente/.test(normalizedUrl)) score += 3;
    if (/siguiente|next|pagina|page|\b\d+\b/.test(normalizedLabel)) score += 2;

    try {
      const parsed = new URL(url);
      if (parsed.hostname !== pageHost) return;
    } catch {
      return;
    }

    if (score > 0) {
      links.push({ url, label, score });
    }
  });

  return uniqueByUrl(
    links
      .sort((a, b) => b.score - a.score)
      .filter((link) => link.score >= 2),
    30
  );
}

function blockScore(text) {
  const normalized = normalizeForMatch(text);
  let score = 0;
  for (const hint of PROPERTY_TEXT_HINTS) {
    if (normalized.includes(normalizeForMatch(hint))) score += 1;
  }
  if (/(?:us\$|\$us|\$|usd|bs\.?|bob)\s*\d/i.test(text)) score += 3;
  if (/\d+\s*(?:m2|m²|metros)/i.test(text)) score += 2;
  if (/\+?591|whatsapp|contactar/i.test(text)) score += 2;
  return score;
}

function extractCandidateBlocks($, baseUrl) {
  const selectors = [
    'article',
    '[itemtype*="schema.org"]',
    '[class*="card" i]',
    '[class*="listing" i]',
    '[class*="property" i]',
    '[class*="propiedad" i]',
    '[class*="inmueble" i]',
    '[class*="result" i]',
    '[class*="item" i]',
    '[data-testid*="listing" i]',
    '[data-testid*="property" i]'
  ];

  const blocks = [];
  $(selectors.join(',')).each((_, el) => {
    const $el = $(el);
    const text = truncate($el.text(), 2200);
    if (text.length < 45) return;
    const score = blockScore(text);
    if (score < 4) return;

    const link = resolveUrl($el.find('a[href]').first().attr('href'), baseUrl);
    const image = resolveUrl(
      $el.find('img').first().attr('src') ||
      $el.find('img').first().attr('data-src') ||
      $el.find('img').first().attr('srcset'),
      baseUrl
    );
    blocks.push({
      text,
      link,
      image,
      score
    });
  });

  const seen = new Set();
  return blocks
    .sort((a, b) => b.score - a.score)
    .filter((block) => {
      const key = normalizeForMatch(block.text.slice(0, 250));
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 60);
}

function buildScrapeSummary(scrape) {
  return {
    title: scrape.metadata?.title || scrape.metadata?.ogTitle || null,
    url: scrape.url,
    textLength: scrape.text?.length || 0,
    jsonLdItems: scrape.jsonLd?.length || 0,
    listingLinks: scrape.listingLinks?.length || 0,
    paginationLinks: scrape.paginationLinks?.length || 0,
    candidateBlocks: scrape.candidateBlocks?.length || 0,
    phonesFound: scrape.contactHints?.phones?.length || 0,
    emailsFound: scrape.contactHints?.emails?.length || 0,
    pricesFound: scrape.numericHints?.prices?.length || 0,
    areasFound: scrape.numericHints?.areas?.length || 0
  };
}

export const scraperService = {
  async scrapeUrl(url, options = {}) {
    try {
      const targetUrl = resolveUrl(url, url);
      if (!targetUrl) {
        throw new Error('URL inválida');
      }

      console.log(`[Scraper] Iniciando scraping de la URL: ${targetUrl}`);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), options.timeoutMs || DEFAULT_TIMEOUT_MS);

      const response = await fetch(targetUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent': options.userAgent || USER_AGENT,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'es-BO,es;q=0.9,en;q=0.7'
        }
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Error HTTP! Estado: ${response.status}`);
      }

      const contentType = response.headers.get('content-type') || '';
      if (contentType && !contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
        throw new Error(`Contenido no HTML: ${contentType}`);
      }

      const html = await response.text();
      const $ = cheerio.load(html);
      const metadata = extractMetadata($, targetUrl);
      const images = extractImages($, targetUrl);
      const jsonLd = extractJsonLd($, targetUrl);
      const listingLinks = extractListingLinks($, targetUrl);
      const paginationLinks = extractPaginationLinks($, targetUrl);
      const candidateBlocks = extractCandidateBlocks($, targetUrl);

      $('script, style, iframe, noscript, svg, header, footer, nav, link, meta').remove();
      const textContent = normalizeWhitespace($('body').text());
      const contactHints = extractContactHints($, textContent, targetUrl);
      const numericHints = extractNumericHints(textContent);
      const imageUrl = images[0] || jsonLd.find((item) => item.image)?.image || DEFAULT_IMAGE_URL;

      const result = {
        url: targetUrl,
        success: true,
        html: html.substring(0, 15000),
        text: textContent,
        imageUrl,
        images,
        metadata,
        jsonLd,
        listingLinks,
        paginationLinks,
        candidateBlocks,
        contactHints,
        numericHints,
        stats: null
      };
      result.stats = buildScrapeSummary(result);
      return result;
    } catch (error) {
      console.error(`[Scraper] Error al hacer scraping en ${url}:`, error.message);

      if (String(url).includes('demo') || String(url).includes('mita.ai') || String(url).includes('inmobiliaria')) {
        return this.getMockScrapeResult(url);
      }

      return {
        url,
        success: false,
        error: error.message,
        text: `No se pudo acceder a la URL: ${error.message}`,
        imageUrl: DEFAULT_IMAGE_URL,
        images: [],
        metadata: {},
        jsonLd: [],
        listingLinks: [],
        paginationLinks: [],
        candidateBlocks: [],
        contactHints: { phones: [], emails: [], whatsappLinks: [] },
        numericHints: { prices: [], areas: [] },
        stats: null
      };
    }
  },

  getMockScrapeResult(url) {
    console.log(`[Scraper] Usando resultado demo simulado para: ${url}`);

    let text = 'Local comercial en alquiler Zona Norte. Excelente local comercial sobre la Av. Banzer en Zona Norte de Santa Cruz. Ideal para cafetería, heladería o tienda comercial. Cuenta con 80m2 de construcción, baño privado, amplio parqueo para clientes y portón trasero para carga/descarga. Precio: $750/mes, expensas incluidas.';
    let html = `<html><body><div><h1>Local comercial en alquiler Zona Norte</h1><p>${text}</p></div></body></html>`;
    let imageUrl = 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=800&q=80';

    if (String(url).includes('deposito') || String(url).includes('galpon')) {
      text = 'Se alquila amplio galpón de 300m2 en el Parque Industrial de Santa Cruz. Apto para depósito o industria ligera. Cuenta con acceso directo para camiones de alto tonelaje, portón corredizo de 5 metros de altura, energía trifásica y pequeña oficina administrativa con baño. Precio: $1200 dólares al mes.';
      html = `<html><body><div><h1>Galpón en alquiler - Parque Industrial</h1><p>${text}</p></div></body></html>`;
      imageUrl = 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=800&q=80';
    } else if (String(url).includes('oficina')) {
      text = 'Oficina premium en alquiler en Equipetrol. 65m2 distribuidos en 2 ambientes privados, recepción, baño y cocineta. Edificio moderno con seguridad 24 horas, control de accesos, parqueo privado subterráneo y aire acondicionado central. Precio: $650 USD/mes.';
      html = `<html><body><div><h1>Oficina premium en alquiler en Equipetrol</h1><p>${text}</p></div></body></html>`;
      imageUrl = 'https://images.unsplash.com/photo-1497366811353-6870744d04b2?auto=format&fit=crop&w=800&q=80';
    }

    const result = {
      url,
      success: true,
      html,
      text,
      imageUrl,
      images: [imageUrl],
      metadata: { title: 'Demo Mita', h1: ['Demo Mita'], h2: [] },
      jsonLd: [],
      listingLinks: [],
      paginationLinks: [],
      candidateBlocks: [{ text, link: url, image: imageUrl, score: 10 }],
      contactHints: { phones: [], emails: [], whatsappLinks: [] },
      numericHints: extractNumericHints(text),
      stats: null
    };
    result.stats = buildScrapeSummary(result);
    return result;
  }
};
