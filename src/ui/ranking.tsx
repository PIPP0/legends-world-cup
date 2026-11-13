import { useEffect, useMemo, useState } from 'react'
import { tr } from '../i18n'
import { NUBE_ACTIVA } from '../cloud/firebase'
import { cambiarAliasNube, leerRankingNube, nombreAutomaticoNube, miIdRanking, publicarPartida } from '../cloud/ranking'
import { cuentaActual } from '../cloud/firebase'
import { paisAproximado } from '../lib/pais'
import { MI_RANKING0, aliasDeNombre, aliasLimpio, aliasPorDefecto, esAliasPorDefecto, armarRanking, demosActivos, sumarPartida, type EntradaRanking, type MiRanking } from '../engine/ranking'
import type { Nivel } from '../engine/duelo'

const CLAVE_RANK = 'lwc:duelo:ranking'
const CLAVE_ALIAS = 'lwc:duelo:alias'
const CLAVE_ALIAS_CAMBIADO = 'lwc:duelo:aliasCambiado'
const leerLocal = (): MiRanking => { try { const s = localStorage.getItem(CLAVE_RANK); return s ? { ...MI_RANKING0, ...(JSON.parse(s) as MiRanking) } : MI_RANKING0 } catch { return MI_RANKING0 } }
const guardarLocal = (r: MiRanking) => { try { localStorage.setItem(CLAVE_RANK, JSON.stringify(r)) } catch { /* sin almacenamiento */ } }
export function leerAlias(): string {
  try {
    const a = localStorage.getItem(CLAVE_ALIAS); if (a) return a
    const nuevo = aliasPorDefecto(Math.random().toString(36).slice(2, 8)); localStorage.setItem(CLAVE_ALIAS, nuevo); return nuevo
  } catch { return aliasPorDefecto('0000') }
}

// El nombre público solo se puede cambiar una vez (el automático «Jugador XXXX» no cuenta).
export const aliasYaCambiado = (): boolean => { try { return localStorage.getItem(CLAVE_ALIAS_CAMBIADO) === '1' } catch { return false } }
export function cambiarAliasUnaVez(nuevo: string): string | null {
  if (aliasYaCambiado()) return null
  const limpio = aliasLimpio(nuevo)
  if (limpio.length < 2) return null
  try { localStorage.setItem(CLAVE_ALIAS, limpio); localStorage.setItem(CLAVE_ALIAS_CAMBIADO, '1') } catch { return null }
  void cambiarAliasNube(limpio)
  window.dispatchEvent(new Event('lwc-alias'))
  return limpio
}

// Al entrar con Google, quien aún tiene el nombre automático «Jugador XXXX» pasa a llamarse como su cuenta (nombre + inicial del apellido). No gasta el único cambio manual.
export function aplicarNombreDeCuenta(nombreCompleto: string): void {
  if (aliasYaCambiado()) return
  const nuevo = aliasDeNombre(nombreCompleto)
  if (nuevo.length < 2) return
  const actual = leerAlias()
  if (!esAliasPorDefecto(actual)) { void nombreAutomaticoNube(nuevo); return } // ya tiene nombre propio en este dispositivo: solo se reintenta alinear la nube
  try { localStorage.setItem(CLAVE_ALIAS, nuevo) } catch { return }
  void nombreAutomaticoNube(nuevo)
  window.dispatchEvent(new Event('lwc-alias'))
}

// Se llama al terminar (o abandonar) un partido: suma el resultado a mi ranking y, si hay nube, lo publica.
export function anotarEnRanking(nivel: Nivel, gane: boolean): void {
  guardarLocal(sumarPartida(leerLocal(), nivel, gane))
  void publicarPartida(leerAlias(), paisAproximado(), nivel, gane, aliasYaCambiado())
}

// Ranking completo: reales (nube) + yo + demostración.
function useRanking() {
  const [reales, setReales] = useState<EntradaRanking[]>([])
  const [miId, setMiId] = useState<string>('yo')
  const [cargando, setCargando] = useState(NUBE_ACTIVA)
  const [alias, setAliasEstado] = useState(leerAlias)
  const [version, setVersion] = useState(0)
  useEffect(() => { const f = () => setAliasEstado(leerAlias()); window.addEventListener('lwc-alias', f); return () => window.removeEventListener('lwc-alias', f) }, [])
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
  const [ahora, setAhora] = useState(() => Date.now())
  useEffect(() => { const t = setInterval(() => setAhora(Date.now()), 25000); return () => clearInterval(t) }, [])
  // «activo» = punto verde: yo (estoy aquí) y los de demostración que van rotando
  const lista = useMemo(() => { const act = demosActivos(ahora, reales.filter((r) => r.id !== miId).length); return armarRanking(reales, yo).map((e) => (e.yo || (e.demo && act.has(e.id)) ? { ...e, activo: true } : e)) }, [reales, yo, ahora, miId])
  const posicion = lista.findIndex((e) => e.id === miId) + 1
  const setAlias = (a: string) => { if (cambiarAliasUnaVez(a)) setVersion((v) => v + 1) }
  return { lista, yo, posicion, cargando, alias, setAlias, hayReales: reales.some((r) => r.id !== miId) }
}

