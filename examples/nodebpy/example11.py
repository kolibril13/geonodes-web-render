# Generated from a Tree Clipper export by geonodes-web-render.
# https://github.com/BradyAJohnston/nodebpy
from nodebpy import geometry as g
from nodebpy import TreeBuilder
from nodebpy.builder import CustomGeometryGroup


class NodeGroup001(CustomGeometryGroup):
    _name = "NodeGroup.001"

    def _build_group(self, tree: TreeBuilder) -> None:
        mesh_out = tree.outputs.geometry("Mesh")

        value = g.Value(value=1.6)
        cube = g.Cube(size=value.o.value)

        cube.o.mesh >> mesh_out


class NodeGroup(CustomGeometryGroup):
    _name = "NodeGroup"

    def _build_group(self, tree: TreeBuilder) -> None:
        instances_out = tree.outputs.geometry("Instances")
        geometry = tree.inputs.geometry("Geometry")

        group = NodeGroup001()
        instance_on_points = g.InstanceOnPoints(points=geometry, instance=group.o.mesh, rotation=(0, 0, 0), scale=(1, 1, 1))

        instance_on_points.o.instances >> instances_out


with g.tree("Geometry Nodes") as tree:
    geometry_out = tree.outputs.geometry("Geometry")
    geometry = tree.inputs.geometry("Geometry")

    group = NodeGroup(**{"Geometry": geometry})

    group.o.instances >> geometry_out

