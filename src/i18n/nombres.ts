import { LANG } from './index'
// Nombres de selecciones en inglés (id → nombre).
export const TEAM_EN: Record<string, string> = {
  bra: 'Brazil', eng: 'England', rou: 'Romania', jpn: 'Japan', arg: 'Argentina', cro: 'Croatia', mex: 'Mexico', mar: 'Morocco', ger: 'Germany', uru: 'Uruguay',
  bul: 'Bulgaria', kor: 'South Korea', ita: 'Italy', hun: 'Hungary', col: 'Colombia', nga: 'Nigeria', fra: 'France', bel: 'Belgium', per: 'Peru', usa: 'United States',
  esp: 'Spain', swe: 'Sweden', aut: 'Austria', par: 'Paraguay', ned: 'Netherlands', den: 'Denmark', chi: 'Chile', sen: 'Senegal', por: 'Portugal', pol: 'Poland',
  cmr: 'Cameroon', tur: 'Turkey',
}
export const teamName = (id: string, es: string) => (LANG === 'en' ? TEAM_EN[id] ?? es : es)

// Posiciones: abreviaturas en inglés (el dato interno sigue en español).
export const POS_EN: Record<string, string> = { PO: 'GK', LD: 'RB', LI: 'LB', DFC: 'CB', MCD: 'DM', MC: 'CM', MI: 'LM', MD: 'RM', MCO: 'AM', EXT: 'W', DC: 'ST' }
export const posLabel = (p: string) => (LANG === 'en' ? POS_EN[p] ?? p : p)
export const LINE_EN: Record<string, string> = { GK: 'Goalkeepers', DEF: 'Defenders', MID: 'Midfielders', ATT: 'Forwards' }
export const ATTR_EN: Record<string, string> = { Ritmo: 'Pace', Disparo: 'Shooting', Pase: 'Passing', Regate: 'Dribbling', Defensa: 'Defending', Físico: 'Physical', Paradas: 'Diving', Reflejos: 'Reflexes', Posición: 'Positioning', Salida: 'Handling', 'Juego aéreo': 'Aerial', 'Juego con los pies': 'Kicking' }
export const attrLabel = (a: string) => (LANG === 'en' ? ATTR_EN[a] ?? a : a)
