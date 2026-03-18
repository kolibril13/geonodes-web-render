import type {
  EdgeIR,
  GraphIR,
  NodeIR,
  SocketDefaultValue,
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
    default_value?: unknown
    hide_value?: boolean
    enabled?: boolean
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
    // standard nodes
    inputs?: { data: { items: BlenderSocket[] } }
    outputs?: { data: { items: BlenderSocket[] } }
    // NodeReroute only
    socket_idname?: string
    single_input?: number
    single_output?: number
    // FunctionNodeInputVector
    vector?: number[]
    // ShaderNodeCombineColor / ShaderNodeSeparateColor
    mode?: string
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
  defaultValue: SocketDefaultValue | null
  hideValue: boolean
  enabled: boolean
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

const SOCKET_IDNAME_TO_TYPE: Record<string, string> = {
  NodeSocketGeometry:   'GEOMETRY',
  NodeSocketFloat:      'FLOAT',
  NodeSocketVector:     'VECTOR',
  NodeSocketBool:       'BOOLEAN',
  NodeSocketInt:        'INT',
  NodeSocketColor:      'RGBA',
  NodeSocketString:     'STRING',
  NodeSocketObject:     'OBJECT',
  NodeSocketCollection: 'COLLECTION',
  NodeSocketImage:      'IMAGE',
  NodeSocketTexture:    'TEXTURE',
  NodeSocketMaterial:   'MATERIAL',
  NodeSocketRotation:   'ROTATION',
  NodeSocketMatrix:     'MATRIX',
  NodeSocketMenu:       'MENU',
}

function socketTypeFromIdname(idname: string): string {
  return SOCKET_IDNAME_TO_TYPE[idname] ?? 'CUSTOM'
}

// Blender exports canonical RNA names (Red/Green/Blue) regardless of mode;
// the UI renames them based on the selected color model.
const COLOR_CHANNEL_LABELS: Record<string, [string, string, string]> = {
  HSV: ['Hue', 'Saturation', 'Value'],
  HSL: ['Hue', 'Saturation', 'Lightness'],
  RGB: ['Red', 'Green', 'Blue'],
}

function remapColorChannelNames(
  sockets: NormalizedSocket[],
  mode: string | undefined,
): NormalizedSocket[] {
  const labels = COLOR_CHANNEL_LABELS[mode ?? 'RGB'] ?? COLOR_CHANNEL_LABELS['RGB']
  const canonicalNames = COLOR_CHANNEL_LABELS['RGB']
  return sockets.map((s) => {
    const idx = canonicalNames.indexOf(s.name as (typeof canonicalNames)[number])
    if (idx === -1) return s
    return { ...s, name: labels[idx] }
  })
}

function normalizeRerouteNode(node: BlenderNode, location: [number, number]): NormalizedNode {
  const dataType = socketTypeFromIdname(node.data.socket_idname ?? '')
  const color = socketColor(dataType)
  const inputId = String(node.data.single_input ?? `${node.id}_in`)
  const outputId = String(node.data.single_output ?? `${node.id}_out`)

  const rerouteSocket = (id: string): NormalizedSocket => ({
    id,
    name: '',
    dataType,
    displayShape: 'CIRCLE',
    color,
    defaultValue: null,
    hideValue: true,
    enabled: true,
    index: 0,
  })

  return {
    id: String(node.id),
    type: 'NodeReroute',
    label: '',
    position: { x: location[0], y: -location[1] },
    width: 0,
    headerColor: '',
    inputs: [rerouteSocket(inputId)],
    outputs: [rerouteSocket(outputId)],
  }
}

function parseDefaultValue(raw: unknown): SocketDefaultValue | null {
  if (raw === undefined || raw === null) return null
  if (Array.isArray(raw) && raw.length >= 2) {
    return { kind: 'vec', values: raw as number[] }
  }
  if (typeof raw === 'number' || typeof raw === 'boolean' || typeof raw === 'string') {
    return { kind: 'scalar', value: raw }
  }
  return null
}

function normalizeSocket(socket: BlenderSocket, index: number): NormalizedSocket {
  return {
    id: String(socket.id),
    name: socket.data.name,
    dataType: socket.data.type,
    displayShape: socket.data.display_shape,
    color: socketColor(socket.data.type),
    defaultValue: parseDefaultValue(socket.data.default_value),
    hideValue: socket.data.hide_value ?? false,
    enabled: socket.data.enabled ?? true,
    index,
  }
}

export function normalizeBlenderGraph(raw: BlenderTreeExport): NormalizedGraph {
  if (!raw || typeof raw !== 'object') {
    throw new Error('JSON root must be an object.')
  }
  if (!Array.isArray(raw.node_trees) || raw.node_trees.length === 0) {
    throw new Error('Expected "node_trees" array with at least one entry.')
  }

  const tree = raw.node_trees[0]
  if (!tree?.data) {
    throw new Error('"node_trees[0].data" is missing.')
  }
  if (!tree.data.nodes?.data?.items) {
    throw new Error('"node_trees[0].data.nodes.data.items" is missing.')
  }
  if (!tree.data.links?.data?.items) {
    throw new Error('"node_trees[0].data.links.data.items" is missing.')
  }

  return {
    id: String(tree.id),
    label: tree.data.name,
    nodes: tree.data.nodes.data.items.map((node, ni) => {
      if (!node?.data) {
        throw new Error(`Node at index ${ni} is missing ".data".`)
      }
      const location = node.data.location_absolute ?? node.data.location ?? [0, 0]

      if (node.data.bl_idname === 'NodeReroute') {
        return normalizeRerouteNode(node, location as [number, number])
      }

      const outputs = (node.data.outputs?.data?.items ?? []).map((s, si) => {
        if (!s?.data) throw new Error(`Node "${node.data.name}" output socket ${si} is missing ".data".`)
        return normalizeSocket(s, si)
      })

      // FunctionNodeInputVector stores the user-set value in node.data.vector,
      // not in the output socket's default_value (which is always [0,0,0]).
      if (node.data.bl_idname === 'FunctionNodeInputVector' && Array.isArray(node.data.vector)) {
        if (outputs[0]) {
          outputs[0] = { ...outputs[0], defaultValue: { kind: 'vec', values: node.data.vector } }
        }
      }

      let inputs = (node.data.inputs?.data?.items ?? []).map((s, si) => {
        if (!s?.data) throw new Error(`Node "${node.data.name}" input socket ${si} is missing ".data".`)
        return normalizeSocket(s, si)
      })

      if (
        node.data.bl_idname === 'ShaderNodeCombineColor' ||
        node.data.bl_idname === 'ShaderNodeSeparateColor'
      ) {
        inputs = remapColorChannelNames(inputs, node.data.mode)
      }

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
        inputs,
        outputs,
      }
    }),
    links: tree.data.links.data.items.map((link, li) => {
      if (!link?.data) throw new Error(`Link at index ${li} is missing ".data".`)
      return {
        id: String(link.id),
        fromSocketId: String(link.data.from_socket),
        toSocketId: String(link.data.to_socket),
      }
    }),
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
