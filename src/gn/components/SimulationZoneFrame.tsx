import type { NodeProps } from '@xyflow/react'
import type { SimulationZoneNodeData, ZoneKind } from '../xyflow/mapGraphIRToFlow'

// Blender's default theme zone colors (userdef_default_theme.c), stored as
// 0xRRGGBBAA with alpha 0x33 (0.2): node_zone_simulation 0x66416233,
// node_zone_repeat 0x76512f33, node_zone_foreach_geometry_element 0x33527f33,
// node_zone_closure 0x7d7d3a33.
const ZONE_RGB: Record<ZoneKind, string> = {
  simulation: '102, 65, 98',
  repeat:     '118, 81, 47',
  foreach:    '51, 82, 127',
  closure:    '125, 125, 58',
}

export function SimulationZoneFrame(props: NodeProps) {
  const kind = (props.data as SimulationZoneNodeData).kind ?? 'simulation'
  const rgb = ZONE_RGB[kind] ?? ZONE_RGB.simulation
  // Blender draws the zone as a plain rounded rectangle with no inner label —
  // the boundary zone input/output nodes carry the naming. Fill uses the exact
  // theme value; the border is the same hue, emphasized for legibility.
  return (
    <div
      className="gn-sim-zone"
      style={{
        width: '100%',
        height: '100%',
        borderRadius: 10,
        border: `1.5px solid rgba(${rgb}, 0.85)`,
        background: `rgba(${rgb}, 0.2)`,
        pointerEvents: 'none',
      }}
    />
  )
}
