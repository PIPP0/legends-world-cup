import { rich } from '../i18n/rich'
import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { PLAYER_BY_ID, TEAM_BY_ID } from '../data/lookup'
import { STORY_MATCHES } from '../data'
import { useStoryLevel } from '../engine/storyLevel'
import { LANG, tr } from '../i18n'
import { attrLabel, posLabel } from '../i18n/nombres'
import { useFunciones } from '../cloud/funciones'
import { revealed, scoreText } from '../engine/historia'
import { DECLARED_R16 } from '../data/raw'
import { DEFAULT_PARAMS, championOdds } from '../engine/model'
import { Avatar, Flag, usePhoto, useLocalState } from './common'
import { leerRankingMvp, votarMvp, type VotoMvp } from '../cloud/datos'
import { PLAYERS } from '../data'
import { storyPlayerStats } from '../engine/stats'
import type { Player } from '../types'

const SLIDES = ['bra-pele', 'por-cristiano-ronaldo', 'arg-diego-maradona', 'fra-zinedine-zidane', 'bra-ronaldo-nazario', 'fra-kylian-mbappe', 'ger-franz-beckenbauer']

function Preload({ p }: { p: Player }) { usePhoto(p); return null }

export function Hero() {
  const [i, setI] = useState(0)
  const [hold, setHold] = useState(false)
  const reduce = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
  useEffect(() => {
    if (hold || reduce) return
    const t = setInterval(() => setI((x) => (x + 1) % SLIDES.length), 5200)
    return () => clearInterval(t)
  }, [hold, reduce])
  const p = PLAYER_BY_ID[SLIDES[i]]
  const photo = usePhoto(p)
  const fun = useFunciones()
  const t = TEAM_BY_ID[p.teamId]
  return (
    <section className="heroB" onMouseEnter={() => setHold(true)} onMouseLeave={() => setHold(false)}>
      {SLIDES.map((id) => <Preload key={id} p={PLAYER_BY_ID[id]} />)}
      <div className="hb-t">
        <p className="kicker">{tr('Transmisión especial · Torneo imposible')}</p>
        <h1>{LANG === 'es' ? <>Mundial<br /><span>Imposible</span></> : <>{tr('HERO·1')}<br /><span>{tr('HERO·2')}</span></>}</h1>
        <p className="lead">{tr('32 selecciones, las mayores leyendas de la historia, todos a los 27 años. Un solo campeón. Sigue cada partido como si fuera en vivo.')}</p>
        <div className="cta">
          <a className="btn pri" href="#/historia">{tr('Ver el torneo')}</a>
          {fun.simulaMundial && <a className="btn hot" href="#/mundial">{tr('Simula tu mundial')}</a>}
          <a className="btn" href="#/simulador">{tr('Simular un partido')}</a>
        </div>
      </div>
      <div className="hb-v">
        <div className="cutB" key={p.id}>
          {photo ? <img src={photo.url} alt={p.name} /> : <span className="cut-ini">{p.name.split(' ').map((w) => w[0]).slice(0, 2).join('')}</span>}
        </div>
        <div className="lt" key={p.id + 'l'}>
          <div className="lt-a"><Flag id={t.id} size={26} />{p.name}</div>
          <div className="lt-b">{t.name} · {posLabel(p.pos)} · <b>{p.ovr}</b></div>
          <div className="lt-s">{p.attrs.slice(0, 4).map((a) => (
            <div key={a.k}><span>{attrLabel(a.k).slice(0, 4)}</span><i style={{ ['--w' as string]: `${a.v}%` }} /><b>{a.v}</b></div>
          ))}</div>
        </div>
        <div className="dots" role="tablist" aria-label={tr('Leyendas')}>
          {SLIDES.map((id, k) => <button key={id} className={k === i ? 'on' : ''} aria-label={PLAYER_BY_ID[id].name} onClick={() => setI(k)} />)}
        </div>
      </div>
    </section>
  )
}

export function Ticker() {
  const level = useStoryLevel()
  const items = [
    ...STORY_MATCHES.map((m) => `${TEAM_BY_ID[m.home].name.toUpperCase()} ${m.hg}–${m.ag} ${TEAM_BY_ID[m.away].name.toUpperCase()}`),
    ...revealed(level).map((m) => `${TEAM_BY_ID[m.a!].name.toUpperCase()} ${scoreText(m)} ${TEAM_BY_ID[m.b!].name.toUpperCase()}`),
  ]
  const row = items.join('   •   ')
  return (
    <div className="ticker" aria-label={tr('Resultados del torneo')}>
      <span className="tk-l">{tr('Resultados')}</span>
      <div className="tk-w"><span>{row}   •   {row}</span></div>
    </div>
  )
}

