import { CompartirEquipo, type Red } from './compartir'
import { Component, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { PLAYER_BY_ID, TEAM_BY_ID } from '../data/lookup'
import { tr } from '../i18n'
import { attrLabel, posLabel, posNombre } from '../i18n/nombres'
import {
  FORMACIONES, NIVELES, NOMBRES_FORMACION, N_PICKS, equipoMaquina, ofertas, paisesConSinergia, penales, poderAtaque, poderDefensa, formulaAtaque, formulaDefensa, type Formula,
  TIPOS_PODER, todosLosPoderes, type Poder, type TipoPoder, type Disponibles, type Efecto,
  sedeDuelo, sinergias, valorEquipo, onceDeEjemplo, type Equipo, type Nivel,
} from '../engine/duelo'
import {
  ATAQUES, DEFENSAS, MATRIZ, PESOS_ATAQUE, PESOS_DEFENSA, TURNOS, IMPULSO_ENC, DEBILITAR_ENC, disponibles, quimicaTrio, nivelEquipo, bonoNivelEquipo, bonoNivelMaquina, victoriasParaSubir, type RazonQuimica, encajeAtaque, encajeDefensa, estiloJugador,
  segundosBarra, precision, resolverJugada, eligeAtaqueMaquina, eligeDefensaMaquina, toqueMaquina, mejorDelTrio, bloqueados, aplicarPoderesTrio, reemplazoTrio, eligePoderTrio,
  type Ataque, type Defensa, type Estilo, type DetalleJugada, type HistorialJugada, type Aj,
} from '../engine/jugada'
import { weatherFactor } from '../engine/world'
import { BotonRanking, anotarEnRanking } from './ranking'
import { Avatar, Bar, Flag, usePhoto, useLocalState } from './common'
import { K_AVISO, K_VISTO, guardarDueloNube } from '../cloud/duelo'
import { CtxLine } from './world'
import { favoritaActual } from '../engine/favorita'
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
function Nodo({ p, x, y, marca, onClick, etiqueta, activo, valor }: { p?: Player; x: number; y: number; marca?: Marca; onClick?: () => void; etiqueta?: string; activo?: boolean; valor?: { n: number; t: string } }) {
  const photo = usePhoto(p ?? PLAYER_BY_ID[Object.keys(PLAYER_BY_ID)[0]])
  const Y = 8 + (y / 100) * 104
  if (!p) {
    return (
      <g className={`pn vacio${marca === 'actual' ? ' actual' : ''}${onClick ? ' tocable' : ''}`} role={onClick ? 'button' : undefined} tabIndex={onClick ? 0 : undefined} onClick={onClick} onKeyDown={(e) => { if (onClick && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onClick() } }} aria-label={etiqueta}>
        <circle cx={x} cy={Y} r="5.6" className="hueco" />
        <text x={x} y={Y + 1.5} textAnchor="middle" className="pni">{onClick ? '+' : '?'}</text>
        {etiqueta && <text x={x} y={Y + 9.2} textAnchor="middle" className="pnl vac">{etiqueta}</text>}
      </g>
    )
  }
  const cid = `dn-${p.id}-${Math.round(x)}-${Math.round(y)}`
  const nm = apellido(p.name)
  const w = Math.max(10, nm.length * 2 + 3)
  return (
    <g className={`pn${marca ? ` m-${marca}` : ''}${activo ? ' sel' : ''}${valor ? ` fit-${valor.t}` : ''}`} data-line={p.line} role={onClick ? 'button' : undefined} tabIndex={onClick ? 0 : undefined} onClick={onClick} onKeyDown={(e) => { if (onClick && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onClick() } }} style={{ cursor: onClick ? 'pointer' : 'default' }} aria-label={`${p.name}, ${p.ovr}`}>
      <clipPath id={cid}><circle cx={x} cy={Y} r="5.6" /></clipPath>
      {activo && <><circle cx={x} cy={Y} r="6.4" className="pulso" /><circle cx={x} cy={Y} r="8.3" className="halo" /><circle cx={x} cy={Y} r="7.3" className="halo2" /></>}
      <circle cx={x} cy={Y} r="6.4" className="ring" />
      {photo ? <image href={photo.url} x={x - 5.6} y={Y - 5.6} width="11.2" height="11.2" preserveAspectRatio="xMidYMin slice" clipPath={`url(#${cid})`} /> : <><circle cx={x} cy={Y} r="5.6" className="fill" /><text x={x} y={Y + 1.5} textAnchor="middle" className="pni">{initials(p.name)}</text></>}
      <rect x={x + 2.6} y={Y + 2.6} width="6" height="3.8" rx="1.2" className="badge" />
      <text x={x + 5.6} y={Y + 5.4} textAnchor="middle" className="pnn">{p.ovr}</text>
      <rect x={x - w / 2} y={Y + 6.8} width={w} height="3.8" rx="1.9" className="tag" />
      <text x={x} y={Y + 9.5} textAnchor="middle" className="pnl">{nm}</text>
      {marca === 'atacante' && <text x={x - 5.8} y={Y - 3.6} className="mk" textAnchor="middle">⚽</text>}
      {marca === 'defensor' && <text x={x - 5.8} y={Y - 3.6} className="mk" textAnchor="middle">🛡</text>}
      {marca === 'cansado' && <text x={x - 5.8} y={Y - 3.6} className="mk" textAnchor="middle">💤</text>}
    </g>
  )
}
function Cancha({ formacion, ids, marcas, onNodo, onVacio, actual, etiqueta, sel, valor }: { sel?: string | string[] | null; valor?: (id: string) => { n: number; t: string } | undefined; formacion: string; ids: (string | undefined)[]; marcas?: Record<string, Marca>; onNodo?: (i: number) => void; onVacio?: (i: number) => void; actual?: number; etiqueta: string }) {
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
        return <Nodo key={i} p={p} x={h.x} y={h.y} marca={actual === i ? 'actual' : id ? marcas?.[id] : undefined} onClick={p ? (onNodo ? () => onNodo(i) : undefined) : (onVacio ? () => onVacio(i) : undefined)} etiqueta={!p ? posNombre(h.pos) : undefined} activo={!!id && (Array.isArray(sel) ? sel.includes(id) : id === sel)} valor={id ? valor?.(id) : undefined} />
      })}
    </svg>
  )
}

// Iconos de las redes (trazos simples, un solo color).
function IconoRed({ red }: { red: 'instagram' | 'facebook' | 'x' }) {
  if (red === 'instagram') return <svg viewBox="0 0 24 24" aria-hidden><rect x="3.5" y="3.5" width="17" height="17" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.2" cy="6.8" r="1.1" className="rl" /></svg>
  if (red === 'facebook') return <svg viewBox="0 0 24 24" aria-hidden><path d="M14 8.5h2.4V5.2H14c-2.2 0-3.7 1.5-3.7 3.7v1.8H8v3.2h2.3V21h3.3v-7.3H16l.5-3.2h-2.9V9c0-.3.2-.5.4-.5z" className="rl" /></svg>
  return <svg viewBox="0 0 24 24" aria-hidden><path d="M17.6 4h2.9l-6.3 7.2L21.6 20h-5.8l-4.5-5.9L6.1 20H3.2l6.7-7.7L2.6 4h5.9l4.1 5.4zm-1 14.3h1.6L7.5 5.6H5.8z" className="rl" /></svg>
}

// Botón de compartir, discreto: icono + una palabra, sin competir con las acciones principales.
function BotonCompartir({ onClick, sutil }: { onClick: () => void; sutil?: boolean }) {
  return (
    <button type="button" className={`d-share${sutil ? ' sutil' : ''}`} onClick={onClick} title={tr('Compartir mi equipo')} aria-label={tr('Compartir mi equipo')}>
      <svg viewBox="0 0 24 24" aria-hidden><circle cx="18" cy="5" r="2.6" /><circle cx="6" cy="12" r="2.6" /><circle cx="18" cy="19" r="2.6" /><path d="M8.3 10.8l7.4-4.4M8.3 13.2l7.4 4.4" /></svg>
      <span>{tr('Compartir')}</span>
    </button>
  )
}

// ---------- banca: los tres suplentes, uno al lado del otro ----------
function Banca({ slots, onJugador, onVacio, estado, activo, actual }: { slots: (string | undefined)[]; onJugador?: (id: string) => void; onVacio?: (i: number) => void; estado?: (id: string) => 'cansado' | 'espera' | undefined; activo?: string | null; actual?: number | null }) {
  return (
    <div className="d-banca2" role="group" aria-label={tr('Suplentes')}>
      {slots.map((id, n) => {
        const p = id ? PLAYER_BY_ID[id] : undefined
        if (!p) {
          return (
            <button key={n} type="button" className={`d-sup vacio${onVacio ? ' tocable' : ''}${actual === 11 + n ? ' on' : ''}`} disabled={!onVacio} onClick={() => onVacio?.(n)} aria-label={`${tr('Suplente')} ${n + 1}`}>
              <span className="d-sup-c">+</span><small>{tr('Suplente')} {n + 1}</small>
            </button>
          )
        }
        const est = estado?.(p.id)
        return (
          <button key={n} type="button" className={`d-sup${activo === p.id ? ' on' : ''}${est ? ' off' : ''}`} onClick={() => onJugador?.(p.id)} aria-label={`${p.name}, ${p.ovr}`}>
            <span className="d-sup-c"><Avatar p={p} size={64} /><i className="d-sup-ovr">{p.ovr}</i>{est === 'cansado' && <em aria-hidden>💤</em>}</span>
            <small>{apellido(p.name)}</small>
            {est === 'espera' && <small className="d-sup-nota">{tr('Entra en la ronda 3')}</small>}
          </button>
        )
      })}
    </div>
  )
}

