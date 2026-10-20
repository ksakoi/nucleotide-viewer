// Regenerates public/sample.ab1, the synthetic demo read bundled with the app.
// Usage: npm run generate:sample
import { writeFileSync } from 'node:fs'

import { buildAbif, synthesizeChromatogram } from '../src/lib/abif/writer'

const buffer = buildAbif(synthesizeChromatogram(800, 2024))
writeFileSync(new URL('../public/sample.ab1', import.meta.url), new Uint8Array(buffer))
console.log(`wrote public/sample.ab1 (${buffer.byteLength} bytes)`)
