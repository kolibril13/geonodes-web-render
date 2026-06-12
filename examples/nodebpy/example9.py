# Generated from a Tree Clipper export by geonodes-web-render.
# https://github.com/BradyAJohnston/nodebpy
from nodebpy import geometry as g


with g.tree("JUMP") as tree:
    geometry_out = tree.outputs.geometry("Geometry")
    geometry = tree.inputs.geometry("Geometry")

    uv_sphere = g.UVSphere(radius=0.1)
    scene_time = g.SceneTime()
    switch = g.Switch(switch=True, false=uv_sphere.o.mesh, true=geometry, input_type="GEOMETRY")
    math = g.Math(value=scene_time.o.frame, value_001=48, operation="DIVIDE")
    bounding_box = g.BoundingBox(geometry=switch.o.output)
    math_001 = g.Math(value=math.o.value, value_001=1.5, value_002=0, operation="WRAP")
    vector_math = g.VectorMath(vector=bounding_box.o.min, vector_001=(0, -1, 0), operation="MULTIPLY")
    float_curve = g.FloatCurve(value=math_001.o.value)  # NOTE: curve points are not converted
    float_curve_001 = g.FloatCurve(value=math_001.o.value)  # NOTE: curve points are not converted
    set_position = g.SetPosition(geometry=switch.o.output, offset=vector_math.o.vector)
    vector_math_002 = g.VectorMath(vector=vector_math.o.vector, vector_001=(0, -1, 0), operation="MULTIPLY")
    vector_math_001 = g.VectorMath(vector=(0, 1, 0), scale=float_curve.o.value, operation="SCALE")
    map_range = g.MapRange(value=float_curve_001.o.value, from_min=-1, to_min=0.2, to_max=1.8, clamp=True)
    geometry_to_instance = g.GeometryToInstance()
    math_002 = g.Math(value=1, value_001=map_range.o.result, operation="DIVIDE")
    combine_xyz = g.CombineXYZ(x=math_002.o.value, y=map_range.o.result, z=math_002.o.value)
    scale_instances = g.ScaleInstances(instances=geometry_to_instance.o.instances, scale=combine_xyz.o.vector, center=(0, 0, 0))
    set_position_001 = g.SetPosition(geometry=scale_instances.o.instances, offset=vector_math_001.o.vector)
    set_position_002 = g.SetPosition(geometry=set_position_001.o.geometry, offset=vector_math_002.o.vector)

    set_position.o.geometry >> geometry_to_instance.i.geometry
    set_position_002.o.geometry >> geometry_out

