// Extracts t('key', "Default text") pairs from src/ into src/i18n/en.json.
// Run via `npm run i18n:extract` after adding or changing UI strings.
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = new URL('../src', import.meta.url).pathname
const out = {}

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p)
    else if (/\.(tsx?|jsx?)$/.test(name)) scan(p)
  }
}

function scan(file) {
  const src = readFileSync(file, 'utf8')
  const re = /\bt\(\s*'([^']+)'\s*,\s*(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)')/g
  let m
  while ((m = re.exec(src))) {
    const key = m[1]
    const text = m[2] ?? m[3]
    if (out[key] && out[key] !== text) {
      console.warn(`conflict for ${key}: "${out[key]}" vs "${text}" (${file})`)
    }
    out[key] = text.replace(/\\"/g, '"')
  }
}

walk(ROOT)
const sorted = Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b)))
writeFileSync(join(ROOT, 'i18n/en.json'), JSON.stringify(sorted, null, 2) + '\n')
console.log(`extracted ${Object.keys(sorted).length} strings -> src/i18n/en.json`)
