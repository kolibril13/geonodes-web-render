# nodebpy versions of the Tree Clipper examples

Each `exampleN.py` is generated from the matching `public/assets/exampleN.json`
Tree Clipper export, converted to [nodebpy](https://github.com/BradyAJohnston/nodebpy)
code. Run them inside Blender (nodebpy requires `bpy`):

```python
from nodebpy import geometry as g
# paste or import an example file
```

Regenerate after editing the assets or the converter:

```sh
npm run convert:nodebpy
```

The converter lives in `src/gn/exporter/nodebpyExporter.ts`, driven by
`nodebpySpec.json` — a database extracted from the nodebpy source with
`scripts/extract_nodebpy_spec.py`.

Known limitations:

- Float/RGB curve control points are not converted (flagged with a `# NOTE`).
- Unlinked simulation state items use nodebpy's private `_add_socket` API.
- External references (objects, materials, collections) are left unset.
