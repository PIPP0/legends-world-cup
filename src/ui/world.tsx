import { HOST_BY_ID, HOST_OF_VENUE, MONTHS, SEASONS, VENUE_BY_ID } from '../data/world'
import { PLAYER_BY_ID, TEAM_BY_ID } from '../data/lookup'
import { Flag, Section } from './common'
import type { AltTournament, MatchCtx } from '../types'

export function CtxLine({ ctx }: { ctx?: MatchCtx }) {
  if (!ctx) return null
  const v = VENUE_BY_ID[ctx.venueId]
  return (
    <span className="ctx" title={`${v.name}, ${v.city} · ${v.alt} m`}>
      🏟 {v.name} · {ctx.roof ? 'techado' : `${Math.round(ctx.temp)} °C${ctx.rain > 0 ? (ctx.rain > 0.66 ? ' · lluvia fuerte' : ' · lluvia') : ''}`}
    </span>
  )
}

export const newSeed = () => 'mundo-' + Math.random().toString(36).slice(2, 7)

export function WorldSummary({ alt }: { alt: AltTournament }) {
  const w = alt.world
  if (!w) return null
  const h = HOST_BY_ID[w.hostId]
  return (
    <p className="small muted">
      Mundial en <b>{h.name}</b> · {w.month ? MONTHS[w.month - 1] : SEASONS[w.season]}{w.climate && w.climate !== 'normal' ? ` (${w.climate === 'calor' ? 'ola de calor' : w.climate === 'lluvia' ? 'año lluvioso' : 'año frío'})` : ''}{w.primes?.length ? ` · en su prime: ${w.primes.filter((id) => PLAYER_BY_ID[id]).map((id) => PLAYER_BY_ID[id].name).join(', ')}` : ''} · final en {VENUE_BY_ID[w.finalVenue].name}{` · semilla «${alt.seed}»`}{w.receipt ? ` · comprobante simulado ${w.receipt}` : ''}.
    </p>
  )
}

export function GroupResults({ alt }: { alt: AltTournament }) {
  if (alt.mode !== 'completo') return null
  return (
    <Section title="Fase de grupos" sub="Resultados simulados con sede y clima de cada partido.">
      <ul className="glist">
        {alt.groupMatches.map((m) => (
          <li key={m.id}><span className="gid">{m.group}</span><span className="gt"><Flag id={m.home} size={18} /> {TEAM_BY_ID[m.home].name}</span><b>{m.hg} – {m.ag}</b><span className="gt r">{TEAM_BY_ID[m.away].name} <Flag id={m.away} size={18} /></span><CtxLine ctx={m.ctx} /></li>
        ))}
      </ul>
    </Section>
  )
}
export { HOST_OF_VENUE }
