// «Armar la jugada»: un equipo ataca y el otro defiende, por turnos. Cada lado elige una estrategia y 3 jugadores en secreto;
// la estrategia contra la defensa funciona como la tabla de tipos de Pokémon, los atributos (no el puntaje) definen el encaje,
// y quien ejecuta la jugada detiene una barra: cuanto más cerca del centro, más probabilidad.
import { PLAYER_BY_ID } from '../data'
import { makeRng, type Rng } from './rng'
import { NIVELES, poderArquero, type Equipo, type Nivel } from './duelo'
import type { Player } from '../types'

// ---------- estrategias y tabla de efectividad ----------
export type Ataque = 'contra' | 'bandas' | 'centro' | 'largo'
export type Defensa = 'presion' | 'bloque' | 'marca' | 'cierre'
export const ATAQUES: Ataque[] = ['contra', 'bandas', 'centro', 'largo']
export const DEFENSAS: Defensa[] = ['presion', 'bloque', 'marca', 'cierre']
// +2 súper efectivo para el ataque … −2 la defensa lo frena casi por completo.
export const MATRIZ: Record<Ataque, Record<Defensa, number>> = {
  contra: { presion: 2, bloque: -2, marca: 0, cierre: 0 },
  bandas: { presion: -1, bloque: 1, marca: 1, cierre: -2 },
  centro: { presion: -2, bloque: -1, marca: 0, cierre: 2 },
  largo: { presion: 2, bloque: 1, marca: -2, cierre: 0 },
}
export const PUNTOS_POR_NIVEL = 8 // cuánto pesa un nivel de efectividad en la calidad de la jugada

// Atributos que pide cada estrategia (suman 1).
export const PESOS_ATAQUE: Record<Ataque, [string, number][]> = {
  contra: [['Ritmo', 0.6], ['Regate', 0.2], ['Disparo', 0.2]],
  bandas: [['Regate', 0.4], ['Ritmo', 0.3], ['Pase', 0.3]],
  centro: [['Pase', 0.5], ['Disparo', 0.3], ['Regate', 0.2]],
  largo: [['Físico', 0.4], ['Disparo', 0.3], ['Pase', 0.3]],
}
export const PESOS_DEFENSA: Record<Defensa, [string, number][]> = {
  presion: [['Ritmo', 0.4], ['Físico', 0.3], ['Defensa', 0.3]],
  bloque: [['Defensa', 0.6], ['Físico', 0.4]],
  marca: [['Defensa', 0.4], ['Físico', 0.4], ['Ritmo', 0.2]],
  cierre: [['Ritmo', 0.4], ['Defensa', 0.4], ['Pase', 0.2]],
}

// ---------- estilo del jugador (su mejor característica) ----------
export type Estilo = 'veloz' | 'regateador' | 'fuerte' | 'pasador' | 'goleador' | 'muro'
const ESTILO_DE: Record<string, Estilo> = { Ritmo: 'veloz', Regate: 'regateador', Físico: 'fuerte', Pase: 'pasador', Disparo: 'goleador', Defensa: 'muro' }
export function estiloJugador(p: Player): Estilo {
  let mejor = 'Ritmo', v = -1
  for (const a of p.attrs) if (ESTILO_DE[a.k] && a.v > v) { v = a.v; mejor = a.k }
  return ESTILO_DE[mejor]
}
// Estilos que «encajan» con cada estrategia: dan un bonus, como el bonus de tipo propio en Pokémon.
export const AFINIDAD_ATAQUE: Record<Ataque, Estilo[]> = { contra: ['veloz'], bandas: ['regateador', 'veloz'], centro: ['pasador', 'goleador'], largo: ['fuerte', 'goleador'] }
export const AFINIDAD_DEFENSA: Record<Defensa, Estilo[]> = { presion: ['veloz', 'fuerte'], bloque: ['muro'], marca: ['fuerte', 'muro'], cierre: ['veloz', 'muro'] }
export const BONUS_ESTILO = 4

const attr = (p: Player, k: string): number => p.attrs.find((a) => a.k === k)?.v ?? Math.max(40, p.ovr - 15)
const mezcla = (p: Player, pesos: [string, number][]) => pesos.reduce((s, [k, w]) => s + attr(p, k) * w, 0)

