import { useEffect, useMemo, useState } from 'react'
import { PLAYER_BY_ID, TEAM_BY_ID } from '../data/lookup'
import { tr } from '../i18n'
import { attrLabel, posLabel } from '../i18n/nombres'
import {
  FORMACIONES, NIVELES, NOMBRES_FORMACION, N_PICKS, N_SUPLENTES, RONDAS, equipoMaquina, eligeMaquina, jugarRonda, ofertas, paisesConSinergia, penales, poderAtaque, poderDefensa,
  sedeDuelo, sinergias, valorEquipo, type Cambio, type Equipo, type Nivel, type ResultadoRonda,
} from '../engine/duelo'
import { Avatar, Bar, Flag, usePhoto, useLocalState } from './common'
import { CtxLine } from './world'
import type { MatchCtx, Player } from '../types'

const CLAVE_EQUIPO = 'lwc:duelo:equipo'
const CLAVE_STATS = 'lwc:duelo:stats'
interface Stats { jugados: number; ganados: number; perdidos: number; racha: number; mejorRacha: number }
const STATS0: Stats = { jugados: 0, ganados: 0, perdidos: 0, racha: 0, mejorRacha: 0 }
const nuevaSemilla = (p: string) => `${p}-${Math.random().toString(36).slice(2, 8)}`
const apellido = (n: string) => n.split(' ').slice(-1)[0]
const initials = (n: string) => n.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase()

// Cierra el detalle abierto al tocar fuera del recuadro (o con Esc). Tocar otro jugador o el propio detalle no lo cierra: eso lo maneja cada fila.
function useCerrarFuera(abierto: boolean, cerrar: () => void) {
  useEffect(() => {
    if (!abierto) return
    const fuera = (e: MouseEvent | TouchEvent) => {
      const t = e.target as Element | null
      if (t && t.closest('.d-det, .d-fila, .pn[role="button"]')) return
      cerrar()
    }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') cerrar() }
    document.addEventListener('mousedown', fuera); document.addEventListener('touchstart', fuera); document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', fuera); document.removeEventListener('touchstart', fuera); document.removeEventListener('keydown', esc) }
  }, [abierto, cerrar])
}

