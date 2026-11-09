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
    mk('Calidad del once', A.quality, B.quality, 'promedio de valoraciones de los 11 titulares'),
    mk('Ataque vs defensa rival', A.attack - B.defense + 90, B.attack - A.defense + 90, 'ataque propio contra defensa del rival'),
    mk('Portería', A.gk, B.gk, 'valoración del arquero'),
    mk('Equilibrio', A.balance, B.balance, 'homogeneidad del once y formación'),
    mk('Experiencia', A.experience, B.experience, 'promedio de las cinco mayores figuras'),
  ]

  const reasons: string[] = []
  const nameOf = (id: string) => TEAM_BY_ID[id].name
  const top = (id: string) => [...TEAM_BY_ID[id].xi].sort((x, y) => y.ovr - x.ovr)[0]
  const gap = A.strength - B.strength
  const strong = gap >= 0 ? a : b
  const weak = gap >= 0 ? b : a
  if (Math.abs(gap) < 1) reasons.push(`Los dos equipos tienen una fuerza casi idéntica (${f1(A.strength)} contra ${f1(B.strength)}): el modelo los ve parejos.`)
  else reasons.push(`${nameOf(strong)} tiene más fuerza global: ${f1(Math.max(A.strength, B.strength))} contra ${f1(Math.min(A.strength, B.strength))} de ${nameOf(weak)}, una diferencia de ${f1(Math.abs(gap))} puntos.`)
  const best = [...factors].filter((x) => x.edge !== 'eq').sort((x, y) => Math.abs(y.a - y.b) - Math.abs(x.a - x.b))[0]
  if (best) reasons.push(`La mayor diferencia está en «${best.label.toLowerCase()}»: ${nameOf(best.edge === 'a' ? a : b)} ${f1(Math.max(best.a, best.b))} frente a ${f1(Math.min(best.a, best.b))}.`)
  if (env?.ctx) {
    const vn = VENUE_BY_ID[env.ctx.venueId]
    const c = env.ctx
    reasons.push(`Sede: ${vn.name} (${vn.city}, ${HOST_OF_VENUE[vn.id].name}), ${c.roof ? 'techado y climatizado' : `${Math.round(c.temp)} °C${c.rain > 0 ? `, lluvia ${c.rain > 0.66 ? 'fuerte' : 'ligera'}` : ', sin lluvia'}`}, ${vn.alt} m de altitud.`)
    for (const id of [a, b]) {
      const ad = adjustments(id, env)
      if (ad.parts.length) reasons.push(`${nameOf(id)}: ${ad.parts.map((p) => `${p.label} (${p.v > 0 ? '+' : ''}${(p.v * 100).toFixed(1)} %)`).join('; ')}.`)
      else reasons.push(`${nameOf(id)}: sin ventajas ni desventajas de lugar o clima.`)
    }
  }
  const pr3 = (env?.world?.primes ?? []).filter((id) => PLAYER_BY_ID[id] && (PLAYER_BY_ID[id].teamId === a || PLAYER_BY_ID[id].teamId === b))
  if (pr3.length) reasons.push(`En su prime (+4 de valoración): ${pr3.map((id) => `${PLAYER_BY_ID[id].name} (${TEAM_BY_ID[PLAYER_BY_ID[id].teamId].name})`).join(', ')}.`)
  const ta = top(a), tb = top(b)
  reasons.push(`Figuras: ${ta.name} (${ta.ovr}) por ${TA.name} y ${tb.name} (${tb.ovr}) por ${TB.name}.`)
  reasons.push(`Con eso el modelo espera ${f1(la)} goles de ${TA.name} y ${f1(lb)} de ${TB.name}; el marcador más probable es ${modal.ga}-${modal.gb} (${pct(modal.p)} de probabilidad por sí solo).`)

  let verdict: Explanation['verdict'] = 'parejo'
  let verdictText = `Partido parejo: ${pct(pr.win)} / ${pct(pr.draw)} / ${pct(pr.loss)}.`
  if (res) {
    const win = res.winner ?? (res.ga > res.gb ? a : res.gb > res.ga ? b : undefined)
    const gdiff = Math.abs(res.ga - res.gb)
    const pFav = favP
    if (win && win !== favorite && pFav >= 0.5) {
      verdict = 'sorpresa'
      const pw = win === a ? pr.win : pr.loss
      verdictText = `Resultado sorpresa: el modelo daba solo ${pct(pw)} de victoria a ${nameOf(win)} en 90 minutos (favorito: ${nameOf(favorite)} con ${pct(favP)}). Pasa en torno a 1 de cada ${Math.max(2, Math.round(1 / pw))} partidos como este.`
      reasons.push(`Cómo se explica: ${nameOf(win)} tuvo un día efectivo (${win === a ? res.ga : res.gb} goles, sobre ${f1(win === a ? la : lb)} esperados) y ${nameOf(favorite)} quedó por debajo de lo esperado (${favorite === a ? res.ga : res.gb} sobre ${f1(favorite === a ? la : lb)}).`)
    } else if (win && win === favorite) {
      verdict = 'esperado'
      verdictText = `Resultado coherente con el modelo: ganó el favorito (${nameOf(favorite)}, ${pct(favP)}).`
      reasons.push(`Se impuso ${nameOf(favorite)} por ${gdiff} gol${gdiff === 1 ? '' : 'es'}; esperaba ${f1(favorite === a ? la : lb)} y marcó ${favorite === a ? res.ga : res.gb}.`)
    } else if (!win) {
      verdictText = `Empate: ocurre ${pct(pr.draw)} de las veces en este cruce.`
    }
    if (res.pens) reasons.push(`Se definió por penales (${res.pens[0]}–${res.pens[1]}): con la prórroga igualada pesa la valoración del arquero (${f1(A.gk)} contra ${f1(B.gk)}).`)
    const sc = res.goals.filter((g) => g.phase !== 'et').reduce<Record<string, number>>((m, g) => { m[g.scorerId] = (m[g.scorerId] ?? 0) + 1; return m }, {})
    const names = Object.entries(sc).map(([id, n]) => `${PLAYER_BY_ID[id].name}${n > 1 ? ` (${n})` : ''}`)
    if (names.length) reasons.push(`Goleadores: ${names.join(', ')}. Se eligen según su peso goleador (posición y valoración).`)
  }
  return { probs: { win: pr.win, draw: pr.draw, loss: pr.loss }, expected: [la, lb], modal, favorite, favP, factors, reasons, verdict, verdictText }
}
