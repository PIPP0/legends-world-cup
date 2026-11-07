// Descarga una sola vez las fotos de licencia libre de cada jugador y las guarda en public/photos.
// Fuentes: 1) imagen principal de Wikipedia (solo libres)  2) imagen P18 de Wikidata en Wikimedia Commons.
// Seguridad contra fotos equivocadas: el título/etiqueta debe tener EXACTAMENTE las mismas palabras que el nombre
// y la descripción debe decir que es futbolista. Wikidata solo se usa para nombres de 2+ palabras.
// Uso: npx tsx scripts/fetch-photos.ts [--resume]
import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { PLAYERS } from '../src/data/index'
import { WIKI_TITLE_HINTS } from '../src/data/raw'

const UA = 'LegendsWorldCup/0.1 (fan project; github.com/PIPP0/legends-world-cup)'
const OUT = 'public/photos'
const JSON_OUT = 'src/data/photos.json'
mkdirSync(OUT, { recursive: true })

type Entry = { file: string; page: string; title: string; license: string; author: string }
const result: Record<string, Entry> = existsSync(JSON_OUT) && process.argv.includes('--resume') ? JSON.parse(readFileSync(JSON_OUT, 'utf8')) : {}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const words = (s: string) => norm(s.replace(/\(.*\)/, '')).split(/[\s\-.]+/).filter((t) => t.length > 1).sort().join(' ')
const footballer = /(footballer|soccer (player|manager)|football (player|manager|coach)|association football)/i

let last = 0
async function get(url: string, tries = 8): Promise<Response> {
  for (let k = 0; k < tries; k++) {
    const wait = Math.max(0, last + 1100 - Date.now()) // máx. ~1 petición por segundo
    if (wait) await sleep(wait)
    last = Date.now()
    const r = await fetch(url, { headers: { 'User-Agent': UA } })
    if (r.status === 429 || r.status >= 500) {
      const ra = Number(r.headers.get('retry-after')) || 5 * (k + 1)
      await sleep((ra + 2) * 1000)
      last = Date.now()
      continue
    }
    return r
  }
  throw new Error('demasiados reintentos: ' + url)
}
const api = async (host: string, params: Record<string, string>) => {
  const u = new URL(`https://${host}/w/api.php`)
  u.search = new URLSearchParams({ format: 'json', ...params }).toString()
  return (await get(u.toString())).json() as Promise<any>
}

async function fromWikipedia(name: string) {
  const hint = WIKI_TITLE_HINTS[name]
  const j = await api('en.wikipedia.org', {
    action: 'query', generator: 'search', gsrlimit: '5', gsrsearch: (hint ?? name) + ' footballer',
    prop: 'pageimages|description', piprop: 'thumbnail|name', pithumbsize: '420', pilicense: 'free',
  })
  const pages = (Object.values(j?.query?.pages ?? {}) as any[]).sort((a, b) => a.index - b.index)
  const exp = words(hint ?? name)
  const hit = pages.find((p) => p.thumbnail && footballer.test(p.description ?? '') && words(p.title) === exp)
  if (!hit) return null
  return { url: hit.thumbnail.source as string, page: 'https://en.wikipedia.org/wiki/' + encodeURIComponent(hit.title.replace(/ /g, '_')), title: hit.title as string, file: hit.pageimage as string | undefined }
}

async function fromWikidata(name: string) {
  if (name.trim().split(/\s+/).length < 2) return null
  const s = await api('www.wikidata.org', { action: 'wbsearchentities', search: name, language: 'en', type: 'item', limit: '6' })
  const exp = words(name)
  const cand = (s.search ?? []).find((e: any) => words(e.label ?? '') === exp && footballer.test(e.description ?? ''))
  if (!cand) return null
  const e = await api('www.wikidata.org', { action: 'wbgetentities', ids: cand.id, props: 'claims' })
  const fileName: string | undefined = e?.entities?.[cand.id]?.claims?.P18?.[0]?.mainsnak?.datavalue?.value
  if (!fileName) return null
  const c = await api('commons.wikimedia.org', {
    action: 'query', titles: 'File:' + fileName, prop: 'imageinfo', iiprop: 'url|extmetadata', iiurlwidth: '420',
  })
  const info = (Object.values(c?.query?.pages ?? {}) as any[])[0]?.imageinfo?.[0]
  if (!info?.thumburl) return null
  const lic: string = info.extmetadata?.LicenseShortName?.value ?? ''
  if (!lic || /fair use|non-free/i.test(lic)) return null
  return {
    url: info.thumburl as string, page: info.descriptionurl as string, title: 'File:' + fileName, license: lic,
    author: String(info.extmetadata?.Artist?.value ?? '').replace(/<[^>]*>/g, '').trim().slice(0, 120),
  }
}

async function wpLicense(title: string, file?: string) {
  if (!file) return { license: 'Licencia libre (Wikipedia)', author: '' }
  const c = await api('commons.wikimedia.org', { action: 'query', titles: 'File:' + file, prop: 'imageinfo', iiprop: 'extmetadata' })
  const m = (Object.values(c?.query?.pages ?? {}) as any[])[0]?.imageinfo?.[0]?.extmetadata
  return { license: m?.LicenseShortName?.value ?? 'Licencia libre', author: String(m?.Artist?.value ?? '').replace(/<[^>]*>/g, '').trim().slice(0, 120) }
}

let done = 0
for (const p of PLAYERS) {
  done++
  if (result[p.id]) continue
  try {
    let src: { url: string; page: string; title: string; license?: string; author?: string; file?: string } | null = await fromWikipedia(p.name)
    if (src && !src.license) Object.assign(src, await wpLicense(src.title, src.file))
    if (!src) { src = await fromWikidata(p.name) }
    if (!src) { console.log(`${done}/${PLAYERS.length} SIN FOTO  ${p.name}`); continue }
    const img = await get(src.url)
    if (!img.ok) { console.log(`${done} ERROR imagen ${p.name} ${img.status}`); continue }
    const buf = Buffer.from(await img.arrayBuffer())
    const ext = (img.headers.get('content-type') ?? '').includes('png') ? 'png' : 'jpg'
    const file = `photos/${p.id}.${ext}`
    writeFileSync(`public/${file}`, buf)
    result[p.id] = { file, page: src.page, title: src.title, license: src.license ?? 'Licencia libre', author: src.author ?? '' }
    console.log(`${done}/${PLAYERS.length} OK  ${p.name}  <-  ${src.title}`)
  } catch (err) {
    console.log(`${done} FALLO ${p.name}: ${(err as Error).message}`)
  }
  writeFileSync(JSON_OUT, JSON.stringify(result, null, 1))
}
writeFileSync(JSON_OUT, JSON.stringify(result, null, 1))
console.log(`\nListo: ${Object.keys(result).length} de ${PLAYERS.length} con foto.`)
