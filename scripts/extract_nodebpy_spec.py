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


def annotation_name(node: ast.expr) -> str:
    if isinstance(node, ast.Name):
        return node.id
    if isinstance(node, ast.Subscript):  # e.g. Socket[...] generics
        return annotation_name(node.value)
    if isinstance(node, ast.Attribute):
        return node.attr
    return ""


def unsnake(attr: str) -> str:
    return " ".join(w.capitalize() for w in attr.split("_") if w)


def socket_accessors(cls: ast.ClassDef, accessor_name: str) -> list[dict]:
    """Sockets of a nested _Inputs/_Outputs class, in order.

    Each entry has the python attribute name, the builder socket class
    (FloatSocket, GeometrySocket, ...) and the display label taken from the
    docstring that follows the annotation (falling back to the un-snaked
    attribute name).
    """
    for stmt in cls.body:
        if not (isinstance(stmt, ast.ClassDef) and stmt.name == accessor_name):
            continue
        out: list[dict] = []
        body = stmt.body
        for i, s in enumerate(body):
            if not (isinstance(s, ast.AnnAssign) and isinstance(s.target, ast.Name)):
                continue
            label = unsnake(s.target.id)
            if (
                i + 1 < len(body)
                and isinstance(body[i + 1], ast.Expr)
                and isinstance(body[i + 1].value, ast.Constant)
                and isinstance(body[i + 1].value.value, str)
            ):
                doc = body[i + 1].value.value.strip()
                # Docstrings are usually the bare socket label; longer texts
                # are descriptions, so only short ones are trusted as labels.
                if 0 < len(doc) <= 40 and "\n" not in doc and not doc.endswith("."):
                    label = doc
            out.append(
                {
                    "attr": s.target.id,
                    "type": annotation_name(s.annotation),
                    "label": label,
                }
            )
        return out
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
        "inputs": socket_accessors(cls, "_Inputs"),
        "outputs": socket_accessors(cls, "_Outputs"),
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
