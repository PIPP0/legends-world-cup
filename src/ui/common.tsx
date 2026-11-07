import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { PLAYER_BY_ID, TEAM_BY_ID, WIKI } from '../data/lookup'
import type { AltTournament, Attr, ModelParams, Player, Team } from '../types'

export interface Ctx {
  params: ModelParams
  setParams: (p: ModelParams) => void
  alt: AltTournament | null
  setAlt: (a: AltTournament | null) => void
}
export const AppCtx = createContext<Ctx>(null as unknown as Ctx)
export const useApp = () => useContext(AppCtx)

export const go = (path: string) => { location.hash = path }

export function Flag({ id, size = 24 }: { id: string; size?: number }) {
  const t = TEAM_BY_ID[id]
  if (!t) return <span className="flag ph" style={{ width: size, height: size * 0.7 }} />
  return (
    <img className="flag" src={`https://flagcdn.com/w80/${t.iso}.png`} alt={`Bandera de ${t.name}`} loading="lazy"
      style={{ width: size, height: size * 0.7 }} />
  )
}

export function TeamLink({ id, flag = true, size = 22 }: { id?: string; flag?: boolean; size?: number }) {
  if (!id) return <span className="muted">Por definir</span>
  return (
    <a className="tl" href={`#/equipo/${id}`}>
      {flag && <Flag id={id} size={size} />}<span>{TEAM_BY_ID[id].name}</span>
    </a>
  )
}

// ---------- fotos (Wikipedia / Wikimedia Commons, solo licencias libres) ----------
export interface Photo { url: string; page: string; title: string }
const PKEY = 'lwc:photo:v4:'
const mem = new Map<string, Photo | null>()
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

function readCache(id: string): Photo | null | undefined {
  if (mem.has(id)) return mem.get(id)
  try {
    const v = localStorage.getItem(PKEY + id)
    if (v !== null) { const j = v === 'null' ? null : (JSON.parse(v) as Photo); mem.set(id, j); return j }
  } catch { /* sin almacenamiento */ }
  return undefined
}

// Cola con poca concurrencia para no saturar la API de Wikipedia.
let running = 0
const waiting: (() => void)[] = []
async function throttled<T>(fn: () => Promise<T>): Promise<T> {
  if (running >= 3) await new Promise<void>((r) => waiting.push(r))
  running++
  try { return await fn() } finally { running--; waiting.shift()?.() }
}

// Solo se acepta una foto si el título del artículo contiene TODAS las palabras del nombre,
// la descripción dice que es futbolista y la imagen tiene licencia libre. Si no, se usa la tarjeta alternativa.
export async function fetchPhoto(p: Player): Promise<Photo | null | undefined> {
  const hint = WIKI[p.name]
  const q = (hint ?? p.name) + ' footballer'
  const url = 'https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*&generator=search&gsrlimit=4&prop=pageimages%7Cdescription&piprop=thumbnail&pithumbsize=360&pilicense=free&gsrsearch=' + encodeURIComponent(q)
  try {
    let r = await throttled(() => fetch(url))
    for (let k = 1; !r.ok && k <= 3; k++) {
      await new Promise((res) => setTimeout(res, 1500 * k))
      r = await throttled(() => fetch(url))
    }
    if (!r.ok) return undefined
    const j = await r.json()
    const pages = Object.values(j?.query?.pages ?? {}) as { index: number; title: string; description?: string; thumbnail?: { source: string } }[]
    pages.sort((a, b) => a.index - b.index)
    const words = (s: string) => norm(s.replace(/\(.*\)/, '')).split(/[\s\-.]+/).filter((t) => t.length > 1).sort().join(' ')
    const expected = words(hint ?? p.name)
    // el título debe tener exactamente las mismas palabras (evita homónimos y familiares: «Diego Maradona Jr.»)
    const hit = pages.find((pg) =>
      !!pg.thumbnail && /(footballer|soccer (player|manager)|football (player|manager|coach))/i.test(pg.description ?? '') && words(pg.title) === expected)
    if (!hit) return null
    return { url: hit.thumbnail!.source, page: 'https://en.wikipedia.org/wiki/' + encodeURIComponent(hit.title.replace(/ /g, '_')), title: hit.title }
  } catch { return undefined }
}

