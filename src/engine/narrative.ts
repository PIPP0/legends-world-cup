import { LANG, tr, ordinal } from '../i18n'
import { TEAM_BY_ID, STORY_MATCHES, FORMATION_NOTES } from '../data'
import { AUTHOR_CHRONICLES } from '../data/raw'
import { hashString } from './rng'
import { DEFAULT_PARAMS, probabilities, profile } from './model'
import { groupTable } from './standings'
import type { Match, Team } from '../types'

const pick = <T,>(arr: T[], seed: string) => arr[hashString(seed) % arr.length]
const list = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')}${tr(' y ')}${xs[xs.length - 1]}`)
const lastName = (n: string) => (n.split(' ').length > 1 ? n.split(' ').slice(1).join(' ') : n)

function stars(t: Team, line: 'ATT' | 'MID' | 'DEF', n = 2): string[] {
  return t.xi
    .filter((p) => (line === 'ATT' ? p.pos === 'DC' || p.pos === 'EXT' || p.pos === 'MCO' : p.line === line))
    .sort((a, b) => b.ovr - a.ovr)
    .slice(0, n)
    .map((p) => p.name)
}

export interface MatchStory {
  previa: string
  cronica: string
  tactico: string
  consecuencias: string[]
  figura: string
  datos: string
  doc: boolean // crónica entregada por el autor
}

const LINES: [string, 'gk' | 'def' | 'mid' | 'att'][] = [[tr('la portería'), 'gk'], [tr('la defensa'), 'def'], [tr('el mediocampo'), 'mid'], [tr('el ataque'), 'att']]

export function matchStory(m: Match): MatchStory {
  const H = TEAM_BY_ID[m.home], A = TEAM_BY_ID[m.away]
  const pr = probabilities(m.home, m.away, DEFAULT_PARAMS)
  const hp = profile(m.home), ap = profile(m.away)
  const fav = pr.win >= pr.loss ? H : A
  const dog = fav === H ? A : H
  const favP = Math.max(pr.win, pr.loss)
  const winner = m.hg > m.ag ? H : m.hg < m.ag ? A : null
  const loser = winner ? (winner === H ? A : H) : null
  const draw = !winner
  const margin = Math.abs(m.hg - m.ag)

  const previa = tr('Fecha {m} del Grupo {g}. Según el modelo, {f} llegaba como ligero favorito ({p}% de victoria) frente a {d}, con {e}% de probabilidad de empate. {h} formó en {hf} y {a} en {af}.', {
    m: m.matchday, g: m.group, f: fav.name, p: Math.round(favP * 100), d: dog.name, e: Math.round(pr.draw * 100), h: H.name, hf: H.formation, a: A.name, af: A.formation })

  const score = `${H.name} ${m.hg}–${m.ag} ${A.name}`
  let cronica: string
  const authorKey = `${m.home}-${m.away}`
  const doc = !!AUTHOR_CHRONICLES[authorKey]
  if (doc) cronica = AUTHOR_CHRONICLES[authorKey]
  else if (draw) {
    cronica = m.hg === 0
      ? tr('{s}. Un partido cerrado donde {a} y {b} no encontraron espacios. Las defensas, lideradas por {c} y {d}, se impusieron.', { s: score, a: list(stars(H, 'ATT', 1)), b: list(stars(A, 'ATT', 1)), c: stars(H, 'DEF', 1)[0], d: stars(A, 'DEF', 1)[0] })
      : tr('{s}. {p}: {h} apostó por {a}, y {t} respondió con {b}.', { s: score, p: pick([tr('Reparto de puntos en un duelo parejo'), tr('Ninguno logró desequilibrar'), tr('Empate con golpes de ambos lados')], m.id), h: H.name, a: list(stars(H, 'ATT')), t: A.name, b: list(stars(A, 'ATT')) })
  } else {
    const upset = winner !== fav
    const tone = margin >= 3 ? tr('Goleada') : margin === 2 ? tr('Victoria con autoridad') : tr('Triunfo ajustado')
    cronica = tr('{s}. {tone}{u}: {w} se impuso con {a} como referentes ofensivos{r}.', {
      s: score, tone, u: upset ? tr(' y sorpresa del grupo') : '', w: winner!.name, a: list(stars(winner!, 'ATT')),
      r: margin >= 2 ? tr(' y dejó a {l} sin respuestas', { l: loser!.name }) : tr(', mientras {l} resistió con {d}', { l: loser!.name, d: list(stars(loser!, 'DEF', 1)) }) })
  }

  // Análisis táctico: línea con mayor diferencia
  const diffs = LINES.map(([label, k]) => ({ label, d: (k === 'gk' ? hp.lines.gk - ap.lines.gk : hp.lines[k] - ap.lines[k]) }))
    .sort((a, b) => Math.abs(b.d) - Math.abs(a.d))[0]
  const edge = diffs.d >= 0 ? H : A
  const tactico =
    tr('{hf} de {h}: {hn} {af} de {a}: {an} {t}', { hf: H.formation, h: H.name, hn: FORMATION_NOTES[H.formation], af: A.formation, a: A.name, an: FORMATION_NOTES[A.formation],
      t: Math.abs(diffs.d) < 0.8 ? tr('Los dos onces están muy parejos en todas las líneas.') : tr('La mayor diferencia del modelo está en {l}, a favor de {e} ({d} puntos de valoración media).', { l: diffs.label, e: edge.name, d: Math.abs(diffs.d).toFixed(1) }) })

  // Consecuencias
  const consecuencias: string[] = []
  const t = groupTable(m.group, STORY_MATCHES, m.matchday)
  for (const team of [H, A]) {
    const idx = t.findIndex((r) => r.teamId === team.id)
    const r = t[idx]
    const pos = ordinal(idx + 1)
    const ptl = r.pts === 1 ? tr('pt') : tr('pts')
    if (m.matchday < 3) consecuencias.push(tr('{t}: {p} del Grupo {g} con {n} {pt} (DG {d}) tras la fecha {m}.', { t: team.name, p: pos, g: m.group, n: r.pts, pt: ptl, d: `${r.gd > 0 ? '+' : ''}${r.gd}`, m: m.matchday }))
    else consecuencias.push(tr('{t}: termina {p} del Grupo {g} con {n} {pt} y {r}.', { t: team.name, p: pos, g: m.group, n: r.pts, pt: ptl, r: idx < 2 ? tr('clasifica a octavos') : tr('queda eliminado') }))
  }

  return {
    previa, cronica, tactico, consecuencias,
    figura: tr('Por definir: la simulación original no registró al jugador del partido.'),
    datos: tr('La simulación original solo fijó el marcador. No hay goleadores ni minutos definidos para este partido.'),
    doc,
  }
}

export function teamBlurb(t: Team) {
  const p = profile(t.id)
  const all = [
    [tr('portería'), p.lines.gk], [tr('defensa'), p.lines.def], [tr('mediocampo'), p.lines.mid], [tr('ataque'), p.lines.att],
  ] as [string, number][]
  const sorted = [...all].sort((a, b) => b[1] - a[1])
  return { strong: sorted.slice(0, 2).map((x) => x[0]), weak: sorted.slice(-1).map((x) => x[0]), star: [...t.xi].sort((a, b) => b.ovr - a.ovr)[0], lastName }
}
