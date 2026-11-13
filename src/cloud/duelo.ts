// Mi Once Ideal: el equipo y las estadísticas del duelo viven en el navegador, y para quien tiene cuenta (Google) también en la nube (duelo/{uid}),
// así el equipo aparece en cualquier dispositivo. Reglas de seguridad de los datos: nunca se sobrescribe con algo vacío y, si hay dos versiones,
// gana el once armado más reciente; en las estadísticas gana la que lleva más partidos.
import { NUBE_ACTIVA, cuentaActual, nube } from './firebase'
import type { Equipo } from '../engine/duelo'

export interface StatsDuelo { jugados: number; ganados: number; perdidos: number; racha: number; mejorRacha: number }
const K_EQUIPO = 'lwc:duelo:equipo'
const K_STATS = 'lwc:duelo:stats'
const K_RESPALDO = 'lwc:duelo:equipo-respaldo' // equipo anterior de este dispositivo cuando la cuenta ya tenía otro: nunca se borra
const K_PARTIDA = 'lwc:duelo:partida' // marcador de partido en curso (lo escribe el duelo)
const K_RECARGA = 'lwc:duelo:sync-recarga'
export const K_AVISO = 'lwc:duelo:aviso-editado' // marca de tiempo del último ajuste de Admin que la persona aún no ha visto
export const K_VISTO = 'lwc:duelo:editado-visto'

const esEquipo = (e: unknown): e is Equipo => {
  const x = e as Equipo | null
  return !!x && typeof x.formacion === 'string' && Array.isArray(x.once) && x.once.length === 11 && x.once.every((i) => typeof i === 'string') && Array.isArray(x.suplentes) && typeof x.creado === 'number'
}
const esStats = (s: unknown): s is StatsDuelo => {
  const x = s as StatsDuelo | null
  return !!x && ['jugados', 'ganados', 'perdidos', 'racha', 'mejorRacha'].every((k) => Number.isFinite((x as unknown as Record<string, number>)[k]))
}
const leerLocal = <T,>(k: string): T | null => { try { return JSON.parse(localStorage.getItem(k) ?? 'null') as T | null } catch { return null } }

const mismoEquipo = (a: Equipo | null, b: Equipo | null): boolean => (a === null || b === null) ? a === b : a.formacion === b.formacion && a.creado === b.creado && a.once.join('|') === b.once.join('|') && a.suplentes.join('|') === b.suplentes.join('|')
const mismasStats = (a: StatsDuelo | null, b: StatsDuelo | null): boolean => (a === null || b === null) ? a === b : a.jugados === b.jugados && a.ganados === b.ganados && a.perdidos === b.perdidos && a.racha === b.racha && a.mejorRacha === b.mejorRacha

// Pura y probada: decide qué queda tras comparar lo local con lo de la nube.
// Un equipo que ya existe NUNCA se pierde: el de la cuenta (nube) manda en todos los dispositivos; si este dispositivo tenía otro distinto, no se borra:
// se devuelve como `respaldo` para guardarlo aparte. Si la nube no tiene equipo, se queda el local. En las estadísticas gana la que lleva más partidos.
export function fusionarDuelo(local: { equipo: Equipo | null; stats: StatsDuelo | null }, nubeD: { equipo: Equipo | null; stats: StatsDuelo | null }) {
  const equipo = nubeD.equipo ?? local.equipo
  const respaldo = nubeD.equipo && local.equipo && !mismoEquipo(nubeD.equipo, local.equipo) ? local.equipo : null
  const stats = !local.stats ? nubeD.stats : !nubeD.stats ? local.stats : nubeD.stats.jugados > local.stats.jugados ? nubeD.stats : local.stats
  return { equipo, stats, respaldo }
}

let sincronizado = false // hasta que no termine la sincronización de entrada no se sube nada (evita pisar lo que ya hay en la nube con algo viejo o vacío)

