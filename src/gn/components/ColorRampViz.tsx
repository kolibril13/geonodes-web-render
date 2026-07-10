import type { ColorRampData } from '../ir/types'

// Faithful port of Blender's BKE_colorband_evaluate (colorband.cc): evaluates
// the ramp at t∈[0,1] in scene-linear RGBA, honoring color mode (RGB/HSV/HSL),
// hue interpolation direction, and the position interpolation type.

type RGB = [number, number, number]

function rgbToHsv([r, g, b]: RGB): RGB {
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const d = max - min
  let h = 0
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
    h /= 6
    if (h < 0) h += 1
  }
  const s = max === 0 ? 0 : d / max
  return [h, s, max]
}

function hsvToRgb([h, s, v]: RGB): RGB {
  if (s === 0) return [v, v, v]
  const i = Math.floor(h * 6)
  const f = h * 6 - i
  const p = v * (1 - s)
  const q = v * (1 - s * f)
  const t = v * (1 - s * (1 - f))
  switch (((i % 6) + 6) % 6) {
    case 0: return [v, t, p]
    case 1: return [q, v, p]
    case 2: return [p, v, t]
    case 3: return [p, q, v]
    case 4: return [t, p, v]
    default: return [v, p, q]
  }
}

function rgbToHsl([r, g, b]: RGB): RGB {
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  const d = max - min
  let h = 0
  let s = 0
  if (d !== 0) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    if (max === r) h = ((g - b) / d) % 6
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
    h /= 6
    if (h < 0) h += 1
  }
  return [h, s, l]
}

function hslToRgb([h, s, l]: RGB): RGB {
  if (s === 0) return [l, l, l]
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  const hue = (t: number) => {
    if (t < 0) t += 1
    if (t > 1) t -= 1
    if (t < 1 / 6) return p + (q - p) * 6 * t
    if (t < 1 / 2) return q
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
    return p
  }
  return [hue(h + 1 / 3), hue(h), hue(h - 1 / 3)]
}

const HUE_MOD = (h: number) => (h < 1 ? h : h - 1)

// Port of colorband_hue_interp. wRight/wLeft are the blend weights for the
// right/left stop hues (h1=right, h2=left), matching Blender's mfac/fac.
function hueInterp(
  hueIpo: string,
  wRight: number,
  wLeft: number,
  hRightIn: number,
  hLeftIn: number,
): number {
  const h1 = HUE_MOD(((hRightIn % 1) + 1) % 1)
  const h2 = HUE_MOD(((hLeftIn % 1) + 1) % 1)
  let mode = 0
  switch (hueIpo) {
    case 'NEAR':
      if (h1 < h2 && h2 - h1 > 0.5) mode = 1
      else if (h1 > h2 && h2 - h1 < -0.5) mode = 2
      break
    case 'FAR':
      if (h1 === h2) mode = 1
      else if (h1 < h2 && h2 - h1 < 0.5) mode = 1
      else if (h1 > h2 && h2 - h1 > -0.5) mode = 2
      break
    case 'CCW':
      if (h1 > h2) mode = 2
      break
    case 'CW':
      if (h1 < h2) mode = 1
      break
  }
  const interp = (a: number, b: number) => wRight * a + wLeft * b
  if (mode === 1) return HUE_MOD(interp(h1 + 1, h2))
  if (mode === 2) return HUE_MOD(interp(h1, h2 + 1))
  return interp(h1, h2)
}

