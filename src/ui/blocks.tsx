import { Flag, TeamLink } from './common'
import { tr } from '../i18n'
import { PLAYER_BY_ID, TEAM_BY_ID } from '../data/lookup'
import type { Goal, KoMatch, Match, TableRow } from '../types'

export function MatchRow({ m, showGroup = true }: { m: Match; showGroup?: boolean }) {
  const t = TEAM_BY_ID
  return (
    <a className="mrow" href={`#/partido/${m.id}`}>
      <span className="mr-t r">{t[m.home].name}<Flag id={m.home} size={22} /></span>
      <span className="mr-s"><b className={m.hg > m.ag ? 'w' : ''}>{m.hg}</b><i>–</i><b className={m.ag > m.hg ? 'w' : ''}>{m.ag}</b></span>
      <span className="mr-t"><Flag id={m.away} size={22} />{t[m.away].name}</span>
      {showGroup && <span className="mr-g">{tr('Gr. {g} · F{f}', { g: m.group, f: m.matchday })}</span>}
    </a>
  )
}

export function KoRow({ m }: { m: KoMatch }) {
  const t = TEAM_BY_ID
  return (
    <a className="mrow" href={`#/partido/${m.id}`}>
      <span className="mr-t r">{t[m.a!].name}<Flag id={m.a!} size={22} /></span>
      <span className="mr-s"><b className={m.winner === m.a ? 'w' : ''}>{m.ga}</b><i>–</i><b className={m.winner === m.b ? 'w' : ''}>{m.gb}</b></span>
      <span className="mr-t"><Flag id={m.b!} size={22} />{t[m.b!].name}</span>
      <span className="mr-g">{m.round === 'r16' ? tr('Octavos') : m.round === 'qf' ? tr('Cuartos') : m.round === 'sf' ? tr('Semifinal') : m.round === 'third' ? tr('Tercer puesto') : tr('Final')}{m.pens ? tr(' · pen. {a}–{b}', { a: m.pens[0], b: m.pens[1] }) : m.et ? tr(' · prórroga') : ''}</span>
    </a>
  )
}

export function GroupTable({ rows, qualify = true }: { rows: TableRow[]; qualify?: boolean }) {
  return (
    <table className="gt">
      <thead><tr><th>#</th><th className="l">{tr('Selección')}</th><th>{tr('PJ')}</th><th>{tr('G')}</th><th>{tr('E')}</th><th>{tr('P')}</th><th>{tr('GF')}</th><th>{tr('GC')}</th><th>{tr('DG')}</th><th>{tr('Pts')}</th></tr></thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={r.teamId} className={qualify && i < 2 ? 'q' : ''}>
            <td>{i + 1}</td>
            <td className="l"><TeamLink id={r.teamId} size={20} /></td>
            <td>{r.p}</td><td>{r.w}</td><td>{r.d}</td><td>{r.l}</td><td>{r.gf}</td><td>{r.ga}</td>
            <td>{r.gd > 0 ? '+' : ''}{r.gd}</td><td><b>{r.pts}</b></td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export function Events({ goals, home, away }: { goals: Goal[]; home: string; away: string }) {
  if (!goals.length) return <p className="muted small">{tr('Sin goles.')}</p>
  return (
    <ul className="events">
      {goals.map((g, i) => {
        const p = PLAYER_BY_ID[g.scorerId], a = g.assistId ? PLAYER_BY_ID[g.assistId] : undefined
        return (
          <li key={i} className={g.teamId === home ? 'h' : g.teamId === away ? 'a' : ''}>
            <span className="min">{g.minute}'{g.phase === 'et' ? tr(' (pr.)') : ''}</span>
            <span>⚽ <a href={`#/jugador/${p.id}`}>{p.name}</a> <span className="muted">({TEAM_BY_ID[g.teamId].name})</span>
              {a && <span className="muted">{tr(' · asist. {n}', { n: a.name })}</span>}</span>
          </li>
        )
      })}
    </ul>
  )
}

import { CtxLine } from './world'

export function KoCard({ m, label, entra }: { m: KoMatch; label?: string; entra?: string[] }) {
  const played = m.winner !== undefined
  const side = (id: string | undefined, g: number | undefined, win: boolean) => (
    <div className={`kside ${win ? 'win' : played && id ? 'lose' : ''} ${id && entra?.includes(id) ? 'llega' : ''}`}>
      {id && entra?.includes(id) && <span className="ghost-pd">{tr('Por definir')}</span>}
      {id ? <><Flag id={id} size={22} /><span className="kn">{TEAM_BY_ID[id].name}</span></> : <span className="kn muted">{tr('Por definir')}</span>}
      <b>{played ? g : ''}</b>
    </div>
  )
  return (
    <div className="kcard">
      {label && <span className="klabel">{label}</span>}
      {side(m.a, m.ga, played && !!m.a && m.winner === m.a)}
      {side(m.b, m.gb, played && !!m.b && m.winner === m.b)}
      {played && m.ctx && <CtxLine ctx={m.ctx} />}
      {played && (m.et || m.pens) && <span className="kfoot">{m.pens ? tr('Penales {a}–{b}', { a: m.pens[0], b: m.pens[1] }) : tr('Prórroga')}</span>}
      {played && m.goals && m.goals.length > 0 && m.a && m.b && (
        <details><summary>{tr('Goles')}</summary><Events goals={m.goals} home={m.a} away={m.b} /></details>
      )}
    </div>
  )
}
