import { tr } from '../i18n'
import { STORY_KNOCKOUT } from '../data/storyKnockout'
import { TEAM_BY_ID } from '../data'
import type { KoMatch } from '../types'

const b = STORY_KNOCKOUT.bracket
export const RONDAS = [
  { id: 'r16', nombre: tr('Octavos de final'), matches: b.r16 },
  { id: 'qf', nombre: tr('Cuartos de final'), matches: b.qf },
  { id: 'sf', nombre: tr('Semifinales'), matches: b.sf },
  { id: 'fin', nombre: tr('Tercer puesto y final'), matches: [b.third, b.final] },
] as const
export const roundName = (m: KoMatch) => (m.round === 'r16' ? tr('Octavos') : m.round === 'qf' ? tr('Cuartos') : m.round === 'sf' ? tr('Semifinales') : m.round === 'third' ? tr('Tercer puesto') : tr('Final'))

// Partidos de eliminatorias ya revelados para quien está en el nivel `level`.
export function revealed(level: number): KoMatch[] { return RONDAS.filter((_, i) => i < level).flatMap((r) => [...r.matches]) }
export const koById = (id: string): { m: KoMatch; ronda: number } | null => {
  for (let i = 0; i < RONDAS.length; i++) { const m = RONDAS[i].matches.find((x) => x.id === id); if (m) return { m, ronda: i } }
  return null
}
export const isRevealed = (id: string, level: number) => { const k = koById(id); return !!k && k.ronda < level }
export const finalResult = () => ({ champion: b.champion!, runnerUp: b.final.winner === b.final.a ? b.final.b! : b.final.a!, third: b.third.winner!, fourth: b.third.winner === b.third.a ? b.third.b! : b.third.a! })
export const phaseLabel = (level: number) => (level <= 0 ? tr('Octavos') : level === 1 ? tr('Cuartos') : level === 2 ? tr('Semifinales') : level === 3 ? tr('Final') : tr('Campeón: {n}', { n: TEAM_BY_ID[b.champion!].name }))
export const scoreText = (m: KoMatch) => `${m.ga}–${m.gb}${m.pens ? tr(' (pen. {a}–{b})', { a: m.pens[0], b: m.pens[1] }) : m.et ? tr(' (pr.)') : ''}`

// Situación de una selección en las eliminatorias según lo que se ha revelado.
export function teamStatus(id: string, level: number): { next?: { opp: string; ronda: string }; text: string } {
  for (let i = 0; i < RONDAS.length; i++) {
    const m = RONDAS[i].matches.find((x) => x.a === id || x.b === id)
    if (!m) return { text: i === 0 ? tr('Eliminada en la fase de grupos.') : tr('Eliminada.') }
    const opp = m.a === id ? m.b! : m.a!
    if (i === level) return { next: { opp, ronda: RONDAS[i].id === 'fin' ? roundName(m) : RONDAS[i].nombre }, text: '' }
    if (i > level) return { text: '' }
    const won = m.winner === id
    if (m.round === 'final') return { text: won ? tr('Campeona del mundial.') : tr('Subcampeona del mundial.') }
    if (m.round === 'third') return { text: won ? tr('Tercer lugar.') : tr('Cuarto lugar.') }
    if (!won) {
      if (m.round === 'sf') continue // pasa al partido por el tercer puesto
      return { text: tr('Eliminada en {r}.', { r: RONDAS[i].nombre.toLowerCase() }) }
    }
  }
  return { text: '' }
}
