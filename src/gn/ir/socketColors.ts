// Socket colors sourced directly from Blender's std_node_socket_colors table in
// source/blender/editors/space_node/drawnode.cc.
// These are display-space (theme) values: Blender draws them straight to the
// framebuffer without a colour transform, so we map them directly to 8-bit
// (×255). Verified against screen captures: GEOMETRY (0,0.84,0.64) renders as
// (0,214,163) and FLOAT (0.63) as ~(160,160,160), matching the direct mapping —
// an extra linear→sRGB step would make every socket too bright.

function toHex(r: number, g: number, b: number): string {
  const ch = (v: number) =>
    Math.round(Math.min(1, Math.max(0, v)) * 255)
      .toString(16)
      .padStart(2, '0')
  return `#${ch(r)}${ch(g)}${ch(b)}`
}

// Maps the JSON `type` string to an sRGB hex color. Type strings come from
// Blender's runtime socket enum (e.g. "VALUE", "VECTOR", "GEOMETRY") — note the
// runtime name for a float socket is "VALUE", not "FLOAT".
export const SOCKET_COLORS: Record<string, string> = {
  FLOAT:      toHex(0.63, 0.63, 0.63), // grey
  VALUE:      toHex(0.63, 0.63, 0.63), // grey (runtime alias for FLOAT)
  VECTOR:     toHex(0.39, 0.39, 0.78), // blue-purple
  RGBA:       toHex(0.78, 0.78, 0.16), // yellow
  SHADER:     toHex(0.39, 0.78, 0.39), // green
  BOOLEAN:    toHex(0.80, 0.65, 0.84), // light purple
  INT:        toHex(0.35, 0.55, 0.36), // dark green
  STRING:     toHex(0.44, 0.70, 1.00), // light blue
  OBJECT:     toHex(0.93, 0.62, 0.36), // orange
  IMAGE:      toHex(0.39, 0.22, 0.39), // dark purple
  GEOMETRY:   toHex(0.00, 0.84, 0.64), // teal
  COLLECTION: toHex(0.96, 0.96, 0.96), // near-white
  TEXTURE:    toHex(0.62, 0.31, 0.64), // purple
  MATERIAL:   toHex(0.92, 0.46, 0.51), // pink
  ROTATION:   toHex(0.65, 0.39, 0.78), // violet
  MENU:       toHex(0.40, 0.40, 0.40), // mid grey
  MATRIX:     toHex(0.72, 0.20, 0.52), // magenta
  BUNDLE:     toHex(0.30, 0.50, 0.50), // teal-grey
  CLOSURE:    toHex(0.49, 0.49, 0.23), // olive
  INT_VECTOR: toHex(0.36, 0.47, 0.61), // slate blue
  CUSTOM:     toHex(0.20, 0.20, 0.20), // dark grey fallback
}

export function socketColor(dataType: string): string {
  return SOCKET_COLORS[dataType] ?? SOCKET_COLORS.CUSTOM
}
