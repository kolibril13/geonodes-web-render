# Generated from a Tree Clipper export by geonodes-web-render.
# https://github.com/BradyAJohnston/nodebpy
from nodebpy import geometry as g


with g.tree("MixMatrix.002") as tree:
    transform_out = tree.outputs.matrix("Transform")
    transform = tree.inputs.matrix("Transform")
    transform_001 = tree.inputs.matrix("Transform")
    factor = tree.inputs.float("Factor", default_value=0)

    separate_transform = g.SeparateTransform(transform=transform)
    separate_transform_001 = g.SeparateTransform(transform=transform_001)
    mix_002 = g.Mix(factor_float=factor, a_rotation=separate_transform.o.rotation, b_rotation=separate_transform_001.o.rotation, data_type="ROTATION", clamp_factor=True)
    mix_001 = g.Mix(factor_float=factor, a_vector=separate_transform.o.scale, b_vector=separate_transform_001.o.scale, data_type="VECTOR", clamp_factor=True)
    mix = g.Mix(factor_float=factor, a_vector=separate_transform.o.translation, b_vector=separate_transform_001.o.translation, data_type="VECTOR", clamp_factor=True)
    combine_transform_003 = g.CombineTransform(translation=mix.o.result_vector, rotation=mix_002.o.result_rotation, scale=mix_001.o.result_vector)

    combine_transform_003.o.transform >> transform_out

