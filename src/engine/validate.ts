import { TEAMS, PLAYERS, GROUPS, STORY_MATCHES, TEAM_BY_ID, findPlayerByName, teamsOfGroup } from '../data'
import { DECLARED_QUALIFIERS, DECLARED_R16, DECLARED_SCORERS, ESTIMATED_ASSISTS } from '../data/raw'
import { groupTable, qualifiers, r16Pairs } from './standings'

export interface Check { label: string; level: 'ok' | 'warn' | 'fail'; detail: string }

export function validate(): Check[] {
  const out: Check[] = []
  const add = (label: string, ok: boolean, detail: string, warn = false) =>
    out.push({ label, level: ok ? 'ok' : warn ? 'warn' : 'fail', detail })

  add('32 selecciones', TEAMS.length === 32, `${TEAMS.length} selecciones`)
  add('Once titular completo', TEAMS.every((t) => t.xi.length === 11 && t.xi.filter((p) => p.pos === 'PO').length === 1), 'Cada selección tiene 11 titulares y un portero')
  const ids = PLAYERS.map((p) => p.id)
  const dup = ids.filter((id, i) => ids.indexOf(id) !== i)
  const names = PLAYERS.map((p) => p.name)
  const dupN = names.filter((n, i) => names.indexOf(n) !== i)
  add('Ningún jugador en dos países', dup.length === 0 && dupN.length === 0, dup.length || dupN.length ? `Repetidos: ${[...dup, ...dupN].join(', ')}` : `${PLAYERS.length} jugadores únicos`)
  add('8 grupos de 4', GROUPS.length === 8 && GROUPS.every((g) => teamsOfGroup(g).length === 4), '8 grupos con 4 equipos')
  add('48 partidos de grupos', STORY_MATCHES.length === 48, `${STORY_MATCHES.length} partidos`)

  const games: Record<string, number> = {}
  for (const m of STORY_MATCHES) {
    games[m.home] = (games[m.home] ?? 0) + 1; games[m.away] = (games[m.away] ?? 0) + 1
    if (TEAM_BY_ID[m.home].group !== m.group || TEAM_BY_ID[m.away].group !== m.group) add(`Partido ${m.id}`, false, 'Equipos fuera de su grupo')
  }
  add('Tres partidos por selección', TEAMS.every((t) => games[t.id] === 3), 'Cada selección juega 3 partidos')

  let tablesOk = true
  for (const g of GROUPS) {
    const t = groupTable(g, STORY_MATCHES)
    const gf = t.reduce((a, r) => a + r.gf, 0), ga = t.reduce((a, r) => a + r.ga, 0)
    if (gf !== ga || t.some((r) => r.pts !== 3 * r.w + r.d || r.w + r.d + r.l !== 3)) tablesOk = false
  }
  add('Tablas matemáticamente correctas', tablesOk, 'Goles a favor = en contra; puntos = 3·V + E; PJ = 3')

  const q = qualifiers(STORY_MATCHES)
  const mism = GROUPS.filter((g) => q[g][0] !== DECLARED_QUALIFIERS[g][0] || q[g][1] !== DECLARED_QUALIFIERS[g][1])
  add('Clasificados coinciden con las tablas', mism.length === 0, mism.length ? `Difieren: ${mism.join(', ')}` : '16 clasificados coinciden con lo declarado')

  const pairs = r16Pairs(q)
  const same = pairs.every((p, i) => p[0] === DECLARED_R16[i][0] && p[1] === DECLARED_R16[i][1])
  add('Octavos respetan el formato (1A–2B, 1C–2D…)', same, same ? '8 cruces idénticos a los definidos' : 'Hay cruces que no coinciden')

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
  add('Goleadores declarados existen en las plantillas', unknown.length === 0, unknown.length ? `No encontrados: ${unknown.join(', ')}` : `${DECLARED_SCORERS.length} goleadores localizados`)
  add('Goles declarados ≤ goles del equipo', over.length === 0, over.length ? over.map(([t]) => TEAM_BY_ID[t].name).join(', ') : 'Ninguna selección supera sus goles')
  const aUnknown = ESTIMATED_ASSISTS.filter((a) => !findPlayerByName(a.name)).map((a) => a.name)
  add('Asistentes estimados existen en las plantillas', aUnknown.length === 0, aUnknown.join(', ') || 'Todos localizados')

  const withEvents = STORY_MATCHES.filter((m) => m.goals?.length).length
  const totalGoals = STORY_MATCHES.reduce((a, m) => a + m.hg + m.ag, 0)
  add('Goleadores = eventos de partido', withEvents === STORY_MATCHES.length, `La historia original no define autores ni minutos: 0 de ${totalGoals} goles tienen evento. Las cifras de goleadores se muestran como «declaradas». El cálculo desde eventos ya funciona en el torneo alternativo.`, true)

  const verify = PLAYERS.filter((p) => p.verify)
  add('Nombres de alineaciones a verificar', verify.length === 0, verify.map((p) => `${p.name} (${TEAM_BY_ID[p.teamId].name})`).join(', ') || 'Ninguno', true)
  add('Edad de 27 años', false, 'Es una regla narrativa del torneo: la valoración de cada jugador representa su mejor versión; el modelo no usa edades reales.', true)
  return out
}