const Pais = ({ iso }: { iso: string }) => {
  const [mal, setMal] = useState(false)
  const c = iso.toLowerCase()
  // el servicio de banderas solo entiende códigos de 2 letras en minúscula; si no carga, se muestra el código en una pastilla
  return c.length === 2 && !mal ? <img className="rk-flag" src={`https://flagcdn.com/w40/${c}.png`} alt={c.toUpperCase()} loading="lazy" width={22} height={15} onError={() => setMal(true)} /> : <span className="rk-flag ph" aria-hidden>{c.length === 2 ? c.toUpperCase() : ''}</span>
}

function Fila({ e, pos }: { e: EntradaRanking; pos: number }) {
  return (
    <li className={`rk-fila${e.yo ? ' yo' : ''}`}>
      <span className={`rk-pos p${pos <= 3 ? pos : 0}`}>{pos}</span>
      <span className="rk-bandera"><Pais iso={e.pais} />{e.activo && <i className="rk-vivo" title={tr('Jugando ahora')} />}</span>
      <span className="rk-nombre"><b>{e.alias}</b>{e.yo && <em className="rk-tu">{tr('Tú')}</em>}</span>
      <span className="rk-rec">{e.ganadas}/{e.jugadas}</span>
      <b className="rk-pts">{e.puntos}</b>
    </li>
  )
}