// ---------- cancha con los jugadores (mismo estilo que la «Alineación histórica») ----------
type Marca = 'atacante' | 'defensor' | 'cansado' | 'elegible' | 'actual'
function Nodo({ p, x, y, marca, onClick }: { p?: Player; x: number; y: number; marca?: Marca; onClick?: () => void }) {
  const photo = usePhoto(p ?? PLAYER_BY_ID[Object.keys(PLAYER_BY_ID)[0]])
  const Y = 8 + (y / 100) * 104
  if (!p) {
    return (
      <g className={`pn vacio${marca === 'actual' ? ' actual' : ''}`}>
        <circle cx={x} cy={Y} r="5.6" className="hueco" />
        <text x={x} y={Y + 1.5} textAnchor="middle" className="pni">?</text>
      </g>
    )
  }
  const cid = `dn-${p.id}-${Math.round(x)}-${Math.round(y)}`
  const nm = apellido(p.name)
  const w = Math.max(10, nm.length * 2 + 3)
  return (
    <g className={`pn${marca ? ` m-${marca}` : ''}`} data-line={p.line} role={onClick ? 'button' : undefined} tabIndex={onClick ? 0 : undefined} onClick={onClick} onKeyDown={(e) => { if (onClick && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onClick() } }} style={{ cursor: onClick ? 'pointer' : 'default' }} aria-label={`${p.name}, ${p.ovr}`}>
      <clipPath id={cid}><circle cx={x} cy={Y} r="5.6" /></clipPath>
      <circle cx={x} cy={Y} r="6.4" className="ring" />
      {photo ? <image href={photo.url} x={x - 5.6} y={Y - 5.6} width="11.2" height="11.2" preserveAspectRatio="xMidYMin slice" clipPath={`url(#${cid})`} /> : <><circle cx={x} cy={Y} r="5.6" className="fill" /><text x={x} y={Y + 1.5} textAnchor="middle" className="pni">{initials(p.name)}</text></>}
      <rect x={x + 2.6} y={Y + 2.6} width="6" height="3.8" rx="1.2" className="badge" />
      <text x={x + 5.6} y={Y + 5.4} textAnchor="middle" className="pnn">{p.ovr}</text>
      <rect x={x - w / 2} y={Y + 6.8} width={w} height="3.8" rx="1.9" className="tag" />
      <text x={x} y={Y + 9.5} textAnchor="middle" className="pnl">{nm}</text>
      {marca === 'atacante' && <text x={x - 5.8} y={Y - 3.6} className="mk" textAnchor="middle">⚔</text>}
      {marca === 'defensor' && <text x={x - 5.8} y={Y - 3.6} className="mk" textAnchor="middle">🛡</text>}
      {marca === 'cansado' && <text x={x - 5.8} y={Y - 3.6} className="mk" textAnchor="middle">💤</text>}
    </g>
  )
}
function Cancha({ formacion, ids, marcas, onNodo, actual, etiqueta }: { formacion: string; ids: (string | undefined)[]; marcas?: Record<string, Marca>; onNodo?: (i: number) => void; actual?: number; etiqueta: string }) {
  const huecos = FORMACIONES[formacion]
  return (
    <svg viewBox="0 0 100 118" className="pitch duelo-pitch" role="group" aria-label={etiqueta}>
      <defs>
        <linearGradient id="grassD" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#1d4d2b" /><stop offset=".5" stopColor="#16401f" /><stop offset="1" stopColor="#0f3017" /></linearGradient>
      </defs>
      <rect width="100" height="118" rx="5" fill="url(#grassD)" />
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => <rect key={i} x="0" y={i * 14.75} width="100" height="7.4" fill="rgba(255,255,255,.035)" />)}
      <g className="pl"><rect x="3" y="3" width="94" height="112" rx="1" /><line x1="3" y1="59" x2="97" y2="59" /><circle cx="50" cy="59" r="10" /><rect x="24" y="3" width="52" height="16" /><rect x="36" y="3" width="28" height="6" /><rect x="24" y="99" width="52" height="16" /><rect x="36" y="109" width="28" height="6" /></g>
      {huecos.map((h, i) => {
        const id = ids[i]; const p = id ? PLAYER_BY_ID[id] : undefined
        return <Nodo key={i} p={p} x={h.x} y={h.y} marca={actual === i ? 'actual' : id ? marcas?.[id] : undefined} onClick={p && onNodo ? () => onNodo(i) : undefined} />
      })}
    </svg>
  )
}

// ---------- detalle de un jugador (al tocarlo) ----------
function Detalle({ p, bonus = 0, children }: { p: Player; bonus?: number; children?: React.ReactNode }) {
  const t = TEAM_BY_ID[p.teamId]
  const atributos = p.attrs.filter((a) => a.v > 0)
  return (
    <div className="d-det">
      <div className="d-det-top">
        <Avatar p={p} size={72} />
        <div><b>{p.name}</b><span><Flag id={p.teamId} size={16} /> {t.name} · {posLabel(p.pos)}</span></div>
        <em className="d-ovr">{p.ovr}{bonus > 0 && <small>+{bonus}</small>}</em>
      </div>
      <div className="d-poder"><span>⚔ {tr('Ataque')} <b>{Math.round(poderAtaque(p))}</b></span><span>🛡 {tr('Defensa')} <b>{Math.round(poderDefensa(p))}</b></span></div>
      <div>{atributos.map((a) => <Bar key={a.k} label={attrLabel(a.k)} v={a.v} min={40} />)}</div>
      {children}
    </div>
  )
}

