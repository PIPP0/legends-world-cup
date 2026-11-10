import { LANG, cambiarIdioma, t } from '../i18n'

// Cambiar de idioma: recarga la página con el idioma elegido (se recuerda para la próxima vez).
export function SelectorIdioma() {
  const otro = LANG === 'en' ? 'es' : 'en'
  return (
    <button type="button" className="icon-btn lang-btn" onClick={() => cambiarIdioma(otro)} title={otro === 'en' ? 'Read this site in English' : 'Leer este sitio en español'}
      aria-label={t('Cambiar idioma')}>
      <b>{otro.toUpperCase()}</b>
    </button>
  )
}
