import { useMemo } from 'react'
import { GROUPS, PLAYERS, STORY_MATCHES, TEAMS, teamsOfGroup } from '../data'
import { DECLARED_R16 } from '../data/raw'
import { DEFAULT_PARAMS, profile } from '../engine/model'
import { declaredStats } from '../engine/stats'
import { groupTable } from '../engine/standings'
import { matchStory } from '../engine/narrative'
import { Avatar, Flag, Note, Section, TeamLink } from './common'
import { FutCard, TeamCard } from './visual'
import { ChampionPicker, Count, Hero } from './hero'
import { MatchRow } from './blocks'
import { PLAYER_BY_ID, TEAM_BY_ID } from '../data/lookup'

const totalGoals = STORY_MATCHES.reduce((a, m) => a + m.hg + m.ag, 0)


export function Home() {
  const top = useMemo(() => declaredStats().filter((s) => s.goals >= 3).sort((a, b) => b.goals - a.goals), [])
  const legends = useMemo(() => [...PLAYERS].sort((a, b) => b.ovr - a.ovr).slice(0, 18), [])
  const featured = STORY_MATCHES[0]
  const story = matchStory(featured)
  const groupStrength = useMemo(
    () => GROUPS.map((g) => ({ g, s: teamsOfGroup(g).reduce((a, t) => a + profile(t, DEFAULT_PARAMS).strength, 0) / 4 })).sort((a, b) => b.s - a.s),
    [],
  )
  return (
    <>
      <Hero />

      <div className="stats3">
        <div><b><Count to={32} /></b><span>selecciones</span></div>
        <div><b><Count to={STORY_MATCHES.length} /></b><span>partidos jugados</span></div>
        <div><b><Count to={totalGoals} /></b><span>goles</span></div>
        <div className="live"><b><i />Octavos</b><span>próxima fase</span></div>
      </div>

      <ChampionPicker />

      <Section title="Partido inaugural" sub="Grupo A · Fecha 1" action={<a className="more" href={`#/partido/${featured.id}`}>Ver partido →</a>}>
        <a className="feature" href={`#/partido/${featured.id}`} style={{ ['--fa' as string]: 'url(https://flagcdn.com/w320/br.png)', ['--fb' as string]: 'url(https://flagcdn.com/w320/gb-eng.png)' }}>
          <span className="fbg" aria-hidden />
          <div className="ft">
            <div><Flag id="bra" size={64} /><b>Brasil</b></div>
            <div className="fscore"><span>2</span><i>–</i><span>1</span></div>
            <div><Flag id="eng" size={64} /><b>Inglaterra</b></div>
          </div>
          <p>{story.cronica}</p>
        </a>
      </Section>

      <Section title="Las leyendas" sub="Las cartas mejor valoradas por el modelo" action={<a className="more" href="#/jugadores">Ver todas →</a>}>
        <div className="hscroll cards">{legends.map((p) => <FutCard key={p.id} p={p} />)}</div>
      </Section>

      <Section title="Los ocho grupos" action={<a className="more" href="#/grupos">Tablas →</a>}>
        <div className="grid g4">
          {GROUPS.map((g) => {
            const t = groupTable(g, STORY_MATCHES)
            return (
              <a key={g} href="#/grupos" className="gcard">
                <h3><span>Grupo</span> {g}</h3>
                {t.map((r, i) => (
                  <div key={r.teamId} className={`gl ${i < 2 ? 'q' : ''}`}><Flag id={r.teamId} size={22} /><span>{TEAM_BY_ID[r.teamId].name}</span><b>{r.pts}</b></div>
                ))}
              </a>
            )
          })}
        </div>
        <p className="muted small">Mayor nivel medio según el modelo: Grupo <b>{groupStrength[0].g}</b>. Menor: Grupo <b>{groupStrength[groupStrength.length - 1].g}</b>.</p>
      </Section>

      <Section title="Goleadores" sub="Declarados por la simulación original" action={<a className="more" href="#/estadisticas">Estadísticas →</a>}>
        <div className="grid g3">
          {top.map((s, i) => {
            const p = PLAYER_BY_ID[s.playerId]
            return (
              <a key={p.id} className="scorer" href={`#/jugador/${p.id}`}>
                <span className="rk">{i + 1}</span><Avatar p={p} size={56} /><div><b>{p.name}</b><span className="muted">{TEAM_BY_ID[p.teamId].name}</span></div><em>{s.goals}</em>
              </a>
            )
          })}
        </div>
      </Section>

      <Section title="Octavos de final" sub="Cruces definidos. Todavía sin resultados." action={<a className="more" href="#/cuadro">Cuadro →</a>}>
        <div className="grid g4">
          {DECLARED_R16.map(([a, b], i) => (
            <a key={i} className="kmini" href="#/cuadro">
              <span><Flag id={a} size={26} />{TEAM_BY_ID[a].name}</span><i>VS</i><span><Flag id={b} size={26} />{TEAM_BY_ID[b].name}</span>
            </a>
          ))}
        </div>
      </Section>

      <Section title="Las 32 selecciones" action={<a className="more" href="#/selecciones">Ver todas →</a>}>
        <div className="hscroll teams">
          {TEAMS.map((t) => <TeamCard key={t.id} t={t} mini star={[...t.xi].sort((a, b) => b.ovr - a.ovr)[0]} />)}
        </div>
      </Section>
    </>
  )
}

