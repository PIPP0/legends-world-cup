// Imagen para redes sociales con el once del jugador: se dibuja en el navegador (canvas), sin servidores. Un tamaño por red.
import { PLAYER_BY_ID, TEAM_BY_ID } from '../data/lookup'
import { FORMACIONES, paisesConSinergia, valorEquipo, type Equipo } from '../engine/duelo'
import { photoOf } from '../ui/common'
import { tr } from '../i18n'

export interface Formato { id: 'historia' | 'publicacion' | 'x' | 'cuadrado'; w: number; h: number; redes: string }
export const FORMATOS: Formato[] = [
  { id: 'historia', w: 1080, h: 1920, redes: 'Instagram · TikTok · WhatsApp' },
  { id: 'publicacion', w: 1080, h: 1350, redes: 'Instagram · Facebook' },
  { id: 'x', w: 1600, h: 900, redes: 'X · LinkedIn · Facebook' },
  { id: 'cuadrado', w: 1080, h: 1080, redes: 'WhatsApp · Threads' },
]
const CIAN = '#00e5ff', ROSA = '#ff2e88', ORO = '#ffd54a'
const COLOR_LINEA: Record<string, string> = { GK: '#ffd54a', DEF: '#4aa3ff', MID: '#ffffff', ATT: '#ff2e88' }

const cargar = (url: string): Promise<HTMLImageElement | null> => new Promise((ok) => { const i = new Image(); i.crossOrigin = 'anonymous'; i.onload = () => ok(i); i.onerror = () => ok(null); i.src = url })
const apellido = (n: string) => n.split(' ').slice(-1)[0]
const iniciales = (n: string) => n.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase()

function rr(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) { c.beginPath(); c.roundRect(x, y, w, h, r) }

