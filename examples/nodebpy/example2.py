# Generated from a Tree Clipper export by geonodes-web-render.
# https://github.com/BradyAJohnston/nodebpy
from nodebpy import geometry as g


with g.tree("Geometry Nodes") as tree:
    geometry_out = tree.outputs.geometry("Geometry")
    geometry = tree.inputs.geometry("Geometry")

    cube = g.Cube(size=(1, 1, 1))
    instance_on_points = g.InstanceOnPoints(points=geometry, instance=cube.o.mesh, rotation=(0, 0, 0), scale=(1, 1, 1))

    instance_on_points.o.instances >> geometry_out