function FilaJugador({ p, activo, estado, onClick }: { p: Player; activo?: boolean; estado?: string; onClick?: () => void }) {
  return (
    <button type="button" className={`d-fila${activo ? ' on' : ''}${estado === 'cansado' || estado === 'espera' ? ' off' : ''}`} onClick={onClick}>
      <Avatar p={p} size={40} />
      <span className="d-fn"><b>{p.name}</b><small><span className="pos">{posLabel(p.pos)}</span> {estado === 'cansado' ? `· ${tr('Cansado')}` : estado === 'espera' ? `· ${tr('Entra en la ronda 3')}` : estado === 'suplente' ? `· ${tr('Suplente')}` : ''}</small></span>
      <span className="ovr">{p.ovr}</span>
    </button>
  )
}

// ======================================================================================
export function Duelo() {
  const [equipo, setEquipo] = useLocalState<Equipo | null>(CLAVE_EQUIPO, null)
  const [stats, setStats] = useLocalState<Stats>(CLAVE_STATS, STATS0)
  const [vista, setVista] = useState<'inicio' | 'draft' | 'duelo'>('inicio')
  const [nivel, setNivel] = useState<Nivel>('plata')
  if (vista === 'draft') return <Draft alTerminar={(e) => { setEquipo(e); setVista('inicio') }} alCancelar={() => setVista('inicio')} />
  if (vista === 'duelo' && equipo) return <Partida equipo={equipo} nivel={nivel} alTerminar={(g) => { const s = { ...stats }; s.jugados++; if (g) { s.ganados++; s.racha++; s.mejorRacha = Math.max(s.mejorRacha, s.racha) } else { s.perdidos++; s.racha = 0 } setStats(s) }} alSalir={() => setVista('inicio')} />
  return <Inicio equipo={equipo} stats={stats} nivel={nivel} setNivel={setNivel} armar={() => setVista('draft')} jugar={() => setVista('duelo')} />
}

// ---------- inicio: tu equipo + elegir rival ----------
function Inicio({ equipo, stats, nivel, setNivel, armar, jugar }: { equipo: Equipo | null; stats: Stats; nivel: Nivel; setNivel: (n: Nivel) => void; armar: () => void; jugar: () => void }) {
  const [sel, setSel] = useState<string | null>(null)
  useCerrarFuera(sel !== null, () => setSel(null))
  if (!equipo) {
    return (
      <div className="duelo">
        <header className="d-hero"><p className="kicker">{tr('Nuevo')}</p><h1>{tr('Mi Once Ideal: Duelo')}</h1>
          <p className="muted">{tr('Arma tu once con 3 suplentes eligiendo una leyenda entre tres por puesto. Tu equipo no se cambia: cada decisión cuenta. Luego juega duelos de 5 rondas de unos 4 minutos.')}</p>
          <div className="cta"><button className="btn pri" onClick={armar}>{tr('Armar mi equipo')}</button></div></header>
        <ol className="d-pasos"><li><b>1</b>{tr('Elige una formación y a tus 11 titulares y 3 suplentes.')}</li><li><b>2</b>{tr('Cada ronda eliges un atacante y un defensor; los que uses quedan cansados.')}</li><li><b>3</b>{tr('Gana quien meta más goles. ¡Sube de nivel y arma una racha!')}</li></ol>
      </div>
    )
  }
  const ids = [...equipo.once, ...equipo.suplentes]
  const bonus = sinergias(ids)
  const pais = paisesConSinergia(ids)
  const p = sel ? PLAYER_BY_ID[sel] : null
  return (
    <div className="duelo">
      <header className="d-hero"><p className="kicker">{tr('Mi Once Ideal: Duelo')}</p><h1>{tr('Tu equipo')}</h1>
        <p className="muted">{equipo.formacion} · {tr('Valoración media')} {valorEquipo(equipo)}{pais.length > 0 && <> · {tr('Sinergias')}: {pais.map((s) => `${TEAM_BY_ID[s.teamId].name} +${s.bonus}`).join(', ')}</>}</p></header>
      <div className="d-cols">
        <div>
          <Cancha formacion={equipo.formacion} ids={equipo.once} onNodo={(i) => setSel(equipo.once[i])} etiqueta={tr('Tu equipo')} />
          <h4 className="sub">{tr('Suplentes')}</h4>
          <div className="d-lista">{equipo.suplentes.map((id) => <FilaJugador key={id} p={PLAYER_BY_ID[id]} estado="suplente" activo={sel === id} onClick={() => setSel(id)} />)}</div>
        </div>
        <div>
          {p ? <Detalle p={p} bonus={bonus[p.id] ?? 0}><button className="btn ghost" onClick={() => setSel(null)}>{tr('Cerrar')}</button></Detalle> : (
            <div className="d-lista">{equipo.once.map((id) => <FilaJugador key={id} p={PLAYER_BY_ID[id]} onClick={() => setSel(id)} />)}</div>
          )}
          <h3 className="sub">{tr('Elige a tu rival')}</h3>
          <div className="d-niveles" role="radiogroup" aria-label={tr('Nivel del rival')}>
            {NIVELES.map((n) => <button key={n.id} type="button" role="radio" aria-checked={nivel === n.id} className={`d-nivel n-${n.id}${nivel === n.id ? ' on' : ''}`} onClick={() => setNivel(n.id)}>{tr(n.nombre)}</button>)}
          </div>
          <div className="cta"><button className="btn pri" onClick={jugar}>{tr('Jugar duelo')}</button></div>
          <p className="small muted">{tr('Partidos: {j} · Ganados: {g} · Perdidos: {p} · Racha: {r} (mejor {m})', { j: stats.jugados, g: stats.ganados, p: stats.perdidos, r: stats.racha, m: stats.mejorRacha })}</p>
        </div>
      </div>
    </div>
  )
}

