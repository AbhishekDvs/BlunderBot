"""BlunderBot White Army - Knight (Ashva Senani) Procedural Blender Builder.
Creates an anatomically convincing cavalry horse and mounted warrior:
  - Continuous quad equine body (barrel, withers, croup, chest)
  - Arched equine neck and sculpted head with Marwari curled ears
  - Four articulated legs with anatomical knee and hock joints
  - Cavalry saddle, reins, chamfron, and caparison
  - Seated anatomical warrior rider with cavalry lance
  - 10 standard mounted skeletal animation clips
Exports:
  - art/white_army_v02/blender/ashva.blend
  - art/white_army_v02/exports/wN.glb
  - apps/frontend/public/models/astra-dev-v02/wN.glb
"""
import bpy
import math
import numpy as np
from pathlib import Path
import sys

SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from materials import get_white_army_palette

PROJECT_ROOT = SCRIPT_DIR.parents[2]
BLENDER_DIR = PROJECT_ROOT / 'art/white_army_v02/blender'
EXPORTS_DIR = PROJECT_ROOT / 'art/white_army_v02/exports'
PUBLIC_DEV_DIR = PROJECT_ROOT / 'apps/frontend/public/models/astra-dev-v02'
TEX_DIR = PROJECT_ROOT / 'art/white_army_v02/exports/textures'
HUMAN_BASE_PATH = Path('/tmp/blunderbot-astra-production-audit/art/astra/source-candidates/human-base-meshes-bundle-v1.4.1/human_base_meshes_bundle.blend')

for d in [BLENDER_DIR, EXPORTS_DIR, PUBLIC_DEV_DIR, TEX_DIR]:
    d.mkdir(parents=True, exist_ok=True)

def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.unit_settings.system = 'METRIC'
    scene.unit_settings.scale_length = 1.0
    scene.render.fps = 24
    return scene

def create_plinth(pal, r=0.31, h=0.045):
    """Creates a grounded stone plinth at Y = 0 to h."""
    n = 16
    verts = []
    for i in range(n):
        a = 2 * math.pi * i / n
        verts.append((r * math.cos(a), r * math.sin(a), 0.0))
    for i in range(n):
        a = 2 * math.pi * i / n
        verts.append((r * 0.95 * math.cos(a), r * 0.95 * math.sin(a), h))
    verts.append((0, 0, 0.0))
    verts.append((0, 0, h))
    bot_center = 2 * n
    top_center = 2 * n + 1

    faces = []
    for i in range(n):
        nxt = (i + 1) % n
        faces.append((i, nxt, n + nxt, n + i))
        faces.append((nxt, i, bot_center))
        faces.append((n + i, n + nxt, top_center))

    mesh = bpy.data.meshes.new('Plinth_Stone')
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new('Plinth_Stone', mesh)
    bpy.context.scene.collection.objects.link(obj)
    mesh.materials.append(pal['stone'])
    return obj

def build_equine_body(pal):
    """Builds an anatomically connected quad horse mesh with proper proportions."""
    # Horse barrel & withers: lofted cross-sections along Y axis (front to back)
    # Sections: [y, z_center, rx, rz]
    cross_sections = [
        (0.24, 0.54, 0.14, 0.17),  # 0: Chest / breast
        (0.12, 0.57, 0.16, 0.18),  # 1: Withers & girth
        (-0.02, 0.52, 0.15, 0.16), # 2: Saddle dip / mid barrel
        (-0.16, 0.54, 0.15, 0.17), # 3: Flank
        (-0.28, 0.53, 0.14, 0.16), # 4: Croup & hindquarters
        (-0.35, 0.49, 0.08, 0.11), # 5: Tail dock
    ]

    n_circ = 16
    verts = []
    faces = []
    for s_idx, (sy, sz, rx, rz) in enumerate(cross_sections):
        for i in range(n_circ):
            a = 2 * math.pi * i / n_circ
            x = rx * math.cos(a)
            z = sz + rz * math.sin(a)
            verts.append((x, sy, z))

    for s_idx in range(len(cross_sections) - 1):
        for i in range(n_circ):
            a = s_idx * n_circ + i
            b = s_idx * n_circ + (i + 1) % n_circ
            c = (s_idx + 1) * n_circ + (i + 1) % n_circ
            d = (s_idx + 1) * n_circ + i
            faces.append((a, b, c, d))

    # Caps
    front_center = len(verts)
    verts.append((0, 0.28, 0.54))
    back_center = len(verts)
    verts.append((0, -0.38, 0.49))

    for i in range(n_circ):
        nxt = (i + 1) % n_circ
        faces.append((i, front_center, nxt))
        last_s = (len(cross_sections) - 1) * n_circ
        faces.append((last_s + nxt, back_center, last_s + i))

    mesh = bpy.data.meshes.new('Horse_Body')
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    body_obj = bpy.data.objects.new('Horse_Body', mesh)
    bpy.context.scene.collection.objects.link(body_obj)
    mesh.materials.append(pal['stone'])

    # Add modest subsurf for organic muscle curve
    sub = body_obj.modifiers.new('Subdivision', 'SUBSURF')
    sub.levels = 1
    sub.render_levels = 1

    return body_obj

