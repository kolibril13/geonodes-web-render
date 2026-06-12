import { useEffect, useMemo, useState } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { python } from '@codemirror/lang-python'
import { EditorView } from '@codemirror/view'
import { oneDark } from '@codemirror/theme-one-dark'
import { exportToNodebpy } from '../gn/exporter/nodebpyExporter'

export function NodebpyCodePane(props: { jsonText: string }) {
  const { jsonText } = props
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

  const nodebpy = useMemo((): { code: string } | { error: string } => {
    const trimmed = jsonText.trim()
    if (trimmed.length === 0) return { error: 'No JSON loaded yet.' }
    try {
      return { code: exportToNodebpy(JSON.parse(jsonText)) }
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'Conversion failed' }
    }
  }, [jsonText])

  const [copied, setCopied] = useState(false)
  async function copyNodebpy() {
    if (!('code' in nodebpy)) return
    await navigator.clipboard.writeText(nodebpy.code)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="panel">
      <div className="panel-header">
        <div className="panel-title">nodebpy</div>
        <div className="panel-actions">
          <button
            type="button"
            className="action-button"
            onClick={copyNodebpy}
            disabled={!('code' in nodebpy)}
            title="Copy nodebpy code to clipboard"
          >
            {copied ? 'Copied!' : 'Copy code'}
          </button>
        </div>
      </div>

      <div className="panel-body">
        <CodeMirror
          className="cm-editor"
          value={'code' in nodebpy ? nodebpy.code : `# ${nodebpy.error}`}
          height="100%"
          readOnly
          basicSetup={{
            lineNumbers: true,
            foldGutter: true,
            highlightActiveLine: true,
            highlightSelectionMatches: true,
          }}
          extensions={[
            python(),
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
        <div className={`json-status ${'code' in nodebpy ? 'ok' : 'bad'}`}>
          {'code' in nodebpy
            ? 'nodebpy code generated from the Tree Clipper JSON — paste into Blender'
            : `Conversion error: ${nodebpy.error}`}
        </div>
      </div>
    </div>
  )
}
