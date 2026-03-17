import { Position, type Edge, type Node } from '@xyflow/react'
import type { GraphIR, SocketIR } from '../ir/types'

export type GNFlowNodeData = {
  label: string
  type: string
  width: number
  inputs: SocketIR[]
  outputs: SocketIR[]
}

export function mapGraphIRToFlow(graph: GraphIR): {
  nodes: Node<GNFlowNodeData>[]
  edges: Edge[]
} {
  return {
    nodes: graph.nodes.map((node) => ({
      id: node.id,
      type: 'gnNode',
      position: node.position,
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      style: {
        width: node.width,
      },
      data: {
        label: node.label,
        type: node.type,
        width: node.width,
        inputs: node.inputs,
        outputs: node.outputs,
      },
    })),
    edges: graph.edges.map((edge) => ({
      id: edge.id,
      source: edge.sourceNodeId,
      sourceHandle: edge.sourceSocketId,
      target: edge.targetNodeId,
      targetHandle: edge.targetSocketId,
      animated: false,
    })),
  }
}
