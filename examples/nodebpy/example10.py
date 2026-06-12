# Generated from a Tree Clipper export by geonodes-web-render.
# https://github.com/BradyAJohnston/nodebpy
from nodebpy import geometry as g


with g.tree("Add") as tree:
    value_out = tree.outputs.float("Value")
    value = tree.inputs.float("Value", default_value=0.5)
    value_001 = tree.inputs.float("Value", default_value=0.5)

    math = g.Math(value=value, value_001=value_001)

    math.o.value >> value_out

