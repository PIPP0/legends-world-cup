import { LANG } from '../i18n'
import { origenVisita, paisAproximado, sistemaYNavegador, zonaHoraria } from '../lib/pais'
// Nube opcional (Firebase). Si no hay configuración, la web funciona igual que antes y el admin muestra "sin conectar".
// La configuración de una app web de Firebase es PÚBLICA (no es un secreto): se carga como variable VITE_FIREBASE_CONFIG (JSON).
import type { FirebaseApp } from 'firebase/app'
import type { Auth, User } from 'firebase/auth'
import type { Firestore } from 'firebase/firestore'

const bruta = (import.meta.env.VITE_FIREBASE_CONFIG as string | undefined) ?? ''
export const CONFIG_NUBE: Record<string, string> | null = (() => { try { const c = bruta ? JSON.parse(bruta) : null; return c && c.apiKey && c.projectId ? c : null } catch { return null } })()
export const NUBE_ACTIVA = CONFIG_NUBE !== null

export interface Nube {
  app: FirebaseApp; auth: Auth; db: Firestore
  fa: typeof import('firebase/auth'); fs: typeof import('firebase/firestore')
}
let cargando: Promise<Nube> | null = null
// Se carga bajo demanda (carga diferida) para no engordar la web de quien no usa la nube.
export function nube(): Promise<Nube> {
  if (!CONFIG_NUBE) return Promise.reject(new Error('sin-nube'))
  return (cargando ??= (async () => {
    const [{ initializeApp }, fa, fs] = await Promise.all([import('firebase/app'), import('firebase/auth'), import('firebase/firestore')])
    const app = initializeApp(CONFIG_NUBE)
    const auth = fa.getAuth(app)
    // Precarga el componente de inicio de sesión (iframe de Google) para que la ventana se abra al instante al pulsar «Entrar» y el navegador no la bloquee.
    void fa.getRedirectResult(auth).catch(() => undefined)
    return { app, auth, db: fs.getFirestore(app), fa, fs }
  })())
}

export interface Cuenta { uid: string; email: string; nombre: string; foto: string; anonimo: boolean }
const deUsuario = (u: User): Cuenta => ({ uid: u.uid, email: u.email ?? '', nombre: u.displayName ?? '', foto: u.photoURL ?? '', anonimo: u.isAnonymous })

// Quien entra al sitio queda como visitante anónimo (cuenta sin datos personales) para poder guardar encuestas y métricas.
export async function asegurarVisitante(): Promise<Cuenta | null> {
  if (!NUBE_ACTIVA) return null
  try {
    const n = await nube()
    await n.auth.authStateReady()
    if (!n.auth.currentUser) await n.fa.signInAnonymously(n.auth)
    return deUsuario(n.auth.currentUser!)
  } catch { return null }
}

export async function cuentaActual(): Promise<Cuenta | null> {
  if (!NUBE_ACTIVA) return null
  try { const n = await nube(); await n.auth.authStateReady(); return n.auth.currentUser ? deUsuario(n.auth.currentUser) : null } catch { return null }
}

// "Entrar con Google": si había un visitante anónimo, se vincula (conserva su progreso); si ya existe esa cuenta de Google, se entra a ella.
export async function entrarConGoogle(opciones: { vincular?: boolean } = {}): Promise<Cuenta> {
  const n = await nube()
  const proveedor = new n.fa.GoogleAuthProvider()
  proveedor.setCustomParameters({ prompt: 'select_account' })
  const actual = n.auth.currentUser
  try {
    // Para Admin se entra siempre con Google "limpio" (sin vincular) para que el token traiga el proveedor google.com que exigen las reglas.
    const r = actual && actual.isAnonymous && opciones.vincular !== false ? await n.fa.linkWithPopup(actual, proveedor) : await n.fa.signInWithPopup(n.auth, proveedor)
    return deUsuario(r.user)
  } catch (e) {
    const code = (e as { code?: string }).code
    // Esa cuenta de Google ya existía: se entra con la credencial que devolvió Google (sin abrir otra ventana, que el navegador bloquearía).
    if (code === 'auth/credential-already-in-use' || code === 'auth/email-already-in-use') {
      const cred = n.fa.GoogleAuthProvider.credentialFromError(e as never)
      if (cred) return deUsuario((await n.fa.signInWithCredential(n.auth, cred)).user)
    }
    throw e
  }
}
// Entrar al Admin con usuario (correo) y contraseña. La contraseña viaja directo a Firebase; la web no la guarda.
export async function entrarConClave(correo: string, clave: string): Promise<Cuenta> {
  const n = await nube()
  return deUsuario((await n.fa.signInWithEmailAndPassword(n.auth, correo.trim(), clave)).user)
}

