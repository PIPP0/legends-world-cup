// Calcula las probabilidades de campeón de la portada (300 torneos desde octavos) y las guarda en src/data/oddsPortada.json.
// Así la portada no las calcula al abrirse. Si cambia el modelo, vuelve a correr: npx tsx scripts/odds-portada.ts
import { writeFileSync } from 'node:fs'
import { championOdds, DEFAULT_PARAMS } from '../src/engine/model'
import { DECLARED_R16 } from '../src/data/raw'
const odds = championOdds(DECLARED_R16, DEFAULT_PARAMS, 300, 'home')
const redondeado = Object.fromEntries(Object.entries(odds).map(([k, v]) => [k, Math.round(v * 10000) / 10000]))
writeFileSync('src/data/oddsPortada.json', JSON.stringify(redondeado, null, 1) + '\n')
console.log(Object.keys(redondeado).length, 'selecciones')
