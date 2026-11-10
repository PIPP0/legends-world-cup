import { tr } from '../i18n'
import { HOST_BY_ID, HOST_OF_VENUE, TEAM_HOME, VENUE_BY_ID, monthTemp, seasonOfMonth, venueTemp } from '../data/world'
import { TEAM_BY_ID } from '../data'
import { hashString, makeRng, normal } from './rng'
import type { AltTournament, MatchCtx, WorldConfig } from '../types'

export interface Env { ctx?: MatchCtx; world?: WorldConfig }
export interface Adj { total: number; parts: { label: string; v: number }[] }

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x))

// Efecto (en log de goles esperados) del lugar y el clima sobre un equipo. Supuestos del modelo, no datos oficiales.
export function adjustments(teamId: string, env?: Env): Adj {
  const parts: Adj['parts'] = []
  const ctx = env?.ctx
  if (!ctx) return { total: 0, parts }
  const vn = VENUE_BY_ID[ctx.venueId]
  const host = HOST_OF_VENUE[ctx.venueId]
  const home = TEAM_HOME[teamId]
  if (host?.teamId === teamId) parts.push({ label: tr('Juega en casa (público local)'), v: 0.12 })
  if (home && vn && !ctx.roof) {
    const dT = Math.abs(ctx.temp - home.t)
    if (dT > 5) parts.push({ label: tr('Clima distinto al habitual ({a} °C vs {b} °C)', { a: Math.round(ctx.temp), b: home.t }), v: -0.004 * (dT - 5) })
    const dH = Math.abs(vn.hum - home.h)
    if (dH > 0.2) parts.push({ label: tr('Humedad distinta a la habitual'), v: -0.1 * (dH - 0.2) })
    const dA = vn.alt - home.alt - 500
    if (dA > 0) parts.push({ label: tr('Altitud ({a} m) mayor a la que está acostumbrado', { a: vn.alt }), v: -0.00006 * dA })
  }
  const h = env?.world?.history[`${teamId}|${ctx.venueId}`]
  if (h && h.n > 0) {
    const v = clamp(0.03 * (h.gd / h.n) * (h.n / (h.n + 4)), -0.06, 0.06)
    if (Math.abs(v) >= 0.004) parts.push({ label: tr('Historial en este estadio ({n} {p}, dif. {d})', { n: h.n, p: h.n > 1 ? tr('partidos') : tr('partido'), d: `${h.gd > 0 ? '+' : ''}${h.gd}` }), v })
  }
  return { total: parts.reduce((a, p) => a + p.v, 0), parts }
}

// Efecto del clima sobre los goles de ambos equipos (lluvia y calor bajan el ritmo) e incertidumbre extra.
export function weatherFactor(ctx?: MatchCtx): { goals: number; variance: number } {
  if (!ctx || ctx.roof) return { goals: 1, variance: 1 }
  return { goals: (1 - 0.06 * ctx.rain) * (ctx.temp > 30 ? 1 - 0.012 * (ctx.temp - 30) : 1), variance: 1 + 0.6 * ctx.rain }
}

// Estadio y clima de un partido: determinista según semilla + partido (la final va a la sede elegida).
export function contextFor(world: WorldConfig, seed: string, matchId: string): MatchCtx {
  const host = HOST_BY_ID[world.hostId]
  const rng = makeRng(`${seed}:${matchId}:ctx`)
  const vn = matchId === 'F' ? VENUE_BY_ID[world.finalVenue] : host.venues[hashString(`${seed}:${matchId}`) % host.venues.length]
  if (vn.roof) return { venueId: vn.id, temp: 24, rain: 0, roof: true }
  const season = world.month ? seasonOfMonth(world.month, host.south) : world.season
  const base = world.month ? monthTemp(vn, world.month, host.south) : venueTemp(vn, season)
  const cl = world.climate ?? 'normal'
  const temp = base + normal(rng) * 2.5 + (cl === 'calor' ? 6 : cl === 'frio' ? -6 : 0)
  const rainP = vn.rain * (season === 'verano' ? 0.8 : season === 'invierno' ? 1.2 : 1) * (cl === 'lluvia' ? 2 : 1)
  const rain = rng() < rainP ? 0.3 + rng() * 0.7 : 0
  return { venueId: vn.id, temp: Math.round(temp * 10) / 10, rain: Math.round(rain * 100) / 100 }
}

// ---- historial por estadio (se acumula en este navegador con los mundiales personalizados terminados) ----
const KEY = 'lwc:venue-history:v1'
export type History = Record<string, { n: number; gd: number }>
export function loadHistory(): History {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '{}') as History } catch { return {} }
}
export function recordHistory(t: AltTournament): void {
  if (!t.world || !t.bracket.champion) return
  const h = loadHistory()
  const add = (team: string, venue: string | undefined, gf: number, ga: number) => {
    if (!venue) return
    const k = `${team}|${venue}`
    h[k] = { n: (h[k]?.n ?? 0) + 1, gd: (h[k]?.gd ?? 0) + gf - ga }
  }
  const ko = [...t.bracket.r16, ...t.bracket.qf, ...t.bracket.sf, t.bracket.third, t.bracket.final]
  for (const m of ko) if (m.a && m.b && m.ga !== undefined && m.gb !== undefined) { add(m.a, m.ctx?.venueId, m.ga, m.gb); add(m.b, m.ctx?.venueId, m.gb, m.ga) }
  if (t.mode === 'completo') for (const m of t.groupMatches) { add(m.home, m.ctx?.venueId, m.hg, m.ag); add(m.away, m.ctx?.venueId, m.ag, m.hg) }
  try { localStorage.setItem(KEY, JSON.stringify(h)) } catch { /* sin almacenamiento */ }
}
export const teamName = (id: string) => TEAM_BY_ID[id].name

export const PRIME_BOOST = 4
export const MAX_PRIMES = 3
// Valoración efectiva de un jugador en este mundial (los elegidos «en su prime» rinden a su mejor nivel).
export const boostOf = (playerId: string, world?: WorldConfig) => (world?.primes?.includes(playerId) ? PRIME_BOOST : 0)
