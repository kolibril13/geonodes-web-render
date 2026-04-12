# geonodes-web-render

A browser-based viewer for Blender node trees exported via the [Tree Clipper](https://extensions.blender.org/add-ons/tree-clipper/) add-on. It renders the exported JSON as a read-only, Blender-styled node graph using React Flow.

## What it does

Paste or load a Tree Clipper JSON export and the app displays the node graph with accurate socket colors, node header colors, reroute nodes, float curves, and simulation zones.

<img width="2260" height="1642" alt="image" src="https://github.com/user-attachments/assets/510b1c3e-9382-4f99-97b2-08a496745c13" />


**Data flow:**

```
Tree Clipper JSON / base64 payload
  → normalizeBlenderGraph   (flatten nodes, flip Y axis, assign colors)
  → toGraphIR               (socket-centric edges, resolve links)
  → mapGraphIRToFlow        (React Flow nodes/edges, simulation zone frames)
  → read-only React Flow canvas
```

## Features

- **10 built-in examples** — real Tree Clipper exports loadable from tabs
- **Custom JSON input** — paste JSON directly into the built-in CodeMirror editor
- **Clipboard import** — decode a `TreeClipper::` base64/gzip payload from clipboard
- **Simulation zones** — automatically detects and frames nodes between simulation input/output pairs using graph reachability
- **Blender fidelity** — socket and header colors sourced from Blender's own tables; Math/Compare nodes show human-readable operation labels
- **Embeddable** — ships a separate `embed` entry point for use as a library

## Usage

### Standalone app

```bash
npm install
npm run dev
```

Open `http://localhost:5173/geonodes-web-render/` and pick an example or paste your own JSON.

### Embed in another app

```ts
import { mountGraphView, unmountGraphView } from 'geonodes-web-render/embed'

// payload can be a raw JSON string or a TreeClipper:: base64 encoded string
mountGraphView(container, payload)

// later
unmountGraphView(container)
```

Or use the React component directly:

```tsx
import { GraphView } from 'geonodes-web-render/embed'

<GraphView payload="TreeClipper::H4sI..." />
```

## Tech stack

- **React 19** + **TypeScript**
- **Vite** (with React Compiler enabled)
- **@xyflow/react** (React Flow v12) — graph rendering
- **@uiw/react-codemirror** — JSON editor with one-dark theme

## Deployment

The app is configured with `base: "/geonodes-web-render/"` for hosting on a subpath (e.g. GitHub Pages). Adjust `vite.config.ts` if deploying to a root path.
