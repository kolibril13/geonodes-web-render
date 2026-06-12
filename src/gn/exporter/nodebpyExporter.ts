/**
 * Convert a Tree Clipper JSON export into nodebpy Python code.
 * https://github.com/BradyAJohnston/nodebpy
 *
 * The conversion is driven by nodebpySpec.json, a database extracted from the
 * nodebpy source (see scripts/extract_nodebpy_spec.py) that maps each
 * bl_idname to its nodebpy class, constructor parameters (in socket order),
 * enum properties, and `.i` / `.o` socket attribute names.
 */
import rawSpec from './nodebpySpec.json'

type SpecParam = { name: string; default: string | null }
export type SpecSocket = { attr: string; type: string; label: string }
export type SpecEntry = {
  class: string
  params: SpecParam[]
  props: SpecParam[]
  inputs: SpecSocket[]
  outputs: SpecSocket[]
}
export type SpecDb = Record<string, Record<string, SpecEntry>>

const spec = rawSpec as SpecDb

export function getNodebpySpec(): SpecDb {
  return spec
}

// ── Raw Tree Clipper JSON shapes (loose on purpose) ─────────────────────────

type RawSocket = {
  id: number
  data: {
    name: string
    type: string
    enabled?: boolean
    hide_value?: boolean
    default_value?: unknown
  }
}

type RawNodeData = {
  name: string
  label?: string
  bl_idname: string
  inputs?: { data: { items: RawSocket[] } }
  outputs?: { data: { items: RawSocket[] } }
  node_tree?: number | null
  single_input?: number
  single_output?: number
  is_active_output?: boolean
  mapping?: unknown
} & Record<string, unknown>

type RawNode = { id: number; data: RawNodeData }

type RawInterfaceItem = {
  id: number
  data: {
    name: string
    socket_type?: string
    in_out?: string
    item_type?: string
    default_value?: unknown
  }
}

type RawLink = { id: number; data: { from_socket: number; to_socket: number } }

type RawTree = {
  id: number
  data: {
    name: string
    bl_idname?: string
    is_modifier?: boolean
    interface?: { data: { items_tree: { data: { items: RawInterfaceItem[] } } } }
    nodes: { data: { items: RawNode[] } }
    links: { data: { items: RawLink[] } }
  }
}

type RawExport = { node_trees: RawTree[] }

// ── Small helpers ───────────────────────────────────────────────────────────

function snake(name: string): string {
  const s = name
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .toLowerCase()
    .replace(/^_+|_+$/g, '')
    .replace(/__+/g, '_')
  return s.length > 0 ? (/^[0-9]/.test(s) ? `n${s}` : s) : 'socket'
}

function pascal(name: string): string {
  const p = name
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join('')
  return /^[0-9]/.test(p) ? `Group${p}` : p || 'Group'
}

function pyString(s: string): string {
  return JSON.stringify(s)
}

function pyNumber(v: number): string {
  if (Number.isInteger(v)) return String(v)
  return String(parseFloat(v.toFixed(6)))
}

function pyValue(v: unknown): string {
  if (typeof v === 'boolean') return v ? 'True' : 'False'
  if (typeof v === 'number') return pyNumber(v)
  if (typeof v === 'string') return pyString(v)
  if (Array.isArray(v)) return `(${v.map(pyValue).join(', ')})`
  return 'None'
}

