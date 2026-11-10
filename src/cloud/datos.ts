import { NUBE_ACTIVA, nube } from './firebase'
import type { AltTournament } from '../types'

export interface UsuarioReg { uid: string; email: string; nombre: string; foto: string; anonimo: boolean; creado: number; ultimo: number; visitas: number; idioma?: string; dispositivo?: string; pais?: string; zona?: string; sistema?: string; navegador?: string; pantalla?: string; origen?: string; idiomaWeb?: string }
export interface EncuestaReg { id: string; uid: string; tipo: 'general' | 'mundial'; estrellas: number; estrellas2?: number; comentario?: string; datos?: string; pantalla?: string; creada: number }
export interface MundialReg { id: string; uid: string; sede: string; mes: number; clima: string; primes: number; formato: string; campeon: string; semilla: string; creada: number }
export interface ProgresoReg { uid: string; nivel: number; actualizado: number }

async function uid(): Promise<string | null> { const n = await nube(); await n.auth.authStateReady(); return n.auth.currentUser?.uid ?? null }

// ---- escritura (cualquier visitante) ----
export async function guardarEncuestaNube(r: { tipo: string; estrellas: number; estrellas2?: number; comentario?: string; datos?: string; pantalla?: string }): Promise<boolean> {
  if (!NUBE_ACTIVA) return false
  try {
    const n = await nube(); const u = await uid(); if (!u) return false
    const doc: Record<string, unknown> = { uid: u, tipo: r.tipo, estrellas: r.estrellas, comentario: (r.comentario ?? '').slice(0, 400), datos: (r.datos ?? '').slice(0, 160), pantalla: (r.pantalla ?? '').slice(0, 40), creada: Date.now() }
    if (r.estrellas2) doc.estrellas2 = r.estrellas2
    await n.fs.addDoc(n.fs.collection(n.db, 'encuestas'), doc)
    return true
  } catch { return false }
}

export async function registrarMundial(t: AltTournament): Promise<void> {
  if (!NUBE_ACTIVA || !t.bracket.champion) return
  try {
    const n = await nube(); const u = await uid(); if (!u) return
    await n.fs.addDoc(n.fs.collection(n.db, 'mundiales'), {
      uid: u, sede: t.world?.hostId ?? 'neutral', mes: t.world?.month ?? 0, clima: t.world?.climate ?? 'normal', primes: t.world?.primes?.length ?? 0,
      formato: t.mode, campeon: t.bracket.champion, semilla: t.seed.slice(0, 40), creada: Date.now(),
    })
  } catch { /* no interrumpe el juego */ }
}

// ---- ¿De acuerdo con el campeón? 👍/👎: un voto por persona (se puede cambiar); contadores públicos ----
export type Acuerdo = 'si' | 'no'
export async function votarAcuerdo(voto: Acuerdo): Promise<boolean> {
  if (!NUBE_ACTIVA) return false
  try {
    const n = await nube(); const u = await uid(); if (!u) return false
    const votoRef = n.fs.doc(n.db, 'acuerdoVotos', u), contRef = n.fs.doc(n.db, 'acuerdoConteo', 'campeon')
    await n.fs.runTransaction(n.db, async (tx) => {
      const prev = await tx.get(votoRef); const cont = await tx.get(contRef)
      const antes = prev.exists() ? (prev.data().voto as Acuerdo) : null
      if (antes === voto) return
      const c = { si: cont.exists() ? (cont.data().si as number) : 0, no: cont.exists() ? (cont.data().no as number) : 0 }
      if (antes && c[antes] > 0) c[antes]--
      c[voto]++
      tx.set(votoRef, { voto, creada: Date.now() })
      tx.set(contRef, c)
    })
    return true
  } catch { return false }
}
export async function leerMiAcuerdo(): Promise<Acuerdo | null> {
  if (!NUBE_ACTIVA) return null
  try {
    const n = await nube(); const u = await uid(); if (!u) return null
    const d = await n.fs.getDoc(n.fs.doc(n.db, 'acuerdoVotos', u))
    return d.exists() ? (d.data().voto as Acuerdo) : null
  } catch { return null }
}
// En vivo: cada cambio en la nube llega al instante a todas las personas que tienen la página abierta.
export async function escucharAcuerdo(cb: (r: { si: number; no: number }) => void): Promise<() => void> {
  if (!NUBE_ACTIVA) return () => undefined
  try {
    const n = await nube()
    return n.fs.onSnapshot(n.fs.doc(n.db, 'acuerdoConteo', 'campeon'), (d) => cb(d.exists() ? { si: (d.data().si as number) ?? 0, no: (d.data().no as number) ?? 0 } : { si: 0, no: 0 }), () => undefined)
  } catch { return () => undefined }
}
export async function escucharRankingMvp(cb: (r: VotoMvp[]) => void): Promise<() => void> {
  if (!NUBE_ACTIVA) return () => undefined
  try {
    const n = await nube()
    const q = n.fs.query(n.fs.collection(n.db, 'mvpConteo'), n.fs.orderBy('n', 'desc'), n.fs.limit(40))
    return n.fs.onSnapshot(q, (s) => cb(s.docs.map((d) => ({ id: d.id, n: d.data().n as number })).filter((x) => x.n > 0)), () => undefined)
  } catch { return () => undefined }
}
export async function leerMiMvp(): Promise<string | null> {
  if (!NUBE_ACTIVA) return null
  try {
    const n = await nube(); const u = await uid(); if (!u) return null
    const d = await n.fs.getDoc(n.fs.doc(n.db, 'mvpVotos', u))
    return d.exists() ? (d.data().jugador as string) : null
  } catch { return null }
}
export async function leerAcuerdo(): Promise<{ si: number; no: number } | null> {
  if (!NUBE_ACTIVA) return null
  try {
    const n = await nube(); const d = await n.fs.getDoc(n.fs.doc(n.db, 'acuerdoConteo', 'campeon'))
    return d.exists() ? { si: (d.data().si as number) ?? 0, no: (d.data().no as number) ?? 0 } : { si: 0, no: 0 }
  } catch { return null }
}

