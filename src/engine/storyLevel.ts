import { useSyncExternalStore } from 'react'
import { funcionesAhora, suscribirFunciones } from '../cloud/funciones'
import { guardarNivelNube, leerNivelNube } from '../cloud/datos'
// Hasta qué fase decidió avanzar esta persona en la historia oficial (0 = octavos sin jugar … 4 = terminó).
// Se guarda en su navegador y se comparte con toda la app (estadísticas, partidos, equipos, portada).
const KEY = 'lwc:historia:nivel:v1'
const read = (): number => { try { const n = Number(localStorage.getItem(KEY)); return Number.isInteger(n) && n >= 0 && n <= 4 ? n : 0 } catch { return 0 } }
let cur = read()
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())
// El nivel que se ve nunca pasa del que Admin dejó liberado para todos (el avance propio queda guardado igual).
export const getLevel = () => Math.min(cur, funcionesAhora().nivelHistoria)
export const getStoredLevel = () => cur
let visible = getLevel()
export function setLevel(n: number) {
  cur = Math.max(0, Math.min(4, n))
  try { localStorage.setItem(KEY, String(cur)) } catch { /* sin almacenamiento */ }
  void guardarNivelNube(cur)
  emit()
}
// Al entrar a la nube se toma el avance más alto entre este navegador y la cuenta.
export async function sincronizarNivel() {
  const n = await leerNivelNube()
  if (n !== null && n > cur) { cur = n; try { localStorage.setItem(KEY, String(cur)) } catch { /* sin almacenamiento */ } emit() }
  else if (n === null && cur > 0) void guardarNivelNube(cur)
}
if (typeof window !== 'undefined') window.addEventListener('storage', (e) => { if (e.key === KEY) { cur = read(); emit() } })
const subscribe = (l: () => void) => { listeners.add(l); const off = suscribirFunciones(l); return () => { listeners.delete(l); off() } }
void visible
export const useStoryLevel = () => useSyncExternalStore(subscribe, getLevel, getLevel)
