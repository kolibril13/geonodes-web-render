import { Position, type Edge, type Node } from '@xyflow/react'
import type { ColorRampData, FloatCurveData, GraphIR, NodeIR, SocketIR } from '../ir/types'

export type GNFlowNodeData = {
  label: string
  type: string
  width: number
  headerColor: string
  inputs: SocketIR[]
  outputs: SocketIR[]
  connectedInputIds: string[]
  floatCurve?: FloatCurveData
  colorRamp?: ColorRampData
  properties?: Record<string, string>
  groupTreeId?: string
  groupTreeName?: string
}

export type GNRerouteNodeData = {
  color: string
  inputSocketId: string
  outputSocketId: string
}

export type ZoneKind = 'simulation' | 'repeat' | 'foreach' | 'closure'

export type SimulationZoneNodeData = {
  kind: ZoneKind
}

export type NodeFrameData = {
  label: string
}

function estimateNodeHeight(node: NodeIR): number {
  // Rough sizing approximation: header + rows for max socket count + padding.
  const rows = Math.max(node.inputs.length, node.outputs.length)
  return Math.max(60, 32 + rows * 18 + 16)
}

function estimateNodeSize(node: NodeIR): { w: number; h: number } {
  if (node.type === 'NodeReroute') return { w: 12, h: 12 }
  return { w: node.width, h: estimateNodeHeight(node) }
}

// User-created NodeFrame nodes group other nodes; the frame auto-fits its
// children (Blender shrinks frames to their contents). Build a background node
// per frame sized to the bounding box of its parented children.
function buildNodeFrames(graph: GraphIR): Node[] {
  const frames = graph.nodes.filter((n) => n.type === 'NodeFrame')
  if (frames.length === 0) return []

  const childrenByFrame = new Map<string, NodeIR[]>()
  for (const n of graph.nodes) {
    if (!n.parentFrameId) continue
    const arr = childrenByFrame.get(n.parentFrameId) ?? []
    arr.push(n)
    childrenByFrame.set(n.parentFrameId, arr)
  }

  const out: Node[] = []
  for (const frame of frames) {
    const children = childrenByFrame.get(frame.id) ?? []
    if (children.length === 0) continue

    let minX = Number.POSITIVE_INFINITY
    let minY = Number.POSITIVE_INFINITY
    let maxX = Number.NEGATIVE_INFINITY
    let maxY = Number.NEGATIVE_INFINITY
    for (const c of children) {
      const { w, h } = estimateNodeSize(c)
      minX = Math.min(minX, c.position.x)
      minY = Math.min(minY, c.position.y)
      maxX = Math.max(maxX, c.position.x + w)
      maxY = Math.max(maxY, c.position.y + h)
    }
    if (!Number.isFinite(minX)) continue

    // Extra top padding leaves room for the frame's label.
    const padX = 28
    const padBottom = 28
    const padTop = 48
    out.push({
      id: `frame:${frame.id}`,
      type: 'nodeFrame',
      position: { x: minX - padX, y: minY - padTop },
      draggable: false,
      selectable: false,
      connectable: false,
      data: { label: frame.label } as NodeFrameData,
      style: {
        width: maxX - minX + padX * 2,
        height: maxY - minY + padTop + padBottom,
        zIndex: -8,
      },
    })
  }
  return out
}

// Zone node families: an input node paired with an output node spans a tinted
// background rectangle (Blender's simulation/repeat/for-each/closure zones).
const ZONE_NODE_TYPES: Array<{ input: string; output: string; kind: ZoneKind }> = [
  { input: 'GeometryNodeSimulationInput', output: 'GeometryNodeSimulationOutput', kind: 'simulation' },
  { input: 'GeometryNodeRepeatInput',     output: 'GeometryNodeRepeatOutput',     kind: 'repeat' },
  {
    input:  'GeometryNodeForeachGeometryElementInput',
    output: 'GeometryNodeForeachGeometryElementOutput',
    kind: 'foreach',
  },
  { input: 'NodeClosureInput', output: 'NodeClosureOutput', kind: 'closure' },
]

function buildZoneFrames(graph: GraphIR): Node[] {
  const byId = new Map(graph.nodes.map((n) => [n.id, n]))
  const out: Node[] = []

  for (const zoneType of ZONE_NODE_TYPES) {
    const inputs = graph.nodes.filter((n) => n.type === zoneType.input)
    const outputs = graph.nodes.filter((n) => n.type === zoneType.output)

    for (const zoneInput of inputs) {
      // Prefer the export's explicit pairing; fall back to the sole output of
      // this kind (older exports without `paired_output`).
      const zoneOutput =
        (zoneInput.pairedOutputId !== undefined
          ? byId.get(zoneInput.pairedOutputId)
          : undefined) ?? (outputs.length === 1 ? outputs[0] : undefined)
      if (!zoneOutput || zoneOutput.type !== zoneType.output) continue

      const memberIds = nodesOnPaths(zoneInput.id, zoneOutput.id, graph)
      if (memberIds.size === 0) continue

      // Vertical extent: bound every member (incl. the boundary nodes) with a
      // little padding above and below.
      let minY = Number.POSITIVE_INFINITY
      let maxY = Number.NEGATIVE_INFINITY
      for (const id of memberIds) {
        const n = byId.get(id)
        if (!n) continue
        minY = Math.min(minY, n.position.y)
        maxY = Math.max(maxY, n.position.y + estimateNodeSize(n).h)
      }

      // Horizontal extent: in Blender the zone boundary runs *through* the
      // zone input and output nodes (their outer halves spill outside the
      // frame), rather than surrounding them. Anchor the left/right edges at
      // the horizontal centres of the two boundary nodes.
      const inX = zoneInput.position.x + zoneInput.width / 2
      const outX = zoneOutput.position.x + zoneOutput.width / 2
      const left = Math.min(inX, outX)
      const right = Math.max(inX, outX)

      if (!Number.isFinite(minY) || !Number.isFinite(maxY) || !Number.isFinite(left) || !Number.isFinite(right)) {
        continue
      }

      const vpad = 26
      // A non-interactive background rectangle behind the nodes. It is not a
      // parent of the member nodes, so they are free to straddle its edges.
      out.push({
        id: `zone:${zoneType.kind}:${zoneInput.id}`,
        type: 'simulationZone',
        position: { x: left, y: minY - vpad },
        draggable: false,
        selectable: false,
        connectable: false,
        data: { kind: zoneType.kind } as SimulationZoneNodeData,
        style: { width: right - left, height: maxY - minY + vpad * 2, zIndex: -10 },
      })
    }
  }
  return out
}

