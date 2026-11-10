// País aproximado de la persona SIN usar su IP ni ningún servicio externo: sale de la zona horaria del navegador
// (y, si no alcanza, de la región del idioma, p. ej. es-CL). Es una estimación: una VPN o una zona horaria cambiada la altera.
const ZONAS: Record<string, string> = {}
const T = `CL:America/Santiago,America/Punta_Arenas|AR:America/Argentina/Buenos_Aires,America/Buenos_Aires,America/Argentina/Cordoba,America/Cordoba,America/Argentina/Mendoza,America/Argentina/Salta,America/Argentina/Tucuman,America/Argentina/Ushuaia|UY:America/Montevideo|PY:America/Asuncion|BO:America/La_Paz|PE:America/Lima|EC:America/Guayaquil,Pacific/Galapagos|CO:America/Bogota|VE:America/Caracas|BR:America/Sao_Paulo,America/Bahia,America/Fortaleza,America/Recife,America/Manaus,America/Belem,America/Cuiaba,America/Campo_Grande,America/Porto_Velho,America/Rio_Branco,America/Noronha,America/Araguaina,America/Maceio,America/Boa_Vista|MX:America/Mexico_City,America/Monterrey,America/Merida,America/Cancun,America/Tijuana,America/Chihuahua,America/Hermosillo,America/Mazatlan,America/Matamoros|GT:America/Guatemala|SV:America/El_Salvador|HN:America/Tegucigalpa|NI:America/Managua|CR:America/Costa_Rica|PA:America/Panama|CU:America/Havana|DO:America/Santo_Domingo|PR:America/Puerto_Rico|JM:America/Jamaica|HT:America/Port-au-Prince|US:America/New_York,America/Chicago,America/Denver,America/Los_Angeles,America/Phoenix,America/Anchorage,America/Detroit,America/Indiana/Indianapolis,America/Boise,Pacific/Honolulu,America/Kentucky/Louisville,America/Juneau|CA:America/Toronto,America/Vancouver,America/Edmonton,America/Winnipeg,America/Halifax,America/St_Johns,America/Regina,America/Montreal|ES:Europe/Madrid,Atlantic/Canary|PT:Europe/Lisbon,Atlantic/Azores|FR:Europe/Paris|IT:Europe/Rome|DE:Europe/Berlin|GB:Europe/London|IE:Europe/Dublin|NL:Europe/Amsterdam|BE:Europe/Brussels|CH:Europe/Zurich|AT:Europe/Vienna|SE:Europe/Stockholm|NO:Europe/Oslo|DK:Europe/Copenhagen|FI:Europe/Helsinki|PL:Europe/Warsaw|CZ:Europe/Prague|SK:Europe/Bratislava|HU:Europe/Budapest|RO:Europe/Bucharest|BG:Europe/Sofia|GR:Europe/Athens|HR:Europe/Zagreb|RS:Europe/Belgrade|SI:Europe/Ljubljana|UA:Europe/Kyiv,Europe/Kiev|RU:Europe/Moscow,Asia/Yekaterinburg,Asia/Novosibirsk,Asia/Vladivostok,Asia/Krasnoyarsk,Asia/Irkutsk,Europe/Samara,Europe/Kaliningrad|TR:Europe/Istanbul,Asia/Istanbul|LT:Europe/Vilnius|LV:Europe/Riga|EE:Europe/Tallinn|IS:Atlantic/Reykjavik|LU:Europe/Luxembourg|MT:Europe/Malta|CY:Asia/Nicosia|MA:Africa/Casablanca|DZ:Africa/Algiers|TN:Africa/Tunis|EG:Africa/Cairo|NG:Africa/Lagos|GH:Africa/Accra|SN:Africa/Dakar|CM:Africa/Douala|KE:Africa/Nairobi|ET:Africa/Addis_Ababa|TZ:Africa/Dar_es_Salaam|UG:Africa/Kampala|ZA:Africa/Johannesburg|AO:Africa/Luanda|MZ:Africa/Maputo|ZW:Africa/Harare|CI:Africa/Abidjan|CD:Africa/Kinshasa|SA:Asia/Riyadh|AE:Asia/Dubai|QA:Asia/Qatar|KW:Asia/Kuwait|IL:Asia/Jerusalem,Asia/Tel_Aviv|JO:Asia/Amman|LB:Asia/Beirut|IQ:Asia/Baghdad|IR:Asia/Tehran|PK:Asia/Karachi|IN:Asia/Kolkata,Asia/Calcutta|BD:Asia/Dhaka|LK:Asia/Colombo|NP:Asia/Kathmandu|TH:Asia/Bangkok|VN:Asia/Ho_Chi_Minh,Asia/Saigon|ID:Asia/Jakarta,Asia/Makassar,Asia/Jayapura|MY:Asia/Kuala_Lumpur|SG:Asia/Singapore|PH:Asia/Manila|HK:Asia/Hong_Kong|TW:Asia/Taipei|CN:Asia/Shanghai,Asia/Urumqi|JP:Asia/Tokyo|KR:Asia/Seoul|KZ:Asia/Almaty|UZ:Asia/Tashkent|AU:Australia/Sydney,Australia/Melbourne,Australia/Brisbane,Australia/Perth,Australia/Adelaide,Australia/Darwin,Australia/Hobart|NZ:Pacific/Auckland`
for (const par of T.split('|')) { const [c, zs] = par.split(':'); for (const z of zs.split(',')) ZONAS[z] = c }

export function paisAproximado(): string {
  try {
    const z = Intl.DateTimeFormat().resolvedOptions().timeZone
    if (z && ZONAS[z]) return ZONAS[z]
    for (const l of navigator.languages ?? [navigator.language]) { const r = l.split('-')[1]; if (r && /^[A-Za-z]{2}$/.test(r)) return r.toUpperCase() }
  } catch { /* sin datos */ }
  return ''
}
export const zonaHoraria = (): string => { try { return (Intl.DateTimeFormat().resolvedOptions().timeZone || '').slice(0, 40) } catch { return '' } }
export function nombrePais(cod: string): string {
  if (!cod) return 'Desconocido'
  try { return new Intl.DisplayNames(['es'], { type: 'region' }).of(cod) ?? cod } catch { return cod }
}
export function sistemaYNavegador(): { sistema: string; navegador: string } {
  const u = navigator.userAgent
  const sistema = /iPhone|iPad|iPod/.test(u) ? 'iOS' : /Android/.test(u) ? 'Android' : /Windows/.test(u) ? 'Windows' : /Mac OS X|Macintosh/.test(u) ? 'macOS' : /CrOS/.test(u) ? 'ChromeOS' : /Linux/.test(u) ? 'Linux' : 'Otro'
  const navegador = /Edg\//.test(u) ? 'Edge' : /OPR\/|Opera/.test(u) ? 'Opera' : /Firefox\//.test(u) ? 'Firefox' : /Chrome\/|CriOS/.test(u) ? 'Chrome' : /Safari\//.test(u) ? 'Safari' : 'Otro'
  return { sistema, navegador }
}
export function origenVisita(): string {
  try { const r = document.referrer; if (!r) return 'directo'; const h = new URL(r).hostname.replace(/^www\./, ''); return h === location.hostname.replace(/^www\./, '') ? 'directo' : h.slice(0, 40) } catch { return '' }
}
