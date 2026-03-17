import type {
  EdgeIR,
  GraphIR,
  NodeIR,
  SocketDisplayShape,
  SocketIR,
} from '../ir/types'
import { socketColor } from '../ir/socketColors'
import { nodeHeaderColor } from '../ir/nodeColors'

type BlenderSocket = {
  id: number
  data: {
    name: string
    type: string
    display_shape: SocketDisplayShape
  }
}

type BlenderNode = {
  id: number
  data: {
    name: string
    label: string
    bl_idname: string
    width?: number
    location?: [number, number]
    location_absolute?: [number, number]
    inputs: {
      data: {
        items: BlenderSocket[]
      }
    }
    outputs: {
      data: {
        items: BlenderSocket[]
      }
    }
  }
}

type BlenderLink = {
  id: number
  data: {
    from_socket: number
    to_socket: number
  }
}

export type BlenderTreeExport = {
  node_trees: Array<{
    id: number
    data: {
      name: string
      nodes: {
        data: {
          items: BlenderNode[]
        }
      }
      links: {
        data: {
          items: BlenderLink[]
        }
      }
    }
  }>
}

export type NormalizedSocket = {
  id: string
  name: string
  dataType: string
  displayShape: SocketDisplayShape
  color: string
  index: number
}

export type NormalizedNode = {
  id: string
  type: string
  label: string
  position: {
    x: number
    y: number
  }
  width: number
  headerColor: string
  inputs: NormalizedSocket[]
  outputs: NormalizedSocket[]
}

export type NormalizedLink = {
  id: string
  fromSocketId: string
  toSocketId: string
}

export type NormalizedGraph = {
  id: string
  label: string
  nodes: NormalizedNode[]
  links: NormalizedLink[]
}

function normalizeSocket(socket: BlenderSocket, index: number): NormalizedSocket {
  return {
    id: String(socket.id),
    name: socket.data.name,
    dataType: socket.data.type,
    displayShape: socket.data.display_shape,
    color: socketColor(socket.data.type),
    index,
  }
}

export function normalizeBlenderGraph(raw: BlenderTreeExport): NormalizedGraph {
  const tree = raw.node_trees[0]

  return {
    id: String(tree.id),
    label: tree.data.name,
    nodes: tree.data.nodes.data.items.map((node) => {
      const location = node.data.location_absolute ?? node.data.location ?? [0, 0]

      return {
        id: String(node.id),
        type: node.data.bl_idname,
        label: node.data.label || node.data.name,
        position: {
          x: location[0],
          y: -location[1],
        },
        width: node.data.width ?? 140,
        headerColor: nodeHeaderColor(node.data.bl_idname),
        inputs: node.data.inputs.data.items.map(normalizeSocket),
        outputs: node.data.outputs.data.items.map(normalizeSocket),
      }
    }),
    links: tree.data.links.data.items.map((link) => ({
      id: String(link.id),
      fromSocketId: String(link.data.from_socket),
      toSocketId: String(link.data.to_socket),
    })),
  }
}

function toInputSocket(nodeId: string, socket: NormalizedSocket): SocketIR {
  return {
    ...socket,
    nodeId,
    direction: 'input',
  }
}

function toOutputSocket(nodeId: string, socket: NormalizedSocket): SocketIR {
  return {
    ...socket,
    nodeId,
    direction: 'output',
  }
}

export function toGraphIR(normalized: NormalizedGraph): GraphIR {
  const nodes: NodeIR[] = normalized.nodes.map((node) => ({
    id: node.id,
    type: node.type,
    label: node.label,
    position: node.position,
    width: node.width,
    headerColor: node.headerColor,
    inputs: node.inputs.map((socket) => toInputSocket(node.id, socket)),
    outputs: node.outputs.map((socket) => toOutputSocket(node.id, socket)),
  }))

  const socketToNode = new Map<string, string>()
  const socketById = new Map<string, SocketIR>()

  for (const node of nodes) {
    for (const socket of [...node.inputs, ...node.outputs]) {
      socketToNode.set(socket.id, node.id)
      socketById.set(socket.id, socket)
    }
  }

  const edges: EdgeIR[] = normalized.links.map((link) => ({
    id: link.id,
    sourceNodeId: socketToNode.get(link.fromSocketId) ?? '',
    sourceSocketId: link.fromSocketId,
    targetNodeId: socketToNode.get(link.toSocketId) ?? '',
    targetSocketId: link.toSocketId,
    color: socketById.get(link.fromSocketId)?.color ?? '#888888',
  }))

  return {
    id: normalized.id,
    label: normalized.label,
    nodes,
    edges,
  }
}
