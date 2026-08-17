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

  it('applies builtin panel layouts with panel_states (example15)', () => {
    const fixture = Object.entries(fixtures).find(([path]) =>
      path.endsWith('/example15.json'),
    )?.[1]
    expect(fixture).toBeDefined()

    const { rootId, trees } = normalizeBlenderExport(fixture!)
    const root = trees[rootId]

    // Combine Matrix is a builtin node: its Column panels come from
    // BUILTIN_NODE_PANELS, the collapse state from each node's panel_states.
    const combines = root.nodes.filter((n) => n.type === 'FunctionNodeCombineMatrix')
    expect(combines.length).toBe(3)

    for (const node of combines) {
      expect(node.panels?.map((p) => p.name)).toEqual([
        'Column 1',
        'Column 2',
        'Column 3',
        'Column 4',
      ])
      // Four component inputs per column panel; the Matrix output is root.
      expect(node.inputs.find((s) => s.name === 'Column 1 Row 1')?.panelIndex).toBe(0)
      expect(node.inputs.find((s) => s.name === 'Column 3 Row 2')?.panelIndex).toBe(2)
      expect(node.inputs.find((s) => s.name === 'Column 4 Row 4')?.panelIndex).toBe(3)
      expect(node.outputs[0]?.panelIndex).toBeUndefined()
    }

    // The scene has one instance with the first two panels expanded and two
    // with everything collapsed.
    const collapseStates = combines.map((n) => n.panels!.map((p) => p.collapsed))
    expect(collapseStates).toContainEqual([false, false, true, true])
    expect(
      collapseStates.filter((s) => s.every(Boolean)).length,
    ).toBe(2)
  })

  it('rejects exports without node_trees', () => {
    expect(() => normalizeBlenderExport({} as BlenderTreeExport)).toThrow(
      /node_trees/,
    )
  })
})
