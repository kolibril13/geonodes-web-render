import type {
  ColorRampData,
  EdgeIR,
  FloatCurveData,
  GraphIR,
  NodeIR,
  SocketDefaultValue,
  SocketDisplayShape,
  SocketIR,
} from '../ir/types'
import { socketColor } from '../ir/socketColors'
import { nodeHeaderColor } from '../ir/nodeColors'
import { operationLabel } from '../ir/operationLabels'

type BlenderSocket = {
  id: number
  data: {
    name: string
    type: string
    display_shape: SocketDisplayShape
    default_value?: unknown
    hide?: boolean
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
    // Node collapsed to its header row (Blender's node.hide)
    hide?: boolean
    // NodeFrame parent (id of the frame node this node is grouped under)
    parent?: number | null
    // standard nodes
    inputs?: { data: { items: BlenderSocket[] } }
    outputs?: { data: { items: BlenderSocket[] } }
    // NodeReroute only
    socket_idname?: string
    single_input?: number
    single_output?: number
    // FunctionNodeInputVector
    vector?: number[]
    // GeometryNodeGroup (and other group nodes): id of the referenced tree
    node_tree?: number | null
    // Zone input nodes (Simulation/Repeat/ForEach/Closure): name of the paired output node
    paired_output?: string
    // ShaderNodeCombineColor / ShaderNodeSeparateColor
    mode?: string
    // FunctionNodeCompare / ShaderNodeMath
    operation?: string
    data_type?: string
    use_clamp?: boolean
    // ShaderNodeFloatCurve / ShaderNodeRGBCurve
    mapping?: {
      data: {
        use_clip?: boolean
        clip_min_x?: number
        clip_min_y?: number
        clip_max_x?: number
        clip_max_y?: number
        extend?: string
        curves?: {
          data: {
            items: Array<{
              data: {
                points: {
                  data: {
                    items: Array<{
                      data: { location: [number, number]; handle_type: string }
                    }>
                  }
                }
              }
            }>
          }
        }
      }
    }
    // ShaderNodeValToRGB (Color Ramp)
    color_ramp?: {
      data: {
        interpolation?: string
        hue_interpolation?: string
        color_mode?: string
        elements: {
          data: {
            items: Array<{
              data: {
                color: [number, number, number, number]
                alpha?: number
                position: number
              }
            }>
          }
        }
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

type BlenderTree = {
  id: number
  data: {
    name: string
    is_modifier?: boolean
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
}

export type BlenderTreeExport = {
  node_trees: BlenderTree[]
}

export type NormalizedSocket = {
  id: string
  name: string
  dataType: string
  displayShape: SocketDisplayShape
  color: string
  defaultValue: SocketDefaultValue | null
  /** Blender's socket.hide: socket is hidden unless it has a link. */
  hide: boolean
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
  floatCurve?: FloatCurveData
  colorRamp?: ColorRampData
  properties?: Record<string, string>
  /** For group nodes: id/name of the referenced node tree (if present in the export). */
  groupTreeId?: string
  groupTreeName?: string
  /** Id of the NodeFrame this node is parented to (Blender "parent"), if any. */
  parentFrameId?: string
  /** For zone input nodes (Simulation/Repeat/…): id of the paired output node. */
  pairedOutputId?: string
  /** Blender's node.hide: node is collapsed to its header row. */
  hide: boolean
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

export type NormalizedExport = {
  /** Id of the top-level tree (the one not referenced by any group node). */
  rootId: string
  /** All trees in the export, keyed by tree id. */
  trees: Record<string, NormalizedGraph>
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

function parseFloatCurve(node: BlenderNode): FloatCurveData | undefined {
  const m = node.data.mapping?.data
  if (!m) return undefined
  const curveItems = m.curves?.data?.items
  if (!curveItems || curveItems.length === 0) return undefined

  // Float curve only has one curve channel (index 0)
  const pointItems = curveItems[0]?.data?.points?.data?.items ?? []
  const points = pointItems.map((item) => ({
    location: item.data.location as [number, number],
    handleType: item.data.handle_type,
  }))

  return {
    clipMinX: m.clip_min_x ?? 0,
    clipMinY: m.clip_min_y ?? 0,
    clipMaxX: m.clip_max_x ?? 1,
    clipMaxY: m.clip_max_y ?? 1,
    extend: m.extend ?? 'EXTRAPOLATED',
    points,
  }
}

function parseColorRamp(node: BlenderNode): ColorRampData | undefined {
  const cr = node.data.color_ramp?.data
  if (!cr) return undefined
  const items = cr.elements?.data?.items ?? []
  const stops = items.map((item) => {
    const c = item.data.color
    return {
      position: item.data.position,
      // Use the element's explicit alpha when present (color[3] mirrors it).
      color: [c[0], c[1], c[2], item.data.alpha ?? c[3] ?? 1] as [
        number,
        number,
        number,
        number,
      ],
    }
  })
  return {
    interpolation: cr.interpolation ?? 'LINEAR',
    colorMode: cr.color_mode ?? 'RGB',
    hueInterpolation: cr.hue_interpolation ?? 'NEAR',
    stops,
  }
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

// Blender appends ".001", ".002", … to keep duplicate node names unique.
function stripDuplicateSuffix(name: string): string {
  return name.replace(/\.\d{3}$/, '')
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
    hide: false,
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
    hide: false,
    ...(node.data.parent != null ? { parentFrameId: String(node.data.parent) } : {}),
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
    hide: socket.data.hide ?? false,
    hideValue: socket.data.hide_value ?? false,
    enabled: socket.data.enabled ?? true,
    index,
  }
}

// Nodes whose header title reflects the selected operation in Blender
// (draw_label), and which show the operation dropdown in the node body.
const OPERATION_NODES = new Set([
  'ShaderNodeMath',
  'ShaderNodeVectorMath',
  'FunctionNodeIntegerMath',
  'FunctionNodeBooleanMath',
  'FunctionNodeCompare',
])

function extractNodeProperties(node: BlenderNode): Record<string, string> | undefined {
  if (node.data.bl_idname === 'FunctionNodeCompare') {
    const props: Record<string, string> = {}
    if (node.data.data_type) props.data_type = node.data.data_type
    if (node.data.operation) props.operation = node.data.operation
    return Object.keys(props).length > 0 ? props : undefined
  }
  if (OPERATION_NODES.has(node.data.bl_idname)) {
    const props: Record<string, string> = {}
    if (node.data.operation) props.operation = node.data.operation
    if (node.data.use_clamp) props.use_clamp = 'true'
    return Object.keys(props).length > 0 ? props : undefined
  }
  return undefined
}

// Blender titles math-style nodes with their operation ("Divide Floor",
// "Greater Than", …) and group nodes with the referenced tree's name, unless
// the user set a custom label.
function nodeDisplayLabel(node: BlenderNode, treeNameById: Map<string, string>): string {
  if (node.data.label) return node.data.label
  if (OPERATION_NODES.has(node.data.bl_idname) && node.data.operation) {
    return operationLabel(node.data.operation)
  }
  if (node.data.node_tree != null) {
    const treeName = treeNameById.get(String(node.data.node_tree))
    if (treeName) return treeName
  }
  return stripDuplicateSuffix(node.data.name)
}

function normalizeTree(
  tree: BlenderTree,
  treeIndex: number,
  treeNameById: Map<string, string>,
): NormalizedGraph {
  if (!tree?.data) {
    throw new Error(`"node_trees[${treeIndex}].data" is missing.`)
  }
  if (!tree.data.nodes?.data?.items) {
    throw new Error(`"node_trees[${treeIndex}].data.nodes.data.items" is missing.`)
  }
  if (!tree.data.links?.data?.items) {
    throw new Error(`"node_trees[${treeIndex}].data.links.data.items" is missing.`)
  }

  // Zone input nodes reference their paired output by node *name*.
  const nodeIdByName = new Map<string, string>()
  for (const node of tree.data.nodes.data.items) {
    if (node?.data?.name) nodeIdByName.set(node.data.name, String(node.id))
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

      const floatCurve =
        node.data.bl_idname === 'ShaderNodeFloatCurve'
          ? parseFloatCurve(node)
          : undefined

      const colorRamp =
        node.data.bl_idname === 'ShaderNodeValToRGB'
          ? parseColorRamp(node)
          : undefined

      const properties = extractNodeProperties(node)

      return {
        id: String(node.id),
        type: node.data.bl_idname,
        label: nodeDisplayLabel(node, treeNameById),
        position: {
          x: location[0],
          y: -location[1],
        },
        width: node.data.width ?? 140,
        headerColor: nodeHeaderColor(node.data.bl_idname, node.data.data_type),
        inputs,
        outputs,
        floatCurve,
        colorRamp,
        hide: node.data.hide ?? false,
        ...(properties ? { properties } : {}),
        // node_tree can legitimately be 0, so compare against null/undefined.
        ...(node.data.node_tree != null ? { groupTreeId: String(node.data.node_tree) } : {}),
        ...(node.data.parent != null ? { parentFrameId: String(node.data.parent) } : {}),
        ...(node.data.paired_output && nodeIdByName.has(node.data.paired_output)
          ? { pairedOutputId: nodeIdByName.get(node.data.paired_output) }
          : {}),
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

export function normalizeBlenderExport(raw: BlenderTreeExport): NormalizedExport {
  if (!raw || typeof raw !== 'object') {
    throw new Error('JSON root must be an object.')
  }
  if (!Array.isArray(raw.node_trees) || raw.node_trees.length === 0) {
    throw new Error('Expected "node_trees" array with at least one entry.')
  }

  const treeNameById = new Map<string, string>()
  for (const tree of raw.node_trees) {
    if (tree?.data?.name) treeNameById.set(String(tree.id), tree.data.name)
  }

  const trees: Record<string, NormalizedGraph> = {}
  for (let i = 0; i < raw.node_trees.length; i++) {
    const graph = normalizeTree(raw.node_trees[i], i, treeNameById)
    trees[graph.id] = graph
  }

  // Drop group references to trees missing from the export, and resolve the
  // referenced tree's name so group nodes can display it.
  const referencedTreeIds = new Set<string>()
  for (const graph of Object.values(trees)) {
    for (const node of graph.nodes) {
      if (node.groupTreeId === undefined) continue
      const target = trees[node.groupTreeId]
      if (!target) {
        delete node.groupTreeId
        continue
      }
      node.groupTreeName = target.label
      referencedTreeIds.add(target.id)
    }
  }

  // The root tree is the one no group node points at; prefer the modifier
  // tree when ambiguous, and fall back to the first tree (legacy behavior).
  const rootCandidates = raw.node_trees.filter((t) => !referencedTreeIds.has(String(t.id)))
  const rootTree =
    rootCandidates.find((t) => t.data?.is_modifier) ??
    rootCandidates[0] ??
    raw.node_trees[0]

  return { rootId: String(rootTree.id), trees }
}

export function normalizeBlenderGraph(raw: BlenderTreeExport): NormalizedGraph {
  const { rootId, trees } = normalizeBlenderExport(raw)
  return trees[rootId]
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
    floatCurve: node.floatCurve,
    colorRamp: node.colorRamp,
    properties: node.properties,
    groupTreeId: node.groupTreeId,
    groupTreeName: node.groupTreeName,
    parentFrameId: node.parentFrameId,
    pairedOutputId: node.pairedOutputId,
    hide: node.hide,
  }))

  const socketToNode = new Map<string, string>()
  const socketById = new Map<string, SocketIR>()

  for (const node of nodes) {
    for (const socket of [...node.inputs, ...node.outputs]) {
      socketToNode.set(socket.id, node.id)
      socketById.set(socket.id, socket)
    }
  }

  // A reroute is a wildcard: Blender derives its socket type (and thus its
  // color) from whatever feeds its input, not from the reroute itself. Exports
  // often omit a reroute's socket_idname, leaving it as CUSTOM grey, which makes
  // an otherwise-yellow (or any-colored) link turn grey after passing through a
  // reroute. Trace each reroute back through the link chain to the originating
  // real output socket and copy its color/type onto the reroute's sockets — the
  // same socket objects drive both the reroute dot and the outgoing edge colors.
  const linkSourceByTarget = new Map<string, string>()
  for (const link of normalized.links) {
    linkSourceByTarget.set(link.toSocketId, link.fromSocketId)
  }
  const rerouteByOutputSocket = new Map<string, NodeIR>()
  for (const node of nodes) {
    if (node.type === 'NodeReroute' && node.outputs[0]) {
      rerouteByOutputSocket.set(node.outputs[0].id, node)
    }
  }

  function resolveRerouteSource(node: NodeIR, seen: Set<string>): SocketIR | undefined {
    if (seen.has(node.id)) return undefined
    seen.add(node.id)
    const inputSocketId = node.inputs[0]?.id
    if (inputSocketId == null) return undefined
    const sourceSocketId = linkSourceByTarget.get(inputSocketId)
    if (sourceSocketId == null) return undefined
    const upstreamReroute = rerouteByOutputSocket.get(sourceSocketId)
    if (upstreamReroute) return resolveRerouteSource(upstreamReroute, seen)
    return socketById.get(sourceSocketId)
  }

  for (const node of nodes) {
    if (node.type !== 'NodeReroute') continue
    const source = resolveRerouteSource(node, new Set())
    if (!source) continue
    for (const socket of [...node.inputs, ...node.outputs]) {
      socket.color = source.color
      socket.dataType = source.dataType
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
