// Rebuilds public/assets from the small text parts in asset-pack/ when binary files are missing.
// Safe to run any time: files that already match the manifest are left alone.
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

const manifest = JSON.parse(readFileSync('asset-pack/manifest.json', 'utf8'))
let restored = 0
for (const f of manifest.files) {
  const dest = `public/assets/${f.path}`
  if (existsSync(dest) && statSync(dest).size === f.size) continue
  const missing = f.parts.filter((p) => !existsSync(`asset-pack/${p}`))
  if (missing.length) {
    console.error(`Cannot restore ${dest}. Missing in asset-pack/: ${missing.join(', ')}`)
    process.exit(1)
  }
  const text = f.parts.map((p) => readFileSync(`asset-pack/${p}`, 'utf8')).join('')
  const data = Buffer.from(text.replace(/\s+/g, ''), 'base64')
  if (data.length !== f.size || createHash('sha256').update(data).digest('hex') !== f.sha256) {
    console.error(`Restored ${dest} does not match the expected file. Check that all ${f.parts.length} parts of it were copied.`)
    process.exit(1)
  }
  mkdirSync(dirname(dest), { recursive: true })
  writeFileSync(dest, data)
  restored++
}
console.log(restored ? `Restored ${restored} game file(s) from asset-pack/.` : 'Game files already in place.')
