import { tr } from '../i18n'
import { PLAYER_BY_ID } from '../data/lookup'
import photoData from '../data/photos.json'
import { Section } from './common'

const rows = Object.entries(photoData as Record<string, { page: string; title: string; license: string; author: string }>)
  .map(([id, e]) => ({ id, e, p: PLAYER_BY_ID[id] }))
  .filter((r) => r.p)
  .sort((a, b) => a.p.name.localeCompare(b.p.name))

export function Credits() {
  return (
    <Section title={tr('Créditos de fotos')} sub={tr('{n} fotografías de Wikimedia Commons y Wikipedia con licencia libre. Cada una enlaza a su página de origen.', { n: rows.length })}>
      <table className="gt credits">
        <thead><tr><th className="l">{tr('Jugador')}</th><th className="l">{tr('Autor')}</th><th className="l">{tr('Licencia')}</th><th className="l">{tr('Origen')}</th></tr></thead>
        <tbody>
          {rows.map(({ id, e, p }) => (
            <tr key={id}>
              <td className="l"><a href={`#/jugador/${id}`}>{p.name}</a></td>
              <td className="l">{e.author || '—'}</td>
              <td className="l">{e.license}</td>
              <td className="l"><a href={e.page} target="_blank" rel="noreferrer">{tr('Ver')}</a></td>
            </tr>
          ))}
        </tbody>
      </table>
    </Section>
  )
}
