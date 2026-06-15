const TREE_CLIPPER_PREFIX = 'TreeClipper::'

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = ''
  // Chunk to avoid call-stack limits on String.fromCharCode for large buffers.
  const CHUNK = 0x8000
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
  }
  return btoa(binary)
}

async function compressGzip(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(
    new CompressionStream('gzip'),
  )
  const buf = await new Response(stream).arrayBuffer()
  return new Uint8Array(buf)
}

/** Encode a JSON string into a Tree Clipper magic string ("TreeClipper::" + base64 of gzip).
 *  Inverse of decodeTreeClipperPayload. */
export async function encodeTreeClipperPayload(jsonText: string): Promise<string> {
  const bytes = new TextEncoder().encode(jsonText)
  const gz = await compressGzip(bytes)
  return TREE_CLIPPER_PREFIX + uint8ArrayToBase64(gz)
}
