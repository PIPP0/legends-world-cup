import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { tr } from '../i18n'
import { FORMATOS, aBlob, dibujarEquipo, type Formato } from '../lib/imagenEquipo'
import type { Equipo } from '../engine/duelo'

const NOMBRE: Record<Formato['id'], string> = { historia: 'Historia vertical', publicacion: 'Publicación', x: 'X · LinkedIn', cuadrado: 'Cuadrado' }

// Ventana para compartir el once como imagen: eliges el tamaño según la red, ves la vista previa y la descargas o la compartes.
export type Red = 'instagram' | 'facebook' | 'x'
const FORMATO_RED: Record<Red, Formato['id']> = { instagram: 'publicacion', facebook: 'publicacion', x: 'x' }
const NOMBRE_RED: Record<Red, string> = { instagram: 'Instagram', facebook: 'Facebook', x: 'X' }
const SITIO = 'https://impossiblecup.com'
export function CompartirEquipo({ equipo, onClose, red }: { equipo: Equipo; onClose: () => void; red?: Red }) {
  const [fmt, setFmt] = useState<Formato['id']>(red ? FORMATO_RED[red] : 'historia')
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState(false)
  const blob = useRef<Blob | null>(null)
  useEffect(() => {
    let vivo = true
    setUrl(null); setError(false)
    const f = FORMATOS.find((x) => x.id === fmt)!
    void dibujarEquipo(equipo, f).then(aBlob).then((b) => {
      if (!vivo) return
      if (!b) { setError(true); return }
      blob.current = b; setUrl((u) => { if (u) URL.revokeObjectURL(u); return URL.createObjectURL(b) })
    }).catch(() => { if (vivo) setError(true) })
    return () => { vivo = false }
  }, [fmt, equipo])
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    const prev = document.body.style.overflow; document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', k); document.body.style.overflow = prev }
  }, [onClose])
  const nombreArchivo = `mi-once-ideal-${fmt}.png`
  const descargar = () => { if (!url) return; const a = document.createElement('a'); a.href = url; a.download = nombreArchivo; a.click() }
  const compartir = async () => {
    const b = blob.current; if (!b) return
    const file = new File([b], nombreArchivo, { type: 'image/png' })
    try {
      if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], title: 'Legends World Cup', text: `${texto} impossiblecup.com` }); return }
    } catch { /* cancelado */ }
    descargar()
  }
  const texto = tr('Armé mi Once Ideal en Legends World Cup. ¿Puedes superarlo?')
  const enlaceRed = red === 'x' ? `https://twitter.com/intent/tweet?text=${encodeURIComponent(texto)}&url=${encodeURIComponent(SITIO)}` : red === 'facebook' ? `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(SITIO)}` : red === 'instagram' ? 'https://www.instagram.com/' : null
  return createPortal(
    <div className="modal-bg" role="dialog" aria-modal="true" aria-label={tr('Comparte tu equipo')} onClick={onClose}>
      <div className="modal cmp-modal" onClick={(e) => e.stopPropagation()}>
        <header className="cmp-top"><div><h3>{tr('Comparte tu equipo')}</h3><p className="muted small">{tr('Elige el tamaño según la red social donde lo vas a publicar.')}</p></div>
          <button type="button" className="mvp-x" onClick={onClose} aria-label={tr('Cerrar')}>✕</button></header>
        <div className="cmp-cols">
          <div className="cmp-vista">
            {url ? <img src={url} alt={tr('Mi Once Ideal')} /> : <p className="muted">{error ? tr('No se pudo crear la imagen. Inténtalo de nuevo.') : tr('Generando imagen…')}</p>}
          </div>
          <div className="cmp-opc">
            <div className="cmp-fmts" role="radiogroup" aria-label={tr('Formato de imagen')}>
              {FORMATOS.map((f) => (
                <button key={f.id} type="button" role="radio" aria-checked={fmt === f.id} className={`cmp-fmt${fmt === f.id ? ' on' : ''}`} onClick={() => setFmt(f.id)}>
                  <b>{tr(NOMBRE[f.id])}</b><small>{f.redes}</small><em>{f.w}×{f.h}</em>
                </button>
              ))}
            </div>
            <div className="cta"><button className="btn pri" disabled={!url} onClick={() => void compartir()}>{tr('Compartir')}</button><button className="btn" disabled={!url} onClick={descargar}>{tr('Descargar imagen')}</button>
              {red && enlaceRed && <a className="btn ghost" href={enlaceRed} target="_blank" rel="noopener noreferrer">{tr('Abrir {red}', { red: NOMBRE_RED[red] })} ↗</a>}</div>
            {red && <p className="small muted">{tr('Descarga la imagen y adjúntala en tu publicación.')}</p>}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
