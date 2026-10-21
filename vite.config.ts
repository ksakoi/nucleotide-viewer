import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

import type { Locale } from './src/lib/i18n'
import { PAGES, renderSeoHead, renderStaticContent } from './src/seo'

const HEAD = /<!--seo-head:start-->[\s\S]*?<!--seo-head:end-->/
const BODY = /<!--seo-body:start-->[\s\S]*?<!--seo-body:end-->/

function localize(html: string, locale: Locale): string {
  return html
    .replace(/<html lang="[^"]*">/, `<html lang="${locale}">`)
    .replace(HEAD, `<!--seo-head:start-->\n    ${renderSeoHead(locale)}\n    <!--seo-head:end-->`)
    .replace(BODY, `<!--seo-body:start-->${renderStaticContent(locale)}<!--seo-body:end-->`)
}

/**
 * Fills index.html with the English SEO head and static content, and writes
 * a Japanese copy to ja/index.html after the build so /ja/ is its own
 * indexable page (see src/seo.ts).
 */
function seoPages(): Plugin {
  let outDir = 'dist'
  return {
    name: 'seo-pages',
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir)
    },
    transformIndexHtml(html) {
      const marked = html
        .replace('<!--seo-head-->', '<!--seo-head:start--><!--seo-head:end-->')
        .replace('<!--seo-body-->', '<!--seo-body:start--><!--seo-body:end-->')
      return localize(marked, 'en')
    },
    async writeBundle() {
      const html = await readFile(path.join(outDir, 'index.html'), 'utf8')
      const target = path.join(outDir, PAGES.ja.path, 'index.html')
      await mkdir(path.dirname(target), { recursive: true })
      await writeFile(target, localize(html, 'ja'))
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), seoPages()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
})
