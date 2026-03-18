import type { FloatCurvePoint } from './types'

type Vec2 = [number, number]

function len2(dx: number, dy: number): number {
  return Math.sqrt(dx * dx + dy * dy)
}

/**
 * Compute Bezier left/right handle positions for each control point.
 *
 * Blender's algorithm for AUTO handles: blend the normalized incoming and
 * outgoing tangent directions, then scale by 1/3 of the chord length to
 * the respective neighbor. AUTO_CLAMPED additionally clips the handles so
 * they cannot produce Y overshoot. VECTOR handles point directly at the
 * adjacent knot (linear segment on that side).
 *
 * After per-knot handle computation we apply a per-segment X-clamp so that
 * each handle's X stays within the X range of its segment. This prevents the
 * curve from looping back on itself (which would give multiple Y values for
 * the same X — invalid for a function curve).
 */
function computeHandles(pts: FloatCurvePoint[]): Array<{ left: Vec2; right: Vec2 }> {
  const n = pts.length
  const handles: Array<{ left: Vec2; right: Vec2 }> = pts.map(
    ({ location: [px, py], handleType }, i) => {
      const prev = i > 0 ? pts[i - 1].location : null
      const next = i < n - 1 ? pts[i + 1].location : null

      if (handleType === 'VECTOR') {
        const lh: Vec2 = prev ? [px + (prev[0] - px) / 3, py + (prev[1] - py) / 3] : [px, py]
        const rh: Vec2 = next ? [px + (next[0] - px) / 3, py + (next[1] - py) / 3] : [px, py]
        return { left: lh, right: rh }
      }

      // AUTO / AUTO_CLAMPED
      let tx = 0, ty = 0
      let lenLeft = 0, lenRight = 0

      if (prev && next) {
        const ldx = px - prev[0], ldy = py - prev[1]
        const rdx = next[0] - px, rdy = next[1] - py
        lenLeft  = len2(ldx, ldy)
        lenRight = len2(rdx, rdy)

        if (lenLeft > 1e-8 && lenRight > 1e-8) {
          const cx = ldx / lenLeft + rdx / lenRight
          const cy = ldy / lenLeft + rdy / lenRight
          const cl = len2(cx, cy)
          if (cl > 1e-8) { tx = cx / cl; ty = cy / cl }
        } else if (lenRight > 1e-8) {
          tx = (next[0] - px) / lenRight; ty = (next[1] - py) / lenRight
        } else if (lenLeft > 1e-8) {
          tx = (px - prev[0]) / lenLeft;  ty = (py - prev[1]) / lenLeft
        }
      } else if (next) {
        lenRight = len2(next[0] - px, next[1] - py)
        if (lenRight > 1e-8) { tx = (next[0] - px) / lenRight; ty = (next[1] - py) / lenRight }
      } else if (prev) {
        lenLeft = len2(px - prev[0], py - prev[1])
        if (lenLeft > 1e-8) { tx = (px - prev[0]) / lenLeft; ty = (py - prev[1]) / lenLeft }
      }

      let lh: Vec2 = [px - tx * lenLeft  / 3, py - ty * lenLeft  / 3]
      let rh: Vec2 = [px + tx * lenRight / 3, py + ty * lenRight / 3]

      if (handleType === 'AUTO_CLAMPED') {
        if (prev) {
          const minY = Math.min(prev[1], py), maxY = Math.max(prev[1], py)
          lh = [lh[0], Math.min(maxY, Math.max(minY, lh[1]))]
        }
        if (next) {
          const minY = Math.min(py, next[1]), maxY = Math.max(py, next[1])
          rh = [rh[0], Math.min(maxY, Math.max(minY, rh[1]))]
        }
      }

      return { left: lh, right: rh }
    },
  )

  // --- X-monotonicity clamp ---
  // For every segment [i, i+1], make sure neither handle's X crosses the
  // segment boundary.  If it does, scale the handle vector so the X just
  // touches the boundary while preserving the Y direction.
  for (let i = 0; i < n - 1; i++) {
    const [x0, y0] = pts[i].location
    const [x3, y3] = pts[i + 1].location
    const segW = x3 - x0   // guaranteed positive (Blender sorts points by X)

    if (segW < 1e-8) continue

    // Right handle of the left knot — must not exceed x3
    let [rx, ry] = handles[i].right
    if (rx > x3) {
      const t = (x3 - x0) / (rx - x0)
      handles[i] = { ...handles[i], right: [x3, y0 + (ry - y0) * t] }
    } else if (rx < x0) {
      handles[i] = { ...handles[i], right: [x0, y0] }
    }

    // Left handle of the right knot — must not go below x0
    let [lx, ly] = handles[i + 1].left
    if (lx < x0) {
      const t = (x0 - x3) / (lx - x3)
      handles[i + 1] = { ...handles[i + 1], left: [x0, y3 + (ly - y3) * t] }
    } else if (lx > x3) {
      handles[i + 1] = { ...handles[i + 1], left: [x3, y3] }
    }
  }

  return handles
}

