import { useCallback, useEffect, useMemo, useState } from 'react'
import { NUBE_ACTIVA, asegurarContadorCupo, asegurarVisitante, cuentaActual, entrarConClave, entrarConGoogle, esperarCambiosDeSesion, salir, type Cuenta } from '../cloud/firebase'
import { FUNCIONES_BASE, FUNCIONES_INFO, guardarFunciones, useFunciones, type Funciones } from '../cloud/funciones'
import { borrarEncuesta, escucharTodoAdmin, importarCuentasGoogle, leerEncuestas, type CuentaAuthExport, leerMundiales, leerProgresos, leerUsuarios, type EncuestaReg, type MundialReg, type ProgresoReg, type UsuarioReg } from '../cloud/datos'
import { HOST_BY_ID, MONTHS } from '../data/world'
import { TEAM_BY_ID } from '../data/lookup'
import { Bar, Note, Section, Tabs } from './common'
import { nombrePais } from '../lib/pais'
import { EquipoDueloAdmin } from './adminEquipo'
import { RankingAdmin } from './adminRanking'
// País de un registro: el guardado (zona horaria) o, en registros viejos, la región del idioma del navegador (es-CL → CL).
const paisDe = (u: UsuarioReg) => { const c = u.pais || (u.idioma?.split('-')[1] ?? '').toUpperCase(); return c.length === 2 ? { cod: c, aprox: !u.pais } : null }
const paisTxt = (u: UsuarioReg) => { const p = paisDe(u); return p ? `${nombrePais(p.cod)} (${p.cod})${p.aprox ? ' · por idioma' : ''}` : '—' }

