// Calcula UNA sola vez las eliminatorias de la historia oficial (octavos → final) y las congela en src/data/story-knockout.json.
// Así el resultado es el mismo para todas las personas y NO cambia aunque el modelo se ajuste después.
// Por seguridad no sobrescribe un archivo existente: hay que pasar --forzar a propósito.
// Uso: npx tsx scripts/congelar-historia.ts [semilla] [--forzar]
import { existsSync, writeFileSync } from 'node:fs'
import { DECLARED_R16 } from '../src/data/raw'
import { STORY_MATCHES } from '../src/data'
import { DEFAULT_PARAMS, emptyBracket, runAll } from '../src/engine/model'

const OUT = 'src/data/story-knockout.json'
const seed = process.argv.slice(2).find((a) => !a.startsWith('--')) ?? 'historia-oficial-1'
if (existsSync(OUT) && !process.argv.includes('--forzar')) {
  console.error(`${OUT} ya existe y es el resultado oficial. No se toca. Usa --forzar solo si de verdad quieres reemplazarlo.`)
  process.exit(1)
}
const t = runAll({ seed, mode: 'octavos', groupMatches: STORY_MATCHES, bracket: emptyBracket(DECLARED_R16) }, DEFAULT_PARAMS)
writeFileSync(OUT, JSON.stringify({ version: 1, seed, bracket: t.bracket }, null, 1))
console.log(`Congelado con la semilla «${seed}». Campeón: ${t.bracket.champion}`)
