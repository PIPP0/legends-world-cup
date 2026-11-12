import { useEffect, useMemo, useState } from 'react'
import { tr } from '../i18n'
import { NUBE_ACTIVA } from '../cloud/firebase'
import { cambiarAliasNube, leerRankingNube, miIdRanking, publicarPartida } from '../cloud/ranking'
import { paisAproximado } from '../lib/pais'
import { MI_RANKING0, PUNTOS_VICTORIA, aliasLimpio, aliasPorDefecto, armarRanking, sumarPartida, type EntradaRanking, type MiRanking } from '../engine/ranking'
import type { Nivel } from '../engine/duelo'

const CLAVE_RANK = 'lwc:duelo:ranking'
const CLAVE_ALIAS = 'lwc:duelo:alias'
const leerLocal = (): MiRanking => { try { const s = localStorage.getItem(CLAVE_RANK); return s ? { ...MI_RANKING0, ...(JSON.parse(s) as MiRanking) } : MI_RANKING0 } catch { return MI_RANKING0 } }
const guardarLocal = (r: MiRanking) => { try { localStorage.setItem(CLAVE_RANK, JSON.stringify(r)) } catch { /* sin almacenamiento */ } }
export function leerAlias(): string {
  try {
    const a = localStorage.getItem(CLAVE_ALIAS); if (a) return a
    const nuevo = aliasPorDefecto(Math.random().toString(36).slice(2, 8)); localStorage.setItem(CLAVE_ALIAS, nuevo); return nuevo
  } catch { return aliasPorDefecto('0000') }
}

// Se llama al terminar (o abandonar) un partido: suma el resultado a mi ranking y, si hay nube, lo publica.
export function anotarEnRanking(nivel: Nivel, gane: boolean): void {
  guardarLocal(sumarPartida(leerLocal(), nivel, gane))
  void publicarPartida(leerAlias(), paisAproximado(), nivel, gane)
}

// Ranking completo: reales (nube) + yo + demostración.
function useRanking() {
  const [reales, setReales] = useState<EntradaRanking[]>([])
  const [miId, setMiId] = useState<string>('yo')
  const [cargando, setCargando] = useState(NUBE_ACTIVA)
  const [alias, setAliasEstado] = useState(leerAlias)
  const [version, setVersion] = useState(0)
  useEffect(() => {
    let vivo = true
    void (async () => { const [lista, id] = await Promise.all([leerRankingNube(), miIdRanking()]); if (!vivo) return; setReales(lista); if (id) setMiId(id); setCargando(false) })()
    return () => { vivo = false }
  }, [version])
  const local = leerLocal()
  const yo: EntradaRanking = useMemo(() => {
    const enNube = reales.find((r) => r.id === miId)
    // si ya estoy en la nube, valen sus números; si no (sin conexión o reglas sin publicar), valen los míos
    return { id: miId, alias, pais: paisAproximado(), puntos: enNube?.puntos ?? local.puntos, ganadas: enNube?.ganadas ?? local.ganadas, jugadas: enNube?.jugadas ?? local.jugadas, mejorRacha: enNube?.mejorRacha ?? local.mejorRacha, yo: true }
  }, [reales, miId, alias, local.puntos, local.ganadas, local.jugadas, local.mejorRacha])
  const lista = useMemo(() => armarRanking(reales, yo), [reales, yo])
  const posicion = lista.findIndex((e) => e.id === miId) + 1
  const setAlias = (a: string) => {
    const limpio = aliasLimpio(a) || aliasPorDefecto('0000')
    try { localStorage.setItem(CLAVE_ALIAS, limpio) } catch { /* sin almacenamiento */ }
    setAliasEstado(limpio); void cambiarAliasNube(limpio).then(() => setVersion((v) => v + 1))
  }
  return { lista, yo, posicion, cargando, alias, setAlias, hayReales: reales.some((r) => r.id !== miId) }
}