// ---------- draft: armar el equipo ----------
function Draft({ alTerminar, alCancelar }: { alTerminar: (e: Equipo) => void; alCancelar: () => void }) {
  const [formacion, setFormacion] = useState<string | null>(null)
  const [seed] = useState(() => nuevaSemilla('draft'))
  const [elegidos, setElegidos] = useState<string[]>([])
  const [vista, setVista] = useState<string | null>(null)
  const paso = elegidos.length
  const terminado = formacion !== null && paso >= N_PICKS
  const opciones = useMemo(() => (formacion && !terminado ? ofertas(seed, formacion, paso, elegidos) : []), [formacion, paso, seed, terminado]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => setVista(null), [paso])
  useCerrarFuera(vista !== null, () => setVista(null))
  if (!formacion) {
    return (
      <div className="duelo">
        <header className="d-hero"><p className="kicker">{tr('Armar mi equipo')}</p><h1>{tr('Elige tu formación')}</h1><p className="muted">{tr('Después elegirás a cada jugador entre tres leyendas. Tu equipo no se podrá cambiar.')}</p></header>
        <div className="d-formaciones">{NOMBRES_FORMACION.map((f) => (
          <button key={f} type="button" className="d-form" onClick={() => setFormacion(f)}><Cancha formacion={f} ids={[]} etiqueta={f} /><b>{f}</b></button>
        ))}</div>
        <p><button className="btn ghost" onClick={alCancelar}>{tr('Volver')}</button></p>
      </div>
    )
  }
  const huecos = FORMACIONES[formacion]
  const once = elegidos.slice(0, 11)
  const sup = elegidos.slice(11)
  const ids11: (string | undefined)[] = huecos.map((_, i) => once[i])
  const hueco = paso < 11 ? huecos[paso] : null
  const preview = vista ? PLAYER_BY_ID[vista] : null
  const elegir = (id: string) => setElegidos((x) => [...x, id])
  if (terminado) {
    const e: Equipo = { formacion, once, suplentes: sup, creado: Date.now() }
    return (
      <div className="duelo">
        <header className="d-hero"><p className="kicker">{tr('Último paso')}</p><h1>{tr('Tu equipo está listo')}</h1><p className="muted">{formacion} · {tr('Valoración media')} {valorEquipo(e)}</p></header>
        <div className="d-cols">
          <div><Cancha formacion={formacion} ids={once} etiqueta={tr('Tu equipo')} /><h4 className="sub">{tr('Suplentes')}</h4><div className="d-lista">{sup.map((id) => <FilaJugador key={id} p={PLAYER_BY_ID[id]} estado="suplente" />)}</div></div>
          <div>
            <p className="note warn">{tr('Este equipo no se podrá cambiar una vez que lo confirmes.')}</p>
            <div className="cta"><button className="btn pri" onClick={() => alTerminar(e)}>{tr('Confirmar mi equipo')}</button><button className="btn ghost" onClick={() => { setElegidos([]); setFormacion(null) }}>{tr('Empezar de nuevo')}</button></div>
          </div>
        </div>
      </div>
    )
  }
  return (
    <div className="duelo">
      <header className="d-hero"><p className="kicker">{tr('Elección {n} de {t}', { n: paso + 1, t: N_PICKS })}</p>
        <h1>{hueco ? tr('Elige a tu {pos}', { pos: posLabel(hueco.pos) }) : tr('Elige un suplente ({n} de {t})', { n: paso - 10, t: N_SUPLENTES })}</h1>
        <div className="vprog"><i style={{ width: `${(paso / N_PICKS) * 100}%` }} /></div></header>
      <div className="d-cols">
        <div>
          <Cancha formacion={formacion} ids={ids11} actual={hueco ? paso : undefined} etiqueta={tr('Tu equipo')} />
          {sup.length > 0 && <><h4 className="sub">{tr('Suplentes')}</h4><div className="d-lista">{sup.map((id) => <FilaJugador key={id} p={PLAYER_BY_ID[id]} estado="suplente" />)}</div></>}
        </div>
        <div>
          <div className="d-lista">{opciones.map((p) => <FilaJugador key={p.id} p={p} activo={vista === p.id} onClick={() => setVista(p.id)} />)}</div>
          {preview ? (
            <Detalle p={preview}><div className="cta"><button className="btn pri" onClick={() => elegir(preview.id)}>{tr('Elegir a {n}', { n: apellido(preview.name) })}</button></div></Detalle>
          ) : <p className="muted small">{tr('Toca a un jugador para ver su detalle y elegirlo.')}</p>}
        </div>
      </div>
    </div>
  )
}

