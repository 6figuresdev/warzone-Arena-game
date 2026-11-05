import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

const manifest = JSON.parse(readFileSync('asset-pack/manifest.json', 'utf8'))
let restored = 0
const missing = []
for (const f of manifest.files) {
  const dest = `public/assets/${f.path}`
  const have = existsSync(dest) ? statSync(dest).size : -1
  if (have === f.size) continue
  const partsOk = f.parts.every((p) => existsSync(`asset-pack/${p}`))
  if (!partsOk) {
    if (have >= 0) {
      console.warn(`Keeping existing ${dest} (size ${have}, manifest says ${f.size}): its pieces are not all in asset-pack/.`)
    } else {
      missing.push(dest)
      console.error(`Cannot restore ${dest}: some of its pieces are missing.`)
    }
    continue
  }
  const chunks = f.parts.map((p) => readFileSync(`asset-pack/${p}`, 'utf8').replace(/\s+/g, ''))
  const data = Buffer.from(chunks.join(''), 'base64')
  if (data.length !== f.size || createHash('sha256').update(data).digest('hex') !== f.sha256) {
    console.error(`Restored ${dest} does not match the expected file. Re-copy its pieces.`)
    process.exit(1)
  }
  mkdirSync(dirname(dest), { recursive: true })
  writeFileSync(dest, data)
  restored++
}
console.log(restored ? `Restored ${restored} game file(s) from asset-pack/.` : 'No files needed restoring.')
if (missing.length) process.exit(1)
