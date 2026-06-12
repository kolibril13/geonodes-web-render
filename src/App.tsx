import './App.css'
import { useState } from 'react'
import { JsonEditorTabs } from './components/JsonEditorTabs'
import { NodebpyCodePane } from './components/NodebpyCodePane'
import { GeometryNodesFlow } from './gn/components/GeometryNodesFlow'

function App() {
  const [jsonText, setJsonText] = useState('')

  return (
    <div className="app-layout">
      <div className="left-pane">
        <JsonEditorTabs value={jsonText} onChange={setJsonText} />
      </div>
      <div className="center-pane">
        <GeometryNodesFlow jsonText={jsonText} />
      </div>
      <div className="right-pane">
        <NodebpyCodePane jsonText={jsonText} />
      </div>
    </div>
  )
}

export default App
