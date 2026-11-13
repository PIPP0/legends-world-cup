// Mi Once Ideal: el equipo y las estadísticas del duelo viven en el navegador, y para quien tiene cuenta (Google) también en la nube (duelo/{uid}),
// así el equipo aparece en cualquier dispositivo. Reglas de seguridad de los datos: nunca se sobrescribe con algo vacío y, si hay dos versiones,
// gana el once armado más reciente; en las estadísticas gana la que lleva más partidos.
import { NUBE_ACTIVA, cuentaActual, nube } from './firebase'
import type { Equipo } from '../engine/duelo'

export interface StatsDuelo { jugados: number; ganados: number; perdidos: number; racha: number; mejorRacha: number }
const K_EQUIPO = 'lwc:duelo:equipo'
const K_STATS = 'lwc:duelo:stats'
const K_RECARGA = 'lwc:duelo:sync-recarga'

const esEquipo = (e: unknown): e is Equipo => {
  const x = e as Equipo | null
  return !!x && typeof x.formacion === 'string' && Array.isArray(x.once) && x.once.length === 11 && x.once.every((i) => typeof i === 'string') && Array.isArray(x.suplentes) && typeof x.creado === 'number'
}
const esStats = (s: unknown): s is StatsDuelo => {
  const x = s as StatsDuelo | null
  return !!x && ['jugados', 'ganados', 'perdidos', 'racha', 'mejorRacha'].every((k) => Number.isFinite((x as unknown as Record<string, number>)[k]))
}
const leerLocal = <T,>(k: string): T | null => { try { return JSON.parse(localStorage.getItem(k) ?? 'null') as T | null } catch { return null } }

// Pura y probada: decide qué queda tras comparar lo local con lo de la nube.
export function fusionarDuelo(local: { equipo: Equipo | null; stats: StatsDuelo | null }, nubeD: { equipo: Equipo | null; stats: StatsDuelo | null }) {
  const equipo = !local.equipo ? nubeD.equipo : !nubeD.equipo ? local.equipo : nubeD.equipo.creado > local.equipo.creado ? nubeD.equipo : local.equipo
  const stats = !local.stats ? nubeD.stats : !nubeD.stats ? local.stats : nubeD.stats.jugados > local.stats.jugados ? nubeD.stats : local.stats
  return { equipo, stats }
}

let sincronizado = false // hasta que no termine la sincronización de entrada no se sube nada (evita pisar lo que ya hay en la nube con algo viejo o vacío)

// Se llama al entrar con una cuenta de Google. Si la nube trae algo nuevo para este dispositivo se recarga UNA vez para que la portada y el duelo lo muestren.
export async function sincronizarDuelo(): Promise<void> {
  if (!NUBE_ACTIVA) return
  try {
    const c = await cuentaActual(); if (!c || c.anonimo) return
    const n = await nube(); const ref = n.fs.doc(n.db, 'duelo', c.uid)
    const d = await n.fs.getDoc(ref)
    const dat = d.exists() ? (d.data() as { equipo?: unknown; stats?: unknown }) : {}
    const delaNube = { equipo: esEquipo(dat.equipo) ? dat.equipo : null, stats: esStats(dat.stats) ? dat.stats : null }
    const local = { equipo: leerLocal<Equipo>(K_EQUIPO), stats: leerLocal<StatsDuelo>(K_STATS) }
    if (!esEquipo(local.equipo)) local.equipo = null
    if (!esStats(local.stats)) local.stats = null
    const r = fusionarDuelo(local, delaNube)
    const cambioLocal = JSON.stringify(r.equipo) !== JSON.stringify(local.equipo) || JSON.stringify(r.stats) !== JSON.stringify(local.stats)
    if (cambioLocal) {
      if (r.equipo) localStorage.setItem(K_EQUIPO, JSON.stringify(r.equipo))
      if (r.stats) localStorage.setItem(K_STATS, JSON.stringify(r.stats))
    }
    if ((r.equipo || r.stats) && (JSON.stringify(r.equipo) !== JSON.stringify(delaNube.equipo) || JSON.stringify(r.stats) !== JSON.stringify(delaNube.stats))) {
      await n.fs.setDoc(ref, { ...(r.equipo ? { equipo: r.equipo } : {}), ...(r.stats ? { stats: r.stats } : {}), actualizado: Date.now() }, { merge: true })
    }
    sincronizado = true
    if (cambioLocal && sessionStorage.getItem(K_RECARGA) !== '1') { sessionStorage.setItem(K_RECARGA, '1'); location.reload() }
  } catch { /* si falla, todo sigue funcionando con lo guardado en este dispositivo */ }
}

// Cada vez que cambian el equipo o las estadísticas en este dispositivo (y hay cuenta), se guardan en la nube. Nunca se envía un equipo vacío.
let temporizador: ReturnType<typeof setTimeout> | null = null
export function guardarDueloNube(equipo: Equipo | null, stats: StatsDuelo | null): void {
  const statsReales = esStats(stats) && stats.jugados > 0 ? stats : null // unas estadísticas en cero nunca pisan las de la nube
  if (!NUBE_ACTIVA || !sincronizado || (!esEquipo(equipo) && !statsReales)) return
  if (temporizador) clearTimeout(temporizador)
  temporizador = setTimeout(() => { void (async () => {
    try {
      const c = await cuentaActual(); if (!c || c.anonimo) return
      const n = await nube()
      await n.fs.setDoc(n.fs.doc(n.db, 'duelo', c.uid), { ...(esEquipo(equipo) ? { equipo } : {}), ...(statsReales ? { stats: statsReales } : {}), actualizado: Date.now() }, { merge: true })
    } catch { /* sin conexión o reglas sin publicar: queda en este dispositivo */ }
  })() }, 1500)
}

// Botón «Guardar mi equipo en mi cuenta» (menú Mi cuenta): sube lo de este dispositivo, lo vuelve a leer para comprobarlo y dice qué pasó.
export async function subirDueloAhora(): Promise<{ ok: boolean; clave: 'sin-equipo' | 'sin-cuenta' | 'guardado' | 'error'; codigo?: string }> {
  try {
    const c = await cuentaActual(); if (!c || c.anonimo) return { ok: false, clave: 'sin-cuenta' }
    const equipo = leerLocal<Equipo>(K_EQUIPO); const stats = leerLocal<StatsDuelo>(K_STATS)
    if (!esEquipo(equipo)) {
      // este dispositivo no tiene equipo: ¿ya está en la nube?
      const n = await nube(); const d = await n.fs.getDoc(n.fs.doc(n.db, 'duelo', c.uid))
      return d.exists() && esEquipo((d.data() as { equipo?: unknown }).equipo) ? { ok: true, clave: 'guardado' } : { ok: false, clave: 'sin-equipo' }
    }
    const n = await nube(); const ref = n.fs.doc(n.db, 'duelo', c.uid)
    await n.fs.setDoc(ref, { equipo, ...(esStats(stats) && stats.jugados > 0 ? { stats } : {}), actualizado: Date.now() }, { merge: true })
    const d = await n.fs.getDoc(ref)
    return esEquipo((d.data() as { equipo?: unknown } | undefined)?.equipo) ? { ok: true, clave: 'guardado' } : { ok: false, clave: 'error', codigo: 'no-se-pudo-leer' }
  } catch (e) { return { ok: false, clave: 'error', codigo: String((e as { code?: string }).code ?? (e as Error).message ?? 'error').replace('firestore/', '').slice(0, 40) } }
}
