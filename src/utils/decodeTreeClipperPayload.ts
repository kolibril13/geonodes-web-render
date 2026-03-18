const TREE_CLIPPER_PREFIX = 'TreeClipper::'

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

async function decompressGzip(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(
    new DecompressionStream('gzip'),
  )
  const blob = await new Response(stream).blob()
  const buf = await blob.arrayBuffer()
  return new Uint8Array(buf)
}

/** Decode Tree Clipper asset data (optional "TreeClipper::" prefix + base64, optionally gzipped) to JSON string. */
export async function decodeTreeClipperPayload(raw: string): Promise<string> {
  const trimmed = raw.trim()
  const base64 = trimmed.startsWith(TREE_CLIPPER_PREFIX)
    ? trimmed.slice(TREE_CLIPPER_PREFIX.length)
    : trimmed
  const bytes = base64ToUint8Array(base64)
  const isGzip = bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b
  const decodedBytes = isGzip
    ? await decompressGzip(bytes)
    : bytes
  return new TextDecoder().decode(decodedBytes)
}