function mapNode(
  node: NodeIR,
  connectedTargetIds: Set<string>,
  connectedSourceIds: Set<string>,
): Node {
  if (node.type === 'NodeReroute') {
    const color = node.outputs[0]?.color ?? node.inputs[0]?.color ?? '#888888'
    return {
      id: node.id,
      type: 'rerouteNode',
      position: node.position,
      style: { width: 12, height: 12 },
      data: {
        color,
        inputSocketId: node.inputs[0]?.id ?? '',
        outputSocketId: node.outputs[0]?.id ?? '',
      } as GNRerouteNodeData,
    }
  }

  // Group Input nodes expose every group interface input as an output socket.
  // Blender shows them all, but for a cleaner read-only graph we hide the ones
  // that aren't wired up to anything (matching the user's intent to declutter).
  const outputs =
    node.type === 'NodeGroupInput'
      ? node.outputs.filter((s) => connectedSourceIds.has(s.id))
      : node.outputs

  return {
    id: node.id,
    type: 'gnNode',
    position: node.position,
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
    style: { width: node.width },
    data: {
      label: node.label,
      type: node.type,
      width: node.width,
      headerColor: node.headerColor,
      inputs: node.inputs,
      outputs,
      connectedInputIds: node.inputs
        .filter((s) => connectedTargetIds.has(s.id))
        .map((s) => s.id),
      floatCurve: node.floatCurve,
      colorRamp: node.colorRamp,
      properties: node.properties,
      groupTreeId: node.groupTreeId,
      groupTreeName: node.groupTreeName,
    } as GNFlowNodeData,
  }
}

function nodesOnPaths(sourceId: string, targetId: string, graph: GraphIR): Set<string> {
  const out = new Map<string, string[]>()
  const inn = new Map<string, string[]>()
  for (const n of graph.nodes) {
    out.set(n.id, [])
    inn.set(n.id, [])
  }
  for (const e of graph.edges) {
    if (!out.has(e.sourceNodeId)) out.set(e.sourceNodeId, [])
    if (!inn.has(e.targetNodeId)) inn.set(e.targetNodeId, [])
    out.get(e.sourceNodeId)!.push(e.targetNodeId)
    inn.get(e.targetNodeId)!.push(e.sourceNodeId)
  }

  const forward = new Set<string>()
  const stackF = [sourceId]
  while (stackF.length) {
    const cur = stackF.pop()!
    if (forward.has(cur)) continue
    forward.add(cur)
    for (const nxt of out.get(cur) ?? []) stackF.push(nxt)
  }

  const backward = new Set<string>()
  const stackB = [targetId]
  while (stackB.length) {
    const cur = stackB.pop()!
    if (backward.has(cur)) continue
    backward.add(cur)
    for (const prev of inn.get(cur) ?? []) stackB.push(prev)
  }

  const both = new Set<string>()
  for (const id of forward) if (backward.has(id)) both.add(id)
  return both
}

export function mapGraphIRToFlow(graph: GraphIR): {
  nodes: Node[]
  edges: Edge[]
} {
  const connectedTargetIds = new Set(graph.edges.map((e) => e.targetSocketId))
  const connectedSourceIds = new Set(graph.edges.map((e) => e.sourceSocketId))

  const frameNodes = buildNodeFrames(graph)

  // NodeFrame nodes are rendered as frame backgrounds (above), not as gn nodes.
  const baseNodes = graph.nodes
    .filter((node) => node.type !== 'NodeFrame')
    .map((node) => mapNode(node, connectedTargetIds, connectedSourceIds))

  // Zone framing (Blender-style tinted rectangles between paired zone nodes).
  const zoneFrames = buildZoneFrames(graph)
  const nodes = [...zoneFrames, ...baseNodes]

  return {
    // Frame backgrounds first so they sit behind the nodes they contain.
    nodes: [...frameNodes, ...nodes],
    edges: graph.edges.map((edge) => ({
      id: edge.id,
      source: edge.sourceNodeId,
      sourceHandle: edge.sourceSocketId,
      target: edge.targetNodeId,
      targetHandle: edge.targetSocketId,
      animated: false,
      style: { stroke: edge.color },
    })),
  }
}