// Ajustes por jugador (poderes, sinergia de país).
export type Aj = Record<string, number>
export const encajeAtaque = (id: string, e: Ataque, aj: Aj = {}): number => {
  const p = PLAYER_BY_ID[id]
  return mezcla(p, PESOS_ATAQUE[e]) + (AFINIDAD_ATAQUE[e].includes(estiloJugador(p)) ? BONUS_ESTILO : 0) + (aj[id] ?? 0)
}
export const encajeDefensa = (id: string, e: Defensa, aj: Aj = {}): number => {
  const p = PLAYER_BY_ID[id]
  return mezcla(p, PESOS_DEFENSA[e]) + (AFINIDAD_DEFENSA[e].includes(estiloJugador(p)) ? BONUS_ESTILO : 0) + (aj[id] ?? 0)
}
export const tieneEstilo = (id: string, e: Ataque | Defensa, ataca: boolean): boolean => {
  const s = estiloJugador(PLAYER_BY_ID[id])
  return ataca ? AFINIDAD_ATAQUE[e as Ataque].includes(s) : AFINIDAD_DEFENSA[e as Defensa].includes(s)
}

// ---------- la barra ----------
// El balón cruza la barra más lento cuanto mejor encaja el jugador con la jugada (más fácil detenerlo en el centro).
export function segundosBarra(encaje: number): number {
  const t = Math.min(1, Math.max(0, (105 - encaje) / 45))
  return 1.7 - 1.1 * t // 1,7 s (encaje 105+) … 0,6 s (encaje 60-)
}
// Posición 0..1 del balón: va y viene; 0,5 es el centro ideal.
export const precision = (x: number): number => {
  const d = Math.abs(x - 0.5)
  return d <= 0.04 ? 1 : Math.max(0, 1 - (d - 0.04) / 0.4)
}

// ---------- resolver una jugada ----------
export const TURNOS = 10 // 5 ataques por lado, alternados
export interface DetalleJugada {
  ataca: 'mio' | 'su'
  est: { ataque: Ataque; defensa: Defensa }
  nivel: number // efectividad de la estrategia para quien ataca (−2…+2)
  trioA: string[]; trioD: string[]
  ejecutor: string; interceptor?: string
  calidadA: number; calidadD: number
  precA: number; precD: number
  pPaso: number; pRemate: number; pGol: number
  rem: number; arq: number
  clima: number
  t1: number; t2?: number
  resultado: 'gol' | 'atajada' | 'corte'
  arquero: string
}
const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x))
const sig = (x: number) => 1 / (1 + Math.exp(-x))
export const ESCALA_CALIDAD = 5.5
export const PESO_BARRA_ATAQUE = 0.65 // cuánto de la efectividad del remate depende de tu toque
export const PESO_BARRA_DEFENSA = 0.25 // cuánto puede frenar tu defensa un buen toque

export function resolverJugada(a: {
  seed: string; turno: number; ataca: 'mio' | 'su'
  ataque: Ataque; defensa: Defensa
  trioA: string[]; trioD: string[]; ajA: Aj; ajD: Aj
  ejecutor: string; interceptor?: string
  precA: number; precD: number
  arquero: string; clima: number
}): DetalleJugada {
  const rng = makeRng(`${a.seed}:jugada:${a.turno}`)
  const nivel = MATRIZ[a.ataque][a.defensa]
  const calidadA = a.trioA.reduce((s, id) => s + encajeAtaque(id, a.ataque, a.ajA), 0) / a.trioA.length
  const calidadD = a.trioD.reduce((s, id) => s + encajeDefensa(id, a.defensa, a.ajD), 0) / a.trioD.length
  const base = sig((calidadA - calidadD + PUNTOS_POR_NIVEL * nivel) / ESCALA_CALIDAD)
  const pPaso = clamp(base * (1 - PESO_BARRA_DEFENSA * a.precD), 0.03, 0.97)
  const rem = attr(PLAYER_BY_ID[a.ejecutor], 'Disparo') + (a.ajA[a.ejecutor] ?? 0)
  const arq = poderArquero(PLAYER_BY_ID[a.arquero])
  const kF = clamp(0.9 + (rem - arq) / 150, 0.75, 1.15)
  const pRemate = clamp((1 - PESO_BARRA_ATAQUE + PESO_BARRA_ATAQUE * a.precA) * kF * a.clima * 1.15, 0.03, 0.97)
  const t1 = rng()
  const base2 = { ataca: a.ataca, est: { ataque: a.ataque, defensa: a.defensa }, nivel, trioA: a.trioA, trioD: a.trioD, ejecutor: a.ejecutor, interceptor: a.interceptor, calidadA, calidadD, precA: a.precA, precD: a.precD, pPaso, pRemate, pGol: pPaso * pRemate, rem, arq, clima: a.clima, t1, arquero: a.arquero }
  if (t1 >= pPaso) return { ...base2, resultado: 'corte' }
  const t2 = rng()
  return { ...base2, t2, resultado: t2 < pRemate ? 'gol' : 'atajada' }
}

