import { useEffect, useMemo, useState } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { json } from '@codemirror/lang-json'
import { EditorView } from '@codemirror/view'
import { oneDark } from '@codemirror/theme-one-dark'

type TabId = 'example1' | 'example2' | 'example3' | 'example4' | 'example5' | 'custom'

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
  { id: 'example3', label: 'Example 3', assetPath: 'assets/example3.json' },
  { id: 'example4', label: 'Example 4', assetPath: 'assets/example4.json' },
  { id: 'example5', label: 'Example 5', assetPath: 'assets/example5.json' },
  { id: 'custom', label: 'Custom' },
]

const TREE_CLIPPER_PREFIX = 'TreeClipper::'

function formatJson(text: string): { ok: true; formatted: string } | { ok: false } {
  try {
    const parsed = JSON.parse(text)
    return { ok: true, formatted: `${JSON.stringify(parsed, null, 2)}\n` }
  } catch {
    return { ok: false }
  }
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

async function decodeTreeClipperPayload(raw: string): Promise<string> {
  const trimmed = raw.trim()
  const base64 = trimmed.startsWith(TREE_CLIPPER_PREFIX)
    ? trimmed.slice(TREE_CLIPPER_PREFIX.length)
    : trimmed
  const bytes = base64ToUint8Array(base64)
  const isGzip = bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b
  const decodedBytes = isGzip
    ? await decompressGzip(bytes)
    : bytes
  return new TextDecoder().decode(decodedBytes)
}

async function decompressGzip(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(
    new DecompressionStream('gzip'),
  )
  const blob = await new Response(stream).blob()
  const buf = await blob.arrayBuffer()
  return new Uint8Array(buf)
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

  const [base64ImportError, setBase64ImportError] = useState<string | null>(null)

  async function importBase64FromClipboard() {
    setBase64ImportError(null)
    try {
      const raw = await navigator.clipboard.readText()
      const decoded = await decodeTreeClipperPayload(raw)
      const parsed = JSON.parse(decoded) as unknown
      const formatted = `${JSON.stringify(parsed, null, 2)}\n`
      setActiveTab('custom')
      onChange(formatted)
    } catch (e) {
      const message =
        e instanceof Error ? e.message : 'Failed to import base64 JSON'
      setBase64ImportError(message)
    }
  }

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
              onClick={() => {
                if (t.id === 'custom') onChange('')
                setActiveTab(t.id)
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="panel-actions">
          <button
            type="button"
            className="action-button"
            onClick={importBase64FromClipboard}
            title="Decode base64 from clipboard and paste JSON into editor"
          >
            Import base64 from clipboard
          </button>
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
          {base64ImportError ? `Base64 import: ${base64ImportError}` : null}
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

