// Idioma de la web (es | en). Se decide UNA vez al cargar: cambiar de idioma recarga la página, así todo (datos y textos) queda coherente.
// Prioridad: ?lang=en|es en el enlace → lo que la persona eligió (se recuerda) → dominio (mundialimposible.* en español) → idioma del navegador.
// No se detecta por IP: el idioma del navegador es más fiable y no manda datos de la persona a ningún servicio.
import { EN } from './en'

export type Lang = 'es' | 'en'
const KEY = 'lwc:lang'

function detectar(): Lang {
  try {
    const q = new URLSearchParams(location.search).get('lang')
    if (q === 'es' || q === 'en') return q
    const guardado = localStorage.getItem(KEY)
    if (guardado === 'es' || guardado === 'en') return guardado
    if (/mundialimposible\./i.test(location.hostname)) return 'es'
    if (/impossiblecup\./i.test(location.hostname)) return 'en'
    const langs = navigator.languages?.length ? navigator.languages : [navigator.language]
    for (const l of langs) { const c = l.toLowerCase().slice(0, 2); if (c === 'es') return 'es'; if (c === 'en') return 'en' }
    return 'en' // idioma internacional por defecto
  } catch { return 'es' }
}
export const LANG: Lang = typeof window === 'undefined' ? 'es' : detectar()
export const esIngles = LANG === 'en'
export const LOCALE = LANG === 'en' ? 'en-US' : 'es-CL'

export function cambiarIdioma(l: Lang) {
  try { localStorage.setItem(KEY, l) } catch { /* sin almacenamiento */ }
  const u = new URL(location.href); u.searchParams.delete('lang'); location.href = u.toString(); location.reload()
}

// t('Texto en español {x}', { x: 3 }): devuelve la traducción si el idioma es inglés (si falta, queda en español) y rellena {x}.
export function t(es: string, vars?: Record<string, string | number>): string {
  let s = LANG === 'en' ? (EN[es] ?? es) : es
  if (vars) for (const k of Object.keys(vars)) s = s.split(`{${k}}`).join(String(vars[k]))
  return s
}
// Elige entre dos variantes según el idioma (para textos armados con piezas).
export const l = <T,>(es: T, en: T): T => (LANG === 'en' ? en : es)

if (typeof document !== 'undefined') document.documentElement.lang = LANG
export const tr = t
export const ordinal = (n: number) => { const s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]) }
