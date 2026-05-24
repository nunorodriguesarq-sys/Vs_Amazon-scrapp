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
  {
    url: 'https://www.amazon.es/dp/B0GTM1R6CJ?th=1',
    couponCode: 'T7K9GGVF',
  },
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

  buyNow: [
    '#buy-now-button',
    'input[name="submit.buy-now"]',
    '#submit\\.buy-now input',
    'input[title*="Comprar já"]',
    'input[title*="Comprar ahora"]',
    'input[aria-labelledby*="submit.buy-now"]',
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

function cleanSpaces(text) {
  return String(text || '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeDynamicTextPart(text) {
  return String(text || '')
    .replace(/[\u00A0\u1680\u180E\u2000-\u200A\u202F\u205F\u3000]/g, ' ')
    .replace(/[ \t]{2,}/g, ' ')
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

function normalizeProductInput(input) {
  if (typeof input === 'string') {
    return {
      url: input,
      manualCouponCode: '',
      forceCheckout: false,
    };
  }

  return {
    url: input.url || input.href || '',
    manualCouponCode: input.couponCode || input.manualCouponCode || '',
    forceCheckout: Boolean(input.forceCheckout || input.couponCode || input.manualCouponCode),
  };
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

function shouldUseSubscribeAndSave(product) {
  return isSubscribeAndSaveCheaper(product);
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
  const snsCheaper = shouldUseSubscribeAndSave(product);

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

function isSameAsinUrl(url, asin) {
  if (!url || !asin) return false;
  return extractAsinFromUrl(url) === asin;
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

async function scrapeProductPage(page, productUrl, productInput = {}) {
  await page.goto(productUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await maybeClosePopups(page);
  await page.waitForLoadState('networkidle', { timeout: 7000 }).catch(() => {});

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
  const hasCouponCheckboxDom = await page.locator([
    'input[id^="checkmarkpctch"]',
    '[id^="checkmarkpctch"]',
    'input[type="checkbox"][id*="pctch"]',
    'label:has-text("Aplicar cupão")',
    'label:has-text("Aplicar cupón")',
    'span:has-text("Aplicar cupão")',
    'span:has-text("Aplicar cupón")'
  ].join(',')).count().catch(() => 0) > 0;

  const detectedCouponCode = detectCouponCode(bodyText);
  const couponCode = productInput.manualCouponCode || detectedCouponCode;
  const signals = detectSignals({ bodyText, primeText, primeDayText, price, snsPrice, pvp });
  if (productInput.manualCouponCode) {
    signals.hasManualCouponCode = true;
    signals.hasCouponCodeOnlyAtCheckout = true;
  }
  const snsCheaper = shouldUseSubscribeAndSave({ price, snsPrice });
  signals.snsCheaper = snsCheaper;
  signals.useSubscribeAndSave = Boolean(signals.hasSubscribeAndSave && snsCheaper);
  signals.hasCouponCheckboxDom = hasCouponCheckboxDom;
  if (hasCouponCheckboxDom) signals.hasApplyCoupon = true;
  let promotionKind = detectPromotionKind({ ...signals, couponCode, bodyText });
  if (productInput.manualCouponCode && signals.hasCouponCheckboxDom) {
    promotionKind = 'apply+coupon';
  } else if (productInput.manualCouponCode) {
    promotionKind = 'coupon';
  }
  const needsCheckout =
    productInput.forceCheckout ||
    Boolean(productInput.manualCouponCode) ||
    shouldSimulateCheckout({ ...signals, couponCode, bodyText, promotionKind, price });
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
    manualInput: productInput,
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


function hasRealCouponCheckboxText(text) {
  const clean = cleanSpaces(text).toLowerCase();

  return (
    clean.includes('aplicar cupón') ||
    clean.includes('aplicar cupão') ||
    clean.includes('aplicar cupom') ||
    clean.includes('cupón aplicado') ||
    clean.includes('cupão aplicado') ||
    clean.includes('cupom aplicado') ||
    /cup[oó]n\s+de\s+\d+\s*%\s+de\s+descuento\s+aplicado/i.test(text) ||
    /cup[aã]o\s+de\s+\d+\s*%\s+de\s+desconto\s+aplicado/i.test(text) ||
    /cup[oó]n\s+de\s+\d+[\.,]?\d*\s*€\s+de\s+descuento\s+aplicado/i.test(text) ||
    /cup[aã]o\s+de\s+\d+[\.,]?\d*\s*€\s+de\s+desconto\s+aplicado/i.test(text)
  );
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

  const hasApplyCoupon = hasAppliedCoupon || hasRealCouponCheckboxText(text);

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
  useSubscribeAndSave,
  hasApplyCoupon,
  hasAppliedCoupon,
  hasCouponCheckboxDom,
  hasCheckoutDiscount,
  hasFlashSale,
  hasUnitsPromotion,
  hasCouponCodeOnlyAtCheckout,
  couponCode,
}) {
  if (hasUnitsPromotion) return 'units';

  if (useSubscribeAndSave && hasApplyCoupon && hasCheckoutDiscount) return 'apply+sns+checkout';
  if (useSubscribeAndSave && hasCheckoutDiscount) return 'sns+checkout';
  if (useSubscribeAndSave && hasApplyCoupon) return 'apply+sns';
  if (useSubscribeAndSave && couponCode) return 'sns+coupon';
  if (useSubscribeAndSave) return 'sns';

  if (hasAppliedCoupon || hasCouponCheckboxDom) return 'apply';
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
  useSubscribeAndSave,
  hasApplyCoupon,
  hasAppliedCoupon,
  hasCouponCheckboxDom,
  promotionKind,
  price,
}) {
  if (hasUnitsPromotion) return true;
  if (hasAppliedCoupon) return true;
  if (hasCouponCheckboxDom) return true;
  if (hasCheckoutDiscount) return true;
  if (hasCouponCodeOnlyAtCheckout) return true;
  if (promotionKind && promotionKind.includes('checkout')) return true;
  if (useSubscribeAndSave && hasApplyCoupon) return true;
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
    selector: '',
    method: '',
    text: '',
    error: '',
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
    'input[id^="checkmarkpctch"]',
    '[id^="checkmarkpctch"]',
    'input[type="checkbox"][id*="pctch"]',
    'label:has-text("Aplicar cupão")',
    'label:has-text("Aplicar cupón")',
    'span:has-text("Aplicar cupão")',
    'span:has-text("Aplicar cupón")',
  ];

  for (const selector of checkboxSelectors) {
    const loc = page.locator(selector).first();

    if (await loc.count().catch(() => 0)) {
      result.found = true;
      result.selector = selector;
      result.text = cleanSpaces(await loc.innerText({ timeout: 1500 }).catch(() => ''));

      const clickResult = await clickLocatorRobust(loc, { selector });
      if (!clickResult.clicked) {
        result.error = clickResult.error || `Falha ao clicar em ${selector}`;
        continue;
      }

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

async function simulateCheckout(page, product, options = {}) {
  const assumeAlreadyOnProductPage = Boolean(options.assumeAlreadyOnProductPage);
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
    const currentPageUrl = page.url();
    const alreadyOnSameProduct =
      assumeAlreadyOnProductPage &&
      isSameAsinUrl(currentPageUrl, product.asin);

    if (!alreadyOnSameProduct) {
      console.log('↻ Checkout: página atual não corresponde ao produto, a recarregar URL.');
      await page.goto(product.currentUrl || product.sourceUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await maybeClosePopups(page);
      await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
    } else {
      console.log('⚡ Checkout: reutilizando página do produto já aberta.');
      await maybeClosePopups(page);
    }
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
      product.signals?.hasCouponCheckboxDom ||
      product.promotionKind === 'apply' ||
      product.promotionKind === 'apply+coupon' ||
      product.promotionKind?.includes('apply')
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

    await page.waitForLoadState('domcontentloaded', { timeout: 25000 }).catch(() => {});
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(2000);

    if (product.manualInput?.manualCouponCode) {
      result.couponCodeApply = await applyCouponCodeAtCheckout(page, product.manualInput.manualCouponCode);

      if (result.couponCodeApply?.submitted) {
        await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
        await page.waitForTimeout(2000);
      }

      if (result.couponCodeApply?.submitted) {
        await page.waitForTimeout(2000);
        result.afterCouponReturnUrl = page.url();
        result.afterCouponReachedSummary = await isCheckoutSummaryPage(page);
      }
    }

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

function interpretCouponMessage(text) {
  const lower = cleanSpaces(text).toLowerCase();

  if (!lower) return 'unknown';

  if (
    lower.includes('aplicado') ||
    lower.includes('aplicada') ||
    lower.includes('aplicou') ||
    lower.includes('aplicará') ||
    lower.includes('se aplicará') ||
    lower.includes('desconto aplicado') ||
    lower.includes('promoção aplicada') ||
    lower.includes('promoción aplicada')
  ) {
    return 'accepted';
  }

  if (
    lower.includes('não') ||
    lower.includes('no se') ||
    lower.includes('inválido') ||
    lower.includes('inválida') ||
    lower.includes('invalido') ||
    lower.includes('invalida') ||
    lower.includes('caducado') ||
    lower.includes('expirado') ||
    lower.includes('não é aplicável') ||
    lower.includes('no es aplicable')
  ) {
    return 'rejected';
  }

  return 'unknown';
}

async function waitForCouponApplyMessage(page, timeout = 12000) {
  const ignoredTexts = [
    'adicionar um cartão oferta',
    'adicionar um cartao oferta',
    'um código promocional ou um voucher',
    'um codigo promocional ou um voucher',
    'inserir código',
    'inserir codigo',
    'introduzir código',
    'introducir código',
    'cartão oferta',
    'cartao oferta',
    'voucher',
  ];

  const messageCandidates = [
    {
      locator: page.locator('[data-testid*="claim-code"] span'),
      selector: '[data-testid*="claim-code"] span',
    },
    {
      locator: page.locator('[data-testid*="claim-code"] div'),
      selector: '[data-testid*="claim-code"] div',
    },
    {
      locator: page.locator('[id] div.css-146c3p1 span'),
      selector: '[id] div.css-146c3p1 span',
    },
    {
      locator: page.locator('[id] div.css-146c3p1'),
      selector: '[id] div.css-146c3p1',
    },
    {
      locator: page.locator('span:has-text("aplicado")'),
      selector: 'span:has-text("aplicado")',
    },
    {
      locator: page.locator('span:has-text("aplicada")'),
      selector: 'span:has-text("aplicada")',
    },
    {
      locator: page.locator('span:has-text("não")'),
      selector: 'span:has-text("não")',
    },
    {
      locator: page.locator('span:has-text("no se")'),
      selector: 'span:has-text("no se")',
    },
    {
      locator: page.locator('span:has-text("inválido")'),
      selector: 'span:has-text("inválido")',
    },
    {
      locator: page.locator('span:has-text("inválida")'),
      selector: 'span:has-text("inválida")',
    },
    {
      locator: page.locator('span:has-text("caducado")'),
      selector: 'span:has-text("caducado")',
    },
    {
      locator: page.locator('span:has-text("expirado")'),
      selector: 'span:has-text("expirado")',
    },
  ];

  const start = Date.now();

  while (Date.now() - start < timeout) {
    for (const item of messageCandidates) {
      const count = await item.locator.count().catch(() => 0);
      if (!count) continue;

      for (let i = 0; i < count; i++) {
        const loc = item.locator.nth(i);
        const visible = await loc.isVisible().catch(() => false);
        if (!visible) continue;

        const text = cleanSpaces(await loc.innerText({ timeout: 1000 }).catch(() => ''));
        if (!text) continue;

        const lower = text.toLowerCase();

        if (ignoredTexts.some(t => lower.includes(t))) {
          continue;
        }

        const looksLikeRealCouponMessage =
          lower.includes('aplicado') ||
          lower.includes('aplicada') ||
          lower.includes('aplicará') ||
          lower.includes('se aplicará') ||
          lower.includes('desconto aplicado') ||
          lower.includes('promoção aplicada') ||
          lower.includes('promoción aplicada') ||
          lower.includes('não é aplicável') ||
          lower.includes('no es aplicable') ||
          lower.includes('não foi possível') ||
          lower.includes('no se ha podido') ||
          lower.includes('no se puede') ||
          lower.includes('inválido') ||
          lower.includes('inválida') ||
          lower.includes('invalido') ||
          lower.includes('invalida') ||
          lower.includes('caducado') ||
          lower.includes('expirado') ||
          lower.includes('código') && lower.includes('não') ||
          lower.includes('codigo') && lower.includes('não') ||
          lower.includes('código') && lower.includes('no se') ||
          lower.includes('codigo') && lower.includes('no se');

        if (looksLikeRealCouponMessage) {
          return {
            found: true,
            selector: item.selector,
            text,
          };
        }
      }
    }

    await page.waitForTimeout(300);
  }

  return {
    found: false,
    selector: '',
    text: '',
  };
}

async function isCheckoutSummaryPage(page) {
  const url = page.url();

  if (url.includes('/checkout/') && !url.includes('/pay')) {
    return true;
  }

  const summarySelectors = [
    '[data-shimmer-target="ordertotals-amount"]',
    '.order-summary-line-definition [data-shimmer-target="ordertotals-amount"]',
    '#subtotals-marketplace-table [data-shimmer-target="ordertotals-amount"]',
    'text=/Total do pedido/i',
    'text=/Total del pedido/i',
    'text=/Faça o seu pedido/i',
    'text=/Realizar pedido/i',
  ];

  for (const selector of summarySelectors) {
    const count = await page.locator(selector).count().catch(() => 0);
    if (count > 0) return true;
  }

  return false;
}

async function clickUseThisPaymentMethod(page) {
  const result = {
    clicked: false,
    selector: '',
    method: '',
    beforeUrl: page.url(),
    afterUrl: '',
    reachedSummaryAfterClick: false,
    attempts: [],
    error: '',
  };

  const candidates = [
    {
      locator: page.getByTestId('bottom-continue-button'),
      selector: 'testid=bottom-continue-button',
    },
    {
      locator: page.locator('[data-testid="bottom-continue-button"]'),
      selector: '[data-testid="bottom-continue-button"]',
    },
    {
      locator: page.getByRole('button', { name: /Utilizar esta forma de pagamento/i }),
      selector: 'role=button[name~/Utilizar esta forma de pagamento/i]',
    },
    {
      locator: page.locator('button:has-text("Utilizar esta forma de pagamento")'),
      selector: 'button:has-text("Utilizar esta forma de pagamento")',
    },
    {
      locator: page.getByText(/Utilizar esta forma de pagamento/i),
      selector: 'text=/Utilizar esta forma de pagamento/i',
    },
    {
      locator: page.getByTestId('secondary-continue-button'),
      selector: 'testid=secondary-continue-button',
    },
    {
      locator: page.locator('[data-testid="secondary-continue-button"]'),
      selector: '[data-testid="secondary-continue-button"]',
    },
    {
      locator: page.locator('#checkout-secondary-continue-button-id input'),
      selector: '#checkout-secondary-continue-button-id input',
    },
    {
      locator: page.locator('#checkout-secondary-continue-button-id'),
      selector: '#checkout-secondary-continue-button-id',
    },
    {
      locator: page.locator('#checkout-secondary-continue-button-id-announce'),
      selector: '#checkout-secondary-continue-button-id-announce',
    },
    {
      locator: page.getByRole('button', { name: /Usar este método de pago/i }),
      selector: 'role=button[name~/Usar este método de pago/i]',
    },
    {
      locator: page.getByText(/Usar este método de pago/i),
      selector: 'text=/Usar este método de pago/i',
    },
  ];

  for (const item of candidates) {
    const count = await item.locator.count().catch(() => 0);
    if (!count) continue;

    for (let i = 0; i < count; i++) {
      const loc = item.locator.nth(i);
      const visible = await loc.isVisible().catch(() => false);
      if (!visible) continue;

      const attempt = {
        selector: item.selector,
        clicked: false,
        method: '',
        beforeUrl: page.url(),
        afterUrl: '',
        reachedSummaryAfterClick: false,
        error: '',
      };

      const clickResult = await clickLocatorRobust(loc, {
        selector: item.selector,
      });

      attempt.clicked = clickResult.clicked;
      attempt.method = clickResult.method || '';
      attempt.error = clickResult.error || '';

      if (!clickResult.clicked) {
        result.attempts.push(attempt);
        continue;
      }

      await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => {});
      await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
      await page.waitForTimeout(3000);

      attempt.afterUrl = page.url();
      attempt.reachedSummaryAfterClick = await isCheckoutSummaryPage(page);

      result.attempts.push(attempt);

      if (attempt.reachedSummaryAfterClick || !attempt.afterUrl.includes('/pay')) {
        result.clicked = true;
        result.selector = item.selector;
        result.method = clickResult.method;
        result.afterUrl = attempt.afterUrl;
        result.reachedSummaryAfterClick = attempt.reachedSummaryAfterClick;
        return result;
      }
    }
  }

  result.afterUrl = page.url();
  result.error = 'Cliquei/tentei os botões de continuar, mas não consegui sair da etapa de pagamento para o resumo.';
  return result;
}


async function applyCouponCodeAtCheckout(page, couponCode) {
  const result = {
    attempted: Boolean(couponCode),
    code: couponCode || '',
    openedSection: false,
    foundInput: false,
    filled: false,
    submitted: false,
    openSelector: '',
    innerOpenSelector: '',
    selector: '',
    buttonSelector: '',
    method: '',
    couponPressableSelector: '',
    couponPressableClicked: false,
    couponMessageFound: false,
    couponMessageSelector: '',
    couponMessageText: '',
    couponMessageStatus: 'unknown',
    continuedAfterCouponMessage: false,
    error: '',
  };

  if (!couponCode) return result;

  try {
    const inputCandidates = [
      { locator: page.getByTestId('input-claim-code-text-input'), selector: 'testid=input-claim-code-text-input' },
      { locator: page.locator('[data-testid="input-claim-code-text-input"]'), selector: '[data-testid="input-claim-code-text-input"]' },
      { locator: page.locator('input[name="claimCode"]'), selector: 'input[name="claimCode"]' },
      { locator: page.locator('input[name="giftCardPromotionCode"]'), selector: 'input[name="giftCardPromotionCode"]' },
      { locator: page.locator('input[id*="claim"]'), selector: 'input[id*="claim"]' },
      { locator: page.locator('input[id*="Claim"]'), selector: 'input[id*="Claim"]' },
      { locator: page.locator('input[id*="promo"]'), selector: 'input[id*="promo"]' },
      { locator: page.locator('input[id*="Promo"]'), selector: 'input[id*="Promo"]' },
      { locator: page.locator('input[id*="coupon"]'), selector: 'input[id*="coupon"]' },
      { locator: page.locator('input[id*="Coupon"]'), selector: 'input[id*="Coupon"]' },
      { locator: page.locator('input[placeholder*="código"]'), selector: 'input[placeholder*="código"]' },
      { locator: page.locator('input[placeholder*="Código"]'), selector: 'input[placeholder*="Código"]' },
      { locator: page.locator('input[aria-label*="código"]'), selector: 'input[aria-label*="código"]' },
      { locator: page.locator('input[aria-label*="Código"]'), selector: 'input[aria-label*="Código"]' },
    ];

    let inputMatch = await waitForFirstAvailableLocator(page, inputCandidates, 1500);

    const openCandidates = [
      { locator: page.getByRole('link', { name: /Utilize um cartão oferta/i }), selector: 'role=link[name~/Utilize um cartão oferta/i]' },
      { locator: page.getByRole('link', { name: /Usar una tarjeta regalo/i }), selector: 'role=link[name~/Usar una tarjeta regalo/i]' },
      { locator: page.getByRole('link', { name: /tarjeta regalo/i }), selector: 'role=link[name~/tarjeta regalo/i]' },
      { locator: page.getByRole('link', { name: /cartão oferta/i }), selector: 'role=link[name~/cartão oferta/i]' },
      { locator: page.getByText(/Utilize um cartão oferta/i), selector: 'text=/Utilize um cartão oferta/i' },
      { locator: page.getByText(/Usar una tarjeta regalo/i), selector: 'text=/Usar una tarjeta regalo/i' },
      { locator: page.getByText(/código promocional/i), selector: 'text=/código promocional/i' },
      { locator: page.getByText(/código de promoción/i), selector: 'text=/código de promoción/i' },
    ];

    if (!inputMatch) {
      for (const item of openCandidates) {
        const count = await item.locator.count().catch(() => 0);
        for (let i = 0; i < count; i++) {
          const el = item.locator.nth(i);
          const clickResult = await clickLocatorRobust(el, { selector: item.selector });
          if (clickResult.clicked) {
            result.openedSection = true;
            result.openSelector = item.selector;
            result.method = clickResult.method;
            inputMatch = await waitForFirstAvailableLocator(page, inputCandidates, 8000);
            break;
          }
        }
        if (result.openedSection) break;
      }
    }

    if (!inputMatch) {
      const innerOpenCandidates = [
        {
          locator: page.locator('.css-g5y9jx.r-1otgn73 > div > div > .css-g5y9jx.r-1loqt21 > div:nth-child(3)'),
          selector: '.css-g5y9jx.r-1otgn73 > div > div > .css-g5y9jx.r-1loqt21 > div:nth-child(3)',
        },
        { locator: page.getByText(/voucher ou código promocional/i), selector: 'text=/voucher ou código promocional/i' },
        { locator: page.getByText(/cartão oferta/i), selector: 'text=/cartão oferta/i' },
        { locator: page.getByText(/código promocional/i), selector: 'text=/código promocional/i' },
        { locator: page.getByText(/código de promoción/i), selector: 'text=/código de promoción/i' },
        { locator: page.getByText(/Introduzir código/i), selector: 'text=/Introduzir código/i' },
        { locator: page.getByText(/Introducir código/i), selector: 'text=/Introducir código/i' },
        { locator: page.getByText(/Adicionar código/i), selector: 'text=/Adicionar código/i' },
        { locator: page.getByText(/Añadir código/i), selector: 'text=/Añadir código/i' },
      ];

      for (const item of innerOpenCandidates) {
        const count = await item.locator.count().catch(() => 0);
        for (let i = 0; i < count; i++) {
          const el = item.locator.nth(i);
          const clickResult = await clickLocatorRobust(el, { selector: item.selector });
          if (clickResult.clicked) {
            result.innerOpenSelector = item.selector;
            inputMatch = await waitForFirstAvailableLocator(page, inputCandidates, 8000);
            break;
          }
        }
        if (inputMatch) break;
      }
    }

    if (!inputMatch) {
      inputMatch = await waitForFirstAvailableLocator(page, inputCandidates, 8000);
    }

    if (!inputMatch) {
      result.error = 'Não encontrei/preenchi o campo do código de cupão no checkout.';
      return result;
    }

    const input = inputMatch.locator;
    result.foundInput = true;
    result.selector = inputMatch.selector;

    await input.scrollIntoViewIfNeeded().catch(() => {});
    await input.click({ timeout: 5000, force: true }).catch(() => {});
    await page.waitForTimeout(300);

    await input.fill('', { timeout: 5000 }).catch(() => {});
    await input.fill(couponCode, { timeout: 5000 }).catch(async () => {
      await input.click({ timeout: 5000, force: true }).catch(() => {});
      await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A').catch(() => {});
      await page.keyboard.type(couponCode).catch(async () => {
        await input.pressSequentially(couponCode).catch(() => {});
      });
    });

    const inputValue = await input.inputValue().catch(() => '');
    result.filled = inputValue.trim().toUpperCase() === String(couponCode).trim().toUpperCase();

    if (!result.filled) {
      result.error = `Campo encontrado mas valor não ficou correto. Valor atual: ${inputValue}`;
      return result;
    }

    const applyCodeCandidates = [
      { locator: page.getByTestId('input-claim-code-pressable'), selector: 'testid=input-claim-code-pressable' },
      { locator: page.locator('[data-testid="input-claim-code-pressable"]'), selector: '[data-testid="input-claim-code-pressable"]' },
      { locator: page.locator('button[aria-label*="Aplicar"]'), selector: 'button[aria-label*="Aplicar"]' },
      { locator: page.locator('button[aria-label*="Apply"]'), selector: 'button[aria-label*="Apply"]' },
      { locator: page.locator('button:has-text("Aplicar")'), selector: 'button:has-text("Aplicar")' },
      { locator: page.locator('button:has-text("Apply")'), selector: 'button:has-text("Apply")' },
    ];

    const applyCodeButton = await waitForFirstAvailableLocator(page, applyCodeCandidates, 8000);

    if (!applyCodeButton) {
      result.error = 'Cupão preenchido, mas não encontrei a seta/botão para aplicar o código.';
      return result;
    }

    const applyCodeClick = await clickLocatorRobust(applyCodeButton.locator, {
      selector: applyCodeButton.selector,
    });

    if (!applyCodeClick.clicked) {
      result.error = applyCodeClick.error || 'Falha ao clicar na seta/botão de aplicar código.';
      return result;
    }

    result.couponPressableClicked = true;
    result.couponPressableSelector = applyCodeButton.selector;

    const message = await waitForCouponApplyMessage(page, 12000);

    result.couponMessageFound = message.found;
    result.couponMessageSelector = message.selector;
    result.couponMessageText = message.text;

    if (!message.found) {
      result.error = 'Código preenchido e botão aplicar clicado, mas não surgiu mensagem de validação do cupão.';
      return result;
    }

    result.couponMessageStatus = interpretCouponMessage(message.text);

    if (result.couponMessageStatus === 'unknown') {
      result.error = `Mensagem do cupão encontrada, mas não conclusiva: ${message.text}`;
      return result;
    }

    const continueResult = await clickUseThisPaymentMethod(page);

    result.continueClick = continueResult;

    if (continueResult.clicked) {
      result.submitted = true;
      result.continuedAfterCouponMessage = true;
      result.buttonSelector = continueResult.selector;
      result.method = continueResult.method;
      result.afterContinueUrl = continueResult.afterUrl;
      result.reachedSummaryAfterContinue = continueResult.reachedSummaryAfterClick;
      return result;
    }

    result.error = continueResult.error || 'Falha ao clicar em "Utilizar esta forma de pagamento".';
    return result;


  } catch (err) {
    result.error = err?.message || String(err);
    return result;
  }
}

async function waitForFirstAvailableLocator(page, candidates, timeout = 8000) {
  const start = Date.now();

  while (Date.now() - start < timeout) {
    for (const item of candidates) {
      const count = await item.locator.count().catch(() => 0);
      if (!count) continue;

      for (let i = 0; i < count; i++) {
        const loc = item.locator.nth(i);
        const visible = await loc.isVisible().catch(() => false);

        if (visible || item.allowHidden) {
          return {
            locator: loc,
            selector: item.selector,
            index: i,
            visible,
          };
        }
      }
    }

    await page.waitForTimeout(300);
  }

  return null;
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

// =====================================================
// FORMATAÇÃO DAS PUBLICAÇÕES
// =====================================================


const LABEL_FLASH_SALE = '𝗳𝗹𝗮𝘀𝗵 𝘀𝗮𝗹𝗲';
const LABEL_SNS = '𝘀𝘂𝗯𝘀𝗰𝗿𝗲𝘃𝗮 𝗲 𝗽𝗼𝘂𝗽𝗲';
const LABEL_APPLY_DISCOUNT = 'aplicar desconto';
const LABEL_CHECKOUT_DISCOUNT = 'desconto no checkout';
const LABEL_APPLY_SNS = `aplicar desconto + ${LABEL_SNS}`;
const LABEL_SNS_CHECKOUT = `${LABEL_SNS} + desconto no checkout`;
const LABEL_APPLY_SNS_CHECKOUT = `aplicar desconto + ${LABEL_SNS} + desconto no checkout`;
const LABEL_EXCLUSIVE_PRIME = '𝙚𝙭𝙘𝙡𝙪𝙨𝙞𝙫𝙤 𝙥𝙧𝙞𝙢𝙚';

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
  const useSns = Boolean(product.signals?.useSubscribeAndSave);

  return ensureEuro(
    product.checkout?.finalPrice ||
    (useSns ? product.snsPrice : '') ||
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

function isSubscribeAndSaveLabel(label) {
  const raw = String(label || '').trim();

  return [
    LABEL_SNS,
    LABEL_APPLY_SNS,
    LABEL_SNS_CHECKOUT,
    LABEL_APPLY_SNS_CHECKOUT,
    `${LABEL_SNS} + cupão:`,
  ].includes(raw);
}

function subscriptionNoteIfNeeded(label) {
  if (!isSubscribeAndSaveLabel(label)) return '';

  return '𝑠𝑢𝑏𝑠𝑐𝑟𝑖𝑐̧𝑎̃𝑜 𝑐𝑎𝑛𝑐𝑒𝑙𝑎́𝑣𝑒𝑙 𝑎 𝑞𝑢𝑎𝑙𝑞𝑢𝑒𝑟 𝑎𝑙𝑡𝑢𝑟𝑎, 𝑠𝑒𝑚 𝑒𝑛𝑐𝑎𝑟𝑔𝑜𝑠';
}

function detectDiscountLabel(product) {
  const s = product.signals || {};
  if (product.manualInput?.manualCouponCode && product.promotionKind === 'apply+coupon') {
    return 'aplicar desconto + cupão:';
  }

  if (product.manualInput?.manualCouponCode && product.promotionKind === 'coupon') {
    return 'cupão:';
  }

  if (product.promotionKind === 'apply+sns') {
    return LABEL_APPLY_SNS;
  }

  if (product.promotionKind === 'apply+sns+checkout') {
    return LABEL_APPLY_SNS_CHECKOUT;
  }

  if (s.useSubscribeAndSave && s.hasApplyCoupon) {
    return s.hasCheckoutDiscount
      ? LABEL_APPLY_SNS_CHECKOUT
      : LABEL_APPLY_SNS;
  }

  if (s.hasAppliedCoupon) return LABEL_APPLY_DISCOUNT;
  if (s.useSubscribeAndSave && product.couponCode) return `${LABEL_SNS} + cupão:`;
  if (s.useSubscribeAndSave && s.hasCheckoutDiscount) return LABEL_SNS_CHECKOUT;
  if (s.useSubscribeAndSave) return LABEL_SNS;
  if (s.hasApplyCoupon && product.couponCode) return 'aplicar desconto + cupão:';
  if (s.hasApplyCoupon && s.hasCheckoutDiscount) return 'aplicar desconto + desconto no checkout';
  if (s.hasCheckoutDiscount) return LABEL_CHECKOUT_DISCOUNT;
  if (s.hasApplyCoupon) return LABEL_APPLY_DISCOUNT;
  if (product.couponCode) return 'cupão:';
  if (s.hasFlashSale) return LABEL_FLASH_SALE;

  return LABEL_FLASH_SALE;
}

function shouldPrintCouponCode(label) {
  return ![
    LABEL_APPLY_DISCOUNT,
    LABEL_CHECKOUT_DISCOUNT,
    'aplicar desconto + desconto no checkout',
    LABEL_FLASH_SALE,
    LABEL_SNS,
    LABEL_APPLY_SNS,
    LABEL_SNS_CHECKOUT,
    LABEL_APPLY_SNS_CHECKOUT,
  ].includes(label);
}

function buildPriceLine({ prefix = '💥', price, label, pvp, coupon = '', primePrefixText = '' }) {
  const safePrefix = normalizeDynamicTextPart(prefix);
  const safePrice = normalizeDynamicTextPart(price);
  const safePvp = normalizeDynamicTextPart(pvp);
  const safeCoupon = coupon ? ` ${normalizeDynamicTextPart(coupon)}` : '';
  const safePrimePrefix = primePrefixText || '';

  // Importante:
  // Não normalizar o label internamente.
  // Apenas remover espaços estranhos no início/fim.
  const safeLabel = String(label || '').trim();

  return `${safePrefix} ${safePrice} ${safePrimePrefix}${safeLabel}${safeCoupon} (pvp ${safePvp})`;
}

function formatFlashSalePublication(product, flags = {}) {
  const lines = basePublicationLines(product, flags);
  const price = getBestPrice(product) || 'XX,XX€';
  const label = product.signals?.hasPrimeExclusive ? LABEL_EXCLUSIVE_PRIME : LABEL_FLASH_SALE;

  lines.push(buildPriceLine({
    price,
    label,
    pvp: getPvp(product),
  }));

  lines.push('');
  lines.push(categoryLine(product));
  return lines.join('\n');
}

function formatAmazonPromoPublication(product, flags = {}) {
  const lines = basePublicationLines(product, flags);
  const price = getBestPrice(product) || 'XX,XX€';
  const label = detectDiscountLabel(product);
  lines.push(buildPriceLine({
    price,
    label,
    pvp: getPvp(product),
    coupon: shouldPrintCouponCode(label) && product.couponCode ? product.couponCode : '',
    primePrefixText: primePrefix(product),
  }));

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
  lines.push(buildPriceLine({
    price,
    label,
    pvp: getPvp(product),
    coupon: shouldPrintCouponCode(label) && product.couponCode ? product.couponCode : '',
    primePrefixText: primePrefix(product),
  }));
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
    ? LABEL_SNS_CHECKOUT
    : LABEL_CHECKOUT_DISCOUNT;

  const unitsCount = flags.unitsCount || product.checkoutStrategy?.quantity || '2';
  const unitsLabel = flags.unitsLabel || 'un';
  const price = getBestPrice(product) || 'XX,XX€';
  const pvp = getUnitsPvp(product);
  const lines = basePublicationLines(product, flags);

  lines.push(`${normalizeDynamicTextPart(unitsCount)} ${normalizeDynamicTextPart(unitsLabel)} ${buildPriceLine({
    price,
    label,
    pvp,
  })}`);

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

  if (
    product.signals?.useSubscribeAndSave &&
    ['sns', 'apply+sns', 'sns+checkout', 'apply+sns+checkout', 'sns+coupon'].includes(product.promotionKind)
  ) {
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

async function processProduct(context, input, page) {
  const productInput = normalizeProductInput(input);
  const url = productInput.url;
  const activePage = page || context.pages()[0] || await context.newPage();

  console.log(`\n🔎 A abrir: ${url}`);
  const product = await scrapeProductPage(activePage, url, productInput);

  console.log(`📦 ${product.title || 'Sem título'}`);
  console.log(`🏷️ ASIN: ${product.asin || 'N/A'}`);
  console.log(`💶 Preço: ${product.price || product.snsPrice || 'N/A'} | PVP: ${product.pvp || 'N/A'}`);
  console.log(`🧠 Tipo: ${product.promotionKind} | Checkout: ${product.needsCheckout ? 'sim' : 'não'}`);

  if (product.needsCheckout) {
    console.log('🛒 A simular carrinho/checkout sem finalizar compra...');
    product.checkout = await simulateCheckout(activePage, product, {
      assumeAlreadyOnProductPage: true,
    });
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

    for (const url of PRODUCT_URLS) {
      try {
        const result = await processProduct(context, url, page);
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
