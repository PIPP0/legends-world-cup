import { TEAM_BY_ID, STORY_MATCHES, FORMATION_NOTES } from '../data'
import { AUTHOR_CHRONICLES } from '../data/raw'
import { hashString } from './rng'
import { DEFAULT_PARAMS, probabilities, profile } from './model'
import { groupTable } from './standings'
import type { Match, Team } from '../types'

const pick = <T,>(arr: T[], seed: string) => arr[hashString(seed) % arr.length]
const list = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} y ${xs[xs.length - 1]}`)
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

const LINES: [string, 'gk' | 'def' | 'mid' | 'att'][] = [['la portería', 'gk'], ['la defensa', 'def'], ['el mediocampo', 'mid'], ['el ataque', 'att']]

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

  const previa =
    `Fecha ${m.matchday} del Grupo ${m.group}. Según el modelo, ${fav.name} llegaba como ligero favorito (${Math.round(favP * 100)}% de victoria) ` +
    `frente a ${dog.name}, con ${Math.round(pr.draw * 100)}% de probabilidad de empate. ${H.name} formó en ${H.formation} y ${A.name} en ${A.formation}.`

  const score = `${H.name} ${m.hg}–${m.ag} ${A.name}`
  let cronica: string
  const authorKey = `${m.home}-${m.away}`
  const doc = !!AUTHOR_CHRONICLES[authorKey]
  if (doc) cronica = AUTHOR_CHRONICLES[authorKey]
  else if (draw) {
    cronica = m.hg === 0
      ? `${score}. Un partido cerrado donde ${list(stars(H, 'ATT', 1))} y ${list(stars(A, 'ATT', 1))} no encontraron espacios. Las defensas, lideradas por ${stars(H, 'DEF', 1)[0]} y ${stars(A, 'DEF', 1)[0]}, se impusieron.`
      : `${score}. ${pick(['Reparto de puntos en un duelo parejo', 'Ninguno logró desequilibrar', 'Empate con golpes de ambos lados'], m.id)}: ${H.name} apostó por ${list(stars(H, 'ATT'))}, y ${A.name} respondió con ${list(stars(A, 'ATT'))}.`
  } else {
    const upset = winner !== fav
    const tone = margin >= 3 ? 'Goleada' : margin === 2 ? 'Victoria con autoridad' : 'Triunfo ajustado'
    cronica =
      `${score}. ${tone}${upset ? ' y sorpresa del grupo' : ''}: ${winner!.name} se impuso con ${list(stars(winner!, 'ATT'))} como referentes ofensivos` +
      `${margin >= 2 ? ` y dejó a ${loser!.name} sin respuestas` : `, mientras ${loser!.name} resistió con ${list(stars(loser!, 'DEF', 1))}`}.`
  }

  // Análisis táctico: línea con mayor diferencia
  const diffs = LINES.map(([label, k]) => ({ label, d: (k === 'gk' ? hp.lines.gk - ap.lines.gk : hp.lines[k] - ap.lines[k]) }))
    .sort((a, b) => Math.abs(b.d) - Math.abs(a.d))[0]
  const edge = diffs.d >= 0 ? H : A
  const tactico =
    `${H.formation} de ${H.name}: ${FORMATION_NOTES[H.formation]} ${A.formation} de ${A.name}: ${FORMATION_NOTES[A.formation]} ` +
    (Math.abs(diffs.d) < 0.8
      ? 'Los dos onces están muy parejos en todas las líneas.'
      : `La mayor diferencia del modelo está en ${diffs.label}, a favor de ${edge.name} (${Math.abs(diffs.d).toFixed(1)} puntos de valoración media).`)

  // Consecuencias
  const consecuencias: string[] = []
  const t = groupTable(m.group, STORY_MATCHES, m.matchday)
  for (const team of [H, A]) {
    const idx = t.findIndex((r) => r.teamId === team.id)
    const r = t[idx]
    const pos = `${idx + 1}.º`
    if (m.matchday < 3) consecuencias.push(`${team.name}: ${pos} del Grupo ${m.group} con ${r.pts} pt${r.pts === 1 ? '' : 's'} (DG ${r.gd > 0 ? '+' : ''}${r.gd}) tras la fecha ${m.matchday}.`)
    else consecuencias.push(`${team.name}: termina ${pos} del Grupo ${m.group} con ${r.pts} pt${r.pts === 1 ? '' : 's'} y ${idx < 2 ? 'clasifica a octavos' : 'queda eliminado'}.`)
  }

  return {
    previa, cronica, tactico, consecuencias,
    figura: 'Por definir: la simulación original no registró al jugador del partido.',
    datos: 'La simulación original solo fijó el marcador. No hay goleadores ni minutos definidos para este partido.',
    doc,
  }
}

export function teamBlurb(t: Team) {
  const p = profile(t.id)
  const all = [
    ['portería', p.lines.gk], ['defensa', p.lines.def], ['mediocampo', p.lines.mid], ['ataque', p.lines.att],
  ] as [string, number][]
  const sorted = [...all].sort((a, b) => b[1] - a[1])
  return { strong: sorted.slice(0, 2).map((x) => x[0]), weak: sorted.slice(-1).map((x) => x[0]), star: [...t.xi].sort((a, b) => b.ovr - a.ovr)[0], lastName }
}
