/**
 * Parse nodebpy Python code (https://github.com/BradyAJohnston/nodebpy) into
 * a synthesized Tree Clipper export, so the existing render pipeline
 * (normalizeBlenderExport → GraphIR → React Flow) can display it.
 *
 * This is not a Python interpreter: it understands the statement shapes that
 * nodebpy trees are written in —
 *
 *   with g.tree("Name") as tree:
 *       count = tree.inputs.integer("Count", 10)
 *       out = tree.outputs.geometry("Geometry")
 *       cube = g.Cube(size=(1, 1, 1))
 *       points = g.Points(count=count) >> g.InstanceOnPoints(instance=cube)
 *       points.o.instances >> out
 *
 *   class MyGroup(CustomGeometryGroup):
 *       _name = "My Group"
 *       def _build_group(self, tree): ...
 *
 * plus simulation zones and group instantiation. Unknown statements raise
 * with a line number so the UI can show where parsing stopped.
 */
import { getNodebpySpec, type SpecEntry, type SpecSocket } from '../exporter/nodebpyExporter'

// ── Synthesized Tree Clipper JSON shapes ────────────────────────────────────

type JsonSocket = {
  id: number
  data: {
    name: string
    type: string
    display_shape: string
    enabled: boolean
    hide_value: boolean
    default_value?: unknown
  }
}

type JsonNode = {
  id: number
  data: Record<string, unknown> & {
    name: string
    label: string
    bl_idname: string
    location: [number, number]
    width: number
    inputs: { data: { items: JsonSocket[] } }
    outputs: { data: { items: JsonSocket[] } }
  }
}

const BUILDER_SOCKET_TYPES: Record<string, string> = {
  FloatSocket: 'VALUE',
  IntegerSocket: 'INT',
  BooleanSocket: 'BOOLEAN',
  VectorSocket: 'VECTOR',
  ColorSocket: 'RGBA',
  RotationSocket: 'ROTATION',
  MatrixSocket: 'MATRIX',
  StringSocket: 'STRING',
  GeometrySocket: 'GEOMETRY',
  MenuSocket: 'MENU',
  ObjectSocket: 'OBJECT',
  CollectionSocket: 'COLLECTION',
  MaterialSocket: 'MATERIAL',
  ImageSocket: 'IMAGE',
  ShaderSocket: 'SHADER',
  TextureSocket: 'TEXTURE',
}

const INTERFACE_METHOD_TYPES: Record<string, { socketType: string; dataType: string }> = {
  geometry: { socketType: 'NodeSocketGeometry', dataType: 'GEOMETRY' },
  float: { socketType: 'NodeSocketFloat', dataType: 'VALUE' },
  integer: { socketType: 'NodeSocketInt', dataType: 'INT' },
  boolean: { socketType: 'NodeSocketBool', dataType: 'BOOLEAN' },
  vector: { socketType: 'NodeSocketVector', dataType: 'VECTOR' },
  color: { socketType: 'NodeSocketColor', dataType: 'RGBA' },
  string: { socketType: 'NodeSocketString', dataType: 'STRING' },
  rotation: { socketType: 'NodeSocketRotation', dataType: 'ROTATION' },
  matrix: { socketType: 'NodeSocketMatrix', dataType: 'MATRIX' },
  menu: { socketType: 'NodeSocketMenu', dataType: 'MENU' },
  object: { socketType: 'NodeSocketObject', dataType: 'OBJECT' },
  collection: { socketType: 'NodeSocketCollection', dataType: 'COLLECTION' },
  material: { socketType: 'NodeSocketMaterial', dataType: 'MATERIAL' },
  image: { socketType: 'NodeSocketImage', dataType: 'IMAGE' },
}

const MODULE_BY_ALIAS: Record<string, string> = {
  g: 'geometry',
  s: 'shader',
  c: 'compositor',
  geometry: 'geometry',
  shader: 'shader',
  compositor: 'compositor',
}

function classLabel(className: string): string {
  return className.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
}

function snake(name: string): string {
  return name
    .replace(/[^A-Za-z0-9]+/g, '_')
    .toLowerCase()
    .replace(/^_+|_+$/g, '')
}

// ── Python value scanner (literals, refs, calls) ────────────────────────────

type PyValue =
  | { kind: 'literal'; value: unknown }
  | { kind: 'ref'; path: string[] }
  | { kind: 'tuple'; items: PyValue[] }
  | { kind: 'dict'; entries: Map<string, PyValue> }
  | { kind: 'call'; target: string[]; args: PyValue[]; kwargs: Map<string, PyValue>; dictKwargs: Map<string, PyValue> }

class ParseError extends Error {
  line: number
  constructor(message: string, line: number) {
    super(`Line ${line}: ${message}`)
    this.line = line
  }
}

