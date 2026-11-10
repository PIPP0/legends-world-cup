import { tr } from '../i18n'
import { useEffect, useState } from 'react'
import { NUBE_ACTIVA, anotarUsuario, asegurarVisitante, entrarConGoogle, esperarCambiosDeSesion, salir, type Cuenta } from '../cloud/firebase'
import { sincronizarNivel } from '../engine/storyLevel'
import { useFunciones } from '../cloud/funciones'

// Registro opcional con Google: junto al icono de opinión. Sin cuenta se juega igual (visitante anónimo).
export function CuentaHeader() {
  const f = useFunciones()
  const [c, setC] = useState<Cuenta | null>(null)
  const [abierto, setAbierto] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    if (!NUBE_ACTIVA) return
    let off: (() => void) | undefined
    void (async () => {
      await asegurarVisitante()
      off = await esperarCambiosDeSesion((cuenta) => { setC(cuenta); if (cuenta) { void anotarUsuario(); void sincronizarNivel() } })
    })()
    return () => off?.()
  }, [])
  if (!NUBE_ACTIVA || !f.cuentas) return null
  const conCuenta = c && !c.anonimo
  const entrar = async () => { setError(''); try { await entrarConGoogle(); setAbierto(false) } catch (e) { const code = (e as { code?: string }).code ?? ''; console.warn('login Google:', code, e); if (code !== 'auth/popup-closed-by-user' && code !== 'auth/cancelled-popup-request') setError(`${tr('No se pudo entrar. Inténtalo de nuevo.')} (${code.replace('auth/', '') || 'error'})`) } }
  return (
    <div className="cuenta">
      {conCuenta ? (
        <button type="button" className="icon-btn av" aria-label={tr('Mi cuenta')} title={c!.nombre || c!.email} onClick={() => setAbierto(!abierto)}>
          {c!.foto ? <img src={c!.foto} alt="" referrerPolicy="no-referrer" /> : <b>{(c!.nombre || c!.email || '?')[0].toUpperCase()}</b>}
        </button>
      ) : (
        <button type="button" className="btn cta-entrar" onClick={() => void entrar()}>{tr('Entrar')}</button>
      )}
      {abierto && conCuenta && (
        <div className="cuenta-menu" role="menu">
          <p><b>{c!.nombre || tr('Mi cuenta')}</b><br /><span className="muted small">{c!.email}</span></p>
          <p className="small muted">{tr('Tu avance de la historia se guarda en la nube.')}</p>
          <button className="btn ghost" onClick={() => { setAbierto(false); void salir().then(() => asegurarVisitante()) }}>{tr('Cerrar sesión')}</button>
        </div>
      )}
      {error && <span className="cuenta-err small" role="alert">{error}</span>}
    </div>
  )
}
