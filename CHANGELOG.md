# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
