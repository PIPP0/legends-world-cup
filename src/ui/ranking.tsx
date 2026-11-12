import { useEffect, useMemo, useState } from 'react'
import { tr } from '../i18n'
import { Section } from './common'
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
      <span className={`rk-pos p${pos <= 3 ? pos : 0}`}>{pos <= 3 ? ['🥇', '🥈', '🥉'][pos - 1] : pos}</span>
      <Pais iso={e.pais} />
      <span className="rk-nombre"><b>{e.alias}</b>{e.yo && <em className="rk-tu">{tr('Tú')}</em>}{e.demo && <em className="rk-demo" title={tr('Jugador de demostración (ficticio)')}>{tr('Demo')}</em>}</span>
      <span className="rk-rec">{e.ganadas}/{e.jugadas}</span>
      <b className="rk-pts">{e.puntos}</b>
    </li>
  )
}

// Resumen para la pantalla «Tu equipo»: los 5 primeros y mi posición.
export function RankingResumen() {
  const { lista, yo, posicion } = useRanking()
  const top = lista.slice(0, 5)
  return (
    <div className="rk-card">
      <div className="rk-h"><b>🏆 {tr('Ranking')}</b><a href="#/ranking">{tr('Ver ranking completo')} →</a></div>
      <ol className="rk-lista">{top.map((e, i) => <Fila key={e.id} e={e} pos={i + 1} />)}</ol>
      {yo.jugadas > 0 && posicion > 5 && <ol className="rk-lista rk-mio"><Fila e={yo} pos={posicion} /></ol>}
      {yo.jugadas === 0 && <p className="small muted">{tr('Juega tu primer duelo para aparecer en el ranking.')}</p>}
    </div>
  )
}

// Página completa del ranking.
export function RankingPagina() {
  const { lista, yo, posicion, cargando, alias, setAlias, hayReales } = useRanking()
  const [editando, setEditando] = useState(alias)
  useEffect(() => { setEditando(alias) }, [alias])
  return (
    <Section title={tr('Ranking')} sub={tr('Los puntos dependen del rival: Bronce {a}, Plata {b}, Oro {c} y Leyenda {d} por victoria.', { a: PUNTOS_VICTORIA.bronce, b: PUNTOS_VICTORIA.plata, c: PUNTOS_VICTORIA.oro, d: PUNTOS_VICTORIA.leyenda })}>
      <div className="rk-wrap">
        <div className="rk-tu">
          <label htmlFor="rk-alias">{tr('Tu nombre público en el ranking')}</label>
          <div className="rk-alias"><input id="rk-alias" value={editando} maxLength={20} onChange={(e) => setEditando(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') setAlias(editando) }} /><button className="btn pri" disabled={aliasLimpio(editando) === alias} onClick={() => setAlias(editando)}>{tr('Guardar')}</button></div>
          <p className="small muted">{yo.jugadas > 0 ? tr('Vas en el puesto {p} con {n} puntos.', { p: posicion, n: yo.puntos }) : tr('Juega tu primer duelo para aparecer en el ranking.')} {tr('Se muestra solo este nombre y tu país aproximado.')}</p>
        </div>
        {cargando && <p className="muted small">{tr('Cargando ranking…')}</p>}
        <ol className="rk-lista rk-total">{lista.slice(0, 50).map((e, i) => <Fila key={e.id} e={e} pos={i + 1} />)}</ol>
        {yo.jugadas > 0 && posicion > 50 && <ol className="rk-lista rk-mio"><Fila e={yo} pos={posicion} /></ol>}
        <p className="small muted">{tr('Los jugadores marcados «Demo» son de demostración y sus resultados son ficticios. Los demás son resultados reales de personas que juegan.')}{!hayReales && NUBE_ACTIVA && !cargando ? ` ${tr('Aún no hay otras personas reales en el ranking: ¡puedes ser la primera!')}` : ''}</p>
      </div>
    </Section>
  )
}