// ---------- disponibilidad ----------
// Se puede elegir a cualquiera del once menos el arquero, sin los que jugaron el turno anterior; los suplentes entran desde el turno 4.
export function disponibles(equipo: Equipo, turno: number, cansados: string[], excluir: string[] = []): string[] {
  return [...equipo.once, ...(turno >= 4 ? equipo.suplentes : [])].filter((id) => !cansados.includes(id) && !excluir.includes(id) && PLAYER_BY_ID[id].line !== 'GK')
}

// ---------- la máquina ----------
const barajarSemilla = <T,>(xs: T[], rng: Rng): T[] => { const a = [...xs]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] } return a }
const ruido = (nivel: Nivel) => NIVELES.find((n) => n.id === nivel)!.ruido
const mejoresTres = (ids: string[], f: (id: string) => number, rng: Rng, nivel: Nivel): string[] =>
  ids.map((id) => ({ id, v: f(id) + (rng() - 0.5) * 2 * ruido(nivel) })).sort((x, y) => y.v - x.v).slice(0, 3).map((x) => x.id)

export interface HistorialJugada { ataca: 'mio' | 'su'; ataque: Ataque; defensa: Defensa }
const masFrecuente = <T extends string>(xs: T[]): T | undefined => { const m: Record<string, number> = {}; xs.forEach((x) => { m[x] = (m[x] ?? 0) + 1 }); return (Object.entries(m).sort((a, b) => b[1] - a[1])[0]?.[0]) as T | undefined }

export function eligeAtaqueMaquina(seed: string, turno: number, equipo: Equipo, cansados: string[], nivel: Nivel, hist: HistorialJugada[], aj: Aj = {}): { ataque: Ataque; trio: string[] } {
  const rng = makeRng(`${seed}:ia-ataque:${turno}`)
  const libres = disponibles(equipo, turno, cansados)
  const suyoPrevio = hist.filter((h) => h.ataca === 'su').map((h) => h.ataque)
  // contra qué defensa suele jugar la persona (para que los niveles altos la «lean»)
  const defensaRival = nivel === 'leyenda' || nivel === 'oro' ? masFrecuente(hist.filter((h) => h.ataca === 'su').map((h) => h.defensa)) : undefined
  const evalua = (e: Ataque) => {
    const trio = mejoresTres(libres, (id) => encajeAtaque(id, e, aj), rng, nivel)
    const q = trio.reduce((s, id) => s + encajeAtaque(id, e, aj), 0) / 3
    const m = defensaRival ? MATRIZ[e][defensaRival] : 0
    const repetida = suyoPrevio[suyoPrevio.length - 1] === e ? -6 : 0
    return { e, trio, v: q + (nivel === 'bronce' ? (rng() - 0.5) * 40 : PUNTOS_POR_NIVEL * m * 0.6 + repetida + (rng() - 0.5) * ruido(nivel) * 2) }
  }
  const mejor = ATAQUES.map(evalua).sort((x, y) => y.v - x.v)[0]
  return { ataque: mejor.e, trio: mejor.trio }
}
export function eligeDefensaMaquina(seed: string, turno: number, equipo: Equipo, cansados: string[], nivel: Nivel, hist: HistorialJugada[], aj: Aj = {}): { defensa: Defensa; trio: string[] } {
  const rng = makeRng(`${seed}:ia-defensa:${turno}`)
  const libres = disponibles(equipo, turno, cansados)
  const ataqueRival = nivel === 'leyenda' || nivel === 'oro' ? masFrecuente(hist.filter((h) => h.ataca === 'mio').map((h) => h.ataque)) : undefined
  const evalua = (d: Defensa) => {
    const trio = mejoresTres(libres, (id) => encajeDefensa(id, d, aj), rng, nivel)
    const q = trio.reduce((s, id) => s + encajeDefensa(id, d, aj), 0) / 3
    const m = ataqueRival ? -MATRIZ[ataqueRival][d] : 0
    return { d, trio, v: q + (nivel === 'bronce' ? (rng() - 0.5) * 40 : PUNTOS_POR_NIVEL * m * 0.6 + (rng() - 0.5) * ruido(nivel) * 2) }
  }
  const mejor = DEFENSAS.map(evalua).sort((x, y) => y.v - x.v)[0]
  return { defensa: mejor.d, trio: mejor.trio }
}
// El toque de la máquina en la barra: más nivel = más cerca del centro; con el balón rápido falla más.
export function toqueMaquina(seed: string, turno: number, nivel: Nivel, segundos: number, rol: 'ataca' | 'defiende'): number {
  const rng = makeRng(`${seed}:ia-toque:${turno}:${rol}`)
  const sigma = { bronce: 0.2, plata: 0.14, oro: 0.09, leyenda: 0.05 }[nivel] * Math.sqrt(1.7 / segundos)
  const g = (rng() + rng() + rng() + rng() - 2) / 0.58 // ~N(0,1)
  return clamp(0.5 + g * sigma, 0, 1)
}
// Quién ejecuta y quién intercepta en la máquina: el de mejor encaje de su trío.
export const mejorDelTrio = (trio: string[], f: (id: string) => number): string => [...trio].sort((a, b) => f(b) - f(a))[0]
export const barajaTrio = barajarSemilla

