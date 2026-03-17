import { useEffect, useMemo, useState } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { json } from '@codemirror/lang-json'
import { EditorView } from '@codemirror/view'
import { oneDark } from '@codemirror/theme-one-dark'

type TabId = 'example1' | 'example2' | 'custom'

type Tab = {
  id: TabId
  label: string
  assetPath?: string
}

function withBaseUrl(path: string) {
  const base = import.meta.env.BASE_URL ?? '/'
  const b = base.endsWith('/') ? base : `${base}/`
  const p = path.startsWith('/') ? path.slice(1) : path
  return `${b}${p}`
}

const tabs: Tab[] = [
  { id: 'example1', label: 'Example 1', assetPath: 'assets/example1.json' },
  { id: 'example2', label: 'Example 2', assetPath: 'assets/example2.json' },
  { id: 'custom', label: 'Custom' },
]

function formatJson(text: string): { ok: true; formatted: string } | { ok: false } {
  try {
    const parsed = JSON.parse(text)
    return { ok: true, formatted: `${JSON.stringify(parsed, null, 2)}\n` }
  } catch {
    return { ok: false }
  }
}

export function JsonEditorTabs(props: {
  value: string
  onChange: (next: string) => void
}) {
  const { value, onChange } = props
  const [activeTab, setActiveTab] = useState<TabId>('example1')
  const [loadState, setLoadState] = useState<
    { kind: 'idle' } | { kind: 'loading' } | { kind: 'error'; message: string }
  >({ kind: 'idle' })
  const [prefersDark, setPrefersDark] = useState<boolean>(() =>
    window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false,
  )

  const active = useMemo(
    () => tabs.find((t) => t.id === activeTab) ?? tabs[0],
    [activeTab],
  )

  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)')
    if (!mq) return
    const onChangeMq = () => setPrefersDark(mq.matches)
    onChangeMq()
    mq.addEventListener('change', onChangeMq)
    return () => mq.removeEventListener('change', onChangeMq)
  }, [])

  useEffect(() => {
    let cancelled = false
    async function run() {
      if (!active.assetPath) return
      setLoadState({ kind: 'loading' })
      try {
        const res = await fetch(withBaseUrl(active.assetPath))
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
        const text = await res.text()
        if (!cancelled) {
          onChange(text)
          setLoadState({ kind: 'idle' })
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Failed to load asset'
        if (!cancelled) setLoadState({ kind: 'error', message })
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [active.assetPath, onChange])

  const parseError = useMemo(() => {
    const trimmed = value.trim()
    if (trimmed.length === 0) return null
    try {
      JSON.parse(value)
      return null
    } catch (e) {
      return e instanceof Error ? e.message : 'Invalid JSON'
    }
  }, [value])

  return (
    <div className="panel">
      <div className="panel-header">
        <div className="tabs" role="tablist" aria-label="Editor tabs">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`tab ${t.id === activeTab ? 'active' : ''}`}
              role="tab"
              aria-selected={t.id === activeTab}
              onClick={() => setActiveTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="panel-actions">
          <button
            type="button"
            className="action-button"
            onClick={() => {
              const res = formatJson(value)
              if (res.ok) onChange(res.formatted)
            }}
            disabled={value.trim().length === 0 || !!parseError}
            title={parseError ? 'Fix JSON errors to format' : 'Format JSON'}
          >
            Format
          </button>
        </div>
        <div className="panel-status" aria-live="polite">
          {loadState.kind === 'loading' ? 'Loading…' : null}
          {loadState.kind === 'error' ? `Load error: ${loadState.message}` : null}
        </div>
      </div>

      <div className="panel-body">
        <CodeMirror
          className="cm-editor"
          value={value}
          height="100%"
          basicSetup={{
            lineNumbers: true,
            foldGutter: true,
            highlightActiveLine: true,
            highlightSelectionMatches: true,
          }}
          extensions={[
            json(),
            EditorView.lineWrapping,
            EditorView.theme({
              '&': { height: '100%' },
              '.cm-scroller': { overflow: 'auto' },
            }),
          ]}
          theme={prefersDark ? oneDark : undefined}
          onChange={(next) => onChange(next)}
        />
      </div>

      <div className="panel-footer">
        <div className={`json-status ${parseError ? 'bad' : 'ok'}`}>
          {parseError ? `JSON error: ${parseError}` : 'JSON OK'}
        </div>
      </div>
    </div>
  )
}

