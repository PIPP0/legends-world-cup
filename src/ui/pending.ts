import type { AltTournament } from '../types'
// El mundial ya está simulado pero se muestra por etapas en #/vivo (así no se adelanta ningún resultado).
export function startExperience(t: AltTournament) {
  try { sessionStorage.setItem('lwc:pending', JSON.stringify(t)) } catch { /* sin almacenamiento */ }
  location.hash = '#/vivo'
}
export function takePending(): AltTournament | null {
  try { const s = sessionStorage.getItem('lwc:pending'); return s ? (JSON.parse(s) as AltTournament) : null } catch { return null }
}
