// Fails the build early, with a clear message, when a required game file is missing from the repository.
import { existsSync, readFileSync, statSync } from 'node:fs'

const required = [
  'public/assets/models/operator.glb',
  'public/assets/hdr/kiara_1_dawn.hdr',
  'public/assets/hdr/kloppenheim_06_puresky.hdr',
  'public/assets/hdr/qwantani_dusk_2_puresky.hdr',
  ...['asphalt_02', 'brick_wall_02', 'concrete_floor_worn_001', 'concrete_wall_008', 'corrugated_iron_02', 'rusty_metal_02', 'sandy_gravel_02'].flatMap((n) => [
    `public/assets/tex/${n}_diff.jpg`,
    `public/assets/tex/${n}_nor_gl.jpg`,
  ]),
]

const missing = required.filter((f) => !existsSync(f) || statSync(f).size < 1000)
if (!missing.length && readFileSync(required[0]).subarray(0, 4).toString() !== 'glTF') missing.push(required[0])
if (missing.length) {
  console.error('\nMissing game files. Commit these to your repository (git add -f public/assets):')
  for (const f of missing) console.error(`  - ${f}`)
  process.exit(1)
}
console.log(`Game files OK (${required.length} files).`)
