export function SimulationZoneFrame() {
  // Blender draws the zone as a plain rounded rectangle with no inner label —
  // the boundary Simulation Input/Output nodes carry the naming.
  return (
    <div
      className="gn-sim-zone"
      style={{
        width: '100%',
        height: '100%',
        borderRadius: 10,
        // Blender's default theme `node_zone_simulation` = 0x66416233, i.e.
        // #664162 (RGB 102,65,98) at alpha 0.2 — a muted plum. Fill uses the
        // exact theme value; the border is the same hue, emphasized for legibility.
        border: '1.5px solid rgba(102, 65, 98, 0.85)',
        background: 'rgba(102, 65, 98, 0.2)',
        pointerEvents: 'none',
      }}
    />
  )
}

