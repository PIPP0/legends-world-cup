// Idioma de la web. Se decide UNA vez al cargar: cambiar de idioma recarga la página, así datos y textos quedan coherentes.
// Prioridad: ?lang=xx en el enlace → lo que la persona eligió (se recuerda) → dominio (mundialimposible.* en español) → inglés.
// No se detecta por IP ni por el navegador: el inglés es el idioma por defecto y la persona elige otro con el selector.
import { KEYS } from './keys'

export type Lang = 'en' | 'es' | 'pt' | 'fr' | 'it' | 'de' | 'id'
// Idiomas terminados (nombre en su propio idioma). Se agregan aquí cuando su diccionario está listo y revisado.
export const IDIOMAS: Array<{ code: Lang; nombre: string; locale: string }> = [
  { code: 'en', nombre: 'English', locale: 'en-US' },
  { code: 'es', nombre: 'Español', locale: 'es-CL' },
  { code: 'pt', nombre: 'Português', locale: 'pt-BR' },
  { code: 'fr', nombre: 'Français', locale: 'fr-FR' },
  { code: 'it', nombre: 'Italiano', locale: 'it-IT' },
  { code: 'de', nombre: 'Deutsch', locale: 'de-DE' },
  { code: 'id', nombre: 'Bahasa Indonesia', locale: 'id-ID' },
]
const KEY = 'lwc:lang'
const valido = (x: unknown): x is Lang => IDIOMAS.some((i) => i.code === x)

function detectar(): Lang {
  try {
    const q = new URLSearchParams(location.search).get('lang')
    if (valido(q)) return q
    const guardado = localStorage.getItem(KEY)
    if (valido(guardado)) return guardado
    if (/mundialimposible\./i.test(location.hostname)) return 'es'
  } catch { /* sin almacenamiento */ }
  return 'en'
}
export const LANG: Lang = typeof window === 'undefined' ? 'es' : detectar()
export const LOCALE = IDIOMAS.find((i) => i.code === LANG)?.locale ?? 'en-US'

let DICT: Record<string, string> = {}
// Carga el diccionario del idioma elegido (el español no necesita: es el texto original). Se espera antes de pintar la web.
export async function cargarIdioma(): Promise<void> {
  if (LANG === 'es') return
  const mod = await import(`./dict/${LANG}.ts`)
  const arr: string[] = mod.default
  const d: Record<string, string> = {}
  KEYS.forEach((k, i) => { if (arr[i]) d[k] = arr[i] })
  DICT = d
}

export function cambiarIdioma(l: Lang) {
  try { localStorage.setItem(KEY, l) } catch { /* sin almacenamiento */ }
  const u = new URL(location.href); u.searchParams.delete('lang'); location.href = u.toString(); location.reload()
}

// t('Texto en español {x}', { x: 3 }): devuelve la traducción (si falta, queda en español) y rellena {x}.
export function t(es: string, vars?: Record<string, string | number>): string {
  let s = LANG === 'es' ? es : (DICT[es] ?? es)
  if (vars) for (const k of Object.keys(vars)) s = s.split(`{${k}}`).join(String(vars[k]))
  return s
}
// Nombre propio por clave (p. ej. «EQ·bra»): en español devuelve el original; si falta traducción, también.
export const nombre = (clave: string, es: string) => (LANG === 'es' ? es : DICT[clave] ?? es)
export const tr = t

const TITULOS: Record<Lang, string> = {
  en: 'Legends World Cup — The Impossible World Cup', es: 'Legends World Cup — El Mundial Imposible', pt: 'Legends World Cup — A Copa do Mundo Impossível',
  fr: 'Legends World Cup — La Coupe du monde impossible', it: 'Legends World Cup — Il Mondiale Impossibile', de: 'Legends World Cup — Die unmögliche WM', id: 'Legends World Cup — Piala Dunia Mustahil',
}
if (typeof document !== 'undefined') { document.documentElement.lang = LANG; document.title = TITULOS[LANG] }

// Ordinales por idioma: 1st · 1.º · 1er · 1° · 1. · ke-1
export const ordinal = (n: number): string => {
  switch (LANG) {
    case 'en': { const s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]) }
    case 'fr': return n === 1 ? '1er' : `${n}e`
    case 'it': return `${n}°`
    case 'de': return `${n}.`
    case 'id': return `ke-${n}`
    default: return `${n}.º`
  }
}
