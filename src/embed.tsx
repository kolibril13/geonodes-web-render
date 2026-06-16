/**
 * Embeddable graph view for Tree Clipper asset data.
 * Use this entry when consuming geonodes-web-render as a package (e.g. from tree-clipper website).
 *
 * import { GraphView, mountGraphView } from 'geonodes-web-render/embed'
 */
import { createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { useEffect, useRef, useState } from 'react'
import { decodeTreeClipperPayload } from './utils/decodeTreeClipperPayload'
import { GeometryNodesFlow } from './gn/components/GeometryNodesFlow'
import { TreeClipperLogo } from './components/TreeClipperLogo'
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
  // `copied` shows the confirmation; `leaving` plays the 0.5s fade-out before it
  // unmounts. Keep the confirmation up for at least 3s, and longer while the
  // pointer is still over it — only dismiss once the minimum has elapsed AND the
  // mouse has left the confirmation area.
  const [copied, setCopied] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const hoveringRef = useRef(false)
  const minElapsedRef = useRef(false)
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const leaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const dismissIfReady = () => {
    if (!minElapsedRef.current || hoveringRef.current) return
    setLeaving(true)
    if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current)
    fadeTimerRef.current = setTimeout(() => {
      setCopied(false)
      setLeaving(false)
    }, 500)
  }

  // Show the post-copy confirmation. Shared by the top-right button and the
  // canvas right-click "copy selected nodes" action.
  const showConfirmation = () => {
    if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current)
    setLeaving(false)
    setCopied(true)
    minElapsedRef.current = false
    if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current)
    dismissTimerRef.current = setTimeout(() => {
      minElapsedRef.current = true
      dismissIfReady()
    }, 3000)
  }

  const copyPayload = async () => {
    try {
      await navigator.clipboard.writeText(payload)
      showConfirmation()
    } catch {
      // Clipboard can be blocked (no gesture / insecure context); ignore.
    }
  }

  const onConfirmEnter = () => {
    hoveringRef.current = true
    if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current)
    // Re-entering during the fade cancels it and restores the confirmation.
    if (leaving) {
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current)
      setLeaving(false)
    }
  }
  // Short grace period so moving the pointer across the gap between the button
  // and the toast doesn't count as leaving the confirmation area.
  const onConfirmLeave = () => {
    if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current)
    leaveTimerRef.current = setTimeout(() => {
      hoveringRef.current = false
      dismissIfReady()
    }, 150)
  }

  useEffect(() => {
    return () => {
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current)
      if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current)
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current)
    }
  }, [])

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
            <TreeClipperLogo className="gnwr-loading__logo" />
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
              interaction="hybrid"
              onCopiedMagicString={showConfirmation}
            />
            <button
              type="button"
              className={`gnwr-copy-button${copied || leaving ? ' gnwr-copy-button--copied' : ''}`}
              onClick={copyPayload}
              onMouseEnter={onConfirmEnter}
              onMouseLeave={onConfirmLeave}
              title="Copy the Tree Clipper magic string — paste into Blender with the Tree Clipper add-on"
            >
              {copied || leaving ? (
                <>
                  <svg
                    className="gnwr-copy-button__check"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      d="M20 6L9 17l-5-5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <TreeClipperLogo className="gnwr-copy-button__logo" />
                  <span>Copy TreeClipper Magic String</span>
                </>
              )}
            </button>
            {(copied || leaving) && (
              <div
                className={`gnwr-copy-toast${leaving ? ' gnwr-leaving' : ''}`}
                role="status"
                onMouseEnter={onConfirmEnter}
                onMouseLeave={onConfirmLeave}
              >
                Now, you can use this magic string in Blender with the{' '}
                <a
                  href="https://extensions.blender.org/add-ons/tree-clipper/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="gnwr-copy-toast__link"
                >
                  Tree Clipper Extension
                </a>{' '}
                installed.
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
