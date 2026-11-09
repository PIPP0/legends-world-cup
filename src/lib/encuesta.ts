// Envío de encuestas. Las respuestas se guardan primero en una cola local y se mandan al servidor (Worker de Cloudflare);
// si el servidor aún no está configurado o falla, se reintentan solas más tarde y no se pierden.
export const ENCUESTAS_API = ((import.meta.env.VITE_ENCUESTAS_API as string | undefined) || (import.meta.env.VITE_PAYMENT_API as string | undefined) || '').replace(/\/$/, '')

export interface Respuesta {
  tipo: 'general' | 'mundial'
  estrellas: number
  estrellas2?: number
  comentario?: string
  datos?: string
  pantalla?: string
}
const COLA = 'lwc:encuestas:cola:v1'
const leer = (): Respuesta[] => { try { return JSON.parse(localStorage.getItem(COLA) ?? '[]') as Respuesta[] } catch { return [] } }
const guardar = (c: Respuesta[]) => { try { localStorage.setItem(COLA, JSON.stringify(c.slice(-20))) } catch { /* sin almacenamiento */ } }

let reintento: ReturnType<typeof setTimeout> | null = null
export async function vaciarCola(): Promise<void> {
  if (!ENCUESTAS_API) return
  let cola = leer()
  while (cola.length) {
    try {
      const r = await fetch(`${ENCUESTAS_API}/api/encuesta`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cola[0]) })
      if (r.status === 429) { // el servidor deja una respuesta por minuto por conexión: se reintenta
        if (!reintento) reintento = setTimeout(() => { reintento = null; void vaciarCola() }, 65_000)
        return
      }
      if (!r.ok && r.status >= 500) return
    } catch { return }
    cola = leer().slice(1) // enviada (o inválida): sale de la cola
    guardar(cola)
  }
}

export async function enviarEncuesta(r: Respuesta): Promise<'enviada' | 'guardada'> {
  guardar([...leer(), r])
  if (!ENCUESTAS_API) return 'guardada'
  await vaciarCola()
  return leer().length === 0 ? 'enviada' : 'guardada'
}
