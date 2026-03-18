import { useEffect, useMemo } from 'react'
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
  normalizeBlenderGraph,
  toGraphIR,
  type BlenderTreeExport,
} from '../importer/blenderTree'
import { mapGraphIRToFlow } from '../xyflow/mapGraphIRToFlow'
import { GenericGNNode } from './GenericGNNode'
import { RerouteNode } from './RerouteNode'
import { SimulationZoneFrame } from './SimulationZoneFrame.tsx'

const nodeTypes = {
  gnNode: GenericGNNode,
  rerouteNode: RerouteNode,
  simulationZone: SimulationZoneFrame,
}

const FIT_VIEW_OPTIONS = { padding: 0.08 }

function FlowCanvas(props: { nodes: Node[]; edges: Edge[] }) {
  const { nodes, edges } = props
  const { fitView } = useReactFlow()

  useEffect(() => {
    // Re-fit whenever the node set changes (tab switch, new JSON, etc.)
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

export function GeometryNodesFlow(props: {
  jsonText: string
  /** When false, hide the panel header ("Geometry Nodes Graph" and node count). Default true. */
  showHeader?: boolean
}) {
  const { jsonText, showHeader = true } = props

  const graphView = useMemo(() => {
    if (!jsonText.trim()) return null

    try {
      const raw = JSON.parse(jsonText) as BlenderTreeExport
      const normalized = normalizeBlenderGraph(raw)
      const graph = toGraphIR(normalized)
      const flow = mapGraphIRToFlow(graph)
      return { graph, flow, error: null }
    } catch (e) {
      return { graph: null, flow: null, error: e instanceof Error ? e.message : String(e) }
    }
  }, [jsonText])

  return (
    <div className="panel flow-panel">
      {showHeader ? (
        <div className="panel-header">
          <div className="panel-title">Geometry Nodes Graph</div>
          <div className="panel-status" aria-live="polite">
            {graphView?.graph
              ? `${graphView.graph.nodes.length} nodes, ${graphView.graph.edges.length} links`
              : null}
          </div>
        </div>
      ) : null}

      <div className="panel-body flow-panel__body">
        {graphView?.error ? (
          <div className="flow-error" role="alert">
            <strong>Parse error</strong>
            <span>{graphView.error}</span>
          </div>
        ) : graphView?.flow ? (
          <ReactFlowProvider>
            <FlowCanvas nodes={graphView.flow.nodes} edges={graphView.flow.edges} />
          </ReactFlowProvider>
        ) : (
          <div className="flow-empty">Waiting for sample graph...</div>
        )}
      </div>
    </div>
  )
}
