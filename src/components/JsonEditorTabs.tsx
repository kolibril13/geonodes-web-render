import { useEffect, useMemo, useState } from 'react'

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

export function JsonEditorTabs(props: {
  value: string
  onChange: (next: string) => void
}) {
  const { value, onChange } = props
  const [activeTab, setActiveTab] = useState<TabId>('example1')
  const [loadState, setLoadState] = useState<
    { kind: 'idle' } | { kind: 'loading' } | { kind: 'error'; message: string }
  >({ kind: 'idle' })

  const active = useMemo(
    () => tabs.find((t) => t.id === activeTab) ?? tabs[0],
    [activeTab],
  )

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
        <div className="panel-status" aria-live="polite">
          {loadState.kind === 'loading' ? 'Loading…' : null}
          {loadState.kind === 'error' ? `Load error: ${loadState.message}` : null}
        </div>
      </div>

      <div className="panel-body">
        <textarea
          className="editor"
          spellCheck={false}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Paste or edit JSON here…"
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

