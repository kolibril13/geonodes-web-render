/**
 * Convert all Tree Clipper example exports to nodebpy Python files.
 *
 * Usage (bundled with rolldown, see package.json "convert:nodebpy"):
 *   npm run convert:nodebpy
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { exportToNodebpy } from '../src/gn/exporter/nodebpyExporter'

// Run from the repo root (the bundle relocates import.meta.url).
const rootDir = process.cwd()
const assetsDir = join(rootDir, 'public', 'assets')
const outDir = join(rootDir, 'examples', 'nodebpy')

mkdirSync(outDir, { recursive: true })

const examples = readdirSync(assetsDir)
  .filter((f) => /^example\d+\.json$/.test(f))
  .sort((a, b) => parseInt(a.replace(/\D/g, '')) - parseInt(b.replace(/\D/g, '')))

for (const file of examples) {
  const raw = JSON.parse(readFileSync(join(assetsDir, file), 'utf8'))
  const name = file.replace('.json', '')
  try {
    const code = exportToNodebpy(raw)
    const outPath = join(outDir, `${name}.py`)
    writeFileSync(outPath, code)
    console.log(`✓ ${name}.py (${code.split('\n').length} lines)`)
  } catch (e) {
    console.error(`✗ ${name}: ${e instanceof Error ? e.message : e}`)
    process.exitCode = 1
  }
}
