import './App.css'
import { useCallback, useRef, useState } from 'react'
import { JsonEditorTabs } from './components/JsonEditorTabs'
import { NodebpyCodePane } from './components/NodebpyCodePane'
import { GeometryNodesFlow } from './gn/components/GeometryNodesFlow'

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v))
}

function App() {
  const [jsonText, setJsonText] = useState('')
  const [leftPct, setLeftPct] = useState(28)
  const [rightPct, setRightPct] = useState(26)
  const layoutRef = useRef<HTMLDivElement>(null)

  const startDrag = useCallback(
    (side: 'left' | 'right') => (e: React.PointerEvent) => {
      e.preventDefault()
      const el = layoutRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const onMove = (ev: PointerEvent) => {
        const pct = ((ev.clientX - rect.left) / rect.width) * 100
        if (side === 'left') setLeftPct(clamp(pct, 15, 50))
        else setRightPct(clamp(100 - pct, 15, 50))
      }
      const onUp = () => {
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
        document.body.classList.remove('is-resizing')
      }
      document.body.classList.add('is-resizing')
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
    },
    [],
  )

  return (
    <div
      className="app-layout"
      ref={layoutRef}
      style={
        {
          '--left-w': `${leftPct}%`,
          '--right-w': `${rightPct}%`,
        } as React.CSSProperties
      }
    >
      <div className="left-pane">
        <JsonEditorTabs value={jsonText} onChange={setJsonText} />
      </div>
      <div
        className="pane-divider"
        role="separator"
        aria-orientation="vertical"
        onPointerDown={startDrag('left')}
      />
      <div className="center-pane">
        <GeometryNodesFlow jsonText={jsonText} />
      </div>
      <div
        className="pane-divider"
        role="separator"
        aria-orientation="vertical"
        onPointerDown={startDrag('right')}
      />
      <div className="right-pane">
        <NodebpyCodePane jsonText={jsonText} />
      </div>
    </div>
  )
}

export default App