export function Count({ to }: { to: number }) {
  const [n, setN] = useState(0)
  useEffect(() => {
    const start = performance.now()
    let raf = 0
    const step = (t: number) => {
      const k = Math.min(1, (t - start) / 900)
      setN(Math.round(to * (1 - Math.pow(1 - k, 3))))
      if (k < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [to])
  return <>{n}</>
}

// Probabilidades de campeón de la portada: se calculan una sola vez (volver al inicio no las recalcula).
let oddsGuardadas: Record<string, number> | null = null
const oddsPortada = () => (oddsGuardadas ??= championOdds(DECLARED_R16, DEFAULT_PARAMS, 300, 'home'))

export function ChampionPicker() {
  const [pick, setPick] = useLocalState<string | null>('lwc:pick', null)
  // La portada se dibuja primero y las probabilidades llegan un instante después (la primera vez; luego quedan guardadas).
  const [odds, setOdds] = useState<Record<string, number>>(oddsGuardadas ?? {})
  useEffect(() => {
    if (oddsGuardadas) return
    const h = setTimeout(() => setOdds(oddsPortada()), 60)
    return () => clearTimeout(h)
  }, [])
  const teams = DECLARED_R16.flat()
  const ranked = [...teams].sort((a, b) => (odds[b] ?? 0) - (odds[a] ?? 0))
  const rank = pick ? ranked.indexOf(pick) + 1 : 0
  const text = pick ? tr('Yo apuesto a que {team} gana el Mundial Imposible de Leyendas. ¿Y tú?', { team: TEAM_BY_ID[pick].name }) : ''
  const url = typeof location !== 'undefined' ? location.href.split('#')[0] : ''
  const share = async () => {
    try { if (navigator.share) { await navigator.share({ title: 'Legends World Cup', text, url }); return } } catch { /* cancelado */ }
    window.open(`https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`, '_blank', 'noopener')
  }
  return (
    <section className="pick">
      <div className="pk-h">
        <div><p className="kicker">{tr('Los fans opinan')}</p><h2>{tr('¿Quién será el campeón?')}</h2></div>
        <p className="muted small">{tr('Elige entre las 16 selecciones que siguen en carrera. Tu voto se guarda en este navegador.')}</p>
      </div>
      <div className="pk-g">
        {teams.map((id) => (
          <button key={id} className={`pk-b ${pick === id ? 'on' : ''}`} onClick={() => setPick(id)} aria-pressed={pick === id}>
            <Flag id={id} size={34} /><span>{TEAM_BY_ID[id].name}</span>
          </button>
        ))}
      </div>
      {pick && (
        <div className="pk-r">
          <Flag id={pick} size={56} />
          <div>
            <b>{tr('Tu campeón: {team}', { team: TEAM_BY_ID[pick].name })}</b>
            <span>{rich('El modelo le da <b>{p}%</b> de ganar el torneo desde octavos: es la favorita n.º {r} de 16.', { p: ((odds[pick] ?? 0) * 100).toFixed(1), r: rank })}</span>
          </div>
          <div className="pk-a"><button className="btn pri" onClick={share}>{tr('Compartir')}</button><button className="btn ghost" onClick={() => setPick(null)}>{tr('Cambiar')}</button></div>
        </div>
      )}
    </section>
  )
}

// «Elige MVP»: ventana con el voto del jugador favorito (uno por persona, se puede cambiar) y el ranking de los 10 más votados.
export function MvpModal({ onClose }: { onClose: () => void }) {
  const [voto, setVoto] = useLocalState<string | null>('lwc:mvp', null)
  const [ranking, setRanking] = useState<VotoMvp[] | null>(null)
  const [q, setQ] = useState('')
  const [aviso, setAviso] = useState('')
  const level = useStoryLevel()
  const candidatos = useMemo(() => {
    const clasificados = new Set(DECLARED_R16.flat())
    const porNivel = PLAYERS.filter((p) => clasificados.has(p.teamId)).sort((a, b) => b.ovr - a.ovr).slice(0, 8).map((p) => p.id)
    const goleadores = storyPlayerStats(level).sort((a, b) => b.goals - a.goals).slice(0, 4).map((s) => s.playerId)
    return [...new Set([...porNivel, ...goleadores])].filter((id) => PLAYER_BY_ID[id]).slice(0, 12)
  }, [level])
  const busqueda = useMemo(() => {
    const t = q.trim().toLowerCase()
    return t.length < 2 ? [] : PLAYERS.filter((p) => p.name.toLowerCase().includes(t)).slice(0, 8).map((p) => p.id)
  }, [q])
  const lista = q.trim().length >= 2 ? busqueda : candidatos
  const cargar = () => { void leerRankingMvp().then((r) => setRanking(r ?? [])) }
  useEffect(cargar, [])
  useEffect(() => {
    const k = (ev: KeyboardEvent) => ev.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    const prev = document.body.style.overflow; document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', k); document.body.style.overflow = prev }
  }, [onClose])
  const elegir = async (id: string) => {
    setVoto(id); setAviso('')
    const ok = await votarMvp(id)
    if (!ok) setAviso(tr('Tu voto quedó guardado en este navegador; el ranking compartido no está disponible ahora.'))
    cargar()
  }
  const max = Math.max(1, ...(ranking ?? []).map((r) => r.n))
  const mio = voto ? PLAYER_BY_ID[voto] : undefined
  return createPortal(
    <div className="modal-bg" role="dialog" aria-modal="true" aria-label={tr('Elige MVP: tu jugador favorito')} onClick={onClose}>
      <div className="modal mvp-modal" onClick={(e) => e.stopPropagation()}>
        <header className="mvp-top">
          <div><p className="kicker">{tr('Los fans opinan')}</p><h3>{tr('Elige MVP: tu jugador favorito')}</h3>
            <p className="muted small">{tr('Elige al MVP del Mundial de Leyendas. Un voto por persona; puedes cambiarlo cuando quieras.')}</p></div>
          <button type="button" className="mvp-x" onClick={onClose} aria-label={tr('Cerrar')}>✕</button>
        </header>
        <div className="mvp-cols">
          <div className="mvp-izq">
            {mio && <div className="mvp-mio"><Avatar p={mio} size={52} /><div><span>{tr('Tu MVP: {name}', { name: '' })}</span><b>{mio.name}</b><small>{TEAM_BY_ID[mio.teamId].name}</small></div></div>}
            <input className="search" placeholder={tr('Buscar otro jugador…')} aria-label={tr('Buscar otro jugador…')} value={q} onChange={(e) => setQ(e.target.value)} />
            <div className="mvp-grid">
              {lista.map((id) => {
                const p = PLAYER_BY_ID[id]
                return (
                  <button key={id} type="button" className={`mvp-card${voto === id ? ' on' : ''}`} onClick={() => void elegir(id)} aria-pressed={voto === id}>
                    <Avatar p={p} size={64} />
                    <b>{p.name}</b>
                    <span><Flag id={p.teamId} size={16} /> {TEAM_BY_ID[p.teamId].name}</span>
                    {voto === id && <i className="mvp-ok">✓</i>}
                  </button>
                )
              })}
            </div>
            {aviso && <p className="small muted">{aviso}</p>}
          </div>
          <aside className="mvp-der">
            <h4>{tr('Los 10 más populares')}</h4>
            {ranking === null ? <p className="muted small">…</p> : ranking.length === 0 ? <p className="muted small">{tr('Aún no hay votos. ¡Sé el primero!')}</p> : (
              <ol className="mvp-rank">
                {ranking.map((r, i) => PLAYER_BY_ID[r.id] && (
                  <li key={r.id} className={i < 3 ? `top${i + 1}` : ''}>
                    <span className="n">{i + 1}</span><Avatar p={PLAYER_BY_ID[r.id]} size={38} />
                    <div><b>{PLAYER_BY_ID[r.id].name}</b><small className="muted">{TEAM_BY_ID[PLAYER_BY_ID[r.id].teamId].name}</small><i style={{ width: `${(r.n / max) * 100}%` }} /></div>
                    <em>{r.n === 1 ? tr('{n} voto', { n: r.n }) : tr('{n} votos', { n: r.n })}</em>
                  </li>
                ))}
              </ol>
            )}
          </aside>
        </div>
      </div>
    </div>,
    document.body,
  )
}
