// Genera src/i18n/keys.ts y dict/en.ts (alineados) y deja la fuente numerada para traducir. Uso: npx tsx scripts/i18n-build.ts
import { writeFileSync, mkdirSync } from 'node:fs'
import { EN } from '../src/i18n/en'
import { NS } from '../src/i18n/claves-nombres'
const keys = [...Object.keys(EN), ...NS.map((x) => x[0])]
const en = [...Object.values(EN), ...NS.map((x) => x[2])]
const src = [...Object.keys(EN), ...NS.map((x) => x[1])]
const q = (s: string) => JSON.stringify(s)
writeFileSync('src/i18n/keys.ts', '// Generado por scripts/i18n-build.ts: claves (texto original en español) en el orden de los diccionarios.\nexport const KEYS: string[] = [\n' + keys.map((k) => '  ' + q(k) + ',').join('\n') + '\n]\n')
mkdirSync('src/i18n/dict', { recursive: true })
writeFileSync('src/i18n/dict/en.ts', '// Inglés, alineado con keys.ts.\nconst D: string[] = [\n' + en.map((k) => '  ' + q(k) + ',').join('\n') + '\n]\nexport default D\n')
mkdirSync('/tmp/i18n', { recursive: true })
writeFileSync('/tmp/i18n/fuente.txt', src.map((s, i) => i + '|' + s).join('\n') + '\n')
console.log(keys.length, 'claves')