type Seccion = 'resumen' | 'personas' | 'funciones' | 'ranking' | 'encuestas' | 'mundiales' | 'historia'
const NIVELES = ['Ninguna fase (solo se ven los cruces de octavos)', 'Hasta octavos jugados', 'Hasta cuartos jugados', 'Hasta semifinales jugadas', 'Todo, hasta el campeón']
const fecha = (n: number) => (n ? new Date(n).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' }) : '—')
const avg = (xs: number[]) => (xs.length ? (xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(2) : '—')
const top = <T,>(xs: T[], key: (x: T) => string, n = 6) => { const m = new Map<string, number>(); xs.forEach((x) => m.set(key(x), (m.get(key(x)) ?? 0) + 1)); return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n) }

interface Datos { usuarios: UsuarioReg[]; encuestas: EncuestaReg[]; mundiales: MundialReg[]; progresos: ProgresoReg[] }

// Administración (como la de Forma): solo entra la cuenta de Google listada en config/admin; las reglas de Firestore lo hacen cumplir.
export function Admin() {
  const [cuenta, setCuenta] = useState<Cuenta | null | undefined>(undefined)
  const [datos, setDatos] = useState<Datos | null>(null)
  const [error, setError] = useState('')
  const [correo, setCorreo] = useState('')
  const [clave, setClave] = useState('')
  const [cargando, setCargando] = useState(false)
  const [sec, setSec] = useState<Seccion>('resumen')

  const cargar = useCallback(async () => {
    setCargando(true); setError('')
    try {
      const [usuarios, encuestas, mundiales, progresos] = await Promise.all([leerUsuarios(), leerEncuestas(), leerMundiales(), leerProgresos()])
      setDatos({ usuarios, encuestas, mundiales, progresos })
    } catch (e) {
      const code = (e as { code?: string }).code
      setDatos(null)
      setError(code === 'permission-denied' ? 'Esta cuenta no tiene permiso de administración.' : 'No se pudieron leer los datos. Revisa tu conexión.')
    } finally { setCargando(false) }
  }, [])
  useEffect(() => { if (!NUBE_ACTIVA) return; void cuentaActual().then(async (c) => { setCuenta(c ?? (await asegurarVisitante())) }) }, [])
  // Si la persona entra (o sale) desde el botón del encabezado, esta pantalla se entera sin recargar.
  useEffect(() => {
    if (!NUBE_ACTIVA) return
    let baja: (() => void) | undefined; let activo = true
    void esperarCambiosDeSesion((c) => { if (c) setCuenta(c) }).then((f) => { if (activo) baja = f; else f() })
    return () => { activo = false; baja?.() }
  }, [])
  // Datos EN VIVO: mientras el panel está abierto, todo lo que cambia (una persona nueva, una encuesta…) aparece solo.
  const [enVivo, setEnVivo] = useState(false)
  useEffect(() => {
    if (!cuenta || cuenta.anonimo) return
    let vivo = true; let baja: (() => void) | undefined
    setCargando(true); setError('')
    void escucharTodoAdmin(
      (d) => { if (vivo) { setDatos(d); setCargando(false); setEnVivo(true); setError('') } },
      (e) => { if (!vivo) return; setEnVivo(false); setCargando(false); setDatos(null); setError((e as { code?: string }).code === 'permission-denied' ? 'Esta cuenta no tiene permiso de administración.' : 'No se pudieron leer los datos. Revisa tu conexión.') },
    ).then((f) => { if (vivo) baja = f; else f() })
    return () => { vivo = false; baja?.(); setEnVivo(false) }
  }, [cuenta])

  if (!NUBE_ACTIVA) return (
    <Section title="Administración">
      <Note tone="warn">La nube no está conectada. Sigue la guía <code>docs/admin-nube.md</code> para crear el proyecto de Firebase y cargar <code>FIREBASE_CONFIG</code>.</Note>
    </Section>
  )
  const entrar = async () => { setError(''); try { setCuenta(await entrarConGoogle({ vincular: false })) } catch { setError('No se pudo entrar con Google.') } }
  if (cuenta === undefined) return <Section title="Administración"><p className="muted">Cargando…</p></Section>
  if (!cuenta || cuenta.anonimo) return (
    <Section title="Administración" sub="Solo para la cuenta de administrador.">
      <form className="admin-login" onSubmit={(e) => { e.preventDefault(); setError(''); void entrarConClave(correo, clave).then(setCuenta).catch(() => setError('Usuario o contraseña incorrectos.')) }}>
        <label>Usuario (correo)<input type="email" autoComplete="username" value={correo} onChange={(e) => setCorreo(e.target.value)} required /></label>
        <label>Contraseña<input type="password" autoComplete="current-password" value={clave} onChange={(e) => setClave(e.target.value)} required /></label>
        <div className="cta"><button className="btn pri" type="submit">Entrar</button><button className="btn ghost" type="button" onClick={() => void entrar()}>Entrar con Google</button></div>
      </form>
      {error && <Note tone="warn">{error}</Note>}
    </Section>
  )
  return (
    <Section title="Administración" sub={`Sesión: ${cuenta.email}`} action={<button className="btn ghost" onClick={() => void salir().then(() => { setCuenta(null); setDatos(null) })}>Salir</button>}>
      {error && <Note tone="warn">{error}</Note>}
      {!datos && !error && <p className="muted">{cargando ? 'Leyendo datos…' : ''}</p>}
      {datos && (
        <>
          <Tabs value={sec} onChange={setSec} items={[['resumen', 'Resumen'], ['personas', `Personas (${datos.usuarios.filter((u) => !u.anonimo).length})`], ['funciones', 'Funciones'], ['ranking', 'Ranking'], ['encuestas', `Encuestas (${datos.encuestas.length})`], ['mundiales', `Mundiales (${datos.mundiales.length})`], ['historia', 'Historia']]} />
          <div className="cta"><button className="btn ghost" onClick={() => void cargar()} disabled={cargando}>{cargando ? 'Actualizando…' : '↻ Actualizar datos'}</button>{enVivo && <span className="en-vivo" role="status"><i className="rk-vivo" aria-hidden /> En vivo: se actualiza solo</span>}</div>
          {sec === 'resumen' && <Resumen d={datos} />}
          {sec === 'personas' && <Personas us={datos.usuarios} recargar={() => void cargar()} />}
          {sec === 'funciones' && <FuncionesAdmin email={cuenta.email} />}
          {sec === 'encuestas' && <Encuestas es={datos.encuestas} alBorrar={(id) => setDatos({ ...datos, encuestas: datos.encuestas.filter((e) => e.id !== id) })} />}
          {sec === 'mundiales' && <Mundiales ms={datos.mundiales} />}
          {sec === 'ranking' && <RankingAdmin />}
          {sec === 'historia' && <HistoriaAdmin ps={datos.progresos} email={cuenta.email} />}
        </>
      )}
    </Section>
  )
}

// Paginación de las listas del admin: así no crecen sin límite. 10 por página (también 25 o 50) y vuelve a la primera si cambia la lista.
function usePaginado<T>(items: T[], inicial = 10) {
  const [pagina, setPagina] = useState(0)
  const [por, setPor] = useState(inicial)
  useEffect(() => setPagina(0), [items.length, por])
  const paginas = Math.max(1, Math.ceil(items.length / por))
  const p = Math.min(pagina, paginas - 1)
  const visibles = useMemo(() => items.slice(p * por, p * por + por), [items, p, por])
  const barra = items.length <= 10 ? null : (
    <nav className="pager" aria-label="Paginación">
      <button type="button" className="btn ghost" disabled={p === 0} onClick={() => setPagina(p - 1)}>← Anterior</button>
      <span>Página {p + 1} de {paginas} · {items.length} en total</span>
      <button type="button" className="btn ghost" disabled={p >= paginas - 1} onClick={() => setPagina(p + 1)}>Siguiente →</button>
      <label className="small muted">Mostrar <select value={por} onChange={(e) => setPor(Number(e.target.value))}>{[10, 25, 50].map((n) => <option key={n} value={n}>{n}</option>)}</select></label>
    </nav>
  )
  return { visibles, barra }
}

function Stat({ n, l, activo, onClick }: { n: string | number; l: string; activo?: boolean; onClick?: () => void }) {
  return <button type="button" className={`mcard stat-btn${activo ? ' sel' : ''}`} aria-pressed={activo} onClick={onClick}><b style={{ fontSize: 26 }}>{n}</b><p className="muted small">{l}</p><span className="stat-more">{activo ? 'Ocultar detalle ▲' : 'Ver detalle ▼'}</span></button>
}

type Clave = 'visitantes' | 'cuentas' | 'nuevos' | 'activos' | 'mundiales' | 'mundiales7' | 'satisfaccion' | 'entretenido' | 'realismo'
const estrellasTxt = (n: number) => '★'.repeat(n) + '☆'.repeat(Math.max(0, 5 - n))
const corto = (uid: string) => '…' + uid.slice(-6)
// ¿Persona o robot? Solo señales del navegador: automatizado declarado, interacción real y tiempo en pantalla.
const senal = (x: UsuarioReg) => x.auto ? '🤖 Posible bot' : x.inter ? '✅ Humano probable' : x.seg !== undefined ? '⚪ Sin actividad' : '— Sin datos'

function TablaUsuarios({ xs, progresos }: { xs: UsuarioReg[]; progresos?: ProgresoReg[] }) {
  const [sel, setSel] = useState<string | null>(null)
  const orden = useMemo(() => [...xs].sort((a, b) => b.creado - a.creado || b.ultimo - a.ultimo), [xs]) // la última registrada, primero
  const { visibles: l, barra } = usePaginado(orden)
  if (!orden.length) return <p className="muted">Nadie en este grupo todavía.</p>
  const u = sel ? l.find((x) => x.uid === sel) : undefined
  const prog = u ? progresos?.find((p) => p.uid === u.uid) : undefined
  const fila = (k: string, v: string | number | undefined) => <tr key={k}><th className="l">{k}</th><td className="l" style={{ wordBreak: 'break-all' }}>{v === undefined || v === '' ? '—' : v}</td></tr>
  return (
    <>
      <p className="muted small">Toca una fila para ver todo lo que se sabe de esa persona. El país es aproximado (por zona horaria del navegador, no por IP).</p>
      <div className="tscroll"><table className="gt"><thead><tr><th className="l">ID</th><th className="l">Persona</th><th className="l">País</th><th>Registrado</th><th>Último</th><th>Visitas</th><th className="l">Dispositivo</th><th className="l">Sistema · navegador</th><th className="l">Idioma</th><th className="l">Señal</th></tr></thead>
        <tbody>{l.map((x) => <tr key={x.uid} className={`fila-sel${sel === x.uid ? ' on' : ''}`} onClick={() => setSel(sel === x.uid ? null : x.uid)} style={{ cursor: 'pointer' }}><td className="l" title={x.uid}>{corto(x.uid)}</td><td className="l">{x.nombre || x.email || (x.anonimo ? 'Anónimo' : '—')}</td><td className="l">{paisTxt(x)}</td><td>{fecha(x.creado)}</td><td>{fecha(x.ultimo)}</td><td>{x.visitas}</td><td className="l">{x.dispositivo || '—'}</td><td className="l">{x.sistema ? `${x.sistema} · ${x.navegador ?? ''}` : '—'}</td><td className="l">{x.idiomaWeb || x.idioma || '—'}</td><td className="l">{senal(x)}</td></tr>)}</tbody></table></div>
      {barra}
      {u && (
        <div className="detalle-stat"><h4 className="sub">{u.nombre || u.email || `Visitante ${corto(u.uid)}`}</h4>
          <table className="gt"><tbody>
            {fila('ID de usuario', u.uid)}{fila('Tipo', u.anonimo ? 'Anónimo (sin datos personales)' : 'Cuenta de Google')}{fila('Correo', u.email)}
            {fila('País (aproximado)', paisTxt(u))}{fila('Zona horaria', u.zona)}
            {fila('Idioma del navegador', u.idioma)}{fila('Idioma en que se abrió la web', u.idiomaWeb)}
            {fila('Dispositivo', u.dispositivo)}{fila('Sistema', u.sistema)}{fila('Navegador', u.navegador)}{fila('Pantalla', u.pantalla)}
            {fila('Señal', senal(u))}{fila('Tiempo con la pestaña visible', u.seg === undefined ? undefined : `${u.seg} s`)}{fila('Pantallas vistas (última visita)', u.pags)}{fila('Llegó desde', u.origen)}{fila('Primera visita', fecha(u.creado))}{fila('Última visita', fecha(u.ultimo))}{fila('Visitas', u.visitas)}
            {fila('Avance en la historia', prog ? `${NIVELES[prog.nivel] ?? prog.nivel} (actualizado ${fecha(prog.actualizado)})` : 'Sin avance guardado')}
          </tbody></table>
          {!u.anonimo && <EquipoDueloAdmin uid={u.uid} por="administración" />}
        </div>
      )}
    </>
  )
}

function TablaMundiales({ xs }: { xs: MundialReg[] }) {
  const { visibles, barra } = usePaginado(useMemo(() => [...xs].sort((a, b) => b.creada - a.creada), [xs]))
  if (!xs.length) return <p className="muted">Todavía no hay mundiales simulados.</p>
  return (
    <>
    <div className="tscroll"><table className="gt"><thead><tr><th>Fecha</th><th className="l">Sede</th><th>Mes</th><th className="l">Clima</th><th>Leyendas en su prime</th><th className="l">Formato</th><th className="l">Campeón</th><th>Semilla</th></tr></thead>
      <tbody>{visibles.map((m) => <tr key={m.id}><td>{fecha(m.creada)}</td><td className="l">{HOST_BY_ID[m.sede]?.name ?? 'Neutral'}</td><td>{m.mes > 0 ? MONTHS[m.mes - 1] : '—'}</td><td className="l">{m.clima}</td><td>{m.primes}</td><td className="l">{m.formato}</td><td className="l">{TEAM_BY_ID[m.campeon]?.name ?? m.campeon}</td><td>{m.semilla}</td></tr>)}</tbody></table></div>
    {barra}
    </>
  )
}

function ListaEncuestas({ xs, campo }: { xs: EncuestaReg[]; campo: 'estrellas' | 'estrellas2' }) {
  const con = useMemo(() => xs.filter((e) => (e[campo] ?? 0) > 0).sort((a, b) => b.creada - a.creada), [xs, campo])
  const { visibles, barra } = usePaginado(con)
  if (!con.length) return <p className="muted">Todavía no hay respuestas.</p>
  const dist = [5, 4, 3, 2, 1].map((n) => [`${n} ★`, con.filter((e) => e[campo] === n).length] as [string, number])
  const max = Math.max(...dist.map((x) => x[1]), 1)
  return (
    <>
      <h4 className="sub">Cuántas personas dieron cada nota</h4>
      {dist.map(([k, v]) => <Bar key={k} label={k} v={v} min={0} max={max} right={String(v)} />)}
      <h4 className="sub">Respuestas (más recientes primero)</h4>
      <div className="tscroll"><table className="gt"><thead><tr><th>Fecha</th><th className="l">Nota</th><th className="l">Pantalla</th><th className="l">Comentario</th></tr></thead>
        <tbody>{visibles.map((e) => <tr key={e.id}><td>{fecha(e.creada)}</td><td className="l">{estrellasTxt(e[campo] ?? 0)}</td><td className="l">{e.pantalla || '—'}</td><td className="l">{e.comentario || '—'}</td></tr>)}</tbody></table></div>
      {barra}
    </>
  )
}

function Resumen({ d }: { d: Datos }) {
  const [abierto, setAbierto] = useState<Clave | null>(null)
  const ahora = Date.now(), dia = 86_400_000
  const conCuenta = d.usuarios.filter((u) => !u.anonimo)
  const nuevos = d.usuarios.filter((u) => u.creado > ahora - 7 * dia)
  const activos = d.usuarios.filter((u) => u.ultimo > ahora - dia)
  const mund7 = d.mundiales.filter((m) => m.creada > ahora - 7 * dia)
  const sedes = top(d.mundiales, (m) => (HOST_BY_ID[m.sede]?.name ?? 'Neutral'))
  const meses = top(d.mundiales.filter((m) => m.mes > 0), (m) => MONTHS[m.mes - 1])
  const campeones = top(d.mundiales, (m) => TEAM_BY_ID[m.campeon]?.name ?? m.campeon)
  const g = d.encuestas.filter((e) => e.tipo === 'general'), mu = d.encuestas.filter((e) => e.tipo === 'mundial')
  const barras = (xs: [string, number][]) => xs.map(([k, v]) => <Bar key={k} label={k} v={v} min={0} max={Math.max(...xs.map((x) => x[1]))} right={String(v)} />)
  const alt = (c: Clave) => () => setAbierto(abierto === c ? null : c)
  const DETALLES: Record<Clave, { titulo: string; como: string; cuerpo: JSX.Element }> = {
    visitantes: { titulo: 'Visitantes registrados', como: 'Cada navegador que abre el sitio recibe una cuenta anónima (sin datos personales). Aquí están todas, anónimas y con cuenta de Google.', cuerpo: <TablaUsuarios xs={d.usuarios} progresos={d.progresos} /> },
    cuentas: { titulo: 'Personas con cuenta de Google', como: 'Visitantes que entraron con Google (guardan su avance en la nube). Se ven su nombre y correo.', cuerpo: <TablaUsuarios xs={conCuenta} progresos={d.progresos} /> },
    nuevos: { titulo: 'Nuevos en 7 días', como: 'Visitantes cuya primera visita fue en los últimos 7 días.', cuerpo: <TablaUsuarios xs={nuevos} progresos={d.progresos} /> },
    activos: { titulo: 'Activos en 24 h', como: 'Visitantes cuya última visita fue en las últimas 24 horas.', cuerpo: <TablaUsuarios xs={activos} progresos={d.progresos} /> },
    mundiales: { titulo: 'Mundiales simulados', como: 'Cada vez que alguien juega «Simula tu mundial» hasta el final queda registrado con sus condiciones y el campeón.', cuerpo: <TablaMundiales xs={d.mundiales} /> },
    mundiales7: { titulo: 'Mundiales en 7 días', como: 'Los mundiales simulados en los últimos 7 días.', cuerpo: <TablaMundiales xs={mund7} /> },
    satisfaccion: { titulo: 'Satisfacción general', como: 'Promedio de estrellas (1 a 5) de la encuesta general, la del ícono del encabezado.', cuerpo: <ListaEncuestas xs={g} campo="estrellas" /> },
    entretenido: { titulo: 'Mundial entretenido', como: 'Promedio de estrellas (1 a 5) a «¿Qué tan entretenida fue la experiencia?», al terminar un mundial.', cuerpo: <ListaEncuestas xs={mu} campo="estrellas" /> },
    realismo: { titulo: 'Realismo de los resultados', como: 'Promedio de estrellas (1 a 5) a «¿Qué tan realistas te parecieron los resultados?», al terminar un mundial.', cuerpo: <ListaEncuestas xs={mu} campo="estrellas2" /> },
  }
  const det = abierto ? DETALLES[abierto] : null
  return (
    <>
      <p className="muted small">Toca cualquier tarjeta para ver su detalle.</p>
      <div className="board">
        <Stat n={d.usuarios.length} l="Visitantes registrados (anónimos + cuentas)" activo={abierto === 'visitantes'} onClick={alt('visitantes')} />
        <Stat n={conCuenta.length} l="Personas con cuenta de Google" activo={abierto === 'cuentas'} onClick={alt('cuentas')} />
        <Stat n={nuevos.length} l="Nuevos en 7 días" activo={abierto === 'nuevos'} onClick={alt('nuevos')} />
        <Stat n={activos.length} l="Activos en 24 h" activo={abierto === 'activos'} onClick={alt('activos')} />
        <Stat n={d.mundiales.length} l="Mundiales simulados" activo={abierto === 'mundiales'} onClick={alt('mundiales')} />
        <Stat n={mund7.length} l="Mundiales en 7 días" activo={abierto === 'mundiales7'} onClick={alt('mundiales7')} />
        <Stat n={avg(g.map((e) => e.estrellas))} l={`Satisfacción general (${g.length})`} activo={abierto === 'satisfaccion'} onClick={alt('satisfaccion')} />
        <Stat n={avg(mu.map((e) => e.estrellas))} l={`Mundial entretenido (${mu.length})`} activo={abierto === 'entretenido'} onClick={alt('entretenido')} />
        <Stat n={avg(mu.filter((e) => e.estrellas2).map((e) => e.estrellas2!))} l="Realismo de los resultados" activo={abierto === 'realismo'} onClick={alt('realismo')} />
      </div>
      {det && <div className="detalle-stat"><h3 className="sub">{det.titulo}</h3><p className="muted small">{det.como}</p>{det.cuerpo}</div>}
      {d.mundiales.length > 0 && <><h3 className="sub">Sedes más elegidas</h3>{barras(sedes)}<h3 className="sub">Meses más elegidos</h3>{barras(meses)}<h3 className="sub">Campeones más frecuentes</h3>{barras(campeones)}</>}
      {d.usuarios.length > 0 && <><h3 className="sub">Países (aproximado, por zona horaria)</h3>{barras(top(d.usuarios, (u) => { const p = paisDe(u); return p ? nombrePais(p.cod) : 'Desconocido' }, 12))}</>}
      <h3 className="sub">Sistemas, navegadores y orígenes</h3>
      <p className="small muted">Sistemas: {top(d.usuarios, (u) => u.sistema || 'desconocido').map(([k, v]) => `${k} ${v}`).join(' · ') || '—'}</p>
      <p className="small muted">Navegadores: {top(d.usuarios, (u) => u.navegador || 'desconocido').map(([k, v]) => `${k} ${v}`).join(' · ') || '—'}</p>
      <p className="small muted">Llegaron desde: {top(d.usuarios, (u) => u.origen || 'desconocido').map(([k, v]) => `${k} ${v}`).join(' · ') || '—'}</p>
      <h3 className="sub">Dispositivos e idiomas</h3>
      <p className="small muted">Dispositivos: {top(d.usuarios, (u) => u.dispositivo || 'desconocido').map(([k, v]) => `${k} ${v}`).join(' · ') || '—'}</p>
      <p className="small muted">Idiomas: {top(d.usuarios, (u) => u.idioma || 'desconocido').map(([k, v]) => `${k} ${v}`).join(' · ') || '—'}</p>
    </>
  )
}

// Trae las cuentas de Google que están en Firebase pero no en esta lista (con el archivo de `firebase auth:export`).
function ImportarCuentas({ us, alTerminar }: { us: UsuarioReg[]; alTerminar: () => void }) {
  const [msg, setMsg] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const elegir = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; e.target.value = ''; if (!f) return
    setOcupado(true); setMsg('')
    try {
      const json = JSON.parse(await f.text()) as { users?: CuentaAuthExport[] }
      if (!Array.isArray(json.users)) throw new Error('formato')
      const ya = new Set(us.filter((u) => !u.anonimo && u.email).map((u) => u.uid))
      const r = await importarCuentasGoogle(json.users, ya)
      setMsg(r.nuevas + r.completadas === 0 ? 'No faltaba ninguna: todas las cuentas de Google ya están en la lista.' : `Listo: ${r.nuevas} cuenta(s) nueva(s) y ${r.completadas} completada(s). Toca «Actualizar datos» para verlas.`)
      alTerminar()
    } catch { setMsg('No se pudo importar. Revisa que sea el archivo generado con «firebase auth:export» y que hayas publicado las reglas nuevas.') } finally { setOcupado(false) }
  }
  return (
    <details className="eq-admin">
      <summary className="muted small" style={{ cursor: 'pointer' }}>¿Falta alguien? Traer cuentas de Google desde Firebase</summary>
      <p className="muted small">Genera el archivo con este comando en la terminal y elígelo aquí. Solo agrega o completa cuentas de Google; no borra nada.</p>
      <code className="small" style={{ display: 'block', wordBreak: 'break-all', margin: '6px 0' }}>npx firebase-tools auth:export ~/Desktop/auth-users.json --format=json --project legends-world-cup</code>
      <input type="file" accept=".json,application/json" disabled={ocupado} onChange={(e) => void elegir(e)} aria-label="Archivo auth-users.json" />
      {msg && <Note>{msg}</Note>}
    </details>
  )
}

