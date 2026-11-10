import { tr } from '../i18n'
import { RAW_TEAMS, RAW_RESULTS } from './raw'
import { BENCH } from './squads'
import { teamName } from '../i18n/nombres'
import { esIngles } from '../i18n'
import { hashString } from '../engine/rng'
import type { Attr, Line, Match, Player, Pos, Team } from '../types'

const DEF: Pos[] = ['LD', 'DFC', 'DFC', 'LI']
const FORMATIONS: Record<string, Pos[][]> = {
  '4-2-3-1': [DEF, ['MCD', 'MCD'], ['EXT', 'MCO', 'EXT'], ['DC']],
  '4-3-3': [DEF, ['MC', 'MC', 'MC'], ['EXT', 'DC', 'EXT']],
  '4-3-1-2': [DEF, ['MC', 'MC', 'MC'], ['MCO'], ['DC', 'DC']],
  '4-2-4': [DEF, ['MCD', 'MCD'], ['EXT', 'DC', 'DC', 'EXT']],
  '4-4-2': [DEF, ['MD', 'MC', 'MC', 'MI'], ['DC', 'DC']],
}

export const FORMATION_NOTES: Record<string, string> = {
  '4-2-3-1': tr('Doble pivote que protege la zaga y tres creadores detrás de un único delantero.'),
  '4-3-3': tr('Tres mediocampistas para controlar el centro y extremos que ensanchan la cancha.'),
  '4-3-1-2': tr('Un enganche conecta el mediocampo con una dupla de ataque; el juego se concentra por dentro.'),
  '4-2-4': tr('Cuatro atacantes y dos volantes: máximo riesgo ofensivo, deja espacios a la espalda.'),
  '4-4-2': tr('Dos líneas de cuatro y dos delanteros: equilibrio clásico y orden defensivo.'),
}

export const slug = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

const OFFSETS: Record<string, number[]> = {
  // Ritmo, Disparo, Pase, Regate, Defensa, Físico
  LD: [0, -24, -8, -10, 2, 0], LI: [0, -24, -8, -10, 2, 0],
  DFC: [-6, -30, -10, -18, 4, 3],
  MCD: [-6, -16, 0, -8, 0, 2], MC: [-4, -10, 3, 0, -10, -1], MI: [-2, -10, 0, -2, -8, -1], MD: [-2, -10, 0, -2, -8, -1],
  MCO: [-2, -4, 4, 5, -28, -8], EXT: [4, -6, -4, 6, -32, -10], DC: [0, 5, -10, 0, -36, -4],
}
const ATTR_NAMES = ['Ritmo', 'Disparo', 'Pase', 'Regate', 'Defensa', 'Físico']
const GK_NAMES = ['Paradas', 'Reflejos', 'Posición', 'Salida', 'Juego aéreo', 'Juego con los pies']
const GK_OFFSETS = [0, 1, 0, -4, -3, -12]

const SCORER_W: Record<Pos, number> = { PO: 0, LD: 0.05, LI: 0.05, DFC: 0.04, MCD: 0.08, MC: 0.22, MI: 0.22, MD: 0.22, MCO: 0.5, EXT: 0.55, DC: 1 }
const CREATOR_W: Record<Pos, number> = { PO: 0, LD: 0.3, LI: 0.3, DFC: 0.08, MCD: 0.35, MC: 0.6, MI: 0.6, MD: 0.6, MCO: 1, EXT: 0.7, DC: 0.3 }

const lineOf = (p: Pos): Line =>
  p === 'PO' ? 'GK' : ['LD', 'LI', 'DFC'].includes(p) ? 'DEF' : ['EXT', 'DC'].includes(p) ? 'ATT' : 'MID'

function buildAttrs(name: string, pos: Pos, ovr: number): Attr[] {
  const names = pos === 'PO' ? GK_NAMES : ATTR_NAMES
  const off = pos === 'PO' ? GK_OFFSETS : OFFSETS[pos]
  return names.map((k, i) => {
    const noise = (hashString(name + k) % 9) - 4
    return { k, v: Math.max(45, Math.min(99, Math.round(ovr + off[i] + noise))) }
  })
}

