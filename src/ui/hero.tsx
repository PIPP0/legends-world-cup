import { rich } from '../i18n/rich'
import { useEffect, useMemo, useState } from 'react'
import { PLAYER_BY_ID, TEAM_BY_ID } from '../data/lookup'
import { STORY_MATCHES, TEAMS } from '../data'
import { useStoryLevel } from '../engine/storyLevel'
import { LANG, tr } from '../i18n'
import { attrLabel, posLabel } from '../i18n/nombres'
import { useFunciones } from '../cloud/funciones'
import { revealed, scoreText } from '../engine/historia'
import { DECLARED_R16 } from '../data/raw'
import oddsPortadaJson from '../data/oddsPortada.json'
import { FavStar, Flag, usePhoto, useLocalState } from './common'
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
          <a className="btn pri" href="#/cuadro">{tr('Ver el torneo')}</a>
          {fun.simulaMundial && <a className="btn hot" href="#/mundial">{tr('Simula tu mundial')}</a>}
          <a className="btn" href="#/simulador">{tr('Simular un partido')}</a>
          <a className="btn" href="#/mvp">{tr('Elige MVP')}</a>
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

// Probabilidades de campeón de la portada: vienen ya calculadas (scripts/odds-portada.ts), así la portada abre al instante.
const ODDS_PORTADA = oddsPortadaJson as Record<string, number>

export function ChampionPicker() {
  const [pick, setPick] = useLocalState<string | null>('lwc:pick', null)
  const odds = ODDS_PORTADA
  const enCarrera = DECLARED_R16.flat()
  // las 32 selecciones, todas iguales y en orden alfabético, en tres láminas con rejilla completa de 4 columnas (12 + 12 + 8)
  const todas = [...TEAMS].sort((a, b) => a.name.localeCompare(b.name)).map((t) => t.id)
  const laminas = [todas.slice(0, 12), todas.slice(12, 24), todas.slice(24)]
  const [pagina, setPagina] = useState(() => { const i = pick ? laminas.findIndex((l) => l.includes(pick)) : 0; return i < 0 ? 0 : i })
  const teams = laminas[pagina]
  const irA = (i: number) => setPagina(Math.max(0, Math.min(2, i)))
  const [x0, setX0] = useState<number | null>(null)
  const ranked = [...enCarrera].sort((a, b) => (odds[b] ?? 0) - (odds[a] ?? 0))
  const rank = pick ? ranked.indexOf(pick) + 1 : 0
  const fueraDeCarrera = !!pick && rank === 0
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
        <p className="muted small">{tr('Elige entre las 32 selecciones. Tu voto se guarda en este navegador.')}</p>
      </div>
      <div className="pk-car" onTouchStart={(e) => setX0(e.touches[0].clientX)} onTouchEnd={(e) => { if (x0 !== null) { const dx = e.changedTouches[0].clientX - x0; if (dx < -50) irA(pagina + 1); else if (dx > 50) irA(pagina - 1) } setX0(null) }}>
        <button type="button" className="pk-arrow" aria-label={tr('Atrás')} disabled={pagina === 0} onClick={() => irA(pagina - 1)}>‹</button>
        <div className="pk-g" key={pagina}>
          {teams.map((id) => (
            <button key={id} className={`pk-b ${pick === id ? 'on' : ''}`} onClick={() => setPick(id)} aria-pressed={pick === id}>
              <Flag id={id} size={34} /><span>{TEAM_BY_ID[id].name}</span><FavStar id={id} />
            </button>
          ))}
        </div>
        <button type="button" className="pk-arrow" aria-label={tr('Siguiente')} disabled={pagina === 2} onClick={() => irA(pagina + 1)}>›</button>
      </div>
      <div className="pk-dots">{[0, 1, 2].map((i) => <button type="button" key={i} className={pagina === i ? 'on' : ''} onClick={() => irA(i)} aria-label={`${i + 1}/3`} />)}</div>
      {pick && (
        <div className="pk-r">
          <Flag id={pick} size={56} />
          <div>
            <b>{tr('Tu campeón: {team}', { team: TEAM_BY_ID[pick].name })}</b>
            <span>{fueraDeCarrera ? tr('Eliminada en la fase de grupos.') : rich('El modelo le da <b>{p}%</b> de ganar el torneo desde octavos: es la favorita n.º {r} de 16.', { p: ((odds[pick] ?? 0) * 100).toFixed(1), r: rank })}</span>
          </div>
          <div className="pk-a"><button className="btn pri" onClick={share}>{tr('Compartir')}</button><button className="btn ghost" onClick={() => setPick(null)}>{tr('Cambiar')}</button></div>
        </div>
      )}
    </section>
  )
}
