// Convierte /tmp/i18n/<lang>.txt (líneas «N|texto») en src/i18n/dict/<lang>.ts y valida {variables} y <b>. Uso: npx tsx scripts/i18n-import.ts pt
import { readFileSync, writeFileSync } from 'node:fs'
import { KEYS } from '../src/i18n/keys'
const lang = process.argv[2]
const lines = readFileSync(`/tmp/i18n/${lang}.txt`, 'utf8').split('\n').filter((l) => l.trim())
const out: string[] = new Array(KEYS.length).fill('')
for (const l of lines) { const i = l.indexOf('|'); const n = Number(l.slice(0, i)); if (!(n >= 0 && n < KEYS.length)) { console.log('índice raro', l.slice(0, 40)); continue } const v = l.slice(i + 1).replace(/\r$/, ''); const k = KEYS[n]; const ini = k.match(/^\s*/)![0], fin = k.match(/\s*$/)![0]; out[n] = k.trim() ? (/^[.,;:!?]/.test(v.trim()) ? '' : ini) + v.trim() + fin : v }
const toks = (s: string) => (s.match(/\{\w+\}|<\/?b>/g) ?? []).sort().join(',')
let malos = 0
out.forEach((v, i) => {
  if (!v) { console.log('FALTA', i, KEYS[i].slice(0, 60)); malos++; return }
  if (!/^(EQ|PA|CI|VN|MES|EST|POS|ATTR|AB|HERO)·/.test(KEYS[i]) && toks(v) !== toks(KEYS[i])) { console.log('VARIABLES', i, KEYS[i].slice(0, 50), '=>', v.slice(0, 50)); malos++ }
})
writeFileSync(`src/i18n/dict/${lang}.ts`, `// ${lang}, alineado con keys.ts.\nconst D: string[] = [\n` + out.map((k, i) => '  ' + JSON.stringify(k || KEYS[i]) + ',').join('\n') + '\n]\nexport default D\n')
console.log(lang, 'listo,', malos, 'problemas')