export function usePhoto(p: Player): Photo | null | undefined {
  const [s, setS] = useState<Photo | null | undefined>(() => readCache(p.id))
  useEffect(() => {
    setS(readCache(p.id))
    if (readCache(p.id) !== undefined) return
    let dead = false
    fetchPhoto(p).then((r) => {
      if (r === undefined) return
      mem.set(p.id, r)
      try { localStorage.setItem(PKEY + p.id, r ? JSON.stringify(r) : 'null') } catch { /* sin almacenamiento */ }
      if (!dead) setS(r)
    })
    return () => { dead = true }
  }, [p.id])
  return s
}

const initials = (n: string) => n.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase()

export function Avatar({ p, size = 56, rounded = true }: { p: Player; size?: number; rounded?: boolean }) {
  const photo = usePhoto(p)
  const [bad, setBad] = useState(false)
  const t = TEAM_BY_ID[p.teamId]
  return (
    <span className={`avatar ${rounded ? 'round' : ''}`} style={{ width: size, height: size, fontSize: size * 0.34 }} data-line={p.line}>
      {photo && !bad ? (
        <img src={photo.url} alt={p.name} loading="lazy" onError={() => setBad(true)} />
      ) : (
        <>
          <span className="sil" aria-hidden>
            <svg viewBox="0 0 40 40"><circle cx="20" cy="14" r="7" /><path d="M5 40c0-9 6-15 15-15s15 6 15 15z" /></svg>
          </span>
          <b>{initials(p.name)}</b>
        </>
      )}
      <img className="mini-flag" src={`https://flagcdn.com/w40/${t.iso}.png`} alt="" />
    </span>
  )
}

export function PlayerCard({ p, compact }: { p: Player; compact?: boolean }) {
  return (
    <a className={`pcard ${compact ? 'compact' : ''}`} href={`#/jugador/${p.id}`}>
      <Avatar p={p} size={compact ? 44 : 64} />
      <div className="pc-body">
        <span className="pc-name">{p.name}</span>
        <span className="pc-sub"><span className="pos">{p.pos}</span>{!compact && <>{TEAM_BY_ID[p.teamId].name}</>}</span>
      </div>
      <span className="ovr">{p.ovr}</span>
    </a>
  )
}

// ---------- elementos de UI ----------
export function Section({ title, sub, children, action }: { title: string; sub?: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="sec">
      <header className="sec-h">
        <div><h2>{title}</h2>{sub && <p className="muted">{sub}</p>}</div>
        {action}
      </header>
      {children}
    </section>
  )
}

export function Tabs<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: [T, string][] }) {
  return (
    <div className="tabs" role="tablist">
      {items.map(([k, l]) => (
        <button key={k} role="tab" aria-selected={value === k} className={value === k ? 'on' : ''} onClick={() => onChange(k)}>{l}</button>
      ))}
    </div>
  )
}

export function Bar({ label, v, max = 100, min = 60, color, right }: { label: string; v: number; max?: number; min?: number; color?: string; right?: string }) {
  const pct = Math.max(2, Math.min(100, ((v - min) / (max - min)) * 100))
  return (
    <div className="bar">
      <span className="bl">{label}</span>
      <span className="bt"><i style={{ width: `${pct}%`, background: color }} /></span>
      <span className="bv">{right ?? v.toFixed(0)}</span>
    </div>
  )
}

export function ProbBar({ a, b, pa, pd, pb }: { a: string; b: string; pa: number; pd: number; pb: number }) {
  return (
    <div className="prob">
      <div className="prob-bar">
        <i className="pa" style={{ flex: pa }} /><i className="pd" style={{ flex: pd }} /><i className="pb" style={{ flex: pb }} />
      </div>
      <div className="prob-l">
        <span>{TEAM_BY_ID[a].name} <b>{Math.round(pa * 100)}%</b></span>
        <span>Empate <b>{Math.round(pd * 100)}%</b></span>
        <span>{TEAM_BY_ID[b].name} <b>{Math.round(pb * 100)}%</b></span>
      </div>
    </div>
  )
}

