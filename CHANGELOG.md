# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.34] - 2026-08-15

### Added

- Nodes with Blender's `hide` property set now render collapsed, matching
  Blender's node-header-only view: the box shrinks to its header and only
  sockets with an actual connection stay visible; unconnected sockets and
  property widgets disappear.

## [0.3.33] - 2026-07-28

### Fixed

- The graph now renders correctly inside scaled host pages such as Reveal.js
  slides. Reveal fits its deck to the window with CSS `zoom` or
  `transform: scale`, which broke React Flow's measurements (handle positions
  come from `getBoundingClientRect`, which is scaled, while node sizes come
  from `offsetWidth`, which is not) — edges attached at the wrong points or
  floated detached from their sockets. The canvas now detects the host's
  effective scale and renders in an inverse-scaled box so the net scale inside
  React Flow is 1; pan/zoom pointer math is corrected by the same fix. Added a
  `dev-reveal.html` harness that emulates both Reveal scaling modes.

## [0.3.32] - 2026-07-23

### Changed

- Updated dependencies to their latest versions: `@xyflow/react`, `@codemirror/*`,
  `@uiw/react-codemirror`, `react`/`react-dom`, `eslint`, `@eslint/js`,
  `@babel/core`, `vite`, `vite-plugin-dts`, `typescript-eslint`, and others.
  TypeScript stays on 5.9 until `typescript-eslint` adds support for
  TypeScript 7.

## [0.3.30] - 2026-07-07

### Fixed

- Trees with multiple simulation zones now render a zone rectangle for every
  zone. Previously only the first Simulation Input/Output pair found got a
  frame, and the pairing between input and output nodes was guessed rather
  than taken from the export's `paired_output` reference.

### Added

- Repeat, For-Each-Element, and Closure zones now render tinted zone
  rectangles too, using Blender's default theme colors for each zone kind.

## [0.3.29] - 2026-07-07

### Fixed

- Integer Math, Vector Math, and Boolean Math nodes now show their operation:
  the header takes the operation's name ("Divide Floor", "Modulo", …) like in
  Blender, and the operation appears as a dropdown-style row in the node body.
  Previously only Math and Compare exposed their operation, so e.g. every
  Integer Math node rendered as an anonymous "Integer Math". Math and Compare
  headers now also adopt the operation name (custom node labels still win).

## [0.3.27] - 2026-06-26

### Fixed

- Reroute nodes now inherit the color of the socket feeding their input, so a
  link keeps its type's color (e.g. yellow `Image`/RGBA) after passing through
  one or more reroutes. Previously, exports that omit a reroute's `socket_idname`
  (such as Compositor trees) fell back to grey, turning otherwise-colored links
  grey downstream of every reroute.

## [0.3.26] - 2026-06-25

### Changed

- Group Input nodes now hide interface sockets that aren't wired to anything,
  rendering only the connected outputs. This declutters trees where a Group Input
  exposes many inputs but a given instance only uses a few. Other node types are
  unaffected.

## [0.3.25] - 2026-06-22

### Added

- `allowSelection` option on the embed (`GraphView` prop / `mountGraphView`
  option, default `true`). When `false`, node selection is disabled and left-drag
  pans the canvas instead of box-selecting — pairs with `showCopyButton: false`
  for a fully read-only pan/zoom viewer.

## [0.3.24] - 2026-06-22

### Added

- `showCopyButton` option on the embed (`GraphView` prop / `mountGraphView`
  option, default `true`). When `false`, the "Copy TreeClipper Magic String"
  button and toast are hidden and the right-click copy action is disabled, so the
  embed can be used as a pure read-only viewer.

## [0.3.23] - 2026-06-16

### Fixed

- Switching from trackpad back to mouse now correctly restores wheel-zoom. The
  device classifier ran in the wheel event's bubble phase, but React Flow's
  pan-on-scroll handler calls `stopImmediatePropagation`, so once in trackpad/pan
  mode the classifier never fired again and the mouse stayed stuck panning. It
  now runs in the capture phase, so it always re-detects the active device.

## [0.3.22] - 2026-06-16

### Fixed

- The simulation-zone frame now uses Blender's exact default theme colour
  (`node_zone_simulation` = `#664162` at alpha 0.2) instead of a slightly too
  pink/saturated plum.

## [0.3.21] - 2026-06-16

### Fixed

- The mouse wheel now always zooms. The device heuristic treated small or
  fractional `deltaY` as a trackpad, so some mice panned instead of zooming; it
  now keys off the horizontal component (a mouse wheel is strictly vertical)
  with a short hold so a trackpad drag doesn't flicker between pan and zoom.

### Added

- README: npm package link/badge.

## [0.3.20] - 2026-06-16

### Added

- README "Controls" section documenting the mouse and trackpad interactions
  (box-select, pan, zoom, context menu) and the embed's click-to-engage scroll.

## [0.3.19] - 2026-06-16

### Changed

- The embed's top-right copy button now reflects the canvas selection: with
  nodes selected it reads "Copy Magic String of N selected node(s)" and copies
  just those nodes (same subset as the right-click menu); with nothing selected
  it copies the whole tree as before.

## [0.3.18] - 2026-06-16

### Added

- Trackpad two-finger drag now pans the canvas (pinch still zooms), matching
  Blender's Mac-trackpad navigation. The input device is detected per wheel
  event so a mouse wheel keeps zooming while a trackpad pans.

### Fixed

