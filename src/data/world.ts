// Sedes, estadios y clima para el mundial personalizado.
// Los valores de estadios (altitud, temperatura típica, humedad, lluvia) son aproximaciones del clima de cada ciudad
// en la época indicada; los perfiles climáticos de los equipos son aproximaciones del clima donde suelen jugar.
// No son datos oficiales: son los supuestos del modelo y se muestran como tales.
import type { Season } from '../types'

export interface Venue {
  id: string; name: string; city: string; alt: number // metros sobre el nivel del mar
  warm: number; cold: number // temperatura típica de partido en la época cálida / fría (°C)
  hum: number // humedad relativa típica 0–1
  rain: number // probabilidad de lluvia en un partido (0–1)
  roof?: boolean // techo/climatizado: anula clima
}
export interface Host { id: string; name: string; iso: string; teamId?: string; south?: boolean; venues: Venue[] }

const v = (id: string, name: string, city: string, alt: number, warm: number, cold: number, hum: number, rain: number, roof?: boolean): Venue =>
  ({ id, name, city, alt, warm, cold, hum, rain, roof })

export const HOSTS: Host[] = [
  { id: 'mex', name: 'México', iso: 'mx', teamId: 'mex', venues: [
    v('azteca', 'Estadio Azteca', 'Ciudad de México', 2240, 22, 14, 0.5, 0.45), v('akron', 'Estadio Akron', 'Guadalajara', 1560, 27, 19, 0.5, 0.4), v('bbva', 'Estadio BBVA', 'Monterrey', 540, 34, 17, 0.55, 0.15)] },
  { id: 'usa', name: 'Estados Unidos', iso: 'us', teamId: 'usa', venues: [
    v('metlife', 'MetLife Stadium', 'Nueva Jersey', 10, 28, 5, 0.65, 0.25), v('rosebowl', 'Rose Bowl', 'Pasadena', 250, 31, 15, 0.35, 0.05), v('att', 'AT&T Stadium', 'Dallas', 140, 24, 24, 0.5, 0, true)] },
  { id: 'bra', south: true, name: 'Brasil', iso: 'br', teamId: 'bra', venues: [
    v('maracana', 'Maracanã', 'Río de Janeiro', 10, 31, 23, 0.75, 0.35), v('corinthians', 'Neo Química Arena', 'São Paulo', 760, 27, 17, 0.7, 0.4), v('mane', 'Mané Garrincha', 'Brasilia', 1170, 29, 24, 0.5, 0.25)] },
  { id: 'arg', south: true, name: 'Argentina', iso: 'ar', teamId: 'arg', venues: [
    v('monumental', 'Estadio Monumental', 'Buenos Aires', 25, 28, 11, 0.65, 0.25), v('kempes', 'Mario Alberto Kempes', 'Córdoba', 400, 28, 11, 0.55, 0.25)] },
  { id: 'chi', south: true, name: 'Chile', iso: 'cl', teamId: 'chi', venues: [
    v('nacional', 'Estadio Nacional', 'Santiago', 520, 29, 9, 0.45, 0.15), v('sausalito', 'Sausalito', 'Viña del Mar', 30, 22, 11, 0.7, 0.15), v('esteroa', 'Ester Roa', 'Concepción', 10, 23, 9, 0.75, 0.45)] },
  { id: 'uru', south: true, name: 'Uruguay', iso: 'uy', teamId: 'uru', venues: [v('centenario', 'Estadio Centenario', 'Montevideo', 20, 27, 10, 0.7, 0.3)] },
  { id: 'esp', name: 'España', iso: 'es', teamId: 'esp', venues: [
    v('bernabeu', 'Santiago Bernabéu', 'Madrid', 650, 33, 9, 0.35, 0.08), v('campnou', 'Camp Nou', 'Barcelona', 10, 29, 10, 0.65, 0.15), v('cartuja', 'La Cartuja', 'Sevilla', 10, 37, 14, 0.35, 0.05)] },
  { id: 'ita', name: 'Italia', iso: 'it', teamId: 'ita', venues: [
    v('olimpico', 'Estadio Olímpico', 'Roma', 20, 30, 10, 0.6, 0.15), v('sansiro', 'San Siro', 'Milán', 120, 30, 4, 0.7, 0.25), v('maradona', 'Diego Armando Maradona', 'Nápoles', 20, 29, 11, 0.65, 0.2)] },
  { id: 'fra', name: 'Francia', iso: 'fr', teamId: 'fra', venues: [
    v('stadefrance', 'Stade de France', 'París', 30, 25, 6, 0.65, 0.3), v('velodrome', 'Vélodrome', 'Marsella', 5, 29, 9, 0.6, 0.1), v('lyon', 'Groupama Stadium', 'Lyon', 200, 27, 5, 0.65, 0.2)] },
  { id: 'ger', name: 'Alemania', iso: 'de', teamId: 'ger', venues: [
    v('olympia', 'Olympiastadion', 'Berlín', 35, 24, 3, 0.65, 0.25), v('allianz', 'Allianz Arena', 'Múnich', 500, 24, 1, 0.7, 0.35), v('westfalen', 'Westfalenstadion', 'Dortmund', 90, 23, 3, 0.75, 0.35)] },
  { id: 'eng', name: 'Inglaterra', iso: 'gb-eng', teamId: 'eng', venues: [
    v('wembley', 'Wembley', 'Londres', 25, 22, 6, 0.75, 0.4), v('oldtrafford', 'Old Trafford', 'Mánchester', 40, 20, 5, 0.8, 0.5), v('anfield', 'Anfield', 'Liverpool', 30, 20, 5, 0.8, 0.5)] },
  { id: 'jpn', name: 'Japón', iso: 'jp', teamId: 'jpn', venues: [
    v('saitama', 'Estadio Saitama', 'Saitama', 10, 31, 8, 0.7, 0.3), v('yokohama', 'Estadio Internacional', 'Yokohama', 10, 30, 9, 0.7, 0.3), v('osaka', 'Panasonic Stadium', 'Osaka', 10, 32, 8, 0.65, 0.25)] },
  { id: 'kor', name: 'Corea del Sur', iso: 'kr', teamId: 'kor', venues: [v('seul', 'Estadio Mundialista', 'Seúl', 40, 30, 0, 0.65, 0.3), v('busan', 'Asiad Main Stadium', 'Busan', 10, 28, 4, 0.7, 0.3)] },
  { id: 'qat', name: 'Catar', iso: 'qa', venues: [v('lusail', 'Estadio Lusail', 'Lusail', 10, 24, 24, 0.5, 0, true), v('albayt', 'Estadio Al Bayt', 'Al Khor', 10, 24, 24, 0.5, 0, true)] },
  { id: 'rsa', south: true, name: 'Sudáfrica', iso: 'za', venues: [
    v('soccercity', 'Soccer City', 'Johannesburgo', 1750, 26, 13, 0.4, 0.2), v('greenpoint', 'Cape Town Stadium', 'Ciudad del Cabo', 5, 27, 12, 0.6, 0.3), v('durban', 'Moses Mabhida', 'Durban', 30, 28, 18, 0.75, 0.25)] },
  { id: 'rus', name: 'Rusia', iso: 'ru', venues: [v('luzhniki', 'Luzhniki', 'Moscú', 150, 24, -3, 0.65, 0.25), v('krestovsky', 'Krestovsky', 'San Petersburgo', 10, 20, -4, 0.75, 0.3)] },
]
export const HOST_BY_ID: Record<string, Host> = Object.fromEntries(HOSTS.map((h) => [h.id, h]))
export const VENUE_BY_ID: Record<string, Venue> = Object.fromEntries(HOSTS.flatMap((h) => h.venues.map((x) => [x.id, x])))
export const HOST_OF_VENUE: Record<string, Host> = Object.fromEntries(HOSTS.flatMap((h) => h.venues.map((x) => [x.id, h])))

