# Generated from a Tree Clipper export by geonodes-web-render.
# https://github.com/BradyAJohnston/nodebpy
from nodebpy import geometry as g


with g.tree("Geometry Nodes") as tree:
    geometry_out = tree.outputs.geometry("Geometry")
    geometry = tree.inputs.geometry("Geometry")

    set_position = g.SetPosition(geometry=geometry, offset=(0, 0, 0))

    set_position.o.geometry >> geometry_out