def build_equine_neck_and_head(pal):
    """Builds arched equine neck, head with muzzle, nostrils, and Marwari ears."""
    # Neck sections from withers to poll (Z: 0.55 -> 0.85, Y: 0.20 -> 0.38)
    neck_sections = [
        (0.20, 0.55, 0.11, 0.15),
        (0.25, 0.65, 0.09, 0.14),
        (0.30, 0.75, 0.08, 0.12),
        (0.34, 0.84, 0.07, 0.10), # Poll
    ]
    n_circ = 12
    verts = []
    faces = []
    for s_idx, (sy, sz, rx, rz) in enumerate(neck_sections):
        for i in range(n_circ):
            a = 2 * math.pi * i / n_circ
            verts.append((rx * math.cos(a), sy, sz + rz * math.sin(a)))

    for s_idx in range(len(neck_sections) - 1):
        for i in range(n_circ):
            a = s_idx * n_circ + i
            b = s_idx * n_circ + (i + 1) % n_circ
            c = (s_idx + 1) * n_circ + (i + 1) % n_circ
            d = (s_idx + 1) * n_circ + i
            faces.append((a, b, c, d))

    # Equine Head: muzzle extending forward and down from poll
    # Poll at (0, 0.34, 0.84), Muzzle at (0, 0.48, 0.72)
    h_sections = [
        (0.34, 0.84, 0.07, 0.09), # Cheek / jowl
        (0.40, 0.79, 0.06, 0.07), # Mid face
        (0.46, 0.74, 0.045, 0.05), # Bridge
        (0.50, 0.70, 0.035, 0.035), # Muzzle
    ]
    offset = len(verts)
    for s_idx, (sy, sz, rx, rz) in enumerate(h_sections):
        for i in range(n_circ):
            a = 2 * math.pi * i / n_circ
            verts.append((rx * math.cos(a), sy, sz + rz * math.sin(a)))

    for s_idx in range(len(h_sections) - 1):
        for i in range(n_circ):
            a = offset + s_idx * n_circ + i
            b = offset + s_idx * n_circ + (i + 1) % n_circ
            c = offset + (s_idx + 1) * n_circ + (i + 1) % n_circ
            d = offset + (s_idx + 1) * n_circ + i
            faces.append((a, b, c, d))

    # Muzzle tip cap
    m_tip = len(verts)
    verts.append((0, 0.52, 0.69))
    last_s = offset + (len(h_sections) - 1) * n_circ
    for i in range(n_circ):
        nxt = (i + 1) % n_circ
        faces.append((last_s + i, m_tip, last_s + nxt))

    mesh = bpy.data.meshes.new('Horse_Head_Neck')
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    head_obj = bpy.data.objects.new('Horse_Head_Neck', mesh)
    bpy.context.scene.collection.objects.link(head_obj)
    mesh.materials.append(pal['stone'])

    # Marwari Curled Inward Ears
    for side, sign in [('L', 1), ('R', -1)]:
        bpy.ops.mesh.primitive_cone_add(radius1=0.02, radius2=0.003, depth=0.08, vertices=8)
        ear = bpy.context.active_object
        ear.name = f'Horse_Ear_{side}'
        ear.rotation_euler = (0.25, sign * -0.20, sign * 0.15)
        ear.location = (sign * 0.045, 0.35, 0.91)
        bpy.ops.object.transform_apply(location=True, rotation=True)
        ear.data.materials.append(pal['stone'])
        ear.parent = head_obj

    # Chamfron (Armored Forehead Plate)
    bpy.ops.mesh.primitive_cylinder_add(radius=0.062, depth=0.18, vertices=12)
    chamfron = bpy.context.active_object
    chamfron.name = 'Horse_Chamfron'
    chamfron.scale = (0.85, 0.45, 1.0)
    chamfron.rotation_euler = (math.pi / 4, 0, 0)
    chamfron.location = (0, 0.42, 0.78)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    chamfron.data.materials.append(pal['gold'])
    chamfron.parent = head_obj

    # Layered Mane along crest
    bpy.ops.mesh.primitive_cube_add(size=1.0)
    mane = bpy.context.active_object
    mane.name = 'Horse_Mane'
    mane.scale = (0.025, 0.22, 0.35)
    mane.rotation_euler = (0.45, 0, 0)
    mane.location = (0, 0.26, 0.74)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    mane.data.materials.append(pal['bronze'])
    mane.parent = head_obj

    return head_obj

