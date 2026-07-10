import { describe, expect, it } from 'vitest'
import { filterExportToSelection } from './nodebpyExporter'

type RawExport = Parameters<typeof filterExportToSelection>[0]

const fixtures = import.meta.glob('../../../public/assets/example1.json', {
  eager: true,
  import: 'default',
})

function loadExample(): RawExport {
  // Clone so each test gets an untouched copy of the shared module object.
  return structuredClone(Object.values(fixtures)[0]) as RawExport
}

describe('filterExportToSelection', () => {
  it('returns the input unchanged for an empty selection', () => {
    const raw = loadExample()
    expect(filterExportToSelection(raw, new Set())).toBe(raw)
  })

  it('returns the input unchanged when nothing matches', () => {
    const raw = loadExample()
    expect(filterExportToSelection(raw, new Set([-1]))).toBe(raw)
  })

  it('keeps only the selected nodes and links between them', () => {
    const raw = loadExample()
    const rootNodes = raw.node_trees[0].data.nodes.data.items
    expect(rootNodes.length).toBeGreaterThan(2)

    const selected = new Set(rootNodes.slice(0, 2).map((n) => n.id))
    const filtered = filterExportToSelection(raw, selected)

    expect(filtered).not.toBe(raw)
    for (const tree of filtered.node_trees) {
      const keptIds = new Set<number>()
      const socketIds = new Set<number>()
      for (const node of tree.data.nodes.data.items) {
        keptIds.add(node.id)
        for (const s of node.data.inputs?.data.items ?? []) socketIds.add(s.id)
        for (const s of node.data.outputs?.data.items ?? []) socketIds.add(s.id)
      }
      // Surviving links must connect surviving sockets on both ends.
      for (const link of tree.data.links.data.items) {
        expect(socketIds.has(link.data.from_socket)).toBe(true)
        expect(socketIds.has(link.data.to_socket)).toBe(true)
      }
      // In the root tree, only the selected nodes survive.
      if (tree.id === raw.node_trees[0].id) {
        expect([...keptIds].every((id) => selected.has(id))).toBe(true)
      }
    }
  })
})
