import { LANG, tr, ordinal } from '../i18n'
import { attrLabel, posLabel } from '../i18n/nombres'
import { useMemo, useState } from 'react'
import { GROUPS, PLAYERS, STORY_MATCHES, TEAMS, FORMATION_NOTES } from '../data'
import { DECLARED_R16 } from '../data/raw'
import { DEFAULT_PARAMS, profile, strengthRank } from '../engine/model'
import { storyPlayerStats, storyTeamStats, teamStats } from '../engine/stats'
import { useStoryLevel } from '../engine/storyLevel'
import { revealed, teamStatus } from '../engine/historia'
import { teamBlurb } from '../engine/narrative'
import { groupTable } from '../engine/standings'
import { Avatar, Bar, Flag, Note, PlayerCard, Radar, Section, TeamLink, usePhoto, go } from './common'
import { FutCard, Pitch, TeamCard } from './visual'
import { KoRow, MatchRow } from './blocks'
import { PLAYER_BY_ID, TEAM_BY_ID } from '../data/lookup'
import type { Player } from '../types'

const rankOf = (vals: number[], v: number) => vals.filter((x) => x > v).length + 1

export function Teams() {
  const [q, setQ] = useState('')
  const [g, setG] = useState('')
  const rank = useMemo(() => strengthRank(DEFAULT_PARAMS).map((p) => p.teamId), [])
  const list = TEAMS.filter((t) => (!g || t.group === g) && t.name.toLowerCase().includes(q.toLowerCase()))
  return (
    <Section title={tr('Selecciones')} sub={tr('32 equipos históricos. Toca uno para ver su once.')}>
      <div className="filters">
        <input type="search" placeholder={tr('Buscar selección…')} value={q} onChange={(e) => setQ(e.target.value)} aria-label={tr('Buscar selección')} />
        <select value={g} onChange={(e) => setG(e.target.value)} aria-label={tr('Filtrar por grupo')}>
          <option value="">{tr('Todos los grupos')}</option>{GROUPS.map((x) => <option key={x} value={x}>{tr('Grupo')} {x}</option>)}
        </select>
      </div>
      <div className="grid g4">
        {list.map((t) => {
          const star = [...t.xi].sort((a, b) => b.ovr - a.ovr)[0]
          return (
            <TeamCard key={t.id} t={t} star={star} extra={<small>{tr('Gr. {g} · {f} · #{r} del modelo', { g: t.group, f: t.formation, r: rank.indexOf(t.id) + 1 })}</small>} />
          )
        })}
      </div>
    </Section>
  )
}