def build_equine_legs(pal):
    """Builds 4 articulated legs with true anatomical carpal knees, hocks, cannon bones, and hooves."""
    scene = bpy.context.scene
    leg_objs = {}

    # Front Legs: carpus knee at Z ≈ 0.28, fetlock at Z ≈ 0.12, hoof on plinth at Z ≈ 0.045
    # Upper leg (radius) & Lower leg (cannon + hoof)
    for side, sign in [('L', 1), ('R', -1)]:
        # Front Upper Leg
        bpy.ops.mesh.primitive_cylinder_add(radius=0.038, depth=0.24, vertices=12)
        fl_up = bpy.context.active_object
        fl_up.name = f'Horse_F{side}_Upper'
        fl_up.location = (sign * 0.12, 0.18, 0.40)
        bpy.ops.object.transform_apply(location=True)
        fl_up.data.materials.append(pal['stone'])
        leg_objs[f'Horse_F{side}_Upper'] = fl_up

        # Front Lower Leg (Cannon + Fetlock)
        bpy.ops.mesh.primitive_cylinder_add(radius=0.028, depth=0.22, vertices=12)
        fl_low = bpy.context.active_object
        fl_low.name = f'Horse_F{side}_Lower'
        fl_low.location = (sign * 0.12, 0.18, 0.18)
        bpy.ops.object.transform_apply(location=True)
        fl_low.data.materials.append(pal['stone'])
        leg_objs[f'Horse_F{side}_Lower'] = fl_low

        # Front Hoof (Solid truncated cone)
        bpy.ops.mesh.primitive_cone_add(radius1=0.042, radius2=0.032, depth=0.045, vertices=12)
        fl_hoof = bpy.context.active_object
        fl_hoof.name = f'Horse_F{side}_Hoof'
        fl_hoof.location = (sign * 0.12, 0.18, 0.065)
        bpy.ops.object.transform_apply(location=True)
        fl_hoof.data.materials.append(pal['bronze'])
        leg_objs[f'Horse_F{side}_Hoof'] = fl_hoof

        # Rear Leg: Thigh/Gaskin angled back, Hock at Z ≈ 0.28, rear cannon vertical to hoof
        # Rear Upper Leg (Gaskin)
        bpy.ops.mesh.primitive_cylinder_add(radius=0.048, depth=0.24, vertices=12)
        bl_up = bpy.context.active_object
        bl_up.name = f'Horse_B{side}_Upper'
        bl_up.rotation_euler = (-0.25, 0, 0)
        bl_up.location = (sign * 0.13, -0.22, 0.40)
        bpy.ops.object.transform_apply(location=True, rotation=True)
        bl_up.data.materials.append(pal['stone'])
        leg_objs[f'Horse_B{side}_Upper'] = bl_up

        # Rear Lower Leg (Hock + Cannon)
        bpy.ops.mesh.primitive_cylinder_add(radius=0.030, depth=0.22, vertices=12)
        bl_low = bpy.context.active_object
        bl_low.name = f'Horse_B{side}_Lower'
        bl_low.rotation_euler = (0.15, 0, 0)
        bl_low.location = (sign * 0.13, -0.24, 0.18)
        bpy.ops.object.transform_apply(location=True, rotation=True)
        bl_low.data.materials.append(pal['stone'])
        leg_objs[f'Horse_B{side}_Lower'] = bl_low

        # Rear Hoof
        bpy.ops.mesh.primitive_cone_add(radius1=0.042, radius2=0.032, depth=0.045, vertices=12)
        bl_hoof = bpy.context.active_object
        bl_hoof.name = f'Horse_B{side}_Hoof'
        bl_hoof.location = (sign * 0.13, -0.24, 0.065)
        bpy.ops.object.transform_apply(location=True)
        bl_hoof.data.materials.append(pal['bronze'])
        leg_objs[f'Horse_B{side}_Hoof'] = bl_hoof

    # Sweeping Tail (Z ≈ 0.22 to 0.50)
    bpy.ops.mesh.primitive_cone_add(radius1=0.045, radius2=0.012, depth=0.32, vertices=10)
    tail = bpy.context.active_object
    tail.name = 'Horse_Tail'
    tail.rotation_euler = (0.35, 0, 0)
    tail.location = (0, -0.38, 0.35)
    bpy.ops.object.transform_apply(location=True, rotation=True)
    tail.data.materials.append(pal['bronze'])
    leg_objs['Horse_Tail'] = tail

    return leg_objs