export type CurvePathResult = {
  /** SVG 'd' attribute for the curve stroke */
  strokePath: string
  /** SVG 'd' attribute for the filled area (curve + baseline) */
  fillPath: string
  /** SVG 'd' attribute for the zero-line (y=0) */
  zeroLinePath: string
  /** mapped control-point positions in SVG space for dot rendering */
  dotPositions: Vec2[]
}

/**
 * Build SVG path strings for a float curve.
 *
 * @param pts          Ordered control points (sorted by X, as Blender stores them)
 * @param clipMinX/Y   Visible range in curve space
 * @param clipMaxX/Y
 * @param svgW/H       Output SVG canvas dimensions
 */
export function buildCurvePaths(
  pts: FloatCurvePoint[],
  clipMinX: number,
  clipMinY: number,
  clipMaxX: number,
  clipMaxY: number,
  svgW: number,
  svgH: number,
): CurvePathResult {
  const rangeX = clipMaxX - clipMinX || 1
  const rangeY = clipMaxY - clipMinY || 1

  const mapX = (x: number) => ((x - clipMinX) / rangeX) * svgW
  const mapY = (y: number) => (1 - (y - clipMinY) / rangeY) * svgH

  if (pts.length < 2) {
    return { strokePath: '', fillPath: '', zeroLinePath: '', dotPositions: [] }
  }

  const handles = computeHandles(pts)

  // Build the main curve path
  const [x0, y0] = pts[0].location
  let d = `M ${mapX(x0).toFixed(2)} ${mapY(y0).toFixed(2)}`

  for (let i = 0; i < pts.length - 1; i++) {
    const rh = handles[i].right
    const lh = handles[i + 1].left
    const [px, py] = pts[i + 1].location
    d += ` C ${mapX(rh[0]).toFixed(2)} ${mapY(rh[1]).toFixed(2)},`
    d +=   ` ${mapX(lh[0]).toFixed(2)} ${mapY(lh[1]).toFixed(2)},`
    d +=   ` ${mapX(px).toFixed(2)} ${mapY(py).toFixed(2)}`
  }

  const zeroY = mapY(0)
  const startX = mapX(x0)
  const endX   = mapX(pts[pts.length - 1].location[0])

  // Closed fill path: follow the curve then drop back along the zero line
  const fillPath =
    d +
    ` L ${endX.toFixed(2)} ${zeroY.toFixed(2)}` +
    ` L ${startX.toFixed(2)} ${zeroY.toFixed(2)}` +
    ' Z'

  const zeroLinePath =
    `M ${mapX(clipMinX).toFixed(2)} ${zeroY.toFixed(2)}` +
    ` L ${mapX(clipMaxX).toFixed(2)} ${zeroY.toFixed(2)}`

  const dotPositions: Vec2[] = pts.map(({ location: [x, y] }) => [mapX(x), mapY(y)])

  return { strokePath: d, fillPath, zeroLinePath, dotPositions }
}