/** Split `src` on `sep` at paren/bracket/string depth zero. */
function splitTop(src: string, sep: string): string[] {
  const parts: string[] = []
  let depth = 0
  let cur = ''
  let i = 0
  while (i < src.length) {
    const ch = src[i]
    if (ch === '"' || ch === "'") {
      const quote = ch
      cur += ch
      i++
      while (i < src.length && src[i] !== quote) {
        cur += src[i]
        i++
      }
      cur += src[i] ?? ''
      i++
      continue
    }
    if ('([{'.includes(ch)) depth++
    if (')]}'.includes(ch)) depth--
    if (depth === 0 && src.startsWith(sep, i)) {
      parts.push(cur)
      cur = ''
      i += sep.length
      continue
    }
    cur += ch
    i++
  }
  parts.push(cur)
  return parts
}

function parseValue(src: string, line: number): PyValue {
  const s = src.trim()
  if (s.length === 0) throw new ParseError('Empty expression', line)

  if (s === 'True') return { kind: 'literal', value: true }
  if (s === 'False') return { kind: 'literal', value: false }
  if (s === 'None') return { kind: 'literal', value: null }
  if (/^-?\d+\.?\d*(e-?\d+)?$/i.test(s) || /^-?\.\d+$/.test(s)) {
    return { kind: 'literal', value: parseFloat(s) }
  }
  const str = s.match(/^"((?:[^"\\]|\\.)*)"$/) ?? s.match(/^'((?:[^'\\]|\\.)*)'$/)
  if (str) return { kind: 'literal', value: str[1].replace(/\\(.)/g, '$1') }

  if (s.startsWith('{') && s.endsWith('}')) {
    const entries = new Map<string, PyValue>()
    const body = s.slice(1, -1).trim().replace(/,\s*$/, '')
    if (body.length > 0) {
      for (const entry of splitTop(body, ',')) {
        const [k, ...rest] = splitTop(entry, ':')
        const key = parseValue(k, line)
        if (key.kind !== 'literal' || typeof key.value !== 'string') {
          throw new ParseError(`Dict keys must be strings: ${entry}`, line)
        }
        entries.set(key.value, parseValue(rest.join(':'), line))
      }
    }
    return { kind: 'dict', entries }
  }

  if ((s.startsWith('(') || s.startsWith('[')) && (s.endsWith(')') || s.endsWith(']'))) {
    const inner = s.slice(1, -1).trim().replace(/,\s*$/, '')
    if (inner === '') return { kind: 'literal', value: [] }
    const parts = splitTop(inner, ',').map((p) => parseValue(p, line))
    // A parenthesized single expression is just that expression.
    if (s.startsWith('(') && parts.length === 1 && !s.slice(1, -1).includes(',')) return parts[0]
    if (parts.every((p) => p.kind === 'literal')) {
      return { kind: 'literal', value: parts.map((p) => (p as { value: unknown }).value) }
    }
    return { kind: 'tuple', items: parts }
  }

  // call: dotted.path(...)
  const call = s.match(/^([A-Za-z_][\w.]*)\s*\((.*)\)$/s)
  if (call) {
    const target = call[1].split('.')
    const args: PyValue[] = []
    const kwargs = new Map<string, PyValue>()
    const dictKwargs = new Map<string, PyValue>()
    const argSrc = call[2].trim()
    if (argSrc.length > 0) {
      for (const part of splitTop(argSrc, ',')) {
        const p = part.trim()
        if (p.length === 0) continue
        if (p.startsWith('**')) {
          const dict = p.slice(2).trim()
          if (!dict.startsWith('{') || !dict.endsWith('}')) {
            throw new ParseError(`Expected **{...}: ${p}`, line)
          }
          const body = dict.slice(1, -1).trim()
          if (body.length > 0) {
            for (const entry of splitTop(body, ',')) {
              const [k, ...rest] = splitTop(entry, ':')
              const key = parseValue(k, line)
              if (key.kind !== 'literal' || typeof key.value !== 'string') {
                throw new ParseError(`Dict keys must be strings: ${entry}`, line)
              }
              dictKwargs.set(key.value, parseValue(rest.join(':'), line))
            }
          }
          continue
        }
        const kw = p.match(/^([A-Za-z_]\w*)\s*=(?![=])([\s\S]*)$/)
        if (kw) kwargs.set(kw[1], parseValue(kw[2], line))
        else args.push(parseValue(p, line))
      }
    }
    return { kind: 'call', target, args, kwargs, dictKwargs }
  }

  if (/^[A-Za-z_][\w.]*$/.test(s)) return { kind: 'ref', path: s.split('.') }

  throw new ParseError(`Cannot parse expression: ${s}`, line)
}

// ── Tree building ────────────────────────────────────────────────────────────

type SocketRef = { socketId: number }

type Binding =
  | { kind: 'node'; node: JsonNode; entry: SpecEntry | null; inputs: JsonSocket[]; outputs: JsonSocket[]; inputAttrs: string[]; outputAttrs: string[] }
  | { kind: 'ifaceIn'; socket: JsonSocket }
  | { kind: 'ifaceOut'; socket: JsonSocket }
  | { kind: 'zone'; simIn: Binding & { kind: 'node' }; simOut: Binding & { kind: 'node' } }