/** Parse a python literal from the spec db (defaults) into a JS value. */
function parsePyLiteral(src: string | null): unknown {
  if (src === null) return undefined
  const s = src.trim()
  if (s === 'None') return null
  if (s === 'True') return true
  if (s === 'False') return false
  if (/^-?\d+$/.test(s)) return parseInt(s, 10)
  if (/^-?\d*\.\d+$/.test(s)) return parseFloat(s)
  const str = s.match(/^['"](.*)['"]$/)
  if (str) return str[1]
  if (s.startsWith('(') && s.endsWith(')')) {
    const inner = s.slice(1, -1).trim().replace(/,$/, '')
    if (inner === '') return []
    const parts = inner.split(',').map((p) => parseFloat(p))
    if (parts.every((p) => !Number.isNaN(p))) return parts
  }
  return undefined
}

function valuesEqual(exported: unknown, specDefault: unknown): boolean {
  if (specDefault === undefined) return false
  if (typeof exported === 'number' && typeof specDefault === 'number') {
    return Math.abs(exported - specDefault) < 1e-6
  }
  if (Array.isArray(exported) && Array.isArray(specDefault)) {
    return (
      exported.length === specDefault.length &&
      exported.every((v, i) => valuesEqual(v, specDefault[i]))
    )
  }
  return exported === specDefault
}

/** Allocates unique python identifiers within one generated scope. */
class NameAllocator {
  private used = new Set<string>()

  claim(base: string): string {
    let name = base
    let n = 0
    while (this.used.has(name) || PY_RESERVED.has(name)) {
      n += 1
      name = `${base}_${String(n).padStart(3, '0')}`
    }
    this.used.add(name)
    return name
  }
}

const PY_RESERVED = new Set([
  'and', 'as', 'assert', 'break', 'class', 'continue', 'def', 'del', 'elif',
  'else', 'except', 'finally', 'for', 'from', 'global', 'if', 'import', 'in',
  'is', 'lambda', 'nonlocal', 'not', 'or', 'pass', 'raise', 'return', 'tree',
  'try', 'while', 'with', 'yield', 'g', 's', 'c',
])

const INTERFACE_METHODS: Record<string, string> = {
  NodeSocketGeometry: 'geometry',
  NodeSocketFloat: 'float',
  NodeSocketInt: 'integer',
  NodeSocketBool: 'boolean',
  NodeSocketVector: 'vector',
  NodeSocketColor: 'color',
  NodeSocketString: 'string',
  NodeSocketRotation: 'rotation',
  NodeSocketMatrix: 'matrix',
  NodeSocketMenu: 'menu',
  NodeSocketObject: 'object',
  NodeSocketCollection: 'collection',
  NodeSocketMaterial: 'material',
  NodeSocketImage: 'image',
}

/** Interface socket types whose tree.inputs.* method accepts default_value. */
const INTERFACE_DEFAULTABLE = new Set([
  'NodeSocketFloat', 'NodeSocketInt', 'NodeSocketBool', 'NodeSocketVector',
  'NodeSocketColor', 'NodeSocketString',
])

// ── Per-tree conversion ─────────────────────────────────────────────────────

type TreeContext = {
  tree: RawTree
  module: 'geometry' | 'shader' | 'compositor'
  /** Module alias in generated code: g / s / c */
  alias: string
  /** Class names of group trees, by tree id. */
  groupClassByTreeId: Map<number, string>
  groupTreeById: Map<number, RawTree>
}

function moduleForTree(tree: RawTree): TreeContext['module'] {
  const bl = tree.data.bl_idname ?? 'GeometryNodeTree'
  if (bl === 'ShaderNodeTree') return 'shader'
  if (bl === 'CompositorNodeTree') return 'compositor'
  return 'geometry'
}

const MODULE_ALIAS: Record<TreeContext['module'], string> = {
  geometry: 'g',
  shader: 's',
  compositor: 'c',
}

function inputSockets(node: RawNode): RawSocket[] {
  return node.data.inputs?.data?.items ?? []
}

function outputSockets(node: RawNode): RawSocket[] {
  return node.data.outputs?.data?.items ?? []
}

function isVirtualSocket(s: RawSocket): boolean {
  return s.data.type === 'CUSTOM'
}

function convertTreeBody(ctx: TreeContext, indent: string): string[] {
  const { tree, alias } = ctx
  const lines: string[] = []
  const names = new NameAllocator()

  const allNodes = tree.data.nodes.data.items
  const rawLinks = tree.data.links.data.items

  // -- Reroute resolution: links pass through reroutes transparently. --------
  const rerouteByInput = new Map<number, RawNode>()
  const rerouteByOutput = new Map<number, RawNode>()
  for (const n of allNodes) {
    if (n.data.bl_idname !== 'NodeReroute') continue
    if (n.data.single_input !== undefined) rerouteByInput.set(n.data.single_input, n)
    if (n.data.single_output !== undefined) rerouteByOutput.set(n.data.single_output, n)
  }
  const linkIntoSocket = new Map<number, RawLink>()
  for (const l of rawLinks) linkIntoSocket.set(l.data.to_socket, l)

  function resolveSource(fromSocket: number, depth = 0): number | null {
    const reroute = rerouteByOutput.get(fromSocket)
    if (!reroute || depth > 64) return reroute ? null : fromSocket
    const upstream =
      reroute.data.single_input !== undefined
        ? linkIntoSocket.get(reroute.data.single_input)
        : undefined
    if (!upstream) return null
    return resolveSource(upstream.data.from_socket, depth + 1)
  }

  type Link = { from: number; to: number }
  const links: Link[] = []
  for (const l of rawLinks) {
    if (rerouteByInput.has(l.data.to_socket)) continue
    const from = resolveSource(l.data.from_socket)
    if (from !== null) links.push({ from, to: l.data.to_socket })
  }

  // -- Index nodes and sockets. ----------------------------------------------
  const nodes = allNodes.filter((n) => n.data.bl_idname !== 'NodeReroute')
  const nodeBySocket = new Map<number, RawNode>()
  const socketById = new Map<number, RawSocket>()
  const socketIndex = new Map<number, number>()
  for (const n of nodes) {
    inputSockets(n).forEach((s, i) => {
      nodeBySocket.set(s.id, n)
      socketById.set(s.id, s)
      socketIndex.set(s.id, i)
    })
    outputSockets(n).forEach((s, i) => {
      nodeBySocket.set(s.id, n)
      socketById.set(s.id, s)
      socketIndex.set(s.id, i)
    })
  }
  const linksInto = new Map<number, Link[]>()
  for (const l of links) {
    const arr = linksInto.get(l.to)
    if (arr) arr.push(l)
    else linksInto.set(l.to, [l])
  }

  // -- Special nodes. ---------------------------------------------------------
  const groupInputNodes = nodes.filter((n) => n.data.bl_idname === 'NodeGroupInput')
  const groupOutputNodes = nodes.filter((n) => n.data.bl_idname === 'NodeGroupOutput')
  const activeGroupOutput =
    groupOutputNodes.find((n) => n.data.is_active_output) ?? groupOutputNodes[0]
  const simInput = nodes.find((n) => n.data.bl_idname === 'GeometryNodeSimulationInput')
  const simOutput = nodes.find((n) => n.data.bl_idname === 'GeometryNodeSimulationOutput')

  // -- Interface sockets (declared up front to preserve interface order). ----
  const ifaceItems =
    tree.data.interface?.data?.items_tree?.data?.items?.filter(
      (i) => (i.data.item_type ?? 'SOCKET') === 'SOCKET',
    ) ?? []
  // Interface sockets can share names ("Transform" twice), so group in/out
  // node sockets are matched to these vars positionally, not by name.
  const ifaceInVars: string[] = []
  const ifaceOutVars: string[] = []
  for (const item of ifaceItems) {
    const d = item.data
    const method = INTERFACE_METHODS[d.socket_type ?? ''] ?? 'float'
    if (d.in_out === 'INPUT') {
      const v = names.claim(snake(d.name))
      ifaceInVars.push(v)
      const def =
        d.default_value !== undefined && INTERFACE_DEFAULTABLE.has(d.socket_type ?? '')
          ? `, default_value=${pyValue(d.default_value)}`
          : ''
      lines.push(`${indent}${v} = tree.inputs.${method}(${pyString(d.name)}${def})`)
    } else if (d.in_out === 'OUTPUT') {
      const v = names.claim(`${snake(d.name)}_out`)
      ifaceOutVars.push(v)
      lines.push(`${indent}${v} = tree.outputs.${method}(${pyString(d.name)})`)
    }
  }
  if (ifaceItems.length > 0) lines.push('')

  // -- Expression for a source socket, filled in as nodes are emitted. -------
  const sourceExpr = new Map<number, string>()

  for (const gi of groupInputNodes) {
    const real = outputSockets(gi).filter((s) => !isVirtualSocket(s))
    real.forEach((s, i) => {
      const v = ifaceInVars[i]
      if (v) sourceExpr.set(s.id, v)
    })
  }

  // -- Simulation zone wiring. ------------------------------------------------
  let zoneVar: string | null = null
  const zoneItemNames: string[] = []
  if (simInput && simOutput) {
    zoneVar = names.claim('zone')
    for (const s of inputSockets(simOutput)) {
      if (isVirtualSocket(s) || s.data.name === 'Skip') continue
      zoneItemNames.push(s.data.name)
    }
    for (const s of outputSockets(simInput)) {
      if (isVirtualSocket(s)) continue
      sourceExpr.set(
        s.id,
        s.data.name === 'Delta Time'
          ? `${zoneVar}.delta_time`
          : `${zoneVar}.input.o.${snake(s.data.name)}`,
      )
    }
    for (const s of outputSockets(simOutput)) {
      if (isVirtualSocket(s)) continue
      sourceExpr.set(s.id, `${zoneVar}.output.o.${snake(s.data.name)}`)
    }
  }

  // -- Topological order. ------------------------------------------------------
  // The simulation pair is fused: simOutput's inbound links become trailing
  // statements, so only simInput's dependencies (the initial state values)
  // constrain the zone's position.
  const emittable = nodes.filter(
    (n) =>
      n.data.bl_idname !== 'NodeGroupInput' &&
      n.data.bl_idname !== 'NodeGroupOutput' &&
      n !== simOutput,
  )
  const nodeKey = (n: RawNode) => n.id
  const indeg = new Map<number, number>()
  const adj = new Map<number, number[]>()
  const emittableIds = new Set(emittable.map(nodeKey))
  for (const n of emittable) indeg.set(n.id, 0)
  for (const l of links) {
    const srcNode = nodeBySocket.get(l.from)
    const dstNode = nodeBySocket.get(l.to)
    if (!srcNode || !dstNode) continue
    const src = srcNode === simOutput ? simInput! : srcNode
    const dst = dstNode === simOutput ? null : dstNode // trailing statements
    if (!dst || src === dst) continue
    if (!emittableIds.has(src.id) || !emittableIds.has(dst.id)) continue
    adj.set(src.id, [...(adj.get(src.id) ?? []), dst.id])
    indeg.set(dst.id, (indeg.get(dst.id) ?? 0) + 1)
  }
  const queue = emittable.filter((n) => (indeg.get(n.id) ?? 0) === 0)
  const ordered: RawNode[] = []
  const byId = new Map(emittable.map((n) => [n.id, n]))
  while (queue.length > 0) {
    const n = queue.shift()!
    ordered.push(n)
    for (const m of adj.get(n.id) ?? []) {
      indeg.set(m, indeg.get(m)! - 1)
      if (indeg.get(m) === 0) queue.push(byId.get(m)!)
    }
  }
  // Cycles (shouldn't happen) fall back to original order.
  if (ordered.length < emittable.length) {
    const seen = new Set(ordered.map(nodeKey))
    for (const n of emittable) if (!seen.has(n.id)) ordered.push(n)
  }

  // -- Emit nodes. -------------------------------------------------------------
  const trailing: string[] = []

  function linkedExpr(socket: RawSocket): string | null {
    const inbound = linksInto.get(socket.id)
    if (!inbound || inbound.length === 0) return null
    return sourceExpr.get(inbound[0].from) ?? null
  }

  function emitNode(node: RawNode) {
    const d = node.data
    const ins = inputSockets(node)
    const outs = outputSockets(node)

    // Simulation zone: emitted once, at the input node's position.
    if (node === simInput && zoneVar) {
      const items: string[] = []
      const unlinked: Array<{ name: string; type: string }> = []
      for (const name of zoneItemNames) {
        const sock = ins.find((s) => s.data.name === name)
        const expr = sock ? linkedExpr(sock) : null
        if (expr) items.push(`${pyString(name)}: ${expr}`)
        else {
          const type =
            inputSockets(simOutput!).find((s) => s.data.name === name)?.data.type ?? 'GEOMETRY'
          unlinked.push({ name, type })
        }
      }
      lines.push(`${indent}${zoneVar} = ${alias}.SimulationZone(items={${items.join(', ')}})`)
      for (const item of unlinked) {
        lines.push(
          `${indent}${zoneVar}.output._add_socket(name=${pyString(item.name)}, type=${pyString(item.type)})  # state item without an initial value`,
        )
      }
      return
    }

    // Group node referencing another exported tree.
    const groupClass =
      d.node_tree != null ? ctx.groupClassByTreeId.get(d.node_tree as number) : undefined
    if (groupClass) {
      const varName = names.claim(snake(d.name))
      const kwargs: string[] = []
      for (const s of ins) {
        if (isVirtualSocket(s) || s.data.enabled === false) continue
        const expr = linkedExpr(s)
        if (expr) kwargs.push(`${pyString(s.data.name)}: ${expr}`)
        else if (s.data.default_value !== undefined && !s.data.hide_value) {
          kwargs.push(`${pyString(s.data.name)}: ${pyValue(s.data.default_value)}`)
        }
      }
      const arg = kwargs.length > 0 ? `**{${kwargs.join(', ')}}` : ''
      lines.push(`${indent}${varName} = ${groupClass}(${arg})`)
      for (const s of outs) {
        if (isVirtualSocket(s)) continue
        sourceExpr.set(s.id, `${varName}.o.${snake(s.data.name)}`)
      }
      return
    }

    // The shader/compositor modules re-export many geometry-module classes,
    // so fall back to the geometry bucket for shared bl_idnames.
    const entry = spec[ctx.module]?.[d.bl_idname] ?? spec.geometry?.[d.bl_idname]
    if (!entry) {
      lines.push(`${indent}# Unsupported node type: ${d.bl_idname} (${d.name})`)
      return
    }

    const varName = names.claim(snake(d.name))
    const kwargs: string[] = []
    const usedParams = new Set<string>()
    const positionalMode = entry.params.length === ins.length

    // `.i` attribute names. Hand-written nodebpy classes (Compare, Switch, …)
    // expose dynamic accessors named after the socket (`.i.a` serves every
    // "A" variant), so prefer a name match against the spec's accessor list;
    // otherwise fall back to Blender-identifier-style deduplication.
    const specAttrs = new Set(
      entry.inputs.map((i) => i.attr).filter((n) => !n.startsWith('_')),
    )
    const seenNames = new Map<string, number>()
    const iAttr = ins.map((s) => {
      const plain = snake(s.data.name)
      const count = seenNames.get(s.data.name) ?? 0
      seenNames.set(s.data.name, count + 1)
      if (specAttrs.has(plain)) return plain
      return count === 0 ? plain : `${plain}_${String(count).padStart(3, '0')}`
    })

    for (const [idx, s] of ins.entries()) {
      if (isVirtualSocket(s)) continue
      const inbound = linksInto.get(s.id) ?? []
      const param = positionalMode ? entry.params[idx] : undefined
      if (inbound.length > 0) {
        const exprs = inbound
          .map((l) => sourceExpr.get(l.from))
          .filter((e): e is string => e !== undefined)
        if (exprs.length === 0) continue
        if (param && param.default === '()') {
          kwargs.push(`${param.name}=(${exprs.join(', ')}${exprs.length === 1 ? ',' : ''})`)
          usedParams.add(param.name)
        } else if (param) {
          kwargs.push(`${param.name}=${exprs[0]}`)
          usedParams.add(param.name)
          for (const extra of exprs.slice(1)) {
            trailing.push(`${indent}${extra} >> ${varName}.i.${iAttr[idx]}`)
          }
        } else {
          for (const expr of exprs) {
            trailing.push(`${indent}${expr} >> ${varName}.i.${iAttr[idx]}`)
          }
        }
      } else if (
        param &&
        s.data.default_value !== undefined &&
        !s.data.hide_value &&
        s.data.enabled !== false &&
        !valuesEqual(s.data.default_value, parsePyLiteral(param.default))
      ) {
        kwargs.push(`${param.name}=${pyValue(s.data.default_value)}`)
        usedParams.add(param.name)
      }
    }

    // Node-level values that map to constructor params (e.g. the Vector input
    // node's `vector`, Compare's `operation`/`data_type`) or enum props.
    for (const p of [...entry.params, ...entry.props]) {
      if (usedParams.has(p.name)) continue
      const v = d[p.name]
      if (v === undefined || v === null) continue
      if (typeof v === 'object' && !Array.isArray(v)) continue
      if (valuesEqual(v, parsePyLiteral(p.default))) continue
      kwargs.push(`${p.name}=${pyValue(v)}`)
      usedParams.add(p.name)
    }

    // The Value node stores its number on the output socket.
    if (d.bl_idname === 'ShaderNodeValue' && !usedParams.has('value')) {
      const v = outs[0]?.data.default_value
      if (typeof v === 'number') kwargs.unshift(`value=${pyNumber(v)}`)
    }

    const note = d.mapping !== undefined ? '  # NOTE: curve points are not converted' : ''
    lines.push(`${indent}${varName} = ${alias}.${entry.class}(${kwargs.join(', ')})${note}`)

    const seenOut = new Map<string, number>()
    for (const [idx, s] of outs.entries()) {
      if (isVirtualSocket(s)) continue
      const count = seenOut.get(s.data.name) ?? 0
      seenOut.set(s.data.name, count + 1)
      const fallback =
        count === 0 ? snake(s.data.name) : `${snake(s.data.name)}_${String(count).padStart(3, '0')}`
      sourceExpr.set(s.id, `${varName}.o.${entry.outputs[idx]?.attr ?? fallback}`)
    }
  }

  for (const node of ordered) emitNode(node)

  // -- Trailing link statements. ------------------------------------------------
  if (simOutput && zoneVar) {
    for (const s of inputSockets(simOutput)) {
      if (isVirtualSocket(s)) continue
      const expr = linkedExpr(s)
      if (!expr) continue
      const attr = s.data.name === 'Skip' ? 'skip' : snake(s.data.name)
      trailing.push(`${indent}${expr} >> ${zoneVar}.output.i.${attr}`)
    }
  }
  if (activeGroupOutput) {
    const real = inputSockets(activeGroupOutput).filter((s) => !isVirtualSocket(s))
    real.forEach((s, i) => {
      const expr = linkedExpr(s)
      const target = ifaceOutVars[i]
      if (expr && target) trailing.push(`${indent}${expr} >> ${target}`)
    })
  }

  if (trailing.length > 0) {
    lines.push('')
    lines.push(...trailing)
  }
  if (lines.length === 0) lines.push(`${indent}pass`)
  return lines
}

// ── Whole-export conversion ─────────────────────────────────────────────────

export function exportToNodebpy(raw: RawExport): string {
  const trees = raw.node_trees
  if (!Array.isArray(trees) || trees.length === 0) {
    throw new Error('Expected "node_trees" array with at least one entry.')
  }

  const treeById = new Map(trees.map((t) => [t.id, t]))

  // Group dependency edges: tree -> trees it instantiates.
  const deps = new Map<number, number[]>()
  const referenced = new Set<number>()
  for (const t of trees) {
    const list: number[] = []
    for (const n of t.data.nodes.data.items) {
      const ref = n.data.node_tree
      if (ref != null && treeById.has(ref)) {
        list.push(ref)
        referenced.add(ref)
      }
    }
    deps.set(t.id, list)
  }

  const rootCandidates = trees.filter((t) => !referenced.has(t.id))
  const root =
    rootCandidates.find((t) => t.data.is_modifier) ?? rootCandidates[0] ?? trees[0]

  // Emit group trees before the trees that use them (post-order from each root).
  const emitted: RawTree[] = []
  const visited = new Set<number>()
  function visit(id: number) {
    if (visited.has(id)) return
    visited.add(id)
    for (const dep of deps.get(id) ?? []) visit(dep)
    emitted.push(treeById.get(id)!)
  }
  for (const t of trees) if (!referenced.has(t.id)) visit(t.id)
  for (const t of trees) visit(t.id) // safety net for cyclic/dangling refs

  const groupClassByTreeId = new Map<number, string>()
  const classNames = new NameAllocator()
  for (const t of emitted) {
    if (t !== root) groupClassByTreeId.set(t.id, classNames.claim(pascal(t.data.name)))
  }

  const modules = new Set(emitted.map((t) => moduleForTree(t)))
  const hasGroups = groupClassByTreeId.size > 0

  const header: string[] = []
  if (modules.has('geometry')) header.push('from nodebpy import geometry as g')
  if (modules.has('shader')) header.push('from nodebpy import shader as s')
  if (modules.has('compositor')) header.push('from nodebpy import compositor as c')
  if (hasGroups) {
    header.push('from nodebpy import TreeBuilder')
    header.push('from nodebpy.builder import CustomGeometryGroup')
  }

  const blocks: string[] = []
  for (const t of emitted) {
    const ctx: TreeContext = {
      tree: t,
      module: moduleForTree(t),
      alias: MODULE_ALIAS[moduleForTree(t)],
      groupClassByTreeId,
      groupTreeById: treeById,
    }
    if (t === root) {
      const factory =
        ctx.module === 'shader' ? 's.material' : `${ctx.alias}.tree`
      const body = convertTreeBody(ctx, '    ')
      blocks.push(
        [`with ${factory}(${pyString(t.data.name)}) as tree:`, ...body].join('\n'),
      )
    } else {
      const cls = groupClassByTreeId.get(t.id)!
      const body = convertTreeBody(ctx, '        ')
      blocks.push(
        [
          `class ${cls}(CustomGeometryGroup):`,
          `    _name = ${pyString(t.data.name)}`,
          '',
          '    def _build_group(self, tree: TreeBuilder) -> None:',
          ...body,
        ].join('\n'),
      )
    }
  }

  return [
    '# Generated from a Tree Clipper export by geonodes-web-render.',
    '# https://github.com/BradyAJohnston/nodebpy',
    ...header,
    '',
    '',
    ...blocks.flatMap((b) => [b, '', '']),
  ]
    .join('\n')
    .replace(/\n{3,}$/, '\n')
}