export async function salir(): Promise<void> { const n = await nube(); await n.fa.signOut(n.auth) }
export async function esperarCambiosDeSesion(cb: (c: Cuenta | null) => void): Promise<() => void> {
  const n = await nube(); return n.fa.onAuthStateChanged(n.auth, (u) => cb(u ? deUsuario(u) : null))
}

// Registro de la persona (visitante o con Google): una vez por carga de la página.
let anotado = false
export async function anotarUsuario(): Promise<void> {
  if (!NUBE_ACTIVA || anotado) return
  try {
    const n = await nube(); await n.auth.authStateReady(); const u = n.auth.currentUser; if (!u) return
    anotado = true
    const ref = n.fs.doc(n.db, 'usuarios', u.uid)
    const previo = await n.fs.getDoc(ref).catch(() => null)
    const ahora = Date.now()
    const ua = navigator.userAgent
    const tablet = /iPad|Tablet/i.test(ua) || (/Android/i.test(ua) && !/Mobi/i.test(ua)) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
    const movil = !tablet && /Mobi|Android|iPhone/i.test(ua)
    const sn = sistemaYNavegador()
    await n.fs.setDoc(ref, {
      uid: u.uid, email: u.email ?? '', nombre: (u.displayName ?? '').slice(0, 120), foto: (u.photoURL ?? '').slice(0, 400), anonimo: u.isAnonymous,
      creado: previo?.exists() ? (previo.data().creado as number) : ahora, ultimo: ahora, visitas: Math.min(100000, (previo?.exists() ? (previo.data().visitas as number) : 0) + 1),
      idioma: (navigator.language || '').slice(0, 12), dispositivo: tablet ? 'tablet' : movil ? 'móvil' : 'computador',
      // Datos técnicos del navegador (sin IP): país aproximado por zona horaria, sistema, navegador, pantalla, de dónde llegó e idioma elegido en la web.
      pais: paisAproximado(), zona: zonaHoraria(), sistema: sn.sistema, navegador: sn.navegador, pantalla: `${screen.width}x${screen.height}`.slice(0, 12), origen: origenVisita(), idiomaWeb: LANG,
      auto: pareceAutomatico(),
    }, { merge: true })
    seguirActividad(ref, n.fs.setDoc)
  } catch { /* si falla, la web sigue igual */ }
}

// Señales para distinguir personas de robots (sin IP, sin contenido): ¿el navegador se declara automatizado?
function pareceAutomatico(): boolean {
  try { return navigator.webdriver === true || /HeadlessChrome|bot|crawl|spider|preview|lighthouse|facebookexternalhit/i.test(navigator.userAgent) } catch { return false }
}
// Actividad de la visita: si hubo interacción (clic, tecla, scroll, toque), segundos con la pestaña visible y pantallas vistas.
// Se guarda poco (máx. 5 escrituras por visita) para no gastar.
function seguirActividad(ref: unknown, setDoc: (r: never, d: object, o: object) => Promise<void>): void {
  let seg = 0, inter = false, pags = 1, sucio = false, envios = 0
  const enviar = () => {
    if (!sucio || envios >= 5) return
    sucio = false; envios++
    void setDoc(ref as never, { inter, seg, pags }, { merge: true }).catch(() => undefined)
  }
  const marca = () => { if (!inter) { inter = true; sucio = true; setTimeout(enviar, 4000) } }
  for (const e of ['pointerdown', 'keydown', 'scroll', 'touchstart']) addEventListener(e, marca, { passive: true })
  addEventListener('hashchange', () => { pags = Math.min(200, pags + 1); sucio = true })
  setInterval(() => { if (document.visibilityState === 'visible') { seg = Math.min(86400, seg + 1); sucio = sucio || inter && seg % 30 === 0 } }, 1000)
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') { sucio = true; enviar() } })
  setTimeout(() => { sucio = true; enviar() }, 60000)
}
