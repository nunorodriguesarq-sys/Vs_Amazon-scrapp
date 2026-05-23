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
    'Cupón aplicado',
    'Cupão aplicado',
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

  const hasUnitsPromotion = includesAny(text, [
    'Obtén 3 por el precio de 2',
    'Obtén 3 por el precio de 2',
    'Obtenha 3 pelo preço de 2',
    'Compre 3 e pague 2',
    'Compra 3 y paga 2',
    'Compra 2 y paga 1',
    'Compre 2 e pague 1',
    'Poupe 50% em 1 na compra de 2',
    'Ahorra un 50% en 1 al comprar 2',
    'Poupe 70% em 1 na compra de 2',
    'Ahorra un 70% en 1 al comprar 2',
    '2 unidades',
    '3 por el precio de 2',
  ]);

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

function primePrefix(product) {
  return product.signals?.hasPrimeExclusive ? '𝙚𝙭𝙘𝙡𝙪𝙨𝙞𝙫𝙤 𝙥𝙧𝙞𝙢𝙚 + ' : '';
}

function subscriptionNoteIfNeeded(label) {
  if (!label || !label.includes('𝘀𝘂𝗯𝘀𝗰𝗿𝗲𝘃𝗮 𝗲 𝗽𝗼𝘂𝗽𝗲')) return '';
  return '𝑠𝑢𝑏𝑠𝑐𝑟𝑖𝑐̧𝑎̃𝑜 𝑐𝑎𝑛𝑐𝑒𝑙𝑎́𝑣𝑒𝑙 𝑎 𝑞𝑢𝑎𝑙𝑞𝑢𝑒𝑟 𝑎𝑙𝑡𝑢𝑟𝑎, 𝑠𝑒𝑚 𝑒𝑛𝑐𝑎𝑟𝑔𝑜𝑠';
}

function detectDiscountLabel(product) {
  const s = product.signals || {};
  if (s.hasAppliedCoupon) return 'aplicar desconto';
  if (s.hasSubscribeAndSave && product.couponCode) return '𝘀𝘂𝗯𝘀𝗰𝗿𝗲𝘃𝗮 𝗲 𝗽𝗼𝘂𝗽𝗲 + cupão:';
  if (s.hasSubscribeAndSave && s.hasApplyCoupon && s.hasCheckoutDiscount) return 'aplicar desconto + 𝘀𝘂𝗯𝘀𝗰𝗿𝗲𝘃𝗮 𝗲 𝗽𝗼𝘂𝗽𝗲 + desconto no checkout';
  if (s.hasSubscribeAndSave && s.hasCheckoutDiscount) return '𝘀𝘂𝗯𝘀𝗰𝗿𝗲𝘃𝗮 𝗲 𝗽𝗼𝘂𝗽𝗲 + desconto no checkout';
  if (s.hasSubscribeAndSave && s.hasApplyCoupon) return 'aplicar desconto + 𝘀𝘂𝗯𝘀𝗰𝗿𝗲𝘃𝗮 𝗲 𝗽𝗼𝘂𝗽𝗲';
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
  const body = `${product.checkout?.discountText || ''} ${(product.bullets || []).join(' ')} ${product.promotionKind || ''}`;
  const source = cleanSpaces(body);

  if (includesAny(source, ['3 pelo preço de 2', '3 por el precio de 2', 'Compre 3 e pague 2', 'Compra 3 y paga 2'])) {
    return '𝗠𝗔𝗜𝗦 𝗣𝗥𝗢𝗗𝗨𝗧𝗢𝗦 COMPRE 𝟯 e PAGUE 𝟮:';
  }
  if (includesAny(source, ['70% em 1', '70% en 1'])) {
    return '𝗠𝗔𝗜𝗦 𝗣𝗥𝗢𝗗𝗨𝗧𝗢𝗦 2 UNIDADES com 𝟳𝟬% 𝗲𝗺 𝟭:';
  }
  if (includesAny(source, ['50% em 1', '50% en 1'])) {
    return '𝗠𝗔𝗜𝗦 𝗣𝗥𝗢𝗗𝗨𝗧𝗢𝗦 2 UNIDADES com 𝟱𝟬% 𝗲𝗺 𝟭:';
  }
  if (includesAny(source, ['2 e pague 1', '2 y paga 1'])) {
    return '𝗠𝗔𝗜𝗦 𝗣𝗥𝗢𝗗𝗨𝗧𝗢𝗦 COMPRE com 𝟮 e PAGUE 𝟭:';
  }
  return '';
}

function formatUnitsCheckoutPublication(product, flags = {}) {
  const s = product.signals || {};
  const label = s.hasSubscribeAndSave
    ? '𝘀𝘂𝗯𝘀𝗰𝗿𝗲𝘃𝗮 𝗲 𝗽𝗼𝘂𝗽𝗲 + desconto no checkout'
    : 'desconto no checkout';

  const unitsCount = flags.unitsCount || '2';
  const unitsLabel = flags.unitsLabel || 'un';
  const price = getBestPrice(product) || 'XX,XX€';
  const pvp = getPvp(product);
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

  if (['apply', 'coupon', 'apply+coupon', 'apply+checkout', 'checkout'].includes(product.promotionKind)) {
    return formatCouponDiscountPublication(product, mergedFlags);
  }

  if (['sns', 'apply+sns', 'sns+checkout', 'apply+sns+checkout', 'sns+coupon'].includes(product.promotionKind)) {
    return formatAmazonPromoPublication(product, mergedFlags);
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