interface RawP { name: string; ovr: number; verify: boolean; pos: Pos }
const parseEntry = (e: string, pos?: Pos): RawP => {
  const verify = e.endsWith('?')
  const [name, ovr, p] = e.replace(/\?$/, '').split(':')
  return { name, ovr: Number(ovr), verify, pos: (pos ?? p) as Pos }
}

function parseTeam(raw: (typeof RAW_TEAMS)[number]): Team {
  const rows = FORMATIONS[raw.formation]
  const slots: { pos: Pos; x: number; y: number }[] = [{ pos: 'PO', x: 50, y: 91 }]
  rows.forEach((row, r) => {
    const y = 91 - ((r + 1) * 78) / rows.length
    row.forEach((pos, i) => slots.push({ pos, x: ((row.length - i - 0.5) / row.length) * 100, y }))
  })
  const entries = raw.xi.split('|')
  if (slots.length !== entries.length) throw new Error(`Alineación inconsistente: ${raw.name}`)
  const starters = entries.map((e, i) => parseEntry(e, slots[i].pos))
  const bench = (BENCH[raw.id] ?? '').split('|').filter(Boolean).map((e) => parseEntry(e))
  if (bench.length !== 12) throw new Error(`Plantel incompleto (se esperan 12 suplentes): ${raw.name}`)
  const build = (r: RawP, x: number, y: number, starter: boolean): Player => {
    const q = Math.pow(r.ovr / 90, 3)
    return {
      id: `${raw.id}-${slug(r.name)}`, name: r.name, teamId: raw.id, pos: r.pos, line: lineOf(r.pos), ovr: r.ovr, x, y, verify: r.verify, starter,
      attrs: buildAttrs(r.name, r.pos, r.ovr),
      weight: { scorer: SCORER_W[r.pos] * q, creator: CREATOR_W[r.pos] * q },
    }
  }
  const xi = starters.map((r, i) => build(r, slots[i].x, slots[i].y, true))
  const bn = bench.map((r) => build(r, 50, 50, false)).sort((a, b) => ['GK', 'DEF', 'MID', 'ATT'].indexOf(a.line) - ['GK', 'DEF', 'MID', 'ATT'].indexOf(b.line) || b.ovr - a.ovr)
  return { id: raw.id, name: teamName(raw.id, raw.name), iso: raw.iso, group: raw.group, formation: raw.formation, xi, bench: bn, squad: [...xi, ...bn] }
}

export const TEAMS: Team[] = RAW_TEAMS.map(parseTeam)
export const TEAM_BY_ID: Record<string, Team> = Object.fromEntries(TEAMS.map((t) => [t.id, t]))
export const PLAYERS: Player[] = TEAMS.flatMap((t) => t.squad)
export const PLAYER_BY_ID: Record<string, Player> = Object.fromEntries(PLAYERS.map((p) => [p.id, p]))
export const GROUPS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']
export const teamsOfGroup = (g: string) => RAW_TEAMS.filter((t) => t.group === g).map((t) => t.id)

export function findPlayerByName(name: string): Player | undefined {
  return PLAYERS.find((p) => p.name === name)
}

export const STORY_MATCHES: Match[] = GROUPS.flatMap((g) =>
  RAW_RESULTS[g].map((line, i) => {
    const m = line.match(/^(\w+) (\d+)-(\d+) (\w+)$/)!
    return {
      id: `${g}${i + 1}`, group: g, matchday: (Math.floor(i / 2) + 1) as 1 | 2 | 3,
      home: m[1], away: m[4], hg: Number(m[2]), ag: Number(m[3]),
    }
  }),
)

export const tn = (id?: string) => (id ? TEAM_BY_ID[id]?.name ?? id : 'Por definir')
