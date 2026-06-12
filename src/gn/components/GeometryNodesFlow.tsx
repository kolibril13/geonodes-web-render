import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Background,
  Controls,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Edge,
  type Node,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import {
  normalizeBlenderExport,
  toGraphIR,
  type BlenderTreeExport,
} from '../importer/blenderTree'
import { mapGraphIRToFlow } from '../xyflow/mapGraphIRToFlow'
import { GenericGNNode } from './GenericGNNode'
import { RerouteNode } from './RerouteNode'
import { SimulationZoneFrame } from './SimulationZoneFrame.tsx'
import { GroupNavContext } from './groupNavContext'
import type { GraphIR } from '../ir/types'

const nodeTypes = {
  gnNode: GenericGNNode,
  rerouteNode: RerouteNode,
  simulationZone: SimulationZoneFrame,
}

const FIT_VIEW_OPTIONS = { padding: 0.08 }

type Breadcrumb = { id: string; label: string }

function FlowCanvas(props: {
  nodes: Node[]
  edges: Edge[]
  breadcrumbs: Breadcrumb[]
  onNavigate: (index: number) => void
}) {
  const { nodes, edges, breadcrumbs, onNavigate } = props
  const { fitView } = useReactFlow()

  useEffect(() => {
    // Re-fit whenever the node set changes (tab switch, new JSON, group drill-down, etc.)
    fitView(FIT_VIEW_OPTIONS)
  }, [nodes, fitView])

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      fitView
      fitViewOptions={FIT_VIEW_OPTIONS}
      minZoom={0.2}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable={false}
      nodesFocusable={false}
      edgesFocusable={false}
      selectNodesOnDrag={false}
      selectionOnDrag={false}
      connectOnClick={false}
      panOnDrag
      panOnScroll={false}
      zoomOnScroll
      zoomOnDoubleClick={false}
    >
      <Background gap={20} size={1} />
      <Controls showInteractive={false} />
      {breadcrumbs.length > 1 ? (
        <Panel position="top-left">
          <nav className="gn-breadcrumbs" aria-label="Node group path">
            {breadcrumbs.map((crumb, i) => {
              const isLast = i === breadcrumbs.length - 1
              return (
                <span key={`${crumb.id}-${i}`} className="gn-breadcrumbs__item">
                  {i > 0 ? <span className="gn-breadcrumbs__sep" aria-hidden="true">›</span> : null}
                  {isLast ? (
                    <span className="gn-breadcrumbs__current" aria-current="page">
                      {crumb.label}
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="gn-breadcrumbs__link"
                      onClick={() => onNavigate(i)}
                    >
                      {crumb.label}
                    </button>
                  )}
                </span>
              )
            })}
          </nav>
        </Panel>
      ) : null}
      <Panel position="bottom-right">
        <a
          href="https://extensions.blender.org/add-ons/tree-clipper/"
          target="_blank"
          rel="noopener noreferrer"
          className="tree-clipper-badge"
        >
          Exported from Blender using Tree Clipper ↗
        </a>
      </Panel>
    </ReactFlow>
  )
}

type TreeView = { graph: GraphIR; flow: { nodes: Node[]; edges: Edge[] } }

export function GeometryNodesFlow(props: {
  jsonText: string
  /** When false, hide the panel header ("Geometry Nodes Graph" and node count). Default true. */
  showHeader?: boolean
}) {
  const { jsonText, showHeader = true } = props

  // Trail of opened groups below the root tree (tree ids). The stack is tied
  // to the JSON it was built from: new JSON means new tree ids, so a stack
  // from different JSON counts as empty (reset without an effect).
  const [nav, setNav] = useState<{ json: string; ids: string[] }>({ json: jsonText, ids: [] })

  const parsed = useMemo(() => {
    if (!jsonText.trim()) return null

    try {
      const raw = JSON.parse(jsonText) as BlenderTreeExport
      const { rootId, trees } = normalizeBlenderExport(raw)
      const views: Record<string, TreeView> = {}
      for (const normalized of Object.values(trees)) {
        const graph = toGraphIR(normalized)
        views[graph.id] = { graph, flow: mapGraphIRToFlow(graph) }
      }
      return { rootId, views, error: null }
    } catch (e) {
      return { rootId: '', views: null, error: e instanceof Error ? e.message : String(e) }
    }
  }, [jsonText])

  // Path from root through opened groups, dropping ids that don't resolve.
  const path = useMemo(() => {
    if (!parsed?.views) return []
    const ids = nav.json === jsonText ? nav.ids : []
    const p = [parsed.rootId]
    for (const id of ids) {
      if (parsed.views[id]) p.push(id)
    }
    return p
  }, [parsed, nav, jsonText])

  const current = parsed?.views ? parsed.views[path[path.length - 1]] : null

  const openGroup = useCallback(
    (treeId: string) => {
      setNav((prev) => ({
        json: jsonText,
        ids: prev.json === jsonText ? [...prev.ids, treeId] : [treeId],
      }))
    },
    [jsonText],
  )

  const navContextValue = useMemo(() => ({ openGroup }), [openGroup])

  const breadcrumbs: Breadcrumb[] = parsed?.views
    ? path.map((id) => ({ id, label: parsed.views![id].graph.label }))
    : []

  return (
    <div className="panel flow-panel">
      {showHeader ? (
        <div className="panel-header">
          <div className="panel-title">Geometry Nodes Graph</div>
          <div className="panel-status" aria-live="polite">
            {current
              ? `${current.graph.nodes.length} nodes, ${current.graph.edges.length} links`
              : null}
          </div>
        </div>
      ) : null}

      <div className="panel-body flow-panel__body">
        {parsed?.error ? (
          <div className="flow-error" role="alert">
            <strong>Parse error</strong>
            <span>{parsed.error}</span>
          </div>
        ) : current ? (
          <GroupNavContext.Provider value={navContextValue}>
            <ReactFlowProvider>
              <FlowCanvas
                nodes={current.flow.nodes}
                edges={current.flow.edges}
                breadcrumbs={breadcrumbs}
                onNavigate={(index) => setNav({ json: jsonText, ids: path.slice(1, index + 1) })}
              />
            </ReactFlowProvider>
          </GroupNavContext.Provider>
        ) : (
          <div className="flow-empty">Waiting for sample graph...</div>
        )}
      </div>
    </div>
  )
}
