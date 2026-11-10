import { useEffect, useState } from 'react'

// Selección favorita de la persona que entró con su cuenta: se guarda en la nube (en su ficha) y se recuerda en el navegador.
const KEY = 'lwc:fav'
const leer = (): string | null => { try { return localStorage.getItem(KEY) } catch { return null } }
let actual: string | null = typeof localStorage === 'undefined' ? null : leer()
const oyentes = new Set<() => void>()

export const favoritaActual = () => actual
export function ponerFavorita(id: string | null) {
  actual = id
  try { if (id) localStorage.setItem(KEY, id); else localStorage.removeItem(KEY) } catch { /* sin almacenamiento */ }
  oyentes.forEach((f) => f())
}
export function useFavorita(): string | null {
  const [v, setV] = useState(actual)
  useEffect(() => { const f = () => setV(actual); oyentes.add(f); f(); return () => { oyentes.delete(f) } }, [])
  return v
}
