import { tr } from '../i18n'
import { TEAM_BY_ID, PLAYER_BY_ID } from '../data'
import { modalScore, probabilities, profile, type SimOutcome } from './model'
import { adjustments, type Env } from './world'
import { VENUE_BY_ID, HOST_OF_VENUE } from '../data/world'
import type { ModelParams } from '../types'

export interface Factor { label: string; a: number; b: number; edge: 'a' | 'b' | 'eq'; note: string }
export interface Explanation {
  probs: { win: number; draw: number; loss: number }
  expected: [number, number]
  modal: { ga: number; gb: number; p: number }
  favorite: string
  favP: number
  factors: Factor[]
  reasons: string[]
  verdict: 'esperado' | 'sorpresa' | 'parejo'
  verdictText: string
}

const f1 = (n: number) => n.toFixed(1)
const pct = (n: number) => `${Math.round(n * 100)} %`

// Justificación de un partido a partir de los mismos datos que usa el modelo (valoraciones del once).
export function explain(a: string, b: string, params: ModelParams, res?: SimOutcome, env?: Env): Explanation {
  const A = profile(a, params, env), B = profile(b, params, env)
  const TA = TEAM_BY_ID[a], TB = TEAM_BY_ID[b]
  const pr = probabilities(a, b, params, env)
  const la = pr.expA, lb = pr.expB
  const modal = modalScore(a, b, params, env)
  const favorite = pr.win >= pr.loss ? a : b
  const favP = Math.max(pr.win, pr.loss)

  const mk = (label: string, x: number, y: number, note: string): Factor => ({
    label, a: x, b: y, edge: Math.abs(x - y) < 0.5 ? 'eq' : x > y ? 'a' : 'b', note,
  })
  const factors: Factor[] = [
    mk(tr('Calidad del once'), A.quality, B.quality, tr('promedio de valoraciones de los 11 titulares')),
    mk(tr('Ataque vs defensa rival'), A.attack - B.defense + 90, B.attack - A.defense + 90, tr('ataque propio contra defensa del rival')),
    mk(tr('Portería'), A.gk, B.gk, tr('valoración del arquero')),
    mk(tr('Equilibrio'), A.balance, B.balance, tr('homogeneidad del once y formación')),
    mk(tr('Experiencia'), A.experience, B.experience, tr('promedio de las cinco mayores figuras')),
  ]

  const reasons: string[] = []
  const nameOf = (id: string) => TEAM_BY_ID[id].name
  const top = (id: string) => [...TEAM_BY_ID[id].xi].sort((x, y) => y.ovr - x.ovr)[0]
  const gap = A.strength - B.strength
  const strong = gap >= 0 ? a : b
  const weak = gap >= 0 ? b : a
  if (Math.abs(gap) < 1) reasons.push(tr('Los dos equipos tienen una fuerza casi idéntica ({a} contra {b}): el modelo los ve parejos.', { a: f1(A.strength), b: f1(B.strength) }))
  else reasons.push(tr('{s} tiene más fuerza global: {a} contra {b} de {w}, una diferencia de {d} puntos.', { s: nameOf(strong), a: f1(Math.max(A.strength, B.strength)), b: f1(Math.min(A.strength, B.strength)), w: nameOf(weak), d: f1(Math.abs(gap)) }))
  const best = [...factors].filter((x) => x.edge !== 'eq').sort((x, y) => Math.abs(y.a - y.b) - Math.abs(x.a - x.b))[0]
  if (best) reasons.push(tr('La mayor diferencia está en «{l}»: {t} {a} frente a {b}.', { l: best.label.toLowerCase(), t: nameOf(best.edge === 'a' ? a : b), a: f1(Math.max(best.a, best.b)), b: f1(Math.min(best.a, best.b)) }))
  if (env?.ctx) {
    const vn = VENUE_BY_ID[env.ctx.venueId]
    const c = env.ctx
    reasons.push(tr('Sede: {v} ({c}, {h}), {w}, {a} m de altitud.', { v: vn.name, c: vn.city, h: HOST_OF_VENUE[vn.id].name, w: c.roof ? tr('techado y climatizado') : `${Math.round(c.temp)} °C${c.rain > 0 ? tr(', lluvia {i}', { i: c.rain > 0.66 ? tr('fuerte') : tr('ligera') }) : tr(', sin lluvia')}`, a: vn.alt }))
    for (const id of [a, b]) {
      const ad = adjustments(id, env)
      if (ad.parts.length) reasons.push(tr('{t}: {x}.', { t: nameOf(id), x: ad.parts.map((p) => `${p.label} (${p.v > 0 ? '+' : ''}${(p.v * 100).toFixed(1)} %)`).join('; ') }))
      else reasons.push(tr('{t}: sin ventajas ni desventajas de lugar o clima.', { t: nameOf(id) }))
    }
  }
  const pr3 = (env?.world?.primes ?? []).filter((id) => PLAYER_BY_ID[id] && (PLAYER_BY_ID[id].teamId === a || PLAYER_BY_ID[id].teamId === b))
  if (pr3.length) reasons.push(tr('En su prime (+4 de valoración): {n}.', { n: pr3.map((id) => `${PLAYER_BY_ID[id].name} (${TEAM_BY_ID[PLAYER_BY_ID[id].teamId].name})`).join(', ') }))
  const ta = top(a), tb = top(b)
  reasons.push(tr('Figuras: {a} ({o}) por {t} y {b} ({p}) por {u}.', { a: ta.name, o: ta.ovr, t: TA.name, b: tb.name, p: tb.ovr, u: TB.name }))
  reasons.push(tr('Con eso el modelo espera {a} goles de {t} y {b} de {u}; el marcador más probable es {x}-{y} ({p} de probabilidad por sí solo).', { a: f1(la), t: TA.name, b: f1(lb), u: TB.name, x: modal.ga, y: modal.gb, p: pct(modal.p) }))

  let verdict: Explanation['verdict'] = 'parejo'
  let verdictText = tr('Partido parejo: {a} / {b} / {c}.', { a: pct(pr.win), b: pct(pr.draw), c: pct(pr.loss) })
  if (res) {
    const win = res.winner ?? (res.ga > res.gb ? a : res.gb > res.ga ? b : undefined)
    const gdiff = Math.abs(res.ga - res.gb)
    const pFav = favP
    if (win && win !== favorite && pFav >= 0.5) {
      verdict = 'sorpresa'
      const pw = win === a ? pr.win : pr.loss
      verdictText = tr('Resultado sorpresa: el modelo daba solo {p} de victoria a {w} en 90 minutos (favorito: {f} con {q}). Pasa en torno a 1 de cada {n} partidos como este.', { p: pct(pw), w: nameOf(win), f: nameOf(favorite), q: pct(favP), n: Math.max(2, Math.round(1 / pw)) })
      reasons.push(tr('Cómo se explica: {w} tuvo un día efectivo ({g} goles, sobre {e} esperados) y {f} quedó por debajo de lo esperado ({h} sobre {i}).', { w: nameOf(win), g: win === a ? res.ga : res.gb, e: f1(win === a ? la : lb), f: nameOf(favorite), h: favorite === a ? res.ga : res.gb, i: f1(favorite === a ? la : lb) }))
    } else if (win && win === favorite) {
      verdict = 'esperado'
      verdictText = tr('Resultado coherente con el modelo: ganó el favorito ({f}, {p}).', { f: nameOf(favorite), p: pct(favP) })
      reasons.push(tr('Se impuso {f} por {d} {g}; esperaba {e} y marcó {m}.', { f: nameOf(favorite), d: gdiff, g: gdiff === 1 ? tr('gol') : tr('goles'), e: f1(favorite === a ? la : lb), m: favorite === a ? res.ga : res.gb }))
    } else if (!win) {
      verdictText = tr('Empate: ocurre {p} de las veces en este cruce.', { p: pct(pr.draw) })
    }
    if (res.pens) reasons.push(tr('Se definió por penales ({a}–{b}): con la prórroga igualada pesa la valoración del arquero ({x} contra {y}).', { a: res.pens[0], b: res.pens[1], x: f1(A.gk), y: f1(B.gk) }))
    const sc = res.goals.filter((g) => g.phase !== 'et').reduce<Record<string, number>>((m, g) => { m[g.scorerId] = (m[g.scorerId] ?? 0) + 1; return m }, {})
    const names = Object.entries(sc).map(([id, n]) => `${PLAYER_BY_ID[id].name}${n > 1 ? ` (${n})` : ''}`)
    if (names.length) reasons.push(tr('Goleadores: {n}. Se eligen según su peso goleador (posición y valoración).', { n: names.join(', ') }))
  }
  return { probs: { win: pr.win, draw: pr.draw, loss: pr.loss }, expected: [la, lb], modal, favorite, favP, factors, reasons, verdict, verdictText }
}
