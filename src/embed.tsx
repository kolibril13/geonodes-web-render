/**
 * Embeddable graph view for Tree Clipper asset data.
 * Use this entry when consuming geonodes-web-render as a package (e.g. from tree-clipper website).
 *
 * import { GraphView, mountGraphView } from 'geonodes-web-render/embed'
 */
import { createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { useEffect, useState } from 'react'
import { decodeTreeClipperPayload } from './utils/decodeTreeClipperPayload'
import { GeometryNodesFlow } from './gn/components/GeometryNodesFlow'
import './App.css'

export type GraphViewEmbedOptions = {
  /** Raw asset data (e.g. "TreeClipper::H4sI...") */
  payload: string
  /** Called when user requests close (e.g. modal close button). Use to unmount. */
  onClose?: () => void
}

export function GraphView(props: GraphViewEmbedOptions) {
  const { payload } = props
  const [jsonText, setJsonText] = useState<string>('')
  const [decodeError, setDecodeError] = useState<string | null>(null)
  const [decoding, setDecoding] = useState(true)

  useEffect(() => {
    let cancelled = false
    setDecoding(true)
    setDecodeError(null)
    decodeTreeClipperPayload(payload)
      .then((text) => {
        if (!cancelled) {
          setJsonText(text)
          setDecoding(false)
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setDecodeError(e instanceof Error ? e.message : String(e))
          setDecoding(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [payload])

  return (
    <div className="geonodes-embed geonodes-embed--dark">
      <div className="geonodes-embed__body">
        {decoding ? (
          <div className="flow-empty">Decoding…</div>
        ) : decodeError ? (
          <div className="flow-error" role="alert">
            <strong>Decode error</strong>
            <span>{decodeError}</span>
          </div>
        ) : (
          <GeometryNodesFlow jsonText={jsonText} showHeader={false} />
        )}
      </div>
    </div>
  )
}

let embedRoot: Root | null = null

/**
 * Mount the graph view into a DOM container. Call unmountGraphView() to remove.
 */
export function mountGraphView(
  container: HTMLElement,
  options: GraphViewEmbedOptions
): () => void {
  if (embedRoot) {
    embedRoot.unmount()
    embedRoot = null
  }
  embedRoot = createRoot(container)
  const onClose = options.onClose
  embedRoot.render(
    createElement(GraphView, {
      ...options,
      onClose: onClose
        ? () => {
            unmountGraphView()
            onClose()
          }
        : undefined,
    })
  )
  return unmountGraphView
}

export function unmountGraphView(): void {
  if (embedRoot) {
    embedRoot.unmount()
    embedRoot = null
  }
}
