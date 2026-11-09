import { useSyncExternalStore } from 'react'
// Hasta qué fase decidió avanzar esta persona en la historia oficial (0 = octavos sin jugar … 4 = terminó).
// Se guarda en su navegador y se comparte con toda la app (estadísticas, partidos, equipos, portada).
const KEY = 'lwc:historia:nivel:v1'
const read = (): number => { try { const n = Number(localStorage.getItem(KEY)); return Number.isInteger(n) && n >= 0 && n <= 4 ? n : 0 } catch { return 0 } }
let cur = read()
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())
export const getLevel = () => cur
export function setLevel(n: number) {
  cur = Math.max(0, Math.min(4, n))
  try { localStorage.setItem(KEY, String(cur)) } catch { /* sin almacenamiento */ }
  emit()
}
if (typeof window !== 'undefined') window.addEventListener('storage', (e) => { if (e.key === KEY) { cur = read(); emit() } })
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l) } }
export const useStoryLevel = () => useSyncExternalStore(subscribe, getLevel, getLevel)
