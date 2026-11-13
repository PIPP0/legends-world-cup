import { NUBE_ACTIVA, nube } from './firebase'
import { PUNTOS_VICTORIA, aliasLimpio, esAliasPorDefecto, type MiRanking, type EntradaRanking } from '../engine/ranking'
import type { Nivel } from '../engine/duelo'

// Ranking público del duelo: un documento por persona (ranking/{uid}) con su nombre público elegido, país aproximado y totales.
// Las reglas de Firestore solo dejan sumar una partida por escritura (y como mucho los puntos de una victoria).
const uid = async (): Promise<string | null> => { const n = await nube(); await n.auth.authStateReady(); return n.auth.currentUser?.uid ?? null }
export const miIdRanking = async (): Promise<string | null> => { if (!NUBE_ACTIVA) return null; try { return await uid() } catch { return null } }

async function leerRankingDeLaNube(): Promise<EntradaRanking[]> {
  if (!NUBE_ACTIVA) return []
  try {
    const n = await nube()
    const q = n.fs.query(n.fs.collection(n.db, 'ranking'), n.fs.orderBy('puntos', 'desc'), n.fs.limit(50))
    const snap = await n.fs.getDocs(q)
    return snap.docs.map((d) => { const x = d.data() as Record<string, unknown>; return { id: d.id, alias: String(x.alias ?? 'Jugador'), pais: String(x.pais ?? ''), puntos: Number(x.puntos ?? 0), ganadas: Number(x.ganadas ?? 0), jugadas: Number(x.jugadas ?? 0), mejorRacha: Number(x.mejorRacha ?? 0), aliasCambiado: x.aliasCambiado === true } })
  } catch { return [] }
}

// Cada lectura cuesta hasta 50 lecturas de Firestore. Se guarda el resultado 2 minutos y las pantallas que lo piden a la vez comparten UNA sola consulta
// (el botón de Ranking, el resumen y la página lo usan juntos). Se vacía al publicar una partida propia.
const VIGENCIA_RANKING_MS = 120_000
let cacheRanking: { en: number; datos: EntradaRanking[] } | null = null
let enVuelo: Promise<EntradaRanking[]> | null = null
let cacheMio: { en: number; dato: EntradaRanking | null } | null = null
export function vaciarCacheRanking(): void { cacheRanking = null; cacheMio = null }
// Mi propio registro se lee aparte (1 lectura): así mis datos son los de la nube aunque yo no esté entre los 50 primeros.
export async function leerMiRegistro(): Promise<EntradaRanking | null> {
  if (!NUBE_ACTIVA) return null
  if (cacheMio && Date.now() - cacheMio.en < VIGENCIA_RANKING_MS) return cacheMio.dato
  try {
    const n = await nube(); const u = await uid(); if (!u) return null
    const d = await n.fs.getDoc(n.fs.doc(n.db, 'ranking', u))
    const x = d.exists() ? (d.data() as Record<string, unknown>) : null
    const dato = x ? { id: u, alias: String(x.alias ?? 'Jugador'), pais: String(x.pais ?? ''), puntos: Number(x.puntos ?? 0), ganadas: Number(x.ganadas ?? 0), jugadas: Number(x.jugadas ?? 0), mejorRacha: Number(x.mejorRacha ?? 0), aliasCambiado: x.aliasCambiado === true } : null
    cacheMio = { en: Date.now(), dato }; return dato
  } catch { return null }
}
export async function leerRankingNube(): Promise<EntradaRanking[]> {
  if (cacheRanking && Date.now() - cacheRanking.en < VIGENCIA_RANKING_MS) return cacheRanking.datos
  if (!enVuelo) enVuelo = leerRankingDeLaNube().then((d) => { cacheRanking = { en: Date.now(), datos: d }; return d }).finally(() => { enVuelo = null })
  return enVuelo
}

