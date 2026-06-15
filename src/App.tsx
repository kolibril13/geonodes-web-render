import './App.css'
import { useCallback, useEffect, useRef, useState } from 'react'
import { JsonEditorTabs } from './components/JsonEditorTabs'
import { NodebpyCodePane } from './components/NodebpyCodePane'
import { GeometryNodesFlow } from './gn/components/GeometryNodesFlow'

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v))
}

type Theme = 'dark' | 'light'

function App() {
  const [jsonText, setJsonText] = useState('')
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([])
  const [leftPct, setLeftPct] = useState(28)
  const [rightPct, setRightPct] = useState(26)
  const layoutRef = useRef<HTMLDivElement>(null)

  // Dark by default; the choice persists across reloads.
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem('gnwr-theme') as Theme | null) ?? 'dark',
  )
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('gnwr-theme', theme)
  }, [theme])
  const dark = theme === 'dark'

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
        <JsonEditorTabs
          value={jsonText}
          onChange={setJsonText}
          dark={dark}
          onToggleTheme={() => setTheme(dark ? 'light' : 'dark')}
        />
      </div>
      <div
        className="pane-divider"
        role="separator"
        aria-orientation="vertical"
        onPointerDown={startDrag('left')}
      />
      <div className="center-pane">
        <GeometryNodesFlow
          jsonText={jsonText}
          onSelectionChange={setSelectedNodeIds}
        />
      </div>
      <div
        className="pane-divider"
        role="separator"
        aria-orientation="vertical"
        onPointerDown={startDrag('right')}
      />
      <div className="right-pane">
        <NodebpyCodePane jsonText={jsonText} selectedNodeIds={selectedNodeIds} dark={dark} />
      </div>
    </div>
  )
}

export default App