const Pais = ({ iso }: { iso: string }) => (iso ? <img className="rk-flag" src={`https://flagcdn.com/w40/${iso}.png`} alt={iso.toUpperCase()} loading="lazy" width={22} height={15} /> : <span className="rk-flag ph" aria-hidden />)

function Fila({ e, pos }: { e: EntradaRanking; pos: number }) {
  return (
    <li className={`rk-fila${e.yo ? ' yo' : ''}`}>
      <span className={`rk-pos p${pos <= 3 ? pos : 0}`}>{pos}</span>
      <Pais iso={e.pais} />
      <span className="rk-nombre"><b>{e.alias}</b>{e.yo && <em className="rk-tu">{tr('Tú')}</em>}{e.demo && <em className="rk-demo" title={tr('Jugador de demostración (ficticio)')}>{tr('Demo')}</em>}</span>
      <span className="rk-rec">{e.ganadas}/{e.jugadas}</span>
      <b className="rk-pts">{e.puntos}</b>
    </li>
  )
}

// Botón de la pantalla «Tu equipo»: lleva al ranking y, si ya jugaste, muestra tu puesto.
export function BotonRanking({ compacto }: { compacto?: boolean }) {
  const { yo, posicion, lista } = useRanking()
  return (
    <a className={`d-btn-rank${compacto ? ' mini' : ''}`} href="#/ranking" title={tr('Ver ranking')}>
      <span aria-hidden>🏆</span><b>{tr('Ranking')}</b>
      <small>{yo.jugadas > 0 ? tr('Tu puesto: {p} de {t}', { p: posicion, t: lista.length }) : tr('Ver ranking')}</small>
    </a>
  )
}

// Resumen para la pantalla «Tu equipo»: los 5 primeros y mi posición.
export function RankingResumen() {
  const { lista, yo, posicion } = useRanking()
  const top = lista.slice(0, 5)
  return (
    <div className="rk-card">
      <div className="rk-h"><b>🏆 {tr('Ranking')}</b><a href="#/ranking">{tr('Ver ranking completo')} →</a></div>
      <div className="rk-cols" aria-hidden><span>#</span><span /><span>{tr('Jugador')}</span><span>{tr('Victorias/partidos')}</span><span>{tr('Puntos')}</span></div>
      <ol className="rk-lista">{top.map((e, i) => <Fila key={e.id} e={e} pos={i + 1} />)}</ol>
      {yo.jugadas > 0 && posicion > 5 && <ol className="rk-lista rk-mio"><Fila e={yo} pos={posicion} /></ol>}
      {yo.jugadas === 0 && <p className="rk-vacio">{tr('Juega tu primer duelo para aparecer en el ranking.')}</p>}
    </div>
  )
}

const NIVELES_PTS: { n: Nivel; nombre: string; clase: string }[] = [
  { n: 'bronce', nombre: 'Bronce', clase: 'br' }, { n: 'plata', nombre: 'Plata', clase: 'pl' }, { n: 'oro', nombre: 'Oro', clase: 'or' }, { n: 'leyenda', nombre: 'Leyenda', clase: 'le' },
]

// Una tarjeta del podio (puestos 1 a 3).
function Podio({ e, pos }: { e: EntradaRanking; pos: 1 | 2 | 3 }) {
  return (
    <div className={`rk-pod p${pos}${e.yo ? ' yo' : ''}`}>
      {pos === 1 && <span className="rk-corona" aria-hidden>👑</span>}
      <span className={`rk-medalla p${pos}`}>{pos}</span>
      <Pais iso={e.pais} />
      <b className="rk-pod-n">{e.alias}</b>
      <span className="rk-pod-tags">{e.yo && <em className="rk-tu">{tr('Tú')}</em>}{e.demo && <em className="rk-demo">{tr('Demo')}</em>}</span>
      <strong className="rk-pod-pts">{e.puntos}<small>pts</small></strong>
      <small className="rk-pod-rec">{e.ganadas}/{e.jugadas}</small>
    </div>
  )
}

