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
  contra: { presion: 2, bloque: -2, marca: -1, cierre: 1 },
  bandas: { presion: -1, bloque: 1, marca: 2, cierre: -2 },
  centro: { presion: -2, bloque: -1, marca: 1, cierre: 2 },
  largo: { presion: 1, bloque: 2, marca: -2, cierre: -1 },
}
// Equilibrada: cada fila y cada columna suman 0, así ninguna estrategia es mejor en promedio y gana quien adivina.
export const PUNTOS_POR_NIVEL = 6 // cuánto pesa un nivel de efectividad en la calidad de la jugada

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

// ---------- química del trío y nivel de equipo ----------
// Química: jugadores del mismo país y estilos que se complementan rinden más juntos; tres iguales rinden menos.
export const BONO_PAIS_PAR = 2.5
export const BONO_COMBO = 2
const COMPLEMENTOS: Record<'ataque' | 'defensa', [Estilo, Estilo][]> = {
  ataque: [['pasador', 'goleador'], ['veloz', 'pasador'], ['regateador', 'goleador'], ['veloz', 'goleador']],
  defensa: [['muro', 'veloz'], ['muro', 'fuerte'], ['fuerte', 'veloz']],
}
export interface RazonQuimica { tipo: 'pais' | 'combo' | 'variedad' | 'igual'; pts: number; n?: number }
export function quimicaTrio(trio: string[], ataca: boolean): { total: number; razones: RazonQuimica[] } {
  const razones: RazonQuimica[] = []
  const paises: Record<string, number> = {}
  trio.forEach((id) => { const t = PLAYER_BY_ID[id].teamId; paises[t] = (paises[t] ?? 0) + 1 })
  for (const n of Object.values(paises)) if (n >= 2) razones.push({ tipo: 'pais', pts: BONO_PAIS_PAR * (n * (n - 1)) / 2, n })
  const estilos = trio.map((id) => estiloJugador(PLAYER_BY_ID[id]))
  const comp = COMPLEMENTOS[ataca ? 'ataque' : 'defensa']
  const hechos = new Set<string>()
  for (let i = 0; i < estilos.length; i++) for (let j = i + 1; j < estilos.length; j++) {
    const par = comp.find(([a, b]) => (estilos[i] === a && estilos[j] === b) || (estilos[i] === b && estilos[j] === a))
    if (par && !hechos.has(par.join())) { hechos.add(par.join()); razones.push({ tipo: 'combo', pts: BONO_COMBO }) }
  }
  const distintos = new Set(estilos).size
  if (distintos === 3) razones.push({ tipo: 'variedad', pts: 1.5 })
  else if (distintos === 1) razones.push({ tipo: 'igual', pts: -2 })
  const total = Math.max(-2, Math.min(6, razones.reduce((x, y) => x + y.pts, 0)))
  return { total, razones }
}
// Nivel de equipo: crece con las victorias, de a poco (rendimientos decrecientes) y con tope.
export const nivelEquipo = (ganados: number): number => 1 + Math.floor(Math.sqrt(Math.max(0, ganados)))
export const bonoNivelEquipo = (ganados: number): number => Math.min(3, Math.round(0.9 * Math.sqrt(Math.max(0, ganados)) * 10) / 10)
export const victoriasParaSubir = (ganados: number): number => nivelEquipo(ganados) ** 2 - ganados
// La máquina tiene su propio «nivel» según la dificultad.
export const bonoNivelMaquina = (nivel: Nivel): number => ({ bronce: 0, plata: 0.8, oro: 1.6, leyenda: 2.4 }[nivel])

// ---------- la barra ----------
// El balón cruza la barra más lento cuanto mejor encaja el jugador con la jugada (más fácil detenerlo en el centro).
export function segundosBarra(encaje: number): number {
  const t = Math.min(1, Math.max(0, (105 - encaje) / 45))
  return 1.7 - 1.1 * t // 1,7 s (encaje 105+) … 0,6 s (encaje 60-)
}
// Posición 0..1 del balón: va y viene; 0,5 es el centro ideal.
export const precision = (x: number): number => {
  const d = Math.abs(x - 0.5)
  return d <= 0.06 ? 1 : Math.max(0, 1 - (d - 0.06) / 0.44)
}