// Suma una partida terminada a mi documento (lo crea si no existe). Devuelve true si se publicó.
export async function publicarPartida(alias: string, pais: string, nivel: Nivel, gane: boolean, aliasCambiado = false, local?: MiRanking): Promise<boolean> {
  if (!NUBE_ACTIVA) return false
  try {
    const n = await nube(); const u = await uid(); if (!u) return false
    const ref = n.fs.doc(n.db, 'ranking', u)
    const previo = await n.fs.getDoc(ref)
    if (!previo.exists()) {
      // Primer registro en la nube: se trae el historial que la persona ya tenía en este dispositivo (incluida esta partida) para que NADA se pierda.
      // Si por tamaño las reglas no lo aceptan, se crea con esta partida sola.
      const base = local && local.jugadas >= 1 && local.ganadas <= local.jugadas ? local : { puntos: gane ? PUNTOS_VICTORIA[nivel] : 0, ganadas: gane ? 1 : 0, jugadas: 1, racha: gane ? 1 : 0, mejorRacha: gane ? 1 : 0 }
      const doc = (m: { puntos: number; ganadas: number; jugadas: number; racha: number; mejorRacha: number }) => ({ alias: aliasLimpio(alias) || 'Jugador', pais: pais.slice(0, 2).toLowerCase(), aliasCambiado, puntos: m.puntos, ganadas: m.ganadas, jugadas: m.jugadas, racha: m.racha, mejorRacha: Math.min(m.mejorRacha, m.jugadas), ultimo: Date.now() })
      try { await n.fs.setDoc(ref, doc(base)) } catch { await n.fs.setDoc(ref, doc({ puntos: gane ? PUNTOS_VICTORIA[nivel] : 0, ganadas: gane ? 1 : 0, jugadas: 1, racha: gane ? 1 : 0, mejorRacha: gane ? 1 : 0 })) }
      vaciarCacheRanking(); return true
    }
    const p = previo.data() as Record<string, number>
    const prev = previo.data() as Record<string, unknown>
    const yaCambiado = prev.aliasCambiado === true // si ya cambió su nombre en otro dispositivo, manda el de la nube
    const racha = gane ? (p.racha ?? 0) + 1 : 0
    await n.fs.setDoc(ref, {
      alias: yaCambiado ? String(prev.alias ?? 'Jugador') : String(prev.alias ?? '') || aliasLimpio(alias) || 'Jugador', pais: pais.slice(0, 2).toLowerCase(), aliasCambiado: yaCambiado || aliasCambiado,
      puntos: (p.puntos ?? 0) + (gane ? PUNTOS_VICTORIA[nivel] : 0), ganadas: (p.ganadas ?? 0) + (gane ? 1 : 0), jugadas: (p.jugadas ?? 0) + 1,
      racha, mejorRacha: Math.max(p.mejorRacha ?? 0, racha), ultimo: Date.now(),
    })
    vaciarCacheRanking()
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
    vaciarCacheRanking()
    return true
  } catch { return false }
}

// Al entrar con Google, si el nombre público sigue siendo el automático «Jugador XXXX», se cambia al nombre de la cuenta SIN gastar el único cambio manual.
export async function nombreAutomaticoNube(alias: string): Promise<boolean> {
  if (!NUBE_ACTIVA) return false
  try {
    const n = await nube(); const u = await uid(); if (!u) return false
    const ref = n.fs.doc(n.db, 'ranking', u); const previo = await n.fs.getDoc(ref)
    if (!previo.exists()) return false
    const p = previo.data() as Record<string, unknown>
    if (p.aliasCambiado === true || !esAliasPorDefecto(String(p.alias ?? ''))) return false
    await n.fs.setDoc(ref, { ...p, alias: aliasLimpio(alias) || 'Jugador' })
    vaciarCacheRanking()
    return true
  } catch { return false }
}

// ---- Administración: ver y corregir los datos del ranking (las reglas solo se lo permiten a Admin) ----
export interface RegistroRankingAdmin { id: string; alias: string; pais: string; puntos: number; ganadas: number; jugadas: number; racha: number; mejorRacha: number; aliasCambiado: boolean }
export async function leerRankingAdmin(): Promise<RegistroRankingAdmin[]> {
  const n = await nube()
  const s = await n.fs.getDocs(n.fs.query(n.fs.collection(n.db, 'ranking'), n.fs.limit(500)))
  return s.docs.map((d) => { const x = d.data() as Record<string, unknown>; return { id: d.id, alias: String(x.alias ?? ''), pais: String(x.pais ?? ''), puntos: Number(x.puntos ?? 0), ganadas: Number(x.ganadas ?? 0), jugadas: Number(x.jugadas ?? 0), racha: Number(x.racha ?? 0), mejorRacha: Number(x.mejorRacha ?? 0), aliasCambiado: x.aliasCambiado === true } })
    .sort((a, b) => b.puntos - a.puntos || b.ganadas - a.ganadas)
}
export async function corregirRankingAdmin(d: RegistroRankingAdmin): Promise<void> {
  const ok = Number.isInteger(d.puntos) && Number.isInteger(d.ganadas) && Number.isInteger(d.jugadas) && Number.isInteger(d.racha) && Number.isInteger(d.mejorRacha)
    && d.puntos >= 0 && d.ganadas >= 0 && d.jugadas >= 0 && d.racha >= 0 && d.ganadas <= d.jugadas && d.mejorRacha >= d.racha && d.puntos <= 100000 && d.jugadas <= 100000
  const alias = aliasLimpio(d.alias)
  if (!ok || alias.length < 1) throw new Error('datos-invalidos')
  const n = await nube()
  await n.fs.setDoc(n.fs.doc(n.db, 'ranking', d.id), { alias, pais: d.pais.slice(0, 2).toLowerCase(), aliasCambiado: d.aliasCambiado, puntos: d.puntos, ganadas: d.ganadas, jugadas: d.jugadas, racha: d.racha, mejorRacha: d.mejorRacha, ultimo: Date.now() })
  vaciarCacheRanking()
}
