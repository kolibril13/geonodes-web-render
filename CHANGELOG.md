# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

[0.3.1]: https://github.com/kolibril13/geonodes-web-render/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/kolibril13/geonodes-web-render/compare/v0.2.0...v0.3.0
