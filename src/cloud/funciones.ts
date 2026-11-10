import { useEffect, useState } from 'react'
import { NUBE_ACTIVA, nube } from './firebase'

// Funciones que el admin puede encender o apagar sin republicar la web. Los valores de partida son los de la web actual.
export interface Funciones {
  simulaMundial: boolean // asistente «Simula tu mundial» y su botón
  encuestas: boolean // icono de opinión y encuesta al terminar un mundial
  donaciones: boolean // botón «Apoyar (opcional)»
  cobro: boolean // cobro por paquetes (además de la configuración de pago)
  animacionCuadro: boolean // animación del cuadro de eliminatorias
  cuentas: boolean // botón «Entrar con Google»
  nivelHistoria: number // hasta qué fase de la historia oficial está liberada para todos (0 octavos … 4 todo)
  mantenimiento: string // aviso arriba de la web (vacío = sin aviso)
}
export const FUNCIONES_BASE: Funciones = { simulaMundial: true, encuestas: true, donaciones: true, cobro: false, animacionCuadro: true, cuentas: true, nivelHistoria: 4, mantenimiento: '' }
export const FUNCIONES_INFO: { clave: keyof Funciones; titulo: string; detalle: string }[] = [
  { clave: 'simulaMundial', titulo: 'Simula tu mundial', detalle: 'El asistente de sede, fecha, clima y leyendas en su prime, con sorteo y partidos en vivo.' },
  { clave: 'encuestas', titulo: 'Encuestas', detalle: 'El icono de opinión del header y la encuesta que se abre al terminar un mundial.' },
  { clave: 'donaciones', titulo: 'Apoyo voluntario', detalle: 'El botón «Apoyar (opcional)» al final de cada mundial (necesita un enlace configurado).' },
  { clave: 'cobro', titulo: 'Cobro por paquetes', detalle: 'Activa el pago. Solo funciona si además está conectado PayPal; no lo enciendas sin resolver lo tributario.' },
  { clave: 'animacionCuadro', titulo: 'Animación del cuadro', detalle: 'El cuadro de eliminatorias que avanza solo hasta el campeón.' },
  { clave: 'cuentas', titulo: 'Entrar con Google', detalle: 'El botón del header para registrarse y guardar el avance en la nube.' },
]

const CLAVE = 'lwc:funciones:v1'
const leerLocal = (): Funciones => { try { return { ...FUNCIONES_BASE, ...JSON.parse(localStorage.getItem(CLAVE) ?? '{}') } } catch { return FUNCIONES_BASE } }
let actual: Funciones = leerLocal()
const oyentes = new Set<() => void>()
const fijar = (f: Funciones) => { actual = f; try { localStorage.setItem(CLAVE, JSON.stringify(f)) } catch { /* sin almacenamiento */ } oyentes.forEach((o) => o()) }

// Lee los interruptores de la nube una vez por carga (y cada 5 minutos). Si no hay nube, valen los de partida.
let iniciado = false
export function iniciarFunciones() {
  if (iniciado || !NUBE_ACTIVA) return
  iniciado = true
  const leer = async () => {
    try {
      const n = await nube()
      const d = await n.fs.getDoc(n.fs.doc(n.db, 'config', 'funciones'))
      if (d.exists()) fijar({ ...FUNCIONES_BASE, ...(d.data().valores as Partial<Funciones>) })
    } catch { /* se mantienen los últimos conocidos */ }
  }
  void leer(); setInterval(() => void leer(), 5 * 60_000)
}
export const suscribirFunciones = (cb: () => void) => { oyentes.add(cb); return () => { oyentes.delete(cb) } }
export function useFunciones(): Funciones {
  const [f, setF] = useState(actual)
  useEffect(() => { const o = () => setF(actual); oyentes.add(o); o(); return () => { oyentes.delete(o) } }, [])
  return f
}
export const funcionesAhora = () => actual
export async function guardarFunciones(valores: Funciones, por: string) {
  const n = await nube()
  await n.fs.setDoc(n.fs.doc(n.db, 'config', 'funciones'), { valores, actualizado: Date.now(), por })
  fijar(valores)
}
