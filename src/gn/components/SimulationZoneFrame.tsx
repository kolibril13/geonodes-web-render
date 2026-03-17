import type { NodeProps } from '@xyflow/react'
import type { SimulationZoneNodeData } from '../xyflow/mapGraphIRToFlow'

export function SimulationZoneFrame(props: NodeProps) {
  const data = props.data as SimulationZoneNodeData | undefined

  return (
    <div
      className="gn-sim-zone"
      style={{
        width: '100%',
        height: '100%',
        borderRadius: 10,
        border: '2px solid rgba(170, 90, 255, 0.75)',
        background: 'rgba(170, 90, 255, 0.10)',
        boxShadow: '0 0 0 1px rgba(30, 10, 50, 0.30) inset',
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          padding: '6px 10px',
          fontSize: 12,
          color: 'rgba(235, 220, 255, 0.95)',
          textShadow: '0 1px 0 rgba(0,0,0,0.35)',
          userSelect: 'none',
        }}
      >
        {data?.label ?? 'Simulation'}
      </div>
    </div>
  )
}

