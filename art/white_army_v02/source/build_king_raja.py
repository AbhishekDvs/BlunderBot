"""BlunderBot White Army - King (Raja) Procedural Blender Builder.
Creates an imposing royal warrior from CC0 Human Base Mesh,
with three-tier crown, broad armored pauldrons, royal mantle,
central broadsword (Khandā), and 10 standard skeletal animation clips.
Exports:
  - art/white_army_v02/blender/raja.blend
  - art/white_army_v02/exports/wK.glb
  - apps/frontend/public/models/astra-dev-v02/wK.glb
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

def create_plinth(pal, r=0.32, h=0.045):
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

def load_and_scale_human_mesh(pal, target_height=1.24, z_offset=0.045):
    """Loads CC0 Male Realistic mesh, centers it, scales to target height, applies decimation."""
    scene = bpy.context.scene
    with bpy.data.libraries.load(str(HUMAN_BASE_PATH), link=False) as (src, dst):
        dst.collections = ['Body Male - Realistic']
    for c in dst.collections:
        scene.collection.children.link(c)
    bpy.context.view_layer.update()

    body = bpy.data.objects['GEO-body_male_realistic']
    for m in list(body.modifiers):
        body.modifiers.remove(m)

    body.parent = None
    body.location = (0, 0, 0)
    body.rotation_euler = (0, 0, 0)
    body.scale = (1, 1, 1)
    bpy.context.view_layer.objects.active = body
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

    coords = [v.co for v in body.data.vertices]
    min_x, max_x = min(v.x for v in coords), max(v.x for v in coords)
    min_z, max_z = min(v.z for v in coords), max(v.z for v in coords)
    orig_height = max_z - min_z
    scale_fac = target_height / orig_height

    center_x = (min_x + max_x) / 2.0
    for v in body.data.vertices:
        v.co.x = (v.co.x - center_x) * scale_fac
        v.co.y = v.co.y * scale_fac
        v.co.z = (v.co.z - min_z) * scale_fac + z_offset

    body.data.update()
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    body.name = 'Raja_AnatomicalBody'
    body.data.materials.clear()
    body.data.materials.append(pal['stone'])

    dec = body.modifiers.new('Decimate', 'DECIMATE')
    dec.ratio = 0.45
    bpy.context.view_layer.objects.active = body
    bpy.ops.object.modifier_apply(modifier='Decimate')

    for name in ['GEO-body_male_realistic.eye.L', 'GEO-body_male_realistic.eye.R']:
        eye = bpy.data.objects.get(name)
        if eye:
            bpy.data.objects.remove(eye, do_unlink=True)

    return body, scale_fac

def build_raja_regalia(pal, body, scale_fac, z_offset=0.045):
    """Creates 3-tier crown, broad armored pauldrons, royal mantle, and Khandā sword."""
    scene = bpy.context.scene
    gear_objs = []

    # Head top is at Z ≈ 1.28
    head_z = 1.25

    # 1. Three-Tier Royal Crown (Mukuta) (Z ≈ 1.28 to 1.42)
    # Tier 1: Gold Circlet Band with Inset Gems
    bpy.ops.mesh.primitive_cylinder_add(radius=0.102, depth=0.045, vertices=16)
    c_t1 = bpy.context.active_object
    c_t1.name = 'Raja_Crown_Tier1'
    c_t1.location = (0, -0.015, head_z + 0.05)
    bpy.ops.object.transform_apply(location=True)
    c_t1.data.materials.append(pal['gold'])
    gear_objs.append(c_t1)

    # Tier 2: Stepped Filigree Cone
    bpy.ops.mesh.primitive_cone_add(radius1=0.095, radius2=0.05, depth=0.07, vertices=16)
    c_t2 = bpy.context.active_object
    c_t2.name = 'Raja_Crown_Tier2'
    c_t2.location = (0, -0.015, head_z + 0.095)
    bpy.ops.object.transform_apply(location=True)
    c_t2.data.materials.append(pal['bronze'])
    gear_objs.append(c_t2)

    # Tier 3: Flared Finial Plume (Kalgi)
    bpy.ops.mesh.primitive_cone_add(radius1=0.045, radius2=0.005, depth=0.06, vertices=12)
    c_t3 = bpy.context.active_object
    c_t3.name = 'Raja_Crown_Tier3'
    c_t3.location = (0, -0.015, head_z + 0.145)
    bpy.ops.object.transform_apply(location=True)
    c_t3.data.materials.append(pal['gold'])
    gear_objs.append(c_t3)

    # 2. Broad Armored Pauldrons on Shoulders (Z ≈ 1.05)
    for side, sign in [('L', 1), ('R', -1)]:
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.11, segments=12, ring_count=8)
        p = bpy.context.active_object
        p.name = f'Raja_Pauldron_{side}'
        p.scale = (0.7, 1.2, 0.7)
        p.rotation_euler = (0, 0, sign * 0.25)
        p.location = (sign * 0.26, -0.02, 1.06)
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
        p.data.materials.append(pal['gold'])
        gear_objs.append(p)

    # 3. Royal Mantle / Velvet Cape draped over shoulders down to plinth (Z ≈ 0.06 to 1.08)
    # Curved quad sheet along back
    cape_w = 0.46
    cape_top_z = 1.08
    cape_bot_z = 0.06
    c_verts = [
        (-cape_w * 0.5, -0.16, cape_top_z), (cape_w * 0.5, -0.16, cape_top_z),
        (cape_w * 0.6, -0.22, cape_bot_z), (-cape_w * 0.6, -0.22, cape_bot_z),
        (0, -0.18, (cape_top_z + cape_bot_z) / 2)
    ]
    c_faces = [
        (0, 1, 4), (1, 2, 4), (2, 3, 4), (3, 0, 4)
    ]
    cape_mesh = bpy.data.meshes.new('Raja_Royal_Mantle')
    cape_mesh.from_pydata(c_verts, [], c_faces)
    cape_mesh.update()
    cape = bpy.data.objects.new('Raja_Royal_Mantle', cape_mesh)
    scene.collection.objects.link(cape)
    cape_mesh.materials.append(pal['saffron'])
    gear_objs.append(cape)

    # 4. Damascened Cuirass & Brocade Coat (Z ≈ 0.65 to 0.98)
    bpy.ops.mesh.primitive_cylinder_add(radius=0.175, depth=0.32, vertices=16)
    cuirass = bpy.context.active_object
    cuirass.name = 'Raja_Cuirass'
    cuirass.scale = (1.0, 0.75, 1.0)
    cuirass.location = (0, -0.02, 0.82)
    bpy.ops.object.transform_apply(location=True, scale=True)
    cuirass.data.materials.append(pal['bronze'])
    gear_objs.append(cuirass)

    # Gold Medallion on Chest
    bpy.ops.mesh.primitive_cylinder_add(radius=0.045, depth=0.02, vertices=12)
    medallion = bpy.context.active_object
    medallion.name = 'Raja_Medallion'
    medallion.rotation_euler = (math.pi / 2, 0, 0)
    medallion.location = (0, 0.12, 0.88)
    bpy.ops.object.transform_apply(location=True, rotation=True)
    medallion.data.materials.append(pal['gold'])
    gear_objs.append(medallion)

    # 5. Pleated Brocade Dhoti (Z ≈ 0.10 to 0.68)
    bpy.ops.mesh.primitive_cylinder_add(radius=0.18, depth=0.55, vertices=16)
    dhoti = bpy.context.active_object
    dhoti.name = 'Raja_Dhoti'
    dhoti.scale = (1.0, 0.85, 1.0)
    dhoti.location = (0, 0, 0.38)
    bpy.ops.object.transform_apply(location=True, scale=True)
    dhoti.data.materials.append(pal['cloth'])
    gear_objs.append(dhoti)

    # 6. Royal Khandā Broadsword Held Centrally in Front of Body
    # Blade: straight broad steel blade with reinforcing spine
    bpy.ops.mesh.primitive_cube_add(size=1.0)
    blade = bpy.context.active_object
    blade.name = 'Raja_SwordAssembly'
    blade.scale = (0.055, 0.018, 0.75)
    blade.location = (0, 0.22, 0.44)
    bpy.ops.object.transform_apply(location=True, scale=True)
    blade.data.materials.append(pal['steel'])
    gear_objs.append(blade)

    # Reinforcing Spine Bracket (Antique Gold)
    bpy.ops.mesh.primitive_cube_add(size=1.0)
    spine_bracket = bpy.context.active_object
    spine_bracket.name = 'Raja_Sword_Spine'
    spine_bracket.scale = (0.03, 0.025, 0.42)
    spine_bracket.location = (0, 0.22, 0.58)
    bpy.ops.object.transform_apply(location=True, scale=True)
    spine_bracket.data.materials.append(pal['gold'])
    gear_objs.append(spine_bracket)

    # Basket Crossguard
    bpy.ops.mesh.primitive_cylinder_add(radius=0.065, depth=0.035, vertices=16)
    guard = bpy.context.active_object
    guard.name = 'Raja_Sword_Guard'
    guard.location = (0, 0.22, 0.80)
    bpy.ops.object.transform_apply(location=True)
    guard.data.materials.append(pal['gold'])
    gear_objs.append(guard)

    # Grip & Disc Pommel
    bpy.ops.mesh.primitive_cylinder_add(radius=0.02, depth=0.14, vertices=12)
    h_grip = bpy.context.active_object
    h_grip.name = 'Raja_Sword_Grip'
    h_grip.location = (0, 0.22, 0.88)
    bpy.ops.object.transform_apply(location=True)
    h_grip.data.materials.append(pal['wood'])
    gear_objs.append(h_grip)

    bpy.ops.mesh.primitive_cylinder_add(radius=0.045, depth=0.025, vertices=12)
    pommel = bpy.context.active_object
    pommel.name = 'Raja_Sword_Pommel'
    pommel.location = (0, 0.22, 0.96)
    bpy.ops.object.transform_apply(location=True)
    pommel.data.materials.append(pal['gold'])
    gear_objs.append(pommel)

    # Sockets
    tip_empty = bpy.data.objects.new('weapon_tip_socket', None)
    tip_empty.empty_display_type = 'SPHERE'
    tip_empty.empty_display_size = 0.04
    tip_empty.location = (0, 0.22, 0.06)
    scene.collection.objects.link(tip_empty)
    gear_objs.append(tip_empty)

    grip_r = bpy.data.objects.new('grip_R', None)
    grip_r.empty_display_type = 'SPHERE'
    grip_r.empty_display_size = 0.03
    grip_r.location = (0.02, 0.22, 0.88)
    scene.collection.objects.link(grip_r)
    gear_objs.append(grip_r)

    grip_l = bpy.data.objects.new('grip_L', None)
    grip_l.empty_display_type = 'SPHERE'
    grip_l.empty_display_size = 0.03
    grip_l.location = (-0.02, 0.22, 0.92)
    scene.collection.objects.link(grip_l)
    gear_objs.append(grip_l)

    anchor_empty = bpy.data.objects.new('contact_anchor', None)
    anchor_empty.empty_display_type = 'SPHERE'
    anchor_empty.empty_display_size = 0.05
    anchor_empty.location = (0, 0, 0.80)
    scene.collection.objects.link(anchor_empty)
    gear_objs.append(anchor_empty)

    # Persistent Fracture Components (3 authored pieces)
    for i, (fx, fy, fz) in enumerate([
        (0, -0.015, head_z + 0.145), # Crown jewel finial
        (0.26, -0.02, 1.06),         # Severed pauldron
        (0, 0.22, 0.12),             # Broken sword tip
    ]):
        bpy.ops.mesh.primitive_ico_sphere_add(radius=0.038, subdivisions=1)
        deb = bpy.context.active_object
        deb.name = f'Raja_Debris_Chunk_{i+1}'
        deb.location = (fx, fy, fz)
        bpy.ops.object.transform_apply(location=True)
        deb.data.materials.append(pal['gold'] if i != 2 else pal['steel'])
        gear_objs.append(deb)

    return gear_objs, blade, cape, c_t1, cuirass, dhoti

def build_humanoid_armature(scene, name='Raja_Rig', h=1.24, z_offset=0.045):
    """Constructs the canonical Raja humanoid armature hierarchy."""
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

    s = h / 1.70
    root = add_bone('root', (0, 0, 0), (0, 0, 0.06))
    pelvis = add_bone('pelvis', (0, 0, z_offset + 0.90 * s), (0, 0, z_offset + 1.00 * s), 'root')
    spine = add_bone('spine', (0, 0, z_offset + 1.00 * s), (0, 0, z_offset + 1.20 * s), 'pelvis')
    chest = add_bone('chest', (0, 0, z_offset + 1.20 * s), (0, 0, z_offset + 1.40 * s), 'spine')
    neck = add_bone('neck', (0, 0, z_offset + 1.40 * s), (0, 0, z_offset + 1.48 * s), 'chest')
    head = add_bone('head', (0, 0, z_offset + 1.48 * s), (0, 0, z_offset + 1.70 * s), 'neck')

    for side, sign in [('L', 1), ('R', -1)]:
        add_bone(f'clavicle.{side}', (0, 0, z_offset + 1.40 * s), (sign * 0.18 * s, 0, z_offset + 1.40 * s), 'chest')
        add_bone(f'upper_arm.{side}', (sign * 0.18 * s, 0, z_offset + 1.40 * s), (sign * 0.32 * s, 0, z_offset + 1.15 * s), f'clavicle.{side}')
        add_bone(f'forearm.{side}', (sign * 0.32 * s, 0, z_offset + 1.15 * s), (sign * 0.22 * s, 0.18 * s, z_offset + 0.95 * s), f'upper_arm.{side}')
        add_bone(f'hand.{side}', (sign * 0.22 * s, 0.18 * s, z_offset + 0.95 * s), (sign * 0.08 * s, 0.22 * s, z_offset + 0.90 * s), f'forearm.{side}')

        add_bone(f'thigh.{side}', (sign * 0.10 * s, 0, z_offset + 0.90 * s), (sign * 0.10 * s, -0.01 * s, z_offset + 0.50 * s), 'pelvis')
        add_bone(f'shin.{side}', (sign * 0.10 * s, -0.01 * s, z_offset + 0.50 * s), (sign * 0.10 * s, 0, z_offset + 0.15 * s), f'thigh.{side}')
        add_bone(f'foot.{side}', (sign * 0.10 * s, 0, z_offset + 0.15 * s), (sign * 0.10 * s, 0.14 * s, z_offset + 0.02), f'shin.{side}')

    bpy.ops.object.mode_set(mode='OBJECT')
    return arm_obj

def bind_raja_mesh_and_regalia(arm_obj, body, gear_objs, blade, cape, c_t1, cuirass, dhoti):
    """Binds body with automatic weights and parents gear components to bone sockets."""
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

    parent_bone(c_t1, 'head')
    parent_bone(bpy.data.objects['Raja_Crown_Tier2'], 'head')
    parent_bone(bpy.data.objects['Raja_Crown_Tier3'], 'head')

    parent_bone(cuirass, 'chest')
    parent_bone(cape, 'chest')
    parent_bone(bpy.data.objects['Raja_Medallion'], 'chest')
    parent_bone(bpy.data.objects['Raja_Pauldron_L'], 'clavicle.L')
    parent_bone(bpy.data.objects['Raja_Pauldron_R'], 'clavicle.R')

    parent_bone(dhoti, 'pelvis')

    # Sword assembly parented to hand.R (primary sword hand)
    parent_bone(blade, 'hand.R')
    parent_bone(bpy.data.objects['Raja_Sword_Spine'], 'hand.R')
    parent_bone(bpy.data.objects['Raja_Sword_Guard'], 'hand.R')
    parent_bone(bpy.data.objects['Raja_Sword_Grip'], 'hand.R')
    parent_bone(bpy.data.objects['Raja_Sword_Pommel'], 'hand.R')
    parent_bone(bpy.data.objects['weapon_tip_socket'], 'hand.R')
    parent_bone(bpy.data.objects['grip_R'], 'hand.R')
    parent_bone(bpy.data.objects['grip_L'], 'hand.R')

    plinth = bpy.data.objects.get('Plinth_Stone')
    if plinth:
        parent_bone(plinth, 'root')

def author_raja_animations(arm_obj):
    """Authors the complete 10-clip standard animation set for King."""
    arm_obj.animation_data_create()
    pb = arm_obj.pose.bones

    # 1. Idle (1-96 frames = 4.0s @ 24fps): Regal breathing, hands resting on pommel
    action_idle = bpy.data.actions.new('idle')
    arm_obj.animation_data.action = action_idle
    for f in [1, 48, 96]:
        pb['chest'].location = (0, 0, 0.005 * math.sin(f * math.pi / 24))
        pb['chest'].keyframe_insert('location', frame=f)
        pb['head'].rotation_euler = (0.03 * math.sin(f * 0.1), 0, 0)
        pb['head'].keyframe_insert('rotation_euler', frame=f)

    # 2. Move (1-48 frames = 2.0s @ 24fps): Stately measured royal advance
    action_move = bpy.data.actions.new('move')
    arm_obj.animation_data.action = action_move
    for f in [1, 12, 24, 36, 48]:
        phase = (f - 1) * 2 * math.pi / 48
        pb['thigh.L'].rotation_euler = (0.28 * math.sin(phase), 0, 0)
        pb['thigh.R'].rotation_euler = (-0.28 * math.sin(phase), 0, 0)
        pb['shin.L'].rotation_euler = (max(0, -0.32 * math.sin(phase)), 0, 0)
        pb['shin.R'].rotation_euler = (max(0, 0.32 * math.sin(phase)), 0, 0)
        pb['thigh.L'].keyframe_insert('rotation_euler', frame=f)
        pb['thigh.R'].keyframe_insert('rotation_euler', frame=f)
        pb['shin.L'].keyframe_insert('rotation_euler', frame=f)
        pb['shin.R'].keyframe_insert('rotation_euler', frame=f)

        pb['pelvis'].location = (0, 0, 0.008 * math.sin(phase * 2))
        pb['pelvis'].keyframe_insert('location', frame=f)

    # 3. Attack Anticipation (1-24 frames): Raises Khandā sword overhead with two hands
    action_anticipate = bpy.data.actions.new('attack_anticipation')
    arm_obj.animation_data.action = action_anticipate
    pb['upper_arm.R'].rotation_euler = (0, 0, 0)
    pb['upper_arm.R'].keyframe_insert('rotation_euler', frame=1)
    pb['upper_arm.R'].rotation_euler = (-1.25, 0.15, -0.35) # Sword raised high overhead
    pb['upper_arm.R'].keyframe_insert('rotation_euler', frame=24)

    pb['upper_arm.L'].rotation_euler = (0, 0, 0)
    pb['upper_arm.L'].keyframe_insert('rotation_euler', frame=1)
    pb['upper_arm.L'].rotation_euler = (-1.10, -0.15, 0.35) # Left hand follows
    pb['upper_arm.L'].keyframe_insert('rotation_euler', frame=24)

    # 4. Attack (1-36 frames): Devastating two-handed downward cleave
    action_attack = bpy.data.actions.new('attack')
    arm_obj.animation_data.action = action_attack
    pb['upper_arm.R'].rotation_euler = (-1.25, 0.15, -0.35)
    pb['upper_arm.R'].keyframe_insert('rotation_euler', frame=1)
    pb['upper_arm.R'].rotation_euler = (0.75, 0, -0.10) # Downward strike
    pb['upper_arm.R'].keyframe_insert('rotation_euler', frame=14)
    pb['upper_arm.R'].rotation_euler = (0.45, 0, 0)
    pb['upper_arm.R'].keyframe_insert('rotation_euler', frame=36)

    pb['upper_arm.L'].rotation_euler = (-1.10, -0.15, 0.35)
    pb['upper_arm.L'].keyframe_insert('rotation_euler', frame=1)
    pb['upper_arm.L'].rotation_euler = (0.65, 0, 0.10)
    pb['upper_arm.L'].keyframe_insert('rotation_euler', frame=14)

    pb['pelvis'].location = (0, 0, 0)
    pb['pelvis'].keyframe_insert('location', frame=1)
    pb['pelvis'].location = (0, 0.10, -0.04) # Forward weight shift
    pb['pelvis'].keyframe_insert('location', frame=14)
    pb['pelvis'].location = (0, 0, 0)
    pb['pelvis'].keyframe_insert('location', frame=36)

    # 5. Defend (1-36 frames): Sword parry ward and mantle brace
    action_defend = bpy.data.actions.new('defend')
    arm_obj.animation_data.action = action_defend
    pb['upper_arm.R'].rotation_euler = (0, 0, 0)
    pb['upper_arm.R'].keyframe_insert('rotation_euler', frame=1)
    pb['upper_arm.R'].rotation_euler = (0.45, 0.35, 0.25)
    pb['upper_arm.R'].keyframe_insert('rotation_euler', frame=12)

    pb['forearm.R'].rotation_euler = (0.60, 0.20, 0.40) # Angled blade parry
    pb['forearm.R'].keyframe_insert('rotation_euler', frame=12)

    # 6. Hit (1-24 frames): Stately recoil
    action_hit = bpy.data.actions.new('hit')
    arm_obj.animation_data.action = action_hit
    pb['chest'].rotation_euler = (0, 0, 0)
    pb['chest'].keyframe_insert('rotation_euler', frame=1)
    pb['chest'].rotation_euler = (-0.22, 0.08, -0.05)
    pb['chest'].keyframe_insert('rotation_euler', frame=6)
    pb['chest'].rotation_euler = (0, 0, 0)
    pb['chest'].keyframe_insert('rotation_euler', frame=24)

    # 7. Stagger (1-36 frames): Heavy step back
    action_stagger = bpy.data.actions.new('stagger')
    arm_obj.animation_data.action = action_stagger
    pb['pelvis'].location = (0, 0, 0)
    pb['pelvis'].keyframe_insert('location', frame=1)
    pb['pelvis'].location = (0, -0.08, -0.03)
    pb['pelvis'].keyframe_insert('location', frame=12)
    pb['pelvis'].location = (0, 0, 0)
    pb['pelvis'].keyframe_insert('location', frame=36)

    # 8. Defeat (1-48 frames): Regal concession (king does NOT die, bows head and lowers sword solemnly)
    action_defeat = bpy.data.actions.new('defeat')
    arm_obj.animation_data.action = action_defeat
    pb['head'].rotation_euler = (0, 0, 0)
    pb['head'].keyframe_insert('rotation_euler', frame=1)
    pb['head'].rotation_euler = (0.45, 0, 0) # Head bowed
    pb['head'].keyframe_insert('rotation_euler', frame=24)

    pb['upper_arm.R'].rotation_euler = (0, 0, 0)
    pb['upper_arm.R'].keyframe_insert('rotation_euler', frame=1)
    pb['upper_arm.R'].rotation_euler = (0.55, 0, -0.25) # Sword tip touches ground
    pb['upper_arm.R'].keyframe_insert('rotation_euler', frame=28)

    # 9. Victory (1-48 frames): Sword held high with two hands to heavens
    action_victory = bpy.data.actions.new('victory')
    arm_obj.animation_data.action = action_victory
    pb['upper_arm.R'].rotation_euler = (0, 0, 0)
    pb['upper_arm.R'].keyframe_insert('rotation_euler', frame=1)
    pb['upper_arm.R'].rotation_euler = (-1.40, 0, 0.20)
    pb['upper_arm.R'].keyframe_insert('rotation_euler', frame=20)

    # 10. Draw (1-36 frames): Solemn salute
    action_draw = bpy.data.actions.new('draw')
    arm_obj.animation_data.action = action_draw
    pb['head'].rotation_euler = (0.15, 0, 0)
    pb['head'].keyframe_insert('rotation_euler', frame=1)

    arm_obj.animation_data.action = action_idle

def main():
    scene = reset_scene()
    pal = get_white_army_palette(tex_dir=TEX_DIR)
    plinth = create_plinth(pal, r=0.32, h=0.045)
    body, scale_fac = load_and_scale_human_mesh(pal, target_height=1.24, z_offset=0.045)
    gear_objs, blade, cape, c_t1, cuirass, dhoti = build_raja_regalia(pal, body, scale_fac, z_offset=0.045)
    arm_obj = build_humanoid_armature(scene, name='Raja_Rig', h=1.24, z_offset=0.045)
    bind_raja_mesh_and_regalia(arm_obj, body, gear_objs, blade, cape, c_t1, cuirass, dhoti)
    author_raja_animations(arm_obj)

    blend_path = BLENDER_DIR / 'raja.blend'
    bpy.ops.wm.save_as_mainfile(filepath=str(blend_path))
    print(f"Saved Blender file: {blend_path}")

    glb_export_path = EXPORTS_DIR / 'wK.glb'
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
    shutil.copy2(glb_export_path, PUBLIC_DEV_DIR / 'wK.glb')
    print(f"Staged to web: {PUBLIC_DEV_DIR / 'wK.glb'}")

if __name__ == '__main__':
    main()