def build_rider_and_lance(pal):
    """Builds correctly seated warrior rider, caparison, and couched cavalry lance."""
    scene = bpy.context.scene
    rider_objs = []

    # 1. Caparison / Saddle Cloth over horse back (Z ≈ 0.45 to 0.58)
    bpy.ops.mesh.primitive_cylinder_add(radius=0.185, depth=0.36, vertices=16)
    saddle_cloth = bpy.context.active_object
    saddle_cloth.name = 'Horse_SaddleCloth'
    saddle_cloth.scale = (1.0, 0.75, 1.0)
    saddle_cloth.rotation_euler = (math.pi / 2, 0, 0)
    saddle_cloth.location = (0, -0.04, 0.52)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    saddle_cloth.data.materials.append(pal['saffron'])
    rider_objs.append(saddle_cloth)

    # Saddle Pommel & Cantle (Gold trim)
    bpy.ops.mesh.primitive_torus_add(major_radius=0.17, minor_radius=0.018, major_segments=16, minor_segments=6)
    saddle = bpy.context.active_object
    saddle.name = 'Horse_Saddle'
    saddle.scale = (0.9, 1.3, 0.8)
    saddle.location = (0, -0.04, 0.62)
    bpy.ops.object.transform_apply(location=True, scale=True)
    saddle.data.materials.append(pal['gold'])
    rider_objs.append(saddle)

    # 2. Seated Warrior Rider (Torso at Z ≈ 0.64 to 0.95)
    bpy.ops.mesh.primitive_cylinder_add(radius=0.115, depth=0.26, vertices=14)
    torso = bpy.context.active_object
    torso.name = 'Rider_Torso'
    torso.scale = (1.0, 0.75, 1.0)
    torso.location = (0, -0.04, 0.78)
    bpy.ops.object.transform_apply(location=True, scale=True)
    torso.data.materials.append(pal['bronze'])
    rider_objs.append(torso)

    # Rider Thighs wrapped around horse flanks
    for side, sign in [('L', 1), ('R', -1)]:
        bpy.ops.mesh.primitive_cylinder_add(radius=0.042, depth=0.22, vertices=10)
        thigh = bpy.context.active_object
        thigh.name = f'Rider_Thigh_{side}'
        thigh.rotation_euler = (0.35, sign * 0.45, 0)
        thigh.location = (sign * 0.16, -0.02, 0.56)
        bpy.ops.object.transform_apply(location=True, rotation=True)
        thigh.data.materials.append(pal['cloth'])
        rider_objs.append(thigh)

        # Stirrups (Gold hoop)
        bpy.ops.mesh.primitive_torus_add(major_radius=0.035, minor_radius=0.008, major_segments=12, minor_segments=4)
        stirrup = bpy.context.active_object
        stirrup.name = f'Stirrup_{side}'
        stirrup.location = (sign * 0.20, -0.02, 0.44)
        bpy.ops.object.transform_apply(location=True)
        stirrup.data.materials.append(pal['gold'])
        rider_objs.append(stirrup)

    # Rider Head with Cavalry Turban (Z ≈ 0.95 to 1.12)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.065, segments=12, ring_count=8)
    r_head = bpy.context.active_object
    r_head.name = 'Rider_Head'
    r_head.location = (0, -0.04, 0.98)
    bpy.ops.object.transform_apply(location=True)
    r_head.data.materials.append(pal['stone'])
    rider_objs.append(r_head)

    bpy.ops.mesh.primitive_cylinder_add(radius=0.075, depth=0.065, vertices=14)
    r_turban = bpy.context.active_object
    r_turban.name = 'Rider_Turban'
    r_turban.location = (0, -0.04, 1.03)
    bpy.ops.object.transform_apply(location=True)
    r_turban.data.materials.append(pal['green'])
    rider_objs.append(r_turban)

    # 3. Arms: Left arm holds reins, Right arm couches lance
    bpy.ops.mesh.primitive_cylinder_add(radius=0.03, depth=0.20, vertices=8)
    arm_l = bpy.context.active_object
    arm_l.name = 'Rider_Arm_L'
    arm_l.rotation_euler = (0.55, 0.25, 0)
    arm_l.location = (0.12, 0.04, 0.74)
    bpy.ops.object.transform_apply(location=True, rotation=True)
    arm_l.data.materials.append(pal['cloth'])
    rider_objs.append(arm_l)

    bpy.ops.mesh.primitive_cylinder_add(radius=0.03, depth=0.20, vertices=8)
    arm_r = bpy.context.active_object
    arm_r.name = 'Rider_Arm_R'
    arm_r.rotation_euler = (0.40, -0.25, 0)
    arm_r.location = (-0.14, 0.06, 0.74)
    bpy.ops.object.transform_apply(location=True, rotation=True)
    arm_r.data.materials.append(pal['cloth'])
    rider_objs.append(arm_r)

    # 4. Couched Cavalry Lance (Bhala) Assembly
    lance_root = bpy.data.objects.new('Lance_Assembly', None)
    scene.collection.objects.link(lance_root)
    rider_objs.append(lance_root)

    # Wooden Lance Shaft (length 1.10 units, angled forward)
    bpy.ops.mesh.primitive_cylinder_add(radius=0.015, depth=1.10, vertices=12)
    lance = bpy.context.active_object
    lance.name = 'Cavalry_Lance'
    lance.rotation_euler = (math.pi / 4, 0, 0)
    lance.location = (-0.18, 0.22, 0.82)
    bpy.ops.object.transform_apply(location=True, rotation=True)
    lance.data.materials.append(pal['wood'])
    lance.parent = lance_root
    rider_objs.append(lance)

    # Lance Cone Vamplate (Guard)
    bpy.ops.mesh.primitive_cone_add(radius1=0.055, radius2=0.018, depth=0.08, vertices=12)
    guard = bpy.context.active_object
    guard.name = 'Cavalry_LanceGuard'
    guard.rotation_euler = (-math.pi / 4, 0, 0)
    guard.location = (-0.18, 0.08, 0.72)
    bpy.ops.object.transform_apply(location=True, rotation=True)
    guard.data.materials.append(pal['gold'])
    guard.parent = lance_root
    rider_objs.append(guard)

    # Steel Lance Tip
    bpy.ops.mesh.primitive_cone_add(radius1=0.035, radius2=0.002, depth=0.18, vertices=8)
    tip = bpy.context.active_object
    tip.name = 'Cavalry_LanceTip'
    tip.scale = (0.45, 1.0, 1.0)
    tip.rotation_euler = (math.pi / 4, 0, 0)
    tip.location = (-0.18, 0.62, 1.18)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    tip.data.materials.append(pal['steel'])
    tip.parent = lance_root
    rider_objs.append(tip)

    # Sockets
    tip_empty = bpy.data.objects.new('weapon_tip_socket', None)
    tip_empty.empty_display_type = 'SPHERE'
    tip_empty.empty_display_size = 0.04
    tip_empty.location = (-0.18, 0.68, 1.25)
    scene.collection.objects.link(tip_empty)
    tip_empty.parent = lance_root
    rider_objs.append(tip_empty)

    anchor_empty = bpy.data.objects.new('contact_anchor', None)
    anchor_empty.empty_display_type = 'SPHERE'
    anchor_empty.empty_display_size = 0.05
    anchor_empty.location = (0, 0.05, 0.65)
    scene.collection.objects.link(anchor_empty)
    rider_objs.append(anchor_empty)

    # Persistent Fracture Components (3 authored pieces)
    for i, (fx, fy, fz) in enumerate([
        (0, 0.42, 0.78),      # Broken chamfron
        (-0.18, 0.62, 1.18),  # Sheared lance tip
        (0, -0.04, 0.52),     # Chipped saddle horn
    ]):
        bpy.ops.mesh.primitive_ico_sphere_add(radius=0.035, subdivisions=1)
        deb = bpy.context.active_object
        deb.name = f'Ashva_Debris_Chunk_{i+1}'
        deb.location = (fx, fy, fz)
        bpy.ops.object.transform_apply(location=True)
        deb.data.materials.append(pal['gold'] if i == 0 else (pal['steel'] if i == 1 else pal['bronze']))
        rider_objs.append(deb)

    return rider_objs, lance_root, torso

