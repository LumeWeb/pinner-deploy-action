/**
 * Post-build: inline createRequire("...package.json") and stub
 * createRequire("...*.node") calls that break when only dist/ is
 * shipped (GitHub Actions runner).
 *
 * - package.json requires are replaced with the inlined JSON object
 * - .node native addon requires are replaced with a deep Proxy stub
 *   that allows property access (so top-level destructuring doesn't
 *   crash) but throws on actual invocation
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

function findNearestRegions(offset) {
  let prev = null
  let next = null
  for (const r of regions) {
    if (r.index <= offset) prev = r
    else if (next === null) next = r
  }
  return { prev, next }
}

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

const replacements = []

// --- 1. Inline package.json requires ---
const jsonRe = /createRequire\([^)]*\)\(\s*["'`]([^"'`]*package\.json)["'`]\s*\)/g
let match
let pkgCount = 0

while ((match = jsonRe.exec(code)) !== null) {
  const fullMatch = match[0]
  const pkgPath = match[1]
  const offset = match.index

  const { prev, next } = findNearestRegions(offset)
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
    replacements.push({
      offset,
      length: fullMatch.length,
      replacement: JSON.stringify(pkg),
      label: `${pkg.name}@${pkg.version} (${pkgPath})`
    })
    pkgCount++
  } else {
    console.warn('[inline-pkg-json] Could not resolve ' + pkgPath)
  }
}

// --- 2. Stub native addon (.node) requires ---
const nodeRe = /createRequire\([^)]*\)\(\s*["'`]([^"'`]*\.node)["'`]\s*\)/g
const stubExpr =
  '(()=>{const s=new Proxy(function(){},{get:(_,p)=>s,apply:()=>{throw new Error("native addon not available in bundled mode")}});return s})()'
let nodeCount = 0

while ((match = nodeRe.exec(code)) !== null) {
  const fullMatch = match[0]
  const nodePath = match[1]
  replacements.push({
    offset: match.index,
    length: fullMatch.length,
    replacement: stubExpr,
    label: `stub ${nodePath}`
  })
  nodeCount++
}

if (replacements.length === 0) {
  console.log('[inline-pkg-json] No requires found to inline/stub')
  process.exit(0)
}

replacements.sort((a, b) => b.offset - a.offset)
for (const r of replacements) {
  code = code.slice(0, r.offset) + r.replacement + code.slice(r.offset + r.length)
}

writeFileSync(distPath, code)

for (const r of replacements) {
  console.log('[inline-pkg-json] ' + r.label)
}
console.log(
  `[inline-pkg-json] Done: ${pkgCount} package.json + ${nodeCount} .node require(s) processed`
)
