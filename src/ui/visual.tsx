import { LANG, tr } from '../i18n'
import { posLabel, attrAbbr } from '../i18n/nombres'
import { useState, type ReactNode } from 'react'
import { TEAM_BY_ID } from '../data/lookup'
import { Flag, usePhoto } from './common'
import type { Player, Team } from '../types'

export const tierOf = (o: number) => (o >= 96 ? 'icon' : o >= 92 ? 'gold' : o >= 86 ? 'silver' : 'base')
const ab = (k: string) => attrAbbr(k)
const initials = (n: string) => n.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase()

// Carta estilo videojuego deportivo
export function FutCard({ p, size = 'md' }: { p: Player; size?: 'sm' | 'md' | 'lg' }) {
  const photo = usePhoto(p)
  const [bad, setBad] = useState(false)
  const t = TEAM_BY_ID[p.teamId]
  const shown = photo && !bad
  return (
    <a className={`fut ${tierOf(p.ovr)} ${size}`} href={`#/jugador/${p.id}`} aria-label={tr('{p}, {t}, valoración {o}', { p: p.name, t: t.name, o: p.ovr })}
      onMouseMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect()
        const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5
        e.currentTarget.style.setProperty('--rx', `${(-y * 12).toFixed(1)}deg`)
        e.currentTarget.style.setProperty('--ry', `${(x * 14).toFixed(1)}deg`)
      }}
      onMouseLeave={(e) => { e.currentTarget.style.setProperty('--rx', '0deg'); e.currentTarget.style.setProperty('--ry', '0deg') }}>
      <div className="fut-l">
        <b className="fo">{p.ovr}</b>
        <span className="fp">{p.pos}</span>
        <img src={`https://flagcdn.com/w40/${t.iso}.png`} alt="" />
      </div>
      <div className="fut-ph">
        {shown ? <img src={photo.url} alt={p.name} loading="lazy" onError={() => setBad(true)} /> : <span className="fut-ini">{initials(p.name)}</span>}
      </div>
      <div className="fut-n">{p.name}</div>
      <div className="fut-s">{p.attrs.slice(0, 3).map((a) => <span key={a.k}><b>{a.v}</b>{ab(a.k)}</span>)}</div>
    </a>
  )
}

// Tarjeta de selección con la bandera como fondo
export function TeamCard({ t, star, extra, mini }: { t: Team; star: Player; extra?: ReactNode; mini?: boolean }) {
  const photo = usePhoto(star)
  return (
    <a className={`team ${mini ? 'mini' : ''}`} href={`#/equipo/${t.id}`} style={{ ['--flag' as string]: `url(https://flagcdn.com/w320/${t.iso}.png)` }}>
      <span className="team-bg" aria-hidden />
      <span className="team-ph">{photo ? <img src={photo.url} alt="" loading="lazy" /> : <i>{initials(star.name)}</i>}</span>
      <span className="team-b">
        <b><Flag id={t.id} size={22} />{t.name}</b>
        <em>{star.name} · {star.ovr}</em>
        {extra}
      </span>
    </a>
  )
}

function Node({ p }: { p: Player }) {
  const photo = usePhoto(p)
  const X = p.x, Y = 8 + (p.y / 100) * 104
  const cid = `cl-${p.id}`
  const nm = p.name.split(' ').slice(-1)[0]
  const w = Math.max(10, nm.length * 2 + 3)
  return (
    <a href={`#/jugador/${p.id}`} className="pn" data-line={p.line}>
      <clipPath id={cid}><circle cx={X} cy={Y} r="5.6" /></clipPath>
      <circle cx={X} cy={Y} r="6.4" className="ring" />
      {photo ? (
        <image href={photo.url} x={X - 5.6} y={Y - 5.6} width="11.2" height="11.2" preserveAspectRatio="xMidYMin slice" clipPath={`url(#${cid})`} />
      ) : (
        <><circle cx={X} cy={Y} r="5.6" className="fill" /><text x={X} y={Y + 1.5} textAnchor="middle" className="pni">{initials(p.name)}</text></>
      )}
      <rect x={X + 2.6} y={Y + 2.6} width="6" height="3.8" rx="1.2" className="badge" />
      <text x={X + 5.6} y={Y + 5.4} textAnchor="middle" className="pnn">{p.ovr}</text>
      <rect x={X - w / 2} y={Y + 6.8} width={w} height="3.8" rx="1.9" className="tag" />
      <text x={X} y={Y + 9.5} textAnchor="middle" className="pnl">{nm}</text>
    </a>
  )
}

export function Pitch({ team }: { team: Team }) {
  return (
    <svg viewBox="0 0 100 118" className="pitch" role="group" aria-label={tr('Alineación de {team}', { team: team.name })}>
      <defs>
        <linearGradient id="grass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#1d4d2b" /><stop offset=".5" stopColor="#16401f" /><stop offset="1" stopColor="#0f3017" /></linearGradient>
        <radialGradient id="spot" cx=".5" cy=".4" r=".7"><stop offset="0" stopColor="rgba(198,255,61,.18)" /><stop offset="1" stopColor="rgba(198,255,61,0)" /></radialGradient>
      </defs>
      <rect width="100" height="118" rx="5" fill="url(#grass)" />
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => <rect key={i} x="0" y={i * 14.75} width="100" height="7.4" fill="rgba(255,255,255,.035)" />)}
      <rect width="100" height="118" rx="5" fill="url(#spot)" />
      <g className="pl">
        <rect x="3" y="3" width="94" height="112" rx="1" />
        <line x1="3" y1="59" x2="97" y2="59" />
        <circle cx="50" cy="59" r="10" /><circle cx="50" cy="59" r=".7" className="dot" />
        <rect x="24" y="3" width="52" height="16" /><rect x="36" y="3" width="28" height="6" />
        <rect x="24" y="99" width="52" height="16" /><rect x="36" y="109" width="28" height="6" />
      </g>
      {team.xi.map((p) => <Node key={p.id} p={p} />)}
    </svg>
  )
}

const I = (d: string) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={d} /></svg>
export const ICONS: Record<string, ReactNode> = {
  home: I('M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z'),
  teams: I('M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z'),
  ball: I('M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm0 5l3.5 2.5-1.3 4h-4.4l-1.3-4zM12 3v5m3.5 2.5L20 9m-5.8 6l2.3 4m-8.7 0l2.3-4M4 9l4.5 1.5'),
  bracket: I('M4 5h5v4H4zM4 15h5v4H4zM15 10h5v4h-5zM9 7h3v10H9m3-5h3'),
  more: I('M5 12h.01M12 12h.01M19 12h.01'),
  story: I('M4 5a2 2 0 0 1 2-2h12v16H6a2 2 0 0 0-2 2zM8 7h6M8 11h6'),
  groups: I('M3 4h8v7H3zM13 4h8v7h-8zM3 13h8v7H3zM13 13h8v7h-8z'),
  stats: I('M5 20V10M12 20V4M19 20v-7'),
  players: I('M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c0-4 4-6 8-6s8 2 8 6'),
  sim: I('M5 3l14 9-14 9z'),
}
