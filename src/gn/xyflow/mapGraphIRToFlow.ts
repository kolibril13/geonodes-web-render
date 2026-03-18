import { Position, type Edge, type Node } from '@xyflow/react'
import type { FloatCurveData, GraphIR, NodeIR, SocketIR } from '../ir/types'

export type GNFlowNodeData = {
  label: string
  type: string
  width: number
  headerColor: string
  inputs: SocketIR[]
  outputs: SocketIR[]
  connectedInputIds: string[]
  floatCurve?: FloatCurveData
}

export type GNRerouteNodeData = {
  color: string
  inputSocketId: string
  outputSocketId: string
}

export type SimulationZoneNodeData = {
  label: string
}

function estimateNodeHeight(node: NodeIR): number {
  // Rough sizing approximation: header + rows for max socket count + padding.
  const rows = Math.max(node.inputs.length, node.outputs.length)
  return Math.max(60, 32 + rows * 18 + 16)
}

function mapNode(node: NodeIR, connectedTargetIds: Set<string>): Node {
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
      outputs: node.outputs,
      connectedInputIds: node.inputs
        .filter((s) => connectedTargetIds.has(s.id))
        .map((s) => s.id),
      floatCurve: node.floatCurve,
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

  const baseNodes = graph.nodes.map((node) => mapNode(node, connectedTargetIds))

  // Simulation zone framing (Blender-style purple frame).
  const simInput = graph.nodes.find((n) => n.type === 'GeometryNodeSimulationInput')
  const simOutput = graph.nodes.find((n) => n.type === 'GeometryNodeSimulationOutput')

  let nodes = baseNodes
  if (simInput && simOutput) {
    const memberIds = nodesOnPaths(simInput.id, simOutput.id, graph)
    if (memberIds.size > 0) {
      const byId = new Map(graph.nodes.map((n) => [n.id, n]))

      let minX = Number.POSITIVE_INFINITY
      let minY = Number.POSITIVE_INFINITY
      let maxX = Number.NEGATIVE_INFINITY
      let maxY = Number.NEGATIVE_INFINITY

      for (const id of memberIds) {
        const n = byId.get(id)
        if (!n) continue
        const w = n.width
        const h = estimateNodeHeight(n)
        minX = Math.min(minX, n.position.x)
        minY = Math.min(minY, n.position.y)
        maxX = Math.max(maxX, n.position.x + w)
        maxY = Math.max(maxY, n.position.y + h)
      }

      if (Number.isFinite(minX) && Number.isFinite(minY) && Number.isFinite(maxX) && Number.isFinite(maxY)) {
        const pad = 64
        const frameX = minX - pad
        const frameY = minY - pad
        const frameW = (maxX - minX) + pad * 2
        const frameH = (maxY - minY) + pad * 2
        const frameId = `zone:simulation:${simInput.id}`

        const frameNode: Node = {
          id: frameId,
          type: 'simulationZone',
          position: { x: frameX, y: frameY },
          draggable: false,
          selectable: false,
          connectable: false,
          data: { label: 'Simulation' } as SimulationZoneNodeData,
          style: { width: frameW, height: frameH, zIndex: -10 },
        }

        nodes = [
          frameNode,
          ...baseNodes.map((n) => {
            if (!memberIds.has(n.id)) return n
            // Children are positioned relative to their parent.
            return {
              ...n,
              parentId: frameId,
              extent: 'parent' as const,
              position: { x: n.position.x - frameX, y: n.position.y - frameY },
            }
          }),
        ]
      }
    }
  }

  return {
    nodes,
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