function Personas({ us, recargar }: { us: UsuarioReg[]; recargar: () => void }) {
  const [q, setQ] = useState('')
  const [todos, setTodos] = useState(false)
  const lista = useMemo(() => us.filter((u) => (todos || !u.anonimo) && `${u.nombre} ${u.email}`.toLowerCase().includes(q.toLowerCase())).sort((a, b) => b.creado - a.creado || b.ultimo - a.ultimo), [us, q, todos]) // la última registrada, primero
  const { visibles, barra } = usePaginado(lista)
  return (
    <>
      <ImportarCuentas us={us} alTerminar={recargar} />
      <div className="filters"><input className="search" placeholder="Buscar por nombre o correo…" value={q} onChange={(e) => setQ(e.target.value)} /><label className="chk"><input type="checkbox" checked={todos} onChange={(e) => setTodos(e.target.checked)} /> Incluir visitantes anónimos ({us.filter((u) => u.anonimo).length})</label></div>
      <table className="gt"><thead><tr><th className="l">Persona</th><th className="l">Correo</th><th>Entró</th><th>Último</th><th>Visitas</th><th>Equipo</th></tr></thead>
        <tbody>{visibles.map((u) => <tr key={u.uid}><td className="l">{u.nombre || (u.anonimo ? 'Visitante anónimo' : '—')}</td><td className="l">{u.email || '—'}</td><td>{fecha(u.creado)}</td><td>{fecha(u.ultimo)}</td><td>{u.visitas}</td><td>{u.dispositivo || '—'}</td></tr>)}</tbody></table>
      {barra}
      {lista.length === 0 && <p className="muted">Nadie coincide.</p>}
    </>
  )
}

