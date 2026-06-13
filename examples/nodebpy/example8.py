# Generated from a Tree Clipper export by geonodes-web-render.
# https://github.com/BradyAJohnston/nodebpy
from nodebpy import geometry as g


with g.tree("Select Index at") as tree:
    result_out = tree.outputs.boolean("Result")
    position = tree.inputs.integer("Position", default_value=0)

    index = g.Index()
    compare = g.Compare(operation="EQUAL", data_type="INT")

    position >> compare.i.a
    index.o.index >> compare.i.b
    compare.o.result >> result_out

