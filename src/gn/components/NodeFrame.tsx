import type { NodeProps } from '@xyflow/react'
import type { NodeFrameData } from '../xyflow/mapGraphIRToFlow'

// Background for a Blender NodeFrame: a subtle rounded panel that sits behind
// the nodes it groups, with the frame label centered at the top.
export function NodeFrame(props: NodeProps) {
  const data = props.data as NodeFrameData | undefined

  return (
    <div
      className="gn-node-frame"
      style={{
        width: '100%',
        height: '100%',
        borderRadius: 10,
        border: '1px solid rgba(255, 255, 255, 0.09)',
        background: 'rgba(255, 255, 255, 0.035)',
        pointerEvents: 'none',
      }}
    >
      {data?.label ? (
        <div
          style={{
            textAlign: 'center',
            padding: '10px 12px',
            fontSize: 15,
            fontWeight: 500,
            color: 'rgba(235, 235, 235, 0.6)',
            userSelect: 'none',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {data.label}
        </div>
      ) : null}
    </div>
  )
}
