/**
 * Dev-only harness for the embeddable GraphView (src/embed.tsx).
 * Not part of the published package — exists so `npm run dev` can render the
 * embed view (copy button + toast) with a real example graph.
 *
 * Open http://localhost:5173/dev-embed.html
 */
import { mountGraphView } from './embed'

const container = document.getElementById('embed')!

// The "Embed preview" button in the main app stashes whatever JSON is
// currently shown there before opening this harness, so the preview matches
// what the user was just looking at.
const stashedPayload = localStorage.getItem('gnwr-embed-preview-payload')
// Consume it so reopening this URL directly later (bookmark, refresh after
// the app tab closed) falls back to the fixed sample below instead of a
// stale graph.
localStorage.removeItem('gnwr-embed-preview-payload')

if (stashedPayload) {
  mountGraphView(container, { payload: stashedPayload })
} else {
  // Opened directly (no stashed payload): fall back to a fixed sample. The
  // decoder accepts raw JSON as a payload, so we can feed an example graph
  // straight from public/assets without base64/gzip encoding. dev-embed.json
  // is example1 plus a Math node, so the preview also exercises a shader-math
  // node.
  fetch(`${import.meta.env.BASE_URL}assets/dev-embed.json`)
    .then((r) => r.text())
    .then((payload) => mountGraphView(container, { payload }))
}
