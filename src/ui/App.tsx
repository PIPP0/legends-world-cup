import { useEffect, useState } from 'react'
import { DEFAULT_PARAMS } from '../engine/model'
import { AppCtx, useLocalState } from './common'
import { Home, Story } from './pages1'
import { Compare, PlayerPage, Players, Team, Teams } from './pages2'
import { Groups, MatchPage, Matches } from './pages3'
import { Bracket, Simulator, Stats } from './pages4'
import type { AltTournament, ModelParams } from '../types'

const NAV: [string, string][] = [
  ['/', 'Inicio'], ['/historia', 'Historia'], ['/selecciones', 'Selecciones'], ['/grupos', 'Grupos'], ['/partidos', 'Partidos'],
  ['/cuadro', 'Cuadro'], ['/estadisticas', 'Estadísticas'], ['/jugadores', 'Jugadores'], ['/simulador', 'Simulador'],
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
    default: return <p className="note warn">Página no encontrada. <a href="#/">Volver al inicio</a></p>
  }
}

export default function App() {
  const route = useRoute()
  const [params, setParams] = useLocalState<ModelParams>('lwc:params:v1', DEFAULT_PARAMS)
  const [alt, setAlt] = useLocalState<AltTournament | null>('lwc:alt:v1', null)
  const root = '/' + (route.split('/')[1] ?? '')
  const active = ({ '/equipo': '/selecciones', '/jugador': '/jugadores', '/comparar': '/jugadores', '/partido': '/partidos' } as Record<string, string>)[root] ?? root
  return (
    <AppCtx.Provider value={{ params, setParams, alt, setAlt }}>
      <header className="top">
        <a className="logo" href="#/"><span className="ball" aria-hidden>⚽</span><b>LEGENDS</b> WORLD CUP</a>
        <nav aria-label="Principal">
          {NAV.map(([p, l]) => <a key={p} href={`#${p}`} className={active === p ? 'on' : ''} aria-current={active === p ? 'page' : undefined}>{l}</a>)}
        </nav>
      </header>
      <main><Page route={route} /></main>
      <footer>
        <p>Legends World Cup es un proyecto de ficción deportiva. Los nombres y trayectorias son históricos; las valoraciones, atributos, resultados del torneo y estadísticas son ficticios o estimados por el modelo.</p>
        <p>Banderas: flagcdn.com. Fotografías: Wikipedia/Wikimedia Commons con licencia libre, con enlace a su fuente.</p>
      </footer>
    </AppCtx.Provider>
  )
}
