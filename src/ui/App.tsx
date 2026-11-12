import { Duelo } from './duelo'
import { MvpPage } from './mvp'
import { DonateIcon, DonateLink, DonateModalHost } from './paybox'
import { useEffect, useState } from 'react'
import { DEFAULT_PARAMS } from '../engine/model'
import { Note, AppCtx, useLocalState } from './common'
import { ICONS } from './visual'
import { Ticker } from './hero'
import { Home, Story } from './pages1'
import { Compare, PlayerPage, Players, Team, Teams } from './pages2'
import { Groups, MatchPage, Matches } from './pages3'
import { Bracket, Simulator, Stats } from './pages4'
import { Privacidad } from './privacidad'
import { Credits } from './credits'
import { Mundial } from './mundial'
import { Vivo } from './vivo'
import { EncuestaHeader } from './encuesta'
import { Admin } from './admin'
import { RankingPagina } from './ranking'
import { t, tr } from '../i18n'
import { SelectorIdioma } from './idioma'
import { CuentaHeader } from './cuenta'
import { iniciarFunciones, useFunciones } from '../cloud/funciones'
import type { AltTournament, ModelParams } from '../types'

const MAIN: [string, string, string][] = [
  ['/', t('Inicio'), 'home'], ['/selecciones', t('Selecciones'), 'teams'], ['/partidos', t('Partidos'), 'ball'], ['/cuadro', t('Cuadro'), 'bracket'],
]
const MORE: [string, string, string][] = [
  ['/historia', t('Historia'), 'story'], ['/grupos', t('Grupos'), 'groups'], ['/estadisticas', t('Estadísticas'), 'stats'],
  ['/jugadores', t('Jugadores'), 'players'], ['/simulador', t('Simulador'), 'sim'], ['/duelo', t('Duelo'), 'duel'],
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
  const fun = useFunciones()
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
    case 'mvp': return <MvpPage />
    case 'duelo': return fun.duelo ? <Duelo /> : <Note>{t('El duelo no está disponible por ahora.')} <a href="#/">{t('Volver al inicio')}</a></Note>
    case 'ranking': return <RankingPagina />
    case 'creditos': return <Credits />
    case 'privacidad': return <Privacidad />
    case 'mundial': return fun.simulaMundial ? <Mundial /> : <Note>{t('«Simula tu mundial» no está disponible por ahora.')} <a href="#/">{t('Volver al inicio')}</a></Note>
    case 'vivo': return <Vivo />
    case 'admin': return <Admin />
    default: return <p className="note warn">{t('Página no encontrada.')} <a href="#/">{t('Volver al inicio')}</a></p>
  }
}

const Logo = () => (
  <a className="logo" href="#/" aria-label="Legends World Cup, inicio">
    <svg viewBox="0 0 32 32" aria-hidden><circle cx="16" cy="16" r="15" fill="#00e5ff" /><path d="M16 6l5.5 4v6.5L16 21l-5.5-4.5V10z" fill="#050a1c" /><path d="M16 21v5M10.5 16.5L6 18M21.5 16.5L26 18M16 6V3" stroke="#050a1c" strokeWidth="1.6" strokeLinecap="round" /></svg>
    <span><b>LEGENDS</b> WORLD CUP</span>
  </a>
)

// Franja fina: deja claro que es un sitio de fans. Si el apoyo voluntario está encendido, el texto lo reconoce (así nunca dice algo que no es cierto).
function Huincha() {
  const f = useFunciones()
  if (!f.huincha) return null
  return <div className="huincha" role="note"><span>{f.donaciones ? tr('Sitio creado por fans y para fans, como homenaje al fútbol y a sus ídolos. Jugar es gratis y el apoyo es voluntario. Los nombres e imágenes pertenecen a sus titulares y se usan con respeto. Sin relación con la FIFA, clubes, federaciones ni jugadores. Resultados y valoraciones ficticios.') : tr('Sitio creado por fans y para fans, sin fines de lucro, como homenaje al fútbol y a sus ídolos. Los nombres e imágenes pertenecen a sus titulares y se usan con respeto y sin ánimo comercial. Sin relación con la FIFA, clubes, federaciones ni jugadores. Resultados y valoraciones ficticios.')}</span></div>
}

export default function App() {
  const route = useRoute()
  const [params, setParams] = useLocalState<ModelParams>('lwc:params:v1', DEFAULT_PARAMS)
  const [alt, setAlt] = useLocalState<AltTournament | null>('lwc:alt:v1', null)
  const [more, setMore] = useState(false)
  const fun = useFunciones()
  useEffect(() => { iniciarFunciones() }, [])
  useEffect(() => setMore(false), [route])
  const root = '/' + (route.split('/')[1] ?? '')
  const active = ({ '/equipo': '/selecciones', '/jugador': '/jugadores', '/comparar': '/jugadores', '/partido': '/partidos' } as Record<string, string>)[root] ?? root
  const moreActive = MORE.some(([p]) => p === active)
  return (
    <AppCtx.Provider value={{ params, setParams, alt, setAlt }}>
      {fun.mantenimiento && <div className="aviso-web" role="status">{fun.mantenimiento}</div>}
      <Ticker />
      <Huincha />
      <DonateModalHost />
      <header className="top">
        <div className="top-in">
          <Logo />
          <nav className="dnav" aria-label={t('Principal')}>
            {[...MAIN, ...MORE].map(([p, l]) => <a key={p} href={`#${p}`} className={active === p ? 'on' : ''} aria-current={active === p ? 'page' : undefined}>{l}</a>)}
          </nav>
          <EncuestaHeader pantalla={route.split('/')[1] || 'inicio'} />
          <DonateIcon />
          <SelectorIdioma />
          <CuentaHeader />
        </div>
      </header>
      <main key={route.split('/').slice(0, 3).join('/')}><Page route={route} /></main>
      <footer>
        <Logo />
        <p>{t('Proyecto de ficción deportiva. Los nombres y trayectorias son históricos; las valoraciones, atributos, resultados del torneo y estadísticas son ficticios o estimados por el modelo.')}</p>
        <p>{t('Banderas: flagcdn.com · Fotografías: Wikipedia/Wikimedia Commons con licencia libre.')} <a href="#/creditos" style={{ textDecoration: 'underline' }}>{t('Ver créditos de cada foto')}</a> · <a href="#/privacidad" style={{ textDecoration: 'underline' }}>{t('Privacidad')}</a>. <DonateLink /></p>
      </footer>
      {more && <div className="sheet-bg" onClick={() => setMore(false)} />}
      {more && (
        <div className="sheet" role="dialog" aria-label={t('Más secciones')}>
          {MORE.map(([p, l, i]) => <a key={p} href={`#${p}`} className={active === p ? 'on' : ''}>{ICONS[i]}<span>{l}</span></a>)}
          <div className="sheet-donate"><DonateLink /></div>
        </div>
      )}
      <nav className="bnav" aria-label={t('Navegación móvil')}>
        {MAIN.map(([p, l, i]) => <a key={p} href={`#${p}`} className={active === p ? 'on' : ''}>{ICONS[i]}<span>{l}</span></a>)}
        <button className={moreActive || more ? 'on' : ''} onClick={() => setMore(!more)} aria-expanded={more}>{ICONS.more}<span>{t('Más')}</span></button>
      </nav>
    </AppCtx.Provider>
  )
}