type GroupClassInfo = {
  treeId: number
  inputs: Array<{ name: string; dataType: string }>
  outputs: Array<{ name: string; dataType: string }>
}

class TreeBuilderState {
  nodes: JsonNode[] = []
  links: Array<{ id: number; data: { from_socket: number; to_socket: number } }> = []
  ifaceItems: Array<{ id: number; data: Record<string, unknown> }> = []
  vars = new Map<string, Binding>()
  groupInputNode: JsonNode | null = null
  groupOutputNode: JsonNode | null = null
  treeId: number
  name: string
  module: string
  isRoot: boolean

  constructor(treeId: number, name: string, module: string, isRoot: boolean) {
    this.treeId = treeId
    this.name = name
    this.module = module
    this.isRoot = isRoot
  }
}

export function parseNodebpy(source: string): unknown {
  const spec = getNodebpySpec()
  // class name -> bl_idname per module
  const classIndex = new Map<string, Map<string, { blIdname: string; entry: SpecEntry }>>()
  for (const [module, entries] of Object.entries(spec)) {
    const m = new Map<string, { blIdname: string; entry: SpecEntry }>()
    for (const [blIdname, entry] of Object.entries(entries)) {
      if (!m.has(entry.class)) m.set(entry.class, { blIdname, entry })
    }
    classIndex.set(module, m)
  }

  let nextId = 1
  const newId = () => nextId++

  const trees: TreeBuilderState[] = []
  const groupClasses = new Map<string, GroupClassInfo>()

  // ── join physical lines into logical statements (parens may span lines) ──
  type Stmt = { text: string; indent: number; line: number }
  const stmts: Stmt[] = []
  const physical = source.split('\n')
  for (let i = 0; i < physical.length; i++) {
    const raw = physical[i]
    const line = i + 1
    const stripped = raw.replace(/#.*$/, '')
    if (stripped.trim().length === 0) continue
    let depth = 0
    for (const ch of stripped) {
      if ('([{'.includes(ch)) depth++
      if (')]}'.includes(ch)) depth--
    }
    let text = stripped
    while (depth > 0 && i + 1 < physical.length) {
      i++
      const cont = physical[i].replace(/#.*$/, '')
      text += ' ' + cont.trim()
      for (const ch of cont) {
        if ('([{'.includes(ch)) depth++
        if (')]}'.includes(ch)) depth--
      }
    }
    const indent = raw.length - raw.trimStart().length
    stmts.push({ text: text.trim(), indent, line })
  }

  // ── helpers operating on the current tree ───────────────────────────────

  function socketJson(name: string, dataType: string, defaultValue?: unknown): JsonSocket {
    return {
      id: newId(),
      data: {
        name,
        type: dataType,
        display_shape: 'CIRCLE',
        enabled: true,
        hide_value: false,
        ...(defaultValue !== undefined ? { default_value: defaultValue } : {}),
      },
    }
  }

  function makeNode(
    tree: TreeBuilderState,
    blIdname: string,
    label: string,
    inputs: JsonSocket[],
    outputs: JsonSocket[],
    extra: Record<string, unknown> = {},
  ): JsonNode {
    const node: JsonNode = {
      id: newId(),
      data: {
        name: label,
        label: '',
        bl_idname: blIdname,
        location: [0, 0],
        width: 160,
        inputs: { data: { items: inputs } },
        outputs: { data: { items: outputs } },
        ...extra,
      },
    }
    tree.nodes.push(node)
    return node
  }

  function specSockets(sockets: SpecSocket[], skipUnderscore = true): JsonSocket[] {
    return sockets
      .filter((s) => !skipUnderscore || !s.attr.startsWith('_'))
      .map((s) => socketJson(s.label, BUILDER_SOCKET_TYPES[s.type] ?? 'CUSTOM'))
  }

  function nodeBinding(node: JsonNode, entry: SpecEntry | null, inputAttrs: string[], outputAttrs: string[]): Binding & { kind: 'node' } {
    return {
      kind: 'node',
      node,
      entry,
      inputs: node.data.inputs.data.items,
      outputs: node.data.outputs.data.items,
      inputAttrs,
      outputAttrs,
    }
  }

  function addLink(tree: TreeBuilderState, from: number, to: number) {
    tree.links.push({ id: newId(), data: { from_socket: from, to_socket: to } })
  }

  // Deliberately not a type predicate: a negative guard must not narrow away
  // other `call` values (interface calls are a subset of calls).
  function isInterfaceCall(v: PyValue): boolean {
    return (
      v.kind === 'call' &&
      v.target[0] === 'tree' &&
      (v.target[1] === 'inputs' || v.target[1] === 'outputs') &&
      v.target.length === 3
    )
  }

  /** Resolve a value as a source socket; instantiates inline constructor calls. */
  function resolveSource(tree: TreeBuilderState, v: PyValue, line: number): SocketRef {
    if (isInterfaceCall(v)) {
      const binding = handleInterface(tree, null, v as PyValue & { kind: 'call' }, line)
      if (binding.kind !== 'ifaceIn') {
        throw new ParseError('A tree output cannot be used as a source', line)
      }
      return { socketId: binding.socket.id }
    }
    if (v.kind === 'call') {
      const binding = instantiate(tree, v, null, line)
      return resolveBindingSource(binding, [], line)
    }
    if (v.kind !== 'ref') throw new ParseError('Expected a socket reference', line)
    const [head, ...rest] = v.path
    const binding = tree.vars.get(head)
    if (!binding) throw new ParseError(`Unknown name "${head}"`, line)
    return resolveBindingSource(binding, rest, line)
  }

  function resolveBindingSource(binding: Binding, rest: string[], line: number): SocketRef {
    if (binding.kind === 'ifaceIn') return { socketId: binding.socket.id }
    if (binding.kind === 'ifaceOut') throw new ParseError('A tree output cannot be used as a source', line)
    if (binding.kind === 'zone') {
      if (rest[0] === 'delta_time') {
        const s = binding.simIn.outputs.find((o) => o.data.name === 'Delta Time')
        if (s) return { socketId: s.id }
      }
      const side = rest[0] === 'output' ? binding.simOut : binding.simIn
      const attr = rest[2] ?? rest[1]
      const sock = side.outputs.find((o) => snake(o.data.name) === attr)
      if (!sock) throw new ParseError(`Zone has no output "${attr}"`, line)
      return { socketId: sock.id }
    }
    // node
    if (rest.length === 0) {
      const first = binding.outputs[0]
      if (!first) throw new ParseError('Node has no outputs', line)
      return { socketId: first.id }
    }
    if (rest[0] !== 'o' || rest.length < 2) {
      throw new ParseError(`Expected ".o.<socket>", got ".${rest.join('.')}"`, line)
    }
    const attr = rest[1]
    const idx = binding.outputAttrs.indexOf(attr)
    const sock = idx >= 0 ? binding.outputs[idx] : binding.outputs.find((o) => snake(o.data.name) === attr)
    if (!sock) throw new ParseError(`No output socket "${attr}"`, line)
    return { socketId: sock.id }
  }

  /** Resolve a value as a link target (input socket). */
  function resolveTarget(tree: TreeBuilderState, v: PyValue, line: number): SocketRef {
    if (isInterfaceCall(v)) {
      const binding = handleInterface(tree, null, v as PyValue & { kind: 'call' }, line)
      if (binding.kind !== 'ifaceOut') {
        throw new ParseError('A tree input cannot be a link target', line)
      }
      return { socketId: binding.socket.id }
    }
    if (v.kind === 'call') {
      const binding = instantiate(tree, v, null, line)
      const first = binding.inputs.find((s) => !linked(tree, s.id)) ?? binding.inputs[0]
      if (!first) throw new ParseError('Node has no inputs', line)
      return { socketId: first.id }
    }
    if (v.kind !== 'ref') throw new ParseError('Expected a socket reference', line)
    const [head, ...rest] = v.path
    const binding = tree.vars.get(head)
    if (!binding) throw new ParseError(`Unknown name "${head}"`, line)
    if (binding.kind === 'ifaceOut') return { socketId: binding.socket.id }
    if (binding.kind === 'ifaceIn') throw new ParseError('A tree input cannot be a link target', line)
    if (binding.kind === 'zone') {
      const side = rest[0] === 'input' ? binding.simIn : binding.simOut
      const attr = rest[2] ?? rest[1]
      const sock = side.inputs.find((s) => snake(s.data.name) === attr)
      if (!sock) throw new ParseError(`Zone has no input "${attr}"`, line)
      return { socketId: sock.id }
    }
    if (rest.length === 0) {
      const first = binding.inputs.find((s) => !linked(tree, s.id)) ?? binding.inputs[0]
      if (!first) throw new ParseError('Node has no inputs', line)
      return { socketId: first.id }
    }
    if (rest[0] !== 'i' || rest.length < 2) {
      throw new ParseError(`Expected ".i.<socket>", got ".${rest.join('.')}"`, line)
    }
    const attr = rest[1]
    const idx = binding.inputAttrs.indexOf(attr)
    const sock = idx >= 0 ? binding.inputs[idx] : binding.inputs.find((s) => snake(s.data.name) === attr)
    if (!sock) throw new ParseError(`No input socket "${attr}"`, line)
    return { socketId: sock.id }
  }

  function linked(tree: TreeBuilderState, socketId: number): boolean {
    return tree.links.some((l) => l.data.to_socket === socketId)
  }

  /** Instantiate a node / group / zone from a call expression. */
  function instantiate(tree: TreeBuilderState, call: PyValue & { kind: 'call' }, varName: string | null, line: number): Binding & { kind: 'node' } {
    const target = call.target

    // Group class instantiation: bare ClassName(...)
    if (target.length === 1 && groupClasses.has(target[0])) {
      const info = groupClasses.get(target[0])!
      const inputs = info.inputs.map((s) => socketJson(s.name, s.dataType))
      const outputs = info.outputs.map((s) => socketJson(s.name, s.dataType))
      const node = makeNode(tree, 'GeometryNodeGroup', 'Group', inputs, outputs, {
        node_tree: info.treeId,
      })
      const binding = nodeBinding(node, null, inputs.map((s) => snake(s.data.name)), outputs.map((s) => snake(s.data.name)))
      applyKwargs(tree, binding, call, line)
      if (varName) tree.vars.set(varName, binding)
      return binding
    }

    const moduleName = MODULE_BY_ALIAS[target[0]]
    if (!moduleName || target.length !== 2) {
      throw new ParseError(`Unknown constructor "${target.join('.')}"`, line)
    }
    const className = target[1]

    if (className === 'SimulationZone') {
      return instantiateZone(tree, call, varName, line)
    }

    const found =
      classIndex.get(moduleName)?.get(className) ?? classIndex.get('geometry')?.get(className)
    if (!found) throw new ParseError(`Unknown node class "${className}"`, line)

    const inputs = specSockets(found.entry.inputs)
    const outputs = specSockets(found.entry.outputs)
    const inputAttrs = found.entry.inputs.filter((s) => !s.attr.startsWith('_')).map((s) => s.attr)
    const outputAttrs = found.entry.outputs.filter((s) => !s.attr.startsWith('_')).map((s) => s.attr)
    const node = makeNode(tree, found.blIdname, classLabel(className), inputs, outputs)
    const binding = nodeBinding(node, found.entry, inputAttrs, outputAttrs)

    // Positional args map onto constructor params (which mirror input attrs).
    call.args.forEach((arg, i) => {
      const param = found.entry.params[i]
      if (param) call.kwargs.set(param.name, arg)
    })
    applyKwargs(tree, binding, call, line)

    // The Value node keeps its number on the output socket.
    if (found.blIdname === 'ShaderNodeValue') {
      const v = call.kwargs.get('value')
      if (v?.kind === 'literal') outputs[0].data.default_value = v.value
    }

    if (varName) tree.vars.set(varName, binding)
    return binding
  }

  function applyKwargs(tree: TreeBuilderState, binding: Binding & { kind: 'node' }, call: PyValue & { kind: 'call' }, line: number) {
    // **{"Socket Name": value} entries address sockets by display name.
    for (const [name, v] of call.dictKwargs) {
      const sock = binding.inputs.find((s) => s.data.name === name)
      if (!sock) throw new ParseError(`No input socket named "${name}"`, line)
      applyInput(tree, sock, v, line)
    }
    for (const [key, v] of call.kwargs) {
      const idx = binding.inputAttrs.indexOf(key)
      const sock = idx >= 0 ? binding.inputs[idx] : binding.inputs.find((s) => snake(s.data.name) === key)
      if (sock) {
        applyInput(tree, sock, v, line)
        continue
      }
      // Not a socket: store as a node property (operation, data_type, ...).
      if (v.kind === 'literal') binding.node.data[key] = v.value
      else throw new ParseError(`Unknown input "${key}"`, line)
    }
  }

  function applyInput(tree: TreeBuilderState, socket: JsonSocket, v: PyValue, line: number) {
    if (v.kind === 'literal') {
      if (v.value !== null) socket.data.default_value = v.value
      return
    }
    if (v.kind === 'tuple') {
      // Multi-input socket: link every element.
      for (const item of v.items) {
        const src = resolveSource(tree, item, line)
        addLink(tree, src.socketId, socket.id)
      }
      return
    }
    if (v.kind === 'dict') throw new ParseError('Unexpected dict as socket value', line)
    const src = resolveSource(tree, v, line)
    addLink(tree, src.socketId, socket.id)
  }

  function instantiateZone(tree: TreeBuilderState, call: PyValue & { kind: 'call' }, varName: string | null, line: number): Binding & { kind: 'node' } {
    const items: Array<{ name: string; source: PyValue | null }> = []
    const itemsArg = call.kwargs.get('items') ?? call.args[0]
    if (itemsArg) {
      if (itemsArg.kind !== 'dict') {
        throw new ParseError('SimulationZone expects items={...}', line)
      }
      for (const [k, v] of itemsArg.entries) {
        items.push({ name: k, source: v.kind === 'literal' && v.value === null ? null : v })
      }
    }

    const simInInputs = items.map((it) => socketJson(it.name, 'GEOMETRY'))
    const simInOutputs = [socketJson('Delta Time', 'VALUE'), ...items.map((it) => socketJson(it.name, 'GEOMETRY'))]
    const simOutInputs = [socketJson('Skip', 'BOOLEAN'), ...items.map((it) => socketJson(it.name, 'GEOMETRY'))]
    const simOutOutputs = items.map((it) => socketJson(it.name, 'GEOMETRY'))

    const simIn = makeNode(tree, 'GeometryNodeSimulationInput', 'Simulation Input', simInInputs, simInOutputs)
    const simOut = makeNode(tree, 'GeometryNodeSimulationOutput', 'Simulation Output', simOutInputs, simOutOutputs)

    const inBinding = nodeBinding(simIn, null, simInInputs.map((s) => snake(s.data.name)), simInOutputs.map((s) => snake(s.data.name)))
    const outBinding = nodeBinding(simOut, null, simOutInputs.map((s) => snake(s.data.name)), simOutOutputs.map((s) => snake(s.data.name)))

    items.forEach((it, i) => {
      if (it.source) {
        const src = resolveSource(tree, it.source, line)
        addLink(tree, src.socketId, simInInputs[i].id)
      }
    })

    const binding: Binding = { kind: 'zone', simIn: inBinding, simOut: outBinding }
    if (varName) tree.vars.set(varName, binding)
    return inBinding
  }

  function addZoneSocket(zone: Binding & { kind: 'zone' }, name: string, dataType: string) {
    zone.simIn.inputs.push(socketJson(name, dataType))
    zone.simIn.outputs.push(socketJson(name, dataType))
    zone.simOut.inputs.push(socketJson(name, dataType))
    zone.simOut.outputs.push(socketJson(name, dataType))
  }

  function ensureGroupInput(tree: TreeBuilderState): JsonNode {
    if (!tree.groupInputNode) {
      tree.groupInputNode = makeNode(tree, 'NodeGroupInput', 'Group Input', [], [])
    }
    return tree.groupInputNode
  }

  function ensureGroupOutput(tree: TreeBuilderState): JsonNode {
    if (!tree.groupOutputNode) {
      tree.groupOutputNode = makeNode(tree, 'NodeGroupOutput', 'Group Output', [], [], {
        is_active_output: true,
      })
    }
    return tree.groupOutputNode
  }

  function handleInterface(
    tree: TreeBuilderState,
    varName: string | null,
    call: PyValue & { kind: 'call' },
    line: number,
  ): Binding {
    const method = call.target[2]
    const types = INTERFACE_METHOD_TYPES[method]
    if (!types) throw new ParseError(`Unknown interface socket type "${method}"`, line)
    const nameArg = call.args[0]
    const name =
      nameArg?.kind === 'literal' && typeof nameArg.value === 'string'
        ? nameArg.value
        : method[0].toUpperCase() + method.slice(1)
    const def = call.kwargs.get('default_value') ?? call.args[1]
    const defaultValue = def?.kind === 'literal' ? def.value ?? undefined : undefined

    const isInput = call.target[1] === 'inputs'
    tree.ifaceItems.push({
      id: newId(),
      data: {
        name,
        socket_type: types.socketType,
        in_out: isInput ? 'INPUT' : 'OUTPUT',
        item_type: 'SOCKET',
        ...(defaultValue !== undefined ? { default_value: defaultValue } : {}),
      },
    })

    const sock = socketJson(name, types.dataType, defaultValue)
    let binding: Binding
    if (isInput) {
      ensureGroupInput(tree).data.outputs.data.items.push(sock)
      binding = { kind: 'ifaceIn', socket: sock }
    } else {
      ensureGroupOutput(tree).data.inputs.data.items.push(sock)
      binding = { kind: 'ifaceOut', socket: sock }
    }
    if (varName) tree.vars.set(varName, binding)
    return binding
  }

  // ── statement walk ────────────────────────────────────────────────────────

  let currentTree: TreeBuilderState | null = null
  let currentClass: { name: string; treeName: string | null; tree: TreeBuilderState | null } | null = null
  let blockIndent = -1

  function finalizeClass() {
    if (!currentClass?.tree) {
      currentClass = null
      return
    }
    const t = currentClass.tree
    t.name = currentClass.treeName ?? currentClass.name
    groupClasses.set(currentClass.name, {
      treeId: t.treeId,
      inputs: t.ifaceItems
        .filter((i) => i.data.in_out === 'INPUT')
        .map((i) => ({
          name: String(i.data.name),
          dataType: INTERFACE_METHOD_TYPES[
            Object.keys(INTERFACE_METHOD_TYPES).find(
              (k) => INTERFACE_METHOD_TYPES[k].socketType === i.data.socket_type,
            ) ?? 'float'
          ].dataType,
        })),
      outputs: t.ifaceItems
        .filter((i) => i.data.in_out === 'OUTPUT')
        .map((i) => ({
          name: String(i.data.name),
          dataType: INTERFACE_METHOD_TYPES[
            Object.keys(INTERFACE_METHOD_TYPES).find(
              (k) => INTERFACE_METHOD_TYPES[k].socketType === i.data.socket_type,
            ) ?? 'float'
          ].dataType,
        })),
    })
    currentClass = null
  }

  for (const stmt of stmts) {
    const { text, indent, line } = stmt

    // Leaving an indented block?
    if (currentClass && indent === 0 && !text.startsWith('class ')) {
      finalizeClass()
      if (currentTree && !currentTree.isRoot) currentTree = null
    }
    if (currentClass && indent === 0 && text.startsWith('class ')) {
      finalizeClass()
      currentTree = null
    }

    const classMatch = text.match(/^class\s+([A-Za-z_]\w*)\s*\(\s*Custom(\w+)Group\s*\)\s*:/)
    if (classMatch && indent === 0) {
      const module = classMatch[2].toLowerCase() // Geometry / Shader / Compositor
      const t = new TreeBuilderState(newId(), classMatch[1], module, false)
      trees.push(t)
      currentClass = { name: classMatch[1], treeName: null, tree: t }
      currentTree = t
      blockIndent = -1
      continue
    }

    const withMatch = text.match(/^with\s+([A-Za-z_]\w*)\.(tree|material)\s*\((.*)\)\s*as\s+\w+\s*:/)
    if (withMatch && indent === 0) {
      finalizeClass()
      const module = MODULE_BY_ALIAS[withMatch[1]] ?? 'geometry'
      const nameArg = withMatch[3].trim().length > 0 ? parseValue(splitTop(withMatch[3], ',')[0], line) : null
      const name =
        nameArg?.kind === 'literal' && typeof nameArg.value === 'string' ? nameArg.value : 'Geometry Nodes'
      const t = new TreeBuilderState(newId(), name, module, true)
      trees.push(t)
      currentTree = t
      blockIndent = -1
      continue
    }

    if (currentClass) {
      const nameMatch = text.match(/^_name\s*=\s*(['"])(.*)\1/)
      if (nameMatch) {
        currentClass.treeName = nameMatch[2]
        continue
      }
      if (/^def\s+_build_group\s*\(/.test(text)) continue
      if (/^_\w+\s*=/.test(text)) continue // other class attrs (_color_tag, ...)
    }

    if (!currentTree) {
      if (/^(from|import)\s/.test(text)) continue
      throw new ParseError(`Statement outside a tree context: ${text.slice(0, 60)}`, line)
    }
    if (/^(from|import)\s/.test(text)) continue
    if (blockIndent === -1) blockIndent = indent
    void blockIndent

    const tree = currentTree

    // zone.output._add_socket(name="X", type="Y")
    const addSocket = text.match(/^([A-Za-z_]\w*)\.output\._add_socket\s*\((.*)\)\s*(#.*)?$/)
    if (addSocket) {
      const binding = tree.vars.get(addSocket[1])
      if (binding?.kind !== 'zone') throw new ParseError(`"${addSocket[1]}" is not a zone`, line)
      const callVal = parseValue(`x(${addSocket[2]})`, line) as PyValue & { kind: 'call' }
      const name = callVal.kwargs.get('name')
      const type = callVal.kwargs.get('type')
      addZoneSocket(
        binding,
        name?.kind === 'literal' ? String(name.value) : 'Item',
        type?.kind === 'literal' ? String(type.value) : 'GEOMETRY',
      )
      continue
    }

    // Split off an optional `var =` prefix, then strip a paren wrapper from
    // the RHS so `x = (a >> b >> c)` and bare `a >> b` share one path.
    let bindVar: string | null = null
    let expr = text
    const assign = text.match(/^([A-Za-z_]\w*)\s*=\s*(?![=])([\s\S]+)$/)
    if (assign && !text.startsWith('if') && splitTop(text, '=')[0].trim().match(/^[A-Za-z_]\w*$/)) {
      bindVar = assign[1]
      expr = assign[2].trim()
    }
    while (expr.startsWith('(') && expr.endsWith(')')) {
      // Only strip if these parens actually wrap the whole expression.
      const inner = expr.slice(1, -1)
      let depth = 0
      let wraps = true
      for (const ch of inner) {
        if ('([{'.includes(ch)) depth++
        if (')]}'.includes(ch)) depth--
        if (depth < 0) {
          wraps = false
          break
        }
      }
      if (!wraps) break
      expr = inner.trim()
    }

    // chained links: a >> b >> c
    const segments = splitTop(expr, '>>').map((p) => p.trim())
    if (segments.length > 1) {
      // Resolve the first segment to a concrete source socket exactly once.
      let src = resolveSource(tree, parseValue(segments[0], line), line)
      let lastNode: Binding | null = null
      for (let i = 1; i < segments.length; i++) {
        const next = parseValue(segments[i], line)
        // Instantiate each target exactly once, then link into it.
        let dstBinding: Binding | null = null
        if (isInterfaceCall(next)) {
          dstBinding = handleInterface(tree, null, next as PyValue & { kind: 'call' }, line)
        } else if (next.kind === 'call') {
          dstBinding = instantiate(tree, next, null, line)
        }
        let dstSocket: SocketRef
        if (dstBinding?.kind === 'ifaceOut') {
          dstSocket = { socketId: dstBinding.socket.id }
        } else if (dstBinding?.kind === 'node') {
          const first =
            dstBinding.inputs.find((s) => !linked(tree, s.id)) ?? dstBinding.inputs[0]
          if (!first) throw new ParseError('Node has no inputs', line)
          dstSocket = { socketId: first.id }
        } else {
          dstSocket = resolveTarget(tree, next, line)
        }
        addLink(tree, src.socketId, dstSocket.socketId)
        if (dstBinding?.kind === 'node') lastNode = dstBinding
        // Later segments link out of this target; resolve lazily so a final
        // `.i.x` / tree-output target is never read as a source.
        if (i < segments.length - 1) {
          if (dstBinding?.kind === 'node') {
            src = resolveBindingSource(dstBinding, [], line)
          } else {
            src = resolveSource(tree, next, line)
          }
        }
      }
      if (bindVar && bindVar !== '_' && lastNode) tree.vars.set(bindVar, lastNode)
      continue
    }

    // single expression (assignment or bare statement)
    const value = parseValue(expr, line)
    if (value.kind === 'call') {
      if (isInterfaceCall(value)) {
        handleInterface(
          tree,
          bindVar && bindVar !== '_' ? bindVar : null,
          value as PyValue & { kind: 'call' },
          line,
        )
        continue
      }
      instantiate(tree, value, bindVar && bindVar !== '_' ? bindVar : null, line)
      continue
    }
    if (value.kind === 'ref' && bindVar) {
      const b = tree.vars.get(value.path[0])
      if (b) {
        tree.vars.set(bindVar, b)
        continue
      }
    }
    throw new ParseError(`Unsupported statement: ${text.slice(0, 60)}`, line)
  }
  finalizeClass()

  if (trees.length === 0) {
    throw new Error('No tree found. Start with `with g.tree("Name") as tree:`')
  }

  // ── auto-layout each tree (left→right by link depth) ─────────────────────
  for (const t of trees) {
    const nodeOfSocket = new Map<number, JsonNode>()
    for (const n of t.nodes) {
      for (const s of n.data.inputs.data.items) nodeOfSocket.set(s.id, n)
      for (const s of n.data.outputs.data.items) nodeOfSocket.set(s.id, n)
    }
    const incoming = new Map<number, JsonNode[]>()
    for (const l of t.links) {
      const src = nodeOfSocket.get(l.data.from_socket)
      const dst = nodeOfSocket.get(l.data.to_socket)
      if (!src || !dst || src === dst) continue
      incoming.set(dst.id, [...(incoming.get(dst.id) ?? []), src])
    }
    const depth = new Map<number, number>()
    function depthOf(n: JsonNode, guard = 0): number {
      if (depth.has(n.id)) return depth.get(n.id)!
      if (guard > 200) return 0
      depth.set(n.id, 0) // break cycles
      const preds = incoming.get(n.id) ?? []
      const d = preds.length === 0 ? 0 : Math.max(...preds.map((p) => depthOf(p, guard + 1))) + 1
      depth.set(n.id, d)
      return d
    }
    for (const n of t.nodes) depthOf(n)
    // Group Output goes to the last column.
    const maxDepth = Math.max(0, ...[...depth.values()])
    if (t.groupOutputNode) depth.set(t.groupOutputNode.id, maxDepth)
    const yByDepth = new Map<number, number>()
    for (const n of t.nodes) {
      const d = depth.get(n.id) ?? 0
      const rows = Math.max(
        n.data.inputs.data.items.length,
        n.data.outputs.data.items.length,
        1,
      )
      const estHeight = 50 + rows * 24
      const y = yByDepth.get(d) ?? 0
      n.data.location = [d * 280, -y]
      yByDepth.set(d, y + estHeight + 40)
    }
  }

  // ── assemble the synthesized export ───────────────────────────────────────
  return {
    blender_version: 'nodebpy',
    tree_clipper_version: 'generated-from-python',
    node_trees: trees.map((t) => ({
      id: t.treeId,
      data: {
        name: t.name,
        bl_idname:
          t.module === 'shader'
            ? 'ShaderNodeTree'
            : t.module === 'compositor'
              ? 'CompositorNodeTree'
              : 'GeometryNodeTree',
        is_modifier: t.isRoot,
        interface: { data: { items_tree: { data: { items: t.ifaceItems } } } },
        nodes: { data: { items: t.nodes } },
        links: { data: { items: t.links } },
      },
    })),
    external: {},
    scenes: {},
  }
}
