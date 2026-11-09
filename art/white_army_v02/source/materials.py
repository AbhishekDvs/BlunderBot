"""PBR Material definitions for BlunderBot White Army (v0.2).
Authoritative art direction:
  - Ivory and carved sandstone
  - Antique gold & aged bronze
  - Saffron and vermilion accents
  - Polished steel blades
  - Restrained forest green trim
  - Aged timber shafts and mechanical carriages
"""
import bpy
import math
import numpy as np
from pathlib import Path

def create_pbr_material(name, color, roughness=0.6, metallic=0.0, weave=False, tex_dir=None):
    """Creates a Principled BSDF material with procedural basecolor, roughness, and normal maps."""
    mat = bpy.data.materials.get(name)
    if mat is not None:
        return mat

    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    bsdf = nodes.get("Principled BSDF")

    bsdf.inputs['Base Color'].default_value = (*color, 1.0)
    bsdf.inputs['Roughness'].default_value = roughness
    bsdf.inputs['Metallic'].default_value = metallic

    N = 256  # compact, efficient texture size for game assets
    y, x = np.mgrid[0:N, 0:N].astype(float)
    rng = np.random.default_rng(42)
    grain = rng.normal(0, 0.012, (N, N))
    pattern = (np.sin(x * math.pi * 0.5) * np.cos(y * math.pi * 0.5) * 0.03 if weave else np.sin(x * 0.07 + y * 0.05) * 0.006)

    base = np.ones((N, N, 4), np.float32)
    base[:, :, :3] = np.array(color)[None, None, :] * (1.0 + grain[:, :, None] + pattern[:, :, None])
    base[:, :, 3] = 1.0

    def make_img_node(suffix, pixels, is_color=False):
        img_name = f"{name}_{suffix}"
        im = bpy.data.images.get(img_name)
        if im is None:
            im = bpy.data.images.new(img_name, N, N, alpha=True)
            im.pixels.foreach_set(pixels.ravel())
            if tex_dir:
                tex_path = Path(tex_dir) / f"{img_name}.png"
                im.filepath_raw = str(tex_path)
                im.file_format = 'PNG'
                im.save()
            im.colorspace_settings.name = 'sRGB' if is_color else 'Non-Color'
        node = nodes.new('ShaderNodeTexImage')
        node.image = im
        return node

    col_node = make_img_node('basecolor', base, is_color=True)
    links.new(col_node.outputs['Color'], bsdf.inputs['Base Color'])

    r_map = np.ones((N, N, 4), np.float32)
    r_map[:, :, :3] = np.clip(roughness + grain[:, :, None] * 2.0, 0.0, 1.0)
    rough_node = make_img_node('roughness', r_map, is_color=False)
    links.new(rough_node.outputs['Color'], bsdf.inputs['Roughness'])

    norm_map = np.ones((N, N, 4), np.float32)
    norm_map[:, :, 0] = 0.5 + np.cos(x * math.pi * 0.5) * (0.05 if weave else 0.01)
    norm_map[:, :, 1] = 0.5 + np.cos(y * math.pi * 0.5) * (0.05 if weave else 0.01)
    norm_map[:, :, 2] = 1.0
    norm_img_node = make_img_node('normal', norm_map, is_color=False)
    nm_node = nodes.new('ShaderNodeNormalMap')
    nm_node.inputs['Strength'].default_value = 0.25 if weave else 0.12
    links.new(norm_img_node.outputs['Color'], nm_node.inputs['Color'])
    links.new(nm_node.outputs['Normal'], bsdf.inputs['Normal'])

    return mat

def get_white_army_palette(tex_dir=None):
    """Instantiates and returns dictionary of the 8 canonical White Army materials."""
    return {
        'stone': create_pbr_material('ivory_carved_stone', (0.76, 0.68, 0.53), roughness=0.55, metallic=0.0, tex_dir=tex_dir),
        'cloth': create_pbr_material('ivory_woven_cloth', (0.82, 0.74, 0.58), roughness=0.78, metallic=0.0, weave=True, tex_dir=tex_dir),
        'green': create_pbr_material('forest_green_cloth', (0.09, 0.18, 0.11), roughness=0.76, metallic=0.0, weave=True, tex_dir=tex_dir),
        'gold': create_pbr_material('antique_gold', (0.58, 0.36, 0.11), roughness=0.34, metallic=0.92, tex_dir=tex_dir),
        'bronze': create_pbr_material('aged_bronze', (0.30, 0.16, 0.07), roughness=0.48, metallic=0.88, tex_dir=tex_dir),
        'saffron': create_pbr_material('saffron_vermilion', (0.74, 0.28, 0.14), roughness=0.72, metallic=0.0, weave=True, tex_dir=tex_dir),
        'steel': create_pbr_material('polished_steel', (0.68, 0.71, 0.73), roughness=0.25, metallic=0.96, tex_dir=tex_dir),
        'wood': create_pbr_material('dark_timber', (0.08, 0.04, 0.02), roughness=0.64, metallic=0.0, tex_dir=tex_dir),
    }