function FuncionesAdmin({ email }: { email: string }) {
  const actual = useFunciones()
  const [v, setV] = useState<Funciones>(actual)
  const [msg, setMsg] = useState('')
  const [guardando, setGuardando] = useState(false)
  const guardar = async () => { setGuardando(true); setMsg(''); try { await guardarFunciones({ ...v, mantenimiento: v.mantenimiento.slice(0, 160) }, email); setMsg('Guardado. La web lo aplica a todas las personas (en minutos).') } catch { setMsg('No se pudo guardar.') } finally { setGuardando(false) } }
  // cupo de cuentas con Google: el contador se crea si no existe y se muestra cuántas lleva
  const [usadas, setUsadas] = useState<number | null>(null)
  const [cupoTxt, setCupoTxt] = useState(String(actual.cupoCuentas))
  useEffect(() => { void asegurarContadorCupo().then(setUsadas) }, [])
  useEffect(() => { setCupoTxt(String(actual.cupoCuentas)) }, [actual.cupoCuentas])
  const guardarCupo = async () => {
    const n = Math.max(0, Math.min(1_000_000, Math.round(Number(cupoTxt) || 0)))
    setCupoTxt(String(n)); if (n === actual.cupoCuentas) return
    setMsg('')
    try { await guardarFunciones({ ...actual, cupoCuentas: n }, email); setV((x) => ({ ...x, cupoCuentas: n })); setMsg(n === 0 ? 'Cupo de cuentas: sin límite. Ya se ve en la web.' : `Cupo de cuentas: ${n}. Ya se ve en la web.`) } catch { setMsg('No se pudo guardar el cupo.') }
  }
  // cada interruptor se guarda al tocarlo y la web lo aplica al instante; el texto del aviso se guarda con su botón
  const alternar = async (clave: keyof Funciones, titulo: string, valor: boolean) => {
    const antes = v
    setV({ ...v, [clave]: valor }); setMsg('')
    try {
      await guardarFunciones({ ...actual, [clave]: valor }, email)
      setMsg(`«${titulo}» ${valor ? 'encendida' : 'apagada'}: ya se ve en la web.`)
    } catch { setV(antes); setMsg('No se pudo guardar. Revisa tu conexión.') }
  }
  return (
    <>
      <p className="muted small">Cada interruptor se guarda al tocarlo y la web lo aplica al instante, en todas las pantallas abiertas.</p>
      <ul className="admin-enc admin-fun">
        {FUNCIONES_INFO.map((f) => (
          <li key={f.clave} className="fn-row">
            <div className="fn-txt"><b>{f.titulo}</b><p className="muted small">{f.detalle}</p></div>
            <label className="fn-sw" title={(v[f.clave] as boolean) ? 'Encendida' : 'Apagada'}>
              <input type="checkbox" role="switch" aria-label={f.titulo} checked={v[f.clave] as boolean} onChange={(e) => void alternar(f.clave, f.titulo, e.target.checked)} />
              <span className="fn-track" aria-hidden="true"><i /></span>
              <span className="fn-est" aria-hidden="true">{(v[f.clave] as boolean) ? 'Sí' : 'No'}</span>
            </label>
          </li>
        ))}
        <li className="fn-row">
          <div className="fn-txt"><b>Cupo de cuentas con Google</b><p className="muted small">Tope de personas que pueden registrarse (0 = sin límite). Al llenarse, las demás siguen jugando sin cuenta. Quien ya está registrada puede volver a entrar siempre.{usadas === null ? '' : ` Hoy hay ${usadas} registradas desde que se activó el contador.`}</p></div>
          <input className="search fn-num" type="number" min={0} max={1000000} step={50} value={cupoTxt} aria-label="Cupo de cuentas con Google" onChange={(e) => setCupoTxt(e.target.value)} onBlur={() => void guardarCupo()} onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} />
        </li>
        <li><b>Aviso en la web</b><p className="muted small">Texto que aparece arriba de todo (vacío = sin aviso). Se publica con «Guardar cambios».</p><input className="search" maxLength={160} value={v.mantenimiento} onChange={(e) => setV({ ...v, mantenimiento: e.target.value })} placeholder="Ej.: Mañana abrimos los cuartos de final" /></li>
      </ul>
      <div className="cta"><button className="btn pri" disabled={guardando} onClick={() => void guardar()}>{guardando ? 'Guardando…' : 'Guardar cambios'}</button><button className="btn ghost" onClick={() => setV(FUNCIONES_BASE)}>Valores de partida</button></div>
      {msg && <Note>{msg}</Note>}
    </>
  )
}

