import { useMemo, useState } from 'react'
import { GROUPS, PLAYERS, STORY_MATCHES, TEAMS, FORMATION_NOTES } from '../data'
import { DECLARED_R16 } from '../data/raw'
import { DEFAULT_PARAMS, profile, strengthRank } from '../engine/model'
import { declaredStats, teamStats } from '../engine/stats'
import { teamBlurb } from '../engine/narrative'
import { groupTable } from '../engine/standings'
import { Avatar, Bar, Flag, Note, PlayerCard, Radar, Section, TeamLink, usePhoto, go } from './common'
import { FutCard, Pitch, TeamCard } from './visual'
import { MatchRow } from './blocks'
import { PLAYER_BY_ID, TEAM_BY_ID } from '../data/lookup'
import type { Player } from '../types'

const rankOf = (vals: number[], v: number) => vals.filter((x) => x > v).length + 1

export function Teams() {
  const [q, setQ] = useState('')
  const [g, setG] = useState('')
  const rank = useMemo(() => strengthRank(DEFAULT_PARAMS).map((p) => p.teamId), [])
  const list = TEAMS.filter((t) => (!g || t.group === g) && t.name.toLowerCase().includes(q.toLowerCase()))
  return (
    <Section title="Selecciones" sub="32 equipos históricos. Toca uno para ver su once.">
      <div className="filters">
        <input type="search" placeholder="Buscar selección…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar selección" />
        <select value={g} onChange={(e) => setG(e.target.value)} aria-label="Filtrar por grupo">
          <option value="">Todos los grupos</option>{GROUPS.map((x) => <option key={x} value={x}>Grupo {x}</option>)}
        </select>
      </div>
      <div className="grid g4">
        {list.map((t) => {
          const star = [...t.xi].sort((a, b) => b.ovr - a.ovr)[0]
          return (
            <TeamCard key={t.id} t={t} star={star} extra={<small>Gr. {t.group} · {t.formation} · #{rank.indexOf(t.id) + 1} del modelo</small>} />
          )
        })}
      </div>
    </Section>
  )
}

export function Team({ id }: { id: string }) {
  const t = TEAM_BY_ID[id]
  if (!t) return <Note tone="warn">Selección no encontrada.</Note>
  const prof = profile(id, DEFAULT_PARAMS)
  const all = TEAMS.map((x) => profile(x.id, DEFAULT_PARAMS))
  const blurb = teamBlurb(t)
  const matches = STORY_MATCHES.filter((m) => m.home === id || m.away === id)
  const ts = teamStats(STORY_MATCHES).find((x) => x.teamId === id)!
  const row = groupTable(t.group, STORY_MATCHES)
  const pos = row.findIndex((r) => r.teamId === id) + 1
  const r16 = DECLARED_R16.find((p) => p.includes(id))
  const next = r16 ? (r16[0] === id ? r16[1] : r16[0]) : null
  const comps: [string, keyof typeof prof][] = [['Calidad individual', 'quality'], ['Equilibrio táctico', 'balance'], ['Capacidad ofensiva', 'attack'], ['Solidez defensiva', 'defense'], ['Experiencia (proxy)', 'experience']]
  const decl = declaredStats().filter((s) => PLAYER_BY_ID[s.playerId].teamId === id)
  return (
    <>
      <div className="thead">
        <Flag id={id} size={64} />
        <div>
          <h1>{t.name}</h1>
          <p className="muted">Grupo {t.group} · {t.formation} · {pos}.º del grupo · #{rankOf(all.map((a) => a.strength), prof.strength)} de 32 en el modelo</p>
        </div>
      </div>

      <Section title="Alineación histórica" sub={`${t.formation}: ${FORMATION_NOTES[t.formation]}`}>
        <div className="two">
          <Pitch team={t} />
          <div className="plist">{t.xi.map((p) => <PlayerCard key={p.id} p={p} compact />)}</div>
        </div>
        {t.xi.some((p) => p.verify) && <Note tone="warn">Hay nombres de esta alineación pendientes de verificar (marcados en la ficha del jugador).</Note>}
      </Section>

      <Section title="Perfil del modelo" sub="Estimaciones; ranking entre las 32 selecciones.">
        {comps.map(([l, k]) => (
          <Bar key={k} label={l} v={prof[k] as number} min={65} right={`${(prof[k] as number).toFixed(1)} · #${rankOf(all.map((a) => a[k] as number), prof[k] as number)}`} />
        ))}
        <p className="small"><b>Fortalezas:</b> {blurb.strong.join(' y ')}. <b>Punto más débil:</b> {blurb.weak.join(', ')}. Figura: {blurb.star.name}.</p>
      </Section>

      <Section title="Resultados">
        <div className="list">{matches.map((m) => <MatchRow key={m.id} m={m} />)}</div>
        <p className="small muted">Fase de grupos: {ts.w} G · {ts.d} E · {ts.l} P · {ts.gf} GF · {ts.ga} GC.</p>
        {decl.length > 0 && <p className="small">Goleadores declarados: {decl.filter((d) => d.goals).map((d) => `${PLAYER_BY_ID[d.playerId].name} (${d.goals})`).join(', ') || '—'}.</p>}
      </Section>

      <Section title="Próximo enfrentamiento">
        {next ? <div className="kmini one"><span><Flag id={id} size={22} />{t.name}</span><i>vs</i><span><TeamLink id={next} size={22} /></span><small className="muted">Octavos de final · sin jugar</small></div> : <p className="muted">Eliminada en la fase de grupos.</p>}
      </Section>
    </>
  )
}

export function PlayerPage({ id }: { id: string }) {
  const p = PLAYER_BY_ID[id]
  if (!p) return <Note tone="warn">Jugador no encontrado.</Note>
  const t = TEAM_BY_ID[p.teamId]
  const photo = usePhoto(p)
  const stat = declaredStats().find((s) => s.playerId === id)
  const peers = PLAYERS.filter((x) => x.pos === p.pos && x.id !== p.id).sort((a, b) => Math.abs(a.ovr - p.ovr) - Math.abs(b.ovr - p.ovr)).slice(0, 5)
  return (
    <>
      <div className="phead">
        <FutCard p={p} size="lg" />
        <div>
          <h1>{p.name}</h1>
          <p><TeamLink id={p.teamId} /> · <span className="pos">{p.pos}</span> · {t.formation}</p>
          <p className="ovr big">{p.ovr}<small>valoración del modelo</small></p>
        </div>
      </div>
      {photo && <p className="credit">Foto: <a href={photo.page} target="_blank" rel="noreferrer">{photo.title}</a> · Wikipedia/Wikimedia Commons, licencia libre.</p>}
      {p.verify && <Note tone="warn">Este nombre figura en el once original pero conviene verificarlo; no se garantiza foto ni trayectoria.</Note>}

      <Section title="Atributos" sub="Estimaciones del modelo, no calificaciones oficiales.">
        <div className="two">
          <Radar attrs={p.attrs} />
          <div>{p.attrs.map((a) => <Bar key={a.k} label={a.k} v={a.v} min={40} />)}</div>
        </div>
      </Section>

      <Section title="En el torneo">
        <div className="statrow">
          <div><b>{stat?.goals ?? 0}</b><span>Goles{stat && !stat.goals ? '' : ' (declarados)'}</span></div>
          <div><b>{stat?.assists ?? 0}</b><span>Asistencias (estimadas)</span></div>
        </div>
        <Note tone="est">La simulación original no registró autores por partido: los goles son los declarados y las asistencias, una estimación provisional.</Note>
      </Section>

      <Section title="Biografía y trayectoria">
        <p className="muted">Ficha biográfica aún no redactada en esta primera versión. Está preparada para sumarse sin cambiar la estructura.</p>
      </Section>

      <Section title="Compara con otras leyendas" sub={`Otros ${p.pos} con valoración cercana`}>
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
    <Section title="Jugadores" sub="352 leyendas. Busca por nombre o país y compara a dos.">
      <div className="filters">
        <input type="search" placeholder="Buscar jugador o país…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar jugador" />
        <select value={pos} onChange={(e) => setPos(e.target.value)} aria-label="Filtrar por línea">
          <option value="">Todas las líneas</option><option value="GK">Porteros</option><option value="DEF">Defensas</option><option value="MID">Mediocampistas</option><option value="ATT">Atacantes</option>
        </select>
        <a className="btn" href="#/comparar">Comparar jugadores</a>
      </div>
      <div className="grid futgrid">{list.map((p) => <FutCard key={p.id} p={p} />)}</div>
      {list.length === 60 && <p className="muted small">Mostrando los 60 mejor valorados de la búsqueda.</p>}
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
    <Section title="Comparar jugadores" sub="Atributos estimados por el modelo.">
      <div className="filters"><PlayerSelect value={a} onChange={(v) => { setA(v); go(`/comparar/${v}/${b}`) }} label="Jugador A" /><PlayerSelect value={b} onChange={(v) => { setB(v); go(`/comparar/${a}/${v}`) }} label="Jugador B" /></div>
      <div className="vs">
        {[A, B].map((p: Player, i) => (
          <a key={p.id} href={`#/jugador/${p.id}`} className={`vsp ${i ? 'b' : 'a'}`}><Avatar p={p} size={84} rounded={false} /><b>{p.name}</b><span>{TEAM_BY_ID[p.teamId].name} · {p.pos}</span><em>{p.ovr}</em></a>
        ))}
      </div>
      {same ? (
        <div className="two">
          <Radar attrs={A.attrs} attrs2={B.attrs} />
          <div>
            {A.attrs.map((x, i) => (
              <div key={x.k} className="cmp"><b className={x.v >= B.attrs[i].v ? 'win' : ''}>{x.v}</b><span>{x.k}</span><b className={B.attrs[i].v >= x.v ? 'win' : ''}>{B.attrs[i].v}</b></div>
            ))}
          </div>
        </div>
      ) : <Note>Un portero y un jugador de campo no comparten atributos directos; se comparan solo por valoración general.</Note>}
    </Section>
  )
}
