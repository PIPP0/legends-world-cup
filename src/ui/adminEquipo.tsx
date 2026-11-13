import { useEffect, useMemo, useState } from 'react'
import { PLAYERS } from '../data'
import { PLAYER_BY_ID, TEAM_BY_ID } from '../data/lookup'
import { editarEquipoDe, leerDueloDe } from '../cloud/duelo'
import type { Equipo } from '../engine/duelo'
import { Note } from './common'

const sinTildes = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
const fecha = (t: number) => new Date(t).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' })

// Administración → Personas: ver y ajustar el equipo del Duelo de una persona. Se guarda en su cuenta, cuenta para el ranking y a ella se le avisa al entrar.
export function EquipoDueloAdmin({ uid, por }: { uid: string; por: string }) {
  const [equipo, setEquipo] = useState<Equipo | null | undefined>(undefined) // undefined = cargando
  const [original, setOriginal] = useState<Equipo | null>(null)
  const [editado, setEditado] = useState<{ por: string; en: number } | null>(null)
  const [sel, setSel] = useState<number | null>(null) // 0..10 titulares, 11..13 suplentes
  const [q, setQ] = useState('')
  const [msg, setMsg] = useState('')
  const [guardando, setGuardando] = useState(false)
  useEffect(() => {
    let vivo = true; setEquipo(undefined); setSel(null); setMsg('')
    leerDueloDe(uid).then((r) => { if (!vivo) return; setEquipo(r.equipo); setOriginal(r.equipo); setEditado(r.editado) }).catch(() => { if (vivo) { setEquipo(null); setMsg('No se pudo leer el equipo. ¿Publicaste las reglas nuevas de Firestore?') } })
    return () => { vivo = false }
  }, [uid])
  const ids = useMemo(() => (equipo ? [...equipo.once, ...equipo.suplentes] : []), [equipo])
  const cambiado = !!equipo && !!original && (equipo.once.join() !== original.once.join() || equipo.suplentes.join() !== original.suplentes.join())
  const resultados = useMemo(() => {
    const t = sinTildes(q.trim()); if (t.length < 2 || sel === null) return []
    return PLAYERS.filter((p) => sinTildes(p.name).includes(t) && (!ids.includes(p.id) || ids[sel] === p.id)).sort((a, b) => b.ovr - a.ovr).slice(0, 8)
  }, [q, sel, ids])
  const poner = (slot: number, id: string) => { if (!equipo) return; const all = [...equipo.once, ...equipo.suplentes]; all[slot] = id; setEquipo({ ...equipo, once: all.slice(0, 11), suplentes: all.slice(11) }); setQ('') }
  const intercambiar = (a: number, b: number) => { if (!equipo) return; const all = [...equipo.once, ...equipo.suplentes]; [all[a], all[b]] = [all[b], all[a]]; setEquipo({ ...equipo, once: all.slice(0, 11), suplentes: all.slice(11) }); setSel(b) }
  const guardar = async () => {
    if (!equipo) return; setGuardando(true); setMsg('')
    try { await editarEquipoDe(uid, equipo, por); const r = await leerDueloDe(uid); setEquipo(r.equipo); setOriginal(r.equipo); setEditado(r.editado); setSel(null); setMsg('Guardado. La persona lo verá al abrir la web y se le avisará del ajuste.') }
    catch { setMsg('No se pudo guardar. ¿Publicaste las reglas nuevas de Firestore?') } finally { setGuardando(false) }
  }
  const fila = (slot: number) => {
    const p = PLAYER_BY_ID[ids[slot]]
    return (
      <li key={slot} className={`eq-fila${sel === slot ? ' on' : ''}`}>
        <button type="button" className="eq-sel" onClick={() => { setSel(sel === slot ? null : slot); setQ('') }} aria-pressed={sel === slot}>
          <span className="eq-pos">{slot < 11 ? `T${slot + 1}` : `S${slot - 10}`}</span>
          <b>{p ? p.name : ids[slot]}</b><span className="muted small">{p ? `${p.pos} · ${TEAM_BY_ID[p.teamId]?.name ?? ''} · ${p.ovr}` : ''}</span>
        </button>
        {sel !== null && sel !== slot && <button type="button" className="fav-edit" onClick={() => intercambiar(sel, slot)}>Intercambiar con #{sel < 11 ? `T${sel + 1}` : `S${sel - 10}`}</button>}
      </li>
    )
  }
  return (
    <div className="eq-admin">
      <h4 className="sub">Equipo del Duelo</h4>
      {equipo === undefined && <p className="muted small">Cargando…</p>}
      {equipo === null && <p className="muted small">Esta persona no tiene equipo guardado en la nube (o aún no se sincronizó desde su dispositivo).</p>}
      {equipo && (
        <>
          <p className="muted small">Formación {equipo.formacion}. Toca un jugador para cambiarlo por otro o intercambiarlo de lugar. El equipo sigue contando para el ranking.{editado ? ` Último ajuste de administración: ${fecha(editado.en)}.` : ''}</p>
          <p className="small"><b>Titulares</b></p>
          <ul className="eq-lista">{equipo.once.map((_, i) => fila(i))}</ul>
          <p className="small"><b>Suplentes</b></p>
          <ul className="eq-lista">{equipo.suplentes.map((_, i) => fila(11 + i))}</ul>
          {sel !== null && (
            <div className="eq-buscar">
              <label className="small">Cambiar a <b>{PLAYER_BY_ID[ids[sel]]?.name}</b> por: <input className="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Escribe un nombre, p. ej. Cristiano" autoFocus /></label>
              {resultados.length > 0 && <ul className="eq-res">{resultados.map((p) => <li key={p.id}><button type="button" onClick={() => poner(sel, p.id)}><b>{p.name}</b> <span className="muted small">{p.pos} · {TEAM_BY_ID[p.teamId]?.name ?? ''} · {p.ovr}</span></button></li>)}</ul>}
              {q.trim().length >= 2 && resultados.length === 0 && <p className="muted small">Sin resultados (o ya está en el equipo).</p>}
            </div>
          )}
          <div className="cta"><button className="btn pri" disabled={!cambiado || guardando} onClick={() => void guardar()}>{guardando ? 'Guardando…' : 'Guardar y avisar a la persona'}</button>{cambiado && <button className="btn ghost" onClick={() => { setEquipo(original); setSel(null) }}>Deshacer cambios</button>}</div>
        </>
      )}
      {msg && <Note>{msg}</Note>}
    </div>
  )
}
