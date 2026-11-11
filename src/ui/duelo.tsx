import { CompartirEquipo, type Red } from './compartir'
import { Component, useEffect, useMemo, useState, type ReactNode } from 'react'
import { PLAYER_BY_ID, TEAM_BY_ID } from '../data/lookup'
import { tr } from '../i18n'
import { attrLabel, posLabel, posNombre } from '../i18n/nombres'
import {
  FORMACIONES, NIVELES, NOMBRES_FORMACION, N_PICKS, RONDAS, equipoMaquina, eligeMaquina, jugarRonda, ofertas, paisesConSinergia, penales, poderAtaque, poderDefensa, poderArquero, formulaAtaque, formulaDefensa, type Formula,
  TIPOS_PODER, BONO_IMPULSO, CASTIGO_DEBILITAR, todosLosPoderes, bloqueados, candidatos, reemplazoMaquina, aplicarPoderes, eligePoderMaquina, type Poder, type TipoPoder, type Rol, type Disponibles, type Efecto,
  sedeDuelo, sinergias, valorEquipo, onceDeEjemplo, type Cambio, type Equipo, type Nivel, type ResultadoRonda,
} from '../engine/duelo'
import { Avatar, Bar, Flag, usePhoto, useLocalState } from './common'
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
function Nodo({ p, x, y, marca, onClick, etiqueta, activo }: { p?: Player; x: number; y: number; marca?: Marca; onClick?: () => void; etiqueta?: string; activo?: boolean }) {
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
    <g className={`pn${marca ? ` m-${marca}` : ''}${activo ? ' sel' : ''}`} data-line={p.line} role={onClick ? 'button' : undefined} tabIndex={onClick ? 0 : undefined} onClick={onClick} onKeyDown={(e) => { if (onClick && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onClick() } }} style={{ cursor: onClick ? 'pointer' : 'default' }} aria-label={`${p.name}, ${p.ovr}`}>
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
function Cancha({ formacion, ids, marcas, onNodo, onVacio, actual, etiqueta, sel }: { sel?: string | null; formacion: string; ids: (string | undefined)[]; marcas?: Record<string, Marca>; onNodo?: (i: number) => void; onVacio?: (i: number) => void; actual?: number; etiqueta: string }) {
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
        return <Nodo key={i} p={p} x={h.x} y={h.y} marca={actual === i ? 'actual' : id ? marcas?.[id] : undefined} onClick={p ? (onNodo ? () => onNodo(i) : undefined) : (onVacio ? () => onVacio(i) : undefined)} etiqueta={!p ? posNombre(h.pos) : undefined} activo={!!id && id === sel} />
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
// Partida en curso: se guarda en el navegador para que, al actualizar o salir y volver, siga donde estaba.
const CLAVE_PARTIDA = 'lwc:duelo:partida'
interface Guardada { creado: number; nivel: Nivel; seed: string; ronda: number; cMio: string[]; cSu: string[]; hist: Ronda[]; fase: 'elegir' | 'poder' | 'bloqueado' | 'resultado'; atk: string | null; def: string | null; pwMios?: Disponibles; pwSu?: Disponibles; suRonda?: Cambio | null; pend?: Pendiente | null }
const leerPartida = (): Guardada | null => { try { const s = localStorage.getItem(CLAVE_PARTIDA); return s ? (JSON.parse(s) as Guardada) : null } catch { return null } }
const borrarPartida = () => { try { localStorage.removeItem(CLAVE_PARTIDA) } catch { /* sin almacenamiento */ } }
function partidaVigente(): Guardada | null {
  const g = leerPartida(); if (!g) return null
  try { const e = JSON.parse(localStorage.getItem(CLAVE_EQUIPO) ?? 'null') as Equipo | null; if (e && e.creado === g.creado && Array.isArray(g.hist)) return g } catch { /* equipo ilegible */ }
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
export function Duelo() { return <DueloSeguro><DueloPantallas /></DueloSeguro> }

function DueloPantallas() {
  const [equipo, setEquipo] = useLocalState<Equipo | null>(CLAVE_EQUIPO, null)
  const [stats, setStats] = useLocalState<Stats>(CLAVE_STATS, STATS0)
  // El partido es en vivo: si se sale o se actualiza la página a mitad de partido, queda abandonado (cuenta como derrota) y no se retoma.
  const [abandonada] = useState(() => partidaVigente() !== null)
  const [vista, setVista] = useState<'inicio' | 'draft' | 'duelo'>('inicio')
  const [nivel, setNivel] = useState<Nivel>('plata')
  useEffect(() => {
    if (!partidaVigente()) return
    borrarPartida()
    setStats({ ...stats, jugados: stats.jugados + 1, perdidos: stats.perdidos + 1, racha: 0 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  if (vista === 'draft') return <Draft alTerminar={(e) => { setEquipo(e); setVista('inicio') }} alCancelar={() => setVista('inicio')} />
  if (vista === 'duelo' && equipo) return <Partida equipo={equipo} nivel={nivel} alTerminar={(g) => { const s = { ...stats }; s.jugados++; if (g) { s.ganados++; s.racha++; s.mejorRacha = Math.max(s.mejorRacha, s.racha) } else { s.perdidos++; s.racha = 0 } setStats(s) }} alSalir={() => setVista('inicio')} />
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
          <p className="d-bajada">{tr('Elige a las mayores leyendas de la historia, entrena en duelos de 5 rondas contra la máquina y prepárate para competir contra otras personas.')}</p>
          <ul className="d-chips-top"><li>⏱ {tr('4 minutos por duelo')}</li><li>🎲 {tr('Cada draft es distinto')}</li><li>🔒 {tr('Tu equipo es para siempre')}</li><li className="d-pronto">🏆 {tr('Pronto: ranking y duelos contra otras personas')}</li></ul>
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
      <header className="d-hero"><p className="kicker">{tr('Mi Once Ideal: Duelo')}</p><h1>{tr('Tu equipo')}</h1>
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

// ---------- el duelo de 5 rondas ----------
// Qué pasó con los poderes en una ronda (para revelarlos y explicarlos).
interface PoderRonda { mio?: Poder; su?: Poder; efectos: Efecto[]; cambioMio?: { rol: Rol; de: string; a: string }; cambioSu?: { rol: Rol; de: string; a: string } }
interface Ronda { n: number; res: ResultadoRonda; mio: Cambio; su: Cambio; pw?: PoderRonda }
// Ronda a medias: el rival bloqueó a uno de tus jugadores y falta que elijas su reemplazo.
interface Pendiente { pm?: Poder; ps?: Poder; mioOrig: Cambio; su: Cambio; suOrig: Cambio; rol: Rol; bloqueado: string }
// Una de las dos ranuras de la ronda: qué hace ese puesto, quién lo ocupa y cuánto aporta.
function RanuraRonda({ tipo, id, activa, onQuitar, bonus = 0 }: { tipo: 'atk' | 'def'; id: string | null; activa: boolean; onQuitar: () => void; bonus?: number }) {
  const p = id ? PLAYER_BY_ID[id] : null
  const atk = tipo === 'atk'
  return (
    <div className={`d-slot ${tipo}${p ? ' lleno' : ''}${activa ? ' activa' : ''}`}>
      <span className="d-slot-ic" aria-hidden>{atk ? '⚽' : '🛡'}</span>
      <div className="d-slot-tx">
        <b>{atk ? tr('Tu ataque') : tr('Tu defensa')}</b>
        <span className="muted small">{atk ? tr('Intenta marcar un gol') : tr('Frena el ataque rival')}</span>
      </div>
      {p ? (() => {
        const base = Math.round(atk ? poderAtaque(p) : poderDefensa(p)), total = base + bonus
        return (
          <div className="d-slot-j"><div className="d-slot-av"><Avatar p={p} size={44} /></div>
            <span><b>{p.name}</b><em>{atk ? tr('Poder de ataque') : tr('Poder de defensa')}</em><span className="d-slot-bar" aria-hidden><i style={{ width: `${Math.max(4, Math.min(100, ((total - 40) / 60) * 100))}%` }} /></span></span>
            <div className="d-slot-n" title={tr('Poder base {a} + sinergia {b}', { a: base, b: bonus })}><b>{total}</b>{bonus > 0 && <small>{base} +{bonus}</small>}</div>
            <button type="button" className="d-slot-x" onClick={onQuitar} aria-label={tr('Quitar')} title={tr('Quitar')}>✕</button></div>
        )
      })() : <span className="d-slot-vacio">{activa ? '👆 ' : ''}{tr('Toca a un jugador de tu cancha')}</span>}
    </div>
  )
}

function Partida({ equipo, nivel, inicial, alTerminar, alSalir }: { equipo: Equipo; nivel: Nivel; inicial?: Guardada; alTerminar: (gane: boolean) => void; alSalir: () => void }) {
  const [seed] = useState(() => inicial?.seed ?? nuevaSemilla('duelo'))
  const rival = useMemo(() => equipoMaquina(nivel, seed), [nivel, seed])
  const ctx: MatchCtx = useMemo(() => sedeDuelo(seed), [seed])
  const [ronda, setRonda] = useState(inicial?.ronda ?? 1)
  const [cMio, setCMio] = useState<string[]>(inicial?.cMio ?? [])
  const [cSu, setCSu] = useState<string[]>(inicial?.cSu ?? [])
  const [atk, setAtk] = useState<string | null>(inicial?.atk ?? null)
  const [def, setDef] = useState<string | null>(inicial?.def ?? null)
  const [sel, setSel] = useState<string | null>(null)
  const [hist, setHist] = useState<Ronda[]>(inicial?.hist ?? [])
  const [fase, setFase] = useState<'elegir' | 'poder' | 'bloqueado' | 'resultado' | 'fin'>(inicial?.fase ?? 'elegir')
  const [pwMios, setPwMios] = useState<Disponibles>(inicial?.pwMios ?? todosLosPoderes())
  const [pwSu, setPwSu] = useState<Disponibles>(inicial?.pwSu ?? todosLosPoderes())
  const [suRonda, setSuRonda] = useState<Cambio | null>(inicial?.suRonda ?? null)
  const [pend, setPend] = useState<Pendiente | null>(inicial?.pend ?? null)
  const [pwTipo, setPwTipo] = useState<TipoPoder | null>(null)
  const [pwObj, setPwObj] = useState<string | null>(null)
  const [guardado, setGuardado] = useState(false)
  const [compartir, setCompartir] = useState(false)
  useCerrarFuera(sel !== null, () => setSel(null))
  const golesMios = hist.reduce((s, r) => s + r.res.golesMios, 0), golesSu = hist.reduce((s, r) => s + r.res.golesRival, 0)
  const bonus = useMemo(() => sinergias([...equipo.once, ...equipo.suplentes]), [equipo])
  const disponibles = [...equipo.once, ...(ronda >= 3 ? equipo.suplentes : [])]
  const marcas: Record<string, Marca> = {}
  equipo.once.concat(equipo.suplentes).forEach((id) => { if (cMio.includes(id)) marcas[id] = 'cansado' })
  if (fase === 'elegir' || fase === 'poder' || fase === 'bloqueado') { if (atk) marcas[atk] = 'atacante'; if (def) marcas[def] = 'defensor' }
  const marcasSu: Record<string, Marca> = {}
  rival.once.concat(rival.suplentes).forEach((id) => { if (cSu.includes(id)) marcasSu[id] = 'cansado' })
  if ((fase === 'poder' || fase === 'bloqueado') && suRonda) { marcasSu[suRonda.atacante] = 'atacante'; marcasSu[suRonda.defensor] = 'defensor' }
  const penal = useMemo(() => (fase === 'fin' && golesMios === golesSu ? penales(seed, equipo, rival) : null), [fase, golesMios, golesSu, seed, equipo, rival])
  const gane = fase === 'fin' ? (penal ? penal.yo > penal.rival : golesMios > golesSu) : false
  useEffect(() => { if (fase === 'fin' && !guardado) { setGuardado(true); borrarPartida(); alTerminar(gane) } }, [fase, guardado, gane, alTerminar])
  // cada cambio de la partida queda guardado (hasta que termina)
  useEffect(() => {
    if (fase === 'fin') return
    try { localStorage.setItem(CLAVE_PARTIDA, JSON.stringify({ creado: equipo.creado, nivel, seed, ronda, cMio, cSu, hist, fase, atk, def, pwMios, pwSu, suRonda, pend } satisfies Guardada)) } catch { /* sin almacenamiento */ }
  }, [equipo.creado, nivel, seed, ronda, cMio, cSu, hist, fase, atk, def, pwMios, pwSu, suRonda, pend])
  const puedeUsar = (id: string) => disponibles.includes(id) && !cMio.includes(id) && PLAYER_BY_ID[id].line !== 'GK'
  // 1) tus jugadores quedan elegidos: el rival elige los suyos, se ven, y si queda algún poder se decide en secreto
  const jugar = () => {
    if (!atk || !def) return
    const su = eligeMaquina(seed, ronda, rival, cSu, nivel)
    setSuRonda(su); setPwTipo(null); setPwObj(null)
    if (TIPOS_PODER.some((x) => pwMios[x])) setFase('poder')
    else resolver(undefined, { atacante: atk, defensor: def }, su)
  }
  // 2) poderes en secreto: la máquina decide el suyo, se aplican los bloqueos (cada uno obliga a cambiar a un jugador)
  const resolver = (pm: Poder | undefined, mio: Cambio, su: Cambio) => {
    const ps = eligePoderMaquina(seed, ronda, nivel, pwSu, su, mio)
    const bl = bloqueados(pm, ps, mio, su)
    const suFinal = bl.su && pm ? reemplazoMaquina(seed, ronda, rival, cSu, nivel, su, bl.su, pm.objetivo) : su
    if (bl.mio && ps) { setPend({ pm, ps, mioOrig: mio, su: suFinal, suOrig: su, rol: bl.mio, bloqueado: ps.objetivo }); setFase('bloqueado'); return }
    terminar(pm, ps, mio, mio, suFinal, su)
  }
  // 3) se juega la ronda con los jugadores finales y los efectos de los poderes
  const terminar = (pm: Poder | undefined, ps: Poder | undefined, mioOrig: Cambio, mio: Cambio, su: Cambio, suOrig: Cambio) => {
    const { ajustes, efectos } = aplicarPoderes(pm, ps, mio, su)
    const res = jugarRonda(seed, ronda, equipo, rival, mio, su, ctx, ajustes)
    const cambio = (o: Cambio, f: Cambio) => (o.atacante !== f.atacante ? { rol: 'atacante' as Rol, de: o.atacante, a: f.atacante } : o.defensor !== f.defensor ? { rol: 'defensor' as Rol, de: o.defensor, a: f.defensor } : undefined)
    const pw: PoderRonda | undefined = pm || ps ? { mio: pm, su: ps, efectos, cambioMio: cambio(mioOrig, mio), cambioSu: cambio(suOrig, su) } : undefined
    setHist((h) => [...h, { n: ronda, res, mio, su, pw }])
    if (pm) setPwMios((d) => ({ ...d, [pm.tipo]: false }))
    if (ps) setPwSu((d) => ({ ...d, [ps.tipo]: false }))
    setAtk(mio.atacante); setDef(mio.defensor)
    setCMio([mio.atacante, mio.defensor]); setCSu([su.atacante, su.defensor])
    setPend(null); setFase('resultado')
  }
  const elegirReemplazo = (id: string) => {
    if (!pend) return
    const mio = pend.rol === 'atacante' ? { atacante: id, defensor: pend.mioOrig.defensor } : { atacante: pend.mioOrig.atacante, defensor: id }
    terminar(pend.pm, pend.ps, pend.mioOrig, mio, pend.su, pend.suOrig)
  }
  const siguiente = () => {
    if (ronda >= RONDAS) { setFase('fin'); return }
    setRonda((r) => r + 1); setAtk(null); setDef(null); setSel(null); setSuRonda(null); setFase('elegir')
  }
  const ultima = hist[hist.length - 1]
  const nombre = (id: string) => PLAYER_BY_ID[id].name
  const rivalNombre = tr('Rival {n}', { n: tr(NIVELES.find((n) => n.id === nivel)!.nombre) })
  const p = sel ? PLAYER_BY_ID[sel] : null
  // escena de la ronda: se revela primero tu ataque y luego el del rival (con el rival mostrando lo que eligió)
  const [paso, setPaso] = useState(0)
  const [beat, setBeat] = useState(1)
  const [vel, setVel] = useLocalState<'normal' | 'rapida'>('lwc:duelo:vel', 'normal')
  const ritmo = vel === 'rapida' ? { tiempo: 700, final: 1100 } : { tiempo: 1700, final: 2600 }
  // pasos de la escena: 0 poderes revelados (si los hubo), 1 tu ataque, 2 su ataque, 3 resumen
  const avanzar = () => { if (paso >= 3) return; if (paso === 0) { setPaso(1); setBeat(1); return } if (beat < 3) setBeat((b) => b + 1); else { setPaso((x) => x + 1); setBeat(1) } }
  useEffect(() => { if (fase === 'resultado') { setPaso(hist[hist.length - 1]?.pw ? 0 : 1); setBeat(1) } }, [fase, ronda])
  useEffect(() => {
    if (fase !== 'resultado' || paso >= 3) return
    const tm = setTimeout(avanzar, paso === 0 ? ritmo.final + 1200 : beat < 3 ? ritmo.tiempo : ritmo.final)
    return () => clearTimeout(tm)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fase, paso, beat, vel])
  if (fase === 'resultado' && ultima) {
    // al revelar, se marca en cada cancha quién atacó y quién defendió
    marcas[ultima.mio.atacante] = 'atacante'; marcas[ultima.mio.defensor] = 'defensor'
    marcasSu[ultima.su.atacante] = 'atacante'; marcasSu[ultima.su.defensor] = 'defensor'
  }
  const estadoSu = (id: string) => (cSu.includes(id) && fase === 'elegir' ? 'cansado' as const : ronda < 3 ? 'espera' as const : undefined)
  const cargaRonda = Array.from({ length: RONDAS }, (_, i) => hist[i])
  return (
    <div className="duelo d-versus">
      {compartir && <CompartirEquipo equipo={equipo} onClose={() => setCompartir(false)} />}
      <header className="d-marcador">
        <div className="d-eq"><div className="d-lado-t"><span>{tr('Tú')}</span><small>{equipo.formacion} · {valorEquipo(equipo)}</small></div><b key={`m${golesMios}`} className={golesMios ? 'd-gpop' : ''}>{golesMios}</b></div>
        <div className="d-centro"><small>{fase === 'fin' ? tr('Final') : tr('Ronda {r} de {t}', { r: ronda, t: RONDAS })}</small>
          <div className="d-rondas" aria-hidden>{cargaRonda.map((h, i) => <i key={i} className={h ? (h.res.golesMios > h.res.golesRival ? 'g' : h.res.golesMios < h.res.golesRival ? 'p' : 'e') : i + 1 === ronda ? 'ahora' : ''} />)}</div>
          <CtxLine ctx={ctx} /></div>
        <div className="d-eq d-su"><b key={`s${golesSu}`} className={golesSu ? 'd-gpop' : ''}>{golesSu}</b><div className="d-lado-t"><span>{rivalNombre}</span><small>{rival.formacion} · {valorEquipo(rival)}</small></div></div>
      </header>
      {fase === 'fin' ? (
        <div className="d-fin">
          <h1 className={gane ? 'gano' : 'perdio'}>{gane ? tr('¡Ganaste!') : tr('Perdiste')}</h1>
          <p className="muted">{golesMios} – {golesSu}{penal && <> · {tr('Penales {a}–{b}', { a: penal.yo, b: penal.rival })}</>}</p>
          <ol className="d-hist">{hist.map((h) => <li key={h.n}><b>{tr('Ronda {n}', { n: h.n })}</b> <span>{h.res.golesMios}–{h.res.golesRival}</span> <small>{nombre(h.mio.atacante)} · {nombre(h.mio.defensor)}</small></li>)}</ol>
          <div className="cta"><button className="btn pri" onClick={alSalir}>{tr('Volver a mi equipo')}</button></div>
          <BotonCompartir sutil onClick={() => setCompartir(true)} />
        </div>
      ) : (
        <>
          <div className="d-arena">
            <section className="d-lado mio">
              <h4>{tr('Tu equipo')}</h4>
              <Cancha formacion={equipo.formacion} ids={equipo.once} marcas={marcas} onNodo={fase === 'elegir' ? (i) => setSel(equipo.once[i]) : undefined} sel={sel} etiqueta={tr('Tu equipo')} />
              <Banca slots={equipo.suplentes} activo={sel} estado={(id) => (cMio.includes(id) && fase === 'elegir' ? 'cansado' : ronda < 3 ? 'espera' : undefined)} onJugador={fase === 'elegir' ? (id) => setSel(id) : undefined} />
            </section>
            <div className="d-medio">
              <div className="d-vs" aria-hidden><span>VS</span></div>
              <div className="d-controles">
                {fase === 'poder' && suRonda && atk && def ? (
                  <PanelPoder mio={{ atacante: atk, defensor: def }} su={suRonda} disp={pwMios} tipo={pwTipo} obj={pwObj} setTipo={setPwTipo} setObj={setPwObj} onJugar={() => resolver(pwTipo && pwObj ? { tipo: pwTipo, objetivo: pwObj } : undefined, { atacante: atk, defensor: def }, suRonda)} />
                ) : fase === 'bloqueado' && pend ? (
                  <PanelBloqueo pend={pend} candidatos={candidatos(equipo, ronda, cMio, [pend.bloqueado, pend.rol === 'atacante' ? pend.mioOrig.defensor : pend.mioOrig.atacante])} onElegir={elegirReemplazo} />
                ) : fase === 'elegir' ? (
                  <>
                    <div className="d-instr"><div className="d-rhead"><b>{tr('Ronda {r} de {t}', { r: ronda, t: RONDAS })}</b><span className="muted small">{tr('Elige quién ataca y quién defiende')}</span></div>
                      <div className="d-slots">
                        <RanuraRonda tipo="atk" id={atk} activa={!atk} bonus={atk ? bonus[atk] ?? 0 : 0} onQuitar={() => setAtk(null)} />
                        <RanuraRonda tipo="def" id={def} activa={!!atk && !def} bonus={def ? bonus[def] ?? 0 : 0} onQuitar={() => setDef(null)} />
                      </div>
                      <FilaPoderes disp={pwMios} />
                      <button className={`btn pri d-jugar${atk && def ? ' d-gran' : ''}`} disabled={!atk || !def} onClick={jugar}>{atk && def ? `▶ ${tr('Jugar ronda')}` : atk ? tr('Elige un defensor') : def ? tr('Elige un atacante') : tr('Elige atacante y defensor')}</button></div>
                    {p ? (
                      <Detalle p={p} bonus={bonus[p.id] ?? 0} rol={!atk ? 'atk' : !def ? 'def' : undefined}>
                        <div className="cta">
                          {(() => {
                            // El botón principal es el del paso que toca (primero ataque, luego defensa); el otro rol queda como opción discreta.
                            const bAtk = <button key="a" className={`btn ${atk && def ? '' : 'pri'}`} disabled={!puedeUsar(p.id) || def === p.id} onClick={() => { setAtk(p.id); setSel(null) }}>⚽ {tr('Atacar con él')}</button>
                            const bDef = <button key="d" className={`btn ${atk && def ? '' : 'pri'}`} disabled={!puedeUsar(p.id) || atk === p.id} onClick={() => { setDef(p.id); setSel(null) }}>🛡 {tr('Defender con él')}</button>
                            // Solo el rol que toca; con las dos ranuras llenas, ambos (para cambiar).
                            return !atk ? [bAtk] : !def ? [bDef] : [bAtk, bDef]
                          })()}
                        </div>
                        {!puedeUsar(p.id) && <p className="small muted">{PLAYER_BY_ID[p.id].line === 'GK' ? tr('El arquero defiende siempre solo.') : cMio.includes(p.id) ? tr('Está cansado: descansa esta ronda.') : tr('Entra desde la ronda 3.')}</p>}
                      </Detalle>
                    ) : null}
                  </>
                ) : (
                  ultima && (
                    <div className="d-escena-wrap" onClick={paso < 3 ? avanzar : undefined} style={{ cursor: paso < 3 ? 'pointer' : undefined }}>
                      {paso === 0 && ultima.pw && <RevelaPoderes pw={ultima.pw} />}
                      {paso === 1 && <EscenaJugada key="a" j={ultima.res.mia} mio titulo={tr('Tu ataque')} beat={beat} />}
                      {paso === 2 && <EscenaJugada key="b" j={ultima.res.rival} mio={false} titulo={tr('Su ataque')} beat={beat} />}
                      {paso === 3 && (
                        <div className="d-resumen">
                          <b>{tr('Resultado de la ronda {r}', { r: ronda })}</b>
                          <div className="d-resumen-fila"><span className={`d-pill ${ultima.res.mia.resultado}`}>{tr('Tu ataque')}: {resTxt(ultima.res.mia.resultado)}</span><span className={`d-pill ${ultima.res.rival.resultado}`}>{tr('Su ataque')}: {resTxt(ultima.res.rival.resultado)}</span></div>
                        </div>
                      )}
                      <div className="cta" onClick={(e) => e.stopPropagation()}>{paso < 3 ? <><button className="btn ghost" onClick={() => setPaso(3)}>{tr('Saltar animación')}</button><button className="btn ghost" onClick={() => setVel(vel === 'normal' ? 'rapida' : 'normal')}>{vel === 'normal' ? tr('Velocidad: normal') : tr('Velocidad: rápida')}</button></> : <button className="btn pri d-gran" onClick={siguiente}>{ronda >= RONDAS ? tr('Ver resultado final') : tr('Siguiente ronda')}</button>}</div>
                    </div>
                  )
                )}
              </div>
            </div>
            <section className="d-lado su">
              <h4>{rivalNombre}</h4>
              <Cancha formacion={rival.formacion} ids={rival.once} marcas={marcasSu} etiqueta={rivalNombre} />
              <Banca slots={rival.suplentes} estado={estadoSu} />
            </section>
          </div>
        </>
      )}
    </div>
  )
}

const resTxt = (r: 'gol' | 'atajada' | 'corte') => (r === 'gol' ? tr('¡GOL!') : r === 'atajada' ? tr('¡Atajada!') : tr('¡Cortado!'))

// Una jugada animada: atacante contra defensor y, si lo supera, contra el arquero.
// Barra de probabilidad con un «dado» (0-100) que rueda hasta su número: se ve por qué salió así y cuánto faltó.
function BarraProb({ clase, titulo, p, tirada, ok, nota }: { clase: string; titulo: string; p: number; tirada: number; ok: boolean; nota?: string }) {
  const pct = Math.round(p * 100), n = Math.round(tirada * 100)
  return (
    <div className={`d-prob ${clase} ${ok ? 'ok' : 'no'}`}>
      <div className="d-prob-h"><b>{titulo}</b><span>{pct} %</span></div>
      <div className="d-prob-bar" style={{ ['--x' as string]: `${Math.min(97, Math.max(3, tirada * 100))}%` }}><i style={{ width: `${pct}%` }} /><span className="d-dado" aria-hidden>🎲</span></div>
      <p>{tr('El dado de la jugada salió {n}: se necesita {p} o menos.', { n, p: pct })} <b>{ok ? tr('¡Alcanzó!') : tr('No alcanzó.')}</b></p>
      {nota && <p className="d-prob-nota">{nota}</p>}
    </div>
  )
}

// Consejo corto según lo que pasó, para entender cómo se analizó la jugada y cómo mejorar.
function consejo(j: ResultadoRonda['mia'], mio: boolean): string {
  const A = Math.round(j.pA ?? 0), D = Math.round(j.pD ?? 0), R = Math.round(j.rem ?? 0), Q = Math.round(j.arq ?? 0)
  if (mio) {
    if (j.resultado === 'corte') return j.pPase < 0.5 ? tr('Su defensa ({d}) era mayor que tu ataque ({a}). Elige un atacante con más poder de ataque para subir tus opciones.', { a: A, d: D }) : tr('Tenías ventaja ({p} %) y esta vez la suerte no acompañó. Repetir buenas decisiones gana a la larga.', { p: Math.round(j.pPase * 100) })
    if (j.resultado === 'atajada') return R < Q ? tr('El arquero rival ({q}) supera el remate de tu atacante ({r}). Los atacantes con más Disparo marcan más.', { q: Q, r: R }) : tr('El remate era favorable ({p} %) pero el arquero tuvo suerte. Sigue eligiendo bien.', { p: Math.round((j.pTiro ?? 0) * 100) })
    return tr('¡Buena jugada! Tenías {p} % de probabilidad total y se dio.', { p: Math.round(j.pGol * 100) })
  }
  if (j.resultado === 'corte') return tr('Tu defensor ({d}) frenó a su atacante ({a}). Elegir defensores por poder de defensa funciona.', { a: A, d: D })
  if (j.resultado === 'atajada') return tr('Tu arquero ({q}) detuvo el remate rival. ¡Un buen arquero salva partidos!', { q: Q })
  return j.pPase >= 0.5 ? tr('Su atacante ({a}) superó a tu defensor ({d}). Elige para defender a quien tenga más Defensa, no más valoración.', { a: A, d: D }) : tr('Tu defensor ({d}) era igual o mejor que su atacante ({a}), pero la suerte favoreció al rival esta vez.', { a: A, d: D })
}

// ---------- poderes ----------
const iconoPoder = (x: TipoPoder) => (x === 'impulso' ? '⚡' : x === 'debilitar' ? '🥶' : '🚫')
const nombrePoder = (x: TipoPoder) => (x === 'impulso' ? tr('Impulso') : x === 'debilitar' ? tr('Debilitar') : tr('Bloqueo'))
const descPoder = (x: TipoPoder) => (x === 'impulso' ? tr('Suma +{n} a un jugador tuyo en esta ronda.', { n: BONO_IMPULSO }) : x === 'debilitar' ? tr('Resta −{n} a un jugador rival en esta ronda.', { n: CASTIGO_DEBILITAR }) : tr('El rival no puede usar a un jugador: tiene que cambiarlo.'))
const textoPoder = (p: Poder) => { const j = apellido(PLAYER_BY_ID[p.objetivo].name); return p.tipo === 'impulso' ? tr('Impulso: +{n} a {j}', { n: BONO_IMPULSO, j }) : p.tipo === 'debilitar' ? tr('Debilitar: −{n} a {j}', { n: CASTIGO_DEBILITAR, j }) : tr('Bloqueo a {j}', { j }) }

// Los tres poderes de un vistazo (se ven los que aún tienes).
function FilaPoderes({ disp }: { disp: Disponibles }) {
  return (
    <div className="d-poderes-fila" aria-label={tr('Tus poderes')}>
      <span>{tr('Tus poderes')}</span>
      {TIPOS_PODER.map((x) => <i key={x} className={`d-pw ${x}${disp[x] ? '' : ' usado'}`} title={`${nombrePoder(x)}: ${descPoder(x)}`}>{iconoPoder(x)}</i>)}
    </div>
  )
}

// Tras ver a los jugadores rivales: eliges un poder en secreto (o ninguno) y a quién va dirigido.
function PanelPoder({ mio, su, disp, tipo, obj, setTipo, setObj, onJugar }: { mio: Cambio; su: Cambio; disp: Disponibles; tipo: TipoPoder | null; obj: string | null; setTipo: (x: TipoPoder | null) => void; setObj: (id: string | null) => void; onJugar: () => void }) {
  const objetivos = tipo === 'impulso' ? [mio.atacante, mio.defensor] : [su.atacante, su.defensor]
  const rolTxt = (c: Cambio, id: string) => (c.atacante === id ? '⚽' : '🛡')
  const jugador = (id: string) => PLAYER_BY_ID[id]
  return (
    <div className="d-poder-panel">
      <div className="d-rhead"><b>{tr('Elige un poder en secreto')}</b><span className="muted small">{tr('Solo puedes usar cada poder una vez por partida. El rival también tiene los suyos.')}</span></div>
      <div className="d-rivales">
        <span>{tr('El rival eligió')}</span>
        {[su.atacante, su.defensor].map((id) => <em key={id}><Avatar p={jugador(id)} size={26} /> {rolTxt(su, id)} {apellido(jugador(id).name)}</em>)}
      </div>
      <div className="d-pw-cards">
        {TIPOS_PODER.map((x) => (
          <button key={x} type="button" disabled={!disp[x]} className={`d-pw-card ${x}${tipo === x ? ' on' : ''}`} onClick={() => { setTipo(tipo === x ? null : x); setObj(null) }}>
            <span className="ic" aria-hidden>{iconoPoder(x)}</span><b>{nombrePoder(x)}</b><small>{disp[x] ? descPoder(x) : tr('Usado')}</small>
          </button>
        ))}
      </div>
      {tipo && (
        <div className="d-pw-obj">
          <span>{tr('Elige a quién')}</span>
          <div>{objetivos.map((id) => (
            <button key={id} type="button" className={`d-pw-j${obj === id ? ' on' : ''}`} onClick={() => setObj(id)}>
              <Avatar p={jugador(id)} size={38} /><b>{apellido(jugador(id).name)}</b><small>{rolTxt(tipo === 'impulso' ? mio : su, id)}</small>
            </button>))}</div>
        </div>
      )}
      <button className={`btn pri d-jugar${!tipo || obj ? ' d-gran' : ''}`} disabled={!!tipo && !obj} onClick={onJugar}>
        {tipo && obj ? `${iconoPoder(tipo)} ${tr('Jugar ronda con {p}', { p: nombrePoder(tipo) })}` : tipo ? tr('Elige a quién') : `▶ ${tr('Jugar sin poder')}`}
      </button>
    </div>
  )
}

// El rival bloqueó a uno de tus jugadores: elige quién lo reemplaza, en vivo.
function PanelBloqueo({ pend, candidatos: cs, onElegir }: { pend: Pendiente; candidatos: string[]; onElegir: (id: string) => void }) {
  const bloq = PLAYER_BY_ID[pend.bloqueado]
  const f = pend.rol === 'atacante' ? poderAtaque : poderDefensa
  return (
    <div className="d-poder-panel d-bloqueo">
      <div className="d-bq-t"><span aria-hidden>🚫</span><div><b>{tr('¡El rival bloqueó a {n}!', { n: bloq.name })}</b><small>{pend.rol === 'atacante' ? tr('Elige quién ataca en su lugar') : tr('Elige quién defiende en su lugar')}</small></div></div>
      {cs.length ? (
        <div className="d-bq-lista">{cs.map((id) => { const p = PLAYER_BY_ID[id]; return <button key={id} type="button" className="d-pw-j" onClick={() => onElegir(id)}><Avatar p={p} size={44} /><b>{apellido(p.name)}</b><small>{Math.round(f(p))}</small></button> })}</div>
      ) : <button className="btn pri" onClick={() => onElegir(pend.bloqueado)}>{tr('No queda nadie más: sigue con él')}</button>}
    </div>
  )
}

// Se revelan los dos poderes a la vez, con su efecto.
function RevelaPoderes({ pw }: { pw: PoderRonda }) {
  const lado = (de: 'mio' | 'su', p: Poder | undefined) => {
    const ef = pw.efectos.find((e) => e.de === de)
    const cambio = de === 'mio' ? pw.cambioSu : pw.cambioMio // un bloqueo mío cambia a un jugador suyo, y al revés
    return (
      <div className={`d-rev-pw ${de}${p ? ` ${p.tipo}` : ' ninguno'}`}>
        <small>{de === 'mio' ? tr('Tu poder') : tr('Su poder')}</small>
        {p ? <>
          <span className="ic" aria-hidden>{iconoPoder(p.tipo)}</span>
          <b>{nombrePoder(p.tipo)}</b>
          <em>{textoPoder(p)}</em>
          <i className={ef?.aplicado ? 'ok' : 'no'}>{p.tipo === 'bloqueo' && cambio ? tr('{d} tuvo que dejar su lugar a {a}.', { d: apellido(PLAYER_BY_ID[cambio.de].name), a: apellido(PLAYER_BY_ID[cambio.a].name) }) : ef?.aplicado ? tr('Surtió efecto.') : tr('Se perdió: ese jugador ya no jugó.')}</i>
        </> : <><span className="ic" aria-hidden>·</span><em>{tr('Sin poder')}</em></>}
      </div>
    )
  }
  return (
    <div className="d-escena d-poderes-rev">
      <p className="d-esc-t">{tr('¡Poderes revelados!')}</p>
      <div className="d-rev-fila">{lado('mio', pw.mio)}{lado('su', pw.su)}</div>
    </div>
  )
}

// Frases del narrador: una por jugada, con los nombres reales.
function narrador(j: ResultadoRonda['mia']): string {
  const a = apellido(PLAYER_BY_ID[j.atacante].name), d = apellido(PLAYER_BY_ID[j.defensor].name), k = apellido(PLAYER_BY_ID[j.arquero].name)
  const h = [...(j.atacante + j.defensor)].reduce((s, c) => s + c.charCodeAt(0), 0)
  if (j.resultado === 'gol') return [tr('¡{a} se saca a {d} de encima y la clava!', { a, d }), tr('¡{a} define sin piedad ante {k}! ¡Golazo!', { a, k }), tr('¡Remate imparable de {a}! {k} no pudo hacer nada.', { a, k })][h % 3]
  if (j.resultado === 'atajada') return [tr('¡{k} vuela y se queda con el remate de {a}!', { a, k }), tr('¡Paradón de {k}! {a} no lo puede creer.', { a, k })][h % 2]
  return [tr('¡{d} llega justo y corta el avance de {a}!', { a, d }), tr('¡Muro! {d} le cierra todos los caminos a {a}.', { a, d })][h % 2]
}

// La jugada se revela por tiempos y con una pelota que viaja: 1) atacante contra defensor, 2) quién supera a quién (y el arquero), 3) el resultado.
function EscenaJugada({ j, mio, titulo, beat }: { j: ResultadoRonda['mia']; mio: boolean; titulo: string; beat: number }) {
  const at = PLAYER_BY_ID[j.atacante], df = PLAYER_BY_ID[j.defensor], gk = PLAYER_BY_ID[j.arquero]
  const pasa = j.resultado !== 'corte'
  const v = (n: number) => (beat >= n ? 'rev' : 'oculto')
  // posición de la pelota (en % del ancho) según el momento de la jugada
  const X = pasa ? { a: 15, d: 48, k: 84 } : { a: 27, d: 73, k: 73 }
  const bola = beat <= 1 ? X.a : beat === 2 ? (pasa ? X.k : X.d) : j.resultado === 'gol' ? 104 : j.resultado === 'atajada' ? X.d + 8 : X.a + 6
  const fin = beat >= 3
  return (
    <div className={`d-escena beats ${j.resultado}${mio ? ' mio' : ' su'}${fin ? ' fin' : ''}`}>
      <p className="d-esc-t">{titulo}</p>
      <p className="d-esc-cap">{beat <= 1 ? tr('Atacante contra defensor') : beat === 2 ? (pasa ? tr('Si lo supera, remata contra el arquero') : tr('El defensor corta la jugada')) : '\u00a0'}</p>
      <div className="d-esc-fila">
        <span className={`d-pelota b${beat}${fin ? ` ${j.resultado}` : ''}`} style={{ left: `${bola}%` }} aria-hidden>⚽</span>
        <div className="d-esc-j a rev"><Avatar p={at} size={92} /><b>{at.name}</b><small>⚽ {Math.round(poderAtaque(at))}</small></div>
        <div className={`d-esc-j d ${beat >= 2 ? (pasa ? 'vencido' : 'gana') : ''} rev`}><Avatar p={df} size={92} /><b>{df.name}</b><small>🛡 {Math.round(poderDefensa(df))}</small><em className={v(2)}>{pasa ? tr('Superado') : tr('Corta')}</em></div>
        {pasa && <><span className={`d-esc-x l2 ${v(2)}`} aria-hidden>→</span>
          <div className={`d-esc-j g ${beat >= 3 ? (j.resultado === 'gol' ? 'vencido' : 'gana') : ''} ${v(2)}`}><Avatar p={gk} size={92} /><b>{gk.name}</b><small>🧤 {Math.round(poderArquero(gk))}</small><em className={v(3)}>{j.resultado === 'gol' ? tr('Vencido') : tr('Ataja')}</em></div></>}
        {fin && j.resultado === 'gol' && <div className="d-confeti" aria-hidden>{Array.from({ length: 16 }, (_, n) => <i key={n} style={{ ['--a' as string]: `${n * 22.5}deg`, ['--d' as string]: `${46 + (n % 4) * 14}px`, ['--c' as string]: ['#ffd54a', '#00e5ff', '#ff2e88', '#fff'][n % 4] }} />)}</div>}
      </div>
      <div className={`d-esc-res ${v(3)}`}>{resTxt(j.resultado)}</div>
      <p className={`d-narra ${v(3)}`}>{narrador(j)}</p>
      {fin && j.pA !== undefined && j.pD !== undefined && j.t1 !== undefined && (
        <details className="d-por-que">
          <summary>{tr('¿Por qué?')}</summary>
          <BarraProb clase="rev" titulo={tr('Duelo: ataque {a} contra defensa {d}', { a: Math.round(j.pA), d: Math.round(j.pD) })} p={j.pPase} tirada={j.t1} ok={pasa} />
          {pasa && j.rem !== undefined && j.arq !== undefined && j.pTiro !== undefined && j.t2 !== undefined && (
            <BarraProb clase="rev" titulo={tr('Remate {r} contra arquero {q}', { r: Math.round(j.rem), q: Math.round(j.arq) })} p={j.pTiro} tirada={j.t2} ok={j.resultado === 'gol'} nota={j.clima !== undefined && j.clima < 0.97 ? tr('El clima reduce la probabilidad de gol.') : j.clima !== undefined && j.clima > 1.03 ? tr('El clima aumenta la probabilidad de gol.') : undefined} />
          )}
          {pasa && j.pTiro !== undefined && <small className="d-esc-p rev">{tr('Probabilidad total de gol: {a} % × {b} % = {c} %', { a: Math.round(j.pPase * 100), b: Math.round(j.pTiro * 100), c: Math.round(j.pGol * 100) })}</small>}
          <p className="d-esc-tip rev"><b>{tr('Cómo mejorar')}</b> {consejo(j, mio)}</p>
        </details>
      )}
    </div>
  )
}
