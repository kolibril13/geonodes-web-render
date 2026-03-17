import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { GNFlowNodeData } from '../xyflow/mapGraphIRToFlow'

function socketShapeClass(displayShape: GNFlowNodeData['inputs'][number]['displayShape']) {
  switch (displayShape) {
    case 'LINE':
      return 'gn-socket--line'
    case 'DIAMOND':
      return 'gn-socket--diamond'
    case 'LIST':
      return 'gn-socket--list'
    case 'VOLUME_GRID':
      return 'gn-socket--grid'
    case 'CIRCLE':
    default:
      return 'gn-socket--circle'
  }
}

function SocketRow(props: {
  socketId: string
  label: string
  displayShape: GNFlowNodeData['inputs'][number]['displayShape']
  position: Position.Left | Position.Right
  type: 'source' | 'target'
  align: 'left' | 'right'
}) {
  const { socketId, label, displayShape, position, type, align } = props
  const isBlank = label.trim().length === 0

  return (
    <div className={`gn-node__socket-row gn-node__socket-row--${align}`}>
      <Handle
        id={socketId}
        type={type}
        position={position}
        className={`gn-socket ${socketShapeClass(displayShape)}`}
        style={{ top: '50%' }}
      />
      {!isBlank ? <span className="gn-node__socket-label">{label}</span> : null}
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
      </div>

      <div className="gn-node__body">
        {rows.map((row, index) => (
          <div key={index} className="gn-node__row">
            <div className="gn-node__column">
              {row.input ? (
                <SocketRow
                  socketId={row.input.id}
                  label={row.input.name}
                  displayShape={row.input.displayShape}
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
                  displayShape={row.output.displayShape}
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