// Botón de la pantalla «Tu equipo»: lleva al ranking y, si ya jugaste, muestra tu puesto.
export function BotonRanking({ compacto }: { compacto?: boolean }) {
  const { yo, posicion } = useRanking()
  const juega = yo.jugadas > 0
  return (
    <a className={`d-btn-rank${compacto ? ' mini' : ''}${juega ? ' con-puesto' : ''}`} href="#/ranking" title={tr('Ver ranking')}>
      <span className="rk-btn-ic" aria-hidden>🏆</span>
      <b>{tr('Ranking')}</b>
      {juega ? (
        <span className="rk-btn-yo"><em>#{posicion}</em><strong>{yo.alias}</strong><small>{yo.puntos} pts</small></span>
      ) : <small className="rk-btn-sub">{tr('Ver ranking')} →</small>}
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

// Una tarjeta del podio (puestos 1 a 3).
function Podio({ e, pos }: { e: EntradaRanking; pos: 1 | 2 | 3 }) {
  return (
    <div className={`rk-pod p${pos}${e.yo ? ' yo' : ''}`}>
      {pos === 1 && <span className="rk-corona" aria-hidden>👑</span>}
      <span className={`rk-medalla p${pos}`}>{pos}</span>
      <span className="rk-bandera"><Pais iso={e.pais} />{e.activo && <i className="rk-vivo" title={tr('Jugando ahora')} />}</span>
      <b className="rk-pod-n">{e.alias}</b>
      <span className="rk-pod-tags">{e.yo && <em className="rk-tu">{tr('Tú')}</em>}</span>
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
  const [sugerido, setSugerido] = useState('')
  const [cambiado, setCambiado] = useState(aliasYaCambiado)
  useEffect(() => { const f = () => setCambiado(aliasYaCambiado()); window.addEventListener('lwc-alias', f); return () => window.removeEventListener('lwc-alias', f) }, [])
  useEffect(() => { setEditando(alias) }, [alias])
  // si entró con Google y aún tiene el nombre por defecto, se le ofrece (sin imponerlo) usar su nombre e inicial
  useEffect(() => {
    if (cambiado || !/^Jugador [A-Z0-9]{4}$/.test(alias)) { setSugerido(''); return }
    void cuentaActual().then((c) => {
      if (!c || c.anonimo || !c.nombre) return
      const [nombre, ...resto] = c.nombre.trim().split(/\s+/)
      const inicial = resto.length ? ` ${resto[resto.length - 1][0].toUpperCase()}` : ''
      setSugerido(aliasLimpio(`${nombre}${inicial}`))
    })
  }, [alias, cambiado])
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

      {sugerido && (
        <section className="rk-sugerencia">
          <p>{tr('Tu nombre en el ranking es «{a}». ¿Quieres usar «{b}»?', { a: alias, b: sugerido })}</p>
          <div><button className="btn pri" onClick={() => setAlias(sugerido)}>{tr('Usar mi nombre')}</button><button className="btn ghost" onClick={() => setAbierto(true)}>{tr('Elegir otro')}</button></div>
          <small className="muted">{tr('Se mostrará públicamente solo ese nombre. Puedes cambiarlo cuando quieras.')}</small>
        </section>
      )}
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

      {cargando && <p className="muted small rk-centro">{tr('Cargando ranking…')}</p>}
      {resto.length > 0 && <ol className="rk-lista rk-total">{resto.map((e, i) => <Fila key={e.id} e={e} pos={i + 4} />)}</ol>}
      {yo.jugadas > 0 && posicion > 50 && <ol className="rk-lista rk-mio"><Fila e={yo} pos={posicion} /></ol>}

      <section className="rk-nombre-sec">
        {cambiado ? <p className="small muted">{tr('Ya usaste tu único cambio de nombre.')}</p> : (
          <>
            <button type="button" className="d-link" onClick={() => setAbierto((v) => !v)} aria-expanded={abierto}>✎ {tr('Cambiar mi nombre')}</button>
            {abierto && (
              <div className="rk-tu">
                <label htmlFor="rk-alias">{tr('Tu nombre público en el ranking')}</label>
                <div className="rk-alias"><input id="rk-alias" value={editando} maxLength={20} onChange={(e) => setEditando(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') setAlias(editando) }} /><button className="btn pri" disabled={aliasLimpio(editando) === alias || aliasLimpio(editando).length < 2} onClick={() => setAlias(editando)}>{tr('Guardar')}</button></div>
                <p className="small muted">{tr('Solo puedes cambiarlo una vez.')} {tr('Se muestra solo este nombre y tu país aproximado.')}</p>
              </div>
            )}
          </>
        )}
      </section>

      <p className="rk-nota">{tr('El ranking se va actualizando con el tiempo y algunos jugadores no son completamente veraces.')}</p>
    </div>
  )
}

// Bloque del menú «Mi cuenta»: muestra tu nombre del ranking y deja cambiarlo una sola vez.
export function NombreRanking() {
  const [alias, setAlias] = useState(leerAlias)
  const [cambiado, setCambiado] = useState(aliasYaCambiado)
  const [editando, setEditando] = useState(false)
  const [confirmando, setConfirmando] = useState(false)
  const [txt, setTxt] = useState(alias)
  useEffect(() => { const f = () => { setAlias(leerAlias()); setCambiado(aliasYaCambiado()) }; window.addEventListener('lwc-alias', f); return () => window.removeEventListener('lwc-alias', f) }, [])
  const limpio = aliasLimpio(txt)
  const guardar = () => { if (cambiarAliasUnaVez(txt)) { setEditando(false); setConfirmando(false) } }
  return (
    <div className="fav-row">
      <span className="fav-lbl">{tr('Tu nombre en el ranking')}</span>
      <div>
        <span className="fav-eq"><b>🏆 {alias}</b></span>
        {!cambiado && !editando && <button type="button" className="fav-edit" onClick={() => { setTxt(alias); setEditando(true) }}>{tr('Editar')}</button>}
      </div>
      {editando && (
        <div className="rk-menu-edit">
          <input value={txt} maxLength={20} onChange={(e) => { setTxt(e.target.value); setConfirmando(false) }} aria-label={tr('Tu nombre en el ranking')} />
          {confirmando ? <p className="small">{tr('¿Seguro? Después no podrás cambiarlo de nuevo.')}</p> : <p className="small muted">{tr('Solo puedes cambiarlo una vez.')}</p>}
          <div className="rk-menu-btns">
            {confirmando ? <button type="button" className="btn pri" onClick={guardar}>{tr('Confirmar cambio')}</button> : <button type="button" className="btn pri" disabled={limpio.length < 2 || limpio === alias} onClick={() => setConfirmando(true)}>{tr('Guardar')}</button>}
            <button type="button" className="btn ghost" onClick={() => { setEditando(false); setConfirmando(false) }}>{tr('Cancelar')}</button>
          </div>
        </div>
      )}
      {cambiado && <small className="muted">{tr('Ya usaste tu único cambio de nombre.')}</small>}
    </div>
  )
}
