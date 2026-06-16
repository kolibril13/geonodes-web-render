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
        // Blender's simulation-zone theme: a desaturated maroon/plum, not the
        // bright purple we had. Fill ≈ (43,32,39) over the dark canvas; border
        // is a muted plum (≈ #5e4259).
        border: '1.5px solid rgba(150, 104, 140, 0.5)',
        background: 'rgba(124, 58, 96, 0.16)',
        pointerEvents: 'none',
      }}
    />
  )
}

