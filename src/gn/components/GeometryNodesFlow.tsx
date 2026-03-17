import { useMemo } from 'react'
import {
  Background,
  Controls,
  ReactFlow,
  ReactFlowProvider,
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

const nodeTypes = {
  gnNode: GenericGNNode,
  rerouteNode: RerouteNode,
}

export function GeometryNodesFlow(props: { jsonText: string }) {
  const { jsonText } = props

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
      <div className="panel-header">
        <div className="panel-title">Geometry Nodes Graph</div>
        <div className="panel-status" aria-live="polite">
          {graphView?.graph
            ? `${graphView.graph.nodes.length} nodes, ${graphView.graph.edges.length} links`
            : null}
        </div>
      </div>

      <div className="panel-body flow-panel__body">
        {graphView?.error ? (
          <div className="flow-error" role="alert">
            <strong>Parse error</strong>
            <span>{graphView.error}</span>
          </div>
        ) : graphView?.flow ? (
          <ReactFlowProvider>
            <ReactFlow
              nodes={graphView.flow.nodes}
              edges={graphView.flow.edges}
              nodeTypes={nodeTypes}
              fitView
              fitViewOptions={{ padding: 0.2, maxZoom: 0.9 }}
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
            </ReactFlow>
          </ReactFlowProvider>
        ) : (
          <div className="flow-empty">Waiting for sample graph...</div>
        )}
      </div>
    </div>
  )
}
