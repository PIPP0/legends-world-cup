import frozen from './story-knockout.json'
import type { Bracket } from '../types'

// Eliminatorias de la historia oficial: resultados FIJOS (iguales para todas las personas). Se generaron una sola vez con
// scripts/congelar-historia.ts y no se recalculan: cambiar el modelo no los altera.
export const STORY_KNOCKOUT = frozen as unknown as { version: number; seed: string; bracket: Bracket }
