#!/usr/bin/env python3
"""Extract a node spec database from the nodebpy source tree.

nodebpy (https://github.com/BradyAJohnston/nodebpy) auto-generates one Python
class per Blender node. This script parses those classes with `ast` and emits
a JSON database mapping bl_idname -> constructor/socket metadata, which
src/gn/exporter/nodebpyExporter.ts uses to generate idiomatic nodebpy code
from Tree Clipper JSON exports.

Usage:
    python3 scripts/extract_nodebpy_spec.py /path/to/nodebpy/clone

Writes src/gn/exporter/nodebpySpec.json.
"""

import ast
import json
import sys
from pathlib import Path


def literal_repr(node: ast.expr | None) -> str | None:
    if node is None:
        return None
    try:
        return ast.unparse(node)
    except Exception:
        return None


def socket_attr_names(cls: ast.ClassDef, accessor_name: str) -> list[str]:
    """Annotation attribute names of a nested _Inputs/_Outputs class, in order."""
    for stmt in cls.body:
        if isinstance(stmt, ast.ClassDef) and stmt.name == accessor_name:
            return [
                s.target.id
                for s in stmt.body
                if isinstance(s, ast.AnnAssign) and isinstance(s.target, ast.Name)
            ]
    return []


def parse_class(cls: ast.ClassDef) -> tuple[str, dict] | None:
    bl_idname = None
    for stmt in cls.body:
        if (
            isinstance(stmt, ast.Assign)
            and len(stmt.targets) == 1
            and isinstance(stmt.targets[0], ast.Name)
            and stmt.targets[0].id == "_bl_idname"
            and isinstance(stmt.value, ast.Constant)
        ):
            bl_idname = stmt.value.value
    if bl_idname is None:
        return None

    params: list[dict] = []
    props: list[dict] = []
    for stmt in cls.body:
        if isinstance(stmt, ast.FunctionDef) and stmt.name == "__init__":
            args = stmt.args
            positional = args.args[1:]  # skip self
            pos_defaults: list[ast.expr | None] = [None] * (
                len(positional) - len(args.defaults)
            ) + list(args.defaults)
            for arg, default in zip(positional, pos_defaults):
                params.append({"name": arg.arg, "default": literal_repr(default)})
            for arg, default in zip(args.kwonlyargs, args.kw_defaults):
                props.append({"name": arg.arg, "default": literal_repr(default)})
            break

    return bl_idname, {
        "class": cls.name,
        "params": params,
        "props": props,
        "inputs": socket_attr_names(cls, "_Inputs"),
        "outputs": socket_attr_names(cls, "_Outputs"),
    }


def main() -> None:
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    nodebpy_root = Path(sys.argv[1])
    nodes_dir = nodebpy_root / "src" / "nodebpy" / "nodes"
    if not nodes_dir.is_dir():
        sys.exit(f"Not a nodebpy checkout: {nodes_dir} missing")

    spec: dict[str, dict[str, dict]] = {}
    for module_dir in sorted(nodes_dir.iterdir()):
        if not module_dir.is_dir():
            continue
        module = module_dir.name  # geometry / shader / compositor
        for py in sorted(module_dir.glob("*.py")):
            tree = ast.parse(py.read_text())
            for stmt in tree.body:
                if not isinstance(stmt, ast.ClassDef):
                    continue
                parsed = parse_class(stmt)
                if parsed is None:
                    continue
                bl_idname, entry = parsed
                # First definition wins except manual.py, which overrides the
                # auto-generated classes (mirrors nodebpy's own import order).
                bucket = spec.setdefault(module, {})
                if bl_idname not in bucket or py.name == "manual.py":
                    bucket[bl_idname] = entry

    out = Path(__file__).resolve().parent.parent / "src" / "gn" / "exporter" / "nodebpySpec.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(spec, indent=1, sort_keys=True) + "\n")
    counts = {m: len(v) for m, v in spec.items()}
    print(f"Wrote {out} ({counts})")


if __name__ == "__main__":
    main()
