import './App.css'
import { useState } from 'react'
import { CanvasPane } from './components/CanvasPane'
import { JsonEditorTabs } from './components/JsonEditorTabs'

function App() {
  const [jsonText, setJsonText] = useState('')

  return (
    <div className="app-layout">
      <div className="left-pane">
        <JsonEditorTabs value={jsonText} onChange={setJsonText} />
      </div>
      <div className="right-pane">
        <CanvasPane />
      </div>
    </div>
  )
}

export default App
