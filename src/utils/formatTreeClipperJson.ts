/**
 * Pretty-print a Tree Clipper export so that each repeated entity (a node tree,
 * an interface socket, a node, a link) lands on its own line, while every
 * structural wrapper around those entity lists stays collapsed inline.
 *
 * Only the entity arrays break across lines; the `{"id": …, "data": {… "items": [`
 * prefix and the trailing `]}}` suffix each stay on a single line. The result:
 * the number of lines in an entity list equals the number of entities, so
 * selecting one more node on the canvas adds exactly one visible line.
 *
 * Entity lines can get very long; the editor scrolls horizontally rather than
 * wrapping them, so they stay one-per-row on screen.
 */

const INDENT = '  '

// Arrays whose elements are themselves browsable containers (so each node tree
// keeps expanding into its own entity lists). Every other array of objects
// (the `…items` lists) breaks one-element-per-line but the elements stay compact.
const DEEP_ARRAY_KEYS = new Set(['node_trees'])

function isContainer(v: unknown): v is object {
  return typeof v === 'object' && v !== null
}

function arrayHasContainers(arr: unknown[]): boolean {
  return arr.some(isContainer)
}

/** Whole subtree on a single line, with readable `, ` / `: ` separators. */
function compact(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(compact).join(', ')}]`
  }
  if (isContainer(value)) {
    const entries = Object.entries(value)
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}: ${compact(v)}`).join(', ')}}`
  }
  return JSON.stringify(value)
}

/**
 * @param indent         Nesting level, incremented only by expanded arrays.
 * @param expand         Whether this value lives in the structural region (vs. a
 *                       compacted entity, which is always rendered on one line).
 * @param elementsExpand For an expanded array, whether each element keeps expanding.
 */
function render(
  value: unknown,
  indent: number,
  expand: boolean,
  elementsExpand: boolean,
): string {
  if (!isContainer(value) || !expand) return compact(value)

  if (Array.isArray(value)) {
    // Primitive arrays (locations, colors, …) and empty arrays stay inline.
    if (value.length === 0 || !arrayHasContainers(value)) return compact(value)
    const pad = INDENT.repeat(indent)
    const padIn = INDENT.repeat(indent + 1)
    const items = value.map(
      (el) => padIn + render(el, indent + 1, elementsExpand, elementsExpand),
    )
    return `[\n${items.join(',\n')}\n${pad}]`
  }

  // Object: fill mode — keys stay inline, and only an expandable array child
  // introduces line breaks. With no such child this collapses to one line.
  const entries = Object.entries(value)
  if (entries.length === 0) return '{}'
  const parts = entries.map(([k, v]) => {
    const childElementsExpand = Array.isArray(v) && DEEP_ARRAY_KEYS.has(k)
    return `${JSON.stringify(k)}: ${render(v, indent, true, childElementsExpand)}`
  })
  return `{${parts.join(', ')}}`
}

export function formatTreeClipperJson(value: unknown): string {
  return `${render(value, 0, true, false)}\n`
}