export function Story() {
  const stars = useMemo(() => TEAMS.map((t) => ({ t, p: [...t.xi].sort((a, b) => b.ovr - a.ovr)[0] })), [])
  const feat = ['bra-eng', 'ita-hun', 'ned-chi'].map((k) => STORY_MATCHES.find((m) => `${m.home}-${m.away}` === k)!)
  const big = [...STORY_MATCHES].sort((a, b) => Math.abs(b.hg - b.ag) - Math.abs(a.hg - a.ag) || b.hg + b.ag - (a.hg + a.ag)).slice(0, 4)
  const draws = STORY_MATCHES.filter((m) => m.hg === m.ag).length
  const gs = GROUPS.map((g) => ({ g, s: teamsOfGroup(g).reduce((a, t) => a + profile(t, DEFAULT_PARAMS).strength, 0) / 4 })).sort((a, b) => b.s - a.s)
  return (
    <>
      <div className="chapter" data-n="">
        <span className="cn">Capítulo 1</span>
        <h2>El sueño imposible</h2>
        <p className="quote">¿Qué selección ganaría un Mundial si pudiera reunir a sus mejores once futbolistas de toda la historia?</p>
        <p>Cada país envía a sus once mejores jugadores de todos los tiempos, y todos llegan a su mejor versión, a los 27 años. Es un torneo que nunca existió.</p>
        <ul className="rules">
          <li>32 selecciones actuales; no hay equipos combinados de países desaparecidos.</li>
          <li>Ningún futbolista juega para dos países.</li>
          <li>Ocho grupos de cuatro, tres partidos por equipo: 3 puntos por victoria, 1 por empate.</li>
          <li>Pasan los dos primeros. Luego octavos, cuartos, semifinales, tercer puesto y final.</li>
          <li>En eliminatorias, los empates se resuelven con prórroga o penales.</li>
        </ul>
        <Note tone="info">Hay tres tipos de información: <b>histórica</b> (nombres y trayectorias reales), <b>estimada</b> (valoraciones y atributos del modelo) y <b>ficticia</b> (los resultados del torneo).</Note>
      </div>

      <div className="chapter" data-n="">
        <span className="cn">Capítulo 2</span>
        <h2>Los 32 elegidos</h2>
        <p>La mayor estrella de cada selección según el modelo. Toca una para ver su once histórico.</p>
        <div className="grid g4">
          {stars.map(({ t, p }) => <TeamCard key={t.id} t={t} star={p} />)}
        </div>
      </div>

      <div className="chapter" data-n="">
        <span className="cn">Capítulo 3</span>
        <h2>El sorteo</h2>
        <p>Los grupos quedaron definidos desde el inicio del proyecto. El orden de publicación en cada grupo sugiere cuatro bombos: el primer equipo de cada grupo es cabeza de serie.</p>
        <div className="grid g4">
          {GROUPS.map((g) => (
            <div key={g} className="gcard">
              <h3>Grupo {g}</h3>
              {teamsOfGroup(g).map((id, i) => (
                <div key={id} className="gl"><span className="bombo">{i + 1}</span><Flag id={id} size={20} /><span>{TEAM_BY_ID[id].name}</span></div>
              ))}
            </div>
          ))}
        </div>
        <Note tone="est">Bombos deducidos del orden en que se publicaron los grupos; el material original no los detalla. Grupo de mayor nivel medio según el modelo: <b>{gs[0].g}</b>. De menor nivel: <b>{gs[gs.length - 1].g}</b>.</Note>
      </div>

      <div className="chapter" data-n="">
        <span className="cn">Capítulo 4</span>
        <h2>Comienza la historia</h2>
        <p>{STORY_MATCHES.length} partidos, {totalGoals} goles y {draws} empates. Estos son los duelos que marcaron la fase de grupos.</p>
        <h3 className="sub">Tres duelos con crónica propia</h3>
        <div className="list">{feat.map((m) => <MatchRow key={m.id} m={m} />)}</div>
        <h3 className="sub">Las victorias más amplias</h3>
        <div className="list">{big.map((m) => <MatchRow key={m.id} m={m} />)}</div>
        <p><a className="btn" href="#/partidos">Ver los 48 partidos</a></p>
      </div>

      <div className="chapter" data-n="">
        <span className="cn">Capítulo 5</span>
        <h2>Sobreviven los mejores</h2>
        <p>Dieciséis selecciones siguen en carrera.</p>
        <div className="flags">{DECLARED_R16.flat().map((id) => <TeamLink key={id} id={id} />)}</div>
        <p><a className="btn" href="#/cuadro">Ver octavos de final</a></p>
      </div>

      <div className="chapter last">
        <span className="cn">Capítulo 6</span>
        <h2>Camino a la gloria</h2>
        <p>La historia oficial se detiene antes de los octavos. Tú decides cuándo seguir: el simulador juega las fases restantes con una semilla reproducible, sin tocar los resultados originales.</p>
        <p><a className="btn pri" href="#/simulador">Continuar la simulación</a></p>
      </div>
    </>
  )
}
