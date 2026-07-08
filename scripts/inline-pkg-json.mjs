/**
 * Post-build: inline createRequire("...package.json") calls that break
 * when only dist/ is shipped (GitHub Actions runner).
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve, dirname } from 'node:path'

const distPath = resolve(process.cwd(), 'dist/index.js')
const rootDir = process.cwd()
const require = createRequire(import.meta.url)

let code = readFileSync(distPath, 'utf8')

// Collect all #region annotations with their positions
const regions = []
const regionRe = /\/\/#region (node_modules\/[^\n]+)/g
let rm
while ((rm = regionRe.exec(code)) !== null) {
  regions.push({ path: rm[1], index: rm.index })
}

// Find the nearest #region before a given offset, and also the next one.
// The createRequire call might belong to the module whose #region comes
// AFTER it (top-level side effects placed before the region annotation).
function findNearestRegions(offset) {
  let prev = null
  let next = null
  for (const r of regions) {
    if (r.index <= offset) prev = r
    else if (next === null) next = r
  }
  return { prev, next }
}

// Resolve relPath from a region module path, walking up directories
function resolveFromRegion(regionPath, relPath) {
  let dir = dirname(regionPath)
  for (let i = 0; i < 10; i++) {
    const candidate = resolve(rootDir, dir, relPath)
    try {
      return require(candidate)
    } catch {}
    const parent = dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  return null
}

const re = /createRequire\([^)]*\)\(\s*["'`]([^"'`]*package\.json)["'`]\s*\)/g

let match
let replaced = 0
const replacements = []

while ((match = re.exec(code)) !== null) {
  const fullMatch = match[0]
  const pkgPath = match[1]
  const offset = match.index

  const { prev, next } = findNearestRegions(offset)

  // Try the nearest preceding region, then the next region, then all others
  const candidates = [
    prev,
    next,
    ...regions.filter((r) => r !== prev && r !== next)
  ]
  let pkg = null
  let sourceRegion = null

  for (const r of candidates) {
    if (!r) continue
    pkg = resolveFromRegion(r.path, pkgPath)
    if (pkg) {
      sourceRegion = r.path
      break
    }
  }

  if (pkg) {
    const inlined = JSON.stringify(pkg)
    replacements.push({
      offset,
      length: fullMatch.length,
      replacement: inlined,
      pkgPath,
      name: pkg.name,
      version: pkg.version,
      sourceRegion
    })
    replaced++
  } else {
    console.warn('[inline-pkg-json] Could not resolve ' + pkgPath)
  }
}

if (replacements.length === 0) {
  console.log('[inline-pkg-json] No package.json requires found to inline')
  process.exit(0)
}

replacements.sort((a, b) => b.offset - a.offset)
for (const r of replacements) {
  code =
    code.slice(0, r.offset) + r.replacement + code.slice(r.offset + r.length)
}

writeFileSync(distPath, code)

for (const r of replacements) {
  console.log(
    '[inline-pkg-json] Inlined ' +
      r.name +
      '@' +
      r.version +
      ' (' +
      r.pkgPath +
      ')'
  )
}
console.log(
  '[inline-pkg-json] Done: ' + replaced + ' package.json require(s) inlined'
)