// ---------- detalle de un jugador (al tocarlo) ----------
const textoFormula = (f: Formula | null) => (f ? f.pesos.map(([k, w]) => `${attrLabel(k)} ${Math.round(w * 100)}%`).join(' · ') + (f.ajuste ? ` ${f.ajuste}` : '') : '')

function Detalle({ p, bonus = 0, rol, children }: { p: Player; bonus?: number; rol?: 'atk' | 'def'; children?: React.ReactNode }) {
  const t = TEAM_BY_ID[p.teamId]
  const atributos = p.attrs.filter((a) => a.v > 0)
  return (
    <div className="d-det">
      <div className="d-det-top">
        <Avatar p={p} size={72} />
        <div><b>{p.name}</b><span><Flag id={p.teamId} size={16} /> {t.name} · {posLabel(p.pos)}</span></div>
        <em className="d-ovr">{p.ovr}{bonus > 0 && <small>+{bonus}</small>}</em>
      </div>
      <div className="d-poder"><span>⚽ {tr('Poder de ataque')} <b>{Math.round(poderAtaque(p))}</b>{bonus > 0 && <small>+{bonus}</small>}</span><span>🛡 {tr('Poder de defensa')} <b>{Math.round(poderDefensa(p))}</b>{bonus > 0 && <small>+{bonus}</small>}</span></div>
      <p className="d-explica">{p.line === 'GK' ? tr('Los arqueros no atacan ni defienden: su valor está en las paradas.') : <>{rol !== 'def' && <>{tr('Poder de ataque')}: {textoFormula(formulaAtaque(p))}. </>}{rol !== 'atk' && <>{tr('Poder de defensa')}: {textoFormula(formulaDefensa(p))}. </>}{tr('No es la valoración general ({n}): solo cuenta lo que importa en esa jugada.', { n: p.ovr })}{bonus > 0 && <> {tr('«+{n}» es la sinergia de su país.', { n: bonus })}</>}</>}</p>
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
// Partida en curso: solo un marcador, para saber si se abandonó (el partido es en vivo y no se retoma).
const CLAVE_PARTIDA = 'lwc:duelo:partida'
interface Guardada { creado: number; nivel?: Nivel }
const leerPartida = (): Guardada | null => { try { const s = localStorage.getItem(CLAVE_PARTIDA); return s ? (JSON.parse(s) as Guardada) : null } catch { return null } }
const borrarPartida = () => { try { localStorage.removeItem(CLAVE_PARTIDA) } catch { /* sin almacenamiento */ } }
function partidaVigente(): Guardada | null {
  const g = leerPartida(); if (!g) return null
  try { const e = JSON.parse(localStorage.getItem(CLAVE_EQUIPO) ?? 'null') as Equipo | null; if (e && e.creado === g.creado) return g } catch { /* equipo ilegible */ }
  borrarPartida(); return null
}

// Si algo falla dentro del duelo, en vez de dejar la pantalla en blanco se muestra un aviso y una forma de seguir (sin tocar tu equipo).
class DueloSeguro extends Component<{ children: ReactNode }, { error: string | null }> {
  state = { error: null as string | null }
  static getDerivedStateFromError(e: unknown) { return { error: e instanceof Error ? e.message : String(e) } }
  render() {
    if (this.state.error === null) return this.props.children
    return (
      <div className="duelo" style={{ padding: '40px 0', textAlign: 'center' }}>
        <h2>{tr('Algo salió mal en el duelo')}</h2>
        <p className="muted">{tr('Tu equipo está a salvo. Reinicia el duelo para seguir.')}</p>
        <p className="small muted" style={{ wordBreak: 'break-word' }}>{this.state.error}</p>
        <div className="cta" style={{ justifyContent: 'center' }}><button className="btn pri" onClick={() => { borrarPartida(); location.reload() }}>{tr('Reiniciar el duelo')}</button></div>
      </div>
    )
  }
}
// Si administración ajustó el equipo (a pedido de la persona), se lo avisamos una vez.
function AvisoEquipoEditado() {
  const [en, setEn] = useState<string | null>(() => { try { return localStorage.getItem(K_AVISO) } catch { return null } })
  if (!en) return null
  const visto = () => { try { localStorage.setItem(K_VISTO, en); localStorage.removeItem(K_AVISO) } catch { /* sin almacenamiento */ } setEn(null) }
  return <div className="note" role="status"><span>{tr('Un administrador ajustó tu equipo del Duelo a pedido tuyo. Ya está guardado en tu cuenta.')}</span> <button type="button" className="btn" onClick={visto}>{tr('Entendido')}</button></div>
}

export function Duelo() { return <DueloSeguro><AvisoEquipoEditado /><DueloPantallas /></DueloSeguro> }

function DueloPantallas() {
  const [equipo, setEquipo] = useLocalState<Equipo | null>(CLAVE_EQUIPO, null)
  const [stats, setStats] = useLocalState<Stats>(CLAVE_STATS, STATS0)
  useEffect(() => { guardarDueloNube(equipo, stats) }, [equipo, stats]) // con cuenta, el equipo y las estadísticas también quedan en la nube
  // El partido es en vivo: si se sale o se actualiza la página a mitad de partido, queda abandonado (cuenta como derrota) y no se retoma.
  const [abandonada] = useState(() => partidaVigente() !== null)
  const [vista, setVista] = useState<'inicio' | 'draft' | 'duelo'>('inicio')
  const [nivel, setNivel] = useState<Nivel>('plata')
  useEffect(() => {
    const g = partidaVigente()
    if (!g) return
    borrarPartida()
    anotarEnRanking(g.nivel ?? 'plata', false)
    setStats({ ...stats, jugados: stats.jugados + 1, perdidos: stats.perdidos + 1, racha: 0 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  if (vista === 'draft') return <Draft alTerminar={(e) => { setEquipo(e); setVista('inicio') }} alCancelar={() => setVista('inicio')} />
  if (vista === 'duelo' && equipo) return <Partida equipo={equipo} nivel={nivel} ganados={stats.ganados} alTerminar={(g) => { anotarEnRanking(nivel, g); const s = { ...stats }; s.jugados++; if (g) { s.ganados++; s.racha++; s.mejorRacha = Math.max(s.mejorRacha, s.racha) } else { s.perdidos++; s.racha = 0 } setStats(s) }} alSalir={() => setVista('inicio')} />
  return <Inicio equipo={equipo} stats={stats} nivel={nivel} setNivel={setNivel} aviso={abandonada} armar={() => setVista('draft')} jugar={() => setVista('duelo')} />
}

// ---------- presentación (sin equipo todavía): lo que hay que ver para querer jugar ----------
const EJEMPLO = onceDeEjemplo('4-3-3')
const TRIO = ['por-cristiano-ronaldo', 'arg-lionel-messi', 'bra-pele'].filter((id) => PLAYER_BY_ID[id])
function Presentacion({ armar }: { armar: () => void }) {
  return (
    <div className="duelo d-land">
      <section className="d-portada">
        <div className="d-portada-txt">
          <p className="kicker">⚽ {tr('Nuevo')}</p>
          <h1>{tr('Prepárate para competir y ganar')}<br /><span>{tr('con tu equipo ideal.')}</span></h1>
          <p className="d-bajada">{tr('Elige a las mayores leyendas de la historia, entrena en duelos de 3 turnos contra la máquina y compite en el ranking.')}</p>
          <ul className="d-chips-top"><li>⏱ {tr('2 minutos por duelo')}</li><li>🎲 {tr('Cada draft es distinto')}</li><li>🔒 {tr('Tu equipo es para siempre')}</li><li className="d-pronto">🏆 {tr('Ranking con otras personas')}</li></ul>
          <div className="cta"><button className="btn pri d-gran" onClick={armar}>{tr('Armar mi equipo')} →</button></div>
          <p className="small muted">{tr('Toma 2 minutos y es gratis.')}</p>
        </div>
        <figure className="d-portada-img">
          <div className="d-brillo" aria-hidden />
          <Cancha formacion="4-3-3" ids={EJEMPLO} etiqueta={tr('Un once de ejemplo: el tuyo será distinto.')} />
          <figcaption className="small muted">{tr('Un once de ejemplo: el tuyo será distinto.')}</figcaption>
        </figure>
      </section>
      <ol className="d-pasos2">
        <li><span className="d-paso-n">1</span><div className="d-trio">{TRIO.map((id) => <Avatar key={id} p={PLAYER_BY_ID[id]} size={44} />)}</div><b>{tr('Elige 1 de 3')}</b><p>{tr('En cada puesto te ofrecemos tres leyendas. Tú decides quién entra a tu once.')}</p></li>
        <li><span className="d-paso-n">2</span><div className="d-iconos"><i>⚽</i><i>🛡</i></div><b>{tr('Ataca y defiende')}</b><p>{tr('Cada ronda eliges un atacante y un defensor. Los que uses se cansan: rota a tu plantel.')}</p></li>
        <li><span className="d-paso-n">3</span><div className="d-medallas"><i className="n-bronce" /><i className="n-plata" /><i className="n-oro" /><i className="n-leyenda" /></div><b>{tr('Sube de nivel')}</b><p>{tr('Vence a la máquina de Bronce a Leyenda y prepárate para el ranking.')}</p></li>
      </ol>
      <p className="d-sinergia">🤝 {tr('Tres jugadores de un mismo país dan una sinergia: más fuerza para todo tu equipo.')}</p>
      <div className="cta d-cierre"><button className="btn pri d-gran" onClick={armar}>{tr('Armar mi equipo')} →</button></div>
    </div>
  )
}

// ---------- inicio: tu equipo + elegir rival ----------
function Inicio({ equipo, stats, nivel, setNivel, armar, jugar, aviso }: { equipo: Equipo | null; stats: Stats; nivel: Nivel; setNivel: (n: Nivel) => void; armar: () => void; jugar: () => void; aviso?: boolean }) {
  const [sel, setSel] = useState<string | null>(null)
  const [compartir, setCompartir] = useState<Red | boolean>(false)
  useCerrarFuera(sel !== null, () => setSel(null))
  if (!equipo) return <Presentacion armar={armar} />
  const ids = [...equipo.once, ...equipo.suplentes]
  const bonus = sinergias(ids)
  const pais = paisesConSinergia(ids)
  const p = sel ? PLAYER_BY_ID[sel] : null
  const mejor = ids.map((id) => PLAYER_BY_ID[id]).sort((a, b) => b.ovr - a.ovr)[0]
  return (
    <div className="duelo">
      {compartir && <CompartirEquipo equipo={equipo} red={typeof compartir === 'string' ? compartir : undefined} onClose={() => setCompartir(false)} />}
      <header className="d-hero"><BotonRanking compacto /><p className="kicker">{tr('Mi Once Ideal: Duelo')}</p><h1>{tr('Tu equipo')}</h1>
        <p className="muted">{equipo.formacion} · {tr('Valoración media')} {valorEquipo(equipo)}{pais.length > 0 && <> · {tr('Sinergias')}: {pais.map((s) => `${TEAM_BY_ID[s.teamId].name} +${s.bonus}`).join(', ')}</>}</p></header>
      {aviso && <p className="d-aviso" role="status">⚠ {tr('Abandonaste el partido anterior al salir o actualizar la página: cuenta como derrota.')}</p>}
      <div className="d-cols d-cols-eq">
        <div className="d-c-cancha">
          <Cancha formacion={equipo.formacion} ids={equipo.once} onNodo={(i) => setSel(equipo.once[i])} sel={sel} etiqueta={tr('Tu equipo')} />
        </div>
        <div className="d-c-banca">
          <h4 className="sub">{tr('Suplentes')}</h4>
          <Banca slots={equipo.suplentes} activo={sel} onJugador={(id) => setSel(id)} />
        </div>
        <div className="d-c-panel">
          {p ? <Detalle p={p} bonus={bonus[p.id] ?? 0}><button className="btn ghost" onClick={() => setSel(null)}>{tr('Cerrar')}</button></Detalle> : (
            <div className="d-resumen-eq">
              <div className="d-kpis">
                <div><b>{valorEquipo(equipo)}</b><span>{tr('Valoración media')}</span></div>
                <div><b>{mejor.ovr}</b><span>{apellido(mejor.name)}</span></div>
                <div><b>{pais.length}</b><span>{tr('Sinergias')}</span></div>
              </div>
              <div className="d-nivel-eq"><div><b>⭐ {tr('Nivel de equipo {n}', { n: nivelEquipo(stats.ganados) })}</b><span>{tr('Suma +{b} a todas tus jugadas. Sube con cada victoria, de a poco.', { b: bonoNivelEquipo(stats.ganados) })}</span></div><div className="d-nivel-bar"><i style={{ width: `${Math.round(((stats.ganados - (nivelEquipo(stats.ganados) - 1) ** 2) / (nivelEquipo(stats.ganados) ** 2 - (nivelEquipo(stats.ganados) - 1) ** 2)) * 100)}%` }} /></div><small>{tr('Faltan {n} victorias para el nivel {m}', { n: victoriasParaSubir(stats.ganados), m: nivelEquipo(stats.ganados) + 1 })}</small></div>
              <p className="muted small">{tr('Toca a un jugador de la cancha para ver su detalle.')}</p>
              <div className="d-redes" role="group" aria-label={tr('Compartir mi equipo')}>
                <span>{tr('Compartir')}</span>
                {(['instagram', 'facebook', 'x'] as Red[]).map((r) => <button key={r} type="button" className={`d-red ${r}`} onClick={() => setCompartir(r)} title={`${tr('Compartir mi equipo')} · ${r === 'x' ? 'X' : r[0].toUpperCase() + r.slice(1)}`} aria-label={r === 'x' ? 'X' : r[0].toUpperCase() + r.slice(1)}><IconoRed red={r} /></button>)}
              </div>
            </div>
          )}
          <div className="d-rival"><h3 className="sub">{tr('Elige a tu rival')}</h3>
          <div className="d-niveles" role="radiogroup" aria-label={tr('Nivel del rival')}>
            {NIVELES.map((n) => <button key={n.id} type="button" role="radio" aria-checked={nivel === n.id} className={`d-nivel n-${n.id}${nivel === n.id ? ' on' : ''}`} onClick={() => setNivel(n.id)}><i aria-hidden className="d-estr">{'★'.repeat(NIVELES.findIndex((x) => x.id === n.id) + 1)}</i><span>{tr(n.nombre)}</span></button>)}
          </div></div>
          <div className="d-accion"><button type="button" className="btn pri d-jugar-gran" onClick={jugar}>{tr('Jugar duelo')} →</button>
          <p className="small muted">{tr('Partidos: {j} · Ganados: {g} · Perdidos: {p} · Racha: {r} (mejor {m})', { j: stats.jugados, g: stats.ganados, p: stats.perdidos, r: stats.racha, m: stats.mejorRacha })}</p></div>
        </div>
      </div>
    </div>
  )
}

// ---------- draft: armar el equipo ----------
// La persona elige el puesto en la cancha, toca «Sacar jugadores» y le tocan tres al azar (con un reveal); elige uno. Cada puesto guarda lo que le tocó.
function Draft({ alTerminar, alCancelar }: { alTerminar: (e: Equipo) => void; alCancelar: () => void }) {
  const [formacion, setFormacion] = useState<string | null>(null)
  const [seed] = useState(() => nuevaSemilla('draft'))
  const [picks, setPicks] = useState<(string | undefined)[]>(() => new Array(N_PICKS).fill(undefined))
  const [slot, setSlot] = useState<number | null>(null)
  const [sacadas, setSacadas] = useState<Record<number, string[]>>({})
  const [vista, setVista] = useState<string | null>(null)
  const [barajando, setBarajando] = useState(false)
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
  const elegidos = picks.filter((x): x is string => !!x)
  const completo = elegidos.length === N_PICKS
  const once = picks.slice(0, 11) as string[]
  const sup = picks.slice(11) as string[]
  const nombreSlot = (i: number) => (i < 11 ? posNombre(huecos[i].pos) : tr('Suplente'))
  const sacar = (i: number | null = slot) => {
    if (i === null) return
    setSlot(i); setBarajando(true); setVista(null)
    setTimeout(() => { setSacadas((m) => ({ ...m, [i]: m[i] ?? ofertas(seed, formacion, i, elegidos, favoritaActual() ?? '').map((p) => p.id) })); setBarajando(false) }, 650)
  }
  const siguienteVacio = picks.findIndex((x) => !x)
  const elegir = (id: string) => {
    if (slot === null) return
    setPicks((x) => { const y = [...x]; y[slot] = id; return y })
    setSlot(null); setVista(null)
  }
  if (completo) {
    const e: Equipo = { formacion, once, suplentes: sup, creado: Date.now() }
    return (
      <div className="duelo">
        <header className="d-hero"><p className="kicker">{tr('Último paso')}</p><h1>{tr('Tu equipo está listo')}</h1><p className="muted">{formacion} · {tr('Valoración media')} {valorEquipo(e)}</p></header>
        <div className="d-cols">
          <div><Cancha formacion={formacion} ids={once} onNodo={(i) => setVista(once[i])} sel={vista} etiqueta={tr('Tu equipo')} /><h4 className="sub">{tr('Suplentes')}</h4><Banca slots={sup} activo={vista} onJugador={(id) => setVista(id)} /></div>
          <div>
            {vista && <Detalle p={PLAYER_BY_ID[vista]} />}
            <p className="note warn">{tr('Este equipo no se podrá cambiar una vez que lo confirmes.')}</p>
            <div className="cta"><button className="btn pri" onClick={() => alTerminar(e)}>{tr('Confirmar mi equipo')}</button><button className="btn ghost" onClick={() => { setPicks(new Array(N_PICKS).fill(undefined)); setSacadas({}); setSlot(null); setFormacion(null) }}>{tr('Empezar de nuevo')}</button></div>
          </div>
        </div>
      </div>
    )
  }
  const ofrecidos = slot !== null ? sacadas[slot] : undefined
  const preview = vista ? PLAYER_BY_ID[vista] : null
  const esOferta = !!(preview && ofrecidos?.includes(preview.id))
  return (
    <div className="duelo">
      <header className="d-hero"><p className="kicker">{tr('Puestos armados: {n} de {t}', { n: elegidos.length, t: N_PICKS })}</p>
        <h1>{slot === null ? tr('Elige un puesto') : slot < 11 ? tr('Elige a tu {pos}', { pos: nombreSlot(slot) }) : tr('Elige a tu suplente')}</h1>
        <div className="vprog"><i style={{ width: `${(elegidos.length / N_PICKS) * 100}%` }} /></div></header>
      <div className="d-cols">
        <div>
          <Cancha formacion={formacion} ids={picks.slice(0, 11)} actual={slot !== null && slot < 11 ? slot : undefined} onNodo={(i) => setVista(picks[i] ?? null)} onVacio={(i) => { setSlot(i); setVista(null) }} sel={vista} etiqueta={tr('Tu equipo')} />
          <h4 className="sub">{tr('Suplentes')}</h4>
          <Banca slots={[picks[11], picks[12], picks[13]]} activo={vista} actual={slot} onJugador={(id) => setVista(id)} onVacio={(n) => { setSlot(11 + n); setVista(null) }} />
        </div>
        <div>
          {slot === null ? (
            <div className="d-vacio d-ini">
              <span className="d-dado" aria-hidden>🎲</span>
              <h3>{tr('¡Hora de armar tu once!')}</h3>
              <button className="btn pri d-gran" onClick={() => sacar(siguienteVacio)}>🎲 {tr('Sacar jugadores')} · {siguienteVacio < 11 ? nombreSlot(siguienteVacio) : tr('Suplente')}</button>
              <p className="d-o"><span>{tr('o elige tú el puesto')}</span></p>
              <p className="small muted">← {tr('Toca un puesto vacío de la cancha para sacar jugadores.')}</p>
            </div>
          ) : barajando ? (
            <div className="d-vacio d-baraja"><span aria-hidden>🎲</span><p>{tr('Sacando jugadores…')}</p></div>
          ) : !ofrecidos ? (
            <div className="d-vacio"><p><b>{slot < 11 ? nombreSlot(slot) : tr('Suplente')}</b></p><button className="btn pri d-gran" onClick={() => sacar()}>🎲 {tr('Sacar jugadores')}</button><p className="small muted">{tr('Te tocarán tres leyendas al azar para este puesto.')}</p></div>
          ) : (
            <>
              <p className="d-toco">{tr('Te tocaron estos tres. ¡Elige a uno!')}</p>
              <div className="d-lista d-sobre">{ofrecidos.map((id) => <FilaJugador key={id} p={PLAYER_BY_ID[id]} activo={vista === id} onClick={() => setVista(id)} />)}</div>
              {preview && esOferta ? (
                <Detalle p={preview}><div className="cta"><button className="btn pri" onClick={() => elegir(preview.id)}>{tr('Elegir a {n}', { n: apellido(preview.name) })}</button></div></Detalle>
              ) : <p className="muted small">{tr('Toca a un jugador para ver su detalle y elegirlo.')}</p>}
            </>
          )}
          {preview && !esOferta && <Detalle p={preview} />}
        </div>
      </div>
    </div>
  )
}

// ---------- el partido: armar la jugada ----------
// Por turnos (10 en total): un equipo ataca y el otro defiende. Cada lado elige estrategia y 3 jugadores en secreto; se revelan, se
// juegan poderes, y quien ejecuta la jugada detiene la barra: cuanto más cerca del centro, más probabilidad.
const ICONO_ATAQUE: Record<Ataque, string> = { contra: '⚡', bandas: '↔', centro: '🎯', largo: '🚀' }
const ICONO_DEFENSA: Record<Defensa, string> = { presion: '🔥', bloque: '🧱', marca: '🧲', cierre: '🚧' }
const nombreAtaque = (e: Ataque) => (e === 'contra' ? tr('Contragolpe') : e === 'bandas' ? tr('Bandas') : e === 'centro' ? tr('Pase al centro') : tr('Balón largo'))
const nombreDefensa = (e: Defensa) => (e === 'presion' ? tr('Presión alta') : e === 'bloque' ? tr('Bloque bajo') : e === 'marca' ? tr('Marca al hombre') : tr('Cerrar bandas'))
const descAtaque = (e: Ataque) => (e === 'contra' ? tr('Salida veloz al espacio.') : e === 'bandas' ? tr('Centros y diagonales por los costados.') : e === 'centro' ? tr('Pared y pase filtrado por el medio.') : tr('Pelotazo al área para ganar arriba.'))
const descDefensa = (e: Defensa) => (e === 'presion' ? tr('Roba arriba, pero deja espacio atrás.') : e === 'bloque' ? tr('Cierra el área con todos atrás.') : e === 'marca' ? tr('Cada defensa pega a su hombre.') : tr('Protege los costados y deja el centro.'))
const nombreEst = (e: Ataque | Defensa, ataca: boolean) => (ataca ? nombreAtaque(e as Ataque) : nombreDefensa(e as Defensa))
const iconoEst = (e: Ataque | Defensa, ataca: boolean) => (ataca ? ICONO_ATAQUE[e as Ataque] : ICONO_DEFENSA[e as Defensa])
const pesosEst = (e: Ataque | Defensa, ataca: boolean) => (ataca ? PESOS_ATAQUE[e as Ataque] : PESOS_DEFENSA[e as Defensa])
const ICONO_ESTILO: Record<Estilo, string> = { veloz: '⚡', regateador: '🌀', fuerte: '💪', pasador: '🧠', goleador: '🎯', muro: '🛡' }
const nombreEstilo = (s: Estilo) => (s === 'veloz' ? tr('Veloz') : s === 'regateador' ? tr('Regateador') : s === 'fuerte' ? tr('Fuerte') : s === 'pasador' ? tr('Pasador') : s === 'goleador' ? tr('Goleador') : tr('Muro'))
// Mensaje tipo Pokémon desde el punto de vista de quien lo lee (nivel +2 = muy a su favor).
const mensajeEfecto = (n: number) => (n >= 2 ? tr('¡Súper efectivo!') : n === 1 ? tr('Efectivo') : n === 0 ? tr('Parejo') : n === -1 ? tr('Poco efectivo…') : tr('Casi no tiene efecto…'))
const claseEfecto = (n: number) => (n >= 2 ? 'sup' : n === 1 ? 'efe' : n === 0 ? 'par' : n === -1 ? 'poc' : 'nul')

// Una ficha de estrategia (para elegir o para mostrar revelada).
function FichaEstrategia({ e, ataca, sel, onClick, mini }: { e: Ataque | Defensa; ataca: boolean; sel?: boolean; onClick?: () => void; mini?: boolean }) {
  return (
    <button type="button" disabled={!onClick} onClick={onClick} className={`d-est ${ataca ? 'atk' : 'def'}${sel ? ' on' : ''}${mini ? ' mini' : ''}`}>
      <span className="ic" aria-hidden>{iconoEst(e, ataca)}</span>
      <b>{nombreEst(e, ataca)}</b>
      {!mini && <small>{ataca ? descAtaque(e as Ataque) : descDefensa(e as Defensa)}</small>}
      {!mini && <span className="d-est-attr">{pesosEst(e, ataca).slice(0, 2).map(([k]) => attrLabel(k)).join(' · ')}</span>}
    </button>
  )
}

// La tabla de efectividad (como la de tipos de Pokémon): siempre a mano.
function TablaEfectividad({ onClose, ataca, actual }: { onClose: () => void; ataca: boolean; actual?: { a?: Ataque; d?: Defensa } }) {
  useEffect(() => { const f = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }; window.addEventListener('keydown', f); return () => window.removeEventListener('keydown', f) }, [onClose])
  const celda = (n: number) => (n >= 2 ? '✅✅' : n === 1 ? '✅' : n === 0 ? '➖' : n === -1 ? '❌' : '❌❌')
  return createPortal(
    <div className="modal-bg" role="dialog" aria-modal="true" aria-label={tr('Tabla de efectividad')} onClick={onClose}>
      <div className="modal d-tabla" onClick={(e) => e.stopPropagation()}>
        <h3>{tr('Tabla de efectividad')}</h3>
        <p className="muted small">{tr('Cada estrategia de ataque contra cada defensa. ✅✅ súper efectivo para el ataque, ❌❌ la defensa casi lo anula.')}</p>
        <div className="tscroll"><table className="gt">
          <thead><tr><th className="l">{tr('Ataque')} ↓ / {tr('Defensa')} →</th>{DEFENSAS.map((d) => <th key={d} className={actual?.d === d ? 'hl' : ''}><span aria-hidden>{ICONO_DEFENSA[d]}</span> {nombreDefensa(d)}</th>)}</tr></thead>
          <tbody>{ATAQUES.map((a) => <tr key={a} className={actual?.a === a ? 'hl' : ''}><th className="l"><span aria-hidden>{ICONO_ATAQUE[a]}</span> {nombreAtaque(a)}</th>{DEFENSAS.map((d) => <td key={d} className={`c${MATRIZ[a][d]}${actual?.a === a && actual?.d === d ? ' hl' : ''}`}>{celda(MATRIZ[a][d])}</td>)}</tr>)}</tbody>
        </table></div>
        <p className="small muted">{ataca ? tr('Tú atacas: busca la fila que mejor le gane a lo que crees que usará el rival.') : tr('Tú defiendes: busca la columna que frene lo que crees que atacará el rival.')}</p>
        <div className="cta"><button className="btn pri" onClick={onClose}>{tr('Entendido')}</button></div>
      </div>
    </div>, document.body)
}

interface Eleccion { est: Ataque | Defensa; trio: string[] }
interface Cambio { de: string; a: string }
interface TurnoHist { n: number; ataca: 'mio' | 'su'; det: DetalleJugada; pw?: { mio?: Poder; su?: Poder; efectos: Efecto[]; cambioMio?: Cambio; cambioSu?: Cambio } }
const CLAVE_ABIERTA = CLAVE_PARTIDA // marcador de partido en curso (para detectar que se abandonó)

// El partido, en 3 pasos por turno: 1) estrategia, 2) tres jugadores, 3) detener el balón en el centro. Después solo la animación.
function Partida({ equipo, nivel, ganados, alTerminar, alSalir }: { equipo: Equipo; nivel: Nivel; ganados: number; alTerminar: (gane: boolean) => void; alSalir: () => void }) {
  const [seed] = useState(() => nuevaSemilla('duelo'))
  const rival = useMemo(() => equipoMaquina(nivel, seed), [nivel, seed])
  const ctx: MatchCtx = useMemo(() => sedeDuelo(seed), [seed])
  const [turno, setTurno] = useState(1)
  const [fase, setFase] = useState<'estrategia' | 'trio' | 'barra' | 'resultado' | 'fin'>('estrategia')
  const [est, setEst] = useState<Ataque | Defensa | null>(null)
  const [trio, setTrio] = useState<string[]>([])
  const [su, setSu] = useState<Eleccion | null>(null)
  const [cMio, setCMio] = useState<string[]>([])
  const [cSu, setCSu] = useState<string[]>([])
  const [hist, setHist] = useState<TurnoHist[]>([])
  const [pwMios, setPwMios] = useState<Disponibles>(todosLosPoderes())
  const [pwSu, setPwSu] = useState<Disponibles>(todosLosPoderes())
  const [pwTipo, setPwTipo] = useState<TipoPoder | null>(null)
  const [ejec, setEjec] = useState<string | null>(null)
  const [tabla, setTabla] = useState(false)
  const [compartir, setCompartir] = useState(false)
  const [guardado, setGuardado] = useState(false)
  const [escenaFin, setEscenaFin] = useState(false) // la animación ya reveló el resultado (hasta entonces el marcador no se actualiza)
  const [vel, setVel] = useLocalState<'normal' | 'rapida'>('lwc:duelo:vel', 'normal')
  const ataca = turno % 2 === 1 // los turnos impares ataca la persona
  const turnoHist = hist.length && hist[hist.length - 1].n === turno ? hist[hist.length - 1] : null
  const det = turnoHist?.det ?? null
  const sin = useMemo(() => ({ mio: sinergias([...equipo.once, ...equipo.suplentes]), su: sinergias([...rival.once, ...rival.suplentes]) }), [equipo, rival])
  const ajSin = (m: Record<string, number>): Aj => Object.fromEntries(Object.entries(m).map(([k, v]) => [k, v * 2]))
  const histIA = (): HistorialJugada[] => hist.map((h) => ({ ataca: h.ataca === 'mio' ? 'su' : 'mio', ataque: h.det.est.ataque, defensa: h.det.est.defensa }))
  const visibles = hist.filter((h) => !(fase === 'resultado' && !escenaFin && h.n === turno))
  const golesMios = visibles.filter((h) => h.det.resultado === 'gol' && h.ataca === 'mio').length
  const golesSu = visibles.filter((h) => h.det.resultado === 'gol' && h.ataca === 'su').length
  const penal = useMemo(() => (fase === 'fin' && golesMios === golesSu ? penales(seed, equipo, rival) : null), [fase, golesMios, golesSu, seed, equipo, rival])
  const gane = fase === 'fin' ? (penal ? penal.yo > penal.rival : golesMios > golesSu) : false
  useEffect(() => { if (fase === 'fin' && !guardado) { setGuardado(true); borrarPartida(); alTerminar(gane) } }, [fase, guardado, gane, alTerminar])
  useEffect(() => { if (fase !== 'fin') { try { localStorage.setItem(CLAVE_ABIERTA, JSON.stringify({ creado: equipo.creado, nivel })) } catch { /* sin almacenamiento */ } } }, [fase, equipo.creado, nivel])

  // en celular, al cambiar de paso se lleva a la vista el panel de pasos (o la cancha al elegir los 3 jugadores)
  useEffect(() => {
    if (window.innerWidth > 1100) return
    const el = document.querySelector(fase === 'trio' ? '.d-versus .d-lado.mio' : '.d-versus .d-medio')
    el?.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
  }, [fase, turno])
  const libres = disponibles(equipo, turno, cMio)
  const puede = (id: string) => libres.includes(id)
  const sinM = ajSin(sin.mio), sinS = ajSin(sin.su)
  const fit = (id: string, e: Ataque | Defensa, aj: Aj = sinM) => Math.round(ataca ? encajeAtaque(id, e as Ataque, aj) : encajeDefensa(id, e as Defensa, aj))
  const tono = (n: number) => (n >= 85 ? 'alto' : n >= 70 ? 'medio' : 'bajo')
  const nombre = (id: string) => PLAYER_BY_ID[id].name

  // paso 1 → 2: elegir estrategia; paso 2 → 3: confirmar el trío (la máquina elige en secreto)
  const elegirEstrategia = (e: Ataque | Defensa) => { setEst(e); setTrio([]); setFase('trio') }
  const toggleJugador = (id: string) => {
    if (fase !== 'trio' || !est || !puede(id)) return
    setTrio((t) => (t.includes(id) ? t.filter((x) => x !== id) : t.length < 3 ? [...t, id] : t))
  }
  const confirmar = () => {
    if (!est || trio.length !== 3) return
    const ia = ataca
      ? (() => { const d = eligeDefensaMaquina(seed, turno, rival, cSu, nivel, histIA(), sinS); return { est: d.defensa as Ataque | Defensa, trio: d.trio } })()
      : (() => { const a = eligeAtaqueMaquina(seed, turno, rival, cSu, nivel, histIA(), sinS); return { est: a.ataque as Ataque | Defensa, trio: a.trio } })()
    setSu(ia); setPwTipo(null)
    setEjec(mejorDelTrio(trio, (id) => fit(id, est)))
    setFase('barra')
  }

  // paso 3: la barra. Aquí se resuelve todo: poderes (automáticos), bloqueos, química, nivel y la jugada
  const segundosDe = (id: string) => segundosBarra(est ? fit(id, est) : 80)
  const resolver = (x: number) => {
    if (!su || !est || !ejec) return
    const A = ataca ? (est as Ataque) : (su.est as Ataque), D = ataca ? (su.est as Defensa) : (est as Defensa)
    const ptsMio = (id: string, aj: Aj = sinM) => (ataca ? encajeAtaque(id, A, aj) : encajeDefensa(id, D, aj))
    const ptsSu = (id: string, aj: Aj = sinS) => (ataca ? encajeDefensa(id, D, aj) : encajeAtaque(id, A, aj))
    // poderes: impulso sube a quien presiona la barra; debilitar y bloqueo van contra el mejor del trío rival
    const pm: Poder | undefined = pwTipo ? { tipo: pwTipo, objetivo: pwTipo === 'impulso' ? ejec : mejorDelTrio(su.trio, (id) => ptsSu(id)) } : undefined
    const ps = eligePoderTrio(seed, turno, nivel, pwSu, su.trio, trio, (id) => ptsSu(id), (id) => ptsMio(id))
    const bl = bloqueados(pm, ps, trio, su.trio)
    const suFinal = bl.su ? reemplazoTrio(rival, turno, cSu, su.trio, bl.su, (id) => ptsSu(id)) : su.trio
    const mioFinal = bl.mio ? reemplazoTrio(equipo, turno, cMio, trio, bl.mio, (id) => ptsMio(id)) : trio
    const r = aplicarPoderesTrio(pm, ps, mioFinal, suFinal)
    const merge = (a: Aj, b: Aj): Aj => { const o: Aj = { ...a }; for (const [k, v] of Object.entries(b)) o[k] = (o[k] ?? 0) + v; return o }
    const ajMio = merge(sinM, r.ajMio), ajSu = merge(sinS, r.ajSu)
    const trioA = ataca ? mioFinal : suFinal, trioD = ataca ? suFinal : mioFinal
    const ajA = ataca ? ajMio : ajSu, ajD = ataca ? ajSu : ajMio
    const ejecMio = mioFinal.includes(ejec) ? ejec : mejorDelTrio(mioFinal, (id) => ptsMio(id, ajMio))
    const mejorSu = mejorDelTrio(suFinal, (id) => ptsSu(id, ajSu))
    const ejecutor = ataca ? ejecMio : mejorSu
    const interceptor = ataca ? mejorSu : ejecMio
    const segMaq = ataca ? segundosBarra(encajeDefensa(interceptor, D, ajSu)) : segundosBarra(encajeAtaque(ejecutor, A, ajSu))
    const xMaq = toqueMaquina(seed, turno, nivel, segMaq, ataca ? 'defiende' : 'ataca')
    const precA = precision(ataca ? x : xMaq), precD = precision(ataca ? xMaq : x)
    const quimMio = quimicaTrio(mioFinal, ataca).total, quimSu = quimicaTrio(suFinal, !ataca).total
    const nivMio = bonoNivelEquipo(ganados), nivSu = bonoNivelMaquina(nivel)
    const d = resolverJugada({ seed, turno, ataca: ataca ? 'mio' : 'su', ataque: A, defensa: D, trioA, trioD, ajA, ajD, ejecutor, interceptor, precA, precD, arquero: ataca ? rival.once[0] : equipo.once[0], clima: weatherFactor(ctx).goals, quimA: ataca ? quimMio : quimSu, quimD: ataca ? quimSu : quimMio, nivelA: ataca ? nivMio : nivSu, nivelD: ataca ? nivSu : nivMio })
    const cambio = (orig: string[], fin: string[], bloqueado?: string): Cambio | undefined => (bloqueado ? { de: bloqueado, a: fin.find((id) => !orig.includes(id)) ?? bloqueado } : undefined)
    setHist((h) => [...h, { n: turno, ataca: ataca ? 'mio' : 'su', det: d, pw: pm || ps ? { mio: pm, su: ps, efectos: r.efectos, cambioMio: cambio(trio, mioFinal, bl.mio), cambioSu: cambio(su.trio, suFinal, bl.su) } : undefined }])
    if (pm) setPwMios((p) => ({ ...p, [pm.tipo]: false }))
    if (ps) setPwSu((p) => ({ ...p, [ps.tipo]: false }))
    setCMio(mioFinal); setCSu(suFinal)
    setFase('resultado')
  }
  const siguiente = () => {
    if (turno >= TURNOS) { setFase('fin'); return }
    setEscenaFin(false); setTurno((t) => t + 1); setEst(null); setTrio([]); setSu(null); setEjec(null); setPwTipo(null); setFase('estrategia')
  }

  // marcas en las canchas
  const marcas: Record<string, Marca> = {}
  equipo.once.concat(equipo.suplentes).forEach((id) => { if (cMio.includes(id) && (fase === 'estrategia' || fase === 'trio')) marcas[id] = 'cansado' })
  if (fase === 'trio' || fase === 'barra') trio.forEach((id) => { marcas[id] = ataca ? 'atacante' : 'defensor' })
  const marcasSu: Record<string, Marca> = {}
  rival.once.concat(rival.suplentes).forEach((id) => { if (cSu.includes(id) && (fase === 'estrategia' || fase === 'trio')) marcasSu[id] = 'cansado' })
  if (fase === 'resultado' && det) { det.trioA.forEach((id) => { (det.ataca === 'mio' ? marcas : marcasSu)[id] = 'atacante' }); det.trioD.forEach((id) => { (det.ataca === 'mio' ? marcasSu : marcas)[id] = 'defensor' }) }
  const valor = (id: string) => { if (!est || fase !== 'trio' || !puede(id)) return undefined; const n = fit(id, est); return { n, t: tono(n) } }
  const estadoSu = (id: string) => (cSu.includes(id) && (fase === 'estrategia' || fase === 'trio') ? 'cansado' as const : turno < 3 ? 'espera' as const : undefined)
  const rivalNombre = tr('Rival {n}', { n: tr(NIVELES.find((n) => n.id === nivel)!.nombre) })
  const pips = Array.from({ length: TURNOS }, (_, i) => visibles[i])
  const ritmoEscena = vel === 'rapida' ? { tiempo: 700, final: 1300 } : { tiempo: 1500, final: 2800 }

  return (
    <div className="duelo d-versus" data-fase={fase}>
      {compartir && <CompartirEquipo equipo={equipo} onClose={() => setCompartir(false)} />}
      {tabla && <TablaEfectividad ataca={ataca} actual={det ? { a: det.est.ataque, d: det.est.defensa } : undefined} onClose={() => setTabla(false)} />}
      <header className="d-marcador">
        <div className="d-eq"><div className="d-lado-t"><span>{tr('Tú')}</span><small>{equipo.formacion} · {valorEquipo(equipo)}</small></div><b key={`m${golesMios}`} className={golesMios ? 'd-gpop' : ''}>{golesMios}</b></div>
        <div className="d-centro"><small>{fase === 'fin' ? tr('Final') : tr('Turno {n} de {t}', { n: turno, t: TURNOS })}</small>
          <div className="d-rondas" aria-hidden>{pips.map((h, i) => <i key={i} className={h ? (h.det.resultado === 'gol' ? (h.ataca === 'mio' ? 'g' : 'p') : 'e') : i + 1 === turno ? 'ahora' : ''} />)}</div>
          <CtxLine ctx={ctx} /></div>
        <div className="d-eq d-su"><b key={`s${golesSu}`} className={golesSu ? 'd-gpop' : ''}>{golesSu}</b><div className="d-lado-t"><span>{rivalNombre}</span><small>{rival.formacion} · {valorEquipo(rival)}</small></div></div>
      </header>
      {fase === 'fin' ? (
        <div className="d-fin">
          <h1 className={gane ? 'gano' : 'perdio'}>{gane ? tr('¡Ganaste!') : tr('Perdiste')}</h1>
          <p className="muted">{golesMios} – {golesSu}{penal && <> · {tr('Penales {a}–{b}', { a: penal.yo, b: penal.rival })}</>}</p>
          <ol className="d-hist">{hist.map((h) => <li key={h.n}><b>{tr('Turno {n}', { n: h.n })}</b> <span>{h.ataca === 'mio' ? '⚽' : '🛡'} {resTxt(h.det.resultado)}</span> <small>{nombreAtaque(h.det.est.ataque)} · {nombreDefensa(h.det.est.defensa)}</small></li>)}</ol>
          <div className="cta"><button className="btn pri" onClick={alSalir}>{tr('Volver a mi equipo')}</button></div>
          <BotonCompartir sutil onClick={() => setCompartir(true)} />
        </div>
      ) : (
        <div className="d-arena">
          <section className="d-lado mio">
            <h4>{tr('Tu equipo')}</h4>
            <Cancha formacion={equipo.formacion} ids={equipo.once} marcas={marcas} sel={fase === 'trio' ? trio : null} valor={valor} onNodo={fase === 'trio' ? (i) => toggleJugador(equipo.once[i]) : undefined} etiqueta={tr('Tu equipo')} />
            <Banca slots={equipo.suplentes} activo={null} estado={(id) => (cMio.includes(id) && (fase === 'estrategia' || fase === 'trio') ? 'cansado' : turno < 3 ? 'espera' : undefined)} onJugador={fase === 'trio' ? (id) => toggleJugador(id) : undefined} />
          </section>
          <div className="d-medio">
            <div className="d-vs" aria-hidden><span>VS</span></div>
            <div className="d-controles">
              {fase === 'estrategia' && <PanelEstrategia turno={turno} ataca={ataca} onElegir={elegirEstrategia} onTabla={() => setTabla(true)} />}
              {fase === 'trio' && est && <PanelTrio ataca={ataca} est={est} trio={trio} quitar={(id) => setTrio((t) => t.filter((x) => x !== id))} fit={(id) => fit(id, est)} quim={quimicaTrio(trio, ataca)} onVolver={() => setFase('estrategia')} onConfirmar={confirmar} />}
              {fase === 'barra' && est && ejec && <PanelPasoBarra ataca={ataca} est={est} trio={trio} ejec={ejec} setEjec={setEjec} fit={(id) => fit(id, est)} segundos={segundosDe} disp={pwMios} pwTipo={pwTipo} setPwTipo={setPwTipo} onStop={resolver} />}
              {fase === 'resultado' && det && <EscenaTurno det={det} pw={turnoHist?.pw} onFin={() => setEscenaFin(true)} ritmo={ritmoEscena} turno={turno} esUltimo={turno >= TURNOS} onSiguiente={siguiente} vel={vel} setVel={setVel} />}
            </div>
          </div>
          <section className="d-lado su">
            <h4>{rivalNombre}</h4>
            <Cancha formacion={rival.formacion} ids={rival.once} marcas={marcasSu} etiqueta={rivalNombre} />
            <Banca slots={rival.suplentes} estado={estadoSu} />
          </section>
        </div>
      )}
    </div>
  )
}

const resTxt = (r: 'gol' | 'atajada' | 'corte') => (r === 'gol' ? tr('¡GOL!') : r === 'atajada' ? tr('¡Atajada!') : tr('¡Cortado!'))
// El encaje se dice con palabras y color (nunca reemplaza la valoración original de un jugador).
const nivelEncaje = (n: number): { t: 'alto' | 'medio' | 'bajo'; txt: string } => (n >= 85 ? { t: 'alto', txt: tr('Encaje alto') } : n >= 70 ? { t: 'medio', txt: tr('Encaje medio') } : { t: 'bajo', txt: tr('Encaje bajo') })
const razonQuimica = (r: RazonQuimica) => `${r.tipo === 'pais' ? tr('{n} del mismo país', { n: r.n ?? 2 }) : r.tipo === 'combo' ? tr('Estilos que se complementan') : r.tipo === 'variedad' ? tr('Tres estilos distintos') : tr('Tres del mismo estilo')} ${r.pts > 0 ? '+' : ''}${r.pts}`

// Indicador de los 3 pasos.
function Pasos({ paso, ataca }: { paso: 1 | 2 | 3; ataca: boolean }) {
  const nombres = [tr('Estrategia'), tr('Jugadores'), tr('Balón')]
  return (
    <div className="d-stepper">
      <span className={`d-rol ${ataca ? 'atk' : 'def'}`}>{ataca ? `⚽ ${tr('Tú atacas')}` : `🛡 ${tr('Tú defiendes')}`}</span>
      <ol>{nombres.map((n, i) => <li key={n} className={i + 1 === paso ? 'on' : i + 1 < paso ? 'hecho' : ''}><i>{i + 1}</i><span>{n}</span></li>)}</ol>
    </div>
  )
}

// Paso 1: la estrategia.
function PanelEstrategia({ turno, ataca, onElegir, onTabla }: { turno: number; ataca: boolean; onElegir: (e: Ataque | Defensa) => void; onTabla: () => void }) {
  const opciones = (ataca ? ATAQUES : DEFENSAS) as (Ataque | Defensa)[]
  return (
    <div className="d-eleccion">
      <Pasos paso={1} ataca={ataca} />
      <div className="d-rhead"><b>{tr('Paso {n} de 3', { n: 1 })} · {tr('Turno {n} de {t}', { n: turno, t: TURNOS })}</b><span className="muted small">{ataca ? tr('Elige tu estrategia de ataque') : tr('Elige tu estrategia de defensa')}</span></div>
      <div className="d-ests">{opciones.map((e) => <FichaEstrategia key={e} e={e} ataca={ataca} onClick={() => onElegir(e)} />)}</div>
      <button type="button" className="d-link" onClick={onTabla}>📊 {tr('Tabla de efectividad')}</button>
    </div>
  )
}

// Paso 2: los 3 jugadores.
function PanelTrio({ ataca, est, trio, quitar, fit, quim, onVolver, onConfirmar }: { ataca: boolean; est: Ataque | Defensa; trio: string[]; quitar: (id: string) => void; fit: (id: string) => number; quim: { total: number; razones: RazonQuimica[] }; onVolver: () => void; onConfirmar: () => void }) {
  return (
    <div className="d-eleccion">
      <Pasos paso={2} ataca={ataca} />
      <div className="d-rhead"><b>{tr('Paso {n} de 3', { n: 2 })} · {tr('Elige 3 jugadores: {n} de 3', { n: trio.length })}</b><span className="muted small">{tr('El color de cada jugador en la cancha muestra cuánto encaja con {e}: verde alto, amarillo medio, rojo bajo.', { e: nombreEst(est, ataca) })}</span></div>
      <div className="d-est-elegida"><span aria-hidden>{iconoEst(est, ataca)}</span><b>{nombreEst(est, ataca)}</b><button type="button" className="d-link" onClick={onVolver}>↩ {tr('Cambiar')}</button></div>
      <div className="d-trio-slots">
        {[0, 1, 2].map((i) => { const id = trio[i]; const p = id ? PLAYER_BY_ID[id] : null; return (
          <div key={i} className={`d-trio-s${p ? ' lleno' : ''}`}>
            {p ? <><div className="d-slot-av"><Avatar p={p} size={44} /></div><b>{apellido(p.name)}</b><small>{ICONO_ESTILO[estiloJugador(p)]} {nombreEstilo(estiloJugador(p))}</small><em className={`enc ${nivelEncaje(fit(id)).t}`}>{nivelEncaje(fit(id)).txt}</em><button type="button" className="d-slot-x" onClick={() => quitar(id)} aria-label={tr('Quitar')}>✕</button></> : <span className="vacio">+</span>}
          </div>) })}
      </div>
      {trio.length >= 2 && <div className={`d-quim ${quim.total > 0 ? 'pos' : quim.total < 0 ? 'neg' : ''}`}><b>🧪 {tr('Química del trío')} {quim.total > 0 ? '+' : ''}{Math.round(quim.total * 10) / 10}</b>{quim.razones.map((r, i) => <span key={i}>{razonQuimica(r)}</span>)}{!quim.razones.length && <span>{tr('Sin combinaciones especiales')}</span>}{quim.razones.reduce((x, r) => x + r.pts, 0) > 6 && <span className="tope">{tr('Tope +{n}', { n: 6 })}</span>}</div>}
      <button className={`btn pri d-jugar${trio.length === 3 ? ' d-gran' : ''}`} disabled={trio.length !== 3} onClick={onConfirmar}>{trio.length === 3 ? `▶ ${tr('Confirmar jugada')}` : tr('Elige 3 jugadores')}</button>
    </div>
  )
}

const descPoder2 = (x: TipoPoder) => (x === 'impulso' ? tr('Suma +{n} de encaje a un jugador tuyo.', { n: IMPULSO_ENC }) : x === 'debilitar' ? tr('Resta −{n} de encaje a un jugador rival.', { n: DEBILITAR_ENC }) : tr('El rival no puede usar a un jugador: tiene que cambiarlo.'))

// Paso 3: el balón. Eliges (si quieres) quién la ejecuta y un poder opcional, y detienes el balón en el centro.
function PanelPasoBarra({ ataca, est, trio, ejec, setEjec, fit, segundos, disp, pwTipo, setPwTipo, onStop }: { ataca: boolean; est: Ataque | Defensa; trio: string[]; ejec: string; setEjec: (id: string) => void; fit: (id: string) => number; segundos: (id: string) => number; disp: Disponibles; pwTipo: TipoPoder | null; setPwTipo: (x: TipoPoder | null) => void; onStop: (x: number) => void }) {
  const [x, setX] = useState(0)
  const [parada, setParada] = useState<number | null>(null)
  const xRef = useRef(0)
  const seg = segundos(ejec)
  useEffect(() => {
    if (parada !== null) return
    const t0 = performance.now(); let raf = 0
    const loop = (t: number) => { const ph = (((t - t0) / 1000) / seg) % 2; const v = ph < 1 ? ph : 2 - ph; xRef.current = v; setX(v); raf = requestAnimationFrame(loop) }
    raf = requestAnimationFrame(loop)
    const auto = setTimeout(() => setParada(xRef.current), 12000) // si no toca, se detiene solo
    return () => { cancelAnimationFrame(raf); clearTimeout(auto) }
  }, [seg, parada])
  useEffect(() => { if (parada === null) return; const t = setTimeout(() => onStop(parada), 1000); return () => clearTimeout(t) }, [parada, onStop])
  useEffect(() => {
    const f = (e: KeyboardEvent) => { if ((e.key === ' ' || e.key === 'Enter') && parada === null) { e.preventDefault(); setParada(xRef.current) } }
    window.addEventListener('keydown', f); return () => window.removeEventListener('keydown', f)
  }, [parada])
  const pr = parada !== null ? precision(parada) : null
  const etiqueta = pr === null ? '' : pr >= 0.95 ? tr('¡Perfecto!') : pr >= 0.7 ? tr('¡Muy bien!') : pr >= 0.4 ? tr('Regular') : tr('Flojo')
  const hayPoderes = TIPOS_PODER.some((t) => disp[t])
  return (
    <div className="d-poder-panel d-barra-panel">
      <Pasos paso={3} ataca={ataca} />
      <div className="d-rhead"><b>{tr('Paso {n} de 3', { n: 3 })} · {ataca ? tr('¡Define!') : tr('¡Intercepta!')}</b><span className="muted small">{tr('Detén el balón en el centro verde.')}</span></div>
      <div className="d-ejec d-ejec-mini">
        {trio.map((id) => { const p = PLAYER_BY_ID[id]; const s = segundos(id); return (
          <button key={id} type="button" disabled={parada !== null} className={`d-ejec-c${id === ejec ? ' on' : ''}`} onClick={() => setEjec(id)} aria-pressed={id === ejec}>
            <Avatar p={p} size={40} /><b>{apellido(p.name)}</b>
            <span className={`d-vel ${s >= 1.4 ? 'lenta' : s >= 0.95 ? 'media' : 'rapida'}`}>{s >= 1.4 ? '🐢' : s >= 0.95 ? '🏃' : '🐇'} {nivelEncaje(fit(id)).txt}</span>
          </button>) })}
      </div>
      <small className="muted">{ataca ? tr('¿Quién la define?') : tr('¿Quién la intercepta?')} · {tr('Cuanto mejor encaja con {e}, más lento va el balón y más fácil es detenerlo en el centro.', { e: nombreEst(est, ataca) })}</small>
      {hayPoderes && (
        <div className="d-pw-mini">
          <span>{tr('Poder opcional (un solo uso por partida)')}</span>
          <div>{TIPOS_PODER.filter((t) => disp[t]).map((t) => <button key={t} type="button" disabled={parada !== null} className={`d-pw-b ${t}${pwTipo === t ? ' on' : ''}`} onClick={() => setPwTipo(pwTipo === t ? null : t)} title={descPoder2(t)}>{iconoPoder(t)} {nombrePoder(t)}</button>)}</div>
          {pwTipo && <small className="muted">{descPoder2(pwTipo)}</small>}
        </div>
      )}
      <div className={`d-barra${parada !== null ? ' parada' : ''}`} onClick={() => parada === null && setParada(xRef.current)} role="button" tabIndex={0} aria-label={tr('¡Detener!')}>
        <i className="centro" />
        <span className="d-bola" style={{ left: `${(parada ?? x) * 100}%` }} aria-hidden>⚽</span>
      </div>
      {pr !== null ? <p className={`d-precision p${pr >= 0.95 ? 3 : pr >= 0.7 ? 2 : pr >= 0.4 ? 1 : 0}`}><b>{Math.round(pr * 100)} %</b> {etiqueta}</p>
        : <button className="btn pri d-jugar d-gran d-detener" onClick={() => setParada(xRef.current)}>{tr('¡Detener!')}</button>}
    </div>
  )
}

// Frases del narrador: según la estrategia del ataque y lo que pasó, con los nombres reales.
function narradorTurno(d: DetalleJugada): string {
  const a = apellido(PLAYER_BY_ID[d.ejecutor].name), df = apellido(PLAYER_BY_ID[d.interceptor ?? d.trioD[0]].name), k = apellido(PLAYER_BY_ID[d.arquero].name)
  const h = [...(d.ejecutor + d.arquero)].reduce((s, c) => s + c.charCodeAt(0), 0)
  if (d.resultado === 'gol') {
    const e = d.est.ataque
    return e === 'contra' ? tr('¡Contragolpe letal! {a} corre solo y define ante {k}.', { a, k }) : e === 'bandas' ? tr('¡Gran jugada por la banda! {a} la manda al fondo.', { a }) : e === 'centro' ? tr('¡Pase filtrado a {a}, que no perdona ante {k}!', { a, k }) : tr('¡Gana arriba {a} y la clava! {k} no pudo hacer nada.', { a, k })
  }
  if (d.resultado === 'atajada') return [tr('¡{k} vuela y se queda con el remate de {a}!', { a, k }), tr('¡Paradón de {k}! {a} no lo puede creer.', { a, k })][h % 2]
  return [tr('¡{d} llega justo y corta el avance de {a}!', { a, d: df }), tr('¡Muro! {d} le cierra todos los caminos a {a}.', { a, d: df })][h % 2]
}

// Después del balón solo hay animación: se revelan las estrategias (y los poderes) y luego la jugada, por tiempos y con pelota viajera.
function EscenaTurno({ det, pw, onFin, ritmo, turno, esUltimo, onSiguiente, vel, setVel }: { det: DetalleJugada; pw?: TurnoHist['pw']; onFin: () => void; ritmo: { tiempo: number; final: number }; turno: number; esUltimo: boolean; onSiguiente: () => void; vel: 'normal' | 'rapida'; setVel: (v: 'normal' | 'rapida') => void }) {
  const [beat, setBeat] = useState(0)
  useEffect(() => { setBeat(0) }, [turno])
  useEffect(() => { if (beat >= 3) onFin() }, [beat, onFin])
  useEffect(() => { if (beat >= 3) return; const t = setTimeout(() => setBeat((b) => b + 1), beat === 0 ? ritmo.final : ritmo.tiempo); return () => clearTimeout(t) }, [beat, ritmo.tiempo, ritmo.final])
  const ej = PLAYER_BY_ID[det.ejecutor], ic = PLAYER_BY_ID[det.interceptor ?? det.trioD[0]], gk = PLAYER_BY_ID[det.arquero]
  const pasa = det.resultado !== 'corte'
  const v = (n: number) => (beat >= n ? 'rev' : 'oculto')
  const X = pasa ? { a: 15, d: 48, k: 84 } : { a: 27, d: 73, k: 73 }
  const bola = beat <= 1 ? X.a : beat === 2 ? (pasa ? X.k : X.d) : det.resultado === 'gol' ? 104 : det.resultado === 'atajada' ? X.d + 8 : X.a + 6
  const fin = beat >= 3
  const mio = det.ataca === 'mio'
  const nivelH = mio ? det.nivel : -det.nivel
  const nom = (id: string) => apellido(PLAYER_BY_ID[id].name)
  const lado = (de: 'mio' | 'su', p: Poder | undefined) => (
    <span className={`d-rev-pw-mini ${p ? p.tipo : 'ninguno'}`}>{de === 'mio' ? tr('Tu poder') : tr('Su poder')}: {p ? `${iconoPoder(p.tipo)} ${textoPoder(p)}` : tr('Sin poder')}</span>
  )
  return (
    <div className="d-escena-wrap" onClick={!fin ? () => setBeat((b) => Math.min(3, b + 1)) : undefined} style={{ cursor: !fin ? 'pointer' : undefined }}>
      {beat === 0 ? (
        <div className="d-escena d-reveal">
          <p className="d-esc-t">{tr('¡Estrategias reveladas!')}</p>
          <div className="d-vsest">
            <div><small>{mio ? tr('Tu ataque') : tr('Su ataque')}</small><FichaEstrategia e={det.est.ataque} ataca mini /><div className="d-minis">{det.trioA.map((id) => <Avatar key={id} p={PLAYER_BY_ID[id]} size={30} />)}</div></div>
            <span className="vs" aria-hidden>VS</span>
            <div><small>{mio ? tr('Su defensa') : tr('Tu defensa')}</small><FichaEstrategia e={det.est.defensa} ataca={false} mini /><div className="d-minis">{det.trioD.map((id) => <Avatar key={id} p={PLAYER_BY_ID[id]} size={30} />)}</div></div>
          </div>
          {pw && <div className="d-rev-pws">{lado('mio', pw.mio)}{lado('su', pw.su)}{pw.cambioSu && <small className="muted">{tr('{d} tuvo que dejar su lugar a {a}.', { d: nom(pw.cambioSu.de), a: nom(pw.cambioSu.a) })}</small>}{pw.cambioMio && <small className="muted">{tr('{d} tuvo que dejar su lugar a {a}.', { d: nom(pw.cambioMio.de), a: nom(pw.cambioMio.a) })}</small>}</div>}
        </div>
      ) : (
        <div className={`d-escena beats ${det.resultado}${mio ? ' mio' : ' su'}${fin ? ' fin' : ''}`}>
          <p className="d-esc-t">{mio ? tr('Tu ataque') : tr('Su ataque')} · {nombreAtaque(det.est.ataque)}</p>
          <p className="d-esc-cap">{beat <= 1 ? `${nombreAtaque(det.est.ataque)} ${tr('contra')} ${nombreDefensa(det.est.defensa)}` : beat === 2 ? (pasa ? tr('Si lo supera, remata contra el arquero') : tr('El defensor corta la jugada')) : ' '}</p>
          <div className="d-esc-fila">
            <span className={`d-pelota b${beat}${fin ? ` ${det.resultado}` : ''}`} style={{ left: `${bola}%` }} aria-hidden>⚽</span>
            <div className="d-esc-j a rev"><Avatar p={ej} size={92} /><b>{ej.name}</b><small>{ICONO_ESTILO[estiloJugador(ej)]} {nombreEstilo(estiloJugador(ej))}</small></div>
            <div className={`d-esc-j d ${beat >= 2 ? (pasa ? 'vencido' : 'gana') : ''} rev`}><Avatar p={ic} size={92} /><b>{ic.name}</b><small>🛡 {nombreDefensa(det.est.defensa)}</small><em className={v(2)}>{pasa ? tr('Superado') : tr('Corta')}</em></div>
            {pasa && <><span className={`d-esc-x l2 ${v(2)}`} aria-hidden>→</span>
              <div className={`d-esc-j g ${beat >= 3 ? (det.resultado === 'gol' ? 'vencido' : 'gana') : ''} ${v(2)}`}><Avatar p={gk} size={92} /><b>{gk.name}</b><small>🧤</small><em className={v(3)}>{det.resultado === 'gol' ? tr('Vencido') : tr('Ataja')}</em></div></>}
            {fin && det.resultado === 'gol' && <div className="d-confeti" aria-hidden>{Array.from({ length: 16 }, (_, n) => <i key={n} style={{ ['--a' as string]: `${n * 22.5}deg`, ['--d' as string]: `${46 + (n % 4) * 14}px`, ['--c' as string]: ['#ffd54a', '#00e5ff', '#ff2e88', '#fff'][n % 4] }} />)}</div>}
          </div>
          <div className={`d-factores ${v(3)}`}>
            <span className={`f ${claseEfecto(nivelH)}`}>{mensajeEfecto(nivelH)}</span>
            <span className="f">{tr('Encaje {a} contra {d}', { a: Math.round(det.calidadA), d: Math.round(det.calidadD) })}</span>
            <span className="f">🧪 {tr('Química {a} contra {d}', { a: Math.round(det.quimA * 10) / 10, d: Math.round(det.quimD * 10) / 10 })}</span>
            <span className="f">⭐ {tr('Nivel de equipo +{a} contra +{d}', { a: det.nivelA, d: det.nivelD })}</span>
            <span className="f">{tr('Tu toque {p} %', { p: Math.round((mio ? det.precA : det.precD) * 100) })}</span>
          </div>
          <div className={`d-meter ${v(3)}`}><div className="d-meter-h"><b>{tr('Probabilidad de gol: {p} %', { p: Math.round(det.pGol * 100) })}</b></div><div className="d-meter-bar"><i style={{ width: `${Math.round(det.pGol * 100)}%` }} /></div></div>
          <div className={`d-esc-res ${v(3)}`}>{resTxt(det.resultado)}</div>
          <p className={`d-narra ${v(3)}`}>{narradorTurno(det)}</p>
          {fin && det.resultado !== 'gol' && det.pGol >= 0.5 && <p className="d-suerte">🎲 {mio ? tr('Tenías {p} % de probabilidad de gol: esta vez la suerte no acompañó.', { p: Math.round(det.pGol * 100) }) : tr('Tu rival tenía {p} % de probabilidad de gol: ¡esta vez tuviste suerte!', { p: Math.round(det.pGol * 100) })}</p>}
        </div>
      )}
      <div className="cta" onClick={(e) => e.stopPropagation()}>{!fin ? <><button className="btn ghost" onClick={() => setBeat(3)}>{tr('Saltar animación')}</button><button className="btn ghost" onClick={() => setVel(vel === 'normal' ? 'rapida' : 'normal')}>{vel === 'normal' ? tr('Velocidad: normal') : tr('Velocidad: rápida')}</button></> : <button className="btn pri d-gran" onClick={onSiguiente}>{esUltimo ? tr('Ver resultado final') : tr('Siguiente turno')}</button>}</div>
    </div>
  )
}

// ---------- poderes ----------
const iconoPoder = (x: TipoPoder) => (x === 'impulso' ? '⚡' : x === 'debilitar' ? '🥶' : '🚫')
const nombrePoder = (x: TipoPoder) => (x === 'impulso' ? tr('Impulso') : x === 'debilitar' ? tr('Debilitar') : tr('Bloqueo'))
const textoPoder = (p: Poder) => { const j = apellido(PLAYER_BY_ID[p.objetivo].name); return p.tipo === 'impulso' ? tr('Impulso: +{n} a {j}', { n: IMPULSO_ENC, j }) : p.tipo === 'debilitar' ? tr('Debilitar: −{n} a {j}', { n: DEBILITAR_ENC, j }) : tr('Bloqueo a {j}', { j }) }
