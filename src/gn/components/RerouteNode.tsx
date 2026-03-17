import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { GNRerouteNodeData } from '../xyflow/mapGraphIRToFlow'

export function RerouteNode(props: NodeProps) {
  const data = props.data as GNRerouteNodeData

  return (
    <div
      className="gn-reroute"
      style={{ '--gn-reroute-color': data.color } as React.CSSProperties}
    >
      <Handle
        id={data.inputSocketId}
        type="target"
        position={Position.Left}
        className="gn-reroute__handle"
      />
      <Handle
        id={data.outputSocketId}
        type="source"
        position={Position.Right}
        className="gn-reroute__handle"
      />
    </div>
  )
}
