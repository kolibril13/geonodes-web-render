#!/usr/bin/env bash
# Warm the esm.sh CDN for geonodes-web-render so a freshly published version is
# pre-built, shrinking the window where the "@0.3" range (used by nodebpy) still
# resolves to an older patch.
#
# Usage: warm-esm.sh [version]   (default: npm's current "latest")
set -euo pipefail

PKG="geonodes-web-render"
VERSION="${1:-}"
if [ -z "$VERSION" ]; then
  VERSION="$(npm view "$PKG" version)"
fi

echo "Warming esm.sh for ${PKG}@${VERSION}"

# Requesting the exact-version entry points makes esm.sh build them now. The
# range URL ("@0.3") then resolves to it sooner (and serves immutably once built).
for path in "embed" "dist/embed.css"; do
  url="https://esm.sh/${PKG}@${VERSION}/${path}"
  code="$(curl -s -o /dev/null -w '%{http_code}' "$url")"
  printf '  %-18s %s -> %s\n' "$path" "$code" "$url"
done

# Report what the floating range currently resolves to.
RANGE_MAJOR_MINOR="$(echo "$VERSION" | cut -d. -f1-2)"
resolved="$(curl -s -I "https://esm.sh/${PKG}@${RANGE_MAJOR_MINOR}/embed" \
  | grep -i '^x-esm-path' | tr -d '\r' || true)"
echo "Range @${RANGE_MAJOR_MINOR} currently resolves to: ${resolved:-<unknown>}"
echo "(esm.sh caches the range->version map ~10 min; it will flip to ${VERSION} once that expires.)"
