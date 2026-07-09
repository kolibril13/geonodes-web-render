---
name: warm-esm
description: After publishing geonodes-web-render, warm the esm.sh CDN (so the "@0.3" range used by nodebpy resolves to the new version sooner) and update the downstream consumers (tree_clipper_website). Use right after `npm publish`, or when a consumer is still seeing an old version.
---

# Warm esm.sh

nodebpy loads geonodes-web-render from esm.sh pinned to a floating range (`@0.3`,
see `nodebpy/src/nodebpy/web_render.py`). esm.sh resolves that range to the
newest matching patch but caches the resolution (~10 min) and only builds an
exact version on first request. Requesting the just-published exact version
pre-builds it, so the range flips over sooner and consumers stop seeing the old
build.

## How to run

Run the helper script. esm.sh is an external host, so this needs network access
(run outside the sandbox). Pass a version to warm a specific one; omit it to use
npm's current `latest`.

```bash
bash .claude/skills/warm-esm/warm-esm.sh            # warm npm "latest"
bash .claude/skills/warm-esm/warm-esm.sh 0.3.11     # warm a specific version
```

Each entry point should return `200`. The script also prints what the `@0.3`
range currently resolves to (`x-esm-path`).

## When to use

- Immediately after every `npm publish` of geonodes-web-render — make this part
  of the release flow.
- When someone reports a consumer (e.g. the nodebpy docs) still showing an older
  version: warm the new one, then note the range cache clears within ~10 min and
  a browser hard-reload picks it up.

## Update downstream consumers on every release

After publishing a new version, update each consumer below. The npm consumers
need an exact bump + reinstall + build; the CDN consumer auto-tracks the range
(just warm esm.sh, done above).

| Project | Path | How it consumes | Update steps |
| --- | --- | --- | --- |
| tree_clipper_website | `~/projects/tree_clipper_website` | npm dep (`^0.3.x`) | bump `package.json` to new version, `npm install`, `npm run build`, commit + push the bump |
| nodebpy | `~/projects/nodebpy` | esm.sh range `@0.3` (`src/nodebpy/web_render.py`) | no code change — warming esm.sh (above) is enough; the range flips within ~10 min |

`npm install` for the consumers may need to run outside the sandbox (writes to
their `node_modules`), and there can be a brief npm-registry propagation delay
before the new exact version is installable — retry `npm view <pkg>@<version>`
until it resolves.