function Encuestas({ es, alBorrar }: { es: EncuestaReg[]; alBorrar: (id: string) => void }) {
  const [tipo, setTipo] = useState<'todas' | 'general' | 'mundial'>('todas')
  const lista = useMemo(() => es.filter((e) => tipo === 'todas' || e.tipo === tipo).sort((a, b) => b.creada - a.creada), [es, tipo])
  const { visibles, barra } = usePaginado(lista)
  return (
    <>
      <Tabs value={tipo} onChange={setTipo} items={[['todas', 'Todas'], ['general', 'General'], ['mundial', 'Fin del mundial']]} />
      <p className="small muted">Promedio: {avg(lista.map((e) => e.estrellas))} ★ · {lista.length} respuestas</p>
      <ul className="admin-enc">
        {visibles.map((e) => (
          <li key={e.id}><span className="estrellas-txt">{'★'.repeat(e.estrellas)}{'☆'.repeat(5 - e.estrellas)}{e.estrellas2 ? ` · realismo ${e.estrellas2}/5` : ''}</span>
            <span className="muted small"> {e.tipo === 'general' ? 'General' : 'Fin del mundial'} · {fecha(e.creada)}{e.datos ? ` · ${e.datos}` : ''}{e.pantalla ? ` · pantalla ${e.pantalla}` : ''}</span>
            {e.comentario && <p>{e.comentario}</p>}
            <button className="btn ghost" onClick={() => { if (confirm('¿Borrar esta respuesta? No se puede deshacer.')) void borrarEncuesta(e.id).then(() => alBorrar(e.id)) }}>Borrar</button></li>
        ))}
        {lista.length === 0 && <li className="muted">Todavía nadie respondió.</li>}
      </ul>
      {barra}
    </>
  )
}

