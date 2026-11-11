import { nombre } from './index'
// Nombres que dependen del idioma. El dato interno sigue en español; la traducción vive en los diccionarios (claves «EQ·bra», «POS·DC»…).
export const teamName = (id: string, es: string) => nombre('EQ·' + id, es)
export const hostName = (id: string, es: string) => nombre('EQ·' + id, nombre('PA·' + id, es))
export const cityName = (es: string) => nombre('CI·' + es, es)
export const venueName = (es: string) => nombre('VN·' + es, es)
export const posLabel = (p: string) => nombre('POS·' + p, p)
export const attrLabel = (a: string) => nombre('ATTR·' + a, a)
export const attrAbbr = (a: string) => nombre('AB·' + a, a.slice(0, 3).toUpperCase())
export const monthName = (i: number, es: string) => nombre('MES·' + i, es)
const POS_ES: Record<string, string> = { PO: 'portero', LD: 'lateral derecho', LI: 'lateral izquierdo', DFC: 'defensa central', MCD: 'mediocentro defensivo', MC: 'mediocampista', MI: 'volante izquierdo', MD: 'volante derecho', MCO: 'mediapunta', EXT: 'extremo', DC: 'delantero centro' }
// Nombre completo del puesto (p. ej. «portero» en vez de «PO»).
export const posNombre = (p: string) => nombre('POSN·' + p, POS_ES[p] ?? p)
