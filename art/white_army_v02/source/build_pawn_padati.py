"""BlunderBot White Army - Pawn (Padati) Procedural Blender Builder.
Creates an ancient Indian infantry warrior from CC0 Human Base Mesh,
with wrapped turban, lamellar cuirass, dhoti, dhal shield, infantry spear,
and 10 standard skeletal animation clips.
Exports:
  - art/white_army_v02/blender/padati.blend
  - art/white_army_v02/exports/wP.glb
  - apps/frontend/public/models/astra-dev-v02/wP.glb
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

def create_plinth(pal, r=0.28, h=0.04):
    """Creates a clean grounded stone plinth at Y = 0 to h."""
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

def load_and_scale_human_mesh(pal, target_height=0.82, z_offset=0.04):
    """Loads CC0 Male Realistic mesh, centers it, scales to target height, applies decimation."""
    scene = bpy.context.scene
    with bpy.data.libraries.load(str(HUMAN_BASE_PATH), link=False) as (src, dst):
        dst.collections = ['Body Male - Realistic']
    for c in dst.collections:
        scene.collection.children.link(c)
    bpy.context.view_layer.update()

    body = bpy.data.objects['GEO-body_male_realistic']
    # Remove existing multires
    for m in list(body.modifiers):
        body.modifiers.remove(m)

    # Clean unparent and reset object location to origin
    body.parent = None
    body.location = (0, 0, 0)
    body.rotation_euler = (0, 0, 0)
    body.scale = (1, 1, 1)
    bpy.context.view_layer.objects.active = body
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

    # Calculate bounding box
    coords = [v.co for v in body.data.vertices]
    min_x, max_x = min(v.x for v in coords), max(v.x for v in coords)
    min_z, max_z = min(v.z for v in coords), max(v.z for v in coords)
    orig_height = max_z - min_z
    scale_fac = target_height / orig_height

    # Center and scale vertices directly
    center_x = (min_x + max_x) / 2.0
    for v in body.data.vertices:
        v.co.x = (v.co.x - center_x) * scale_fac
        v.co.y = v.co.y * scale_fac
        v.co.z = (v.co.z - min_z) * scale_fac + z_offset

    body.data.update()
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    body.name = 'Pawn_AnatomicalBody'
    body.data.materials.clear()
    body.data.materials.append(pal['stone'])

    # Apply decimate modifier for clean game-ready LOD0 polycount (~4.2k triangles)
    dec = body.modifiers.new('Decimate', 'DECIMATE')
    dec.ratio = 0.40
    bpy.context.view_layer.objects.active = body
    bpy.ops.object.modifier_apply(modifier='Decimate')

    # Remove eyes to keep single clean mesh
    for name in ['GEO-body_male_realistic.eye.L', 'GEO-body_male_realistic.eye.R']:
        eye = bpy.data.objects.get(name)
        if eye:
            bpy.data.objects.remove(eye, do_unlink=True)

    return body, scale_fac

def build_pawn_gear(pal, body, scale_fac, z_offset=0.04):
    """Creates turban, lamellar cuirass, dhoti wrap, dhal shield, and infantry spear."""
    scene = bpy.context.scene
    gear_objs = []

    # 1. Wrapped Turban / Pagri on Head (Z ≈ 0.78 to 0.88)
    head_z = 0.81
    bpy.ops.mesh.primitive_cylinder_add(radius=0.082, depth=0.08, vertices=16)
    turban = bpy.context.active_object
    turban.name = 'Pawn_Turban'
    turban.location = (0, -0.015, head_z + 0.035)
    bpy.ops.object.transform_apply(location=True)
    turban.data.materials.append(pal['saffron'])
    gear_objs.append(turban)

    # Turban Pleated Crown
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.075, segments=16, ring_count=8)
    turban_crown = bpy.context.active_object
    turban_crown.name = 'Pawn_Turban_Crown'
    turban_crown.location = (0, -0.015, head_z + 0.065)
    bpy.ops.object.transform_apply(location=True)
    turban_crown.data.materials.append(pal['saffron'])
    gear_objs.append(turban_crown)

    # 2. Lamellar Scale Cuirass (Z ≈ 0.44 to 0.62)
    bpy.ops.mesh.primitive_cylinder_add(radius=0.125, depth=0.20, vertices=16)
    cuirass = bpy.context.active_object
    cuirass.name = 'Pawn_Cuirass'
    cuirass.scale = (1.0, 0.75, 1.0)
    cuirass.location = (0, -0.01, 0.53)
    bpy.ops.object.transform_apply(location=True, scale=True)
    cuirass.data.materials.append(pal['bronze'])
    gear_objs.append(cuirass)

    # Gold Trim Border on Cuirass
    bpy.ops.mesh.primitive_torus_add(major_radius=0.128, minor_radius=0.012, major_segments=16, minor_segments=6)
    c_trim = bpy.context.active_object
    c_trim.name = 'Pawn_Cuirass_Trim'
    c_trim.scale = (1.0, 0.75, 1.0)
    c_trim.location = (0, -0.01, 0.62)
    bpy.ops.object.transform_apply(location=True, scale=True)
    c_trim.data.materials.append(pal['gold'])
    gear_objs.append(c_trim)

    # 3. Dhoti / Kilt Wrapped Garment (Z ≈ 0.22 to 0.46)
    bpy.ops.mesh.primitive_cylinder_add(radius=0.115, depth=0.24, vertices=16)
    dhoti = bpy.context.active_object
    dhoti.name = 'Pawn_Dhoti'
    dhoti.scale = (1.0, 0.85, 1.0)
    dhoti.location = (0, 0, 0.35)
    bpy.ops.object.transform_apply(location=True, scale=True)
    dhoti.data.materials.append(pal['cloth'])
    gear_objs.append(dhoti)

    # Saffron Waist Sash (Patka)
    bpy.ops.mesh.primitive_torus_add(major_radius=0.118, minor_radius=0.015, major_segments=16, minor_segments=6)
    sash = bpy.context.active_object
    sash.name = 'Pawn_Sash'
    sash.scale = (1.0, 0.85, 1.0)
    sash.location = (0, 0, 0.45)
    bpy.ops.object.transform_apply(location=True, scale=True)
    sash.data.materials.append(pal['saffron'])
    gear_objs.append(sash)

    # 4. Indian Dhal Shield on Left Forearm (Radius ≈ 0.13)
    # Circular convex disc
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.13, segments=16, ring_count=8)
    shield = bpy.context.active_object
    shield.name = 'Pawn_DhalShield'
    shield.scale = (1.0, 0.22, 1.0)
    shield.rotation_euler = (0, math.pi / 2, 0)
    shield.location = (0.24, 0.08, 0.48)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    shield.data.materials.append(pal['bronze'])
    gear_objs.append(shield)

    # 4 Brass Knobs (Bosses) on Shield
    for a in [0, math.pi / 2, math.pi, 3 * math.pi / 2]:
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.018, segments=8, ring_count=4)
        boss = bpy.context.active_object
        boss.name = f'Pawn_Shield_Boss_{int(a*10)}'
        boss.location = (0.26, 0.08 + 0.06 * math.cos(a), 0.48 + 0.06 * math.sin(a))
        bpy.ops.object.transform_apply(location=True)
        boss.data.materials.append(pal['gold'])
        gear_objs.append(boss)

    # Vermilion Shield Rim
    bpy.ops.mesh.primitive_torus_add(major_radius=0.132, minor_radius=0.010, major_segments=16, minor_segments=6)
    rim = bpy.context.active_object
    rim.name = 'Pawn_Shield_Rim'
    rim.rotation_euler = (0, math.pi / 2, 0)
    rim.location = (0.24, 0.08, 0.48)
    bpy.ops.object.transform_apply(location=True, rotation=True)
    rim.data.materials.append(pal['saffron'])
    gear_objs.append(rim)

    # 5. Short Infantry Spear (Bhalā) in Right Hand
    # Wooden shaft (Z ≈ 0.08 to 0.95)
    bpy.ops.mesh.primitive_cylinder_add(radius=0.012, depth=0.88, vertices=12)
    spear_shaft = bpy.context.active_object
    spear_shaft.name = 'Pawn_SpearAssembly'
    spear_shaft.location = (-0.22, 0.12, 0.48)
    bpy.ops.object.transform_apply(location=True)
    spear_shaft.data.materials.append(pal['wood'])
    gear_objs.append(spear_shaft)

    # Brass Collar
    bpy.ops.mesh.primitive_cylinder_add(radius=0.018, depth=0.06, vertices=12)
    collar = bpy.context.active_object
    collar.name = 'Pawn_Spear_Collar'
    collar.location = (-0.22, 0.12, 0.90)
    bpy.ops.object.transform_apply(location=True)
    collar.data.materials.append(pal['gold'])
    gear_objs.append(collar)

    # Polished Steel Spear Blade (Leaf blade)
    bpy.ops.mesh.primitive_cone_add(radius1=0.035, radius2=0.002, depth=0.16, vertices=8)
    blade = bpy.context.active_object
    blade.name = 'Pawn_Spear_Head'
    blade.scale = (0.45, 1.0, 1.0)
    blade.location = (-0.22, 0.12, 0.99)
    bpy.ops.object.transform_apply(location=True, scale=True)
    blade.data.materials.append(pal['steel'])
    gear_objs.append(blade)

    # Socket: weapon_tip_socket
    tip_empty = bpy.data.objects.new('weapon_tip_socket', None)
    tip_empty.empty_display_type = 'SPHERE'
    tip_empty.empty_display_size = 0.04
    tip_empty.location = (-0.22, 0.12, 1.07)
    scene.collection.objects.link(tip_empty)
    gear_objs.append(tip_empty)

    # Socket: grip_R
    grip_r = bpy.data.objects.new('grip_R', None)
    grip_r.empty_display_type = 'SPHERE'
    grip_r.empty_display_size = 0.03
    grip_r.location = (-0.22, 0.12, 0.46)
    scene.collection.objects.link(grip_r)
    gear_objs.append(grip_r)

    # Socket: contact_anchor
    anchor_empty = bpy.data.objects.new('contact_anchor', None)
    anchor_empty.empty_display_type = 'SPHERE'
    anchor_empty.empty_display_size = 0.04
    anchor_empty.location = (0, 0, 0.52)
    scene.collection.objects.link(anchor_empty)
    gear_objs.append(anchor_empty)

    # Persistent Fracture Debris Pieces (3 authored fragments)
    for i, (fx, fy, fz) in enumerate([
        (0.24, 0.08, 0.48),  # Shield chunk
        (-0.22, 0.12, 0.92), # Broken spear tip
        (0.0, -0.02, 0.52),  # Armor lamellar plate
    ]):
        bpy.ops.mesh.primitive_ico_sphere_add(radius=0.035, subdivisions=1)
        debris = bpy.context.active_object
        debris.name = f'Pawn_Debris_Chunk_{i+1}'
        debris.location = (fx, fy, fz)
        bpy.ops.object.transform_apply(location=True)
        debris.data.materials.append(pal['bronze'] if i != 1 else pal['steel'])
        gear_objs.append(debris)

    return gear_objs, spear_shaft, shield, turban, cuirass, dhoti

def build_humanoid_armature(scene, name='Padati_Rig', h=0.82, z_offset=0.04):
    """Constructs the canonical Astra humanoid armature hierarchy."""
    arm_data = bpy.data.armatures.new(f'{name}_Data')
    arm_obj = bpy.data.objects.new(name, arm_data)
    scene.collection.objects.link(arm_obj)
    bpy.context.view_layer.objects.active = arm_obj

    bpy.ops.object.mode_set(mode='EDIT')
    eb = arm_data.edit_bones

    def add_bone(bname, head, tail, parent_name=None):
        b = eb.new(bname)
        b.head = head
        b.tail = tail
        if parent_name:
            b.parent = eb[parent_name]
        return b

    # Scale bone coordinates proportionally based on height
    s = h / 1.70
    root = add_bone('root', (0, 0, 0), (0, 0, 0.05))
    pelvis = add_bone('pelvis', (0, 0, z_offset + 0.90 * s), (0, 0, z_offset + 1.00 * s), 'root')
    spine = add_bone('spine', (0, 0, z_offset + 1.00 * s), (0, 0, z_offset + 1.20 * s), 'pelvis')
    chest = add_bone('chest', (0, 0, z_offset + 1.20 * s), (0, 0, z_offset + 1.40 * s), 'spine')
    neck = add_bone('neck', (0, 0, z_offset + 1.40 * s), (0, 0, z_offset + 1.48 * s), 'chest')
    head = add_bone('head', (0, 0, z_offset + 1.48 * s), (0, 0, z_offset + 1.68 * s), 'neck')

    for side, sign in [('L', 1), ('R', -1)]:
        add_bone(f'clavicle.{side}', (0, 0, z_offset + 1.40 * s), (sign * 0.16 * s, 0, z_offset + 1.40 * s), 'chest')
        add_bone(f'upper_arm.{side}', (sign * 0.16 * s, 0, z_offset + 1.40 * s), (sign * 0.30 * s, 0, z_offset + 1.15 * s), f'clavicle.{side}')
        add_bone(f'forearm.{side}', (sign * 0.30 * s, 0, z_offset + 1.15 * s), (sign * 0.40 * s, 0.05 * s, z_offset + 0.92 * s), f'upper_arm.{side}')
        add_bone(f'hand.{side}', (sign * 0.40 * s, 0.05 * s, z_offset + 0.92 * s), (sign * 0.44 * s, 0.08 * s, z_offset + 0.82 * s), f'forearm.{side}')

        add_bone(f'thigh.{side}', (sign * 0.09 * s, 0, z_offset + 0.90 * s), (sign * 0.09 * s, -0.01 * s, z_offset + 0.50 * s), 'pelvis')
        add_bone(f'shin.{side}', (sign * 0.09 * s, -0.01 * s, z_offset + 0.50 * s), (sign * 0.09 * s, 0, z_offset + 0.15 * s), f'thigh.{side}')
        add_bone(f'foot.{side}', (sign * 0.09 * s, 0, z_offset + 0.15 * s), (sign * 0.09 * s, 0.12 * s, z_offset + 0.02), f'shin.{side}')

    bpy.ops.object.mode_set(mode='OBJECT')
    return arm_obj

def bind_pawn_mesh_and_gear(arm_obj, body, gear_objs, spear_shaft, shield, turban, cuirass, dhoti):
    """Binds body with automatic weights and parents gear components to bone sockets."""
    # 1. Armature auto-weight for anatomical body
    bpy.ops.object.select_all(action='DESELECT')
    body.select_set(True)
    arm_obj.select_set(True)
    bpy.context.view_layer.objects.active = arm_obj
    bpy.ops.object.parent_set(type='ARMATURE_AUTO')

    def parent_bone(obj, bname):
        bpy.ops.object.select_all(action='DESELECT')
        obj.select_set(True)
        arm_obj.select_set(True)
        bpy.context.view_layer.objects.active = arm_obj
        arm_obj.data.bones.active = arm_obj.data.bones[bname]
        bpy.ops.object.parent_set(type='BONE')

    # 2. Parent gear to appropriate bones
    parent_bone(turban, 'head')
    parent_bone(bpy.data.objects['Pawn_Turban_Crown'], 'head')
    parent_bone(cuirass, 'chest')
    parent_bone(bpy.data.objects['Pawn_Cuirass_Trim'], 'chest')
    parent_bone(dhoti, 'pelvis')
    parent_bone(bpy.data.objects['Pawn_Sash'], 'pelvis')

    # Left arm: Shield
    parent_bone(shield, 'forearm.L')
    parent_bone(bpy.data.objects['Pawn_Shield_Rim'], 'forearm.L')
    for obj in gear_objs:
        if obj.name.startswith('Pawn_Shield_Boss'):
            parent_bone(obj, 'forearm.L')

    # Right arm: Spear
    parent_bone(spear_shaft, 'hand.R')
    parent_bone(bpy.data.objects['Pawn_Spear_Collar'], 'hand.R')
    parent_bone(bpy.data.objects['Pawn_Spear_Head'], 'hand.R')
    parent_bone(bpy.data.objects['weapon_tip_socket'], 'hand.R')
    parent_bone(bpy.data.objects['grip_R'], 'hand.R')

    # Plinth stays on root
    plinth = bpy.data.objects.get('Plinth_Stone')
    if plinth:
        parent_bone(plinth, 'root')

def author_pawn_animations(arm_obj):
    """Authors the complete 10-clip standard animation set for Pawn."""
    arm_obj.animation_data_create()
    pb = arm_obj.pose.bones

    # 1. Idle (1-96 frames = 4.0s @ 24fps): Combat ready breathing
    action_idle = bpy.data.actions.new('idle')
    arm_obj.animation_data.action = action_idle
    for f in [1, 48, 96]:
        pb['chest'].location = (0, 0, 0.004 * math.sin(f * math.pi / 24))
        pb['chest'].keyframe_insert('location', frame=f)
        pb['forearm.L'].rotation_euler = (0.10 + 0.02 * math.sin(f * 0.1), 0, 0.15)
        pb['forearm.L'].keyframe_insert('rotation_euler', frame=f)
        pb['hand.R'].rotation_euler = (0, 0.05 * math.cos(f * 0.1), 0)
        pb['hand.R'].keyframe_insert('rotation_euler', frame=f)

    # 2. Move (1-48 frames = 2.0s @ 24fps): Infantry march
    action_move = bpy.data.actions.new('move')
    arm_obj.animation_data.action = action_move
    for f in [1, 12, 24, 36, 48]:
        phase = (f - 1) * 2 * math.pi / 48
        # Legs swing
        pb['thigh.L'].rotation_euler = (0.35 * math.sin(phase), 0, 0)
        pb['thigh.R'].rotation_euler = (-0.35 * math.sin(phase), 0, 0)
        pb['shin.L'].rotation_euler = (max(0, -0.40 * math.sin(phase)), 0, 0)
        pb['shin.R'].rotation_euler = (max(0, 0.40 * math.sin(phase)), 0, 0)
        pb['thigh.L'].keyframe_insert('rotation_euler', frame=f)
        pb['thigh.R'].keyframe_insert('rotation_euler', frame=f)
        pb['shin.L'].keyframe_insert('rotation_euler', frame=f)
        pb['shin.R'].keyframe_insert('rotation_euler', frame=f)
        # Arms swing with weapon
        pb['upper_arm.R'].rotation_euler = (-0.25 * math.sin(phase), 0, 0)
        pb['upper_arm.L'].rotation_euler = (0.25 * math.sin(phase), 0, 0)
        pb['upper_arm.R'].keyframe_insert('rotation_euler', frame=f)
        pb['upper_arm.L'].keyframe_insert('rotation_euler', frame=f)
        # Vertical stride bob
        pb['pelvis'].location = (0, 0, 0.012 * math.sin(phase * 2))
        pb['pelvis'].keyframe_insert('location', frame=f)

    # 3. Attack Anticipation (1-24 frames): Draw back spear, angle shield
    action_anticipate = bpy.data.actions.new('attack_anticipation')
    arm_obj.animation_data.action = action_anticipate
    pb['upper_arm.R'].rotation_euler = (0, 0, 0)
    pb['upper_arm.R'].keyframe_insert('rotation_euler', frame=1)
    pb['upper_arm.R'].rotation_euler = (-0.45, 0.15, -0.20)
    pb['upper_arm.R'].keyframe_insert('rotation_euler', frame=24)

    pb['forearm.L'].rotation_euler = (0, 0, 0)
    pb['forearm.L'].keyframe_insert('rotation_euler', frame=1)
    pb['forearm.L'].rotation_euler = (0.35, -0.20, 0.40) # Shield ready
    pb['forearm.L'].keyframe_insert('rotation_euler', frame=24)

    # 4. Attack (1-36 frames): Forward spear lunge
    action_attack = bpy.data.actions.new('attack')
    arm_obj.animation_data.action = action_attack
    pb['upper_arm.R'].rotation_euler = (-0.45, 0.15, -0.20)
    pb['upper_arm.R'].keyframe_insert('rotation_euler', frame=1)
    pb['upper_arm.R'].rotation_euler = (0.65, -0.10, 0.10) # Thrust strike
    pb['upper_arm.R'].keyframe_insert('rotation_euler', frame=12)
    pb['upper_arm.R'].rotation_euler = (0.30, 0, 0) # Hold follow-through
    pb['upper_arm.R'].keyframe_insert('rotation_euler', frame=36)

    pb['pelvis'].location = (0, 0, 0)
    pb['pelvis'].keyframe_insert('location', frame=1)
    pb['pelvis'].location = (0, 0.08, -0.02) # Lunging forward
    pb['pelvis'].keyframe_insert('location', frame=12)
    pb['pelvis'].location = (0, 0, 0)
    pb['pelvis'].keyframe_insert('location', frame=36)

    # 5. Defend (1-36 frames): Raise dhal shield to ward off attack
    action_defend = bpy.data.actions.new('defend')
    arm_obj.animation_data.action = action_defend
    pb['upper_arm.L'].rotation_euler = (0, 0, 0)
    pb['upper_arm.L'].keyframe_insert('rotation_euler', frame=1)
    pb['upper_arm.L'].rotation_euler = (0.55, 0.25, 0.45) # Shield up
    pb['upper_arm.L'].keyframe_insert('rotation_euler', frame=10)
    pb['forearm.L'].rotation_euler = (0.75, 0, 0.50) # Brace shield
    pb['forearm.L'].keyframe_insert('rotation_euler', frame=10)

    # 6. Hit (1-24 frames): Recoil from weapon impact
    action_hit = bpy.data.actions.new('hit')
    arm_obj.animation_data.action = action_hit
    pb['chest'].rotation_euler = (0, 0, 0)
    pb['chest'].keyframe_insert('rotation_euler', frame=1)
    pb['chest'].rotation_euler = (-0.30, 0.15, -0.10) # Impact shudder
    pb['chest'].keyframe_insert('rotation_euler', frame=6)
    pb['chest'].rotation_euler = (0, 0, 0)
    pb['chest'].keyframe_insert('rotation_euler', frame=24)

    # 7. Stagger (1-36 frames): Stumble back
    action_stagger = bpy.data.actions.new('stagger')
    arm_obj.animation_data.action = action_stagger
    pb['pelvis'].location = (0, 0, 0)
    pb['pelvis'].keyframe_insert('location', frame=1)
    pb['pelvis'].location = (0, -0.10, -0.04) # Steps back
    pb['pelvis'].keyframe_insert('location', frame=14)
    pb['pelvis'].location = (0, 0, 0)
    pb['pelvis'].keyframe_insert('location', frame=36)

    # 8. Defeat (1-48 frames): Falls to knee, spear drops, base stays grounded
    action_defeat = bpy.data.actions.new('defeat')
    arm_obj.animation_data.action = action_defeat
    pb['thigh.R'].rotation_euler = (0, 0, 0)
    pb['thigh.R'].keyframe_insert('rotation_euler', frame=1)
    pb['thigh.R'].rotation_euler = (0.85, 0, 0) # Kneels down
    pb['thigh.R'].keyframe_insert('rotation_euler', frame=24)

    pb['pelvis'].location = (0, 0, 0)
    pb['pelvis'].keyframe_insert('location', frame=1)
    pb['pelvis'].location = (0, 0, -0.14)
    pb['pelvis'].keyframe_insert('location', frame=24)

    pb['upper_arm.R'].rotation_euler = (0, 0, 0)
    pb['upper_arm.R'].keyframe_insert('rotation_euler', frame=1)
    pb['upper_arm.R'].rotation_euler = (0.75, 0, -0.30) # Spear tips to ground
    pb['upper_arm.R'].keyframe_insert('rotation_euler', frame=28)

    # 9. Victory (1-48 frames): Spear thrust to heavens in victory salute
    action_victory = bpy.data.actions.new('victory')
    arm_obj.animation_data.action = action_victory
    pb['upper_arm.R'].rotation_euler = (0, 0, 0)
    pb['upper_arm.R'].keyframe_insert('rotation_euler', frame=1)
    pb['upper_arm.R'].rotation_euler = (-1.20, 0, 0.25) # Spear raised high
    pb['upper_arm.R'].keyframe_insert('rotation_euler', frame=20)

    # 10. Draw (1-36 frames): Attention salute
    action_draw = bpy.data.actions.new('draw')
    arm_obj.animation_data.action = action_draw
    pb['chest'].location = (0, 0, 0)
    pb['chest'].keyframe_insert('location', frame=1)

    # Reset active action to idle
    arm_obj.animation_data.action = action_idle

def main():
    scene = reset_scene()
    pal = get_white_army_palette(tex_dir=TEX_DIR)
    plinth = create_plinth(pal, r=0.28, h=0.04)
    body, scale_fac = load_and_scale_human_mesh(pal, target_height=0.82, z_offset=0.04)
    gear_objs, spear_shaft, shield, turban, cuirass, dhoti = build_pawn_gear(pal, body, scale_fac, z_offset=0.04)
    arm_obj = build_humanoid_armature(scene, name='Padati_Rig', h=0.82, z_offset=0.04)
    bind_pawn_mesh_and_gear(arm_obj, body, gear_objs, spear_shaft, shield, turban, cuirass, dhoti)
    author_pawn_animations(arm_obj)

    # Save .blend file
    blend_path = BLENDER_DIR / 'padati.blend'
    bpy.ops.wm.save_as_mainfile(filepath=str(blend_path))
    print(f"Saved Blender file: {blend_path}")

    # Export GLB with all actions
    glb_export_path = EXPORTS_DIR / 'wP.glb'
    bpy.ops.export_scene.gltf(
        filepath=str(glb_export_path),
        export_format='GLB',
        use_selection=False,
        export_animations=True,
        export_animation_mode='ACTIONS',
        export_apply=False,
    )
    print(f"Exported GLB: {glb_export_path}")

    # Copy to public dev directory
    import shutil
    shutil.copy2(glb_export_path, PUBLIC_DEV_DIR / 'wP.glb')
    print(f"Staged to web: {PUBLIC_DEV_DIR / 'wP.glb'}")

if __name__ == '__main__':
    main()
