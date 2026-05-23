/**
 * PortugalGeek - Monitor / Scraper Amazon.es para gerar publicações
 * ------------------------------------------------------------------
 * Usa Playwright com perfil persistente ./perfil-amazon.
 *
 * Instalação:
 *   npm i playwright
 *   npx playwright install chromium
 *
 * Primeiro login/teste:
 *   node amazon-publicacao-monitor-completo.js
 *
 * Edita PRODUCT_URLS abaixo com os links Amazon a testar.
 *
 * Saídas:
 *   publicacoes-geradas.txt
 *   resultado-scraping-amazon.json
 */

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

// =====================================================
// CONFIGURAÇÃO
// =====================================================

const PRODUCT_URLS = [
  'https://www.amazon.es/dp/B0GTM1R6CJ?tag=portugalgeek-21',
];

const ASSOC_TAG = 'portugalgeek-21';
const PROFILE_DIR = './perfil-amazon';
const HEADLESS = false;

const OUTPUT_TXT = path.resolve('publicacoes-geradas.txt');
const OUTPUT_JSON = path.resolve('resultado-scraping-amazon.json');

// Segurança: o script NUNCA deve clicar no botão final de compra.
const NEVER_CLICK_SELECTORS = [
  'input[name="placeYourOrder1"]',
  '#placeYourOrder',
  '[data-testid="place-order-button"]',
  'input[aria-labelledby*="submitOrderButtonId"]',
];

const UNIT_PROMO_TEXTS = [
  'Poupe 70% em 1 na compra de2',
  'Poupe 50% em 1 na compra de2',
  'Obtenha 3 pelo preço de 2',
];

// =====================================================
// SELETORES BASEADOS NOS TEUS TEXT BLAZE
// =====================================================

const SELECTORS = {
  title: '#productTitle',
  bullets: '#feature-bullets li, #feature-bullets ul li',
  breadcrumbs: '#wayfinding-breadcrumbs_feature_div li, #wayfinding-breadcrumbs_feature_div a',

  price: [
    '#corePrice_feature_div .a-price .a-offscreen',
    '#corePriceDisplay_desktop_feature_div .a-price .a-offscreen',
    '#priceblock_ourprice',
    '#priceblock_dealprice',
    '#price_inside_buybox',
    '.apexPriceToPay .a-offscreen',
    '.priceToPay .a-offscreen',
    '#sns-base-price .a-price .a-offscreen',
  ],

  snsPrice: [
    '#sns-base-price > div > div > div > span.a-price.a-text-normal.aok-align-center.reinventPriceAccordionT2 > span.a-offscreen',
    '#sns-base-price .a-price .a-offscreen',
  ],

  pvp: [
    '#corePriceDisplay_desktop_feature_div .basisPrice .apex-basisprice-value > span.a-offscreen',
    '#corePriceDisplay_desktop_feature_div > div:nth-child(5) > span > span.aok-relative > span.a-size-small.a-color-secondary.aok-align-center.basisPrice > span > span:nth-child(2)',
    '#corePriceDisplay_desktop_feature_div > div.a-section.a-spacing-none.aok-align-center.aok-relative.apex-core-price-identifier > div.apex-savings-basis-container > div.apex-basis-row > span.aok-relative > span.a-size-small.a-color-secondary.basisPrice > span > span:nth-child(2)',
    '#corePriceDisplay_desktop_feature_div > div:nth-child(4) > span > span.aok-relative > span.a-size-small.a-color-secondary.aok-align-center.basisPrice > span > span:nth-child(2)',
    '#corePriceDisplay_desktop_feature_div > div.a-section.a-spacing-small.aok-align-center > span > span.aok-relative > span > span > span.a-offscreen',
    '#listPrice .a-offscreen',
    '.basisPrice .a-offscreen',
    '#corePrice_feature_div .a-price .a-offscreen',
    '#keepa-medio-valor',
  ],

  primeExclusive: [
    '#primeExclusivePricingMessage > span',
    '#primeAccessMessage > div > div:nth-child(1) > span',
    '#primeAccessMessage span',
  ],

  primeDayBadge: [
    '#dealBadgeSupportingText > span',
  ],

  category: '.pg-cat',
  subcategory: '.pg-subcat',

  addToCart: [
    '#add-to-cart-button',
    'input[name="submit.add-to-cart"]',
    '#submit.add-to-cart',
  ],

  buyNow: [
    '#buy-now-button',
    'input[name="submit.buy-now"]',
    '#submit\\.buy-now input',
    'input[title*="Comprar já"]',
    'input[title*="Comprar ahora"]',
    'input[aria-labelledby*="submit.buy-now"]',
  ],

  cart: [
    '#nav-cart',
    'a[href*="/cart"]',
  ],

  checkout: [
    'input[name="proceedToRetailCheckout"]',
    'input[data-feature-id="proceed-to-checkout-action"]',
    '#sc-buy-box-ptc-button input',
    'a[name="proceedToRetailCheckout"]',
  ],

  removeFromCart: [
    'input[value="Eliminar"]',
    'input[aria-label*="Eliminar"]',
    'input[data-action="delete"]',
    '.sc-action-delete input',
    'span[data-action="delete"] input',
  ],


  subscribeAndSave: {
    option: [
      'button:has-text("Subscreva e poupe")',
      'button:has-text("Subscreve e Poupe")',
      'button:has-text("Suscríbete y ahorra")',
      '#snsAccordionRowMiddle',
      '#snsAccordionRow',
      '[data-a-accordion-row-name*="sns"]',
      'input[value="sns"]',
      'label:has-text("Suscríbete y ahorra")',
      'label:has-text("Subscreve e Poupe")',
      'span:has-text("Suscríbete y ahorra")',
      'span:has-text("Subscreve e Poupe")',
    ],
    quantityDropdown: [
      '#quantity',
      'select#quantity',
      'select[name="quantity"]',
      'select[id="quantity"]',
      'select[name*="quantity"]',
      'select[id*="quantity"]',
      '#selectQuantity select',
      '#quantityRelocate_feature_div select',
    ],
    submit: [
      '#rcx-subscribe-submit-button-announce',
      'button#rcx-subscribe-submit-button-announce',
      '#rcx-subscribe-submit-button',
      '#rcx-subscribe-submit-button button',
      'button:has-text("Subscrever")',
      'button:has-text("Suscribirse")',
      'input[name="submit.subscribe-now"]',
      'input[value*="Suscribirse"]',
      'input[value*="Subscrever"]',
      'span:has-text("Suscribirse ahora")',
      'span:has-text("Subscrever agora")',
    ],
  },

  quantity: {
    visualDropdown: [
      '#a-autoid-3-announce',
      '#a-autoid-0-announce',
      '#quantity-button',
      '#quantityDropdown',
      'span.a-dropdown-prompt',
      'span[data-action="a-dropdown-button"]',
      'span:has-text("Quantidade:")',
      'span:has-text("Cantidad:")',
      'span:has-text("Quantidade")',
      'span:has-text("Cantidad")',
    ],
    normalDropdown: [
      '#quantity',
      'select[name="quantity"]',
      'select[id="quantity"]',
      'span[data-action="a-dropdown-button"]:has-text("Quantidade")',
      'span[data-action="a-dropdown-button"]:has-text("Cantidad")',
    ],
  },
};

