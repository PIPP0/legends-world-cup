import { NUBE_ACTIVA, nube } from './firebase'
import { PUNTOS_VICTORIA, aliasLimpio, type EntradaRanking } from '../engine/ranking'
import type { Nivel } from '../engine/duelo'

// Ranking público del duelo: un documento por persona (ranking/{uid}) con su nombre público elegido, país aproximado y totales.
// Las reglas de Firestore solo dejan sumar una partida por escritura (y como mucho los puntos de una victoria).
const uid = async (): Promise<string | null> => { const n = await nube(); await n.auth.authStateReady(); return n.auth.currentUser?.uid ?? null }
export const miIdRanking = async (): Promise<string | null> => { if (!NUBE_ACTIVA) return null; try { return await uid() } catch { return null } }

export async function leerRankingNube(): Promise<EntradaRanking[]> {
  if (!NUBE_ACTIVA) return []
  try {
    const n = await nube()
    const q = n.fs.query(n.fs.collection(n.db, 'ranking'), n.fs.orderBy('puntos', 'desc'), n.fs.limit(50))
    const snap = await n.fs.getDocs(q)
    return snap.docs.map((d) => { const x = d.data() as Record<string, unknown>; return { id: d.id, alias: String(x.alias ?? 'Jugador'), pais: String(x.pais ?? ''), puntos: Number(x.puntos ?? 0), ganadas: Number(x.ganadas ?? 0), jugadas: Number(x.jugadas ?? 0), mejorRacha: Number(x.mejorRacha ?? 0) } })
  } catch { return [] }
}

// Suma una partida terminada a mi documento (lo crea si no existe). Devuelve true si se publicó.
export async function publicarPartida(alias: string, pais: string, nivel: Nivel, gane: boolean, aliasCambiado = false): Promise<boolean> {
  if (!NUBE_ACTIVA) return false
  try {
    const n = await nube(); const u = await uid(); if (!u) return false
    const ref = n.fs.doc(n.db, 'ranking', u)
    const previo = await n.fs.getDoc(ref)
    const p = previo.exists() ? (previo.data() as Record<string, number>) : { puntos: 0, ganadas: 0, jugadas: 0, racha: 0, mejorRacha: 0 }
    const prev = previo.exists() ? (previo.data() as Record<string, unknown>) : null
    const yaCambiado = prev?.aliasCambiado === true // si ya cambió su nombre en otro dispositivo, manda el de la nube
    const racha = gane ? (p.racha ?? 0) + 1 : 0
    await n.fs.setDoc(ref, {
      alias: yaCambiado ? String(prev?.alias ?? 'Jugador') : aliasLimpio(alias) || 'Jugador', pais: pais.slice(0, 2).toLowerCase(), aliasCambiado: yaCambiado || aliasCambiado,
      puntos: (p.puntos ?? 0) + (gane ? PUNTOS_VICTORIA[nivel] : 0), ganadas: (p.ganadas ?? 0) + (gane ? 1 : 0), jugadas: (p.jugadas ?? 0) + 1,
      racha, mejorRacha: Math.max(p.mejorRacha ?? 0, racha), ultimo: Date.now(),
    })
    return true
  } catch { return false }
}

// Cambia solo el nombre público (si ya tengo documento).
export async function cambiarAliasNube(alias: string): Promise<boolean> {
  if (!NUBE_ACTIVA) return false
  try {
    const n = await nube(); const u = await uid(); if (!u) return false
    const ref = n.fs.doc(n.db, 'ranking', u); const previo = await n.fs.getDoc(ref)
    if (!previo.exists()) return false
    const p = previo.data() as Record<string, unknown>
    if (p.aliasCambiado === true) return false // ya usó su único cambio
    await n.fs.setDoc(ref, { ...p, alias: aliasLimpio(alias) || 'Jugador', aliasCambiado: true })
    return true
  } catch { return false }
}
