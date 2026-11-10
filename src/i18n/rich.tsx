import type { ReactNode } from 'react'
import { tr } from './index'

// Texto traducido con negritas: en la traducción se escribe <b>…</b> y aquí se convierte en <b>/<strong> de React.
export function rich(es: string, vars?: Record<string, string | number>): ReactNode {
  const s = tr(es, vars)
  const parts = s.split(/(<b>.*?<\/b>)/g)
  return parts.map((p, i) => (p.startsWith('<b>') ? <b key={i}>{p.slice(3, -4)}</b> : p))
}
