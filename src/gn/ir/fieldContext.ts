import type { EdgeIR, GraphIR, NodeIR, SocketIR } from './types'

/**
 * Field-origin tracing.
 *
 * A field node (Position, Index, Normal, …) has no inputs, so nothing upstream
 * of it says which geometry it is evaluated on. The evaluation context is set
 * *downstream*, by whichever node consumes the field: `Instance on Points`
 * evaluates its Selection on the geometry wired into its Points input.
 *
 * So the trace runs forward from the hovered node to the consumer, then
 * backward from that consumer's geometry input to where the geometry comes
 * from — which is the answer to "where does this Position come from?".
 */

const isGeometry = (s: SocketIR) => s.dataType === 'GEOMETRY'

/** Which geometry input sets the context, for nodes that have more than one. */
const CONTEXT_GEOMETRY_INPUT: Record<string, string> = {
  // Instance on Points also has an "Instance" geometry input, but the fields
  // (Selection, Rotation, Scale, …) are evaluated on Points.
  GeometryNodeInstanceOnPoints: 'Points',
}

/**
 * Node types where the context genuinely can't be read off a geometry input.
 * Raycast's ray fields, for instance, are evaluated on the *caller's* implicit
 * context, not on its only geometry input (Target Geometry).
 */
const UNRESOLVED: Record<string, string> = {
  GeometryNodeRaycast: 'Ray fields are evaluated on the caller’s geometry, not on Target Geometry',
}

/** Domain the field inputs are evaluated on, for nodes with a fixed domain. */
const CONTEXT_DOMAIN: Record<string, string> = {
  GeometryNodeInstanceOnPoints: 'points',
  GeometryNodeSetPosition: 'points',
  GeometryNodeDistributePointsOnFaces: 'faces',
}

export type FieldContextHit = {
  consumerNodeId: string
  consumerLabel: string
  /** The field input socket that consumes the field ("Selection"). */
  fieldSocketName: string
  /** The geometry input that sets the context ("Points"), when resolvable. */
  geometrySocketName: string | null
  /** Label of the node the context geometry ultimately comes from. */
  originLabel: string | null
  /** "points", "faces", … when known. */
  domain: string | null
  /** Set when the context can't be resolved inside this tree. */
  note: string | null
}

export type FieldContextTrace = {
  originNodeId: string
  originLabel: string
  /** Nodes carrying the field from the hovered node to its consumers. */
  fieldNodeIds: Set<string>
  fieldEdgeIds: Set<string>
  /** Nodes/links supplying the geometry the field is evaluated on. */
  geometryNodeIds: Set<string>
  geometryEdgeIds: Set<string>
  /** Socket rows to accent: consumed field inputs and context geometry inputs. */
  socketIds: Set<string>
  /** One per distinct consumer — a field can be evaluated in several contexts. */
  hits: FieldContextHit[]
}

/**
 * A pure function node (Math, Compare, Mix, reroute, and the field inputs
 * themselves) has no geometry sockets at all: it carries a field along without
 * ever setting its context, so the trace passes straight through.
 *
 * Note this can't key off `displayShape`: Blender exports Compare's sockets as
 * CIRCLE, not DIAMOND, so socket shape is not a reliable field marker.
 */
function passesFieldThrough(node: NodeIR): boolean {
  if (node.type === 'NodeReroute') return true
  return ![...node.inputs, ...node.outputs].some(isGeometry)
}

/**
 * Nodes worth hovering: pure function nodes that feed something. Field input
 * nodes (Position, Index, …) are the interesting case, but Math/Compare in the
 * middle of a chain answer the same question, so they're included too.
 */
export function traceableNodeIds(graph: GraphIR): Set<string> {
  const hasOutgoing = new Set(graph.edges.map((e) => e.sourceNodeId))
  const ids = new Set<string>()
  for (const node of graph.nodes) {
    if (node.type === 'NodeReroute' || node.type === 'NodeFrame') continue
    if (!hasOutgoing.has(node.id)) continue
    if (passesFieldThrough(node)) ids.add(node.id)
  }
  return ids
}

/** Walk back over geometry links, collecting the chain and its origin node. */
function traceGeometryBack(
  startEdge: EdgeIR,
  nodeById: Map<string, NodeIR>,
  edgesByTargetSocket: Map<string, EdgeIR>,
  nodeIds: Set<string>,
  edgeIds: Set<string>,
): NodeIR | null {
  let originNode: NodeIR | null = null
  const queue: EdgeIR[] = [startEdge]
  const seen = new Set<string>()

  while (queue.length) {
    const edge = queue.pop()!
    if (seen.has(edge.id)) continue
    seen.add(edge.id)
    edgeIds.add(edge.id)

    const source = nodeById.get(edge.sourceNodeId)
    if (!source) continue
    nodeIds.add(source.id)

    const upstream = source.inputs.filter(isGeometry).flatMap((s) => {
      const e = edgesByTargetSocket.get(s.id)
      return e ? [e] : []
    })
    // A node with no incoming geometry is where this geometry is born
    // (Group Input, a primitive, …) — the answer we report to the user.
    if (upstream.length === 0 && !originNode) originNode = source
    queue.push(...upstream)
  }

  return originNode
}

