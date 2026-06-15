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
  const [copied, setCopied] = useState(false)

  const copyPayload = async () => {
    try {
      await navigator.clipboard.writeText(payload)
      setCopied(true)
      setTimeout(() => setCopied(false), 3500)
    } catch {
      // Clipboard can be blocked (no gesture / insecure context); ignore.
    }
  }

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
          <div className="gnwr-loading" role="status" aria-live="polite">
            <span className="gnwr-loading__spinner" aria-hidden="true" />
            <span className="gnwr-loading__label">Loading graph…</span>
          </div>
        ) : decodeError ? (
          <div className="flow-error" role="alert">
            <strong>Decode error</strong>
            <span>{decodeError}</span>
          </div>
        ) : (
          <>
            <GeometryNodesFlow
              jsonText={jsonText}
              showHeader={false}
              zoomOnScroll={false}
            />
            <button
              type="button"
              className="gnwr-copy-button"
              onClick={copyPayload}
              title="Copy the Tree Clipper magic string — paste into Blender with the Tree Clipper add-on"
            >
              Copy TreeClipper Magic String
            </button>
            {copied && (
              <div className="gnwr-copy-toast" role="status">
                Now, You Can Use This Magic String In Blender With The{' '}
                <a
                  href="https://extensions.blender.org/add-ons/tree-clipper/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="gnwr-copy-toast__link"
                >
                  Tree Clipper Extension
                </a>{' '}
                Installed.
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// One React root per container, so several graphs can live on the same page
// (e.g. a docs page with many examples). Mounting into a container replaces
// only that container's graph, never the others.
const roots = new Map<HTMLElement, Root>()
let lastContainer: HTMLElement | null = null

/**
 * Mount the graph view into a DOM container. Returns a function that unmounts
 * this graph; you can also call unmountGraphView(container).
 */
export function mountGraphView(
  container: HTMLElement,
  options: GraphViewEmbedOptions
): () => void {
  roots.get(container)?.unmount()

  const root = createRoot(container)
  roots.set(container, root)
  lastContainer = container

  const onClose = options.onClose
  root.render(
    createElement(GraphView, {
      ...options,
      onClose: onClose
        ? () => {
            unmountGraphView(container)
            onClose()
          }
        : undefined,
    })
  )
  return () => unmountGraphView(container)
}

/**
 * Unmount a previously mounted graph. With no argument, unmounts the most
 * recently mounted one (kept for backwards compatibility).
 */
export function unmountGraphView(container?: HTMLElement): void {
  const target = container ?? lastContainer
  if (!target) return
  roots.get(target)?.unmount()
  roots.delete(target)
  if (target === lastContainer) lastContainer = null
}
