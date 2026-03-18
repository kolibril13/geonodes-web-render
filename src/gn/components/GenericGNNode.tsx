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

function unitForType(dataType: string): string {
  if (dataType === 'ROTATION') return '°'
  // FLOAT is the explicit distance/length type in geometry nodes
  if (dataType === 'FLOAT') return ' m'
  // Everything else (VALUE, RGBA, VECTOR, INT, STRING, …) is dimensionless
  return ''
}

function formatNumber(value: number): string {
  return parseFloat(value.toFixed(3)).toString()
}

function formatScalar(value: number | boolean | string, dataType: string): string {
  if (typeof value === 'boolean') return value ? 'True' : 'False'
  if (typeof value === 'string') return value
  return `${formatNumber(value)}${unitForType(dataType)}`
}

function toLinearCss(v: number): number {
  // Blender stores colors in linear light; convert to sRGB for CSS display
  return Math.round(Math.min(1, Math.max(0, v)) * 255)
}

function ColorSwatch(props: { values: number[] }) {
  const [r, g, b, a = 1] = props.values
  const css = `rgba(${toLinearCss(r)},${toLinearCss(g)},${toLinearCss(b)},${a.toFixed(2)})`
  return <div className="gn-node__color-swatch" style={{ background: css }} />
}

function VecBlock(props: { values: number[]; dataType: string }) {
  if (props.dataType === 'RGBA') {
    return <ColorSwatch values={props.values} />
  }
  const unit = unitForType(props.dataType)
  return (
    <div className="gn-node__vec-block">
      {props.values.slice(0, 4).map((v, i) => (
        <div key={i} className="gn-node__vec-row">
          <span className="gn-node__vec-label">{VEC_LABELS[i]}</span>
          <span className="gn-node__vec-value">{formatNumber(v)}{unit}</span>
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
  suppressDefault: boolean
}) {
  const { socket, position, type, align, suppressDefault } = props
  const isBlank = socket.name.trim().length === 0
  const showScalar = !suppressDefault && !socket.hideValue && socket.defaultValue?.kind === 'scalar'

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
        <span className="gn-node__value">{formatScalar(socket.defaultValue.value, socket.dataType)}</span>
      ) : null}
    </div>
  )
}

function showVec(socket: SocketData, suppressDefault: boolean) {
  return !suppressDefault && !socket.hideValue && socket.defaultValue?.kind === 'vec'
}

export function GenericGNNode(props: NodeProps) {
  const data = props.data as GNFlowNodeData
  const connectedIds = new Set(data.connectedInputIds ?? [])
  const outputs = data.outputs.filter((s) => s.enabled)
  const inputs = data.inputs.filter((s) => s.enabled)

  return (
    <div className="gn-node">
      <div className="gn-node__header" style={{ background: data.headerColor }}>
        <div className="gn-node__title">{data.label}</div>
      </div>

      <div className="gn-node__body">
        {outputs.map((socket) => (
          <SocketLine
            key={socket.id}
            socket={socket}
            position={Position.Right}
            type="source"
            align="right"
            suppressDefault={true}
          />
        ))}

        {inputs.map((socket) => {
          const suppress = connectedIds.has(socket.id)
          return (
            <div key={socket.id}>
              <SocketLine
                socket={socket}
                position={Position.Left}
                type="target"
                align="left"
                suppressDefault={suppress}
              />
              {showVec(socket, suppress) ? (
                <VecBlock values={(socket.defaultValue as { kind: 'vec'; values: number[] }).values} dataType={socket.dataType} />
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}
