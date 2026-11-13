// Filtro de nombres ofensivos para el ranking público (español, inglés, portugués, francés, italiano, alemán e indonesio).
// Es un filtro básico y conservador: normaliza tildes, números parecidos a letras («m1erda»), letras repetidas («fuuuck») y espacios, y compara por palabra
// (las palabras cortas) o por contenido (las largas), para no bloquear nombres normales por casualidad («Scunthorpe», «Analía», «Dickens»).
// Nunca es perfecto: los nombres también se pueden retirar o renombrar desde Administración.

const CORTAS = new Set([ // se comparan solo como palabra completa
  'puta', 'puto', 'putas', 'putos', 'ctm', 'csm', 'hdp', 'fuck', 'shit', 'cunt', 'dick', 'cock', 'fag', 'twat', 'pedo', 'kkk', 'nazi', 'nigga', 'fick', 'fotze', 'babi',
  'verga', 'pija', 'polla', 'coño', 'cono', 'joder', 'culo', 'culiao', 'culiado', 'nutte', 'pute', 'merde', 'caralho', 'porra', 'foda', 'viado', 'cazzo', 'troia', 'anjing', 'tolol', 'goblok',
])
const LARGAS = [ // se buscan dentro del texto (sin espacios), así que solo palabras largas y claras
  'mierda', 'conchatumadre', 'conchetumare', 'conchesumadre', 'maricon', 'maraco', 'pendejo', 'pendeja', 'cabron', 'chingar', 'chingada', 'hijoputa', 'hijodeputa', 'hijueputa',
  'imbecil', 'retrasado', 'mongolico', 'sudaca', 'violador', 'pedofilo', 'hitler',
  'fucker', 'fucking', 'bitch', 'asshole', 'bastard', 'whore', 'nigger', 'faggot', 'retard', 'rapist', 'paedo', 'wanker', 'motherfucker', 'blowjob',
  'buceta', 'fodase', 'filhodaputa', 'arrombado', 'cuzao',
  'putain', 'connard', 'connasse', 'salope', 'encule', 'niquer', 'bougnoule',
  'vaffanculo', 'stronzo', 'puttana', 'frocio', 'minchia', 'coglione',
  'scheisse', 'arschloch', 'hurensohn', 'wichser', 'schwuchtel', 'ficken',
  'bangsat', 'kontol', 'memek', 'ngentot', 'bajingan', 'kampret',
]
const LEET: Record<string, string> = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', '$': 's', '!': 'i' }

function normalizar(t: string): string {
  return t.toLowerCase().replace(/ß/g, 'ss').normalize('NFD').replace(/\p{M}/gu, '').replace(/[0134577@$!]/g, (c) => LEET[c] ?? c)
}
const sinRepetidas = (s: string) => s.replace(/(.)\1+/g, '$1')

export function esOfensivo(texto: string): boolean {
  const n = normalizar(texto)
  const crudas = n.split(/[^a-zñ]+/).filter(Boolean)
  // letras sueltas seguidas («f u c k») se juntan en una sola palabra
  const palabras: string[] = []
  let suelta = ''
  for (const w of crudas) { if (w.length === 1) suelta += w; else { if (suelta) { palabras.push(suelta); suelta = '' } palabras.push(w) } }
  if (suelta) palabras.push(suelta)
  for (const p of palabras) {
    const q = sinRepetidas(p)
    if (CORTAS.has(p) || CORTAS.has(q)) return true
  }
  const compacto = n.replace(/[^a-zñ]/g, '')
  const compactoSin = sinRepetidas(compacto)
  return LARGAS.some((w) => compacto.includes(w) || compactoSin.includes(sinRepetidas(w)))
}

// Para mostrar: si un nombre ya guardado resulta ofensivo, en pantalla aparece un nombre neutro en su lugar (no se borra nada).
export const nombreVisible = (alias: string, id: string): string => (esOfensivo(alias) ? `Jugador ${id.replace(/[^A-Za-z0-9]/g, '').slice(0, 4).toUpperCase() || 'XXXX'}` : alias)
