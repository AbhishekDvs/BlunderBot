"""Renders studio turnaround previews for all 6 White Army candidates in Blender.
Outputs:
  - art/white_army_v02/previews/<class>_turnaround.png
"""
import bpy
import math
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[3]
BLENDER_DIR = PROJECT_ROOT / 'art/white_army_v02/blender'
PREVIEWS_DIR = PROJECT_ROOT / 'art/white_army_v02/previews'
PREVIEWS_DIR.mkdir(parents=True, exist_ok=True)

PIECES = [
    ('wP', 'padati.blend', 'Pawn (Padati)', (0, 0, 0.45), 2.2),
    ('wR', 'durg.blend', 'Rook (Durg)', (0, 0, 0.55), 2.4),
    ('wN', 'ashva.blend', 'Knight (Ashva Senani)', (0, 0, 0.60), 2.6),
    ('wB', 'acharya_v03.blend', 'Bishop (Acharya v03)', (0, 0, 0.65), 2.7),
    ('wQ', 'samrajni.blend', 'Queen (Samrajni)', (0, 0, 0.65), 2.7),
    ('wK', 'raja.blend', 'King (Raja)', (0, 0, 0.70), 2.8),
]

def setup_studio_lighting(scene):
    # Key light
    key_data = bpy.data.lights.new('Studio_Key', 'SUN')
    key_data.energy = 4.5
    key_data.color = (1.0, 0.98, 0.95)
    key_obj = bpy.data.objects.new('Studio_Key', key_data)
    key_obj.rotation_euler = (math.radians(50), math.radians(15), math.radians(35))
    scene.collection.objects.link(key_obj)

    # Fill light
    fill_data = bpy.data.lights.new('Studio_Fill', 'SUN')
    fill_data.energy = 2.0
    fill_data.color = (0.85, 0.90, 1.0)
    fill_obj = bpy.data.objects.new('Studio_Fill', fill_data)
    fill_obj.rotation_euler = (math.radians(40), math.radians(-30), math.radians(-70))
    scene.collection.objects.link(fill_obj)

    # Rim light
    rim_data = bpy.data.lights.new('Studio_Rim', 'SUN')
    rim_data.energy = 3.5
    rim_data.color = (1.0, 0.90, 0.75)
    rim_obj = bpy.data.objects.new('Studio_Rim', rim_data)
    rim_obj.rotation_euler = (math.radians(-30), math.radians(40), math.radians(150))
    scene.collection.objects.link(rim_obj)

def render_piece(code, blend_file, target, dist):
    blend_path = BLENDER_DIR / blend_file
    bpy.ops.wm.open_mainfile(filepath=str(blend_path))
    scene = bpy.context.scene

    scene.render.engine = 'BLENDER_EEVEE'
    scene.render.resolution_x = 512
    scene.render.resolution_y = 512
    scene.render.film_transparent = True

    setup_studio_lighting(scene)

    # Camera setup: 3/4 front view
    cam_data = bpy.data.cameras.new('Render_Cam')
    cam_data.lens = 65.0
    cam_obj = bpy.data.objects.new('Render_Cam', cam_data)
    scene.collection.objects.link(cam_obj)
    scene.camera = cam_obj

    tx, ty, tz = target
    cam_angle = math.radians(35)
    cam_elev = math.radians(20)
    cx = tx + dist * math.cos(cam_elev) * math.sin(cam_angle)
    cy = ty - dist * math.cos(cam_elev) * math.cos(cam_angle)
    cz = tz + dist * math.sin(cam_elev)
    cam_obj.location = (cx, cy, cz)

    dx, dy, dz = tx - cx, ty - cy, tz - cz
    pitch = math.atan2(dz, math.sqrt(dx*dx + dy*dy))
    yaw = math.atan2(-dx, dy)
    cam_obj.rotation_euler = (math.pi/2 - pitch, 0, yaw)

    out_path = PREVIEWS_DIR / f'{code}_turnaround.png'
    scene.render.filepath = str(out_path)
    bpy.ops.render.render(write_still=True)
    print(f"Rendered turnaround: {out_path}")
    return out_path

def main():
    for code, blend_file, title, target, dist in PIECES:
        render_piece(code, blend_file, target, dist)

if __name__ == '__main__':
    main()
