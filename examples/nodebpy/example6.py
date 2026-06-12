# Generated from a Tree Clipper export by geonodes-web-render.
# https://github.com/BradyAJohnston/nodebpy
from nodebpy import geometry as g


with g.tree("Curve Tail Simulation GP - With options") as tree:
    geometry_out = tree.outputs.geometry("Geometry")
    geometry = tree.inputs.geometry("Geometry")
    object = tree.inputs.object("Object")
    material = tree.inputs.material("Material")
    index = tree.inputs.integer("Index", default_value=1)
    z = tree.inputs.float("Z", default_value=0)

    zone = g.SimulationZone(items={})
    zone.output._add_socket(name="Geometry", type="GEOMETRY")  # state item without an initial value
    object_info = g.ObjectInfo(object=object)
    position = g.Position()
    combine_xyz = g.CombineXYZ(z=z)
    sample_index = g.SampleIndex(geometry=object_info.o.geometry, value=position.o.position, index=index, data_type="FLOAT_VECTOR")
    set_position = g.SetPosition(geometry=zone.output.o.geometry, offset=combine_xyz.o.vector)
    points = g.Points(position=sample_index.o.value)
    points_to_curves = g.PointsToCurves(points=set_position.o.geometry)
    join_geometry = g.JoinGeometry(geometry=(zone.input.o.geometry, points.o.geometry))
    curves_to_grease_pencil = g.CurvesToGreasePencil(curves=points_to_curves.o.curves, instances_as_layers=False)
    set_material = g.SetMaterial(geometry=curves_to_grease_pencil.o.grease_pencil, material=material)

    join_geometry.o.geometry >> zone.output.i.geometry
    set_material.o.geometry >> geometry_out