export async function dibujarEquipo(equipo: Equipo, f: Formato): Promise<HTMLCanvasElement> {
  try { await Promise.all([document.fonts.load("800 80px 'Barlow Condensed'"), document.fonts.load("700 30px Inter")]) } catch { /* sigue con la tipografía del sistema */ }
  const { w: W, h: H } = f
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H
  const c = cv.getContext('2d')!
  const horizontal = W > H * 1.2
  const ids = [...equipo.once, ...equipo.suplentes]
  // imágenes: fotos de los 14 y banderas
  const fotos: Record<string, HTMLImageElement | null> = {}
  await Promise.all(ids.map(async (id) => { const ph = photoOf(PLAYER_BY_ID[id]); fotos[id] = ph ? await cargar(ph.url) : null }))
  const banderas: Record<string, HTMLImageElement | null> = {}
  await Promise.all([...new Set(ids.map((id) => PLAYER_BY_ID[id].teamId))].map(async (t) => { banderas[t] = await cargar(`https://flagcdn.com/w80/${TEAM_BY_ID[t].iso}.png`) }))

  // fondo: azul noche con brillos celeste y rosa y rayas diagonales
  const g = c.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#060b24'); g.addColorStop(1, '#0b1236'); c.fillStyle = g; c.fillRect(0, 0, W, H)
  const glow = (x: number, y: number, r: number, col: string) => { const rg = c.createRadialGradient(x, y, 0, x, y, r); rg.addColorStop(0, col); rg.addColorStop(1, 'transparent'); c.fillStyle = rg; c.fillRect(0, 0, W, H) }
  glow(W * 0.85, H * 0.1, Math.max(W, H) * 0.6, 'rgba(0,229,255,.28)'); glow(W * 0.05, H * 0.95, Math.max(W, H) * 0.55, 'rgba(255,46,136,.30)')
  c.save(); c.strokeStyle = 'rgba(255,255,255,.035)'; c.lineWidth = 3
  for (let x = -H; x < W + H; x += 46) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x + H * 0.5, H); c.stroke() }
  c.restore()

  const pad = W * (horizontal ? 0.04 : 0.07)
  // zonas
  let pitch = { x: 0, y: 0, w: 0, h: 0 }
  let bench = { cx: 0, cy: 0, r: 0 }
  let texto = { x: pad, y: pad, w: W - pad * 2 }
  if (horizontal) {
    pitch.h = H * 0.86; pitch.w = pitch.h / 1.18; pitch.x = W - pad - pitch.w; pitch.y = (H - pitch.h) / 2
    texto = { x: pad, y: pad, w: W - pad * 2 - pitch.w - pad }
    bench = { cx: texto.x + texto.w / 2, cy: H * 0.66, r: H * 0.075 }
  } else {
    const headH = H * (f.id === 'historia' ? 0.15 : 0.17), footH = H * 0.07, benchH = H * (f.id === 'historia' ? 0.12 : 0.14)
    const libre = H - headH - footH - benchH - pad
    pitch.w = Math.min(W - pad * 2, libre / 1.18); pitch.h = pitch.w * 1.18; pitch.x = (W - pitch.w) / 2; pitch.y = headH + (libre - pitch.h) / 2
    bench = { cx: W / 2, cy: pitch.y + pitch.h + benchH * 0.52, r: Math.min(benchH * 0.34, pitch.w * 0.075) }
    texto = { x: pad, y: pad * 0.9, w: W - pad * 2 }
  }

  // título
  c.textBaseline = 'alphabetic'
  const fuente = (tam: number, peso = 800, fam = "'Barlow Condensed', 'Arial Narrow', sans-serif") => `${peso} ${tam}px ${fam}`
  const tamTitulo = horizontal ? H * 0.17 : Math.min(W * 0.115, 140)
  c.fillStyle = CIAN; c.font = fuente(tamTitulo * 0.26, 800); c.fillText('LEGENDS WORLD CUP', texto.x, texto.y + tamTitulo * 0.32)
  c.fillStyle = '#fff'; c.font = `italic ${fuente(tamTitulo, 800)}`
  const titulo = tr('Mi Once Ideal').toUpperCase()
  c.fillText(titulo, texto.x, texto.y + tamTitulo * 1.25, texto.w)
  const val = valorEquipo(equipo), sin = paisesConSinergia(ids)
  const linea2 = horizontal ? texto.y + tamTitulo * 1.25 + H * 0.08 : texto.y + tamTitulo * 1.25 + tamTitulo * 0.38
  if (!horizontal) {
    c.fillStyle = '#b9c4e6'; c.font = fuente(tamTitulo * 0.3, 700, 'Inter, sans-serif')
    c.fillText(`${equipo.formacion}  ·  ${tr('Valoración media')} ${val}`, texto.x, linea2)
  } else {
    // panel de datos a la izquierda
    c.fillStyle = '#b9c4e6'; c.font = fuente(H * 0.034, 700, 'Inter, sans-serif'); c.fillText(equipo.formacion, texto.x, linea2)
    c.fillStyle = ORO; c.font = fuente(H * 0.3, 800); c.fillText(String(val), texto.x, linea2 + H * 0.3)
    c.fillStyle = '#b9c4e6'; c.font = fuente(H * 0.036, 700, 'Inter, sans-serif'); c.fillText(tr('Valoración media'), texto.x + (String(val).length * H * 0.15) + H * 0.025, linea2 + H * 0.3 - H * 0.02)
    if (sin.length) {
      c.fillStyle = CIAN; c.font = fuente(H * 0.034, 700, 'Inter, sans-serif')
      c.fillText(`${tr('Sinergias')}: ${sin.map((s) => `${TEAM_BY_ID[s.teamId].name} +${s.bonus}`).join(' · ')}`.slice(0, 46), texto.x, linea2 + H * 0.3 + H * 0.06)
    }
  }

  // cancha
  c.save(); rr(c, pitch.x, pitch.y, pitch.w, pitch.h, pitch.w * 0.04); c.clip()
  const gp = c.createLinearGradient(0, pitch.y, 0, pitch.y + pitch.h); gp.addColorStop(0, '#1f5230'); gp.addColorStop(0.5, '#17441f'); gp.addColorStop(1, '#0f3017'); c.fillStyle = gp; c.fillRect(pitch.x, pitch.y, pitch.w, pitch.h)
  for (let i = 0; i < 8; i++) { c.fillStyle = 'rgba(255,255,255,.04)'; c.fillRect(pitch.x, pitch.y + (i * pitch.h) / 8, pitch.w, pitch.h / 16) }
  c.strokeStyle = 'rgba(255,255,255,.5)'; c.lineWidth = Math.max(2, pitch.w * 0.004)
  const px = (v: number) => pitch.x + (v / 100) * pitch.w, py = (v: number) => pitch.y + (v / 118) * pitch.h
  c.strokeRect(px(3), py(3), px(97) - px(3), py(115) - py(3)); c.beginPath(); c.moveTo(px(3), py(59)); c.lineTo(px(97), py(59)); c.stroke()
  c.beginPath(); c.arc(px(50), py(59), pitch.w * 0.1, 0, Math.PI * 2); c.stroke(); c.strokeRect(px(24), py(3), px(76) - px(24), py(19) - py(3)); c.strokeRect(px(24), py(99), px(76) - px(24), py(115) - py(99))
  c.restore()
  c.strokeStyle = 'rgba(0,229,255,.45)'; c.lineWidth = 3; rr(c, pitch.x, pitch.y, pitch.w, pitch.h, pitch.w * 0.04); c.stroke()

  const jugador = (id: string, cx: number, cy: number, r: number, mostrarNombre = true) => {
    const p = PLAYER_BY_ID[id]
    c.save(); c.shadowColor = 'rgba(0,0,0,.55)'; c.shadowBlur = r * 0.5; c.beginPath(); c.arc(cx, cy, r + 4, 0, Math.PI * 2); c.fillStyle = COLOR_LINEA[p.line] ?? '#fff'; c.fill(); c.restore()
    c.save(); c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.clip(); c.fillStyle = '#12233a'; c.fillRect(cx - r, cy - r, r * 2, r * 2)
    const im = fotos[id]
    if (im) { const s = Math.max((r * 2) / im.width, (r * 2) / im.height); const iw = im.width * s, ih = im.height * s; c.drawImage(im, cx - iw / 2, cy - r, iw, ih) }
    else { c.fillStyle = CIAN; c.font = fuente(r * 0.9, 800); c.textAlign = 'center'; c.fillText(iniciales(p.name), cx, cy + r * 0.3); c.textAlign = 'left' }
    c.restore()
    const bw = r * 0.95, bh = r * 0.55; c.fillStyle = '#050a1c'; rr(c, cx + r * 0.25, cy + r * 0.45, bw, bh, bh / 2.2); c.fill(); c.strokeStyle = CIAN; c.lineWidth = 2; c.stroke()
    c.fillStyle = CIAN; c.font = fuente(bh * 0.82, 800); c.textAlign = 'center'; c.fillText(String(p.ovr), cx + r * 0.25 + bw / 2, cy + r * 0.45 + bh * 0.78)
    const ban = banderas[p.teamId]; if (ban) { const bwd = r * 0.55, bhd = bwd * (ban.height / ban.width); c.save(); rr(c, cx - r * 1.0, cy + r * 0.5, bwd, bhd, 3); c.clip(); c.drawImage(ban, cx - r * 1.0, cy + r * 0.5, bwd, bhd); c.restore() }
    if (mostrarNombre) {
      const nm = apellido(p.name).toUpperCase(); c.font = fuente(r * 0.52, 800, "Inter, sans-serif"); const tw = c.measureText(nm).width + r * 0.5
      c.fillStyle = 'rgba(0,0,0,.72)'; rr(c, cx - tw / 2, cy + r * 1.12, tw, r * 0.66, r * 0.33); c.fill(); c.fillStyle = '#fff'; c.fillText(nm, cx, cy + r * 1.12 + r * 0.48)
    }
    c.textAlign = 'left'
  }
  const rJug = pitch.w * 0.062
  FORMACIONES[equipo.formacion].forEach((h, i) => jugador(equipo.once[i], px(h.x), pitch.y + ((8 + (h.y / 100) * 104) / 118) * pitch.h, rJug))

  // banca
  c.fillStyle = '#b9c4e6'; c.font = fuente(bench.r * 0.42, 800); c.textAlign = 'center'
  c.fillText(tr('Suplentes').toUpperCase(), bench.cx, bench.cy - bench.r * 1.3)
  const sep = bench.r * 2.9
  equipo.suplentes.forEach((id, n) => jugador(id, bench.cx + (n - 1) * sep, bench.cy, bench.r))
  c.textAlign = 'left'

  // pie: invitación y dirección
  const yUrl = horizontal ? H - pad * 1.1 : H - H * 0.022
  const yCta = horizontal ? yUrl - H * 0.075 : yUrl - H * 0.036
  const tamCta = horizontal ? H * 0.05 : W * 0.052
  c.fillStyle = ORO; c.font = fuente(tamCta, 800); c.fillText(tr('¿Puedes superar mi equipo?').toUpperCase(), texto.x, yCta, texto.w)
  c.fillStyle = '#fff'; c.font = fuente(horizontal ? H * 0.045 : W * 0.04, 700, 'Inter, sans-serif'); c.fillText('impossiblecup.com', texto.x, yUrl)
  // banda de color
  const bg = c.createLinearGradient(0, 0, W, 0); bg.addColorStop(0, ROSA); bg.addColorStop(1, CIAN); c.fillStyle = bg; c.fillRect(0, 0, W, Math.max(8, H * 0.006))
  return cv
}

export const aBlob = (cv: HTMLCanvasElement) => new Promise<Blob | null>((ok) => cv.toBlob(ok, 'image/png'))
