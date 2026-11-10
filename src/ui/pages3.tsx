import { tr } from '../i18n'
import { useState } from 'react'
import { GROUPS, STORY_MATCHES, TEAM_BY_ID } from '../data'
import { useStoryLevel } from '../engine/storyLevel'
import { RONDAS, isRevealed, koById, revealed } from '../engine/historia'
import { DEFAULT_PARAMS, probabilities } from '../engine/model'
import { matchStory } from '../engine/narrative'
import { groupTable } from '../engine/standings'
import { Flag, Note, ProbBar, Section, Tabs } from './common'
import { Events, GroupTable, KoRow, MatchRow } from './blocks'
import { PlayerCard } from './common'

export function Groups() {
  const [md, setMd] = useState<'1' | '2' | '3'>('3')
  return (
    <Section title={tr('Grupos')} sub={tr('Clasifican los dos primeros de cada grupo.')}>
      <Tabs value={md} onChange={setMd} items={[['1', tr('Tras fecha 1')], ['2', tr('Tras fecha 2')], ['3', tr('Final')]]} />
      <div className="grid g2">
        {GROUPS.map((g) => (
          <div key={g} className="gbox">
            <h3>{tr('Grupo')} {g}</h3>
            <GroupTable rows={groupTable(g, STORY_MATCHES, Number(md))} qualify={md === '3'} />
            <div className="list">{STORY_MATCHES.filter((m) => m.group === g && m.matchday <= Number(md)).map((m) => <MatchRow key={m.id} m={m} showGroup={false} />)}</div>
          </div>
        ))}
      </div>
    </Section>
  )
}

export function Matches() {
  const level = useStoryLevel()
  const ko = revealed(level)
  const [g, setG] = useState('')
  const [md, setMd] = useState('')
  const list = STORY_MATCHES.filter((m) => (!g || m.group === g) && (!md || m.matchday === Number(md)))
  return (
    <Section title={tr('Partidos')} sub={tr('Los 48 resultados de la fase de grupos.')}>
      <div className="filters">
        <select value={g} onChange={(e) => setG(e.target.value)} aria-label={tr('Grupo')}><option value="">{tr('Todos los grupos')}</option>{GROUPS.map((x) => <option key={x} value={x}>{tr('Grupo')} {x}</option>)}</select>
        <select value={md} onChange={(e) => setMd(e.target.value)} aria-label={tr('Fecha')}><option value="">{tr('Todas las fechas')}</option><option value="1">{tr('Fecha {n}', { n: 1 })}</option><option value="2">{tr('Fecha {n}', { n: 2 })}</option><option value="3">{tr('Fecha {n}', { n: 3 })}</option></select>
      </div>
      <div className="list">{list.map((m) => <MatchRow key={m.id} m={m} />)}</div>
      {ko.length > 0 && !g && !md && (
        <>
          <h3 className="sub">{tr('Eliminatorias')}</h3>
          <div className="list">{ko.map((m) => <KoRow key={m.id} m={m} />)}</div>
        </>
      )}
      {level < 4 && !g && !md && <p className="small muted">{tr('Las eliminatorias aparecen aquí a medida que avanzas en')} <a href="#/cuadro">{tr('Eliminatorias')}</a>.</p>}
    </Section>
  )
}

