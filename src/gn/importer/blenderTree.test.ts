import { describe, expect, it } from 'vitest'
import {
  normalizeBlenderExport,
  toGraphIR,
  type BlenderTreeExport,
} from './blenderTree'

// Every bundled sample tree doubles as a regression fixture.
const fixtures = import.meta.glob('../../../public/assets/*.json', {
  eager: true,
  import: 'default',
}) as Record<string, BlenderTreeExport>

describe('blenderTree importer', () => {
  it('finds the bundled example fixtures', () => {
    expect(Object.keys(fixtures).length).toBeGreaterThan(0)
  })

  for (const [path, fixture] of Object.entries(fixtures)) {
    const name = path.split('/').pop()!

    describe(name, () => {
      it('normalizes into trees with a resolvable root', () => {
        const { rootId, trees } = normalizeBlenderExport(fixture)
        expect(trees[rootId]).toBeDefined()
        expect(Object.keys(trees).length).toBeGreaterThan(0)
      })

      it('produces a consistent GraphIR for every tree', () => {
        const { trees } = normalizeBlenderExport(fixture)
        for (const normalized of Object.values(trees)) {
          const graph = toGraphIR(normalized)

          const nodeIds = new Set(graph.nodes.map((n) => n.id))
          expect(nodeIds.size).toBe(graph.nodes.length)

          const socketIds = new Set(
            graph.nodes.flatMap((n) => [...n.inputs, ...n.outputs].map((s) => s.id)),
          )

          // Every edge must connect existing nodes via existing sockets.
          for (const edge of graph.edges) {
            expect(nodeIds.has(edge.sourceNodeId)).toBe(true)
            expect(nodeIds.has(edge.targetNodeId)).toBe(true)
            expect(socketIds.has(edge.sourceSocketId)).toBe(true)
            expect(socketIds.has(edge.targetSocketId)).toBe(true)
          }

          // Group references resolve to trees present in the export.
          for (const node of graph.nodes) {
            if (node.groupTreeId !== undefined) {
              expect(trees[node.groupTreeId]).toBeDefined()
              expect(node.groupTreeName).toBe(trees[node.groupTreeId].label)
            }
          }
        }
      })
    })
  }

  it('rejects exports without node_trees', () => {
    expect(() => normalizeBlenderExport({} as BlenderTreeExport)).toThrow(
      /node_trees/,
    )
  })
})
