import { useEffect, useState } from 'react'
import { NUBE_ACTIVA, cuentaActual, esperarCambiosDeSesion, type Cuenta } from '../cloud/firebase'
import { useFunciones } from '../cloud/funciones'

// Estado de la sesión para decidir qué mostrar. `cargando` dura hasta que el navegador confirma si hay una cuenta; `conCuenta` = entró con Google (no es visitante anónimo).
export function useSesion(): { cargando: boolean; conCuenta: boolean } {
  const [c, setC] = useState<Cuenta | null | undefined>(NUBE_ACTIVA ? undefined : null)
  useEffect(() => {
    if (!NUBE_ACTIVA) return
    let off: (() => void) | undefined; let vivo = true
    void (async () => { const a = await cuentaActual(); if (vivo) setC(a); const f = await esperarCambiosDeSesion((x) => { if (vivo) setC(x) }); if (vivo) off = f; else f() })()
    return () => { vivo = false; off?.() }
  }, [])
  return { cargando: c === undefined, conCuenta: !!c && !c.anonimo }
}

// Con el cupo de cuentas lleno la persona puede elegir «Seguir sin cuenta»: ese permiso queda en este navegador y le deja ver y usar su equipo local.
const K_SIN_CUENTA = 'lwc:duelo:sin-cuenta'
export const permitirSinCuenta = (): void => { try { localStorage.setItem(K_SIN_CUENTA, '1') } catch { /* sin almacenamiento */ } }
const sinCuentaPermitido = (): boolean => { try { return localStorage.getItem(K_SIN_CUENTA) === '1' } catch { return false } }

// El Duelo (equipo, VS y estadísticas) es para quien entró con Google. Si la nube o «Entrar con Google» están apagados, no se exige nada.
export function useDueloVisible(): { cargando: boolean; visible: boolean; exige: boolean } {
  const f = useFunciones(); const s = useSesion()
  const exige = NUBE_ACTIVA && f.cuentas
  return { cargando: exige && s.cargando, visible: !exige || s.conCuenta || sinCuentaPermitido(), exige }
}