function Mundiales({ ms }: { ms: MundialReg[] }) {
  const { visibles, barra } = usePaginado(useMemo(() => [...ms].sort((a, b) => b.creada - a.creada), [ms]))
  return (
    <>
    <table className="gt"><thead><tr><th className="l">Cuándo</th><th className="l">Sede</th><th>Mes</th><th>Clima</th><th>Primes</th><th className="l">Campeón</th></tr></thead>
      <tbody>{visibles.map((m) => <tr key={m.id}><td className="l">{fecha(m.creada)}</td><td className="l">{HOST_BY_ID[m.sede]?.name ?? 'Neutral'}</td><td>{m.mes ? MONTHS[m.mes - 1] : '—'}</td><td>{m.clima}</td><td>{m.primes}</td><td className="l">{TEAM_BY_ID[m.campeon]?.name ?? m.campeon}</td></tr>)}</tbody></table>
    {barra}
    </>
  )
}

function HistoriaAdmin({ ps, email }: { ps: ProgresoReg[]; email: string }) {
  const actual = useFunciones()
  const [nivel, setNivel] = useState(actual.nivelHistoria)
  const [msg, setMsg] = useState('')
  const dist = [0, 1, 2, 3, 4].map((n) => [n, ps.filter((p) => p.nivel === n).length] as const)
  return (
    <>
      <p className="muted small">Define hasta qué fase de la <b>historia oficial</b> pueden avanzar todas las personas. Los resultados no cambian: solo cuándo se pueden ver.</p>
      <label className="seed">Fase liberada <select value={nivel} onChange={(e) => setNivel(Number(e.target.value))}>{NIVELES.map((l, i) => <option key={i} value={i}>{l}</option>)}</select></label>
      <div className="cta"><button className="btn pri" onClick={() => void guardarFunciones({ ...actual, nivelHistoria: nivel }, email).then(() => setMsg('Guardado.')).catch(() => setMsg('No se pudo guardar.'))}>Guardar</button></div>
      {msg && <Note>{msg}</Note>}
      <h3 className="sub">Dónde va la gente (cuentas y visitantes con progreso guardado)</h3>
      {dist.map(([n, c]) => <Bar key={n} label={['Octavos sin jugar', 'Octavos jugados', 'Cuartos jugados', 'Semifinales jugadas', 'Terminó (campeón)'][n]} v={c} min={0} max={Math.max(1, ...dist.map((x) => x[1]))} right={String(c)} />)}
    </>
  )
}
