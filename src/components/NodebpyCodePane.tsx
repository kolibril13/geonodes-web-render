import { useEffect, useMemo, useState } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { python } from '@codemirror/lang-python'
import { json } from '@codemirror/lang-json'
import { EditorView } from '@codemirror/view'
import { oneDark } from '@codemirror/theme-one-dark'
import {
  exportToNodebpy,
  filterExportToSelection,
} from '../gn/exporter/nodebpyExporter'

type OutputMode = 'nodebpy' | 'treeclipper'

export function NodebpyCodePane(props: {
  jsonText: string
  /** Raw Tree Clipper node ids (as strings) to scope the code to. Empty = whole tree. */
  selectedNodeIds?: string[]
}) {
  const { jsonText, selectedNodeIds = [] } = props
  const [mode, setMode] = useState<OutputMode>('nodebpy')
  const [prefersDark, setPrefersDark] = useState<boolean>(() =>
    window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false,
  )

  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)')
    if (!mq) return
    const onChangeMq = () => setPrefersDark(mq.matches)
    onChangeMq()
    mq.addEventListener('change', onChangeMq)
    return () => mq.removeEventListener('change', onChangeMq)
  }, [])

  const selectedIds = useMemo(() => {
    const ids = selectedNodeIds.map(Number).filter(Number.isFinite)
    return new Set(ids)
  }, [selectedNodeIds])

  const output = useMemo(():
    | { code: string; selectionCount: number }
    | { error: string } => {
    const trimmed = jsonText.trim()
    if (trimmed.length === 0) return { error: 'No JSON loaded yet.' }
    try {
      const raw = JSON.parse(jsonText)
      const scoped =
        selectedIds.size > 0 ? filterExportToSelection(raw, selectedIds) : raw
      const code =
        mode === 'nodebpy'
          ? exportToNodebpy(scoped)
          : `${JSON.stringify(scoped, null, 2)}\n`
      return { code, selectionCount: selectedIds.size }
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'Conversion failed' }
    }
  }, [jsonText, selectedIds, mode])

  const [copied, setCopied] = useState(false)
  async function copyOutput() {
    if (!('code' in output)) return
    await navigator.clipboard.writeText(output.code)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const isNodebpy = mode === 'nodebpy'
  const langExt = isNodebpy ? python() : json()
  const errorPrefix = isNodebpy ? '# ' : '// '

  const selectionCount = 'code' in output ? output.selectionCount : 0
  const scopeLabel =
    selectionCount > 0
      ? `${selectionCount} selected node${selectionCount === 1 ? '' : 's'} — drag on the canvas to change, click empty space to clear`
      : isNodebpy
        ? 'nodebpy code generated from the Tree Clipper JSON — paste into Blender'
        : 'Tree Clipper JSON — drag on the canvas to scope to selected nodes'

  return (
    <div className="panel">
      <div className="panel-header">
        <div
          className="view-toggle"
          role="tablist"
          aria-label="Output format"
        >
          <button
            type="button"
            className={`view-toggle__option ${isNodebpy ? 'active' : ''}`}
            role="tab"
            aria-selected={isNodebpy}
            onClick={() => setMode('nodebpy')}
          >
            nodebpy
          </button>
          <button
            type="button"
            className={`view-toggle__option ${!isNodebpy ? 'active' : ''}`}
            role="tab"
            aria-selected={!isNodebpy}
            onClick={() => setMode('treeclipper')}
          >
            Tree Clipper
          </button>
        </div>
        <div className="panel-actions">
          <button
            type="button"
            className="action-button"
            onClick={copyOutput}
            disabled={!('code' in output)}
            title={`Copy ${isNodebpy ? 'nodebpy code' : 'Tree Clipper JSON'} to clipboard`}
          >
            {copied ? 'Copied!' : 'Copy code'}
          </button>
        </div>
      </div>

      <div className="panel-body">
        <CodeMirror
          className="cm-editor"
          value={'code' in output ? output.code : `${errorPrefix}${output.error}`}
          height="100%"
          readOnly
          basicSetup={{
            lineNumbers: true,
            foldGutter: true,
            highlightActiveLine: true,
            highlightSelectionMatches: true,
          }}
          extensions={[
            langExt,
            EditorView.lineWrapping,
            EditorView.theme({
              '&': { height: '100%' },
              '.cm-scroller': { overflow: 'auto' },
            }),
          ]}
          theme={prefersDark ? oneDark : undefined}
        />
      </div>

      <div className="panel-footer">
        <div className={`json-status ${'code' in output ? 'ok' : 'bad'}`}>
          {'code' in output
            ? scopeLabel
            : `Conversion error: ${output.error}`}
        </div>
      </div>
    </div>
  )
}
