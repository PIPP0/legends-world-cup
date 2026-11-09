import { TEAMS, TEAM_BY_ID, PLAYER_BY_ID, GROUPS, teamsOfGroup } from '../data'
import { makeRng, normal, pickWeighted, poisson, type Rng } from './rng'
import { qualifiers, r16Pairs, groupTable } from './standings'
import { PRIME_BOOST, adjustments, contextFor, weatherFactor, type Env } from './world'
import type { AltTournament, Bracket, Goal, KoMatch, Match, ModelParams, Player, Team, TeamProfile, Weights, WorldConfig } from '../types'

export const DEFAULT_PARAMS: ModelParams = {
  weights: { quality: 0.3, balance: 0.25, attack: 0.2, defense: 0.15, experience: 0.1 },
  // Calibrado con los 48 resultados oficiales de grupos (máxima verosimilitud + error de Brier): ver scripts/calibrar.ts
  goalBase: 1.25,
  sensitivity: 0.07,
  matchup: 0.5,
  variance: 0.06,
}

const FORMATION_RISK: Record<string, number> = { '4-3-3': 0, '4-2-3-1': 0, '4-4-2': 1, '4-3-1-2': 1.5, '4-2-4': 5 }
const ATT_W: Record<string, number> = { DC: 1.5, EXT: 1.2, MCO: 1.2, MC: 0.7, MI: 0.7, MD: 0.7, MCD: 0.3, LD: 0.3, LI: 0.3, DFC: 0.05, PO: 0 }
const DEF_W: Record<string, number> = { PO: 2, DFC: 1.3, LD: 1, LI: 1, MCD: 1, MC: 0.6, MI: 0.5, MD: 0.5, MCO: 0.15, EXT: 0.1, DC: 0.05 }

const wavg = (xs: number[], ws: number[]) => xs.reduce((a, x, i) => a + x * ws[i], 0) / ws.reduce((a, b) => a + b, 0)
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length
const stdev = (xs: number[]) => { const m = mean(xs); return Math.sqrt(mean(xs.map((x) => (x - m) ** 2))) }

// Componentes del modelo (documentados, no reglas por país):
//  calidad      = promedio de valoraciones del once
//  equilibrio   = 90 − 0,8·desvío del once − riesgo de la formación (+2 si hay pivote defensivo)
//  ataque       = promedio ponderado por rol ofensivo
//  defensa      = promedio ponderado por rol defensivo (portero ×2)
//  experiencia  = proxy: promedio de los cinco mejores del once
export function baseProfile(team: Team, primes: string[] = []): Omit<TeamProfile, 'strength'> {
  const boost = (p: Player) => (primes.includes(p.id) ? PRIME_BOOST : 0)
  const o = team.xi.map((p) => p.ovr + boost(p))
  const hasDM = team.xi.some((p) => p.pos === 'MCD')
  const by = (line: string) => team.xi.filter((p) => p.line === line).map((p) => p.ovr + boost(p))
  return {
    teamId: team.id,
    quality: mean(o),
    balance: 90 - 0.8 * stdev(o) - (FORMATION_RISK[team.formation] ?? 1) + (hasDM ? 2 : 0),
    attack: wavg(o, team.xi.map((p) => ATT_W[p.pos])),
    defense: wavg(o, team.xi.map((p) => DEF_W[p.pos])),
    experience: mean([...o].sort((a, b) => b - a).slice(0, 5)),
    gk: o[0],
    lines: { gk: by('GK')[0], def: mean(by('DEF')), mid: mean(by('MID')), att: mean(by('ATT')) },
  }
}

export function strengthOf(p: Omit<TeamProfile, 'strength'>, w: Weights): number {
  const total = w.quality + w.balance + w.attack + w.defense + w.experience || 1
  return (w.quality * p.quality + w.balance * p.balance + w.attack * p.attack + w.defense * p.defense + w.experience * p.experience) / total
}

const profileCache = new Map<string, Omit<TeamProfile, 'strength'>>()
export function profile(teamId: string, params: ModelParams = DEFAULT_PARAMS, env?: Env): TeamProfile {
  const primes = (env?.world?.primes ?? []).filter((id) => PLAYER_BY_ID[id]?.teamId === teamId)
  if (primes.length) { const pb = baseProfile(TEAM_BY_ID[teamId], primes); return { ...pb, strength: strengthOf(pb, params.weights) } }
  let b = profileCache.get(teamId)
  if (!b) { b = baseProfile(TEAM_BY_ID[teamId]); profileCache.set(teamId, b) }
  return { ...b, strength: strengthOf(b, params.weights) }
}

