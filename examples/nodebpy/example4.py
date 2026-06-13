# Generated from a Tree Clipper export by geonodes-web-render.
# https://github.com/BradyAJohnston/nodebpy
from nodebpy import geometry as g


with g.tree("Geometry Nodes.004") as tree:
    geometry_out = tree.outputs.geometry("Geometry")
    geometry = tree.inputs.geometry("Geometry")

    vector = g.Vector()
    vector_001 = g.Vector(vector=(1, 1, 1))
    mix = g.Mix(factor_float=0.68251, a_vector=vector.o.vector, b_vector=vector_001.o.vector, data_type="VECTOR", clamp_factor=True)
    set_position = g.SetPosition(geometry=geometry, offset=mix.o.result_vector)

    set_position.o.geometry >> geometry_out