// Se llama al entrar con una cuenta de Google. Si la nube trae algo nuevo para este dispositivo se recarga UNA vez para que la portada y el duelo lo muestren.
export async function sincronizarDuelo(): Promise<void> {
  if (!NUBE_ACTIVA) return
  try {
    if (sincronizado && location.hash.startsWith('#/duelo')) return // ya sincronizó al abrir: mientras la persona está en el Duelo (armando o jugando) no se cambia nada; se revisa al salir
    if (localStorage.getItem(K_PARTIDA)) return // hay un partido en curso: no se cambia nada ni se recarga a mitad de partido (se sincroniza después)
    const c = await cuentaActual(); if (!c || c.anonimo) return
    const n = await nube(); const ref = n.fs.doc(n.db, 'duelo', c.uid)
    const d = await n.fs.getDoc(ref)
    const dat = d.exists() ? (d.data() as { equipo?: unknown; stats?: unknown; editado?: { en?: number } }) : {}
    const delaNube = { equipo: esEquipo(dat.equipo) ? dat.equipo : null, stats: esStats(dat.stats) ? dat.stats : null }
    const local = { equipo: leerLocal<Equipo>(K_EQUIPO), stats: leerLocal<StatsDuelo>(K_STATS) }
    if (!esEquipo(local.equipo)) local.equipo = null
    if (!esStats(local.stats)) local.stats = null
    const r = fusionarDuelo(local, delaNube)
    const cambioLocal = !mismoEquipo(r.equipo, local.equipo) || !mismasStats(r.stats, local.stats)
    if (r.respaldo) localStorage.setItem(K_RESPALDO, JSON.stringify(r.respaldo))
    if (cambioLocal) {
      if (r.equipo) localStorage.setItem(K_EQUIPO, JSON.stringify(r.equipo))
      if (r.stats) localStorage.setItem(K_STATS, JSON.stringify(r.stats))
    }
    if ((r.equipo || r.stats) && (!mismoEquipo(r.equipo, delaNube.equipo) || !mismasStats(r.stats, delaNube.stats))) {
      await n.fs.setDoc(ref, { ...(r.equipo ? { equipo: r.equipo } : {}), ...(r.stats ? { stats: r.stats } : {}), actualizado: Date.now() }, { merge: true })
    }
    sincronizado = true
    // si el equipo que llegó de la nube lo ajustó Admin, se deja un aviso para mostrárselo a la persona una vez
    const en = (dat as { editado?: { en?: number } }).editado?.en
    if (cambioLocal && en && localStorage.getItem(K_VISTO) !== String(en)) localStorage.setItem(K_AVISO, String(en))
    const marca = String(r.equipo?.creado ?? 0) // se recarga una vez por cada equipo nuevo que llega (no en bucle)
    if (cambioLocal && sessionStorage.getItem(K_RECARGA) !== marca) { sessionStorage.setItem(K_RECARGA, marca); location.reload() }
  } catch { /* si falla, todo sigue funcionando con lo guardado en este dispositivo */ }
}

// Cada vez que cambian el equipo o las estadísticas en este dispositivo (y hay cuenta), se guardan en la nube. Nunca se envía un equipo vacío.
// Se espera un instante para juntar cambios, pero si la persona cierra o cambia de pestaña se sube de inmediato.
let temporizador: ReturnType<typeof setTimeout> | null = null
let pendiente: { equipo: Equipo | null; stats: StatsDuelo | null } | null = null
async function volcar(): Promise<void> {
  const p = pendiente; pendiente = null; if (!p) return
  const statsReales = esStats(p.stats) && p.stats.jugados > 0 ? p.stats : null // unas estadísticas en cero nunca pisan las de la nube
  if (!NUBE_ACTIVA || !sincronizado || (!esEquipo(p.equipo) && !statsReales)) return
  try {
    const c = await cuentaActual(); if (!c || c.anonimo) return
    const n = await nube()
    await n.fs.setDoc(n.fs.doc(n.db, 'duelo', c.uid), { ...(esEquipo(p.equipo) ? { equipo: p.equipo } : {}), ...(statsReales ? { stats: statsReales } : {}), actualizado: Date.now() }, { merge: true })
  } catch { /* sin conexión o reglas sin publicar: queda en este dispositivo */ }
}
export function guardarDueloNube(equipo: Equipo | null, stats: StatsDuelo | null): void {
  if (!NUBE_ACTIVA) return
  pendiente = { equipo, stats }
  if (temporizador) clearTimeout(temporizador)
  temporizador = setTimeout(() => { temporizador = null; void volcar() }, 1500)
}
// Al salir de la pestaña se sube lo pendiente; al volver (o al recuperar internet) se revisa si en otro dispositivo hay un equipo más nuevo.
if (typeof document !== 'undefined' && NUBE_ACTIVA) {
  let ultima = 0
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') { if (temporizador) { clearTimeout(temporizador); temporizador = null } void volcar() }
    else if (Date.now() - ultima > 30_000) { ultima = Date.now(); void sincronizarDuelo() }
  })
  window.addEventListener('online', () => { void sincronizarDuelo() })
  window.addEventListener('hashchange', () => { if (!location.hash.startsWith('#/duelo') && Date.now() - ultima > 30_000) { ultima = Date.now(); void sincronizarDuelo() } })
}

// ---- Administración: ver y editar el equipo de una persona (las reglas solo se lo permiten a Admin) ----
export async function leerDueloDe(uid: string): Promise<{ equipo: Equipo | null; stats: StatsDuelo | null; editado: { por: string; en: number } | null }> {
  const n = await nube(); const d = await n.fs.getDoc(n.fs.doc(n.db, 'duelo', uid))
  if (!d.exists()) return { equipo: null, stats: null, editado: null }
  const x = d.data() as { equipo?: unknown; stats?: unknown; editado?: { por?: string; en?: number } }
  return { equipo: esEquipo(x.equipo) ? x.equipo : null, stats: esStats(x.stats) ? x.stats : null, editado: x.editado?.en ? { por: String(x.editado.por ?? 'administración'), en: Number(x.editado.en) } : null }
}
// El equipo editado recibe un «creado» nuevo: así, al sincronizar, el de la nube gana sobre la copia vieja del dispositivo y nadie lo pisa por error.
export async function editarEquipoDe(uid: string, equipo: Equipo, por: string): Promise<void> {
  if (!esEquipo(equipo) || new Set(equipo.once.concat(equipo.suplentes)).size !== equipo.once.length + equipo.suplentes.length) throw new Error('equipo-invalido')
  const n = await nube(); const ahora = Date.now()
  await n.fs.setDoc(n.fs.doc(n.db, 'duelo', uid), { equipo: { ...equipo, creado: ahora }, editado: { por, en: ahora }, actualizado: ahora }, { merge: true })
}
