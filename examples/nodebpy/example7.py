# Generated from a Tree Clipper export by geonodes-web-render.
# https://github.com/BradyAJohnston/nodebpy
from nodebpy import shader as s


with s.material("Shader Nodetree") as tree:
    texture_coordinate = s.TextureCoordinate()
    vector_math = s.VectorMath(vector=texture_coordinate.o.object, operation="LENGTH")
    gradient_texture = s.GradientTexture(vector=texture_coordinate.o.object, gradient_type="RADIAL")
    math = s.Math(value=vector_math.o.value, value_001=0.59, value_002=0.1, operation="COMPARE")
    combine_color = s.CombineColor(red=gradient_texture.o.fac, green=1, blue=1, mode="HSV")
    mix = s.Mix(factor_float=math.o.value, a_color=(0, 0, 0, 1), b_color=combine_color.o.color, data_type="RGBA", clamp_factor=True)
    material_output = s.MaterialOutput(surface=mix.o.result_color, is_active_output=True)

