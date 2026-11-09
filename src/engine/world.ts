import { HOST_BY_ID, HOST_OF_VENUE, TEAM_HOME, VENUE_BY_ID, venueTemp } from '../data/world'
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
  if (host?.teamId === teamId) parts.push({ label: 'Juega en casa (público local)', v: 0.12 })
  if (home && vn && !ctx.roof) {
    const dT = Math.abs(ctx.temp - home.t)
    if (dT > 5) parts.push({ label: `Clima distinto al habitual (${Math.round(ctx.temp)} °C vs ${home.t} °C)`, v: -0.004 * (dT - 5) })
    const dH = Math.abs(vn.hum - home.h)
    if (dH > 0.2) parts.push({ label: 'Humedad distinta a la habitual', v: -0.1 * (dH - 0.2) })
    const dA = vn.alt - home.alt - 500
    if (dA > 0) parts.push({ label: `Altitud (${vn.alt} m) mayor a la que está acostumbrado`, v: -0.00006 * dA })
  }
  const h = env?.world?.history[`${teamId}|${ctx.venueId}`]
  if (h && h.n > 0) {
    const v = clamp(0.03 * (h.gd / h.n) * (h.n / (h.n + 4)), -0.06, 0.06)
    if (Math.abs(v) >= 0.004) parts.push({ label: `Historial en este estadio (${h.n} partido${h.n > 1 ? 's' : ''}, dif. ${h.gd > 0 ? '+' : ''}${h.gd})`, v })
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
  const temp = venueTemp(vn, world.season) + normal(rng) * 2.5
  const rain = rng() < vn.rain * (world.season === 'verano' ? 0.8 : world.season === 'invierno' ? 1.2 : 1) ? 0.3 + rng() * 0.7 : 0
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
