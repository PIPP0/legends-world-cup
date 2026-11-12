import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { cargarIdioma } from './i18n'
import './styles.css'

// Si PayPal devuelve su ventana emergente (la del pago) a esta web, se cierra sola en vez de dejar la web suelta sin barra del navegador.
try {
  if (window.opener && window.opener !== window && /^(__zoid__|__paypal|xcomponent|lwc-paypal)/i.test(window.name)) { window.close() }
} catch { /* sin acceso: se queda como está */ }

// Primero el diccionario del idioma elegido y luego la web: los datos con nombres traducidos se calculan al importar.
cargarIdioma().then(() => import('./ui/App')).then(({ default: App }) => {
  createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>)
})