export function Team({ id }: { id: string }) {
  const t = TEAM_BY_ID[id]
  if (!t) return <Note tone="warn">{tr('Selección no encontrada.')}</Note>
  const prof = profile(id, DEFAULT_PARAMS)
  const all = TEAMS.map((x) => profile(x.id, DEFAULT_PARAMS))
  const blurb = teamBlurb(t)
  const level = useStoryLevel()
  const matches = STORY_MATCHES.filter((m) => m.home === id || m.away === id)
  const koMatches = revealed(level).filter((m) => m.a === id || m.b === id)
  const status = teamStatus(id, level)
  const ts = teamStats(STORY_MATCHES).find((x) => x.teamId === id)!
  const tsKo = storyTeamStats(STORY_MATCHES, level).find((x) => x.teamId === id)!
  const row = groupTable(t.group, STORY_MATCHES)
  const pos = row.findIndex((r) => r.teamId === id) + 1
  const comps: [string, keyof typeof prof][] = [[tr('Calidad individual'), 'quality'], [tr('Equilibrio táctico'), 'balance'], [tr('Capacidad ofensiva'), 'attack'], [tr('Solidez defensiva'), 'defense'], [tr('Experiencia (proxy)'), 'experience']]
  const decl = storyPlayerStats(level).filter((s) => PLAYER_BY_ID[s.playerId].teamId === id)
  return (
    <>
      <div className="thead">
        <Flag id={id} size={64} />
        <div>
          <h1>{t.name}</h1>
          <p className="muted">{LANG === 'en' ? `Group ${t.group} · ${t.formation} · ${ordinal(pos)} in the group · #${rankOf(all.map((a) => a.strength), prof.strength)} of 32 by the model` : `Grupo ${t.group} · ${t.formation} · ${pos}.º del grupo · #${rankOf(all.map((a) => a.strength), prof.strength)} de 32 en el modelo`}</p>
        </div>
      </div>

      <Section title={tr('Alineación histórica')} sub={`${t.formation}: ${FORMATION_NOTES[t.formation]}`}>
        <div className="two">
          <Pitch team={t} />
          <div className="plist">{t.xi.map((p) => <PlayerCard key={p.id} p={p} compact />)}</div>
        </div>
        {t.xi.some((p) => p.verify) && <Note tone="warn">{tr('Hay nombres de esta alineación pendientes de verificar (marcados en la ficha del jugador).')}</Note>}
      </Section>

      <Section title={tr('Plantel de 23')} sub={tr('Once titulares más 12 suplentes. Los suplentes pueden entrar desde el minuto 60 en los partidos simulados.')}>
        <h4 className="sub">{tr('Titulares')}</h4>
        <div className="plist">{t.xi.map((p) => <PlayerCard key={p.id} p={p} compact />)}</div>
        <h4 className="sub">{tr('Suplentes')}</h4>
        <div className="plist">{t.bench.map((p) => <PlayerCard key={p.id} p={p} compact />)}</div>
        {t.squad.some((p) => p.verify) && <Note tone="warn">{tr('Hay nombres del plantel pendientes de verificar (marcados en la ficha del jugador).')}</Note>}
      </Section>

      <Section title={tr('Perfil del modelo')} sub={tr('Estimaciones; ranking entre las 32 selecciones.')}>
        {comps.map(([l, k]) => (
          <Bar key={k} label={l} v={prof[k] as number} min={65} right={`${(prof[k] as number).toFixed(1)} · #${rankOf(all.map((a) => a[k] as number), prof[k] as number)}`} />
        ))}
        <p className="small"><b>{tr('Fortalezas:')}</b> {blurb.strong.join(tr(' y '))}. <b>{tr('Punto más débil:')}</b> {blurb.weak.join(', ')}. {tr('Figura: {n}.', { n: blurb.star.name })}</p>
      </Section>

      <Section title={tr('Resultados')}>
        <div className="list">{matches.map((m) => <MatchRow key={m.id} m={m} />)}{koMatches.map((m) => <KoRow key={m.id} m={m} />)}</div>
        <p className="small muted">{tr('Fase de grupos: {w} G · {d} E · {l} P · {gf} GF · {ga} GC.', { w: ts.w, d: ts.d, l: ts.l, gf: ts.gf, ga: ts.ga })}{koMatches.length > 0 && tr(' Total con eliminatorias: {pj} PJ · {w} G · {d} E · {l} P · {gf} GF · {ga} GC (los penales cuentan como empate).', { pj: tsKo.pj, w: tsKo.w, d: tsKo.d, l: tsKo.l, gf: tsKo.gf, ga: tsKo.ga })}</p>
        {decl.length > 0 && <p className="small">{tr('Goleadores:')} {decl.filter((d) => d.goals).map((d) => `${PLAYER_BY_ID[d.playerId].name} (${d.goals})`).join(', ') || '—'}.</p>}
      </Section>

      <Section title={status.next ? tr('Próximo enfrentamiento') : tr('Camino en el mundial')}>
        {status.next
          ? <div className="kmini one"><span><Flag id={id} size={22} />{t.name}</span><i>vs</i><span><TeamLink id={status.next.opp} size={22} /></span><small className="muted">{status.next.ronda} · {tr('sin jugar')}</small></div>
          : <p className="muted">{status.text || tr('Sin partidos pendientes.')}</p>}
        {status.next && <p className="small muted">{tr('Se juega cuando avances en')} <a href="#/cuadro">{tr('Eliminatorias')}</a>.</p>}
      </Section>
    </>
  )
}

export function PlayerPage({ id }: { id: string }) {
  const p = PLAYER_BY_ID[id]
  if (!p) return <Note tone="warn">{tr('Jugador no encontrado.')}</Note>
  const t = TEAM_BY_ID[p.teamId]
  const photo = usePhoto(p)
  const level = useStoryLevel()
  const stat = storyPlayerStats(level).find((s) => s.playerId === id)
  const peers = PLAYERS.filter((x) => x.pos === p.pos && x.id !== p.id).sort((a, b) => Math.abs(a.ovr - p.ovr) - Math.abs(b.ovr - p.ovr)).slice(0, 5)
  return (
    <>
      <div className="phead">
        <FutCard p={p} size="lg" />
        <div>
          <h1>{p.name}</h1>
          <p><TeamLink id={p.teamId} /> · <span className="pos">{posLabel(p.pos)}</span> · {t.formation}</p>
          <p className="ovr big">{p.ovr}<small>{tr('valoración del modelo')}</small></p>
        </div>
      </div>
      {photo && <p className="credit">{tr('Foto:')} <a href={photo.page} target="_blank" rel="noreferrer">{photo.title}</a>{photo.author ? ` · ${photo.author}` : ''} · {photo.license} · Wikimedia.</p>}
      {p.verify && <Note tone="warn">{tr('Este nombre figura en el once original pero conviene verificarlo; no se garantiza foto ni trayectoria.')}</Note>}

      <Section title={tr('Atributos')} sub={tr('Estimaciones del modelo, no calificaciones oficiales.')}>
        <div className="two">
          <Radar attrs={p.attrs} />
          <div>{p.attrs.map((a) => <Bar key={a.k} label={attrLabel(a.k)} v={a.v} min={40} />)}</div>
        </div>
      </Section>

      <Section title={tr('En el torneo')}>
        <div className="statrow">
          <div><b>{stat?.goals ?? 0}</b><span>{tr('Goles')}{stat && !stat.goals ? '' : tr(' (declarados)')}</span></div>
          <div><b>{stat?.assists ?? 0}</b><span>{tr('Asistencias (estimadas)')}</span></div>
        </div>
        <Note tone="est">{tr('La simulación original no registró autores por partido: los goles son los declarados y las asistencias, una estimación provisional.')}</Note>
      </Section>

      <Section title={tr('Biografía y trayectoria')}>
        <p className="muted">{tr('Ficha biográfica aún no redactada en esta primera versión. Está preparada para sumarse sin cambiar la estructura.')}</p>
      </Section>

      <Section title={tr('Compara con otras leyendas')} sub={tr('Otros {p} con valoración cercana', { p: posLabel(p.pos) })}>
        <div className="plist">{peers.map((x) => <a key={x.id} href={`#/comparar/${p.id}/${x.id}`} className="pcard compact"><Avatar p={x} size={44} /><div className="pc-body"><span className="pc-name">{x.name}</span><span className="pc-sub">{TEAM_BY_ID[x.teamId].name}</span></div><span className="ovr">{x.ovr}</span></a>)}</div>
      </Section>
    </>
  )
}

