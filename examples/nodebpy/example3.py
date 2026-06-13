# Generated from a Tree Clipper export by geonodes-web-render.
# https://github.com/BradyAJohnston/nodebpy
from nodebpy import geometry as g


with g.tree("Ball-Stick") as tree:
    geometry_out = tree.outputs.geometry("Geometry")
    geometry = tree.inputs.geometry("Geometry")
    radius_ball = tree.inputs.float("Radius Ball", default_value=0.28)
    radius_stick = tree.inputs.float("Radius Stick", default_value=0.12)

    mesh_to_curve = g.MeshToCurve(mesh=geometry, mode="FACES")
    curve_circle = g.CurveCircle(resolution=35, radius=radius_stick)
    uv_sphere = g.UVSphere(radius=radius_ball)
    curve_to_mesh = g.CurveToMesh(curve=mesh_to_curve.o.curve, profile_curve=curve_circle.o.curve)
    instance_on_points_001 = g.InstanceOnPoints(points=geometry, instance=uv_sphere.o.mesh, rotation=(0, 0, 0), scale=(1, 1, 1))
    join_geometry = g.JoinGeometry(geometry=(instance_on_points_001.o.instances, curve_to_mesh.o.mesh))
    set_shade_smooth = g.SetShadeSmooth(geometry=join_geometry.o.geometry, domain="EDGE")

    set_shade_smooth.o.geometry >> geometry_out

