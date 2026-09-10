import { describe, expect, it } from 'vitest'
import { normalizeBlenderExport, toGraphIR, type BlenderTreeExport } from '../importer/blenderTree'
import { computeFieldContext, traceableNodeIds } from './fieldContext'

const fixtures = import.meta.glob('../../../public/assets/example2.json', {
  eager: true,
  import: 'default',
})

function loadExample() {
  const raw = Object.values(fixtures)[0] as BlenderTreeExport
  const { rootId, trees } = normalizeBlenderExport(raw)
  return toGraphIR(trees[rootId])
}

describe('field context', () => {
  const graph = loadExample()
  const position = graph.nodes.find((n) => n.type === 'GeometryNodeInputPosition')!

  it('offers the field nodes as hover targets, not the geometry ones', () => {
    const ids = traceableNodeIds(graph)
    expect(ids.has(position.id)).toBe(true)
    const sphere = graph.nodes.find((n) => n.type === 'GeometryNodeMeshUVSphere')!
    expect(ids.has(sphere.id)).toBe(false)
  })

  it('traces Position through Compare to the geometry it is evaluated on', () => {
    const trace = computeFieldContext(graph, position.id)!
    expect(trace.hits).toHaveLength(1)
    const [hit] = trace.hits
    expect(hit.consumerLabel).toBe('Instance on Points')
    expect(hit.fieldSocketName).toBe('Selection')
    expect(hit.geometrySocketName).toBe('Points')
    expect(hit.originLabel).toBe('Group Input')
    expect(hit.domain).toBe('points')
    expect(hit.note).toBeNull()
  })

  it('lights up the field path, the geometry chain and the two key sockets', () => {
    const trace = computeFieldContext(graph, position.id)!
    const label = (id: string) => graph.nodes.find((n) => n.id === id)!.label
    // Compare is labelled by its operation ("Greater Than") in the graph IR.
    expect([...trace.fieldNodeIds].map(label).sort()).toEqual([
      'Greater Than',
      'Instance on Points',
      'Position',
    ])
    expect([...trace.geometryNodeIds].map(label).sort()).toEqual([
      'Group Input',
      'Instance on Points',
    ])
    expect(trace.socketIds.size).toBe(2)
  })
})