export function lambdas(a: string, b: string, params: ModelParams, env?: Env): [number, number] {
  const A = profile(a, params, env), B = profile(b, params, env)
  const ex = (x: TeamProfile, y: TeamProfile) =>
    params.sensitivity * (params.matchup * (x.attack - y.defense) + (1 - params.matchup) * (x.strength - y.strength))
  const cl = (v: number) => Math.min(4.5, Math.max(0.15, v))
  const adjA = adjustments(a, env).total, adjB = adjustments(b, env).total
  const wf = weatherFactor(env?.ctx).goals
  // el lugar favorece al equipo cómodo y perjudica al incómodo (la mitad del efecto del rival se traslada al otro)
  return [cl(params.goalBase * wf * Math.exp(ex(A, B) + adjA - 0.5 * adjB)), cl(params.goalBase * wf * Math.exp(ex(B, A) + adjB - 0.5 * adjA))]
}

// Estado del partido: el que va ganando por 2 o más baja el ritmo y el que pierde arriesga un poco más.
export const stateFactor = (lead: number): number => (lead >= 3 ? 0.4 : lead >= 2 ? 0.7 : lead <= -2 ? 1.1 : 1)

export const pois = (k: number, l: number) => { let f = 1; for (let i = 2; i <= k; i++) f *= i; return Math.exp(-l) * l ** k / f }

// Distribución exacta de marcadores en 90 minutos con el mismo modelo por tramos que usa la simulación.
export function scoreMatrix(la: number, lb: number, max = 10): number[][] {
  let M = Array.from({ length: max + 1 }, () => new Array<number>(max + 1).fill(0))
  M[0][0] = 1
  for (let c = 0; c < 6; c++) {
    const N = Array.from({ length: max + 1 }, () => new Array<number>(max + 1).fill(0))
    for (let i = 0; i <= max; i++) for (let j = 0; j <= max; j++) {
      const m = M[i][j]
      if (m < 1e-12) continue
      const ra = (la / 6) * stateFactor(i - j), rb = (lb / 6) * stateFactor(j - i)
      for (let x = 0; i + x <= max; x++) {
        const px = pois(x, ra)
        if (px < 1e-12) break
        for (let y = 0; j + y <= max; y++) { const py = pois(y, rb); if (py < 1e-12) break; N[i + x][j + y] += m * px * py }
      }
    }
    M = N
  }
  const t = M.flat().reduce((u, v) => u + v, 0)
  return M.map((r) => r.map((v) => v / t))
}

export function probabilities(a: string, b: string, params: ModelParams, env?: Env) {
  const [la, lb] = lambdas(a, b, params, env)
  const M = scoreMatrix(la, lb)
  let win = 0, draw = 0, loss = 0, expA = 0, expB = 0
  M.forEach((row, i) => row.forEach((p, j) => { expA += i * p; expB += j * p; if (i > j) win += p; else if (i === j) draw += p; else loss += p }))
  return { win, draw, loss, expA, expB }
}

// Marcador más probable (moda de la distribución conjunta de Poisson) y matriz de marcadores.
export function modalScore(a: string, b: string, params: ModelParams, env?: Env) {
  const [la, lb] = lambdas(a, b, params, env)
  const M = scoreMatrix(la, lb)
  let best = { ga: 0, gb: 0, p: -1 }
  M.forEach((row, i) => row.forEach((p, j) => { if (p > best.p) best = { ga: i, gb: j, p } }))
  return best
}

function assignGoals(team: Team, n: number, rng: Rng, minuteMax: number, minuteMin: number, phase: 'reg' | 'et'): Goal[] {
  const out: Goal[] = []
  const subs = team.bench.filter((p) => p.line !== 'GK')
  for (let i = 0; i < n; i++) {
    const minute = minuteMin + Math.floor(rng() * (minuteMax - minuteMin + 1))
    // desde el minuto 60 también pueden anotar y asistir los suplentes que ya entraron (peso reducido)
    const late = minute >= 60
    const pool = late ? [...team.xi, ...subs] : team.xi
    const sw = (p: Player, k: 'scorer' | 'creator') => p.weight[k] * (p.starter ? 1 : 0.35) + 0.001
    const scorer = pickWeighted(pool, pool.map((p) => sw(p, 'scorer')), rng)
    let assistId: string | undefined
    if (rng() < 0.7) {
      const ap = pool.filter((p) => p.id !== scorer.id)
      assistId = pickWeighted(ap, ap.map((p) => sw(p, 'creator')), rng).id
    }
    out.push({ minute, teamId: team.id, scorerId: scorer.id, assistId, phase })
  }
  return out
}

export interface SimOutcome { ga: number; gb: number; goals: Goal[]; et: boolean; pens?: [number, number]; winner?: string }