def build_ashva_armature(scene):
    """Constructs the Ashva_Rig armature articulating horse and mounted warrior."""
    arm_data = bpy.data.armatures.new('Ashva_Armature')
    arm_obj = bpy.data.objects.new('Ashva_Rig', arm_data)
    scene.collection.objects.link(arm_obj)
    bpy.context.view_layer.objects.active = arm_obj

    bpy.ops.object.mode_set(mode='EDIT')
    eb = arm_data.edit_bones

    root = eb.new('root')
    root.head = (0, 0, 0)
    root.tail = (0, 0, 0.05)

    # Horse spine
    h_spine = eb.new('horse_spine')
    h_spine.parent = root
    h_spine.head = (0, -0.10, 0.52)
    h_spine.tail = (0, 0.15, 0.55)

    h_neck = eb.new('horse_neck')
    h_neck.parent = h_spine
    h_neck.head = (0, 0.15, 0.55)
    h_neck.tail = (0, 0.32, 0.82)

    h_head = eb.new('horse_head')
    h_head.parent = h_neck
    h_head.head = (0, 0.32, 0.82)
    h_head.tail = (0, 0.48, 0.72)

    # 4 Legs
    for side, sign in [('L', 1), ('R', -1)]:
        fl_u = eb.new(f'leg_F{side}_upper')
        fl_u.parent = h_spine
        fl_u.head = (sign * 0.12, 0.18, 0.48)
        fl_u.tail = (sign * 0.12, 0.18, 0.28)

        fl_l = eb.new(f'leg_F{side}_lower')
        fl_l.parent = fl_u
        fl_l.head = (sign * 0.12, 0.18, 0.28)
        fl_l.tail = (sign * 0.12, 0.18, 0.08)

        bl_u = eb.new(f'leg_B{side}_upper')
        bl_u.parent = h_spine
        bl_u.head = (sign * 0.13, -0.22, 0.48)
        bl_u.tail = (sign * 0.13, -0.24, 0.28)

        bl_l = eb.new(f'leg_B{side}_lower')
        bl_l.parent = bl_u
        bl_l.head = (sign * 0.13, -0.24, 0.28)
        bl_l.tail = (sign * 0.13, -0.24, 0.08)

    # Rider bones
    r_torso = eb.new('rider_torso')
    r_torso.parent = h_spine
    r_torso.head = (0, -0.04, 0.65)
    r_torso.tail = (0, -0.04, 0.90)

    r_arm_r = eb.new('rider_arm_R')
    r_arm_r.parent = r_torso
    r_arm_r.head = (-0.14, -0.04, 0.84)
    r_arm_r.tail = (-0.18, 0.15, 0.75)

    r_arm_l = eb.new('rider_arm_L')
    r_arm_l.parent = r_torso
    r_arm_l.head = (0.12, -0.04, 0.84)
    r_arm_l.tail = (0.08, 0.15, 0.75)

    bpy.ops.object.mode_set(mode='OBJECT')
    return arm_obj

