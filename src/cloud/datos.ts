import { NUBE_ACTIVA, nube } from './firebase'
import type { AltTournament } from '../types'

export interface UsuarioReg { uid: string; email: string; nombre: string; foto: string; anonimo: boolean; creado: number; ultimo: number; visitas: number; idioma?: string; dispositivo?: string }
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
