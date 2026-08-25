#!/usr/bin/env node
/* ------------------------------------------------------------------
 * Scans assets/ for images and keeps two things in sync:
 *   1. assets/icons.json — the manifest the section loads at runtime
 *   2. the <img> block in index.html — the no-fetch fallback
 *
 * Run it after dropping new icons into assets/:
 *   node scripts/build-icons.mjs
 * ---------------------------------------------------------------- */
import { readdir, readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const ASSETS_DIR = path.join(ROOT, 'assets')
const ASSETS_HREF = 'assets'

const IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.webp', '.avif', '.gif', '.svg'])

// Natural sort, so ic-2 lands before ic-10
const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' })

const files = (await readdir(ASSETS_DIR, { withFileTypes: true }))
    .filter(entry => entry.isFile() && IMAGE_EXT.has(path.extname(entry.name).toLowerCase()))
    .map(entry => entry.name)
    .sort(collator.compare)

if (!files.length) {
    console.error('No images found in assets/')
    process.exit(1)
}

const icons = files.map(name => `${ASSETS_HREF}/${name}`)

await writeFile(
    path.join(ASSETS_DIR, 'icons.json'),
    JSON.stringify({ generated: new Date().toISOString(), icons }, null, 4) + '\n'
)

// Rewrite the fallback list inside index.html
const htmlPath = path.join(ROOT, 'index.html')
const html = await readFile(htmlPath, 'utf8')

const blockRe = /(<div class="cons-hero__sources"[^>]*>)([\s\S]*?)(<\/div>)/
if (!blockRe.test(html)) {
    console.error('Could not find .cons-hero__sources in index.html — manifest written, HTML untouched.')
    process.exit(1)
}

const indent = '      '
const tags = icons.map(src => `${indent}<img src="${src}" alt="">`).join('\n')
const next = html.replace(blockRe, (_, open, __, close) => `${open}\n${tags}\n${indent.slice(2)}${close}`)

await writeFile(htmlPath, next)

console.log(`${icons.length} icons → assets/icons.json + index.html`)
icons.forEach(src => console.log(`  ${src}`))
