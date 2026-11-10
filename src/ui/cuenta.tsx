import { tr } from '../i18n'
import { useEffect, useState } from 'react'
import { NUBE_ACTIVA, anotarUsuario, asegurarVisitante, entrarConGoogle, esperarCambiosDeSesion, salir, type Cuenta } from '../cloud/firebase'
import { sincronizarNivel } from '../engine/storyLevel'
import { useFunciones } from '../cloud/funciones'
import { guardarFavoritaNube, leerFavoritaNube } from '../cloud/datos'
import { favoritaActual, ponerFavorita, useFavorita } from '../engine/favorita'
import { TEAM_BY_ID } from '../data/lookup'
import { Flag } from './common'
import { ElegirFavorita } from './favorita'

// Registro opcional con Google: junto al icono de opinión. Sin cuenta se juega igual (visitante anónimo).
export function CuentaHeader() {
  const f = useFunciones()
  const [c, setC] = useState<Cuenta | null>(null)
  const [abierto, setAbierto] = useState(false)
  const [eligiendo, setEligiendo] = useState(false)
  const favorita = useFavorita()
  const [error, setError] = useState('')
  useEffect(() => {
    if (!NUBE_ACTIVA) return
    let off: (() => void) | undefined
    void (async () => {
      await asegurarVisitante()
      off = await esperarCambiosDeSesion((cuenta) => {
        setC(cuenta)
        if (cuenta) { void anotarUsuario(); void sincronizarNivel() }
        // la selección favorita es de quien tiene cuenta: se trae de la nube y, si aún no eligió una, se le pide
        if (cuenta && !cuenta.anonimo) void leerFavoritaNube().then((f) => {
          const local = favoritaActual()
          if (f) ponerFavorita(f) // la nube manda
          else if (local) void guardarFavoritaNube(local) // ya la había elegido en este navegador: se recuerda y se reintenta guardar en la nube
          else if (f === null) setEligiendo(true) // solo se pregunta si nunca eligió
        })
        else ponerFavorita(null)
      })
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
      {conCuenta && favorita && TEAM_BY_ID[favorita] && <span className="av-flag" aria-hidden style={{ backgroundImage: `url(https://flagcdn.com/w80/${TEAM_BY_ID[favorita].iso}.png)` }} />}
      {abierto && conCuenta && (
        <div className="cuenta-menu" role="menu">
          <p><b>{c!.nombre || tr('Mi cuenta')}</b><br /><span className="muted small">{c!.email}</span></p>
          <div className="fav-row">
            <span className="fav-lbl">{tr('Tu selección favorita')}</span>
            <div>
              {favorita && TEAM_BY_ID[favorita] ? <span className="fav-eq"><Flag id={favorita} size={24} /><b>{TEAM_BY_ID[favorita].name}</b><i className="fav-star">★</i></span> : <span className="muted">—</span>}
              <button type="button" className="fav-edit" onClick={() => { setAbierto(false); setEligiendo(true) }}>{tr('Editar')}</button>
            </div>
          </div>
          <button className="btn ghost" onClick={() => { setAbierto(false); void salir().then(() => asegurarVisitante()) }}>{tr('Cerrar sesión')}</button>
        </div>
      )}
      {eligiendo && <ElegirFavorita onClose={() => setEligiendo(false)} />}
      {error && <span className="cuenta-err small" role="alert">{error}</span>}
    </div>
  )
}
