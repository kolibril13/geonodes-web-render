import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { GNFlowNodeData } from '../xyflow/mapGraphIRToFlow'

const VEC_LABELS = ['X', 'Y', 'Z', 'W']

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

function formatNumber(value: number): string {
  return parseFloat(value.toFixed(3)).toString()
}

function formatScalar(value: number | boolean | string): string {
  if (typeof value === 'boolean') return value ? 'True' : 'False'
  if (typeof value === 'string') return value
  return `${formatNumber(value)} m`
}

function VecBlock(props: { values: number[] }) {
  return (
    <div className="gn-node__vec-block">
      {props.values.slice(0, 4).map((v, i) => (
        <div key={i} className="gn-node__vec-row">
          <span className="gn-node__vec-label">{VEC_LABELS[i]}</span>
          <span className="gn-node__vec-value">{formatNumber(v)} m</span>
        </div>
      ))}
    </div>
  )
}

type SocketData = GNFlowNodeData['inputs'][number]

function SocketLine(props: {
  socket: SocketData
  position: Position.Left | Position.Right
  type: 'source' | 'target'
  align: 'left' | 'right'
}) {
  const { socket, position, type, align } = props
  const isBlank = socket.name.trim().length === 0
  const showScalar =
    align === 'left' &&
    !socket.hideValue &&
    socket.defaultValue?.kind === 'scalar'

  return (
    <div className={`gn-node__socket-row gn-node__socket-row--${align}`}>
      <Handle
        id={socket.id}
        type={type}
        position={position}
        className={`gn-socket ${socketShapeClass(socket.displayShape)}`}
        style={{
          top: '50%',
          background: socket.color,
          borderColor: `color-mix(in srgb, ${socket.color} 60%, #000)`,
        }}
      />
      {!isBlank ? <span className="gn-node__socket-label">{socket.name}</span> : null}
      {showScalar && socket.defaultValue?.kind === 'scalar' ? (
        <span className="gn-node__value">{formatScalar(socket.defaultValue.value)}</span>
      ) : null}
    </div>
  )
}

export function GenericGNNode(props: NodeProps) {
  const data = props.data as GNFlowNodeData
  const rowCount = Math.max(data.inputs.length, data.outputs.length)
  const rows = Array.from({ length: rowCount }, (_, i) => ({
    input: data.inputs[i] ?? null,
    output: data.outputs[i] ?? null,
  }))

  return (
    <div className="gn-node">
      <div className="gn-node__header" style={{ background: data.headerColor }}>
        <div className="gn-node__title">{data.label}</div>
      </div>

      <div className="gn-node__body">
        {rows.map((row, index) => (
          <div key={index}>
            <div className="gn-node__row">
              <div className="gn-node__column">
                {row.input ? (
                  <SocketLine
                    socket={row.input}
                    position={Position.Left}
                    type="target"
                    align="left"
                  />
                ) : null}
              </div>
              <div className="gn-node__column gn-node__column--right">
                {row.output ? (
                  <SocketLine
                    socket={row.output}
                    position={Position.Right}
                    type="source"
                    align="right"
                  />
                ) : null}
              </div>
            </div>
            {row.input &&
              !row.input.hideValue &&
              row.input.defaultValue?.kind === 'vec' ? (
              <VecBlock values={row.input.defaultValue.values} />
            ) : null}
          </div>
        ))}
      </div>
    </div>
  )
}
