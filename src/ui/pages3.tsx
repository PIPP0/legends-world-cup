import { useState } from 'react'
import { GROUPS, STORY_MATCHES, TEAM_BY_ID } from '../data'
import { DEFAULT_PARAMS, probabilities } from '../engine/model'
import { matchStory } from '../engine/narrative'
import { groupTable } from '../engine/standings'
import { Flag, Note, ProbBar, Section, Tabs } from './common'
import { GroupTable, MatchRow } from './blocks'
import { PlayerCard } from './common'

export function Groups() {
  const [md, setMd] = useState<'1' | '2' | '3'>('3')
  return (
    <Section title="Grupos" sub="Clasifican los dos primeros de cada grupo.">
      <Tabs value={md} onChange={setMd} items={[['1', 'Tras fecha 1'], ['2', 'Tras fecha 2'], ['3', 'Final']]} />
      <div className="grid g2">
        {GROUPS.map((g) => (
          <div key={g} className="gbox">
            <h3>Grupo {g}</h3>
            <GroupTable rows={groupTable(g, STORY_MATCHES, Number(md))} qualify={md === '3'} />
            <div className="list">{STORY_MATCHES.filter((m) => m.group === g && m.matchday <= Number(md)).map((m) => <MatchRow key={m.id} m={m} showGroup={false} />)}</div>
          </div>
        ))}
      </div>
    </Section>
  )
}

export function Matches() {
  const [g, setG] = useState('')
  const [md, setMd] = useState('')
  const list = STORY_MATCHES.filter((m) => (!g || m.group === g) && (!md || m.matchday === Number(md)))
  return (
    <Section title="Partidos" sub="Los 48 resultados de la fase de grupos.">
      <div className="filters">
        <select value={g} onChange={(e) => setG(e.target.value)} aria-label="Grupo"><option value="">Todos los grupos</option>{GROUPS.map((x) => <option key={x} value={x}>Grupo {x}</option>)}</select>
        <select value={md} onChange={(e) => setMd(e.target.value)} aria-label="Fecha"><option value="">Todas las fechas</option><option value="1">Fecha 1</option><option value="2">Fecha 2</option><option value="3">Fecha 3</option></select>
      </div>
      <div className="list">{list.map((m) => <MatchRow key={m.id} m={m} />)}</div>
    </Section>
  )
}

export function MatchPage({ id }: { id: string }) {
  const idx = STORY_MATCHES.findIndex((m) => m.id === id)
  if (idx < 0) return <Note tone="warn">Partido no encontrado.</Note>
  const m = STORY_MATCHES[idx]
  const H = TEAM_BY_ID[m.home], A = TEAM_BY_ID[m.away]
  const s = matchStory(m)
  const pr = probabilities(m.home, m.away, DEFAULT_PARAMS)
  const prev = STORY_MATCHES[idx - 1], next = STORY_MATCHES[idx + 1]
  return (
    <>
      <div className="mhead">
        <span className="muted">Grupo {m.group} · Fecha {m.matchday}</span>
        <div className="mh">
          <a href={`#/equipo/${H.id}`}><Flag id={H.id} size={56} /><b>{H.name}</b></a>
          <div className="mscore">{m.hg}<i>–</i>{m.ag}</div>
          <a href={`#/equipo/${A.id}`}><Flag id={A.id} size={56} /><b>{A.name}</b></a>
        </div>
        <span className="chip">Resultado de la historia original</span>
      </div>

      <Section title="Contexto previo"><p>{s.previa}</p><ProbBar a={m.home} b={m.away} pa={pr.win} pd={pr.draw} pb={pr.loss} /><p className="small muted">Probabilidades del modelo antes del partido (goles esperados {pr.expA.toFixed(2)} – {pr.expB.toFixed(2)}).</p></Section>
      <Section title="Crónica"><p>{s.cronica}</p>{s.doc && <p className="small muted">Texto narrativo del proyecto original.</p>}</Section>
      <Section title="Goleadores y eventos"><Note tone="est">{s.datos}</Note></Section>
      <Section title="Análisis táctico"><p>{s.tactico}</p></Section>
      <Section title="Figura del partido"><p className="muted">{s.figura}</p></Section>
      <Section title="Impacto en la clasificación">
        <ul className="rules">{s.consecuencias.map((c, i) => <li key={i}>{c}</li>)}</ul>
        <GroupTable rows={groupTable(m.group, STORY_MATCHES, m.matchday)} qualify={m.matchday === 3} />
      </Section>
      <Section title="Los onces">
        <div className="two">
          <div className="plist">{H.xi.map((p) => <PlayerCard key={p.id} p={p} compact />)}</div>
          <div className="plist">{A.xi.map((p) => <PlayerCard key={p.id} p={p} compact />)}</div>
        </div>
      </Section>
      <nav className="pager">
        {prev ? <a href={`#/partido/${prev.id}`}>← {TEAM_BY_ID[prev.home].name} vs {TEAM_BY_ID[prev.away].name}</a> : <span />}
        {next ? <a href={`#/partido/${next.id}`}>{TEAM_BY_ID[next.home].name} vs {TEAM_BY_ID[next.away].name} →</a> : <span />}
      </nav>
    </>
  )
}