export const SEASONS: Record<Season, string> = { verano: 'Verano (calor)', templado: 'Primavera / otoño (templado)', invierno: 'Invierno (frío)' }

export function venueTemp(vn: Venue, season: Season): number {
  return season === 'verano' ? vn.warm : season === 'invierno' ? vn.cold : (vn.warm + vn.cold) / 2
}

export const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
// Temperatura típica de un mes: onda anual entre la temperatura cálida y la fría (pico en julio al norte, enero al sur).
export function monthTemp(vn: Venue, month: number, south?: boolean): number {
  const peak = south ? 1 : 7
  return (vn.warm + vn.cold) / 2 + ((vn.warm - vn.cold) / 2) * Math.cos((2 * Math.PI * (month - peak)) / 12)
}
export function seasonOfMonth(month: number, south?: boolean): Season {
  const c = Math.cos((2 * Math.PI * (month - (south ? 1 : 7))) / 12)
  return c > 0.5 ? 'verano' : c < -0.5 ? 'invierno' : 'templado'
}

// Clima en que suele jugar cada selección (temperatura °C, humedad 0–1, altitud m). Aproximación por país.
export const TEAM_HOME: Record<string, { t: number; h: number; alt: number }> = {
  bra: { t: 27, h: 0.75, alt: 300 }, arg: { t: 19, h: 0.6, alt: 50 }, chi: { t: 17, h: 0.5, alt: 520 }, col: { t: 20, h: 0.7, alt: 1500 },
  per: { t: 20, h: 0.75, alt: 150 }, par: { t: 28, h: 0.7, alt: 100 }, uru: { t: 18, h: 0.7, alt: 30 }, mex: { t: 24, h: 0.5, alt: 1500 },
  usa: { t: 22, h: 0.6, alt: 300 }, esp: { t: 20, h: 0.55, alt: 400 }, ita: { t: 20, h: 0.6, alt: 100 }, fra: { t: 16, h: 0.65, alt: 100 },
  ger: { t: 12, h: 0.7, alt: 100 }, eng: { t: 11, h: 0.8, alt: 50 }, ned: { t: 11, h: 0.8, alt: 5 }, bel: { t: 11, h: 0.8, alt: 50 },
  por: { t: 18, h: 0.65, alt: 100 }, den: { t: 8, h: 0.8, alt: 20 }, swe: { t: 8, h: 0.75, alt: 50 }, pol: { t: 10, h: 0.7, alt: 150 },
  aut: { t: 11, h: 0.65, alt: 300 }, hun: { t: 14, h: 0.65, alt: 120 }, cro: { t: 17, h: 0.6, alt: 100 }, rou: { t: 14, h: 0.65, alt: 100 },
  bul: { t: 13, h: 0.6, alt: 500 }, tur: { t: 20, h: 0.6, alt: 500 }, jpn: { t: 22, h: 0.7, alt: 40 }, kor: { t: 20, h: 0.65, alt: 40 },
  nga: { t: 29, h: 0.75, alt: 200 }, sen: { t: 28, h: 0.7, alt: 20 }, cmr: { t: 27, h: 0.8, alt: 400 }, mar: { t: 24, h: 0.55, alt: 100 },
}
