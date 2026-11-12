import { tr } from '../i18n'
import { useEffect, useMemo, useRef, useState } from 'react'
import { GROUPS } from '../data'
import { HOST_BY_ID } from '../data/world'
import { PLAYER_BY_ID, TEAM_BY_ID } from '../data/lookup'
import { table } from '../engine/standings'
import { probabilities } from '../engine/model'
import { recordHistory } from '../engine/world'
import { Flag, Section, useApp } from './common'
import { CtxLine } from './world'
import { LiveReplay } from './pages4'
import { BracketAnimado, BracketEstatico } from './bracketAnim'
import { Reveal } from './mundial'
import { Board, type Item } from './board'
import { takePending } from './pending'
import { registrarMundial } from '../cloud/datos'
import { CUPO_LLENO, NUBE_ACTIVA, cuentaActual, cupoLleno, entrarConGoogle, leerCupo, esperarCambiosDeSesion, type Cuenta } from '../cloud/firebase'
import { useFunciones } from '../cloud/funciones'
import type { AltTournament, Bracket, Goal, KoMatch, MatchCtx } from '../types'

const ALL = Object.keys(TEAM_BY_ID)

function Slot({ id, state }: { id: string; state: 'empty' | 'spin' | 'done' }) {
  const [r, setR] = useState(ALL[0])
  useEffect(() => {
    if (state !== 'spin') return
    const i = setInterval(() => setR(ALL[Math.floor(Math.random() * ALL.length)]), 70)
    return () => clearInterval(i)
  }, [state])
  if (state === 'empty') return <span className="slot empty">?</span>
  if (state === 'spin') return <span className="slot spin"><Flag id={r} size={22} /><b>···</b></span>
  return <span className="slot pop"><Flag id={id} size={22} /><b>{TEAM_BY_ID[id].name}</b></span>
}

function useSteps(n: number, ms: number, onDone: () => void) {
  const [k, setK] = useState(0)
  useEffect(() => {
    if (k > n) return
    const t = setTimeout(() => setK((x) => x + 1), ms)
    return () => clearTimeout(t)
  }, [k, n, ms])
  const fired = useRef(false)
  useEffect(() => { if (k > n && !fired.current) { fired.current = true; onDone() } }, [k, n, onDone])
  return [k, () => setK(n + 1)] as const
}

function DrawGroups({ groups, hostTeam, onDone }: { groups: Record<string, string[]>; hostTeam?: string; onDone: () => void }) {
  const [k, skip] = useSteps(32, 420, onDone)
  return (
    <>
      <div className="drawgrid">
        {GROUPS.map((g, gi) => (
          <div key={g} className="dgroup"><h5>{tr('Grupo')} {g}{g === 'A' && hostTeam && groups.A[0] === hostTeam ? tr(' · anfitrión') : ''}</h5>
            {[0, 1, 2, 3].map((p) => { const idx = p * 8 + gi; return <Slot key={p} id={groups[g][p]} state={idx < k ? 'done' : idx === k ? 'spin' : 'empty'} /> })}
          </div>
        ))}
      </div>
      {k <= 32 && <button className="btn ghost" onClick={skip}>{tr('Saltar sorteo')}</button>}
    </>
  )
}

interface Pair { a: string; b: string; ctx?: MatchCtx; label?: string }
function PairDraw({ pairs, onDone }: { pairs: Pair[]; onDone: () => void }) {
  const [k, skip] = useSteps(pairs.length, 1500, onDone)
  return (
    <>
      <div className="pairgrid">
        {pairs.map((p, i) => {
          const st = i < k ? 'done' : i === k ? 'spin' : 'empty'
          return (
            <div key={i} className="pairc">
              {p.label && <em>{p.label}</em>}
              <Slot id={p.a} state={st} /><span className="vs">VS</span><Slot id={p.b} state={st} />
              {st === 'done' && <CtxLine ctx={p.ctx} />}
            </div>
          )
        })}
      </div>
      {k <= pairs.length && <button className="btn ghost" onClick={skip}>{tr('Saltar sorteo')}</button>}
    </>
  )
}

