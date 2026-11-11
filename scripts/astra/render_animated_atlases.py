"""Renders frame-by-frame 2.5D animation frames from rigged Blender models.
Outputs 64 frames per piece to /tmp/blunderbot_frames/{piece_code}_{cell_idx:02d}.png.
"""
import bpy
import json
import math
import os
import sys
from pathlib import Path

PROJECT_ROOT = Path('/home/fullmetal-alchemist/Documents/projects/BlunderBot')
BLENDER_DIR = PROJECT_ROOT / 'art/white_army_v02/blender'
TMP_DIR = Path('/tmp/blunderbot_frames')
TMP_DIR.mkdir(parents=True, exist_ok=True)

# Piece configs: (blend_file, rig_name, camera_ortho_scale, camera_z_target)
PIECE_CONFIGS = {
    'wP': ('padati.blend', 'Padati_Rig', 1.25, 0.44),
    'wN': ('ashva.blend', 'Ashva_Rig', 1.48, 0.52),
    'wB': ('acharya_v03.blend', 'Acharya_Rig', 1.35, 0.48),
    'wR': ('durg.blend', 'Durg_Rig', 1.30, 0.46),
    'wQ': ('samrajni.blend', 'Samrajni_Rig', 1.40, 0.50),
    'wK': ('raja.blend', 'Raja_Rig', 1.44, 0.52),
}

# Clips schedule: (action_name, frame_indices) -> maps to 64 cells
CLIP_SCHEDULE = [
    # Row 0: idle (0..7)
    ('idle', [1, 14, 28, 42, 56, 70, 84, 96]),
    # Row 1 & 2: move (8..19 = 12 frames)
    ('move', [1, 5, 9, 13, 17, 21, 25, 29, 33, 37, 41, 45]),
    # Row 2: attack_anticipation (20..23 = 4 frames)
    ('attack_anticipation', [1, 8, 16, 24]),
    # Row 3: attack (24..31 = 8 frames)
    ('attack', [1, 5, 10, 14, 18, 24, 30, 36]),
    # Row 4: defend (32..37 = 6 frames)
    ('defend', [1, 7, 14, 20, 28, 36]),
    # Row 4 & 5: hit (38..41 = 4 frames)
    ('hit', [1, 6, 12, 24]),
    # Row 5: stagger (42..47 = 6 frames)
    ('stagger', [1, 7, 14, 21, 28, 36]),
    # Row 6: defeat (48..55 = 8 frames)
    ('defeat', [1, 7, 14, 21, 28, 35, 42, 48]),
    # Row 7: victory (56..63 = 8 frames)
    ('victory', [1, 7, 14, 21, 28, 35, 42, 48]),
]

def setup_scene(ortho_scale, z_target):
    scene = bpy.context.scene
    scene.render.engine = 'BLENDER_EEVEE_NEXT' if 'BLENDER_EEVEE_NEXT' in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items else 'BLENDER_EEVEE'
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGBA'
    scene.render.resolution_x = 256
    scene.render.resolution_y = 256
    if hasattr(scene.eevee, 'taa_render_samples'):
        scene.eevee.taa_render_samples = 4

    # Camera: 48 degrees elevation, orthographic
    for o in list(scene.objects):
        if o.type == 'CAMERA':
            bpy.data.objects.remove(o, do_unlink=True)
    
    cam_data = bpy.data.cameras.new('AtlasCam')
    cam_data.type = 'ORTHO'
    cam_data.ortho_scale = ortho_scale
    cam_obj = bpy.data.objects.new('AtlasCam', cam_data)
    scene.collection.objects.link(cam_obj)
    scene.camera = cam_obj

    elev = math.radians(48)
    dist = 4.0
    cam_obj.location = (0, -dist * math.cos(elev), dist * math.sin(elev) + z_target)
    cam_obj.rotation_euler = (math.radians(90 - 48), 0, 0)

    # Lighting: Sun + Rim
    for o in list(scene.objects):
        if o.type == 'LIGHT':
            bpy.data.objects.remove(o, do_unlink=True)

    sun_data = bpy.data.lights.new(name='KeySun', type='SUN')
    sun_data.energy = 4.5
    sun_obj = bpy.data.objects.new(name='KeySun', object_data=sun_data)
    scene.collection.objects.link(sun_obj)
    sun_obj.rotation_euler = (math.radians(45), math.radians(25), math.radians(-35))

    rim_data = bpy.data.lights.new(name='RimSun', type='SUN')
    rim_data.energy = 2.5
    rim_obj = bpy.data.objects.new(name='RimSun', object_data=rim_data)
    scene.collection.objects.link(rim_obj)
    rim_obj.rotation_euler = (math.radians(-40), math.radians(-20), math.radians(145))

