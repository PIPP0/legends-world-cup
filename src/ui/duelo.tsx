import { CompartirEquipo, type Red } from './compartir'
import { useEffect, useMemo, useState } from 'react'
import { PLAYER_BY_ID, TEAM_BY_ID } from '../data/lookup'
import { tr } from '../i18n'
import { attrLabel, posLabel, posNombre } from '../i18n/nombres'
import {
  FORMACIONES, NIVELES, NOMBRES_FORMACION, N_PICKS, RONDAS, equipoMaquina, eligeMaquina, jugarRonda, ofertas, paisesConSinergia, penales, poderAtaque, poderDefensa, poderArquero,
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
function Nodo({ p, x, y, marca, onClick, etiqueta }: { p?: Player; x: number; y: number; marca?: Marca; onClick?: () => void; etiqueta?: string }) {
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
function Cancha({ formacion, ids, marcas, onNodo, onVacio, actual, etiqueta }: { formacion: string; ids: (string | undefined)[]; marcas?: Record<string, Marca>; onNodo?: (i: number) => void; onVacio?: (i: number) => void; actual?: number; etiqueta: string }) {
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
        return <Nodo key={i} p={p} x={h.x} y={h.y} marca={actual === i ? 'actual' : id ? marcas?.[id] : undefined} onClick={p ? (onNodo ? () => onNodo(i) : undefined) : (onVacio ? () => onVacio(i) : undefined)} etiqueta={!p ? posNombre(h.pos) : undefined} />
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

// ---------- presentación (sin equipo todavía): lo que hay que ver para querer jugar ----------
const EJEMPLO = onceDeEjemplo('4-3-3')
const TRIO = ['por-cristiano-ronaldo', 'arg-lionel-messi', 'bra-pele'].filter((id) => PLAYER_BY_ID[id])
function Presentacion({ armar }: { armar: () => void }) {
  return (
    <div className="duelo d-land">
      <section className="d-portada">
        <div className="d-portada-txt">
          <p className="kicker">⚔ {tr('Nuevo')}</p>
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
        <li><span className="d-paso-n">2</span><div className="d-iconos"><i>⚔</i><i>🛡</i></div><b>{tr('Ataca y defiende')}</b><p>{tr('Cada ronda eliges un atacante y un defensor. Los que uses se cansan: rota a tu plantel.')}</p></li>
        <li><span className="d-paso-n">3</span><div className="d-medallas"><i className="n-bronce" /><i className="n-plata" /><i className="n-oro" /><i className="n-leyenda" /></div><b>{tr('Sube de nivel')}</b><p>{tr('Vence a la máquina de Bronce a Leyenda y prepárate para el ranking.')}</p></li>
      </ol>
      <p className="d-sinergia">🤝 {tr('Tres jugadores de un mismo país dan una sinergia: más fuerza para todo tu equipo.')}</p>
      <div className="cta d-cierre"><button className="btn pri d-gran" onClick={armar}>{tr('Armar mi equipo')} →</button></div>
    </div>
  )
}

// ---------- inicio: tu equipo + elegir rival ----------
function Inicio({ equipo, stats, nivel, setNivel, armar, jugar }: { equipo: Equipo | null; stats: Stats; nivel: Nivel; setNivel: (n: Nivel) => void; armar: () => void; jugar: () => void }) {
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
      <div className="d-cols d-cols-eq">
        <div className="d-c-cancha">
          <Cancha formacion={equipo.formacion} ids={equipo.once} onNodo={(i) => setSel(equipo.once[i])} etiqueta={tr('Tu equipo')} />
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
          <div><Cancha formacion={formacion} ids={once} onNodo={(i) => setVista(once[i])} etiqueta={tr('Tu equipo')} /><h4 className="sub">{tr('Suplentes')}</h4><Banca slots={sup} activo={vista} onJugador={(id) => setVista(id)} /></div>
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
          <Cancha formacion={formacion} ids={picks.slice(0, 11)} actual={slot !== null && slot < 11 ? slot : undefined} onNodo={(i) => setVista(picks[i] ?? null)} onVacio={(i) => { setSlot(i); setVista(null) }} etiqueta={tr('Tu equipo')} />
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
interface Ronda { n: number; res: ResultadoRonda; mio: Cambio; su: Cambio }
// Una de las dos ranuras de la ronda: qué hace ese puesto, quién lo ocupa y cuánto aporta.
function RanuraRonda({ tipo, id, activa, onQuitar }: { tipo: 'atk' | 'def'; id: string | null; activa: boolean; onQuitar: () => void }) {
  const p = id ? PLAYER_BY_ID[id] : null
  const atk = tipo === 'atk'
  return (
    <div className={`d-slot ${tipo}${p ? ' lleno' : ''}${activa ? ' activa' : ''}`}>
      <span className="d-slot-ic" aria-hidden>{atk ? '⚔' : '🛡'}</span>
      <div className="d-slot-tx">
        <b>{atk ? tr('Tu ataque') : tr('Tu defensa')}</b>
        <span className="muted small">{atk ? tr('Intenta marcar un gol') : tr('Frena el ataque rival')}</span>
      </div>
      {p ? (
        <div className="d-slot-j"><div className="d-slot-av"><Avatar p={p} size={44} /></div><span><b>{p.name}</b><i>{tr('Poder {n}', { n: Math.round(atk ? poderAtaque(p) : poderDefensa(p)) })}</i></span><button type="button" className="d-slot-x" onClick={onQuitar} aria-label={tr('Quitar')} title={tr('Quitar')}>✕</button></div>
      ) : <span className="d-slot-vacio">{activa ? '👆 ' : ''}{tr('Toca a un jugador de tu cancha')}</span>}
    </div>
  )
}

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
  const [compartir, setCompartir] = useState(false)
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
  const rivalNombre = tr('Rival {n}', { n: tr(NIVELES.find((n) => n.id === nivel)!.nombre) })
  const p = sel ? PLAYER_BY_ID[sel] : null
  // escena de la ronda: se revela primero tu ataque y luego el del rival (con el rival mostrando lo que eligió)
  const [paso, setPaso] = useState(0)
  useEffect(() => {
    if (fase !== 'resultado') return
    setPaso(0)
    const t1 = setTimeout(() => setPaso(1), 2600), t2 = setTimeout(() => setPaso(2), 5200)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [fase, ronda])
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
        <div className="d-eq"><div className="d-lado-t"><span>{tr('Tú')}</span><small>{equipo.formacion} · {valorEquipo(equipo)}</small></div><b>{golesMios}</b></div>
        <div className="d-centro"><small>{fase === 'fin' ? tr('Final') : tr('Ronda {r} de {t}', { r: ronda, t: RONDAS })}</small>
          <div className="d-rondas" aria-hidden>{cargaRonda.map((h, i) => <i key={i} className={h ? (h.res.golesMios > h.res.golesRival ? 'g' : h.res.golesMios < h.res.golesRival ? 'p' : 'e') : i + 1 === ronda ? 'ahora' : ''} />)}</div>
          <CtxLine ctx={ctx} /></div>
        <div className="d-eq d-su"><b>{golesSu}</b><div className="d-lado-t"><span>{rivalNombre}</span><small>{rival.formacion} · {valorEquipo(rival)}</small></div></div>
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
              <Cancha formacion={equipo.formacion} ids={equipo.once} marcas={marcas} onNodo={fase === 'elegir' ? (i) => setSel(equipo.once[i]) : undefined} etiqueta={tr('Tu equipo')} />
              <Banca slots={equipo.suplentes} activo={sel} estado={(id) => (cMio.includes(id) && fase === 'elegir' ? 'cansado' : ronda < 3 ? 'espera' : undefined)} onJugador={fase === 'elegir' ? (id) => setSel(id) : undefined} />
            </section>
            <div className="d-medio">
              <div className="d-vs" aria-hidden><span>VS</span></div>
              <div className="d-controles">
                {fase === 'elegir' ? (
                  <>
                    <div className="d-instr"><div className="d-rhead"><b>{tr('Ronda {r} de {t}', { r: ronda, t: RONDAS })}</b><span className="muted small">{tr('Elige quién ataca y quién defiende')}</span></div>
                      <div className="d-slots">
                        <RanuraRonda tipo="atk" id={atk} activa={!atk} onQuitar={() => setAtk(null)} />
                        <RanuraRonda tipo="def" id={def} activa={!!atk && !def} onQuitar={() => setDef(null)} />
                      </div>
                      <button className={`btn pri d-jugar${atk && def ? ' d-gran' : ''}`} disabled={!atk || !def} onClick={jugar}>{atk && def ? `▶ ${tr('Jugar ronda')}` : atk ? tr('Elige un defensor') : def ? tr('Elige un atacante') : tr('Elige atacante y defensor')}</button></div>
                    {p ? (
                      <Detalle p={p} bonus={bonus[p.id] ?? 0}>
                        <div className="cta">
                          {(() => {
                            // El botón principal es el del paso que toca (primero ataque, luego defensa); el otro rol queda como opción discreta.
                            const bAtk = <button key="a" className={`btn ${atk && !def ? 'ghost' : 'pri'}`} disabled={!puedeUsar(p.id) || def === p.id} onClick={() => { setAtk(p.id); setSel(null) }}>⚔ {tr('Atacar con él')}</button>
                            const bDef = <button key="d" className={`btn ${atk && !def ? 'pri' : 'ghost'}`} disabled={!puedeUsar(p.id) || atk === p.id} onClick={() => { setDef(p.id); setSel(null) }}>🛡 {tr('Defender con él')}</button>
                            return atk && !def ? [bDef, bAtk] : [bAtk, bDef]
                          })()}
                        </div>
                        {!puedeUsar(p.id) && <p className="small muted">{PLAYER_BY_ID[p.id].line === 'GK' ? tr('El arquero defiende siempre solo.') : cMio.includes(p.id) ? tr('Está cansado: descansa esta ronda.') : tr('Entra desde la ronda 3.')}</p>}
                      </Detalle>
                    ) : null}
                  </>
                ) : (
                  ultima && (
                    <div className="d-escena-wrap">
                      {paso === 0 && <EscenaJugada key="a" j={ultima.res.mia} mio titulo={tr('Tu ataque')} />}
                      {paso === 1 && <EscenaJugada key="b" j={ultima.res.rival} mio={false} titulo={tr('Su ataque')} />}
                      {paso === 2 && (
                        <div className="d-resumen">
                          <b>{tr('Resultado de la ronda {r}', { r: ronda })}</b>
                          <div className="d-resumen-fila"><span className={`d-pill ${ultima.res.mia.resultado}`}>{tr('Tu ataque')}: {resTxt(ultima.res.mia.resultado)}</span><span className={`d-pill ${ultima.res.rival.resultado}`}>{tr('Su ataque')}: {resTxt(ultima.res.rival.resultado)}</span></div>
                        </div>
                      )}
                      <div className="cta">{paso < 2 ? <button className="btn ghost" onClick={() => setPaso(2)}>{tr('Saltar animación')}</button> : <button className="btn pri d-gran" onClick={siguiente}>{ronda >= RONDAS ? tr('Ver resultado final') : tr('Siguiente ronda')}</button>}</div>
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
function EscenaJugada({ j, mio, titulo }: { j: ResultadoRonda['mia']; mio: boolean; titulo: string }) {
  const at = PLAYER_BY_ID[j.atacante], df = PLAYER_BY_ID[j.defensor], gk = PLAYER_BY_ID[j.arquero]
  const pasa = j.resultado !== 'corte'
  return (
    <div className={`d-escena ${j.resultado}${mio ? ' mio' : ' su'}`}>
      <p className="d-esc-t">{titulo}</p>
      <div className="d-esc-fila">
        <div className="d-esc-j a"><Avatar p={at} size={92} /><b>{at.name}</b><small>⚔ {Math.round(poderAtaque(at))}</small></div>
        <span className="d-esc-x" aria-hidden>⚔</span>
        <div className={`d-esc-j d ${pasa ? 'vencido' : 'gana'}`}><Avatar p={df} size={92} /><b>{df.name}</b><small>🛡 {Math.round(poderDefensa(df))}</small><em>{pasa ? tr('Superado') : tr('Corta')}</em></div>
        {pasa && <><span className="d-esc-x l2" aria-hidden>→</span>
          <div className={`d-esc-j g ${j.resultado === 'gol' ? 'vencido' : 'gana'}`}><Avatar p={gk} size={92} /><b>{gk.name}</b><small>🧤 {Math.round(poderArquero(gk))}</small><em>{j.resultado === 'gol' ? tr('Vencido') : tr('Ataja')}</em></div></>}
      </div>
      <div className="d-esc-res">{resTxt(j.resultado)}</div>
      <small className="d-esc-p">{tr('Probabilidad de gol: {p} %', { p: Math.round(j.pGol * 100) })}</small>
    </div>
  )
}
