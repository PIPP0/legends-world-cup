import { useEffect, useState } from 'react'
import { DEFAULT_PARAMS } from '../engine/model'
import { AppCtx, useLocalState } from './common'
import { ICONS } from './visual'
import { Ticker } from './hero'
import { Home, Story } from './pages1'
import { Compare, PlayerPage, Players, Team, Teams } from './pages2'
import { Groups, MatchPage, Matches } from './pages3'
import { Bracket, Simulator, Stats } from './pages4'
import { Credits } from './credits'
import { Mundial } from './mundial'
import { Vivo } from './vivo'
import type { AltTournament, ModelParams } from '../types'

const MAIN: [string, string, string][] = [
  ['/', 'Inicio', 'home'], ['/selecciones', 'Selecciones', 'teams'], ['/partidos', 'Partidos', 'ball'], ['/cuadro', 'Cuadro', 'bracket'],
]
const MORE: [string, string, string][] = [
  ['/historia', 'Historia', 'story'], ['/grupos', 'Grupos', 'groups'], ['/estadisticas', 'Estadísticas', 'stats'],
  ['/jugadores', 'Jugadores', 'players'], ['/simulador', 'Simulador', 'sim'],
]

function useRoute() {
  const get = () => location.hash.replace(/^#/, '') || '/'
  const [r, setR] = useState(get)
  useEffect(() => {
    const f = () => { setR(get()); window.scrollTo(0, 0) }
    window.addEventListener('hashchange', f)
    return () => window.removeEventListener('hashchange', f)
  }, [])
  return r
}

function Page({ route }: { route: string }) {
  const [, root, a, b] = route.split('/')
  switch (root) {
    case undefined: case '': return <Home />
    case 'historia': return <Story />
    case 'selecciones': return <Teams />
    case 'equipo': return <Team id={a} />
    case 'jugador': return <PlayerPage id={a} />
    case 'jugadores': return <Players />
    case 'comparar': return <Compare a={a} b={b} />
    case 'grupos': return <Groups />
    case 'partidos': return <Matches />
    case 'partido': return <MatchPage id={a} />
    case 'estadisticas': return <Stats />
    case 'cuadro': return <Bracket />
    case 'simulador': return <Simulator />
    case 'creditos': return <Credits />
    case 'mundial': return <Mundial />
    case 'vivo': return <Vivo />
    default: return <p className="note warn">Página no encontrada. <a href="#/">Volver al inicio</a></p>
  }
}

const Logo = () => (
  <a className="logo" href="#/" aria-label="Legends World Cup, inicio">
    <svg viewBox="0 0 32 32" aria-hidden><circle cx="16" cy="16" r="15" fill="#00e5ff" /><path d="M16 6l5.5 4v6.5L16 21l-5.5-4.5V10z" fill="#050a1c" /><path d="M16 21v5M10.5 16.5L6 18M21.5 16.5L26 18M16 6V3" stroke="#050a1c" strokeWidth="1.6" strokeLinecap="round" /></svg>
    <span><b>LEGENDS</b> WORLD CUP</span>
  </a>
)

export default function App() {
  const route = useRoute()
  const [params, setParams] = useLocalState<ModelParams>('lwc:params:v1', DEFAULT_PARAMS)
  const [alt, setAlt] = useLocalState<AltTournament | null>('lwc:alt:v1', null)
  const [more, setMore] = useState(false)
  useEffect(() => setMore(false), [route])
  const root = '/' + (route.split('/')[1] ?? '')
  const active = ({ '/equipo': '/selecciones', '/jugador': '/jugadores', '/comparar': '/jugadores', '/partido': '/partidos' } as Record<string, string>)[root] ?? root
  const moreActive = MORE.some(([p]) => p === active)
  return (
    <AppCtx.Provider value={{ params, setParams, alt, setAlt }}>
      <Ticker />
      <header className="top">
        <div className="top-in">
          <Logo />
          <nav className="dnav" aria-label="Principal">
            {[...MAIN, ...MORE].map(([p, l]) => <a key={p} href={`#${p}`} className={active === p ? 'on' : ''} aria-current={active === p ? 'page' : undefined}>{l}</a>)}
          </nav>
        </div>
      </header>
      <main key={route.split('/').slice(0, 3).join('/')}><Page route={route} /></main>
      <footer>
        <Logo />
        <p>Proyecto de ficción deportiva. Los nombres y trayectorias son históricos; las valoraciones, atributos, resultados del torneo y estadísticas son ficticios o estimados por el modelo.</p>
        <p>Banderas: flagcdn.com · Fotografías: Wikipedia/Wikimedia Commons con licencia libre. <a href="#/creditos" style={{ textDecoration: 'underline' }}>Ver créditos de cada foto</a>.</p>
      </footer>
      {more && <div className="sheet-bg" onClick={() => setMore(false)} />}
      {more && (
        <div className="sheet" role="dialog" aria-label="Más secciones">
          {MORE.map(([p, l, i]) => <a key={p} href={`#${p}`} className={active === p ? 'on' : ''}>{ICONS[i]}<span>{l}</span></a>)}
        </div>
      )}
      <nav className="bnav" aria-label="Navegación móvil">
        {MAIN.map(([p, l, i]) => <a key={p} href={`#${p}`} className={active === p ? 'on' : ''}>{ICONS[i]}<span>{l}</span></a>)}
        <button className={moreActive || more ? 'on' : ''} onClick={() => setMore(!more)} aria-expanded={more}>{ICONS.more}<span>Más</span></button>
      </nav>
    </AppCtx.Provider>
  )
}