/** Evaluate the ramp at t∈[0,1], returning scene-linear RGBA. */
function evalColorRamp(data: ColorRampData, t: number): [number, number, number, number] {
  const stops = [...data.stops].sort((a, b) => a.position - b.position)
  if (stops.length === 0) return [0, 0, 0, 1]
  if (stops.length === 1) return stops[0].color

  // HSV/HSL force linear position interpolation (Blender does the same).
  const ipo = data.colorMode === 'RGB' ? data.interpolation : 'LINEAR'

  if (t <= stops[0].position) return stops[0].color
  if (t >= stops[stops.length - 1].position) return stops[stops.length - 1].color

  let i = 0
  while (i < stops.length - 1 && stops[i + 1].position <= t) i++
  const left = stops[i]
  const right = stops[i + 1]
  if (ipo === 'CONSTANT') return left.color

  const span = right.position - left.position
  let localT = span === 0 ? 0 : (t - left.position) / span
  if (ipo === 'EASE') localT = 3 * localT * localT - 2 * localT * localT * localT

  const wRight = localT
  const wLeft = 1 - localT
  const a = wLeft * left.color[3] + wRight * right.color[3]

  if (data.colorMode === 'HSV' || data.colorMode === 'HSL') {
    const toX = data.colorMode === 'HSV' ? rgbToHsv : rgbToHsl
    const fromX = data.colorMode === 'HSV' ? hsvToRgb : hslToRgb
    const cl = toX([left.color[0], left.color[1], left.color[2]])
    const cr = toX([right.color[0], right.color[1], right.color[2]])
    const h = hueInterp(data.hueInterpolation, wRight, wLeft, cr[0], cl[0])
    const s = wLeft * cl[1] + wRight * cr[1]
    const v = wLeft * cl[2] + wRight * cr[2]
    const [r, g, b] = fromX([h, s, v])
    return [r, g, b, a]
  }

  return [
    wLeft * left.color[0] + wRight * right.color[0],
    wLeft * left.color[1] + wRight * right.color[1],
    wLeft * left.color[2] + wRight * right.color[2],
    a,
  ]
}

// Scene-linear → sRGB for display, matching Blender's default view transform's
// gamma (the node UI draws ramp colors through the display transform).
function linearToSrgb(c: number): number {
  const x = Math.min(1, Math.max(0, c))
  return x <= 0.0031308 ? x * 12.92 : 1.055 * Math.pow(x, 1 / 2.4) - 0.055
}

function cssColor([r, g, b, a]: [number, number, number, number]): string {
  const to255 = (c: number) => Math.round(linearToSrgb(c) * 255)
  return `rgba(${to255(r)}, ${to255(g)}, ${to255(b)}, ${a.toFixed(3)})`
}

const HUE_IPO_LABEL: Record<string, string> = {
  NEAR: 'Near',
  FAR: 'Far',
  CW: 'CW',
  CCW: 'CCW',
}

const SAMPLES = 64

export function ColorRampViz({ data, width }: { data: ColorRampData; width: number }) {
  // Sample the ramp into a left-to-right gradient.
  const gradientStops: string[] = []
  for (let i = 0; i <= SAMPLES; i++) {
    const t = i / SAMPLES
    gradientStops.push(`${cssColor(evalColorRamp(data, t))} ${(t * 100).toFixed(1)}%`)
  }
  const gradient = `linear-gradient(to right, ${gradientStops.join(', ')})`
  const stops = [...data.stops].sort((a, b) => a.position - b.position)
  // The active element isn't exported; mirror Blender's default of the last stop.
  const active = stops[stops.length - 1]

  return (
    <div className="gn-color-ramp" style={{ width }}>
      <div className="gn-color-ramp__row">
        <span className="gn-color-ramp__select">{data.colorMode}</span>
        <span className="gn-color-ramp__select">
          {HUE_IPO_LABEL[data.hueInterpolation] ?? data.hueInterpolation}
        </span>
      </div>
      <div className="gn-color-ramp__bar-wrap">
        <div
          className="gn-color-ramp__checker"
          style={{ backgroundImage: gradient }}
        />
        {stops.map((s, i) => (
          <span
            key={i}
            className={`gn-color-ramp__stop${s === active ? ' is-active' : ''}`}
            style={{ left: `${s.position * 100}%` }}
          />
        ))}
      </div>
      {active && (
        <div className="gn-color-ramp__row gn-color-ramp__active">
          <span className="gn-color-ramp__pos">
            Pos {active.position.toFixed(3)}
          </span>
          <span
            className="gn-color-ramp__swatch"
            style={{ background: cssColor(active.color) }}
          />
        </div>
      )}
    </div>
  )
}