export function simulateMatch(a: string, b: string, rng: Rng, params: ModelParams, knockout: boolean, env?: Env): SimOutcome {
  const [la0, lb0] = lambdas(a, b, params, env)
  const vr = params.variance * weatherFactor(env?.ctx).variance // con lluvia hay más imprevistos
  const shock = normal(rng) * vr // día inspirado/gris del partido
  const ma = la0 * Math.exp(shock), mb = lb0 * Math.exp(-shock * 0.5 + normal(rng) * vr)
  // Los goles se sortean por tramos de 15 minutos con «estado del partido»: el que va ganando por 2 o más baja el ritmo
  // y el que pierde arriesga un poco más. Así las goleadas extremas (6-2) son tan raras como en el fútbol real.
  const goals: Goal[] = []
  let ga = 0, gb = 0
  for (let c = 0; c < 6; c++) {
    const lead = ga - gb
    const fa = stateFactor(lead), fb = stateFactor(-lead)
    const na = poisson((ma / 6) * fa, rng), nb = poisson((mb / 6) * fb, rng)
    ga += na; gb += nb
    goals.push(...assignGoals(TEAM_BY_ID[a], na, rng, (c + 1) * 15, c * 15 + 1, 'reg'), ...assignGoals(TEAM_BY_ID[b], nb, rng, (c + 1) * 15, c * 15 + 1, 'reg'))
  }
  let A = ga, B = gb
  let et = false
  let pens: [number, number] | undefined
  let winner: string | undefined = A > B ? a : B > A ? b : undefined
  if (knockout && A === B) {
    et = true
    const ea = poisson(la0 * 0.33, rng), eb = poisson(lb0 * 0.33, rng)
    A += ea; B += eb
    goals.push(...assignGoals(TEAM_BY_ID[a], ea, rng, 120, 91, 'et'), ...assignGoals(TEAM_BY_ID[b], eb, rng, 120, 91, 'et'))
    if (A !== B) winner = A > B ? a : b
    else {
      const pa = Math.min(0.82, Math.max(0.68, 0.75 + (profile(a, params, env).gk - profile(b, params, env).gk) * 0.002))
      const pb = Math.min(0.82, Math.max(0.68, 0.75 + (profile(b, params, env).gk - profile(a, params, env).gk) * 0.002))
      let x = 0, y = 0
      for (let i = 0; i < 5; i++) { if (rng() < pa) x++; if (rng() < pb) y++ }
      while (x === y) { if (rng() < pa) x++; if (rng() < pb) y++ }
      pens = [x, y]
      winner = x > y ? a : b
    }
  }
  goals.sort((p, q) => p.minute - q.minute)
  return { ga: A, gb: B, goals, et, pens, winner }
}

// Sorteo de grupos con 4 bombos por fuerza (como un mundial real): un equipo de cada bombo por grupo.
// Si el país anfitrión juega el torneo, siempre es cabeza de serie del Grupo A (primero de ese grupo y local en el partido inaugural).
export function drawGroups(seed: string, params: ModelParams = DEFAULT_PARAMS, hostTeamId?: string): Record<string, string[]> {
  const rng = makeRng(seed + ':sorteo')
  const host = hostTeamId && TEAM_BY_ID[hostTeamId] ? hostTeamId : undefined
  const ranked = strengthRank(params).map((p) => p.teamId).filter((id) => id !== host)
  const out: Record<string, string[]> = Object.fromEntries(GROUPS.map((g) => [g, [] as string[]]))
  const shuffle = (xs: string[]) => { for (let i = xs.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [xs[i], xs[j]] = [xs[j], xs[i]] } return xs }
  // bombo 1: el anfitrión (si hay) ocupa el Grupo A y los siete mejores restantes los otros grupos
  const pot1 = host ? [host, ...shuffle(ranked.slice(0, 7))] : shuffle(ranked.slice(0, 8))
  GROUPS.forEach((g, i) => out[g].push(pot1[i]))
  const rest = host ? ranked.slice(7) : ranked.slice(8)
  for (let pot = 0; pot < 3; pot++) {
    const teams = shuffle(rest.slice(pot * 8, pot * 8 + 8))
    GROUPS.forEach((g, i) => out[g].push(teams[i]))
  }
  return out
}

export function simulateGroups(seed: string, params: ModelParams, world?: WorldConfig, groups?: Record<string, string[]>): Match[] {
  const rng = makeRng(seed + ':grupos')
  const out: Match[] = []
  for (const g of GROUPS) {
    const [t1, t2, t3, t4] = groups ? groups[g] : teamsOfGroup(g)
    // mismo calendario que la historia original: (1v2, 3v4) (1v3, 2v4) (1v4, 2v3)
    const fx: [string, string][] = [[t1, t2], [t3, t4], [t1, t3], [t2, t4], [t1, t4], [t2, t3]]
    fx.forEach(([h, a], i) => {
      const id = `${g}${i + 1}`
      const ctx = world ? contextFor(world, seed, id) : undefined
      const r = simulateMatch(h, a, rng, params, false, ctx ? { ctx, world } : undefined)
      out.push({ id, group: g, matchday: (Math.floor(i / 2) + 1) as 1 | 2 | 3, home: h, away: a, hg: r.ga, ag: r.gb, goals: r.goals, ctx })
    })
  }
  return out
}