// =====================================================
// UTILITÁRIOS
// =====================================================

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function cleanSpaces(text) {
  return String(text || '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizePriceText(text, { keepEuro = true } = {}) {
  let s = cleanSpaces(text);
  if (!s) return '';

  // Amazon pode devolver "12,34 €" ou "12.34€".
  s = s.replace(/\s*€\s*/g, '€');
  s = s.replace(/\.(?=\d{2}(?:€|$))/g, ',');
  s = s.replace(/,,/g, ',');

  const match = s.match(/\d+[\.,]\d{2}\s*€?|\d+\s*€?/);
  if (!match) return s;

  let price = match[0].replace(/\s/g, '');
  if (!keepEuro) price = price.replace(/€/g, '');
  if (keepEuro && !price.includes('€')) price += '€';
  return price;
}

function priceWithoutEuro(text) {
  return normalizePriceText(text, { keepEuro: false }).replace(/€/g, '');
}

function ensureEuro(text) {
  const s = priceWithoutEuro(text);
  if (!s) return '';
  return `${s}€`;
}


function parsePriceNumber(text) {
  const s = cleanSpaces(text || '')
    .replace(/[^\d,\.]/g, '')
    .replace(/\.(?=\d{3})/g, '')
    .replace(',', '.');

  const n = Number.parseFloat(s);
  return Number.isFinite(n) ? n : null;
}


function multiplyPriceText(priceText, quantity) {
  const n = parsePriceNumber(priceText);
  const q = Number(quantity || 1);

  if (!Number.isFinite(n) || !Number.isFinite(q) || q <= 1) {
    return ensureEuro(priceText);
  }

  const total = n * q;

  return `${total.toFixed(2).replace('.', ',')}€`;
}

function isSubscribeAndSaveCheaper(product) {
  const normal = parsePriceNumber(product.price);
  const sns = parsePriceNumber(product.snsPrice);

  if (normal == null || sns == null) return false;
  return sns < normal;
}

function detectUnitPromotionText(text) {
  const clean = cleanSpaces(text);

  for (const promoText of UNIT_PROMO_TEXTS) {
    if (clean.includes(promoText)) return promoText;
  }

  return '';
}

function getQuantityForUnitPromotion(unitPromotionText) {
  if (unitPromotionText === 'Obtenha 3 pelo preço de 2') return 3;
  if (unitPromotionText === 'Poupe 70% em 1 na compra de2') return 2;
  if (unitPromotionText === 'Poupe 50% em 1 na compra de2') return 2;
  return 1;
}

function getCheckoutStrategy(product) {
  const s = product.signals || {};
  const unitPromotionText = s.unitPromotionText || '';
  const qty = getQuantityForUnitPromotion(unitPromotionText);
  const snsCheaper = isSubscribeAndSaveCheaper(product);

  if (s.hasSubscribeAndSave && snsCheaper && s.hasUnitsPromotion) {
    return { mode: 'sns_units', quantity: qty, reason: 'Subscreve e Poupe é mais barato e existe promoção por unidades' };
  }
  if (s.hasSubscribeAndSave && snsCheaper) {
    return { mode: 'sns', quantity: 1, reason: 'Subscreve e Poupe é mais barato' };
  }
  if (s.hasUnitsPromotion) {
    return { mode: 'normal_units', quantity: qty, reason: 'Promoção por unidades, mas Subscreve e Poupe não é mais barato' };
  }
  return { mode: 'normal', quantity: 1, reason: 'Checkout normal' };
}

function formatPvp(pvp) {
  const s = ensureEuro(pvp);
  return s || '⚠️ERRO';
}

function extractAsinFromUrl(inputUrl) {
  if (!inputUrl) return '';
  const str = String(inputUrl);
  return (
    str.match(/\/(?:gp\/product|dp)\/([A-Z0-9]{10})/i)?.[1] ||
    str.match(/[?&]asin=([A-Z0-9]{10})/i)?.[1] ||
    str.match(/\/([A-Z0-9]{10})(?:[/?#]|$)/i)?.[1] ||
    ''
  ).toUpperCase();
}

function buildAffiliateUrl(url, asin) {
  const targetAsin = asin || extractAsinFromUrl(url);
  if (targetAsin) return `https://www.amazon.es/dp/${targetAsin}?tag=${ASSOC_TAG}`;

  try {
    const u = new URL(url);
    u.searchParams.set('tag', ASSOC_TAG);
    return u.toString();
  } catch {
    return url;
  }
}

function hashtagify(text, fallback) {
  const s = cleanSpaces(text || '')
    .replace(/,/g, '')
    .replace(/-/g, '_')
    .replace(/\s+/g, '_')
    .trim();
  return s || fallback;
}

async function safeText(page, selector) {
  try {
    const el = page.locator(selector).first();
    if (!(await el.count())) return '';
    return cleanSpaces(await el.innerText({ timeout: 2500 }));
  } catch {
    return '';
  }
}

async function firstText(page, selectors) {
  for (const selector of selectors) {
    const text = await safeText(page, selector);
    if (text) return text;
  }
  return '';
}

async function allTexts(page, selector, limit = 20) {
  try {
    const loc = page.locator(selector);
    const count = Math.min(await loc.count(), limit);
    const out = [];
    for (let i = 0; i < count; i++) {
      const t = cleanSpaces(await loc.nth(i).innerText({ timeout: 1500 }).catch(() => ''));
      if (t) out.push(t);
    }
    return out;
  } catch {
    return [];
  }
}

async function pageContains(page, patterns) {
  const body = await safeText(page, 'body');
  const lower = body.toLowerCase();
  return patterns.some(p => lower.includes(String(p).toLowerCase()));
}

function includesAny(text, patterns) {
  const lower = cleanSpaces(text).toLowerCase();
  return patterns.some(p => lower.includes(String(p).toLowerCase()));
}

async function clickFirst(page, selectors, opts = {}) {
  for (const selector of selectors) {
    try {
      const loc = page.locator(selector).first();
      if (await loc.count()) {
        await loc.click({ timeout: opts.timeout || 5000 });
        return selector;
      }
    } catch {}
  }
  return '';
}

async function maybeClosePopups(page) {
  const popupSelectors = [
    '#sp-cc-accept',
    'input[name="accept"]',
    'button:has-text("Aceptar")',
    'button:has-text("Aceitar")',
    'button:has-text("Continuar")',
  ];
  await clickFirst(page, popupSelectors, { timeout: 1500 });
}

async function ensureNotAtFinalOrderButton(page) {
  for (const selector of NEVER_CLICK_SELECTORS) {
    if (await page.locator(selector).count().catch(() => 0)) {
      return true;
    }
  }
  return false;
}

// =====================================================
// EXTRAÇÃO DE DADOS
// =====================================================

async function scrapeProductPage(page, productUrl) {
  await page.goto(productUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await maybeClosePopups(page);
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});

  const url = page.url();
  const asin = extractAsinFromUrl(url) || extractAsinFromUrl(productUrl);

  const title = await safeText(page, SELECTORS.title);
  const price = normalizePriceText(await firstText(page, SELECTORS.price));
  const snsPrice = normalizePriceText(await firstText(page, SELECTORS.snsPrice));
  const pvp = normalizePriceText(await firstText(page, SELECTORS.pvp));
  const bullets = await allTexts(page, SELECTORS.bullets, 12);
  const breadcrumbs = await allTexts(page, SELECTORS.breadcrumbs, 12);

  const primeText = await firstText(page, SELECTORS.primeExclusive);
  const primeDayText = await firstText(page, SELECTORS.primeDayBadge);
  const categoryRaw = await safeText(page, SELECTORS.category);
  const subcategoryRaw = await safeText(page, SELECTORS.subcategory);

  const bodyText = await safeText(page, 'body');

  const couponCode = detectCouponCode(bodyText);
  const signals = detectSignals({ bodyText, primeText, primeDayText, price, snsPrice, pvp });
  const promotionKind = detectPromotionKind({ ...signals, couponCode, bodyText });
  const needsCheckout = shouldSimulateCheckout({ ...signals, couponCode, bodyText, promotionKind, price });
  const checkoutStrategy = getCheckoutStrategy({ price, snsPrice, signals });

  return {
    sourceUrl: productUrl,
    currentUrl: url,
    asin,
    title,
    affiliateUrl: buildAffiliateUrl(url || productUrl, asin),
    price,
    snsPrice,
    pvp,
    bullets,
    breadcrumbs,
    category: hashtagify(categoryRaw, 'categoria'),
    subcategory: hashtagify(subcategoryRaw, 'subcategoria'),
    couponCode,
    signals,
    promotionKind,
    needsCheckout,
    checkoutStrategy,
    checkout: null,
    detectedAt: new Date().toISOString(),
  };
}

function detectCouponCode(text) {
  const clean = cleanSpaces(text);

  const patterns = [
    /c[oó]digo\s*(?:promocional|cup[oó]n|descuento)?\s*[:：]?\s*([A-Z0-9]{4,20})/i,
    /cup[oó]n\s*[:：]?\s*([A-Z0-9]{4,20})/i,
    /introduce\s+el\s+c[oó]digo\s+([A-Z0-9]{4,20})/i,
    /usa\s+el\s+c[oó]digo\s+([A-Z0-9]{4,20})/i,
    /usar\s+c[oó]digo\s+([A-Z0-9]{4,20})/i,
  ];

  for (const re of patterns) {
    const match = clean.match(re);
    if (match?.[1]) {
      const code = match[1].replace(/[^A-Z0-9]/gi, '').toUpperCase();
      if (code.length >= 4 && !['AMAZON', 'PRIME', 'CUPON'].includes(code)) return code;
    }
  }
  return '';
}

function detectAppliedCouponText(text) {
  const clean = cleanSpaces(text);

  const patterns = [
    /cup[aã]o\s+de\s+\d+\s*%\s+de\s+desconto\s+aplicado/i,
    /cup[oó]n\s+de\s+\d+\s*%\s+de\s+descuento\s+aplicado/i,

    /cup[aã]o\s+de\s+\d+[\.,]\d{2}\s*€\s+de\s+desconto\s+aplicado/i,
    /cup[oó]n\s+de\s+\d+[\.,]\d{2}\s*€\s+de\s+descuento\s+aplicado/i,

    /cup[aã]o\s+de\s+\d+\s*€\s+de\s+desconto\s+aplicado/i,
    /cup[oó]n\s+de\s+\d+\s*€\s+de\s+descuento\s+aplicado/i,
  ];

  return patterns.some(re => re.test(clean));
}

function extractAppliedCouponText(text) {
  const clean = cleanSpaces(text);

  const patterns = [
    /cup[aã]o\s+de\s+\d+\s*%\s+de\s+desconto\s+aplicado/i,
    /cup[oó]n\s+de\s+\d+\s*%\s+de\s+descuento\s+aplicado/i,

    /cup[aã]o\s+de\s+\d+[\.,]\d{2}\s*€\s+de\s+desconto\s+aplicado/i,
    /cup[oó]n\s+de\s+\d+[\.,]\d{2}\s*€\s+de\s+descuento\s+aplicado/i,

    /cup[aã]o\s+de\s+\d+\s*€\s+de\s+desconto\s+aplicado/i,
    /cup[oó]n\s+de\s+\d+\s*€\s+de\s+descuento\s+aplicado/i,
  ];

  for (const re of patterns) {
    const match = clean.match(re);
    if (match?.[0]) return cleanSpaces(match[0]);
  }

  return '';
}

function detectSignals({ bodyText, primeText, primeDayText, price, snsPrice, pvp }) {
  const text = cleanSpaces(bodyText);

  const hasSubscribeAndSave = includesAny(text, [
    'Suscríbete y ahorra',
    'Subscreve e Poupe',
    'Subscribe & Save',
    'sns-base-price',
  ]) || Boolean(snsPrice);

  const appliedCouponText = extractAppliedCouponText(text);
  const hasAppliedCoupon = detectAppliedCouponText(text) && Boolean(appliedCouponText);

  const hasApplyCoupon = hasAppliedCoupon || includesAny(text, [
    'Aplicar cupón',
    'Aplicar cupão',
    'Aplicar cupom',
    'Cupón aplicado',
    'Cupão aplicado',
    'Cupom aplicado',
    'cupón',
    'cupão',
    'cupom',
    'descuento',
    'desconto',
    'Ahorra',
    'Poupe',
  ]);

  const hasCheckoutDiscount = includesAny(text, [
    'descuento en el checkout',
    'desconto no checkout',
    'se aplicará al finalizar la compra',
    'se aplica al finalizar la compra',
    'al tramitar el pedido',
    'en la compra de artículos seleccionados',
    'en la compra de productos seleccionados',
    'comprar artículos elegibles',
  ]);

  const hasFlashSale = includesAny(text, [
    'Oferta flash',
    'Flash Sale',
    'Oferta por tiempo limitado',
    'Oferta limitada',
    'Oferta Prime Day',
  ]);

  const hasPrimeExclusive = includesAny(`${primeText} ${primeDayText} ${text}`, [
    'Preço exclusivo Prime',
    'Oferta exclusiva Prime',
    'Oferta Prime Day',
    'Exclusivo Prime',
  ]);

  const unitPromotionText = detectUnitPromotionText(text);
  const hasUnitsPromotion = Boolean(unitPromotionText);

  const hasCouponCodeOnlyAtCheckout = includesAny(text, [
    'Introduce el código',
    'Introduza o código',
    'código promocional',
    'código de descuento',
    'código de cupón',
  ]);

  const hasVisiblePrice = Boolean(price || snsPrice);
  const hasVisiblePvp = Boolean(pvp);

  return {
    hasSubscribeAndSave,
    hasApplyCoupon,
    hasAppliedCoupon,
    appliedCouponText,
    hasCheckoutDiscount,
    hasFlashSale,
    hasPrimeExclusive,
    hasUnitsPromotion,
    unitPromotionText,
    hasCouponCodeOnlyAtCheckout,
    hasVisiblePrice,
    hasVisiblePvp,
  };
}

function detectPromotionKind({
  hasSubscribeAndSave,
  hasApplyCoupon,
  hasAppliedCoupon,
  hasCheckoutDiscount,
  hasFlashSale,
  hasUnitsPromotion,
  hasCouponCodeOnlyAtCheckout,
  couponCode,
}) {
  if (hasUnitsPromotion) return 'units';

  if (hasSubscribeAndSave && hasApplyCoupon && hasCheckoutDiscount) return 'apply+sns+checkout';
  if (hasSubscribeAndSave && hasCheckoutDiscount) return 'sns+checkout';
  if (hasSubscribeAndSave && hasApplyCoupon) return 'apply+sns';
  if (hasSubscribeAndSave && couponCode) return 'sns+coupon';
  if (hasSubscribeAndSave) return 'sns';

  if (hasAppliedCoupon) return 'apply';
  if (hasApplyCoupon && couponCode) return 'apply+coupon';
  if (hasApplyCoupon && hasCheckoutDiscount) return 'apply+checkout';
  if (hasApplyCoupon) return 'apply';

  if (hasCheckoutDiscount) return 'checkout';
  if (couponCode || hasCouponCodeOnlyAtCheckout) return 'coupon';
  if (hasFlashSale) return 'flash';

  return 'normal';
}

function shouldSimulateCheckout({
  hasCheckoutDiscount,
  hasUnitsPromotion,
  hasCouponCodeOnlyAtCheckout,
  hasSubscribeAndSave,
  hasApplyCoupon,
  hasAppliedCoupon,
  promotionKind,
  price,
}) {
  if (hasAppliedCoupon) return true;
  if (hasApplyCoupon) return true;
  if (hasUnitsPromotion) return true;
  if (hasCheckoutDiscount) return true;
  if (hasCouponCodeOnlyAtCheckout) return true;
  if (promotionKind.includes('checkout')) return true;
  if (hasSubscribeAndSave && hasApplyCoupon) return true;
  if (!price && promotionKind !== 'normal') return true;
  return false;
}

// =====================================================
// CHECKOUT SIMULADO
// =====================================================

async function ensureCouponApplied(page) {
  const result = {
    found: false,
    alreadyApplied: false,
    clicked: false,
    text: '',
  };

  const body = await safeText(page, 'body');
  const appliedCouponText = extractAppliedCouponText(body);

  if (appliedCouponText) {
    result.found = true;
    result.alreadyApplied = true;
    result.text = appliedCouponText;
    return result;
  }

  const checkboxSelectors = [
    'label:has-text("Aplicar cupão")',
    'label:has-text("Aplicar cupón")',
    'span:has-text("Aplicar cupão")',
    'span:has-text("Aplicar cupón")',
  ];

  for (const selector of checkboxSelectors) {
    const loc = page.locator(selector).first();

    if (await loc.count().catch(() => 0)) {
      result.found = true;
      result.text = cleanSpaces(await loc.innerText({ timeout: 1500 }).catch(() => ''));

      await loc.click({ timeout: 3000 }).catch(() => {});
      result.clicked = true;

      await page.waitForTimeout(1500);

      const bodyAfter = await safeText(page, 'body');
      const appliedAfter = extractAppliedCouponText(bodyAfter);

      if (appliedAfter) {
        result.alreadyApplied = true;
        result.text = appliedAfter;
      }

      return result;
    }
  }

  return result;
}

async function applyCouponCheckboxIfPresent(page) {
  const result = {
    attempted: true,
    found: false,
    clicked: false,
    alreadyApplied: false,
    selector: '',
    method: '',
    text: '',
    error: '',
  };

  try {
    const body = await safeText(page, 'body');

    const appliedText = extractAppliedCouponText(body);
    if (appliedText) {
      result.found = true;
      result.alreadyApplied = true;
      result.text = appliedText;
      return result;
    }

    const candidates = [
      {
        locator: page.locator('input[id^="checkmarkpctch"]'),
        selector: 'input[id^="checkmarkpctch"]',
      },
      {
        locator: page.locator('[id^="checkmarkpctch"]'),
        selector: '[id^="checkmarkpctch"]',
      },
      {
        locator: page.locator('input[type="checkbox"][id*="pctch"]'),
        selector: 'input[type="checkbox"][id*="pctch"]',
      },
      {
        locator: page.locator('label:has-text("Aplicar cupão")'),
        selector: 'label:has-text("Aplicar cupão")',
      },
      {
        locator: page.locator('label:has-text("Aplicar cupón")'),
        selector: 'label:has-text("Aplicar cupón")',
      },
      {
        locator: page.locator('span:has-text("Aplicar cupão")'),
        selector: 'span:has-text("Aplicar cupão")',
      },
      {
        locator: page.locator('span:has-text("Aplicar cupón")'),
        selector: 'span:has-text("Aplicar cupón")',
      },
    ];

    for (const item of candidates) {
      const count = await item.locator.count().catch(() => 0);

      for (let i = 0; i < count; i++) {
        const el = item.locator.nth(i);

        result.found = true;
        result.selector = item.selector;

        const checked = await el.isChecked?.().catch(() => false);
        if (checked) {
          result.alreadyApplied = true;
          result.clicked = false;
          result.method = 'already-checked';
          return result;
        }

        const clickResult = await clickLocatorRobust(el, {
          selector: item.selector,
        });

        if (clickResult.clicked) {
          result.clicked = true;
          result.method = clickResult.method;
          await page.waitForTimeout(1500);

          const bodyAfter = await safeText(page, 'body');
          const appliedAfter = extractAppliedCouponText(bodyAfter);

          if (appliedAfter) {
            result.alreadyApplied = true;
            result.text = appliedAfter;
          }

          return result;
        }

        result.error = clickResult.error || `Falha ao clicar em ${item.selector}`;
      }
    }

    result.error = 'Não encontrei checkbox de cupão.';
    return result;
  } catch (err) {
    result.error = err?.message || String(err);
    return result;
  }
}

async function extractCheckoutFinalPriceFromPage(page) {
  const selectors = [
    '[data-shimmer-target="ordertotals-amount"]',
    '.order-summary-line-definition [data-shimmer-target="ordertotals-amount"]',
    '#subtotals-marketplace-table [data-shimmer-target="ordertotals-amount"]',
  ];

  for (const selector of selectors) {
    const values = await allTexts(page, selector, 20);
    if (values.length) {
      return normalizePriceText(values[values.length - 1]);
    }
  }

  return '';
}

async function getCurrentQuantityValue(page) {
  const visualText = await safeText(page, 'body');

  const visualMatch = visualText.match(/Quantidade:\s*(\d+)|Cantidad:\s*(\d+)/i);
  if (visualMatch) return visualMatch[1] || visualMatch[2] || '';

  const prompts = await allTexts(page, 'span.a-dropdown-prompt', 20);
  for (const text of prompts) {
    const match = text.match(/\b(\d+)\b/);
    if (match?.[1]) return match[1];
  }

  const select = page.locator('#quantity, select#quantity, select[name="quantity"]').first();

  if (await select.count().catch(() => 0)) {
    const value = await select.inputValue().catch(() => '');
    if (value) return value;
  }

  return '';
}

async function clickLocatorRobust(locator, meta = {}) {
  const result = {
    clicked: false,
    method: '',
    error: '',
    ...meta,
  };

  try {
    await locator.scrollIntoViewIfNeeded().catch(() => {});

    try {
      await locator.click({ timeout: 5000, force: true });
      result.clicked = true;
      result.method = 'playwright-force-click';
      return result;
    } catch (err1) {
      result.error = err1?.message || String(err1);
    }

    try {
      const jsClicked = await locator.evaluate(node => {
        if (!node) return false;
        node.click();
        return true;
      });

      if (jsClicked) {
        result.clicked = true;
        result.method = 'js-click';
        return result;
      }
    } catch (err2) {
      result.error = `${result.error} | JS click: ${err2?.message || String(err2)}`;
    }

    try {
      const box = await locator.boundingBox();
      if (box) {
        await locator.page().mouse.click(box.x + box.width / 2, box.y + box.height / 2);
        result.clicked = true;
        result.method = 'mouse-bounding-box-click';
        return result;
      }
    } catch (err3) {
      result.error = `${result.error} | mouse click: ${err3?.message || String(err3)}`;
    }

    return result;
  } catch (err) {
    result.error = err?.message || String(err);
    return result;
  }
}

async function selectSubscribeAndSaveQuantity(page, quantity) {
  const value = String(quantity);

  const result = {
    attempted: true,
    selected: false,
    quantity,
    mode: 'sns',
    method: '',
    dropdownSelector: '',
    dropdownClickMethod: '',
    optionSelector: '',
    optionClickMethod: '',
    selectedValue: '',
    error: '',
  };

  try {
    const dropdownLocators = [
      {
        locator: page.locator('#a-autoid-3-announce'),
        selector: '#a-autoid-3-announce',
      },
      {
        locator: page.getByText(/Quantidade:\s*1/i),
        selector: 'text=/Quantidade:\\s*1/i',
      },
      {
        locator: page.getByText(/Cantidad:\s*1/i),
        selector: 'text=/Cantidad:\\s*1/i',
      },
      {
        locator: page.locator('span.a-dropdown-prompt').filter({ hasText: /1/ }),
        selector: 'span.a-dropdown-prompt hasText 1',
      },
    ];

    for (const item of dropdownLocators) {
      const count = await item.locator.count().catch(() => 0);

      for (let i = 0; i < count; i++) {
        const dropdown = item.locator.nth(i);
        const visible = await dropdown.isVisible().catch(() => false);
        if (!visible) continue;

        const dropdownClick = await clickLocatorRobust(dropdown, {
          selector: item.selector,
        });
        if (!dropdownClick.clicked) {
          result.error = dropdownClick.error || `Falha ao abrir dropdown ${item.selector}`;
          continue;
        }

        result.dropdownSelector = item.selector;
        result.dropdownClickMethod = dropdownClick.method;
        result.method = 'sns-codegen-dropdown';

        await page.waitForTimeout(800);

        const optionIndex = Number(value) - 1;
        const optionLocators = [
          {
            locator: page.locator(`#rcxsubsQuan_${optionIndex}`),
            selector: `#rcxsubsQuan_${optionIndex}`,
          },
          {
            locator: page.locator(`#rcxsubsQuan_${optionIndex} span`),
            selector: `#rcxsubsQuan_${optionIndex} span`,
          },
          {
            locator: page.locator(`a[data-value='{"stringVal":"${value}"}']`),
            selector: `a[data-value='{"stringVal":"${value}"}']`,
          },
          {
            locator: page.getByRole('option', { name: value, exact: true }),
            selector: `role=option[name="${value}"]`,
          },
          {
            locator: page.locator(`.a-popover a:has-text("${value}")`),
            selector: `.a-popover a:has-text("${value}")`,
          },
        ];

        for (const itemOption of optionLocators) {
          const opt = itemOption.locator.first();

          if (!(await opt.count().catch(() => 0))) continue;

          const clickResult = await clickLocatorRobust(opt, {
            selector: itemOption.selector,
          });
          if (!clickResult.clicked) {
            result.error = clickResult.error || `Falha ao clicar na opção ${itemOption.selector}`;
            continue;
          }
          result.optionSelector = itemOption.selector;
          result.optionClickMethod = clickResult.method;
          await page.waitForTimeout(1500);

          const selectedValue = await getCurrentQuantityValue(page);
          result.selectedValue = selectedValue || value;

          if (clickResult.clicked) {
            result.selected = true;
            result.selectedValue = selectedValue || value;
            return result;
          }
        }
      }
    }

    result.error = `Não consegui selecionar quantidade SNS ${value} pelo dropdown visual.`;
    return result;
  } catch (err) {
    result.error = err?.message || String(err);
    return result;
  }
}

async function selectQuantityByVisualDropdown(page, quantity, mode = 'normal') {
  const result = {
    attempted: true,
    selected: false,
    quantity,
    mode,
    dropdownSelector: '',
    optionSelector: '',
    selectedValue: '',
    error: '',
  };

  const value = String(quantity);

  try {
    const dropdownCandidates = SELECTORS.quantity.visualDropdown;

    for (const selector of dropdownCandidates) {
      const loc = page.locator(selector).first();
      if (!(await loc.count().catch(() => 0))) continue;

      await loc.scrollIntoViewIfNeeded().catch(() => {});
      await loc.click({ timeout: 5000, force: true }).catch(() => {});
      result.dropdownSelector = selector;
      await page.waitForTimeout(700);

      const roleOption = page.getByRole('option', { name: value, exact: true });
      if (await roleOption.count().catch(() => 0)) {
        await roleOption.first().click({ timeout: 5000, force: true });
        result.optionSelector = `role=option[name="${value}"]`;
        await page.waitForTimeout(1000);

        const selectedValue = await getCurrentQuantityValue(page);
        result.selectedValue = selectedValue || value;
        result.selected = selectedValue === value || !selectedValue;
        return result;
      }

      const optionIndex = Number(value) - 1;
      const optionSelectors = [
        `#quantity_${optionIndex}`,
        `.a-popover a:has-text("${value}")`,
        `.a-popover li:has-text("${value}")`,
        `.a-popover span:has-text("${value}")`,
        `div.a-popover-wrapper a:has-text("${value}")`,
        `div.a-popover-wrapper li:has-text("${value}")`,
        `div.a-popover-wrapper span:has-text("${value}")`,
        `#quantity_${optionIndex} span`,
        `a[data-value='{"stringVal":"${value}"}']`,
      ];

      for (const optionSelector of optionSelectors) {
        const option = page.locator(optionSelector).first();
        if (!(await option.count().catch(() => 0))) continue;

        await option.scrollIntoViewIfNeeded().catch(() => {});
        await option.click({ timeout: 5000, force: true }).catch(() => {});
        result.optionSelector = optionSelector;
        await page.waitForTimeout(1500);

        const selectedValue = await getCurrentQuantityValue(page);
        result.selectedValue = selectedValue || value;

        if (selectedValue === value || !selectedValue) {
          result.selected = true;
          return result;
        }
      }
    }

    result.error = `Não consegui selecionar quantidade ${quantity} pelo dropdown visual.`;
    return result;
  } catch (err) {
    result.error = err?.message || String(err);
    return result;
  }
}

async function selectQuantity(page, quantity, mode = 'normal') {
  if (!quantity || quantity <= 1) {
    return { attempted: false, selected: false, quantity: 1, mode, error: '' };
  }
  const result = {
    attempted: true,
    selected: false,
    quantity,
    mode,
    selector: '',
    selectedValue: '',
    availableOptions: [],
    method: '',
    error: '',
  };

  try {
    if (mode === 'sns') {
      return await selectSubscribeAndSaveQuantity(page, quantity);
    }

    const selectors = SELECTORS.quantity.normalDropdown;

    for (const selector of selectors) {
      const loc = page.locator(selector).first();
      if (!(await loc.count().catch(() => 0))) continue;

      const tagName = await loc.evaluate(el => el.tagName.toLowerCase()).catch(() => '');

      if (tagName === 'select') {
        await loc.scrollIntoViewIfNeeded().catch(() => {});

        const value = String(quantity);

        result.selector = selector;
        result.method = 'selectOptionFallback';
        result.availableOptions = await loc.locator('option').evaluateAll(options =>
          options.map(o => ({
            value: o.value,
            text: o.textContent?.trim() || '',
            selected: o.selected,
          }))
        ).catch(() => []);

        await loc.selectOption(value).catch(async () => {
          await loc.selectOption({ label: value }).catch(() => {});
        });

        await loc.evaluate(el => {
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        }).catch(() => {});

        await page.waitForTimeout(1500);

        const selectedValue = await loc.inputValue().catch(() => '');
        if (selectedValue === value) {
          result.selected = true;
          result.selector = selector;
          result.selectedValue = selectedValue;
          result.method = 'selectOption';
          return result;
        }

        const visualResult = await selectQuantityByVisualDropdown(page, quantity, mode);
        if (visualResult.selected) {
          return {
            ...visualResult,
            method: 'visualDropdownAfterSelectOptionFailed',
            availableOptions: result.availableOptions,
          };
        }

        result.selected = false;
        result.selectedValue = selectedValue || '';
        result.error = `Select encontrado em ${selector}, mas ficou com valor ${selectedValue || 'vazio'} em vez de ${value}.`;
        return result;
      }

      await loc.scrollIntoViewIfNeeded().catch(() => {});
      await loc.click({ timeout: 4000 }).catch(() => {});
      await page.waitForTimeout(500);

      const optionSelectors = [
        `.a-popover a:has-text("${quantity}")`,
        `.a-popover li:has-text("${quantity}")`,
        `.a-popover span:has-text("${quantity}")`,
      ];

      for (const optionSelector of optionSelectors) {
        const option = page.locator(optionSelector).first();
        if (await option.count().catch(() => 0)) {
          await option.click({ timeout: 4000 }).catch(() => {});
          result.selected = true;
          result.selector = selector;
          result.selectedValue = String(quantity);
          result.method = 'popoverOption';
          await page.waitForTimeout(1500);
          return result;
        }
      }
    }

    result.error = `Não encontrei dropdown de quantidade para ${mode}.`;
    return result;
  } catch (err) {
    result.error = err?.message || String(err);
    return result;
  }
}

async function selectSubscribeAndSaveOption(page) {
  const result = {
    attempted: true,
    selected: false,
    selector: '',
    error: '',
  };

  try {
    const roleOptions = [
      {
        locator: page.getByRole('button', { name: /Subscreva e poupe/i }),
        selector: 'role=button[name~/Subscreva e poupe/i]',
      },
      {
        locator: page.getByRole('button', { name: /Subscreve e Poupe/i }),
        selector: 'role=button[name~/Subscreve e Poupe/i]',
      },
      {
        locator: page.getByRole('button', { name: /Suscríbete y ahorra/i }),
        selector: 'role=button[name~/Suscríbete y ahorra/i]',
      },
    ];

    for (const item of roleOptions) {
      const count = await item.locator.count().catch(() => 0);
      for (let i = 0; i < count; i++) {
        const btn = item.locator.nth(i);
        const visible = await btn.isVisible().catch(() => false);
        if (!visible) continue;

        await btn.scrollIntoViewIfNeeded().catch(() => {});
        await btn.click({ timeout: 5000, force: true });
        result.selected = true;
        result.selector = item.selector;
        await page.waitForTimeout(1000);
        return result;
      }
    }

    for (const selector of SELECTORS.subscribeAndSave.option) {
      const loc = page.locator(selector).first();

      if (!(await loc.count().catch(() => 0))) continue;

      await loc.scrollIntoViewIfNeeded().catch(() => {});
      await loc.click({ timeout: 5000, force: true }).catch(async () => {
        const input = loc.locator('input[type="radio"], input[type="checkbox"]').first();
        if (await input.count().catch(() => 0)) {
          await input.click({ timeout: 5000, force: true }).catch(() => {});
        }
      });

      result.selected = true;
      result.selector = selector;

      await page.waitForTimeout(1000);
      return result;
    }

    result.error = 'Não encontrei opção Subscreve e Poupe.';
    return result;
  } catch (err) {
    result.error = err?.message || String(err);
    return result;
  }
}

async function clickSubscribeNow(page) {
  const result = {
    clicked: false,
    selector: '',
    method: '',
    error: '',
  };

  try {
    await page.waitForTimeout(1000);

    const direct = page.locator('#rcx-subscribe-submit-button-announce').first();

    if (await direct.count().catch(() => 0)) {
      await direct.scrollIntoViewIfNeeded().catch(() => {});

      try {
        await direct.click({ timeout: 8000, force: true });
        return {
          clicked: true,
          selector: '#rcx-subscribe-submit-button-announce',
          method: 'direct-force-click',
          error: '',
        };
      } catch (err1) {
        result.error = err1?.message || String(err1);
      }

      try {
        const jsClicked = await direct.evaluate(node => {
          if (!node) return false;
          node.click();
          return true;
        });

        if (jsClicked) {
          return {
            clicked: true,
            selector: '#rcx-subscribe-submit-button-announce',
            method: 'direct-js-click',
            error: '',
          };
        }
      } catch (err2) {
        result.error = `${result.error} | JS click: ${err2?.message || String(err2)}`;
      }

      try {
        const box = await direct.boundingBox();
        if (box) {
          await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
          return {
            clicked: true,
            selector: '#rcx-subscribe-submit-button-announce',
            method: 'direct-mouse-bounding-box-click',
            error: '',
          };
        }
      } catch (err3) {
        result.error = `${result.error} | mouse click: ${err3?.message || String(err3)}`;
      }
    }

    const candidates = [
      {
        locator: page.getByRole('button', { name: 'Subscrever', exact: true }),
        selector: 'role=button[name="Subscrever"]',
      },
      {
        locator: page.getByRole('button', { name: /Subscrever/i }),
        selector: 'role=button[name~/Subscrever/i]',
      },
      {
        locator: page.getByRole('button', { name: /Suscribirse/i }),
        selector: 'role=button[name~/Suscribirse/i]',
      },
      {
        locator: page.locator('button:has-text("Subscrever")'),
        selector: 'button:has-text("Subscrever")',
      },
      {
        locator: page.locator('button:has-text("Suscribirse")'),
        selector: 'button:has-text("Suscribirse")',
      },
      {
        locator: page.locator('#rcx-subscribe-submit-button'),
        selector: '#rcx-subscribe-submit-button',
      },
    ];

    for (const item of candidates) {
      const count = await item.locator.count().catch(() => 0);

      for (let i = 0; i < count; i++) {
        const el = item.locator.nth(i);

        await el.scrollIntoViewIfNeeded().catch(() => {});

        try {
          await el.click({ timeout: 8000, force: true });
          return {
            clicked: true,
            selector: item.selector,
            method: 'fallback-force-click',
            error: '',
          };
        } catch (err1) {
          result.error = err1?.message || String(err1);
        }

        try {
          const jsClicked = await el.evaluate(node => {
            if (!node) return false;
            node.click();
            return true;
          });

          if (jsClicked) {
            return {
              clicked: true,
              selector: item.selector,
              method: 'fallback-js-click',
              error: '',
            };
          }
        } catch (err2) {
          result.error = `${result.error} | fallback JS click: ${err2?.message || String(err2)}`;
        }
      }
    }

    return {
      ...result,
      clicked: false,
      selector: '',
      method: '',
      error: result.error || 'Não consegui clicar no botão Subscrever.',
    };
  } catch (err) {
    return {
      ...result,
      error: err?.message || String(err),
    };
  }
}


function extractCheckoutFinalPrice(text) {
  const clean = cleanSpaces(text);

  const patterns = [
    /Total\s+do\s+pedido[^€]{0,300}(\d+[\.,]\d{2}\s*€)/i,
    /Total\s+del\s+pedido[^€]{0,300}(\d+[\.,]\d{2}\s*€)/i,
    /Total[^€]{0,300}(\d+[\.,]\d{2}\s*€)/i,
  ];

  for (const re of patterns) {
    const m = clean.match(re);
    if (m?.[1]) return normalizePriceText(m[1]);
  }

  const allPrices = clean.match(/\d+[\.,]\d{2}\s*€/g);
  if (!allPrices?.length) return '';

  return normalizePriceText(allPrices[allPrices.length - 1]);
}

async function simulateCheckout(page, product) {
  const result = {
    attempted: true,
    coupon: null,
    clickedBuyNow: false,
    reachedCheckoutSummary: false,
    finalPrice: '',
    subtotal: '',
    discountText: '',
    error: '',
  };

  try {
    await page.goto(product.currentUrl || product.sourceUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await maybeClosePopups(page);
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
    const strategy = product.checkoutStrategy || getCheckoutStrategy(product);
    result.strategy = strategy;

    if (strategy.mode === 'sns_units') {
      result.snsSelection = await selectSubscribeAndSaveOption(page);

      if (!result.snsSelection.selected) {
        return {
          ...result,
          error: result.snsSelection.error || 'Falha ao selecionar Subscreve e Poupe.',
        };
      }

      result.quantitySelection = await selectQuantity(page, strategy.quantity, 'sns');

      if (strategy.quantity > 1 && !result.quantitySelection.selected) {
        return {
          ...result,
          error: result.quantitySelection.error || 'Falha ao selecionar quantidade no Subscreve e Poupe.',
        };
      }

      if (
        product.signals?.hasApplyCoupon ||
        product.signals?.hasAppliedCoupon ||
        product.promotionKind?.includes('apply')
      ) {
        result.coupon = await applyCouponCheckboxIfPresent(page);
      }

      await page.waitForTimeout(1000);

      result.subscribeClick = await clickSubscribeNow(page);

      if (!result.subscribeClick.clicked) {
        return {
          ...result,
          error: result.subscribeClick.error || 'Falha ao clicar em Subscrever.',
        };
      }
    } else if (strategy.mode === 'sns') {
      result.snsSelection = await selectSubscribeAndSaveOption(page);

      if (!result.snsSelection.selected) {
        return {
          ...result,
          error: result.snsSelection.error || 'Falha ao selecionar Subscreve e Poupe.',
        };
      }

      if (
        product.signals?.hasApplyCoupon ||
        product.signals?.hasAppliedCoupon ||
        product.promotionKind === 'apply+sns' ||
        product.promotionKind === 'sns+coupon'
      ) {
        result.coupon = await applyCouponCheckboxIfPresent(page);
      }

      await page.waitForTimeout(1000);

      result.subscribeClick = await clickSubscribeNow(page);

      if (!result.subscribeClick.clicked) {
        return {
          ...result,
          error: result.subscribeClick.error || 'Falha ao clicar em Subscrever.',
        };
      }
    } else {
      if (strategy.mode === 'normal_units') {
        result.quantitySelection = await selectQuantity(page, strategy.quantity, 'normal');
        if (strategy.quantity > 1 && !result.quantitySelection.selected) return { ...result, error: result.quantitySelection.error || 'Falha ao selecionar quantidade normal.' };
      }
      if (
      product.signals?.hasAppliedCoupon ||
      product.signals?.hasApplyCoupon ||
      product.promotionKind === 'apply' ||
      product.promotionKind?.includes('apply') ||
      product.promotionKind === 'coupon'
      ) {
        result.coupon = await ensureCouponApplied(page);
      }
      const buyNowClicked = await clickFirst(page, SELECTORS.buyNow, { timeout: 8000 });
      if (!buyNowClicked) {
        result.error = 'Não encontrei botão Comprar já.';
        return result;
      }
      result.clickedBuyNow = true;
    }

    await page.waitForLoadState('domcontentloaded', { timeout: 30000 }).catch(() => {});
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(4000);

    const atFinalButton = await ensureNotAtFinalOrderButton(page);
    const checkoutText = await safeText(page, 'body');

    result.reachedCheckoutSummary = true;

    result.finalPrice =
      await extractCheckoutFinalPriceFromPage(page) ||
      extractCheckoutFinalPrice(checkoutText) ||
      findBestPriceNearWords(checkoutText, ['Total del pedido', 'Total do pedido', 'Total', 'Importe total']);

    result.subtotal = findBestPriceNearWords(checkoutText, ['Produtos', 'Productos', 'Subtotal', 'Total parcial']);
    result.discountText = extractDiscountSummary(checkoutText);

    if (atFinalButton) {
      result.safetyStop = 'Resumo encontrado. Botão final de compra detetado e ignorado.';
    }

    return result;
  } catch (err) {
    result.error = err?.message || String(err);
    return result;
  }
}

function findBestPriceNearWords(text, words) {
  const clean = cleanSpaces(text);
  const lines = clean.split(/(?<=€)|\n|\r/).map(cleanSpaces).filter(Boolean);

  for (const word of words) {
    const idx = clean.toLowerCase().indexOf(word.toLowerCase());
    if (idx >= 0) {
      const slice = clean.slice(idx, idx + 500);
      const prices = slice.match(/\d+[\.,]\d{2}\s*€/g);
      if (prices?.length) return normalizePriceText(prices[prices.length - 1]);
    }
  }

  const allPrices = clean.match(/\d+[\.,]\d{2}\s*€/g);
  if (allPrices?.length) return normalizePriceText(allPrices[allPrices.length - 1]);

  for (const line of lines) {
    const price = normalizePriceText(line);
    if (price) return price;
  }
  return '';
}

function extractDiscountSummary(text) {
  const clean = cleanSpaces(text);
  const patterns = [
    /descuento[^.€]{0,120}(?:\d+[\.,]\d{2}\s*€|\d+%)/i,
    /cup[oó]n[^.€]{0,120}(?:\d+[\.,]\d{2}\s*€|\d+%)/i,
    /promoci[oó]n[^.€]{0,120}(?:\d+[\.,]\d{2}\s*€|\d+%)/i,
    /ahorra[^.€]{0,120}(?:\d+[\.,]\d{2}\s*€|\d+%)/i,
    /poupe[^.€]{0,120}(?:\d+[\.,]\d{2}\s*€|\d+%)/i,
  ];
  for (const re of patterns) {
    const m = clean.match(re);
    if (m?.[0]) return cleanSpaces(m[0]);
  }
  return '';
}

async function removeProductFromCart(page, product) {
  try {
    await page.goto('https://www.amazon.es/cart', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(1500);

    // Remove todos os itens visíveis no carrinho para garantir limpeza do teste.
    let removed = 0;
    for (let attempt = 0; attempt < 5; attempt++) {
      const selector = SELECTORS.removeFromCart.find(asyncSelector => asyncSelector);
      let clicked = false;
      for (const sel of SELECTORS.removeFromCart) {
        const count = await page.locator(sel).count().catch(() => 0);
        if (count > 0) {
          await page.locator(sel).first().click({ timeout: 4000 }).catch(() => {});
          removed++;
          clicked = true;
          await sleep(1500);
          break;
        }
      }
      if (!clicked) break;
    }
    return removed;
  } catch {
    return 0;
  }
}

// =====================================================
// FORMATAÇÃO DAS PUBLICAÇÕES
// =====================================================

function buildFlagsText(flags = {}) {
  const parts = ['#pub_amazon 🇪🇸'];
  if (flags.minimoHistorico) parts.push('❗𝗠𝗜𝗡𝗜𝗠𝗢 𝗛𝗜𝗦𝗧𝗢𝗥𝗜𝗖𝗢❗');
  if (flags.bomPreco) parts.push('🔥𝗕𝗼𝗺 𝗣𝗿𝗲ç𝗼!');
  if (flags.extraBeforeTitle) parts.push(flags.extraBeforeTitle);
  if (flags.unitPriceText) parts.push(flags.unitPriceText);
  if (flags.corrida) parts.push('🏃🏃🏃');
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

function basePublicationLines(product, flags = {}) {
  const titleExtra = flags.extraAfterTitle ? ` ${flags.extraAfterTitle}` : '';
  return [
    buildFlagsText(flags),
    `${product.title || '⚠️ERRO título'}${titleExtra}`,
    `👉 ${product.affiliateUrl || product.sourceUrl}`,
  ];
}

function categoryLine(product) {
  return `#publi 🔎 #${product.category || 'categoria'} #${product.subcategory || 'subcategoria'}`;
}

function getBestPrice(product) {
  return ensureEuro(
    product.checkout?.finalPrice ||
    product.snsPrice ||
    product.price ||
    ''
  );
}

function getPvp(product) {
  return formatPvp(product.pvp || product.price || '');
}
function getUnitsPvp(product) {
  const quantity = Number(product.checkoutStrategy?.quantity || 1);
  const basePvp = product.pvp || product.price || '';

  if (!basePvp) return '⚠️ERRO';

  return multiplyPriceText(basePvp, quantity);
}


function primePrefix(product) {
  return product.signals?.hasPrimeExclusive ? '𝙚𝙭𝙘𝙡𝙪𝙨𝙞𝙫𝙤 𝙥𝙧𝙞𝙢𝙚 + ' : '';
}

function subscriptionNoteIfNeeded(label) {
  if (!label || !label.includes('𝘀𝘂𝗯𝘀𝗰𝗿𝗲𝘃𝗮 𝗲 𝗽𝗼𝘂𝗽𝗲')) return '';
  return '𝑠𝑢𝑏𝑠𝑐𝑟𝑖𝑐̧𝑎̃𝑜 𝑐𝑎𝑛𝑐𝑒𝑙𝑎́𝑣𝑒𝑙 𝑎 𝑞𝑢𝑎𝑙𝑞𝑢𝑒𝑟 𝑎𝑙𝑡𝑢𝑟𝑎, 𝑠𝑒𝑚 𝑒𝑛𝑐𝑎𝑟𝑔𝑜𝑠';
}

function detectDiscountLabel(product) {
  const s = product.signals || {};
  if (product.promotionKind === 'apply+sns') {
    return 'aplicar desconto + 𝘀𝘂𝗯𝘀𝗰𝗿𝗲𝘃𝗮 𝗲 𝗽𝗼𝘂𝗽𝗲';
  }
  if (product.promotionKind === 'apply+sns+checkout') {
    return 'aplicar desconto + 𝘀𝘂𝗯𝘀𝗰𝗿𝗲𝘃𝗮 𝗲 𝗽𝗼𝘂𝗽𝗲 + desconto no checkout';
  }
  if (s.hasSubscribeAndSave && s.hasApplyCoupon) {
    return s.hasCheckoutDiscount
      ? 'aplicar desconto + 𝘀𝘂𝗯𝘀𝗰𝗿𝗲𝘃𝗮 𝗲 𝗽𝗼𝘂𝗽𝗲 + desconto no checkout'
      : 'aplicar desconto + 𝘀𝘂𝗯𝘀𝗰𝗿𝗲𝘃𝗮 𝗲 𝗽𝗼𝘂𝗽𝗲';
  }
  if (s.hasAppliedCoupon) return 'aplicar desconto';
  if (s.hasSubscribeAndSave && product.couponCode) return '𝘀𝘂𝗯𝘀𝗰𝗿𝗲𝘃𝗮 𝗲 𝗽𝗼𝘂𝗽𝗲 + cupão:';
  if (s.hasSubscribeAndSave && s.hasCheckoutDiscount) return '𝘀𝘂𝗯𝘀𝗰𝗿𝗲𝘃𝗮 𝗲 𝗽𝗼𝘂𝗽𝗲 + desconto no checkout';
  if (s.hasSubscribeAndSave) return '𝘀𝘂𝗯𝘀𝗰𝗿𝗲𝘃𝗮 𝗲 𝗽𝗼𝘂𝗽𝗲';
  if (s.hasApplyCoupon && product.couponCode) return 'aplicar desconto + cupão:';
  if (s.hasApplyCoupon && s.hasCheckoutDiscount) return 'aplicar desconto + desconto no checkout';
  if (s.hasCheckoutDiscount) return 'desconto no checkout';
  if (s.hasApplyCoupon) return 'aplicar desconto';
  if (product.couponCode) return 'cupão:';
  if (s.hasFlashSale) return '𝗳𝗹𝗮𝘀𝗵 𝘀𝗮𝗹𝗲';
  return '𝗳𝗹𝗮𝘀𝗵 𝘀𝗮𝗹𝗲';
}

function shouldPrintCouponCode(label) {
  return ![
    'aplicar desconto',
    'desconto no checkout',
    'aplicar desconto + desconto no checkout',
    '𝗳𝗹𝗮𝘀𝗵 𝘀𝗮𝗹𝗲',
    '𝘀𝘂𝗯𝘀𝗰𝗿𝗲𝘃𝗮 𝗲 𝗽𝗼𝘂𝗽𝗲',
    'aplicar desconto + 𝘀𝘂𝗯𝘀𝗰𝗿𝗲𝘃𝗮 𝗲 𝗽𝗼𝘂𝗽𝗲',
    '𝘀𝘂𝗯𝘀𝗰𝗿𝗲𝘃𝗮 𝗲 𝗽𝗼𝘂𝗽𝗲 + desconto no checkout',
    'aplicar desconto + 𝘀𝘂𝗯𝘀𝗰𝗿𝗲𝘃𝗮 𝗲 𝗽𝗼𝘂𝗽𝗲 + desconto no checkout',
  ].includes(label);
}

function formatFlashSalePublication(product, flags = {}) {
  const lines = basePublicationLines(product, flags);
  const price = getBestPrice(product) || 'XX,XX€';
  const label = product.signals?.hasPrimeExclusive ? '𝙚𝙭𝙘𝙡𝙪𝙨𝙞𝙫𝙤 𝙥𝙧𝙞𝙢𝙚' : '𝗳𝗹𝗮𝘀𝗵 𝘀𝗮𝗹𝗲';
  lines.push(`💥 ${price} ${label} (pvp ${getPvp(product)})`);
  lines.push('');
  lines.push(categoryLine(product));
  return lines.join('\n');
}

function formatAmazonPromoPublication(product, flags = {}) {
  const lines = basePublicationLines(product, flags);
  const price = getBestPrice(product) || 'XX,XX€';
  const label = detectDiscountLabel(product);
  const coupon = shouldPrintCouponCode(label) && product.couponCode ? ` ${product.couponCode}` : '';
  lines.push(`💥 ${price} ${primePrefix(product)}${label}${coupon} (pvp ${getPvp(product)})`);

  const note = subscriptionNoteIfNeeded(label);
  if (note) lines.push(note);

  lines.push('');
  lines.push(categoryLine(product));
  return lines.join('\n');
}

function formatCouponDiscountPublication(product, flags = {}) {
  const lines = basePublicationLines(product, flags);
  const price = getBestPrice(product) || 'XX,XX€';
  const label = detectDiscountLabel(product);
  const coupon = shouldPrintCouponCode(label) && product.couponCode ? ` ${product.couponCode}` : '';
  lines.push(`💥 ${price} ${primePrefix(product)}${label}${coupon} (pvp ${getPvp(product)})`);
  lines.push('');
  lines.push(categoryLine(product));
  return lines.join('\n');
}

function detectUnitsPromoLabel(product) {
  const text = product.signals?.unitPromotionText || '';
  if (text === 'Obtenha 3 pelo preço de 2') {
    return '𝗠𝗔𝗜𝗦 𝗣𝗥𝗢𝗗𝗨𝗧𝗢𝗦 COMPRE 𝟯 e PAGUE 𝟮:';
  }
  if (text === 'Poupe 70% em 1 na compra de2') {
    return '𝗠𝗔𝗜𝗦 𝗣𝗥𝗢𝗗𝗨𝗧𝗢𝗦 2 UNIDADES com 𝟳𝟬% 𝗲𝗺 𝟭:';
  }
  if (text === 'Poupe 50% em 1 na compra de2') {
    return '𝗠𝗔𝗜𝗦 𝗣𝗥𝗢𝗗𝗨𝗧𝗢𝗦 2 UNIDADES com 𝟱𝟬% 𝗲𝗺 𝟭:';
  }
  return '';
}

function formatUnitsCheckoutPublication(product, flags = {}) {
  const s = product.signals || {};
  const usedSns = product.checkoutStrategy?.mode === 'sns_units' || product.checkoutStrategy?.mode === 'sns';
  const label = usedSns
    ? '𝘀𝘂𝗯𝘀𝗰𝗿𝗲𝘃𝗮 𝗲 𝗽𝗼𝘂𝗽𝗲 + desconto no checkout'
    : 'desconto no checkout';

  const unitsCount = flags.unitsCount || product.checkoutStrategy?.quantity || '2';
  const unitsLabel = flags.unitsLabel || 'un';
  const price = getBestPrice(product) || 'XX,XX€';
  const pvp = getUnitsPvp(product);
  const lines = basePublicationLines(product, flags);

  lines.push(`${unitsCount} ${unitsLabel} 💥 ${price} ${label} (pvp ${pvp})`);

  const note = subscriptionNoteIfNeeded(label);
  if (note) lines.push(note);

  const moreLabel = detectUnitsPromoLabel(product);
  if (moreLabel) {
    lines.push(`${moreLabel} ${product.affiliateUrl}`);
  }

  lines.push(categoryLine(product));
  return lines.join('\n');
}

function formatPublication(product, flags = {}) {
  // Flags manuais opcionais, equivalentes aos toggles do Text Blaze.
  const mergedFlags = {
    minimoHistorico: false,
    bomPreco: false,
    corrida: false,
    extraBeforeTitle: '',
    extraAfterTitle: '',
    unitPriceText: '',
    unitsCount: '',
    unitsLabel: '',
    ...flags,
  };

  if (product.promotionKind === 'units' || product.signals?.hasUnitsPromotion) {
    return formatUnitsCheckoutPublication(product, mergedFlags);
  }

  if (['sns', 'apply+sns', 'sns+checkout', 'apply+sns+checkout', 'sns+coupon'].includes(product.promotionKind)) {
    return formatAmazonPromoPublication(product, mergedFlags);
  }

  if (['apply', 'coupon', 'apply+coupon', 'apply+checkout', 'checkout'].includes(product.promotionKind)) {
    return formatCouponDiscountPublication(product, mergedFlags);
  }

  if (product.signals?.hasFlashSale || product.signals?.hasPrimeExclusive) {
    return formatFlashSalePublication(product, mergedFlags);
  }

  // Produto normal: usa formato simples, mas com label flash sale por defeito para manter parecido ao teu Text Blaze.
  return formatFlashSalePublication(product, mergedFlags);
}

// =====================================================
// FLUXO PRINCIPAL
// =====================================================

async function processProduct(context, url) {
  const page = context.pages()[0] || await context.newPage();

  console.log(`\n🔎 A abrir: ${url}`);
  const product = await scrapeProductPage(page, url);

  console.log(`📦 ${product.title || 'Sem título'}`);
  console.log(`🏷️ ASIN: ${product.asin || 'N/A'}`);
  console.log(`💶 Preço: ${product.price || product.snsPrice || 'N/A'} | PVP: ${product.pvp || 'N/A'}`);
  console.log(`🧠 Tipo: ${product.promotionKind} | Checkout: ${product.needsCheckout ? 'sim' : 'não'}`);

  if (product.needsCheckout) {
    console.log('🛒 A simular carrinho/checkout sem finalizar compra...');
    product.checkout = await simulateCheckout(page, product);
    console.log(`✅ Checkout: ${product.checkout.finalPrice || 'sem preço final'} ${product.checkout.error ? `| Erro: ${product.checkout.error}` : ''}`);
  }

  product.publication = formatPublication(product);
  return product;
}

async function main() {
  if (!PRODUCT_URLS.length) {
    console.log('⚠️ Edita o ficheiro e adiciona links em PRODUCT_URLS.');
    console.log('Exemplo:');
    console.log("const PRODUCT_URLS = ['https://www.amazon.es/dp/BXXXXXXXXX'];");
    return;
  }

  const context = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: HEADLESS,
    viewport: { width: 1366, height: 900 },
    locale: 'es-ES',
    timezoneId: 'Europe/Madrid',
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-sandbox',
      '--disable-dev-shm-usage',
    ],
  });

  const results = [];

  try {
    const page = context.pages()[0] || await context.newPage();
    await page.goto('https://www.amazon.es', { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
    await maybeClosePopups(page);

    for (const url of PRODUCT_URLS) {
      try {
        const result = await processProduct(context, url);
        results.push(result);
      } catch (err) {
        results.push({ sourceUrl: url, error: err?.message || String(err) });
        console.error(`❌ Erro em ${url}:`, err?.message || err);
      }
    }
  } finally {
    await context.close();
  }

  const publications = results
    .map((r, i) => r.publication ? `========== PRODUTO ${i + 1} ==========\n${r.publication}` : `========== PRODUTO ${i + 1} ==========\nERRO: ${r.error || 'desconhecido'}`)
    .join('\n\n');

  fs.writeFileSync(OUTPUT_TXT, publications, 'utf8');
  fs.writeFileSync(OUTPUT_JSON, JSON.stringify(results, null, 2), 'utf8');

  console.log(`\n📝 Publicações guardadas em: ${OUTPUT_TXT}`);
  console.log(`🧾 JSON guardado em: ${OUTPUT_JSON}`);
}

main().catch(err => {
  console.error('Erro fatal:', err);
  process.exit(1);
});