// ---- selección favorita (por cuenta): vive en la ficha del usuario ----
export async function leerFavoritaNube(): Promise<string | null | undefined> {
  if (!NUBE_ACTIVA) return undefined
  try {
    const n = await nube(); const u = await uid(); if (!u) return undefined
    const d = await n.fs.getDoc(n.fs.doc(n.db, 'usuarios', u))
    return d.exists() && typeof d.data().favorita === 'string' ? (d.data().favorita as string) : null
  } catch { return undefined }
}
export async function guardarFavoritaNube(id: string): Promise<void> {
  if (!NUBE_ACTIVA || !/^[a-z]{2,4}$/.test(id)) return
  try { const n = await nube(); const u = await uid(); if (!u) return; await n.fs.setDoc(n.fs.doc(n.db, 'usuarios', u), { favorita: id }, { merge: true }) } catch { /* sin conexión */ }
}

// ---- MVP: un voto por persona (se puede cambiar); el ranking sale de contadores por jugador ----
export interface VotoMvp { id: string; n: number }
export async function votarMvp(jugadorId: string): Promise<boolean> {
  if (!NUBE_ACTIVA || !/^[a-z0-9_-]{1,60}$/.test(jugadorId)) return false
  try {
    const n = await nube(); const u = await uid(); if (!u) return false
    const votoRef = n.fs.doc(n.db, 'mvpVotos', u)
    await n.fs.runTransaction(n.db, async (tx) => {
      const prev = await tx.get(votoRef)
      const antes = prev.exists() ? (prev.data().jugador as string) : null
      if (antes === jugadorId) return
      const nuevoRef = n.fs.doc(n.db, 'mvpConteo', jugadorId)
      const nuevo = await tx.get(nuevoRef)
      let viejo: { ref: ReturnType<typeof n.fs.doc>; n: number } | null = null
      if (antes) { const r = n.fs.doc(n.db, 'mvpConteo', antes); const d = await tx.get(r); viejo = { ref: r, n: d.exists() ? (d.data().n as number) : 0 } }
      tx.set(votoRef, { jugador: jugadorId, creada: Date.now() })
      tx.set(nuevoRef, { n: (nuevo.exists() ? (nuevo.data().n as number) : 0) + 1 })
      if (viejo && viejo.n > 0) tx.set(viejo.ref, { n: viejo.n - 1 })
    })
    return true
  } catch { return false }
}
export async function leerRankingMvp(): Promise<VotoMvp[] | null> {
  if (!NUBE_ACTIVA) return null
  try {
    const n = await nube()
    const q = n.fs.query(n.fs.collection(n.db, 'mvpConteo'), n.fs.orderBy('n', 'desc'), n.fs.limit(40))
    return (await n.fs.getDocs(q)).docs.map((d) => ({ id: d.id, n: d.data().n as number })).filter((x) => x.n > 0)
  } catch { return null }
}

// ---- progreso de la historia oficial: se guarda por cuenta y se toma el avance más alto entre el navegador y la nube ----
export async function leerNivelNube(): Promise<number | null> {
  if (!NUBE_ACTIVA) return null
  try { const n = await nube(); const u = await uid(); if (!u) return null; const d = await n.fs.getDoc(n.fs.doc(n.db, 'progreso', u)); return d.exists() ? (d.data().nivel as number) : null } catch { return null }
}
export async function guardarNivelNube(nivel: number): Promise<void> {
  if (!NUBE_ACTIVA) return
  try { const n = await nube(); const u = await uid(); if (!u) return; await n.fs.setDoc(n.fs.doc(n.db, 'progreso', u), { nivel, actualizado: Date.now() }) } catch { /* sin conexión */ }
}

// ---- lectura (solo Admin: las reglas lo hacen cumplir) ----
async function todos<T>(col: string, max = 2000): Promise<T[]> {
  const n = await nube()
  const q = n.fs.query(n.fs.collection(n.db, col), n.fs.limit(max))
  const s = await n.fs.getDocs(q)
  return s.docs.map((d) => ({ id: d.id, ...(d.data() as object) }) as T)
}
export const leerUsuarios = () => todos<UsuarioReg>('usuarios')
export const leerEncuestas = async () => (await todos<EncuestaReg>('encuestas')).sort((a, b) => b.creada - a.creada)
export const leerMundiales = async () => (await todos<MundialReg>('mundiales')).sort((a, b) => b.creada - a.creada)
export const leerProgresos = () => todos<ProgresoReg>('progreso')
export async function borrarEncuesta(id: string) { const n = await nube(); await n.fs.deleteDoc(n.fs.doc(n.db, 'encuestas', id)) }
