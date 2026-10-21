import { APP_NAME, getMessages, type Locale } from './lib/i18n'

/**
 * Search-engine metadata and crawlable static content for each language's
 * page. Used at build time (vite.config.ts) to fill index.html and generate
 * ja/index.html; texts come from the i18n catalogs so the static HTML matches
 * what the app renders.
 */

/** Production origin. Change here when moving to a custom domain. */
export const SITE_URL = 'https://nucleotide-viewer.web.app'

export const PAGES: Record<Locale, { path: string; ogLocale: string }> = {
  en: { path: '/', ogLocale: 'en_US' },
  ja: { path: '/ja/', ogLocale: 'ja_JP' },
}

const OG_IMAGE = { path: '/og-image.png', width: 1200, height: 630 }

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const url = (path: string) => `${SITE_URL}${path}`

export function renderSeoHead(locale: Locale): string {
  const t = getMessages(locale)
  const page = PAGES[locale]
  const other: Locale = locale === 'en' ? 'ja' : 'en'
  const description = escapeHtml(t.seoDescription)
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: APP_NAME,
    url: url(page.path),
    description: t.seoDescription,
    applicationCategory: 'UtilitiesApplication',
    operatingSystem: 'Any',
    browserRequirements: 'Requires JavaScript',
    inLanguage: ['en', 'ja'],
    isAccessibleForFree: true,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    featureList: t.landingFeatures.map((f) => f.title),
    image: url(OG_IMAGE.path),
  }
  return [
    `<title>${escapeHtml(APP_NAME)}</title>`,
    `<meta name="description" content="${description}" />`,
    `<link rel="canonical" href="${url(page.path)}" />`,
    `<link rel="alternate" hreflang="en" href="${url(PAGES.en.path)}" />`,
    `<link rel="alternate" hreflang="ja" href="${url(PAGES.ja.path)}" />`,
    `<link rel="alternate" hreflang="x-default" href="${url(PAGES.en.path)}" />`,
    `<meta name="theme-color" media="(prefers-color-scheme: light)" content="#ffffff" />`,
    `<meta name="theme-color" media="(prefers-color-scheme: dark)" content="#0a0a0a" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="${escapeHtml(APP_NAME)}" />`,
    `<meta property="og:title" content="${escapeHtml(APP_NAME)}" />`,
    `<meta property="og:description" content="${description}" />`,
    `<meta property="og:url" content="${url(page.path)}" />`,
    `<meta property="og:locale" content="${page.ogLocale}" />`,
    `<meta property="og:locale:alternate" content="${PAGES[other].ogLocale}" />`,
    `<meta property="og:image" content="${url(OG_IMAGE.path)}" />`,
    `<meta property="og:image:width" content="${OG_IMAGE.width}" />`,
    `<meta property="og:image:height" content="${OG_IMAGE.height}" />`,
    `<meta property="og:image:alt" content="${escapeHtml(`${APP_NAME}: ${t.appHeading}`)}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    // JSON-LD is a data block, not executed, so the CSP's script-src does not apply to it.
    `<script type="application/ld+json">${JSON.stringify(structuredData).replace(/</g, '\\u003c')}</script>`,
  ].join('\n    ')
}

/**
 * Static landing content placed inside #root. Crawlers and link previews that
 * don't run JavaScript see it; the app replaces it when it starts.
 */
export function renderStaticContent(locale: Locale): string {
  const t = getMessages(locale)
  const features = t.landingFeatures
    .map((f) => `<li class="rounded-lg border p-4"><h3 class="font-medium">${escapeHtml(f.title)}</h3><p class="text-muted-foreground mt-1 text-sm">${escapeHtml(f.body)}</p></li>`)
    .join('')
  return [
    `<main class="mx-auto max-w-3xl px-4 py-16">`,
    `<h1 class="text-center text-2xl font-semibold tracking-tight sm:text-3xl">${escapeHtml(APP_NAME)}</h1>`,
    `<p class="mt-2 text-center text-lg">${escapeHtml(t.appHeading)}</p>`,
    `<p class="text-muted-foreground mt-2 text-center">${escapeHtml(t.appTagline)}</p>`,
    `<h2 class="mt-10 text-lg font-semibold">${escapeHtml(t.landingFeaturesTitle)}</h2>`,
    `<ul class="mt-3 grid gap-3 sm:grid-cols-2">${features}</ul>`,
    `<p class="text-muted-foreground mt-8 text-center text-sm">${escapeHtml(t.supportedFormats)}</p>`,
    `<noscript><p class="mt-6 text-center text-sm">${locale === 'ja' ? 'このアプリを使うには JavaScript を有効にしてください。' : 'Please enable JavaScript to use this app.'}</p></noscript>`,
    `<p class="mt-6 text-center text-sm"><a href="${PAGES.en.path}?lang=en" hreflang="en">English</a> · <a href="${PAGES.ja.path}" hreflang="ja">日本語</a></p>`,
    `</main>`,
  ].join('')
}
