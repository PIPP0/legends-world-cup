import { tr } from '../i18n'
import { TEAMS, PLAYERS, GROUPS, STORY_MATCHES, TEAM_BY_ID, findPlayerByName, teamsOfGroup } from '../data'
import { DECLARED_QUALIFIERS, DECLARED_R16, DECLARED_SCORERS, ESTIMATED_ASSISTS } from '../data/raw'
import { groupTable, qualifiers, r16Pairs } from './standings'

export interface Check { label: string; level: 'ok' | 'warn' | 'fail'; detail: string }

export function validate(): Check[] {
  const out: Check[] = []
  const add = (label: string, ok: boolean, detail: string, warn = false) =>
    out.push({ label, level: ok ? 'ok' : warn ? 'warn' : 'fail', detail })

  add(tr('32 selecciones'), TEAMS.length === 32, tr('{n} selecciones', { n: TEAMS.length }))
  add(tr('Once titular completo'), TEAMS.every((t) => t.xi.length === 11 && t.xi.filter((p) => p.pos === 'PO').length === 1), tr('Cada selección tiene 11 titulares y un portero'))
  const ids = PLAYERS.map((p) => p.id)
  const dup = ids.filter((id, i) => ids.indexOf(id) !== i)
  const names = PLAYERS.map((p) => p.name)
  const dupN = names.filter((n, i) => names.indexOf(n) !== i)
  add(tr('Ningún jugador en dos países'), dup.length === 0 && dupN.length === 0, dup.length || dupN.length ? tr('Repetidos: {n}', { n: [...dup, ...dupN].join(', ') }) : tr('{n} jugadores únicos', { n: PLAYERS.length }))
  add(tr('8 grupos de 4'), GROUPS.length === 8 && GROUPS.every((g) => teamsOfGroup(g).length === 4), tr('8 grupos con 4 equipos'))
  add(tr('48 partidos de grupos'), STORY_MATCHES.length === 48, tr('{n} partidos', { n: STORY_MATCHES.length }))

  const games: Record<string, number> = {}
  for (const m of STORY_MATCHES) {
    games[m.home] = (games[m.home] ?? 0) + 1; games[m.away] = (games[m.away] ?? 0) + 1
    if (TEAM_BY_ID[m.home].group !== m.group || TEAM_BY_ID[m.away].group !== m.group) add(tr('Partido {id}', { id: m.id }), false, tr('Equipos fuera de su grupo'))
  }
  add(tr('Tres partidos por selección'), TEAMS.every((t) => games[t.id] === 3), tr('Cada selección juega 3 partidos'))

  let tablesOk = true
  for (const g of GROUPS) {
    const t = groupTable(g, STORY_MATCHES)
    const gf = t.reduce((a, r) => a + r.gf, 0), ga = t.reduce((a, r) => a + r.ga, 0)
    if (gf !== ga || t.some((r) => r.pts !== 3 * r.w + r.d || r.w + r.d + r.l !== 3)) tablesOk = false
  }
  add(tr('Tablas matemáticamente correctas'), tablesOk, tr('Goles a favor = en contra; puntos = 3·V + E; PJ = 3'))

  const q = qualifiers(STORY_MATCHES)
  const mism = GROUPS.filter((g) => q[g][0] !== DECLARED_QUALIFIERS[g][0] || q[g][1] !== DECLARED_QUALIFIERS[g][1])
  add(tr('Clasificados coinciden con las tablas'), mism.length === 0, mism.length ? tr('Difieren: {n}', { n: mism.join(', ') }) : tr('16 clasificados coinciden con lo declarado'))

  const pairs = r16Pairs(q)
  const same = pairs.every((p, i) => p[0] === DECLARED_R16[i][0] && p[1] === DECLARED_R16[i][1])
  add(tr('Octavos respetan el formato (1A–2B, 1C–2D…)'), same, same ? tr('8 cruces idénticos a los definidos') : tr('Hay cruces que no coinciden'))

  // goleadores declarados vs goles del equipo
  const goalsBy: Record<string, number> = {}
  for (const m of STORY_MATCHES) { goalsBy[m.home] = (goalsBy[m.home] ?? 0) + m.hg; goalsBy[m.away] = (goalsBy[m.away] ?? 0) + m.ag }
  const perTeam: Record<string, number> = {}
  let unknown: string[] = []
  for (const s of DECLARED_SCORERS) {
    const p = findPlayerByName(s.name)
    if (!p) { unknown.push(s.name); continue }
    perTeam[p.teamId] = (perTeam[p.teamId] ?? 0) + s.goals
  }
  const over = Object.entries(perTeam).filter(([t, g]) => g > goalsBy[t])
  add(tr('Goleadores declarados existen en las plantillas'), unknown.length === 0, unknown.length ? tr('No encontrados: {n}', { n: unknown.join(', ') }) : tr('{n} goleadores localizados', { n: DECLARED_SCORERS.length }))
  add(tr('Goles declarados ≤ goles del equipo'), over.length === 0, over.length ? over.map(([t]) => TEAM_BY_ID[t].name).join(', ') : tr('Ninguna selección supera sus goles'))
  const aUnknown = ESTIMATED_ASSISTS.filter((a) => !findPlayerByName(a.name)).map((a) => a.name)
  add(tr('Asistentes estimados existen en las plantillas'), aUnknown.length === 0, aUnknown.join(', ') || tr('Todos localizados'))

  const withEvents = STORY_MATCHES.filter((m) => m.goals?.length).length
  const totalGoals = STORY_MATCHES.reduce((a, m) => a + m.hg + m.ag, 0)
  add(tr('Goleadores = eventos de partido'), withEvents === STORY_MATCHES.length, tr('La historia original no define autores ni minutos: 0 de {n} goles tienen evento. Las cifras de goleadores se muestran como «declaradas». El cálculo desde eventos ya funciona en el torneo alternativo.', { n: totalGoals }), true)

  const verify = PLAYERS.filter((p) => p.verify)
  add(tr('Nombres de alineaciones a verificar'), verify.length === 0, verify.map((p) => `${p.name} (${TEAM_BY_ID[p.teamId].name})`).join(', ') || tr('Ninguno'), true)
  add(tr('Edad de 27 años'), false, tr('Es una regla narrativa del torneo: la valoración de cada jugador representa su mejor versión; el modelo no usa edades reales.'), true)
  return out
}
