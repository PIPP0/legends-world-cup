import { TEAMS, TEAM_BY_ID, PLAYER_BY_ID, GROUPS, teamsOfGroup } from '../data'
import { makeRng, normal, pickWeighted, poisson, type Rng } from './rng'
import { qualifiers, r16Pairs, groupTable } from './standings'
import type { AltTournament, Bracket, Goal, KoMatch, Match, ModelParams, Player, Team, TeamProfile, Weights } from '../types'

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
export function baseProfile(team: Team): Omit<TeamProfile, 'strength'> {
  const o = team.xi.map((p) => p.ovr)
  const hasDM = team.xi.some((p) => p.pos === 'MCD')
  const by = (line: string) => team.xi.filter((p) => p.line === line).map((p) => p.ovr)
  return {
    teamId: team.id,
    quality: mean(o),
    balance: 90 - 0.8 * stdev(o) - (FORMATION_RISK[team.formation] ?? 1) + (hasDM ? 2 : 0),
    attack: wavg(o, team.xi.map((p) => ATT_W[p.pos])),
    defense: wavg(o, team.xi.map((p) => DEF_W[p.pos])),
    experience: mean([...o].sort((a, b) => b - a).slice(0, 5)),
    gk: team.xi[0].ovr,
    lines: { gk: by('GK')[0], def: mean(by('DEF')), mid: mean(by('MID')), att: mean(by('ATT')) },
  }
}

export function strengthOf(p: Omit<TeamProfile, 'strength'>, w: Weights): number {
  const total = w.quality + w.balance + w.attack + w.defense + w.experience || 1
  return (w.quality * p.quality + w.balance * p.balance + w.attack * p.attack + w.defense * p.defense + w.experience * p.experience) / total
}

const profileCache = new Map<string, Omit<TeamProfile, 'strength'>>()
export function profile(teamId: string, params: ModelParams = DEFAULT_PARAMS): TeamProfile {
  let b = profileCache.get(teamId)
  if (!b) { b = baseProfile(TEAM_BY_ID[teamId]); profileCache.set(teamId, b) }
  return { ...b, strength: strengthOf(b, params.weights) }
}

export function lambdas(a: string, b: string, params: ModelParams): [number, number] {
  const A = profile(a, params), B = profile(b, params)
  const ex = (x: TeamProfile, y: TeamProfile) =>
    params.sensitivity * (params.matchup * (x.attack - y.defense) + (1 - params.matchup) * (x.strength - y.strength))
  const cl = (v: number) => Math.min(4.5, Math.max(0.15, v))
  return [cl(params.goalBase * Math.exp(ex(A, B))), cl(params.goalBase * Math.exp(ex(B, A)))]
}

export const pois = (k: number, l: number) => { let f = 1; for (let i = 2; i <= k; i++) f *= i; return Math.exp(-l) * l ** k / f }

export function probabilities(a: string, b: string, params: ModelParams) {
  const [la, lb] = lambdas(a, b, params)
  let win = 0, draw = 0, loss = 0
  for (let i = 0; i <= 10; i++) for (let j = 0; j <= 10; j++) {
    const p = pois(i, la) * pois(j, lb)
    if (i > j) win += p; else if (i === j) draw += p; else loss += p
  }
  const t = win + draw + loss
  return { win: win / t, draw: draw / t, loss: loss / t, expA: la, expB: lb }
}

// Marcador más probable (moda de la distribución conjunta de Poisson) y matriz de marcadores.
export function modalScore(a: string, b: string, params: ModelParams) {
  const [la, lb] = lambdas(a, b, params)
  let best = { ga: 0, gb: 0, p: -1 }
  for (let i = 0; i <= 8; i++) for (let j = 0; j <= 8; j++) {
    const p = pois(i, la) * pois(j, lb)
    if (p > best.p) best = { ga: i, gb: j, p }
  }
  return best
}

function assignGoals(team: Team, n: number, rng: Rng, minuteMax: number, minuteMin: number, phase: 'reg' | 'et'): Goal[] {
  const out: Goal[] = []
  const outfield = team.xi
  for (let i = 0; i < n; i++) {
    const scorer = pickWeighted(outfield, outfield.map((p) => p.weight.scorer + 0.001), rng)
    let assistId: string | undefined
    if (rng() < 0.7) {
      const pool = outfield.filter((p) => p.id !== scorer.id)
      assistId = pickWeighted(pool, pool.map((p) => p.weight.creator + 0.001), rng).id
    }
    out.push({ minute: minuteMin + Math.floor(rng() * (minuteMax - minuteMin + 1)), teamId: team.id, scorerId: scorer.id, assistId, phase })
  }
  return out
}