const emptyKo = (id: string, round: KoMatch['round'], a?: string, b?: string): KoMatch => ({ id, round, a, b })

export function emptyBracket(pairs: [string, string][]): Bracket {
  return {
    r16: pairs.map(([a, b], i) => emptyKo(`O${i + 1}`, 'r16', a, b)),
    qf: [0, 1, 2, 3].map((i) => emptyKo(`C${i + 1}`, 'qf')),
    sf: [0, 1].map((i) => emptyKo(`S${i + 1}`, 'sf')),
    third: emptyKo('T', 'third'),
    final: emptyKo('F', 'final'),
  }
}

function play(m: KoMatch, rng: Rng, params: ModelParams, seed: string, world?: WorldConfig): KoMatch {
  const ctx = world ? contextFor(world, seed, m.id) : undefined
  const r = simulateMatch(m.a!, m.b!, rng, params, true, ctx ? { ctx, world } : undefined)
  return { ...m, ga: r.ga, gb: r.gb, et: r.et, pens: r.pens, winner: r.winner, goals: r.goals, ctx }
}

export type Phase = 'r16' | 'qf' | 'sf' | 'final' | 'done'
export function nextPhase(br: Bracket): Phase {
  if (br.r16.some((m) => !m.winner)) return 'r16'
  if (br.qf.some((m) => !m.winner)) return 'qf'
  if (br.sf.some((m) => !m.winner)) return 'sf'
  if (!br.final.winner || !br.third.winner) return 'final'
  return 'done'
}

export function advance(br: Bracket, seed: string, params: ModelParams, world?: WorldConfig): Bracket {
  const ph = nextPhase(br)
  const rng = makeRng(`${seed}:${ph}`)
  const next: Bracket = JSON.parse(JSON.stringify(br))
  const loser = (m: KoMatch) => (m.winner === m.a ? m.b : m.a)
  if (ph === 'r16') {
    next.r16 = br.r16.map((m) => play(m, rng, params, seed, world))
    next.qf = next.qf.map((m, i) => ({ ...m, a: next.r16[2 * i].winner, b: next.r16[2 * i + 1].winner }))
  } else if (ph === 'qf') {
    next.qf = br.qf.map((m) => play(m, rng, params, seed, world))
    next.sf = next.sf.map((m, i) => ({ ...m, a: next.qf[2 * i].winner, b: next.qf[2 * i + 1].winner }))
  } else if (ph === 'sf') {
    next.sf = br.sf.map((m) => play(m, rng, params, seed, world))
    next.third = { ...next.third, a: loser(next.sf[0]), b: loser(next.sf[1]) }
    next.final = { ...next.final, a: next.sf[0].winner, b: next.sf[1].winner }
  } else if (ph === 'final') {
    next.third = play(next.third, rng, params, seed, world)
    next.final = play(next.final, rng, params, seed, world)
    next.champion = next.final.winner
  }
  return next
}

export function newAlt(seed: string, mode: 'octavos' | 'completo', storyMatches: Match[], params: ModelParams, world?: WorldConfig, groups?: Record<string, string[]>): AltTournament {
  const groupMatches = mode === 'completo' ? simulateGroups(seed, params, world, groups) : storyMatches
  return { seed, mode, groupMatches, bracket: emptyBracket(r16Pairs(qualifiers(groupMatches, groups))), world, groups }
}

export function runAll(t: AltTournament, params: ModelParams): AltTournament {
  let br = t.bracket
  while (nextPhase(br) !== 'done') br = advance(br, t.seed, params, t.world)
  return { ...t, bracket: br }
}

// Estimación Monte Carlo del campeón desde el cuadro de octavos oficial.
export function championOdds(pairs: [string, string][], params: ModelParams, runs: number, seed: string): Record<string, number> {
  const counts: Record<string, number> = {}
  for (let i = 0; i < runs; i++) {
    let t: AltTournament = { seed: `${seed}#${i}`, mode: 'octavos', groupMatches: [], bracket: emptyBracket(pairs) }
    t = runAll(t, params)
    const c = t.bracket.champion!
    counts[c] = (counts[c] ?? 0) + 1
  }
  return Object.fromEntries(Object.entries(counts).map(([k, v]) => [k, v / runs]))
}

export function strengthRank(params: ModelParams) {
  return TEAMS.map((t) => profile(t.id, params)).sort((a, b) => b.strength - a.strength)
}

export function playerOf(id: string): Player { return PLAYER_BY_ID[id] }
export { groupTable }
