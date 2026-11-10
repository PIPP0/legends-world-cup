import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { TEAMS } from '../data'
import { tr } from '../i18n'
import { ponerFavorita, useFavorita } from '../engine/favorita'
import { guardarFavoritaNube } from '../cloud/datos'
import { Flag } from './common'

// Ventana para elegir la selección favorita: se pide al entrar con la cuenta y se puede cambiar desde «Mi cuenta».
export function ElegirFavorita({ onClose }: { onClose: () => void }) {
  const fav = useFavorita()
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    const prev = document.body.style.overflow; document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', k); document.body.style.overflow = prev }
  }, [onClose])
  const elegir = (id: string) => { ponerFavorita(id); void guardarFavoritaNube(id); onClose() }
  const equipos = [...TEAMS].sort((a, b) => a.name.localeCompare(b.name))
  return createPortal(
    <div className="modal-bg" role="dialog" aria-modal="true" aria-label={tr('Elige tu selección favorita')} onClick={onClose}>
      <div className="modal fav-modal" onClick={(e) => e.stopPropagation()}>
        <h3>{tr('Elige tu selección favorita')}</h3>
        <p className="muted small">{tr('La verás con una ★ en todo el sitio. Puedes cambiarla cuando quieras.')}</p>
        <div className="fav-grid">
          {equipos.map((t) => (
            <button key={t.id} type="button" className={`fav-op${fav === t.id ? ' on' : ''}`} onClick={() => elegir(t.id)} aria-pressed={fav === t.id}>
              <Flag id={t.id} size={30} /><span>{t.name}</span>{fav === t.id && <i className="fav-star">★</i>}
            </button>
          ))}
        </div>
        <div className="cta"><button className="btn ghost" onClick={onClose}>{tr('Ahora no')}</button></div>
      </div>
    </div>,
    document.body,
  )
}