export function Players() {
  const [q, setQ] = useState('')
  const [pos, setPos] = useState('')
  const list = PLAYERS.filter((p) => (!pos || p.line === pos) && (p.name.toLowerCase().includes(q.toLowerCase()) || TEAM_BY_ID[p.teamId].name.toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => b.ovr - a.ovr).slice(0, 60)
  return (
    <Section title={tr('Jugadores')} sub={tr('352 leyendas. Busca por nombre o país y compara a dos.')}>
      <div className="filters">
        <input type="search" placeholder={tr('Buscar jugador o país…')} value={q} onChange={(e) => setQ(e.target.value)} aria-label={tr('Buscar jugador')} />
        <select value={pos} onChange={(e) => setPos(e.target.value)} aria-label={tr('Filtrar por línea')}>
          <option value="">{tr('Todas las líneas')}</option><option value="GK">{tr('Porteros')}</option><option value="DEF">{tr('Defensas')}</option><option value="MID">{tr('Mediocampistas')}</option><option value="ATT">{tr('Atacantes')}</option>
        </select>
        <a className="btn" href="#/comparar">{tr('Comparar jugadores')}</a>
      </div>
      <div className="grid futgrid">{list.map((p) => <FutCard key={p.id} p={p} />)}</div>
      {list.length === 60 && <p className="muted small">{tr('Mostrando los 60 mejor valorados de la búsqueda.')}</p>}
    </Section>
  )
}

function PlayerSelect({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  const sorted = useMemo(() => [...PLAYERS].sort((a, b) => a.name.localeCompare(b.name)), [])
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} aria-label={label}>
      {sorted.map((p) => <option key={p.id} value={p.id}>{p.name} · {TEAM_BY_ID[p.teamId].name}</option>)}
    </select>
  )
}

export function Compare({ a: ia, b: ib }: { a?: string; b?: string }) {
  const [a, setA] = useState(ia ?? 'arg-lionel-messi')
  const [b, setB] = useState(ib ?? 'bra-pele')
  const A = PLAYER_BY_ID[a], B = PLAYER_BY_ID[b]
  const same = A.line === 'GK' && B.line === 'GK' || (A.line !== 'GK' && B.line !== 'GK')
  return (
    <Section title={tr('Comparar jugadores')} sub={tr('Atributos estimados por el modelo.')}>
      <div className="filters"><PlayerSelect value={a} onChange={(v) => { setA(v); go(`/comparar/${v}/${b}`) }} label={tr('Jugador A')} /><PlayerSelect value={b} onChange={(v) => { setB(v); go(`/comparar/${a}/${v}`) }} label={tr('Jugador B')} /></div>
      <div className="vs">
        {[A, B].map((p: Player, i) => (
          <a key={p.id} href={`#/jugador/${p.id}`} className={`vsp ${i ? 'b' : 'a'}`}><Avatar p={p} size={84} rounded={false} /><b>{p.name}</b><span>{TEAM_BY_ID[p.teamId].name} · {posLabel(p.pos)}</span><em>{p.ovr}</em></a>
        ))}
      </div>
      {same ? (
        <div className="two">
          <Radar attrs={A.attrs} attrs2={B.attrs} />
          <div>
            {A.attrs.map((x, i) => (
              <div key={x.k} className="cmp"><b className={x.v >= B.attrs[i].v ? 'win' : ''}>{x.v}</b><span>{attrLabel(x.k)}</span><b className={B.attrs[i].v >= x.v ? 'win' : ''}>{B.attrs[i].v}</b></div>
            ))}
          </div>
        </div>
      ) : <Note>{tr('Un portero y un jugador de campo no comparten atributos directos; se comparan solo por valoración general.')}</Note>}
    </Section>
  )
}
