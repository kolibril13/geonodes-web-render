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

const nodeTypes = {
  gnNode: GenericGNNode,
}

export function GeometryNodesFlow(props: { jsonText: string }) {
  const { jsonText } = props

  const graphView = useMemo(() => {
    if (!jsonText.trim()) return null

    const raw = JSON.parse(jsonText) as BlenderTreeExport
    const normalized = normalizeBlenderGraph(raw)
    const graph = toGraphIR(normalized)
    const flow = mapGraphIRToFlow(graph)

    return {
      graph,
      flow,
    }
  }, [jsonText])

  return (
    <div className="panel flow-panel">
      <div className="panel-header">
        <div className="panel-title">Geometry Nodes Graph</div>
        <div className="panel-status" aria-live="polite">
          {graphView
            ? `${graphView.graph.nodes.length} nodes, ${graphView.graph.edges.length} links`
            : 'Loading sample JSON…'}
        </div>
      </div>

      <div className="panel-body flow-panel__body">
        {graphView ? (
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