// ---------- el duelo de 5 rondas ----------
interface Ronda { n: number; res: ResultadoRonda; mio: Cambio; su: Cambio }
function Partida({ equipo, nivel, alTerminar, alSalir }: { equipo: Equipo; nivel: Nivel; alTerminar: (gane: boolean) => void; alSalir: () => void }) {
  const [seed] = useState(() => nuevaSemilla('duelo'))
  const rival = useMemo(() => equipoMaquina(nivel, seed), [nivel, seed])
  const ctx: MatchCtx = useMemo(() => sedeDuelo(seed), [seed])
  const [ronda, setRonda] = useState(1)
  const [cMio, setCMio] = useState<string[]>([])
  const [cSu, setCSu] = useState<string[]>([])
  const [atk, setAtk] = useState<string | null>(null)
  const [def, setDef] = useState<string | null>(null)
  const [sel, setSel] = useState<string | null>(null)
  const [hist, setHist] = useState<Ronda[]>([])
  const [fase, setFase] = useState<'elegir' | 'resultado' | 'fin'>('elegir')
  const [guardado, setGuardado] = useState(false)
  useCerrarFuera(sel !== null, () => setSel(null))
  const golesMios = hist.reduce((s, r) => s + r.res.golesMios, 0), golesSu = hist.reduce((s, r) => s + r.res.golesRival, 0)
  const bonus = useMemo(() => sinergias([...equipo.once, ...equipo.suplentes]), [equipo])
  const disponibles = [...equipo.once, ...(ronda >= 3 ? equipo.suplentes : [])]
  const marcas: Record<string, Marca> = {}
  equipo.once.concat(equipo.suplentes).forEach((id) => { if (cMio.includes(id)) marcas[id] = 'cansado' })
  if (fase === 'elegir') { if (atk) marcas[atk] = 'atacante'; if (def) marcas[def] = 'defensor' }
  const marcasSu: Record<string, Marca> = {}
  rival.once.concat(rival.suplentes).forEach((id) => { if (cSu.includes(id)) marcasSu[id] = 'cansado' })
  const penal = useMemo(() => (fase === 'fin' && golesMios === golesSu ? penales(seed, equipo, rival) : null), [fase, golesMios, golesSu, seed, equipo, rival])
  const gane = fase === 'fin' ? (penal ? penal.yo > penal.rival : golesMios > golesSu) : false
  useEffect(() => { if (fase === 'fin' && !guardado) { setGuardado(true); alTerminar(gane) } }, [fase, guardado, gane, alTerminar])
  const puedeUsar = (id: string) => disponibles.includes(id) && !cMio.includes(id) && PLAYER_BY_ID[id].line !== 'GK'
  const jugar = () => {
    if (!atk || !def) return
    const su = eligeMaquina(seed, ronda, rival, cSu, nivel)
    const mio: Cambio = { atacante: atk, defensor: def }
    const res = jugarRonda(seed, ronda, equipo, rival, mio, su, ctx)
    setHist((h) => [...h, { n: ronda, res, mio, su }])
    setCMio([atk, def]); setCSu([su.atacante, su.defensor])
    setFase('resultado')
  }
  const siguiente = () => {
    if (ronda >= RONDAS) { setFase('fin'); return }
    setRonda((r) => r + 1); setAtk(null); setDef(null); setSel(null); setFase('elegir')
  }
  const ultima = hist[hist.length - 1]
  const nombre = (id: string) => PLAYER_BY_ID[id].name
  const lineaJugada = (j: ResultadoRonda['mia'], mio: boolean) => {
    const a = nombre(j.atacante), d = nombre(j.defensor), g = nombre(j.arquero)
    const txt = j.resultado === 'gol' ? tr('¡GOL de {a}!', { a }) : j.resultado === 'atajada' ? tr('{g} ataja el remate de {a}.', { g, a }) : tr('{d} corta el ataque de {a}.', { d, a })
    return <li className={`d-jug ${j.resultado}${mio ? ' mio' : ''}`}><b>{mio ? tr('Tu ataque') : tr('Su ataque')}</b>{txt}<small>{tr('Probabilidad de gol: {p} %', { p: Math.round(j.pGol * 100) })}</small></li>
  }
  const rivalNombre = tr('Rival {n}', { n: tr(NIVELES.find((n) => n.id === nivel)!.nombre) })
  const p = sel ? PLAYER_BY_ID[sel] : null
  return (
    <div className="duelo">
      <header className="d-marcador">
        <div className="d-eq"><span>{tr('Tú')}</span><b>{golesMios}</b></div>
        <div className="d-centro"><small>{fase === 'fin' ? tr('Final') : tr('Ronda {r} de {t}', { r: ronda, t: RONDAS })}</small><CtxLine ctx={ctx} /></div>
        <div className="d-eq d-su"><b>{golesSu}</b><span>{rivalNombre}</span></div>
      </header>
      {fase === 'fin' ? (
        <div className="d-fin">
          <h1 className={gane ? 'gano' : 'perdio'}>{gane ? tr('¡Ganaste!') : tr('Perdiste')}</h1>
          <p className="muted">{golesMios} – {golesSu}{penal && <> · {tr('Penales {a}–{b}', { a: penal.yo, b: penal.rival })}</>}</p>
          <ol className="d-hist">{hist.map((h) => <li key={h.n}><b>{tr('Ronda {n}', { n: h.n })}</b> <span>{h.res.golesMios}–{h.res.golesRival}</span> <small>{nombre(h.mio.atacante)} · {nombre(h.mio.defensor)}</small></li>)}</ol>
          <div className="cta"><button className="btn pri" onClick={alSalir}>{tr('Volver a mi equipo')}</button></div>
        </div>
      ) : (
        <div className="d-cols">
          <div>
            <Cancha formacion={equipo.formacion} ids={equipo.once} marcas={marcas} onNodo={(i) => setSel(equipo.once[i])} etiqueta={tr('Tu equipo')} />
            <h4 className="sub">{tr('Suplentes')} {ronda < 3 && <small className="muted">({tr('entran desde la ronda 3')})</small>}</h4>
            <div className="d-lista">{equipo.suplentes.map((id) => <FilaJugador key={id} p={PLAYER_BY_ID[id]} estado={cMio.includes(id) ? 'cansado' : ronda < 3 ? 'espera' : 'suplente'} activo={sel === id} onClick={() => setSel(id)} />)}</div>
          </div>
          <div>
            {fase === 'elegir' ? (
              <>
                <div className="d-instr"><b>{tr('Ronda {r}: elige tu ataque y tu defensa', { r: ronda })}</b>
                  <div className="d-chips"><span className="d-chip">⚔ {atk ? nombre(atk) : tr('Atacante')}</span><span className="d-chip">🛡 {def ? nombre(def) : tr('Defensor')}</span></div></div>
                {p ? (
                  <Detalle p={p} bonus={bonus[p.id] ?? 0}>
                    <div className="cta">
                      <button className="btn pri" disabled={!puedeUsar(p.id) || def === p.id} onClick={() => setAtk(p.id)}>⚔ {tr('Atacar con él')}</button>
                      <button className="btn" disabled={!puedeUsar(p.id) || atk === p.id} onClick={() => setDef(p.id)}>🛡 {tr('Defender con él')}</button>
                    </div>
                    {!puedeUsar(p.id) && <p className="small muted">{PLAYER_BY_ID[p.id].line === 'GK' ? tr('El arquero defiende siempre solo.') : cMio.includes(p.id) ? tr('Está cansado: descansa esta ronda.') : tr('Entra desde la ronda 3.')}</p>}
                  </Detalle>
                ) : <p className="muted small">{tr('Toca a un jugador en la cancha o en la lista para ver su detalle y usarlo.')}</p>}
                <div className="d-lista">{equipo.once.filter((id) => PLAYER_BY_ID[id].line !== 'GK').map((id) => <FilaJugador key={id} p={PLAYER_BY_ID[id]} estado={cMio.includes(id) ? 'cansado' : undefined} activo={sel === id || atk === id || def === id} onClick={() => setSel(id)} />)}</div>
                <div className="cta"><button className="btn pri" disabled={!atk || !def} onClick={jugar}>{tr('Jugar ronda')}</button></div>
              </>
            ) : (
              <div className="d-resultado">
                <b>{tr('Resultado de la ronda {r}', { r: ronda })}</b>
                <ul>{ultima && lineaJugada(ultima.res.mia, true)}{ultima && lineaJugada(ultima.res.rival, false)}</ul>
                <div className="cta"><button className="btn pri" onClick={siguiente}>{ronda >= RONDAS ? tr('Ver resultado final') : tr('Siguiente ronda')}</button></div>
              </div>
            )}
            <h4 className="sub">{rivalNombre}</h4>
            <Cancha formacion={rival.formacion} ids={rival.once} marcas={marcasSu} etiqueta={rivalNombre} />
          </div>
        </div>
      )}
    </div>
  )
}
