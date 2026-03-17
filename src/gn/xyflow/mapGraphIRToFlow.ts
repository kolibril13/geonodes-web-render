import { Position, type Edge, type Node } from '@xyflow/react'
import type { GraphIR, NodeIR, SocketIR } from '../ir/types'

export type GNFlowNodeData = {
  label: string
  type: string
  width: number
  headerColor: string
  inputs: SocketIR[]
  outputs: SocketIR[]
}

export type GNRerouteNodeData = {
  color: string
  inputSocketId: string
  outputSocketId: string
}

function mapNode(node: NodeIR): Node {
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
    } as GNFlowNodeData,
  }
}

export function mapGraphIRToFlow(graph: GraphIR): {
  nodes: Node[]
  edges: Edge[]
} {
  return {
    nodes: graph.nodes.map(mapNode),
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