- The mouse wheel zooms the canvas again. 0.3.17's trackpad-pan change routed
  all scroll through panning; the wheel handler now classifies mouse vs trackpad
  and steers React Flow between zoom-on-scroll and pan-on-scroll accordingly.
- Middle-button panning now works when it starts over selected nodes. React
  Flow's multi-selection overlay (`.react-flow__nodesselection-rect`, which
  carries the `nopan` class) was swallowing the gesture; since the graph is
  read-only the overlay is now `pointer-events: none`.

## [0.3.17] - 2026-06-16

### Changed

- The embedded canvas now uses the same Blender-style mouse map as the
  standalone app: left-drag box-selects, middle-drag pans, right-click opens the
  context menu. Previously the embed panned on left- and middle-drag with no
  box-select. (With no middle button, hold `Space` to pan with the left button.)
  The "click to engage" wheel-zoom model is unchanged, so the host page still
  scrolls until the reader clicks the canvas.

## [0.3.16] - 2026-06-16

### Changed

- The embedded canvas now uses a "click to engage" wheel model instead of being
  inert: the wheel scrolls the host page until the reader clicks the canvas, then
  it zooms like the standalone app until the pointer leaves. `Ctrl`+wheel and
  trackpad pinch zoom even while resting. A brief "Click to zoom & pan" hint
  flashes when the wheel passes through to the page. Configured via a new
  `interaction` prop (`'always' | 'hybrid' | 'none'`) replacing `zoomOnScroll`.
- Right-click now always opens the context menu (Blender-style) and no longer
  pans. Panning is on middle-drag everywhere, plus left-drag in the embed.

### Fixed

- The right-click context menu now appears directly at the cursor. It was
  positioned with `position: fixed` against viewport coordinates, which lands in
  the wrong place when the embed is scrolled down the host page or nested under a
  transformed ancestor; it is now absolutely positioned within the canvas.

## [0.3.4] - 2026-06-13

### Added

- The embed (`GraphView` / `mountGraphView`) now shows a "Copy for Blender"
  button on the graph that copies the original Tree Clipper payload to the
  clipboard, so a reader can paste it straight into Blender via the Tree Clipper
  add-on.

## [0.3.3] - 2026-06-13

### Fixed

- The embed now actually lets the mouse wheel scroll the host page. 0.3.2
  disabled zoom-on-scroll but React Flow's `preventScrolling` (default `true`)
  still swallowed the wheel event; the embed now sets `preventScrolling={false}`
  so the page scrolls normally over the graph.

## [0.3.2] - 2026-06-13

### Changed

- The embed (`GraphView` / `mountGraphView`) no longer zooms the canvas on
  mouse-wheel, so the wheel scrolls the host page instead of the node tree —
  better when the graph is inline in a docs page. The standalone app keeps
  wheel-zoom. Configurable via the new `zoomOnScroll` prop on
  `GeometryNodesFlow` (default `true`).

## [0.3.1] - 2026-06-13

### Fixed

- Embedded graphs now re-fit to the view once the container has its final size.
  Previously, when the stylesheet loaded after mount (as in a CDN embed), the
  initial `fitView` ran against a wrongly-sized container and the graph stayed
  tiny. A `ResizeObserver` re-fits on size changes, and backs off once the user
  pans or zooms.

## [0.3.0] - 2026-06-13

### Added

- **Tree Clipper → nodebpy export.** A new converter turns a Tree Clipper JSON
  export into runnable [nodebpy](https://github.com/BradyAJohnston/nodebpy)
  Python code, driven by an extracted spec of every node class. Supports group
  trees, simulation zones, reroutes, interface sockets, and shader/compositor
  modules.
- **Three-pane editor layout.** JSON editor, the rendered graph, and the
  generated code now sit side by side, with draggable column splitters.
- **Output-format toggle in the code pane.** Switch the right pane between
  generated nodebpy Python and a re-formatted Tree Clipper JSON view.
- **Compact Tree Clipper JSON formatter.** Each node tree, interface socket,
  node, and link renders on its own line while the surrounding wrapper objects
  stay collapsed inline, so the line count tracks the number of entities and the
  view scrolls horizontally instead of wrapping.
- **Selection-scoped output.** Drag-select nodes on the canvas to scope the
  generated nodebpy code / Tree Clipper JSON to just those nodes (group trees
  used by a selected node are kept whole); click empty space to clear.
- **Multiple embedded graphs per page.** `mountGraphView` now keeps a separate
  React root per container, so several graphs can be mounted on the same page
  without unmounting one another.

### Changed

- `unmountGraphView(container?)` now accepts an optional container to unmount a
  specific graph; with no argument it unmounts the most recently mounted one
  (backwards compatible).

### Fixed

- Reroute node selection now shows a centered circular ring instead of a
  rounded-square outline that was offset from the dot.

## [0.2.0]

- Browser-based, read-only viewer that renders Blender Geometry Nodes exported
  via Tree Clipper as a Blender-styled graph, plus the embeddable `GraphView` /
  `mountGraphView` API.

[0.3.4]: https://github.com/kolibril13/geonodes-web-render/compare/v0.3.3...v0.3.4
[0.3.3]: https://github.com/kolibril13/geonodes-web-render/compare/v0.3.2...v0.3.3
[0.3.2]: https://github.com/kolibril13/geonodes-web-render/compare/v0.3.1...v0.3.2
[0.3.1]: https://github.com/kolibril13/geonodes-web-render/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/kolibril13/geonodes-web-render/compare/v0.2.0...v0.3.0
