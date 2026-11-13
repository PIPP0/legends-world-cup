import { useEffect, useState } from 'react'
import { corregirRankingAdmin, leerRankingAdmin, type RegistroRankingAdmin } from '../cloud/ranking'
import { Note } from './common'

// Administración → Ranking: ver los datos reales del ranking público y corregirlos (nombre, partidas, victorias, puntos). Los cambios se ven de inmediato.
export function RankingAdmin() {
  const [filas, setFilas] = useState<RegistroRankingAdmin[] | null>(null)
  const [edit, setEdit] = useState<RegistroRankingAdmin | null>(null)
  const [msg, setMsg] = useState('')
  const [guardando, setGuardando] = useState(false)
  const cargar = () => { setFilas(null); leerRankingAdmin().then(setFilas).catch(() => { setFilas([]); setMsg('No se pudo leer el ranking.') }) }
  useEffect(cargar, [])
  // Restauración puntual: el registro de Cristian en la nube se creó de cero y perdió su nombre («Cris A») y su historial (2 victorias en 8 partidas, 4 puntos).
  const aRestaurar = filas?.find((f) => f.alias === 'Cristian A' && f.jugadas <= 1 && f.puntos === 0)
  const restaurar = async () => {
    if (!aRestaurar || !confirm('Restaurar el registro de «Cristian A» como «Cris A»: 8 partidas, 2 victorias, 4 puntos, nombre ya cambiado. ¿Continuar?')) return
    setMsg('')
    try { await corregirRankingAdmin({ ...aRestaurar, alias: 'Cris A', jugadas: 8, ganadas: 2, puntos: 4, racha: 0, mejorRacha: 1, aliasCambiado: true }); setMsg('Listo: tu registro quedó como «Cris A», 2/8, 4 puntos. Recarga el ranking del sitio para verlo.'); cargar() }
    catch { setMsg('No se pudo restaurar. ¿Publicaste las reglas nuevas de Firestore?') }
  }
  const num = (v: string) => (v.trim() === '' ? 0 : Math.round(Number(v)))
  const guardar = async () => {
    if (!edit) return; setGuardando(true); setMsg('')
    try { await corregirRankingAdmin(edit); setMsg('Guardado. Ya se ve en el ranking.'); setEdit(null); cargar() }
    catch { setMsg('No se pudo guardar. Revisa que las victorias no superen las partidas, que la mejor racha no sea menor que la racha, y que hayas publicado las reglas nuevas.') }
    finally { setGuardando(false) }
  }
  const campo = (k: keyof RegistroRankingAdmin, etiqueta: string, ancho = 80) => edit && (
    <label className="small" style={{ display: 'grid', gap: 2 }}>{etiqueta}
      <input className="search" style={{ width: ancho }} type={k === 'alias' || k === 'pais' ? 'text' : 'number'} min={0} value={String(edit[k])} maxLength={k === 'alias' ? 20 : k === 'pais' ? 2 : undefined}
        onChange={(e) => setEdit({ ...edit, [k]: k === 'alias' || k === 'pais' ? e.target.value : num(e.target.value) } as RegistroRankingAdmin)} />
    </label>
  )
  return (
    <>
      <p className="muted small">Estos son los datos reales del ranking público. Toca «Corregir» para cambiar el nombre, las partidas, las victorias o los puntos de una persona (por ejemplo, para restaurar un historial que se perdió).</p>
      {aRestaurar && <div className="note"><span>Tu registro en la nube perdió su historial. </span><button className="btn pri" onClick={() => void restaurar()}>Restaurar mi historial (Cris A · 2/8 · 4 pts)</button></div>}
      {filas === null ? <p className="muted">Cargando…</p> : (
        <div className="tscroll"><table className="gt"><thead><tr><th className="l">Nombre</th><th>País</th><th>Partidas</th><th>Victorias</th><th>Puntos</th><th>Racha</th><th>Mejor racha</th><th>Nombre ya cambiado</th><th /></tr></thead>
          <tbody>{filas.map((f) => <tr key={f.id}><td className="l">{f.alias}</td><td>{f.pais.toUpperCase() || '—'}</td><td>{f.jugadas}</td><td>{f.ganadas}</td><td><b>{f.puntos}</b></td><td>{f.racha}</td><td>{f.mejorRacha}</td><td>{f.aliasCambiado ? 'Sí' : 'No'}</td><td><button className="btn ghost" onClick={() => { setEdit(f); setMsg('') }}>Corregir</button></td></tr>)}
            {filas.length === 0 && <tr><td className="l muted" colSpan={9}>Todavía no hay registros reales en la nube.</td></tr>}</tbody></table></div>
      )}
      {edit && (
        <div className="detalle-stat">
          <h4 className="sub">Corregir: {edit.alias}</h4>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'end' }}>
            {campo('alias', 'Nombre', 150)}{campo('pais', 'País (2 letras)', 70)}{campo('jugadas', 'Partidas')}{campo('ganadas', 'Victorias')}{campo('puntos', 'Puntos')}{campo('racha', 'Racha')}{campo('mejorRacha', 'Mejor racha', 100)}
            <label className="small" style={{ display: 'flex', gap: 6, alignItems: 'center' }}><input type="checkbox" checked={edit.aliasCambiado} onChange={(e) => setEdit({ ...edit, aliasCambiado: e.target.checked })} /> Ya usó su único cambio de nombre</label>
          </div>
          <div className="cta"><button className="btn pri" disabled={guardando} onClick={() => void guardar()}>{guardando ? 'Guardando…' : 'Guardar corrección'}</button><button className="btn ghost" onClick={() => setEdit(null)}>Cancelar</button></div>
        </div>
      )}
      {msg && <Note>{msg}</Note>}
    </>
  )
}
