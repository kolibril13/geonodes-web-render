import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { FloatCurveData } from '../ir/types'
import { buildCurvePaths } from '../ir/curvePath'
import type { GNFlowNodeData } from '../xyflow/mapGraphIRToFlow'
import { ColorRampViz } from './ColorRampViz'
import { useGroupNav } from './groupNavContext'
import { operationLabel } from '../ir/operationLabels'

const VEC_LABELS = ['X', 'Y', 'Z', 'W']

const DATA_TYPE_LABELS: Record<string, string> = {
  FLOAT:   'Float',
  INT:     'Integer',
  VECTOR:  'Vector',
  RGBA:    'Color',
  STRING:  'String',
  BOOLEAN: 'Boolean',
  ROTATION: 'Rotation',
}

function formatPropertyValue(key: string, value: string): string {
  if (key === 'data_type') return DATA_TYPE_LABELS[value] ?? value
  if (key === 'operation') return operationLabel(value)
  if (key === 'use_clamp') return 'Clamp'
  return value
}

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

function NodePropsBlock({ properties }: { properties: Record<string, string> }) {
  const entries = Object.entries(properties)
  if (entries.length === 0) return null
  return (
    <div className="gn-node__props">
      {entries.map(([key, value]) => (
        <div key={key} className="gn-node__prop-row">
          {formatPropertyValue(key, value)}
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Float Curve visualization
// ---------------------------------------------------------------------------

const CURVE_H = 120
const CURVE_PAD = 6

function FloatCurveViz({ curve, width }: { curve: FloatCurveData; width: number }) {
  const svgW = Math.max(10, width - CURVE_PAD * 2)
  const svgH = CURVE_H

  const { strokePath, fillPath, zeroLinePath, dotPositions } = buildCurvePaths(
    curve.points,
    curve.clipMinX,
    curve.clipMinY,
    curve.clipMaxX,
    curve.clipMaxY,
    svgW,
    svgH,
  )

  return (
    <div className="gn-node__curve-wrap">
      <svg
        width={svgW}
        height={svgH}
        viewBox={`0 0 ${svgW} ${svgH}`}
        className="gn-node__curve-svg"
      >
        {/* zero line */}
        {zeroLinePath && (
          <path d={zeroLinePath} className="gn-node__curve-zero" />
        )}
        {/* filled area under the curve */}
        {fillPath && (
          <path d={fillPath} className="gn-node__curve-fill" />
        )}
        {/* curve stroke */}
        {strokePath && (
          <path d={strokePath} className="gn-node__curve-stroke" />
        )}
        {/* control-point dots */}
        {dotPositions.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={2.5} className="gn-node__curve-dot" />
        ))}
      </svg>
    </div>
  )
}

// ---------------------------------------------------------------------------

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

// Blender-style stacked-cards indicator below group nodes, hinting at the
// nested tree behind them. The whole node is the click target for entering it.
function GroupStack() {
  return (
    <div className="gn-node__stack" aria-hidden="true">
      <div className="gn-node__stack-bar" />
      <div className="gn-node__stack-bar" />
      <div className="gn-node__stack-bar" />
    </div>
  )
}

export function GenericGNNode(props: NodeProps) {
  const data = props.data as GNFlowNodeData
  const nav = useGroupNav()
  const connectedIds = new Set(data.connectedInputIds ?? [])
  const connectedOutputIds = new Set(data.connectedOutputIds ?? [])
  const outputs = data.outputs.filter((s) => s.enabled)
  const inputs = data.inputs.filter((s) => s.enabled)

  const groupTreeId = data.groupTreeId
  const isOpenableGroup = groupTreeId !== undefined && data.groupTreeName !== undefined && !!nav
  const isCollapsed = data.hide
  // Collapsed nodes (Blender's node.hide) shrink to the header: only sockets
  // with an actual connection stay visible; everything else disappears.
  const visibleOutputs = isCollapsed ? outputs.filter((s) => connectedOutputIds.has(s.id)) : outputs
  const visibleInputs = isCollapsed ? inputs.filter((s) => connectedIds.has(s.id)) : inputs

  return (
    <div
      className={`gn-node${isCollapsed ? ' gn-node--collapsed' : ''}${isOpenableGroup ? ' gn-node--group nodrag' : ''}`}
      onClick={isOpenableGroup ? () => nav.openGroup(groupTreeId!) : undefined}
      role={isOpenableGroup ? 'button' : undefined}
      title={isOpenableGroup ? `Open group "${data.groupTreeName}"` : undefined}
    >
      <div className="gn-node__header" style={{ background: data.headerColor }}>
        <div className="gn-node__title">{data.label}</div>
      </div>

      {!isCollapsed && isOpenableGroup && <GroupStack />}

      {!isCollapsed && data.properties && <NodePropsBlock properties={data.properties} />}

      {!isCollapsed && data.floatCurve && (
        <FloatCurveViz curve={data.floatCurve} width={data.width} />
      )}

      <div className="gn-node__body">
        {visibleOutputs.map((socket) => (
          <SocketLine
            key={socket.id}
            socket={socket}
            position={Position.Right}
            type="source"
            align="right"
            suppressDefault={true}
          />
        ))}

        {/* Color Ramp widget sits between the Color/Alpha outputs and the Factor input. */}
        {!isCollapsed && data.colorRamp && (
          <ColorRampViz data={data.colorRamp} width={data.width} />
        )}

        {visibleInputs.map((socket) => {
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
