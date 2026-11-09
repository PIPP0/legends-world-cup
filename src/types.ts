export type Pos = 'PO' | 'LD' | 'DFC' | 'LI' | 'MCD' | 'MC' | 'MI' | 'MD' | 'MCO' | 'EXT' | 'DC'
export type Line = 'GK' | 'DEF' | 'MID' | 'ATT'

export interface Attr { k: string; v: number }

export interface Player {
  id: string
  name: string
  teamId: string
  pos: Pos
  line: Line
  ovr: number
  attrs: Attr[]
  x: number // 0..100 en la cancha (izquierda→derecha, vista del espectador)
  y: number // 0..100 (arco propio abajo)
  weight: { scorer: number; creator: number }
  verify: boolean
  starter: boolean // titular del once; si es false, es suplente del plantel de 23
}

export interface Team {
  id: string
  name: string
  iso: string
  group: string
  formation: string
  xi: Player[] // once titular
  bench: Player[] // 12 suplentes
  squad: Player[] // plantel completo de 23
}

export interface Goal {
  minute: number
  teamId: string
  scorerId: string
  assistId?: string
  phase?: 'reg' | 'et'
}

// Condiciones en que se jugó un partido simulado con mundial personalizado.
export interface MatchCtx { venueId: string; temp: number; rain: number; roof?: boolean }

export type Season = 'verano' | 'templado' | 'invierno'
export interface WorldConfig {
  hostId: string
  season: Season
  finalVenue: string
  month?: number // 1–12; si existe, manda sobre `season` para la temperatura
  climate?: 'normal' | 'calor' | 'lluvia' | 'frio' // año atípico elegido por el usuario
  primes?: string[] // hasta 3 jugadores en su mejor momento (+PRIME_BOOST de valoración)
  history: Record<string, { n: number; gd: number }> // "equipo|estadio" → partidos y diferencia de gol acumulados
  receipt?: string // comprobante del pago simulado
}

export interface Match {
  id: string
  group: string
  matchday: 1 | 2 | 3
  home: string
  away: string
  hg: number
  ag: number
  goals?: Goal[]
  ctx?: MatchCtx
}

export interface TableRow {
  teamId: string
  p: number; w: number; d: number; l: number
  gf: number; ga: number; gd: number; pts: number
}

export interface Weights {
  quality: number
  balance: number
  attack: number
  defense: number
  experience: number
}

export interface ModelParams {
  weights: Weights
  goalBase: number // goles esperados promedio por equipo
  sensitivity: number // cuánto pesa la diferencia de calidad
  matchup: number // cuánto pesa ataque propio vs defensa rival
  variance: number // incertidumbre del día (desvío)
}

export interface TeamProfile {
  teamId: string
  quality: number
  balance: number
  attack: number
  defense: number
  experience: number
  strength: number
  gk: number
  lines: { gk: number; def: number; mid: number; att: number }
}

export interface KoMatch {
  id: string
  round: 'r16' | 'qf' | 'sf' | 'third' | 'final'
  a?: string
  b?: string
  ga?: number
  gb?: number
  et?: boolean
  pens?: [number, number]
  winner?: string
  goals?: Goal[]
  ctx?: MatchCtx
}

export interface Bracket {
  r16: KoMatch[]
  qf: KoMatch[]
  sf: KoMatch[]
  third: KoMatch
  final: KoMatch
  champion?: string
}

export interface AltTournament {
  seed: string
  mode: 'octavos' | 'completo'
  groupMatches: Match[]
  bracket: Bracket
  world?: WorldConfig
  groups?: Record<string, string[]> // grupos sorteados (si no hay, se usan los oficiales)
  recorded?: boolean
}