export function computeFieldContext(graph: GraphIR, nodeId: string): FieldContextTrace | null {
  const nodeById = new Map(graph.nodes.map((n) => [n.id, n]))
  const start = nodeById.get(nodeId)
  if (!start || !passesFieldThrough(start)) return null

  const edgesBySource = new Map<string, EdgeIR[]>()
  const edgesByTargetSocket = new Map<string, EdgeIR>()
  for (const edge of graph.edges) {
    const arr = edgesBySource.get(edge.sourceNodeId) ?? []
    arr.push(edge)
    edgesBySource.set(edge.sourceNodeId, arr)
    edgesByTargetSocket.set(edge.targetSocketId, edge)
  }

  const fieldNodeIds = new Set<string>([nodeId])
  const fieldEdgeIds = new Set<string>()
  const geometryNodeIds = new Set<string>()
  const geometryEdgeIds = new Set<string>()
  const socketIds = new Set<string>()
  const hits: FieldContextHit[] = []

  // Forward: carry the field through pure function nodes until it lands on a
  // node that owns geometry. That node is what gives the field its context.
  const queue = [nodeId]
  const visited = new Set<string>([nodeId])
  while (queue.length) {
    const currentId = queue.pop()!
    for (const edge of edgesBySource.get(currentId) ?? []) {
      const consumer = nodeById.get(edge.targetNodeId)
      if (!consumer) continue
      fieldEdgeIds.add(edge.id)
      fieldNodeIds.add(consumer.id)

      if (passesFieldThrough(consumer)) {
        if (!visited.has(consumer.id)) {
          visited.add(consumer.id)
          queue.push(consumer.id)
        }
        continue
      }

      socketIds.add(edge.targetSocketId)
      hits.push(
        resolveContext(consumer, edge.targetSocketId, {
          nodeById,
          edgesByTargetSocket,
          geometryNodeIds,
          geometryEdgeIds,
          socketIds,
        }),
      )
    }
  }

  if (hits.length === 0) return null
  return {
    originNodeId: nodeId,
    originLabel: start.label,
    fieldNodeIds,
    fieldEdgeIds,
    geometryNodeIds,
    geometryEdgeIds,
    socketIds,
    hits,
  }
}

function resolveContext(
  consumer: NodeIR,
  fieldSocketId: string,
  ctx: {
    nodeById: Map<string, NodeIR>
    edgesByTargetSocket: Map<string, EdgeIR>
    geometryNodeIds: Set<string>
    geometryEdgeIds: Set<string>
    socketIds: Set<string>
  },
): FieldContextHit {
  const fieldSocketName = consumer.inputs.find((s) => s.id === fieldSocketId)?.name ?? '(field)'
  const base: FieldContextHit = {
    consumerNodeId: consumer.id,
    consumerLabel: consumer.label,
    fieldSocketName,
    geometrySocketName: null,
    originLabel: null,
    domain: null,
    note: null,
  }

  if (consumer.type === 'NodeGroupOutput') {
    return { ...base, note: 'Field leaves the group — its context is set by the caller' }
  }
  if (UNRESOLVED[consumer.type]) {
    return { ...base, note: UNRESOLVED[consumer.type] }
  }

  const geometryInputs = consumer.inputs.filter(isGeometry)
  const preferred = CONTEXT_GEOMETRY_INPUT[consumer.type]
  const contextSocket =
    (preferred ? geometryInputs.find((s) => s.name === preferred) : undefined) ?? geometryInputs[0]
  if (!contextSocket) {
    return { ...base, note: 'No geometry input — context not resolvable here' }
  }

  ctx.socketIds.add(contextSocket.id)
  ctx.geometryNodeIds.add(consumer.id)

  const incoming = ctx.edgesByTargetSocket.get(contextSocket.id)
  const origin = incoming
    ? traceGeometryBack(
        incoming,
        ctx.nodeById,
        ctx.edgesByTargetSocket,
        ctx.geometryNodeIds,
        ctx.geometryEdgeIds,
      )
    : null

  return {
    ...base,
    geometrySocketName: contextSocket.name,
    originLabel: origin?.label ?? null,
    domain: CONTEXT_DOMAIN[consumer.type] ?? consumer.properties?.domain?.toLowerCase() ?? null,
    note: incoming ? null : 'Geometry input is unconnected',
  }
}