// Página completa del ranking: centrada, con podio, tu posición y por qué participar.
export function RankingPagina() {
  const { lista, yo, posicion, cargando, alias, setAlias, hayReales } = useRanking()
  const [editando, setEditando] = useState(alias)
  const [abierto, setAbierto] = useState(false)
  useEffect(() => { setEditando(alias) }, [alias])
  const top3 = lista.slice(0, 3)
  const resto = lista.slice(3, 50)
  const siguiente = posicion > 1 ? lista[posicion - 2] : null
  const faltan = siguiente ? Math.max(1, siguiente.puntos - yo.puntos + 1) : 0
  return (
    <div className="rk-pagina">
      <header className="rk-hero">
        <span className="rk-trofeo" aria-hidden>🏆</span>
        <h1>{tr('Ranking')}</h1>
        <p>{tr('Gana duelos, suma puntos y llega a la cima.')}</p>
      </header>

      <section className="rk-podio" aria-label={tr('Ranking')}>
        {top3[1] && <Podio e={top3[1]} pos={2} />}
        {top3[0] && <Podio e={top3[0]} pos={1} />}
        {top3[2] && <Podio e={top3[2]} pos={3} />}
      </section>

      <section className={`rk-miposicion${yo.jugadas > 0 ? '' : ' nuevo'}`}>
        {yo.jugadas > 0 ? (
          <>
            <div className="rk-mp-num"><small>{tr('Tu posición')}</small><b>#{posicion}</b></div>
            <div className="rk-mp-txt">
              <b>{yo.alias}</b>
              <span>{yo.puntos} pts · {yo.ganadas}/{yo.jugadas}</span>
              <p>{posicion === 1 ? tr('¡Eres el número 1! Defiende tu lugar.') : tr('Te faltan {n} puntos para pasar a {a}.', { n: faltan, a: (siguiente?.alias ?? '').replace(/\.$/, '') })}</p>
            </div>
          </>
        ) : (
          <div className="rk-mp-txt"><b>{tr('Juega tu primer duelo para aparecer en el ranking.')}</b></div>
        )}
        <a className="btn pri" href="#/duelo">{tr('Jugar duelo')} →</a>
      </section>

      <section className="rk-puntos">
        <h2>{tr('Cómo sumar puntos')}</h2>
        <div className="rk-chips">{NIVELES_PTS.map((x) => <span key={x.n} className={`rk-chip ${x.clase}`}><b>+{PUNTOS_VICTORIA[x.n]}</b><small>{tr(x.nombre)} · {tr('por victoria')}</small></span>)}</div>
      </section>

      {cargando && <p className="muted small rk-centro">{tr('Cargando ranking…')}</p>}
      {resto.length > 0 && <ol className="rk-lista rk-total">{resto.map((e, i) => <Fila key={e.id} e={e} pos={i + 4} />)}</ol>}
      {yo.jugadas > 0 && posicion > 50 && <ol className="rk-lista rk-mio"><Fila e={yo} pos={posicion} /></ol>}

      <section className="rk-nombre-sec">
        <button type="button" className="d-link" onClick={() => setAbierto((v) => !v)} aria-expanded={abierto}>✎ {tr('Cambiar mi nombre')}</button>
        {abierto && (
          <div className="rk-tu">
            <label htmlFor="rk-alias">{tr('Tu nombre público en el ranking')}</label>
            <div className="rk-alias"><input id="rk-alias" value={editando} maxLength={20} onChange={(e) => setEditando(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') setAlias(editando) }} /><button className="btn pri" disabled={aliasLimpio(editando) === alias} onClick={() => setAlias(editando)}>{tr('Guardar')}</button></div>
            <p className="small muted">{tr('Se muestra solo este nombre y tu país aproximado.')}</p>
          </div>
        )}
      </section>

      <p className="small muted rk-centro">{tr('Los jugadores marcados «Demo» son de demostración y sus resultados son ficticios. Los demás son resultados reales de personas que juegan.')}{!hayReales && NUBE_ACTIVA && !cargando ? ` ${tr('Aún no hay otras personas reales en el ranking: ¡puedes ser la primera!')}` : ''}</p>
    </div>
  )
}
