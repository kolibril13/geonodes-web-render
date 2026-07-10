import { describe, expect, it } from 'vitest'
import { decodeTreeClipperPayload } from './decodeTreeClipperPayload'
import { encodeTreeClipperPayload } from './encodeTreeClipperPayload'

describe('Tree Clipper payload encode/decode', () => {
  it('round-trips a JSON string through encode → decode', async () => {
    const json = JSON.stringify({ node_trees: [{ id: 0, data: { name: 'Tree' } }] })
    const magic = await encodeTreeClipperPayload(json)
    expect(magic.startsWith('TreeClipper::')).toBe(true)
    expect(await decodeTreeClipperPayload(magic)).toBe(json)
  })

  it('round-trips payloads large enough to exercise base64 chunking', async () => {
    // > 0x8000 bytes after gzip, so uint8ArrayToBase64 takes multiple chunks.
    const json = JSON.stringify({
      big: Array.from({ length: 20000 }, () => Math.random().toString(36)),
    })
    const magic = await encodeTreeClipperPayload(json)
    expect(await decodeTreeClipperPayload(magic)).toBe(json)
  })

  it('returns raw JSON input as-is (object and array, with whitespace)', async () => {
    expect(await decodeTreeClipperPayload('  {"a": 1} ')).toBe('{"a": 1}')
    expect(await decodeTreeClipperPayload('[1, 2]')).toBe('[1, 2]')
  })

  it('decodes base64 without the TreeClipper:: prefix', async () => {
    const json = '{"x":42}'
    const magic = await encodeTreeClipperPayload(json)
    const bare = magic.slice('TreeClipper::'.length)
    expect(await decodeTreeClipperPayload(bare)).toBe(json)
  })

  it('decodes plain (non-gzipped) base64', async () => {
    const json = '{"plain":true}'
    const base64 = btoa(json)
    expect(await decodeTreeClipperPayload(`TreeClipper::${base64}`)).toBe(json)
  })
})
