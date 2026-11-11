"""BlunderBot White Army - Queen (Samrajni) Procedural Blender Builder.
Creates an imperial battle commander from CC0 Female Realistic Base Mesh,
with distinct feminine proportions, flared battle mukuta, draped brocade sari,
articulated cuirass, curved talwar, and 10 standard skeletal animation clips.
Exports:
  - art/white_army_v02/blender/samrajni.blend
  - art/white_army_v02/exports/wQ.glb
  - apps/frontend/public/models/astra-dev-v02/wQ.glb
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

def create_plinth(pal, r=0.30, h=0.045):
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

def load_and_scale_female_mesh(pal, target_height=1.20, z_offset=0.045):
    """Loads CC0 Female Realistic mesh, centers it, scales to target height, applies decimation."""
    scene = bpy.context.scene
    with bpy.data.libraries.load(str(HUMAN_BASE_PATH), link=False) as (src, dst):
        dst.collections = ['Body Female - Realistic']
    for c in dst.collections:
        scene.collection.children.link(c)
    bpy.context.view_layer.update()

    body = bpy.data.objects['GEO-body_female_realistic']
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
    body.name = 'Samrajni_AnatomicalBody'
    body.data.materials.clear()
    body.data.materials.append(pal['stone'])

    dec = body.modifiers.new('Decimate', 'DECIMATE')
    dec.ratio = 0.45
    bpy.context.view_layer.objects.active = body
    bpy.ops.object.modifier_apply(modifier='Decimate')

    for name in ['GEO-body_female_realistic.eye.L', 'GEO-body_female_realistic.eye.R']:
        eye = bpy.data.objects.get(name)
        if eye:
            bpy.data.objects.remove(eye, do_unlink=True)

    return body, scale_fac

def build_samrajni_gear(pal, body, scale_fac, z_offset=0.045):
    """Creates flared mukuta, fitted cuirass, draped sari, and curved talwar."""
    scene = bpy.context.scene
    gear_objs = []

    head_z = 1.20

    # 1. Flared Battle Mukuta (Crown) with Silk Veil (Z ≈ 1.22 to 1.34)
    # Flared golden tiara
    bpy.ops.mesh.primitive_cylinder_add(radius=0.088, depth=0.05, vertices=16)
    tiara = bpy.context.active_object
    tiara.name = 'Samrajni_Crown_Base'
    tiara.location = (0, -0.012, head_z + 0.035)
    bpy.ops.object.transform_apply(location=True)
    tiara.data.materials.append(pal['gold'])
    gear_objs.append(tiara)

    # Flared Wings (Crescent sweep)
    bpy.ops.mesh.primitive_cone_add(radius1=0.12, radius2=0.04, depth=0.075, vertices=16)
    wings = bpy.context.active_object
    wings.name = 'Samrajni_Crown_Flairs'
    wings.rotation_euler = (math.pi, 0, 0)
    wings.location = (0, -0.012, head_z + 0.08)
    bpy.ops.object.transform_apply(location=True, rotation=True)
    wings.data.materials.append(pal['gold'])
    gear_objs.append(wings)

    # Silk Veil Draped Behind Crown (Z ≈ 0.95 to 1.28)
    v_verts = [
        (-0.11, -0.09, head_z + 0.06), (0.11, -0.09, head_z + 0.06),
        (0.16, -0.16, head_z - 0.28), (-0.16, -0.16, head_z - 0.28),
        (0, -0.12, head_z - 0.10)
    ]
    v_faces = [(0, 1, 4), (1, 2, 4), (2, 3, 4), (3, 0, 4)]
    v_mesh = bpy.data.meshes.new('Samrajni_Silk_Veil')
    v_mesh.from_pydata(v_verts, [], v_faces)
    v_mesh.update()
    veil = bpy.data.objects.new('Samrajni_Silk_Veil', v_mesh)
    scene.collection.objects.link(veil)
    v_mesh.materials.append(pal['cloth'])
    gear_objs.append(veil)

    # 2. Articulated Feminine Cuirass (Z ≈ 0.62 to 0.92)
    bpy.ops.mesh.primitive_cylinder_add(radius=0.145, depth=0.28, vertices=16)
    cuirass = bpy.context.active_object
    cuirass.name = 'Samrajni_Cuirass'
    cuirass.scale = (1.0, 0.72, 1.0)
    cuirass.location = (0, -0.015, 0.78)
    bpy.ops.object.transform_apply(location=True, scale=True)
    cuirass.data.materials.append(pal['bronze'])
    gear_objs.append(cuirass)

    # Gold Inlay Brocade Border on Cuirass
    bpy.ops.mesh.primitive_torus_add(major_radius=0.148, minor_radius=0.012, major_segments=16, minor_segments=6)
    c_rim = bpy.context.active_object
    c_rim.name = 'Samrajni_Cuirass_GoldTrim'
    c_rim.scale = (1.0, 0.72, 1.0)
    c_rim.location = (0, -0.015, 0.88)
    bpy.ops.object.transform_apply(location=True, scale=True)
    c_rim.data.materials.append(pal['gold'])
    gear_objs.append(c_rim)

    # 3. Draped Sari Skirt with Emerald Silk Pallu (Z ≈ 0.08 to 0.65)
    bpy.ops.mesh.primitive_cylinder_add(radius=0.155, depth=0.52, vertices=16)
    skirt = bpy.context.active_object
    skirt.name = 'Samrajni_Sari_Skirt'
    skirt.scale = (1.0, 0.82, 1.0)
    skirt.location = (0, 0, 0.36)
    bpy.ops.object.transform_apply(location=True, scale=True)
    skirt.data.materials.append(pal['cloth'])
    gear_objs.append(skirt)

    # Diagonal Pallu Sash (Emerald Green) across chest
    bpy.ops.mesh.primitive_cylinder_add(radius=0.155, depth=0.06, vertices=16)
    pallu = bpy.context.active_object
    pallu.name = 'Samrajni_Pallu_Sash'
    pallu.scale = (1.0, 0.75, 1.0)
    pallu.rotation_euler = (0.22, 0.35, 0)
    pallu.location = (0, -0.02, 0.78)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    pallu.data.materials.append(pal['green'])
    gear_objs.append(pallu)

    # 4. Curved Indian Talwar in Right Hand
    # Disc pommel at hand, curved steel blade sweeping forward
    talwar_root = bpy.data.objects.new('Samrajni_TalwarAssembly', None)
    scene.collection.objects.link(talwar_root)
    gear_objs.append(talwar_root)

    # Disc Pommel
    bpy.ops.mesh.primitive_cylinder_add(radius=0.040, depth=0.016, vertices=12)
    pommel = bpy.context.active_object
    pommel.name = 'Samrajni_Talwar_Pommel'
    pommel.location = (-0.24, 0.16, 0.58)
    bpy.ops.object.transform_apply(location=True)
    pommel.data.materials.append(pal['gold'])
    pommel.parent = talwar_root
    gear_objs.append(pommel)

    # Grip
    bpy.ops.mesh.primitive_cylinder_add(radius=0.016, depth=0.11, vertices=10)
    h_grip = bpy.context.active_object
    h_grip.name = 'Samrajni_Talwar_Grip'
    h_grip.location = (-0.24, 0.16, 0.64)
    bpy.ops.object.transform_apply(location=True)
    h_grip.data.materials.append(pal['wood'])
    h_grip.parent = talwar_root
    gear_objs.append(h_grip)

    # Quillon Guard
    bpy.ops.mesh.primitive_cylinder_add(radius=0.05, depth=0.02, vertices=12)
    guard = bpy.context.active_object
    guard.name = 'Samrajni_Talwar_Guard'
    guard.location = (-0.24, 0.16, 0.70)
    bpy.ops.object.transform_apply(location=True)
    guard.data.materials.append(pal['gold'])
    guard.parent = talwar_root
    gear_objs.append(guard)

    # Curved Blade: modeled with curved spline vertices
    blade_n = 8
    b_verts = []
    b_faces = []
    for i in range(blade_n):
        t = i / (blade_n - 1)
        z = 0.71 + t * 0.44
        y = 0.16 + 0.12 * (t ** 1.8) # Forward curve
        w = 0.032 * (1.0 - t * 0.75) # Tapers to tip
        b_verts.append((-0.24 - w, y, z))
        b_verts.append((-0.24 + w, y, z))
        b_verts.append((-0.24, y + 0.012, z))

    for i in range(blade_n - 1):
        a = i * 3
        b_faces.append((a, a + 1, a + 4, a + 3))
        b_faces.append((a, a + 3, a + 5, a + 2))
        b_faces.append((a + 1, a + 2, a + 5, a + 4))

    b_mesh = bpy.data.meshes.new('Samrajni_Talwar_Blade')
    b_mesh.from_pydata(b_verts, [], b_faces)
    b_mesh.update()
    blade = bpy.data.objects.new('Samrajni_Talwar_Blade', b_mesh)
    scene.collection.objects.link(blade)
    b_mesh.materials.append(pal['steel'])
    blade.parent = talwar_root
    gear_objs.append(blade)

    # Sockets
    tip_empty = bpy.data.objects.new('weapon_tip_socket', None)
    tip_empty.empty_display_type = 'SPHERE'
    tip_empty.empty_display_size = 0.04
    tip_empty.location = (-0.24, 0.28, 1.15)
    scene.collection.objects.link(tip_empty)
    tip_empty.parent = talwar_root
    gear_objs.append(tip_empty)

    grip_r = bpy.data.objects.new('grip_R', None)
    grip_r.empty_display_type = 'SPHERE'
    grip_r.empty_display_size = 0.03
    grip_r.location = (-0.24, 0.16, 0.64)
    scene.collection.objects.link(grip_r)
    grip_r.parent = talwar_root
    gear_objs.append(grip_r)

    anchor_empty = bpy.data.objects.new('contact_anchor', None)
    anchor_empty.empty_display_type = 'SPHERE'
    anchor_empty.empty_display_size = 0.05
    anchor_empty.location = (0, 0, 0.76)
    scene.collection.objects.link(anchor_empty)
    gear_objs.append(anchor_empty)

    # Persistent Fracture Components (3 authored pieces)
    for i, (fx, fy, fz) in enumerate([
        (0.08, -0.012, head_z + 0.08), # Crown wing
        (0, -0.015, 0.88),             # Armor gorget
        (-0.24, 0.28, 1.10),           # Talwar blade tip
    ]):
        bpy.ops.mesh.primitive_ico_sphere_add(radius=0.035, subdivisions=1)
        deb = bpy.context.active_object
        deb.name = f'Samrajni_Debris_Chunk_{i+1}'
        deb.location = (fx, fy, fz)
        bpy.ops.object.transform_apply(location=True)
        deb.data.materials.append(pal['gold'] if i != 2 else pal['steel'])
        gear_objs.append(deb)

    return gear_objs, talwar_root, veil, tiara, cuirass, skirt

def build_humanoid_armature(scene, name='Samrajni_Rig', h=1.20, z_offset=0.045):
    """Constructs the canonical Samrajni humanoid armature hierarchy."""
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

    s = h / 1.65
    root = add_bone('root', (0, 0, 0), (0, 0, 0.05))
    pelvis = add_bone('pelvis', (0, 0, z_offset + 0.88 * s), (0, 0, z_offset + 0.98 * s), 'root')
    spine = add_bone('spine', (0, 0, z_offset + 0.98 * s), (0, 0, z_offset + 1.18 * s), 'pelvis')
    chest = add_bone('chest', (0, 0, z_offset + 1.18 * s), (0, 0, z_offset + 1.38 * s), 'spine')
    neck = add_bone('neck', (0, 0, z_offset + 1.38 * s), (0, 0, z_offset + 1.46 * s), 'chest')
    head = add_bone('head', (0, 0, z_offset + 1.46 * s), (0, 0, z_offset + 1.66 * s), 'neck')

    for side, sign in [('L', 1), ('R', -1)]:
        add_bone(f'clavicle.{side}', (0, 0, z_offset + 1.38 * s), (sign * 0.15 * s, 0, z_offset + 1.38 * s), 'chest')
        add_bone(f'upper_arm.{side}', (sign * 0.15 * s, 0, z_offset + 1.38 * s), (sign * 0.28 * s, 0, z_offset + 1.12 * s), f'clavicle.{side}')
        add_bone(f'forearm.{side}', (sign * 0.28 * s, 0, z_offset + 1.12 * s), (sign * 0.24 * s, 0.15 * s, z_offset + 0.90 * s), f'upper_arm.{side}')
        add_bone(f'hand.{side}', (sign * 0.24 * s, 0.15 * s, z_offset + 0.90 * s), (sign * 0.24 * s, 0.16 * s, z_offset + 0.80 * s), f'forearm.{side}')

        add_bone(f'thigh.{side}', (sign * 0.095 * s, 0, z_offset + 0.88 * s), (sign * 0.095 * s, -0.01 * s, z_offset + 0.48 * s), 'pelvis')
        add_bone(f'shin.{side}', (sign * 0.095 * s, -0.01 * s, z_offset + 0.48 * s), (sign * 0.095 * s, 0, z_offset + 0.15 * s), f'thigh.{side}')
        add_bone(f'foot.{side}', (sign * 0.095 * s, 0, z_offset + 0.15 * s), (sign * 0.095 * s, 0.12 * s, z_offset + 0.02), f'shin.{side}')

    bpy.ops.object.mode_set(mode='OBJECT')
    return arm_obj

def bind_samrajni_mesh_and_gear(arm_obj, body, gear_objs, talwar_root, veil, tiara, cuirass, skirt):
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

    parent_bone(tiara, 'head')
    parent_bone(bpy.data.objects['Samrajni_Crown_Flairs'], 'head')
    parent_bone(veil, 'head')

    parent_bone(cuirass, 'chest')
    parent_bone(bpy.data.objects['Samrajni_Cuirass_GoldTrim'], 'chest')
    parent_bone(bpy.data.objects['Samrajni_Pallu_Sash'], 'chest')

    parent_bone(skirt, 'pelvis')

    # Talwar assembly parented to hand.R
    parent_bone(talwar_root, 'hand.R')

    plinth = bpy.data.objects.get('Plinth_Stone')
    if plinth:
        parent_bone(plinth, 'root')

def author_samrajni_animations(arm_obj):
    """Authors the complete 10-clip standard animation set for Queen."""
    arm_obj.animation_data_create()
    for pb in arm_obj.pose.bones:
        pb.rotation_mode = 'XYZ'
    pb = arm_obj.pose.bones

    # 1. Idle (1-96 frames = 4.0s @ 24fps): Poised command stance, talwar ready
    action_idle = bpy.data.actions.new('idle')
    action_idle.use_fake_user = True
    arm_obj.animation_data.action = action_idle
    for f in [1, 48, 96]:
        pb['chest'].location = (0, 0, 0.004 * math.sin(f * math.pi / 24))
        pb['chest'].keyframe_insert('location', frame=f)
        pb['forearm.R'].rotation_euler = (0.08 + 0.02 * math.sin(f * 0.1), 0, 0.12)
        pb['forearm.R'].keyframe_insert('rotation_euler', frame=f)

    # 2. Move (1-48 frames = 2.0s @ 24fps): Graceful swift gliding stride
    action_move = bpy.data.actions.new('move')
    action_move.use_fake_user = True
    arm_obj.animation_data.action = action_move
    for f in [1, 7, 13, 19, 25, 31, 37, 43, 49]:
        phase = (f - 1) * 2 * math.pi / 48
        pb['thigh.L'].rotation_euler = (0.35 * math.sin(phase), 0, 0)
        pb['thigh.R'].rotation_euler = (-0.35 * math.sin(phase), 0, 0)
        pb['shin.L'].rotation_euler = (max(0, -0.40 * math.sin(phase)), 0, 0)
        pb['shin.R'].rotation_euler = (max(0, 0.40 * math.sin(phase)), 0, 0)
        pb['thigh.L'].keyframe_insert('rotation_euler', frame=f)
        pb['thigh.R'].keyframe_insert('rotation_euler', frame=f)
        pb['shin.L'].keyframe_insert('rotation_euler', frame=f)
        pb['shin.R'].keyframe_insert('rotation_euler', frame=f)

        pb['pelvis'].location = (0, 0, 0.010 * math.sin(phase * 2))
        pb['pelvis'].keyframe_insert('location', frame=f)

    # 3. Attack Anticipation (1-24 frames): Fluid circular backswing of curved blade
    action_anticipate = bpy.data.actions.new('attack_anticipation')
    arm_obj.animation_data.action = action_anticipate
    pb['upper_arm.R'].rotation_euler = (0, 0, 0)
    pb['upper_arm.R'].keyframe_insert('rotation_euler', frame=1)
    pb['upper_arm.R'].rotation_euler = (-0.65, 0.35, -0.45) # Swept back
    pb['upper_arm.R'].keyframe_insert('rotation_euler', frame=24)

    pb['forearm.R'].rotation_euler = (0, 0, 0)
    pb['forearm.R'].keyframe_insert('rotation_euler', frame=1)
    pb['forearm.R'].rotation_euler = (0.75, 0.20, 0.30)
    pb['forearm.R'].keyframe_insert('rotation_euler', frame=24)

    # 4. Attack (1-36 frames): Sweeping horizontal curved talwar slash
    action_attack = bpy.data.actions.new('attack')
    arm_obj.animation_data.action = action_attack
    pb['upper_arm.R'].rotation_euler = (-0.65, 0.35, -0.45)
    pb['upper_arm.R'].keyframe_insert('rotation_euler', frame=1)
    pb['upper_arm.R'].rotation_euler = (0.50, -0.45, 0.65) # Slashing across body
    pb['upper_arm.R'].keyframe_insert('rotation_euler', frame=12)
    pb['upper_arm.R'].rotation_euler = (0.25, 0, 0.20)
    pb['upper_arm.R'].keyframe_insert('rotation_euler', frame=36)

    pb['pelvis'].location = (0, 0, 0)
    pb['pelvis'].keyframe_insert('location', frame=1)
    pb['pelvis'].location = (0, 0.08, -0.02)
    pb['pelvis'].keyframe_insert('location', frame=12)
    pb['pelvis'].location = (0, 0, 0)
    pb['pelvis'].keyframe_insert('location', frame=36)

    # 5. Defend (1-36 frames): Evasive pivot & blade parry
    action_defend = bpy.data.actions.new('defend')
    arm_obj.animation_data.action = action_defend
    pb['upper_arm.R'].rotation_euler = (0, 0, 0)
    pb['upper_arm.R'].keyframe_insert('rotation_euler', frame=1)
    pb['upper_arm.R'].rotation_euler = (0.55, 0.25, 0.35)
    pb['upper_arm.R'].keyframe_insert('rotation_euler', frame=10)

    pb['forearm.R'].rotation_euler = (0.85, -0.15, 0.45)
    pb['forearm.R'].keyframe_insert('rotation_euler', frame=10)

    # 6. Hit (1-24 frames): Recoil shock
    action_hit = bpy.data.actions.new('hit')
    arm_obj.animation_data.action = action_hit
    pb['chest'].rotation_euler = (0, 0, 0)
    pb['chest'].keyframe_insert('rotation_euler', frame=1)
    pb['chest'].rotation_euler = (-0.25, 0.12, -0.08)
    pb['chest'].keyframe_insert('rotation_euler', frame=6)
    pb['chest'].rotation_euler = (0, 0, 0)
    pb['chest'].keyframe_insert('rotation_euler', frame=24)

    # 7. Stagger (1-36 frames): Side step recovery
    action_stagger = bpy.data.actions.new('stagger')
    arm_obj.animation_data.action = action_stagger
    pb['pelvis'].location = (0, 0, 0)
    pb['pelvis'].keyframe_insert('location', frame=1)
    pb['pelvis'].location = (-0.06, -0.06, -0.03)
    pb['pelvis'].keyframe_insert('location', frame=12)
    pb['pelvis'].location = (0, 0, 0)
    pb['pelvis'].keyframe_insert('location', frame=36)

    # 8. Defeat (1-48 frames): Graceful concession, lowers talwar, drops to knee
    action_defeat = bpy.data.actions.new('defeat')
    arm_obj.animation_data.action = action_defeat
    pb['thigh.L'].rotation_euler = (0, 0, 0)
    pb['thigh.L'].keyframe_insert('rotation_euler', frame=1)
    pb['thigh.L'].rotation_euler = (0.80, 0, 0)
    pb['thigh.L'].keyframe_insert('rotation_euler', frame=24)

    pb['pelvis'].location = (0, 0, 0)
    pb['pelvis'].keyframe_insert('location', frame=1)
    pb['pelvis'].location = (0, 0, -0.12)
    pb['pelvis'].keyframe_insert('location', frame=24)

    pb['upper_arm.R'].rotation_euler = (0, 0, 0)
    pb['upper_arm.R'].keyframe_insert('rotation_euler', frame=1)
    pb['upper_arm.R'].rotation_euler = (0.65, 0, -0.20)
    pb['upper_arm.R'].keyframe_insert('rotation_euler', frame=28)

    # 9. Victory (1-48 frames): Flourishes talwar in arc and salutes
    action_victory = bpy.data.actions.new('victory')
    arm_obj.animation_data.action = action_victory
    pb['upper_arm.R'].rotation_euler = (0, 0, 0)
    pb['upper_arm.R'].keyframe_insert('rotation_euler', frame=1)
    pb['upper_arm.R'].rotation_euler = (-1.10, -0.20, 0.35)
    pb['upper_arm.R'].keyframe_insert('rotation_euler', frame=20)

    # 10. Draw (1-36 frames): Fencing salute
    action_draw = bpy.data.actions.new('draw')
    arm_obj.animation_data.action = action_draw
    pb['forearm.R'].rotation_euler = (0.45, 0, 0)
    pb['forearm.R'].keyframe_insert('rotation_euler', frame=1)

    arm_obj.animation_data.action = action_idle

def main():
    scene = reset_scene()
    pal = get_white_army_palette(tex_dir=TEX_DIR)
    plinth = create_plinth(pal, r=0.30, h=0.045)
    body, scale_fac = load_and_scale_female_mesh(pal, target_height=1.20, z_offset=0.045)
    gear_objs, talwar_root, veil, tiara, cuirass, skirt = build_samrajni_gear(pal, body, scale_fac, z_offset=0.045)
    arm_obj = build_humanoid_armature(scene, name='Samrajni_Rig', h=1.20, z_offset=0.045)
    bind_samrajni_mesh_and_gear(arm_obj, body, gear_objs, talwar_root, veil, tiara, cuirass, skirt)
    author_samrajni_animations(arm_obj)

    blend_path = BLENDER_DIR / 'samrajni.blend'
    bpy.ops.wm.save_as_mainfile(filepath=str(blend_path))
    print(f"Saved Blender file: {blend_path}")

    glb_export_path = EXPORTS_DIR / 'wQ.glb'
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
    shutil.copy2(glb_export_path, PUBLIC_DEV_DIR / 'wQ.glb')
    print(f"Staged to web: {PUBLIC_DEV_DIR / 'wQ.glb'}")

if __name__ == '__main__':
    main()