// Etapa eliminatoria: primero el cuadro con los cruces de la ronda (sin resultados) y desde ahí se pasa a los partidos.
const NIVEL_CUADRO: Record<Round | 'final', number> = { r16: 0, qf: 1, sf: 2, final: 3 }
function PairCuadro({ full, round, onDone }: { full: Bracket; round: Round | 'final'; onDone: () => void }) {
  const nivel = NIVEL_CUADRO[round]
  const [salto, setSalto] = useState(0)
  const [fin, setFin] = useState(false)
  const [saltado, setSaltado] = useState(false)
  // octavos: solo el cuadro con los cruces. Cuartos en adelante: se anima cómo avanzan los ganadores (borde dorado, línea y llegada de equipos).
  useEffect(() => { if (nivel === 0) onDone() }, [nivel, onDone])
  const alTerminar = useMemo(() => () => { setFin(true); onDone() }, [onDone])
  if (nivel === 0) return <div className="vcuadro"><BracketEstatico full={full} level={0} /></div>
  return (
    <div className="vcuadro">
      {!fin && !saltado && <div className="cta"><button className="btn ghost" onClick={() => { setSaltado(true); setSalto((k) => k + 1) }}>{tr('Saltar animación')}</button></div>}
      <BracketAnimado full={full} from={nivel - 1} to={nivel} speed={600} onEnd={alTerminar} skipKey={salto} />
    </div>
  )
}

function Tables({ t, upTo }: { t: AltTournament; upTo: number }) {
  return (
    <div className="mtables">
      {GROUPS.map((g) => {
        const rows = table(t.groups![g], t.groupMatches.filter((m) => m.group === g && m.matchday <= upTo))
        return (
          <div key={g} className="mt"><h5>{tr('Grupo')} {g}</h5>
            {rows.map((r, i) => <p key={r.teamId} className={i < 2 ? 'q' : ''}><Flag id={r.teamId} size={16} /><span>{TEAM_BY_ID[r.teamId].name}</span><i>{r.gd > 0 ? '+' : ''}{r.gd}</i><b>{r.pts}</b></p>)}
          </div>
        )
      })}
    </div>
  )
}

type Round = 'r16' | 'qf' | 'sf'
type Step = { kind: 'draw' } | { kind: 'md'; n: 1 | 2 | 3 } | { kind: 'pair'; r: Round | 'final' } | { kind: 'play'; r: Round } | { kind: 'third' } | { kind: 'final' } | { kind: 'end' }
const RN: Record<Round, string> = { r16: tr('octavos de final'), qf: tr('cuartos de final'), sf: tr('semifinales') }
const PLAYING: Record<Round, string> = { r16: tr('Se juegan los octavos de final'), qf: tr('Se juegan los cuartos de final'), sf: tr('Se juegan las semifinales') }

const toItem = (m: KoMatch, tag?: string): Item => ({ id: m.id, a: m.a!, b: m.b!, goals: m.goals ?? [], ga: m.ga!, gb: m.gb!, et: m.et, pens: m.pens, winner: m.winner, ctx: m.ctx, tag })
const toRes = (m: KoMatch) => ({ ga: m.ga!, gb: m.gb!, goals: m.goals ?? [], et: !!m.et, pens: m.pens, winner: m.winner })