// ---------- poderes sobre el trío (una vez por partida cada uno, en secreto) ----------
import { TIPOS_PODER, type Disponibles, type Efecto, type Poder } from './duelo'
export const IMPULSO_ENC = 6 // ≈ +2 a la calidad de todo el trío
export const DEBILITAR_ENC = 8 // ≈ −3 a la calidad de todo el trío
// Qué jugador de cada trío queda bloqueado (si el poder apunta a alguien de ese trío).
export function bloqueados(pm: Poder | undefined, ps: Poder | undefined, trioMio: string[], trioSu: string[]): { mio?: string; su?: string } {
  return { su: pm?.tipo === 'bloqueo' && trioSu.includes(pm.objetivo) ? pm.objetivo : undefined, mio: ps?.tipo === 'bloqueo' && trioMio.includes(ps.objetivo) ? ps.objetivo : undefined }
}
// Efectos sobre los tríos finales. Si el jugador objetivo ya no juega (fue bloqueado y cambiado), el poder se pierde.
export function aplicarPoderesTrio(pm: Poder | undefined, ps: Poder | undefined, trioMio: string[], trioSu: string[]): { ajMio: Aj; ajSu: Aj; efectos: Efecto[] } {
  const ajMio: Aj = {}, ajSu: Aj = {}, efectos: Efecto[] = []
  const uno = (de: 'mio' | 'su', pw: Poder | undefined) => {
    if (!pw) return
    const propio = de === 'mio' ? trioMio : trioSu, ajeno = de === 'mio' ? trioSu : trioMio
    const ajPropio = de === 'mio' ? ajMio : ajSu, ajAjeno = de === 'mio' ? ajSu : ajMio
    if (pw.tipo === 'impulso') { const ok = propio.includes(pw.objetivo); if (ok) ajPropio[pw.objetivo] = (ajPropio[pw.objetivo] ?? 0) + IMPULSO_ENC; efectos.push({ de, tipo: pw.tipo, objetivo: pw.objetivo, aplicado: ok }) }
    else if (pw.tipo === 'debilitar') { const ok = ajeno.includes(pw.objetivo); if (ok) ajAjeno[pw.objetivo] = (ajAjeno[pw.objetivo] ?? 0) - DEBILITAR_ENC; efectos.push({ de, tipo: pw.tipo, objetivo: pw.objetivo, aplicado: ok }) }
    else efectos.push({ de, tipo: pw.tipo, objetivo: pw.objetivo, aplicado: !ajeno.includes(pw.objetivo) })
  }
  uno('mio', pm); uno('su', ps)
  return { ajMio, ajSu, efectos }
}
// La máquina reemplaza al bloqueado por el mejor disponible para esa jugada.
export function reemplazoTrio(equipo: Equipo, turno: number, cansados: string[], trio: string[], bloqueado: string, puntaje: (id: string) => number): string[] {
  const c = disponibles(equipo, turno, cansados, [...trio, bloqueado]).sort((a, b) => puntaje(b) - puntaje(a))
  return c.length ? trio.map((id) => (id === bloqueado ? c[0] : id)) : trio
}
// La máquina decide en secreto si juega un poder y a quién. Más nivel = lo usa donde más pesa; con el tiempo siempre los gasta.
export function eligePoderTrio(seed: string, turno: number, nivel: Nivel, disp: Disponibles, trioSu: string[], trioMio: string[], puntajeSu: (id: string) => number, puntajeMio: (id: string) => number): Poder | undefined {
  const rng = makeRng(`${seed}:ia-poder:${turno}`)
  const libres = TIPOS_PODER.filter((t) => disp[t])
  if (!libres.length) return undefined
  const restantes = TURNOS - turno + 1
  const base = { bronce: 0.3, plata: 0.4, oro: 0.5, leyenda: 0.55 }[nivel]
  const prob = libres.length >= restantes ? 1 : turno >= 8 ? Math.max(base, 0.8) : base
  if (rng() > prob) return undefined
  const mejor = (ids: string[], f: (id: string) => number) => [...ids].sort((a, b) => f(b) - f(a))[0]
  const tipo = libres[Math.floor(rng() * libres.length)]
  const alAzar = nivel === 'bronce'
  if (tipo === 'impulso') return { tipo, objetivo: alAzar ? trioSu[Math.floor(rng() * 3)] : mejor(trioSu, puntajeSu) }
  return { tipo, objetivo: alAzar ? trioMio[Math.floor(rng() * 3)] : mejor(trioMio, puntajeMio) }
}