// ---------- resolver una jugada ----------
export const TURNOS = 5 // al mejor de 5 turnos, alternados (los impares ataca la persona)
export const SESGO_ATAQUE = 8 // empuje a favor de quien ataca: meter goles no debe ser tan difícil
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
  quimA: number; quimD: number; nivelA: number; nivelD: number
  t1: number; t2?: number
  resultado: 'gol' | 'atajada' | 'corte'
  arquero: string
}
const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x))
const sig = (x: number) => 1 / (1 + Math.exp(-x))
export const ESCALA_CALIDAD = 5.5
export const PESO_BARRA_ATAQUE = 0.5 // cuánto de la efectividad del remate depende de tu toque
export const PESO_BARRA_DEFENSA = 0.2 // cuánto puede frenar tu defensa un buen toque

export function resolverJugada(a: {
  seed: string; turno: number; ataca: 'mio' | 'su'
  ataque: Ataque; defensa: Defensa
  trioA: string[]; trioD: string[]; ajA: Aj; ajD: Aj
  ejecutor: string; interceptor?: string
  precA: number; precD: number
  arquero: string; clima: number
  quimA?: number; quimD?: number; nivelA?: number; nivelD?: number
}): DetalleJugada {
  const rng = makeRng(`${a.seed}:jugada:${a.turno}`)
  const nivel = MATRIZ[a.ataque][a.defensa]
  const quimA = a.quimA ?? 0, quimD = a.quimD ?? 0, nivelA = a.nivelA ?? 0, nivelD = a.nivelD ?? 0
  const calidadA = a.trioA.reduce((s, id) => s + encajeAtaque(id, a.ataque, a.ajA), 0) / a.trioA.length + quimA + nivelA
  const calidadD = a.trioD.reduce((s, id) => s + encajeDefensa(id, a.defensa, a.ajD), 0) / a.trioD.length + quimD + nivelD
  const base = sig((calidadA - calidadD + PUNTOS_POR_NIVEL * nivel + SESGO_ATAQUE) / ESCALA_CALIDAD)
  const pPaso = clamp(base * (1 - PESO_BARRA_DEFENSA * a.precD), 0.03, 0.97)
  const rem = attr(PLAYER_BY_ID[a.ejecutor], 'Disparo') + (a.ajA[a.ejecutor] ?? 0)
  const arq = poderArquero(PLAYER_BY_ID[a.arquero])
  const kF = clamp(0.9 + (rem - arq) / 150, 0.75, 1.15)
  const pRemate = clamp((1 - PESO_BARRA_ATAQUE + PESO_BARRA_ATAQUE * a.precA) * kF * a.clima * 1.2, 0.03, 0.97)
  const t1 = rng()
  const base2 = { ataca: a.ataca, est: { ataque: a.ataque, defensa: a.defensa }, nivel, trioA: a.trioA, trioD: a.trioD, ejecutor: a.ejecutor, interceptor: a.interceptor, calidadA, calidadD, precA: a.precA, precD: a.precD, pPaso, pRemate, pGol: pPaso * pRemate, rem, arq, clima: a.clima, quimA, quimD, nivelA, nivelD, t1, arquero: a.arquero }
  if (t1 >= pPaso) return { ...base2, resultado: 'corte' }
  const t2 = rng()
  return { ...base2, t2, resultado: t2 < pRemate ? 'gol' : 'atajada' }
}

// ---------- disponibilidad ----------
// Se puede elegir a cualquiera del once menos el arquero, sin los que jugaron el turno anterior; los suplentes entran desde el turno 3.
export function disponibles(equipo: Equipo, turno: number, cansados: string[], excluir: string[] = []): string[] {
  return [...equipo.once, ...(turno >= 3 ? equipo.suplentes : [])].filter((id) => !cansados.includes(id) && !excluir.includes(id) && PLAYER_BY_ID[id].line !== 'GK')
}

// ---------- la máquina ----------
const barajarSemilla = <T,>(xs: T[], rng: Rng): T[] => { const a = [...xs]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] } return a }
const ruido = (nivel: Nivel) => NIVELES.find((n) => n.id === nivel)!.ruido
const mejoresTres = (ids: string[], f: (id: string) => number, rng: Rng, nivel: Nivel): string[] =>
  ids.map((id) => ({ id, v: f(id) + (rng() - 0.5) * 2 * ruido(nivel) })).sort((x, y) => y.v - x.v).slice(0, 3).map((x) => x.id)

// ataca = 'mio' si esa jugada la atacó quien decide (la máquina) y 'su' si atacó la persona.
export interface HistorialJugada { ataca: 'mio' | 'su'; ataque: Ataque; defensa: Defensa }
const masFrecuente = <T extends string>(xs: T[]): T | undefined => { const m: Record<string, number> = {}; xs.forEach((x) => { m[x] = (m[x] ?? 0) + 1 }); return (Object.entries(m).sort((a, b) => b[1] - a[1])[0]?.[0]) as T | undefined }