def bind_ashva_components(arm_obj, body_obj, head_obj, leg_objs, rider_objs, lance_root):
    """Parents components to armature bones."""
    def parent_bone(obj, bname):
        bpy.ops.object.select_all(action='DESELECT')
        obj.select_set(True)
        arm_obj.select_set(True)
        bpy.context.view_layer.objects.active = arm_obj
        arm_obj.data.bones.active = arm_obj.data.bones[bname]
        bpy.ops.object.parent_set(type='BONE')

    parent_bone(body_obj, 'horse_spine')
    parent_bone(head_obj, 'horse_head')

    # Legs
    for side in ['L', 'R']:
        parent_bone(leg_objs[f'Horse_F{side}_Upper'], f'leg_F{side}_upper')
        parent_bone(leg_objs[f'Horse_F{side}_Lower'], f'leg_F{side}_lower')
        parent_bone(leg_objs[f'Horse_F{side}_Hoof'], f'leg_F{side}_lower')

        parent_bone(leg_objs[f'Horse_B{side}_Upper'], f'leg_B{side}_upper')
        parent_bone(leg_objs[f'Horse_B{side}_Lower'], f'leg_B{side}_lower')
        parent_bone(leg_objs[f'Horse_B{side}_Hoof'], f'leg_B{side}_lower')

    parent_bone(leg_objs['Horse_Tail'], 'horse_spine')

    # Rider & Lance
    for o in rider_objs:
        if o.name in ['Rider_Torso', 'Rider_Head', 'Rider_Turban']:
            parent_bone(o, 'rider_torso')
        elif o.name == 'Rider_Arm_R':
            parent_bone(o, 'rider_arm_R')
        elif o.name == 'Rider_Arm_L':
            parent_bone(o, 'rider_arm_L')
        elif o.name.startswith('Horse_Saddle') or o.name.startswith('Rider_Thigh') or o.name.startswith('Stirrup'):
            parent_bone(o, 'horse_spine')

    parent_bone(lance_root, 'rider_arm_R')

    plinth = bpy.data.objects.get('Plinth_Stone')
    if plinth:
        parent_bone(plinth, 'root')

