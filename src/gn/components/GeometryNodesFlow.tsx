import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Background,
  Controls,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  SelectionMode,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Edge,
  type Node,
  type OnSelectionChangeParams,
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
  onSelectionIds?: (ids: string[]) => void
  zoomOnScroll?: boolean
}) {
  const { nodes, edges, breadcrumbs, onNavigate, onSelectionIds, zoomOnScroll = true } = props
  const { fitView } = useReactFlow()
  const wrapperRef = useRef<HTMLDivElement>(null)
  // Once the user pans/zooms, stop auto-fitting so we don't fight them.
  const userMovedRef = useRef(false)
  // Local copies so React Flow can apply selection changes (box select / click).
  const [localNodes, setLocalNodes, onNodesChange] = useNodesState(nodes)
  const [localEdges, setLocalEdges, onEdgesChange] = useEdgesState(edges)

  useEffect(() => {
    // Re-fit whenever the node set changes (tab switch, new JSON, group drill-down, etc.)
    // Replacing the node set also resets any selection.
    setLocalNodes(nodes)
    onSelectionIds?.([])
    userMovedRef.current = false
    fitView(FIT_VIEW_OPTIONS)
  }, [nodes, setLocalNodes, onSelectionIds, fitView])

  useEffect(() => {
    setLocalEdges(edges)
  }, [edges, setLocalEdges])

  // Re-fit when the canvas actually gets (or changes) its size. In an embed the
  // stylesheet can load after mount, so the initial `fitView` runs against a
  // wrongly-sized container; observing the size catches up once layout settles.
  useEffect(() => {
    const el = wrapperRef.current
    if (!el) return
    const observer = new ResizeObserver(() => {
      if (!userMovedRef.current) fitView(FIT_VIEW_OPTIONS)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [fitView])

  // React Flow passes a null event for programmatic moves (our own fitView) and
  // a real event for user pan/zoom — only the latter should lock auto-fit.
  const onMoveStart = useCallback((event: MouseEvent | TouchEvent | null) => {
    if (event) userMovedRef.current = true
  }, [])

  const onSelectionChange = useCallback(
    ({ nodes: selected }: OnSelectionChangeParams) => {
      onSelectionIds?.(selected.map((n) => n.id))
    },
    [onSelectionIds],
  )

  return (
    <div ref={wrapperRef} style={{ width: '100%', height: '100%' }}>
    <ReactFlow
      nodes={localNodes}
      edges={localEdges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onSelectionChange={onSelectionChange}
      onMoveStart={onMoveStart}
      nodeTypes={nodeTypes}
      fitView
      fitViewOptions={FIT_VIEW_OPTIONS}
      minZoom={0.2}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable
      nodesFocusable={false}
      edgesFocusable={false}
      selectNodesOnDrag={false}
      selectionOnDrag
      selectionMode={SelectionMode.Partial}
      connectOnClick={false}
      panOnDrag={[1, 2]}
      panOnScroll={false}
      zoomOnScroll={zoomOnScroll}
      // When zoom is off (embed), don't swallow the wheel — let it scroll the page.
      preventScrolling={zoomOnScroll}
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
    </ReactFlow>
    </div>
  )
}

type TreeView = { graph: GraphIR; flow: { nodes: Node[]; edges: Edge[] } }

export function GeometryNodesFlow(props: {
  jsonText: string
  /** When false, hide the panel header ("Geometry Nodes Graph" and node count). Default true. */
  showHeader?: boolean
  /** Reports the currently selected node ids (raw Tree Clipper node ids as strings). */
  onSelectionChange?: (nodeIds: string[]) => void
  /** Zoom the canvas on mouse-wheel. Default true; set false (e.g. in an embed)
   *  so the wheel scrolls the host page instead of the node tree. */
  zoomOnScroll?: boolean
}) {
  const { jsonText, showHeader = true, onSelectionChange, zoomOnScroll = true } = props

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

  // Tab and Escape go one level up the group hierarchy (Blender-style Tab-out).
  useEffect(() => {
    if (path.length <= 1) return

    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Tab' && e.key !== 'Escape') return
      if (e.ctrlKey || e.metaKey || e.altKey) return
      // Leave typing/navigation inside the editor and form fields alone.
      const target = e.target as HTMLElement | null
      if (
        target &&
        (target.isContentEditable ||
          target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.closest('.cm-editor'))
      ) {
        return
      }
      e.preventDefault()
      setNav({ json: jsonText, ids: path.slice(1, -1) })
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [path, jsonText])

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
                onSelectionIds={onSelectionChange}
                zoomOnScroll={zoomOnScroll}
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
