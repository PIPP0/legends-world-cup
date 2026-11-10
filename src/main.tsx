import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { cargarIdioma } from './i18n'
import './styles.css'

// Primero el diccionario del idioma elegido y luego la web: los datos con nombres traducidos se calculan al importar.
cargarIdioma().then(() => import('./ui/App')).then(({ default: App }) => {
  createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>)
})