def recolor_to_asura():
    """Converts materials to the dark volcanic Asura palette."""
    for mat in bpy.data.materials:
        if not mat.use_nodes:
            continue
        bsdf = mat.node_tree.nodes.get('Principled BSDF')
        if not bsdf:
            continue
        name = mat.name.lower()
        if 'stone' in name or 'plinth' in name:
            bsdf.inputs['Base Color'].default_value = (0.12, 0.13, 0.15, 1.0)
            bsdf.inputs['Roughness'].default_value = 0.38
        elif 'gold' in name or 'brass' in name:
            bsdf.inputs['Base Color'].default_value = (0.68, 0.52, 0.22, 1.0)
            bsdf.inputs['Roughness'].default_value = 0.28
        elif 'cloth' in name or 'dhoti' in name or 'sash' in name or 'mantle' in name:
            bsdf.inputs['Base Color'].default_value = (0.48, 0.08, 0.10, 1.0)
        elif 'armor' in name or 'cuirass' in name or 'steel' in name or 'body' in name:
            bsdf.inputs['Base Color'].default_value = (0.16, 0.18, 0.20, 1.0)
            bsdf.inputs['Roughness'].default_value = 0.30

def render_piece_frames(piece_code, is_black=False):
    base_code = 'w' + piece_code[1]
    blend_name, rig_name, ortho_scale, z_target = PIECE_CONFIGS[base_code]
    blend_path = BLENDER_DIR / blend_name

    bpy.ops.wm.open_mainfile(filepath=str(blend_path))
    setup_scene(ortho_scale, z_target)
    scene = bpy.context.scene

    arm = bpy.data.objects.get(rig_name)
    if not arm:
        print(f"Error: {rig_name} not found in {blend_name}")
        return

    if is_black:
        recolor_to_asura()

    cell_idx = 0
    for action_name, frame_list in CLIP_SCHEDULE:
        action = bpy.data.actions.get(action_name)
        if not action:
            action = bpy.data.actions.get('idle')
        arm.animation_data.action = action

        for frame_num in frame_list:
            scene.frame_set(frame_num)
            frame_path = str(TMP_DIR / f'{piece_code}_{cell_idx:02d}.png')
            scene.render.filepath = frame_path
            bpy.ops.render.render(write_still=True)
            cell_idx += 1
    print(f"Rendered {cell_idx} frames for {piece_code} into {TMP_DIR}")

if __name__ == '__main__':
    args = [a for a in sys.argv if not a.endswith('.py') and not a.startswith('-') and a != 'blender']
    target = args[-1] if args else 'BENCHMARK'
    if target == 'ALL':
        pieces = ['wP', 'wN', 'wB', 'wR', 'wQ', 'wK', 'bP', 'bN', 'bB', 'bR', 'bQ', 'bK']
    elif target == 'BENCHMARK':
        pieces = ['wP', 'wN', 'wB', 'bP', 'bN', 'bB']
    else:
        pieces = [target]

    for p in pieces:
        is_blk = p.startswith('b')
        print(f"\n--- Rendering 2.5D Animation Frames for {p} ---")
        render_piece_frames(p, is_black=is_blk)
    print("\nFrame rendering complete!")
