import { useEffect, useRef, useState } from 'react'
import { IDIOMAS, LANG, cambiarIdioma, t } from '../i18n'

// Selector de idioma: desplegable con los idiomas terminados, cada uno escrito en su propio idioma. Cambiar recarga la página y se recuerda.
export function SelectorIdioma() {
  const [abierto, setAbierto] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!abierto) return
    const fuera = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setAbierto(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setAbierto(false) }
    document.addEventListener('mousedown', fuera); document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', fuera); document.removeEventListener('keydown', esc) }
  }, [abierto])
  return (
    <div className="lang-wrap" ref={ref}>
      <button type="button" className="icon-btn lang-btn" aria-haspopup="listbox" aria-expanded={abierto} aria-label={t('Idioma')} title={t('Idioma')} onClick={() => setAbierto(!abierto)}>
        <b>{LANG.toUpperCase()}</b>
      </button>
      {abierto && (
        <ul className="lang-menu" role="listbox" aria-label={t('Idioma')}>
          {IDIOMAS.map((i) => (
            <li key={i.code} role="option" aria-selected={i.code === LANG}>
              <button type="button" className={i.code === LANG ? 'on' : ''} lang={i.code} onClick={() => (i.code === LANG ? setAbierto(false) : cambiarIdioma(i.code))}>
                <span>{i.nombre}</span><em>{i.code.toUpperCase()}</em>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