export function Vivo() {
  const { setAlt, params } = useApp()
  const t = useMemo(() => takePending(), [])
  const steps = useMemo<Step[]>(() => {
    if (!t) return []
    const s: Step[] = []
    if (t.mode === 'completo' && t.groups) s.push({ kind: 'draw' }, { kind: 'md', n: 1 }, { kind: 'md', n: 2 }, { kind: 'md', n: 3 })
    s.push({ kind: 'pair', r: 'r16' }, { kind: 'play', r: 'r16' }, { kind: 'pair', r: 'qf' }, { kind: 'play', r: 'qf' }, { kind: 'pair', r: 'sf' }, { kind: 'play', r: 'sf' }, { kind: 'pair', r: 'final' }, { kind: 'third' }, { kind: 'final' }, { kind: 'end' })
    return s
  }, [t])
  const resThird = useMemo(() => (t ? toRes(t.bracket.third) : null), [t])
  const resFinal = useMemo(() => (t ? toRes(t.bracket.final) : null), [t])
  // el paso en que vas se guarda por torneo: al recargar la página sigues donde estabas (no vuelves al inicio)
  const clavePaso = t ? `lwc:vivo:paso:${t.seed}` : ''
  const claveFin = t ? `lwc:vivo:fin:${t.seed}` : ''
  const [i, setI] = useState(() => { try { const n = Number(sessionStorage.getItem(clavePaso)); return Number.isInteger(n) && n > 0 ? Math.min(n, Math.max(0, steps.length - 1)) : 0 } catch { return 0 } })
  const [ready, setReady] = useState(false)
  const saved = useRef(false)
  useEffect(() => { if (clavePaso) try { sessionStorage.setItem(clavePaso, String(i)) } catch { /* sin almacenamiento */ } }, [i, clavePaso])
  const step = steps[i]
  // Puerta de cuenta: la fase de grupos es libre; desde octavos de final hay que entrar con Gmail (Google). Sin nube conectada no se exige nada.
  const f = useFunciones()
  const [cuenta, setCuenta] = useState<Cuenta | null | undefined>(NUBE_ACTIVA ? undefined : null)
  const [errLogin, setErrLogin] = useState('')
  const [sinCuenta, setSinCuenta] = useState(false) // con el cupo lleno se puede seguir jugando sin cuenta
  const [lleno, setLleno] = useState(false)
  useEffect(() => { if (NUBE_ACTIVA) void leerCupo().then((c) => setLleno(cupoLleno(c))) }, [])
  useEffect(() => {
    if (!NUBE_ACTIVA) return
    let off: (() => void) | undefined
    void (async () => { setCuenta(await cuentaActual()); off = await esperarCambiosDeSesion((c) => setCuenta(c)) })()
    return () => off?.()
  }, [])
  const next = () => { setReady(false); setI((x) => x + 1); window.scrollTo(0, 0) }
  const done = useRef(() => setReady(true)).current
  const prOf = (a: string, b: string, ctx?: MatchCtx): [number, number, number] => { const p = probabilities(a, b, params, ctx && t ? { ctx, world: t.world } : undefined); return [p.win, p.draw, p.loss] }
  useEffect(() => {
    if (step?.kind === 'end' && t && !saved.current) {
      saved.current = true
      let yaGrabado = false
      try { yaGrabado = sessionStorage.getItem(claveFin) === '1' } catch { /* nada */ }
      if (!yaGrabado) { recordHistory(t); void registrarMundial(t); try { sessionStorage.setItem(claveFin, '1') } catch { /* nada */ } }
      setAlt({ ...t, recorded: true })
    }
  }, [step, t, setAlt, claveFin])

  if (!t) return <Section title={tr('Sin torneo en curso')}><p className="note">{tr('No hay un mundial por vivir.')} <a href="#/mundial">{tr('Arma uno')}</a>{tr(' o ')}<a href="#/simulador">{tr('ve el simulador')}</a>.</p></Section>
  const exige = NUBE_ACTIVA && f.cuentas && !sinCuenta && step.kind === 'pair' && step.r === 'r16' && !(cuenta && !cuenta.anonimo)
  if (exige) {
    const entrar = async () => { setErrLogin(''); try { await entrarConGoogle(); } catch (e) { const code = (e as { code?: string }).code ?? ''; console.warn('login Google:', code, e); if (code === CUPO_LLENO) { setLleno(true); return } if (code !== 'auth/popup-closed-by-user' && code !== 'auth/cancelled-popup-request') setErrLogin(`${tr('No se pudo entrar. Inténtalo de nuevo.')} (${code.replace('auth/', '') || 'error'})`) } }
    return (
      <Section title={tr('Inicia sesión y descubre quién es el campeón de tu propio Mundial de Leyendas')} sub={tr('Octavos de final')}>
        <p>{tr('La fase de grupos es libre. Desde los octavos de final necesitas entrar con tu cuenta de Gmail para ver cómo termina tu mundial y guardar tu resultado.')}</p>
        {cuenta === undefined ? <p className="muted">…</p> : <div className="cta"><button className="btn pri" onClick={() => void entrar()}>{tr('Entrar con Gmail')}</button>{lleno && <button className="btn" onClick={() => setSinCuenta(true)}>{tr('Seguir sin cuenta')}</button>}<a className="btn ghost" href="#/mundial">{tr('Volver a armar mi mundial')}</a></div>}
        {lleno && <p className="note warn">{tr('Cupos llenos por ahora. Puedes seguir jugando sin cuenta; tu avance no se guardará en la nube.')}</p>}
        {errLogin && <p className="note warn">{errLogin}</p>}
      </Section>
    )
  }
  if (step.kind === 'end') return <Reveal t={t} onAgain={() => { location.hash = '#/mundial' }} />

  const br = t.bracket
  const stageTitle = (): string => {
    switch (step.kind) {
      case 'draw': return tr('Sorteo de grupos')
      case 'md': return tr('Resultados por grupos · fecha {n}', { n: step.n })
      case 'pair': return step.r === 'final' ? tr('Así queda el cuadro: tercer puesto y gran final') : tr('Así queda el cuadro: {r}', { r: RN[step.r] })
      case 'play': return PLAYING[step.r]
      case 'third': return tr('Partido por el tercer puesto')
      default: return tr('La gran final')
    }
  }
  const body = () => {
    switch (step.kind) {
      case 'draw': return <DrawGroups key="d" groups={t.groups!} hostTeam={t.world ? HOST_BY_ID[t.world.hostId]?.teamId : undefined} onDone={done} />
      case 'md': {
        const ms = t.groupMatches.filter((m) => m.matchday === step.n)
        const items: Item[] = ms.map((m) => ({ id: m.id, a: m.home, b: m.away, goals: m.goals ?? [], ga: m.hg, gb: m.ag, ctx: m.ctx, tag: `${tr('Grupo')} ${m.group}`, pr: prOf(m.home, m.away, m.ctx) }))
        return <><Board key={`md${step.n}`} items={items} tick={55} onDone={done} />{ready && <><h4 className="sub">{tr('Así quedan los grupos')}</h4><Tables t={t} upTo={step.n} /></>}</>
      }
      case 'pair': return <PairCuadro key={`p${step.r}`} full={br} round={step.r} onDone={done} />
      case 'play': return <Board key={`b${step.r}`} items={br[step.r].map((m) => ({ ...toItem(m), pr: prOf(m.a!, m.b!, m.ctx) }))} tick={60} onDone={done} />
      case 'third': return <><LiveReplay key="t" a={br.third.a!} b={br.third.b!} res={resThird!} onSkip={done} onDone={done} winLabel={tr('se queda con el tercer lugar')} /><CtxLine ctx={br.third.ctx} /></>
      default: return <div className="finalbox"><p className="gf">{tr('GRAN FINAL')}</p><LiveReplay key="f" a={br.final.a!} b={br.final.b!} res={resFinal!} onSkip={done} onDone={done} winLabel={tr('es el campeón del mundial')} /><CtxLine ctx={br.final.ctx} /></div>
    }
  }
  const last = step.kind === 'final'
  return (
    <Section title={tr('Paso {i} de {n}', { i: i + 1, n: steps.length - 1 })} sub={tr('{s} · semilla «{x}»', { s: stageTitle(), x: t.seed })}>
      <div className="vprog"><i style={{ width: `${(i / (steps.length - 1)) * 100}%` }} /></div>
      {step.kind === 'pair' && ready && <div className="cta wiz arriba"><span /><button className="btn pri" onClick={next}>{tr('Continuar')}</button></div>}
      {body()}
      <div className="cta wiz"><span />{ready && <button className="btn pri" onClick={next}>{last ? tr('Conocer al campeón') : tr('Continuar')}</button>}</div>
    </Section>
  )
}