export function Radar({ attrs, attrs2, size = 220 }: { attrs: Attr[]; attrs2?: Attr[]; size?: number }) {
  const c = size / 2, R = size * 0.34
  const n = attrs.length
  const pt = (i: number, v: number) => {
    const ang = -Math.PI / 2 + (i * 2 * Math.PI) / n
    const r = (R * Math.max(0, v - 30)) / 70
    return [c + r * Math.cos(ang), c + r * Math.sin(ang)]
  }
  const poly = (as: Attr[]) => as.map((a, i) => pt(i, a.v).join(',')).join(' ')
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="radar" role="img" aria-label="Atributos">
      {[0.25, 0.5, 0.75, 1].map((k) => (
        <polygon key={k} points={attrs.map((_, i) => pt(i, 30 + 70 * k).join(',')).join(' ')} className="grid" />
      ))}
      {attrs.map((a, i) => {
        const [x, y] = pt(i, 112)
        return <text key={a.k} x={x} y={y} className="rl" textAnchor="middle" dominantBaseline="middle">{a.k.replace('Juego con los pies', 'Pie').replace('Juego aéreo', 'Aéreo')}</text>
      })}
      <polygon points={poly(attrs)} className="pg a" />
      {attrs2 && <polygon points={poly(attrs2)} className="pg b" />}
    </svg>
  )
}

export function Pitch({ team, mirror }: { team: Team; mirror?: boolean }) {
  return (
    <svg viewBox="0 0 100 118" className="pitch" role="group" aria-label={`Alineación de ${team.name}`}>
      <defs>
        <linearGradient id="grass" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#14301d" /><stop offset="1" stopColor="#0f2616" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="100" height="118" rx="4" fill="url(#grass)" />
      {[0, 1, 2, 3, 4, 5].map((i) => <rect key={i} x="0" y={i * 19.7} width="100" height="9.85" fill="rgba(255,255,255,.025)" />)}
      <g className="pl">
        <rect x="3" y="3" width="94" height="112" />
        <line x1="3" y1="59" x2="97" y2="59" />
        <circle cx="50" cy="59" r="10" />
        <rect x="24" y="3" width="52" height="16" /><rect x="36" y="3" width="28" height="6" />
        <rect x="24" y="99" width="52" height="16" /><rect x="36" y="109" width="28" height="6" />
      </g>
      {team.xi.map((p) => {
        const X = mirror ? 100 - p.x : p.x
        const Y = 8 + (p.y / 100) * 104
        return (
          <a key={p.id} href={`#/jugador/${p.id}`} className="pn" data-line={p.line}>
            <circle cx={X} cy={Y} r="5.2" />
            <text x={X} y={Y + 1.6} textAnchor="middle" className="pnn">{p.ovr}</text>
            <text x={X} y={Y + 9.4} textAnchor="middle" className="pnl">{shortName(p.name)}</text>
          </a>
        )
      })}
    </svg>
  )
}

export const shortName = (n: string) => {
  const parts = n.split(' ')
  if (parts.length === 1) return n
  const last = parts[parts.length - 1]
  const lower = ['van', 'de', 'da', 'del', 'di']
  const prev = parts[parts.length - 2]
  return lower.includes(prev.toLowerCase()) ? `${prev} ${last}` : last
}

export function Note({ children, tone = 'info' }: { children: ReactNode; tone?: 'info' | 'warn' | 'est' }) {
  return <p className={`note ${tone}`}>{children}</p>
}

export function useLocalState<T>(key: string, init: T): [T, (v: T) => void] {
  const [v, setV] = useState<T>(() => {
    try { const s = localStorage.getItem(key); if (s) return JSON.parse(s) as T } catch { /* sin almacenamiento */ }
    return init
  })
  const set = (x: T) => { setV(x); try { localStorage.setItem(key, JSON.stringify(x)) } catch { /* sin almacenamiento */ } }
  return [v, set]
}

export { PLAYER_BY_ID, TEAM_BY_ID }