// Elige la estrategia con variedad: pesa algo la calidad del equipo (z-score), mucho el azar, castiga repetir la última y, en niveles altos,
// «lee» lo que la persona suele hacer. Así no usa siempre la misma estrategia ni anula siempre la tuya.
const AZAR_NIVEL: Record<Nivel, number> = { bronce: 2.4, plata: 1.7, oro: 1.3, leyenda: 1.0 }
function elige<T extends string>(opciones: T[], q: (e: T) => number, lee: (e: T) => number, ultima: T | undefined, nivel: Nivel, rng: Rng): T {
  const vals = opciones.map(q); const media = vals.reduce((x, y) => x + y, 0) / vals.length
  const sd = Math.sqrt(vals.reduce((x, y) => x + (y - media) ** 2, 0) / vals.length) || 1
  const lectura = nivel === 'leyenda' ? 0.6 : nivel === 'oro' ? 0.4 : 0
  return opciones.map((e, i) => ({ e, v: 0.3 * ((vals[i] - media) / sd) + (rng() - 0.5) * 2 * AZAR_NIVEL[nivel] + lectura * lee(e) + (ultima === e ? -0.9 : 0) })).sort((x, y) => y.v - x.v)[0].e
}

export function eligeAtaqueMaquina(seed: string, turno: number, equipo: Equipo, cansados: string[], nivel: Nivel, hist: HistorialJugada[], aj: Aj = {}): { ataque: Ataque; trio: string[] } {
  const rng = makeRng(`${seed}:ia-ataque:${turno}`)
  const libres = disponibles(equipo, turno, cansados)
  const propios = hist.filter((h) => h.ataca === 'mio'), ultima = propios[propios.length - 1]?.ataque
  const defensaRival = masFrecuente(propios.map((h) => h.defensa)) // con qué defiende la persona cuando la máquina ataca
  const trios = Object.fromEntries(ATAQUES.map((e) => [e, mejoresTres(libres, (id) => encajeAtaque(id, e, aj), rng, nivel)])) as Record<Ataque, string[]>
  const q = (e: Ataque) => trios[e].reduce((x, id) => x + encajeAtaque(id, e, aj), 0) / 3
  const ataque = elige(ATAQUES, q, (e) => (defensaRival ? MATRIZ[e][defensaRival] : 0), ultima, nivel, rng)
  return { ataque, trio: trios[ataque] }
}
export function eligeDefensaMaquina(seed: string, turno: number, equipo: Equipo, cansados: string[], nivel: Nivel, hist: HistorialJugada[], aj: Aj = {}): { defensa: Defensa; trio: string[] } {
  const rng = makeRng(`${seed}:ia-defensa:${turno}`)
  const libres = disponibles(equipo, turno, cansados)
  const rivales = hist.filter((h) => h.ataca === 'su'), ultima = rivales[rivales.length - 1]?.defensa
  const ataqueRival = masFrecuente(rivales.map((h) => h.ataque)) // con qué suele atacar la persona
  const trios = Object.fromEntries(DEFENSAS.map((d) => [d, mejoresTres(libres, (id) => encajeDefensa(id, d, aj), rng, nivel)])) as Record<Defensa, string[]>
  const q = (d: Defensa) => trios[d].reduce((x, id) => x + encajeDefensa(id, d, aj), 0) / 3
  const defensa = elige(DEFENSAS, q, (d) => (ataqueRival ? -MATRIZ[ataqueRival][d] : 0), ultima, nivel, rng)
  return { defensa, trio: trios[defensa] }
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
  const prob = libres.length >= restantes ? 1 : turno >= TURNOS - 1 ? Math.max(base, 0.8) : base
  if (rng() > prob) return undefined
  const mejor = (ids: string[], f: (id: string) => number) => [...ids].sort((a, b) => f(b) - f(a))[0]
  const tipo = libres[Math.floor(rng() * libres.length)]
  const alAzar = nivel === 'bronce'
  if (tipo === 'impulso') return { tipo, objetivo: alAzar ? trioSu[Math.floor(rng() * 3)] : mejor(trioSu, puntajeSu) }
  return { tipo, objetivo: alAzar ? trioMio[Math.floor(rng() * 3)] : mejor(trioMio, puntajeMio) }
}
