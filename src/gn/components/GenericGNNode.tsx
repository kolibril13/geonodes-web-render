import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { GNFlowNodeData } from '../xyflow/mapGraphIRToFlow'

function SocketRow(props: {
  socketId: string
  label: string
  position: Position.Left | Position.Right
  type: 'source' | 'target'
  align: 'left' | 'right'
}) {
  const { socketId, label, position, type, align } = props

  return (
    <div className={`gn-node__socket-row gn-node__socket-row--${align}`}>
      <Handle id={socketId} type={type} position={position} style={{ top: '50%' }} />
      <span className="gn-node__socket-label">{label}</span>
    </div>
  )
}

export function GenericGNNode(props: NodeProps) {
  const data = props.data as GNFlowNodeData
  const rowCount = Math.max(data.inputs.length, data.outputs.length)
  const rows = Array.from({ length: rowCount }, (_, index) => ({
    input: data.inputs[index] ?? null,
    output: data.outputs[index] ?? null,
  }))

  return (
    <div className="gn-node">
      <div className="gn-node__header">
        <div className="gn-node__title">{data.label}</div>
        <div className="gn-node__type">{data.type}</div>
      </div>

      <div className="gn-node__body">
        {rows.map((row, index) => (
          <div key={index} className="gn-node__row">
            <div className="gn-node__column">
              {row.input ? (
                <SocketRow
                  socketId={row.input.id}
                  label={row.input.name}
                  position={Position.Left}
                  type="target"
                  align="left"
                />
              ) : null}
            </div>

            <div className="gn-node__column gn-node__column--right">
              {row.output ? (
                <SocketRow
                  socketId={row.output.id}
                  label={row.output.name}
                  position={Position.Right}
                  type="source"
                  align="right"
                />
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