const KO_ID = /^(O[1-8]|C[1-4]|S[12]|T|F)$/
function KoMatchPage({ id }: { id: string }) {
  const level = useStoryLevel()
  const k = koById(id)
  if (!k) return <Note tone="warn">{tr('Partido no encontrado.')}</Note>
  if (!isRevealed(id, level)) return <Note>{tr('Este partido todavía no se juega en tu historia. Avanza de fase en')} <a href="#/cuadro">{tr('Eliminatorias')}</a>{tr(' para verlo.')}</Note>
  const m = k.m
  const A = TEAM_BY_ID[m.a!], B = TEAM_BY_ID[m.b!]
  const win = TEAM_BY_ID[m.winner!]
  const pr = probabilities(m.a!, m.b!, DEFAULT_PARAMS)
  return (
    <>
      <div className="mhead">
        <span className="muted">{RONDAS[k.ronda].nombre}{m.id === 'F' ? tr(' · Gran final') : m.id === 'T' ? tr(' · Tercer puesto') : ''}</span>
        <div className="mh">
          <a href={`#/equipo/${A.id}`}><Flag id={A.id} size={56} /><b>{A.name}</b></a>
          <div className="mscore">{m.ga}<i>–</i>{m.gb}</div>
          <a href={`#/equipo/${B.id}`}><Flag id={B.id} size={56} /><b>{B.name}</b></a>
        </div>
        {m.pens && <p className="center muted">{tr('Empate {a}–{b}. Penales {c}–{d}.', { a: m.ga!, b: m.gb!, c: m.pens[0], d: m.pens[1] })}</p>}
        {m.et && !m.pens && <p className="center muted">{tr('Definido en la prórroga.')}</p>}
        <p className="center">{m.round === 'third' ? tr('Tercer lugar') : m.round === 'final' ? tr('Campeón') : tr('Avanza')}: <b>{win.name}</b></p>
        <span className="chip">{tr('Resultado de la historia original (igual para todas las personas)')}</span>
      </div>
      <Section title={tr('Antes del partido')}><ProbBar a={m.a!} b={m.b!} pa={pr.win} pd={pr.draw} pb={pr.loss} /><p className="small muted">{tr('Probabilidades del modelo en 90 minutos (goles esperados {a} – {b}).', { a: pr.expA.toFixed(2), b: pr.expB.toFixed(2) })}</p></Section>
      <Section title={tr('Goles y eventos')}><Events goals={m.goals ?? []} home={m.a!} away={m.b!} /></Section>
      <Section title={tr('Los onces')}>
        <div className="two">
          <div className="plist">{A.xi.map((p) => <PlayerCard key={p.id} p={p} compact />)}</div>
          <div className="plist">{B.xi.map((p) => <PlayerCard key={p.id} p={p} compact />)}</div>
        </div>
      </Section>
      <p><a className="btn" href="#/cuadro">{tr('Ver el cuadro')}</a></p>
    </>
  )
}

export function MatchPage({ id }: { id: string }) {
  if (KO_ID.test(id)) return <KoMatchPage id={id} />
  const idx = STORY_MATCHES.findIndex((m) => m.id === id)
  if (idx < 0) return <Note tone="warn">{tr('Partido no encontrado.')}</Note>
  const m = STORY_MATCHES[idx]
  const H = TEAM_BY_ID[m.home], A = TEAM_BY_ID[m.away]
  const s = matchStory(m)
  const pr = probabilities(m.home, m.away, DEFAULT_PARAMS)
  const prev = STORY_MATCHES[idx - 1], next = STORY_MATCHES[idx + 1]
  return (
    <>
      <div className="mhead">
        <span className="muted">{tr('Grupo {g} · Fecha {f}', { g: m.group, f: m.matchday })}</span>
        <div className="mh">
          <a href={`#/equipo/${H.id}`}><Flag id={H.id} size={56} /><b>{H.name}</b></a>
          <div className="mscore">{m.hg}<i>–</i>{m.ag}</div>
          <a href={`#/equipo/${A.id}`}><Flag id={A.id} size={56} /><b>{A.name}</b></a>
        </div>
        <span className="chip">{tr('Resultado de la historia original')}</span>
      </div>

      <Section title={tr('Contexto previo')}><p>{s.previa}</p><ProbBar a={m.home} b={m.away} pa={pr.win} pd={pr.draw} pb={pr.loss} /><p className="small muted">{tr('Probabilidades del modelo antes del partido (goles esperados {a} – {b}).', { a: pr.expA.toFixed(2), b: pr.expB.toFixed(2) })}</p></Section>
      <Section title={tr('Crónica')}><p>{s.cronica}</p>{s.doc && <p className="small muted">{tr('Texto narrativo del proyecto original.')}</p>}</Section>
      <Section title={tr('Goleadores y eventos')}><Note tone="est">{s.datos}</Note></Section>
      <Section title={tr('Análisis táctico')}><p>{s.tactico}</p></Section>
      <Section title={tr('Figura del partido')}><p className="muted">{s.figura}</p></Section>
      <Section title={tr('Impacto en la clasificación')}>
        <ul className="rules">{s.consecuencias.map((c, i) => <li key={i}>{c}</li>)}</ul>
        <GroupTable rows={groupTable(m.group, STORY_MATCHES, m.matchday)} qualify={m.matchday === 3} />
      </Section>
      <Section title={tr('Los onces')}>
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