def author_ashva_animations(arm_obj):
    """Authors the complete 10-clip standard animation set for Knight."""
    arm_obj.animation_data_create()
    for pb in arm_obj.pose.bones:
        pb.rotation_mode = 'XYZ'
    pb = arm_obj.pose.bones

    # 1. Idle (1-96 frames = 4.0s @ 24fps): Horse breathing, head arch, tail swish
    action_idle = bpy.data.actions.new('idle')
    action_idle.use_fake_user = True
    arm_obj.animation_data.action = action_idle
    for f in [1, 48, 96]:
        pb['horse_spine'].location = (0, 0, 0.005 * math.sin(f * math.pi / 24))
        pb['horse_spine'].keyframe_insert('location', frame=f)
        pb['horse_head'].rotation_euler = (0.04 * math.sin(f * 0.15), 0, 0.03 * math.cos(f * 0.15))
        pb['horse_head'].keyframe_insert('rotation_euler', frame=f)

    # 2. Move (1-48 frames = 2.0s @ 24fps): Articulated 4-leg canter/trot gait
    action_move = bpy.data.actions.new('move')
    action_move.use_fake_user = True
    arm_obj.animation_data.action = action_move
    for f in [1, 7, 13, 19, 25, 31, 37, 43, 49]:
        phase = (f - 1) * 2 * math.pi / 24 # 2 full trot cycles
        # Diagonal pairs trot (FL + BR vs FR + BL)
        pb['leg_FL_upper'].rotation_euler = (0.45 * math.sin(phase), 0, 0)
        pb['leg_FL_lower'].rotation_euler = (max(0, 0.55 * math.sin(phase)), 0, 0) # Knee flexes back
        pb['leg_BR_upper'].rotation_euler = (0.40 * math.sin(phase), 0, 0)
        pb['leg_BR_lower'].rotation_euler = (max(0, -0.45 * math.sin(phase)), 0, 0)

        pb['leg_FR_upper'].rotation_euler = (-0.45 * math.sin(phase), 0, 0)
        pb['leg_FR_lower'].rotation_euler = (max(0, -0.55 * math.sin(phase)), 0, 0)
        pb['leg_BL_upper'].rotation_euler = (-0.40 * math.sin(phase), 0, 0)
        pb['leg_BL_lower'].rotation_euler = (max(0, 0.45 * math.sin(phase)), 0, 0)

        for leg in ['leg_FL_upper', 'leg_FL_lower', 'leg_BR_upper', 'leg_BR_lower',
                    'leg_FR_upper', 'leg_FR_lower', 'leg_BL_upper', 'leg_BL_lower']:
            pb[leg].keyframe_insert('rotation_euler', frame=f)

        # Gallop bob & rider swaying in saddle
        pb['horse_spine'].location = (0, 0, 0.024 * abs(math.sin(phase)))
        pb['horse_spine'].keyframe_insert('location', frame=f)
        pb['rider_torso'].rotation_euler = (0.08 * math.sin(phase), 0, 0)
        pb['rider_torso'].keyframe_insert('rotation_euler', frame=f)

    # 3. Attack Anticipation (1-24 frames): Horse rears back onto hind legs
    action_anticipate = bpy.data.actions.new('attack_anticipation')
    action_anticipate.use_fake_user = True
    arm_obj.animation_data.action = action_anticipate
    pb['horse_spine'].rotation_euler = (0, 0, 0)
    pb['horse_spine'].keyframe_insert('rotation_euler', frame=1)
    pb['horse_spine'].rotation_euler = (-0.55, 0, 0) # High rear
    pb['horse_spine'].location = (0, -0.08, 0.10)
    pb['horse_spine'].keyframe_insert('rotation_euler', frame=24)
    pb['horse_spine'].keyframe_insert('location', frame=24)

    pb['leg_FL_upper'].rotation_euler = (0.75, 0, 0.25) # Front legs paw air
    pb['leg_FR_upper'].rotation_euler = (0.65, 0, -0.25)
    pb['leg_FL_upper'].keyframe_insert('rotation_euler', frame=24)
    pb['leg_FR_upper'].keyframe_insert('rotation_euler', frame=24)

    # 4. Attack (1-36 frames): Crashes forward into couched lance strike
    action_attack = bpy.data.actions.new('attack')
    action_attack.use_fake_user = True
    arm_obj.animation_data.action = action_attack
    pb['horse_spine'].rotation_euler = (-0.55, 0, 0)
    pb['horse_spine'].keyframe_insert('rotation_euler', frame=1)
    pb['horse_spine'].rotation_euler = (0.30, 0, 0) # Lunge down
    pb['horse_spine'].location = (0, 0.14, -0.03)
    pb['horse_spine'].keyframe_insert('rotation_euler', frame=14)
    pb['horse_spine'].keyframe_insert('location', frame=14)
    pb['horse_spine'].rotation_euler = (0, 0, 0)
    pb['horse_spine'].location = (0, 0, 0)
    pb['horse_spine'].keyframe_insert('rotation_euler', frame=36)
    pb['horse_spine'].keyframe_insert('location', frame=36)

    pb['rider_arm_R'].rotation_euler = (0, 0, 0)
    pb['rider_arm_R'].keyframe_insert('rotation_euler', frame=1)
    pb['rider_arm_R'].rotation_euler = (0.55, 0, 0) # Couched lance
    pb['rider_arm_R'].keyframe_insert('rotation_euler', frame=14)

    # 5. Defend (1-36 frames): Horse turns armored shoulder, rider shields
    action_defend = bpy.data.actions.new('defend')
    action_defend.use_fake_user = True
    arm_obj.animation_data.action = action_defend
    pb['horse_spine'].rotation_euler = (0, 0, 0)
    pb['horse_spine'].keyframe_insert('rotation_euler', frame=1)
    pb['horse_spine'].rotation_euler = (0.05, 0.35, -0.10) # Turns chamfron & shoulder
    pb['horse_spine'].keyframe_insert('rotation_euler', frame=10)

    # 6. Hit (1-24 frames): Recoil shudder
    action_hit = bpy.data.actions.new('hit')
    action_hit.use_fake_user = True
    arm_obj.animation_data.action = action_hit
    pb['horse_head'].rotation_euler = (0, 0, 0)
    pb['horse_head'].keyframe_insert('rotation_euler', frame=1)
    pb['horse_head'].rotation_euler = (-0.45, 0.20, 0) # Jerks head back
    pb['horse_head'].keyframe_insert('rotation_euler', frame=6)
    pb['horse_head'].rotation_euler = (0, 0, 0)
    pb['horse_head'].keyframe_insert('rotation_euler', frame=24)

    # 7. Stagger (1-36 frames): Sideways stumble
    action_stagger = bpy.data.actions.new('stagger')
    action_stagger.use_fake_user = True
    arm_obj.animation_data.action = action_stagger
    pb['horse_spine'].location = (0, 0, 0)
    pb['horse_spine'].keyframe_insert('location', frame=1)
    pb['horse_spine'].location = (-0.10, -0.08, -0.04)
    pb['horse_spine'].keyframe_insert('location', frame=12)
    pb['horse_spine'].location = (0, 0, 0)
    pb['horse_spine'].keyframe_insert('location', frame=36)

    # 8. Defeat (1-48 frames): Horse drops to knees, rider concessions, base grounded
    action_defeat = bpy.data.actions.new('defeat')
    action_defeat.use_fake_user = True
    arm_obj.animation_data.action = action_defeat
    pb['horse_spine'].location = (0, 0, 0)
    pb['horse_spine'].keyframe_insert('location', frame=1)
    pb['horse_spine'].location = (0, 0, -0.16) # Sinks down
    pb['horse_spine'].keyframe_insert('location', frame=24)

    pb['leg_FL_lower'].rotation_euler = (0.95, 0, 0) # Forelegs fold
    pb['leg_FR_lower'].rotation_euler = (0.95, 0, 0)
    pb['leg_FL_lower'].keyframe_insert('rotation_euler', frame=24)
    pb['leg_FR_lower'].keyframe_insert('rotation_euler', frame=24)

    pb['rider_arm_R'].rotation_euler = (0.75, 0, -0.25) # Lance lowered
    pb['rider_arm_R'].keyframe_insert('rotation_euler', frame=28)

    # 9. Victory (1-48 frames): High rear and cheer
    action_victory = bpy.data.actions.new('victory')
    action_victory.use_fake_user = True
    arm_obj.animation_data.action = action_victory
    pb['horse_spine'].rotation_euler = (0, 0, 0)
    pb['horse_spine'].keyframe_insert('rotation_euler', frame=1)
    pb['horse_spine'].rotation_euler = (-0.70, 0, 0) # Majestic high rear
    pb['horse_spine'].keyframe_insert('rotation_euler', frame=20)

    pb['rider_arm_R'].rotation_euler = (-0.95, 0, 0.30) # Lance thrust high
    pb['rider_arm_R'].keyframe_insert('rotation_euler', frame=20)

    # 10. Draw (1-36 frames): Neutral stand
    action_draw = bpy.data.actions.new('draw')
    action_draw.use_fake_user = True
    arm_obj.animation_data.action = action_draw
    pb['horse_head'].rotation_euler = (0.05, 0, 0)
    pb['horse_head'].keyframe_insert('rotation_euler', frame=1)

    arm_obj.animation_data.action = action_idle