export interface SimOutcome { ga: number; gb: number; goals: Goal[]; et: boolean; pens?: [number, number]; winner?: string }

export function simulateMatch(a: string, b: string, rng: Rng, params: ModelParams, knockout: boolean): SimOutcome {
  const [la0, lb0] = lambdas(a, b, params)
  const shock = normal(rng) * params.variance // día inspirado/gris del partido
  const ga = poisson(la0 * Math.exp(shock), rng)
  const gb = poisson(lb0 * Math.exp(-shock * 0.5 + normal(rng) * params.variance), rng)
  let A = ga, B = gb
  const goals = [...assignGoals(TEAM_BY_ID[a], ga, rng, 90, 1, 'reg'), ...assignGoals(TEAM_BY_ID[b], gb, rng, 90, 1, 'reg')]
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
      const pa = Math.min(0.82, Math.max(0.68, 0.75 + (profile(a, params).gk - profile(b, params).gk) * 0.002))
      const pb = Math.min(0.82, Math.max(0.68, 0.75 + (profile(b, params).gk - profile(a, params).gk) * 0.002))
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

export function simulateGroups(seed: string, params: ModelParams): Match[] {
  const rng = makeRng(seed + ':grupos')
  const out: Match[] = []
  for (const g of GROUPS) {
    const [t1, t2, t3, t4] = teamsOfGroup(g)
    // mismo calendario que la historia original: (1v2, 3v4) (1v3, 2v4) (1v4, 2v3)
    const fx: [string, string][] = [[t1, t2], [t3, t4], [t1, t3], [t2, t4], [t1, t4], [t2, t3]]
    fx.forEach(([h, a], i) => {
      const r = simulateMatch(h, a, rng, params, false)
      out.push({ id: `${g}${i + 1}`, group: g, matchday: (Math.floor(i / 2) + 1) as 1 | 2 | 3, home: h, away: a, hg: r.ga, ag: r.gb, goals: r.goals })
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

function play(m: KoMatch, rng: Rng, params: ModelParams): KoMatch {
  const r = simulateMatch(m.a!, m.b!, rng, params, true)
  return { ...m, ga: r.ga, gb: r.gb, et: r.et, pens: r.pens, winner: r.winner, goals: r.goals }
}

export type Phase = 'r16' | 'qf' | 'sf' | 'final' | 'done'
export function nextPhase(br: Bracket): Phase {
  if (br.r16.some((m) => !m.winner)) return 'r16'
  if (br.qf.some((m) => !m.winner)) return 'qf'
  if (br.sf.some((m) => !m.winner)) return 'sf'
  if (!br.final.winner || !br.third.winner) return 'final'
  return 'done'
}

export function advance(br: Bracket, seed: string, params: ModelParams): Bracket {
  const ph = nextPhase(br)
  const rng = makeRng(`${seed}:${ph}`)
  const next: Bracket = JSON.parse(JSON.stringify(br))
  const loser = (m: KoMatch) => (m.winner === m.a ? m.b : m.a)
  if (ph === 'r16') {
    next.r16 = br.r16.map((m) => play(m, rng, params))
    next.qf = next.qf.map((m, i) => ({ ...m, a: next.r16[2 * i].winner, b: next.r16[2 * i + 1].winner }))
  } else if (ph === 'qf') {
    next.qf = br.qf.map((m) => play(m, rng, params))
    next.sf = next.sf.map((m, i) => ({ ...m, a: next.qf[2 * i].winner, b: next.qf[2 * i + 1].winner }))
  } else if (ph === 'sf') {
    next.sf = br.sf.map((m) => play(m, rng, params))
    next.third = { ...next.third, a: loser(next.sf[0]), b: loser(next.sf[1]) }
    next.final = { ...next.final, a: next.sf[0].winner, b: next.sf[1].winner }
  } else if (ph === 'final') {
    next.third = play(next.third, rng, params)
    next.final = play(next.final, rng, params)
    next.champion = next.final.winner
  }
  return next
}

export function newAlt(seed: string, mode: 'octavos' | 'completo', storyMatches: Match[], params: ModelParams): AltTournament {
  const groupMatches = mode === 'completo' ? simulateGroups(seed, params) : storyMatches
  return { seed, mode, groupMatches, bracket: emptyBracket(r16Pairs(qualifiers(groupMatches))) }
}

export function runAll(t: AltTournament, params: ModelParams): AltTournament {
  let br = t.bracket
  while (nextPhase(br) !== 'done') br = advance(br, t.seed, params)
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