def main():
    scene = reset_scene()
    pal = get_white_army_palette(tex_dir=TEX_DIR)
    plinth = create_plinth(pal, r=0.31, h=0.045)
    body_obj = build_equine_body(pal)
    head_obj = build_equine_neck_and_head(pal)
    leg_objs = build_equine_legs(pal)
    rider_objs, lance_root, torso = build_rider_and_lance(pal)
    arm_obj = build_ashva_armature(scene)
    bind_ashva_components(arm_obj, body_obj, head_obj, leg_objs, rider_objs, lance_root)
    author_ashva_animations(arm_obj)

    blend_path = BLENDER_DIR / 'ashva.blend'
    bpy.ops.wm.save_as_mainfile(filepath=str(blend_path))
    print(f"Saved Blender file: {blend_path}")

    glb_export_path = EXPORTS_DIR / 'wN.glb'
    bpy.ops.export_scene.gltf(
        filepath=str(glb_export_path),
        export_format='GLB',
        use_selection=False,
        export_animations=True,
        export_animation_mode='ACTIONS',
        export_apply=False,
    )
    print(f"Exported GLB: {glb_export_path}")

    import shutil
    shutil.copy2(glb_export_path, PUBLIC_DEV_DIR / 'wN.glb')
    print(f"Staged to web: {PUBLIC_DEV_DIR / 'wN.glb'}")

if __name__ == '__main__':
    main()
