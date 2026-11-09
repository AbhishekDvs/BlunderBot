"""BlunderBot White Army - Rook (Durg) Procedural Blender Builder.
Creates an ancient Indian wheeled military fortress with square battlements,
recessed gate, 4 spoked wheels, brass reinforcement, and mechanical armature.
Exports:
  - art/white_army_v02/blender/durg.blend
  - art/white_army_v02/exports/wR.glb
  - apps/frontend/public/models/astra-dev-v02/wR.glb
"""
import bpy
import math
import numpy as np
from pathlib import Path
import sys

# Ensure local imports work
SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from materials import get_white_army_palette

PROJECT_ROOT = SCRIPT_DIR.parents[2]
BLENDER_DIR = PROJECT_ROOT / 'art/white_army_v02/blender'
EXPORTS_DIR = PROJECT_ROOT / 'art/white_army_v02/exports'
PUBLIC_DEV_DIR = PROJECT_ROOT / 'apps/frontend/public/models/astra-dev-v02'
TEX_DIR = PROJECT_ROOT / 'art/white_army_v02/exports/textures'

for d in [BLENDER_DIR, EXPORTS_DIR, PUBLIC_DEV_DIR, TEX_DIR]:
    d.mkdir(parents=True, exist_ok=True)

def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.unit_settings.system = 'METRIC'
    scene.unit_settings.scale_length = 1.0
    scene.render.fps = 24
    return scene

def create_mesh_object(name, verts, faces, mat=None, parent=None):
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    if mat:
        mesh.materials.append(mat)
    if parent:
        obj.parent = parent
    for p in mesh.polygons:
        p.use_smooth = True
    return obj

def build_durg_geometry(pal):
    """Builds the fortress mesh components with proper Indian architectural features."""
    created_objects = []

    # 1. Base Grounded Plinth (Y = 0.0 to 0.04)
    # Beveled octagonal plinth
    r = 0.33
    n = 16
    verts = []
    # Bottom circle
    for i in range(n):
        a = 2 * math.pi * i / n
        verts.append((r * math.cos(a), r * math.sin(a), 0.0))
    # Top circle
    for i in range(n):
        a = 2 * math.pi * i / n
        verts.append((r * 0.96 * math.cos(a), r * 0.96 * math.sin(a), 0.04))
    # Center points
    verts.append((0, 0, 0.0))
    verts.append((0, 0, 0.04))
    bot_center = 2 * n
    top_center = 2 * n + 1

    faces = []
    for i in range(n):
        nxt = (i + 1) % n
        faces.append((i, nxt, n + nxt, n + i))
        faces.append((nxt, i, bot_center))
        faces.append((n + i, n + nxt, top_center))

    # Convert coordinates: in Blender standard, Z is Up. For glTF: glTF will convert +Z up to +Y up.
    plinth = create_mesh_object('Plinth_Stone', verts, faces, pal['stone'])
    created_objects.append(plinth)

    # 2. Heavy Timber Chassis Frame (Z = 0.04 to 0.12)
    # Long beams and cross beams
    bpy.ops.mesh.primitive_cube_add(size=1.0)
    chassis = bpy.context.active_object
    chassis.name = 'Chassis_Timber_Frame'
    chassis.scale = (0.28, 0.48, 0.05)
    chassis.location = (0, 0, 0.075)
    bpy.ops.object.transform_apply(location=True, scale=True)
    chassis.data.materials.append(pal['wood'])
    created_objects.append(chassis)

    # 3. Bronze Reinforcement Brackets on Chassis Corners
    for dx in [-0.26, 0.26]:
        for dy in [-0.22, 0.22]:
            bpy.ops.mesh.primitive_cube_add(size=1.0)
            bracket = bpy.context.active_object
            bracket.name = f'Chassis_Bracket_{"R" if dx>0 else "L"}_{"F" if dy>0 else "B"}'
            bracket.scale = (0.04, 0.06, 0.06)
            bracket.location = (dx, dy, 0.08)
            bpy.ops.object.transform_apply(location=True, scale=True)
            bracket.data.materials.append(pal['bronze'])
            created_objects.append(bracket)

    # 4. Spoked Wheels (4 wheels at corners)
    # Wheel: outer iron rim, bronze hub, 6 wooden spokes
    wheel_objs = {}
    wheel_coords = {
        'wheel_FL': (0.26, 0.17, 0.09),
        'wheel_FR': (-0.26, 0.17, 0.09),
        'wheel_BL': (0.26, -0.17, 0.09),
        'wheel_BR': (-0.26, -0.17, 0.09),
    }

    for w_name, (wx, wy, wz) in wheel_coords.items():
        # Outer rim (cylinder along X)
        bpy.ops.mesh.primitive_cylinder_add(radius=0.085, depth=0.035, vertices=16)
        w_rim = bpy.context.active_object
        w_rim.name = f'{w_name}_Rim'
        w_rim.rotation_euler = (0, math.pi / 2, 0)
        w_rim.location = (wx, wy, wz)
        bpy.ops.object.transform_apply(location=True, rotation=True)
        w_rim.data.materials.append(pal['bronze'])
        wheel_objs[w_name] = w_rim
        created_objects.append(w_rim)

        # Bronze Hub
        bpy.ops.mesh.primitive_cylinder_add(radius=0.028, depth=0.045, vertices=12)
        w_hub = bpy.context.active_object
        w_hub.name = f'{w_name}_Hub'
        w_hub.rotation_euler = (0, math.pi / 2, 0)
        w_hub.location = (wx, wy, wz)
        bpy.ops.object.transform_apply(location=True, rotation=True)
        w_hub.data.materials.append(pal['gold'])
        created_objects.append(w_hub)

    # 5. Axles connecting wheels
    for dy in [0.17, -0.17]:
        bpy.ops.mesh.primitive_cylinder_add(radius=0.018, depth=0.52, vertices=12)
        axle = bpy.context.active_object
        axle.name = f'Axle_{"Front" if dy > 0 else "Rear"}'
        axle.rotation_euler = (0, math.pi / 2, 0)
        axle.location = (0, dy, 0.09)
        bpy.ops.object.transform_apply(location=True, rotation=True)
        axle.data.materials.append(pal['bronze'])
        created_objects.append(axle)

    # 6. Main Fortress Bastion Body (Z = 0.10 to 0.75)
    # Tapered square tower with dressed stone blocks
    # Bottom: 0.44 x 0.44, Top: 0.38 x 0.38
    b_verts = [
        (-0.22, -0.22, 0.10), (0.22, -0.22, 0.10), (0.22, 0.22, 0.10), (-0.22, 0.22, 0.10),
        (-0.19, -0.19, 0.75), (0.19, -0.19, 0.75), (0.19, 0.19, 0.75), (-0.19, 0.19, 0.75),
    ]
    b_faces = [
        (0, 1, 2, 3), # Bottom
        (4, 7, 6, 5), # Top roof
        (0, 4, 5, 1), # South/Front
        (1, 5, 6, 2), # East
        (2, 6, 7, 3), # North/Back
        (3, 7, 4, 0), # West
    ]
    bastion = create_mesh_object('Durg_Bastion', b_verts, b_faces, pal['stone'])
    created_objects.append(bastion)

    # 7. Recessed Arched Gateway with Portcullis on Front (+Y)
    bpy.ops.mesh.primitive_cube_add(size=1.0)
    gate_recess = bpy.context.active_object
    gate_recess.name = 'Durg_Gate_Arch'
    gate_recess.scale = (0.16, 0.04, 0.28)
    gate_recess.location = (0, 0.21, 0.25)
    bpy.ops.object.transform_apply(location=True, scale=True)
    gate_recess.data.materials.append(pal['stone'])
    created_objects.append(gate_recess)

    # Portcullis Grille
    bpy.ops.mesh.primitive_cube_add(size=1.0)
    portcullis = bpy.context.active_object
    portcullis.name = 'Durg_Portcullis'
    portcullis.scale = (0.13, 0.015, 0.24)
    portcullis.location = (0, 0.215, 0.24)
    bpy.ops.object.transform_apply(location=True, scale=True)
    portcullis.data.materials.append(pal['steel'])
    created_objects.append(portcullis)

    # 8. Battering Ram / Ballista Weapon Assembly (`Durg_Ram`)
    # Heavy bronze/iron reinforced ram with ram-head tip
    bpy.ops.mesh.primitive_cylinder_add(radius=0.035, depth=0.40, vertices=16)
    ram_shaft = bpy.context.active_object
    ram_shaft.name = 'Durg_Ram'
    ram_shaft.rotation_euler = (math.pi / 2, 0, 0)
    ram_shaft.location = (0, 0.16, 0.25)
    bpy.ops.object.transform_apply(location=True, rotation=True)
    ram_shaft.data.materials.append(pal['wood'])
    created_objects.append(ram_shaft)

    # Ram Head (Bronze carved elephant/bull head or pointed iron ram)
    bpy.ops.mesh.primitive_cone_add(radius1=0.05, radius2=0.01, depth=0.10, vertices=12)
    ram_head = bpy.context.active_object
    ram_head.name = 'Durg_Ram_Head'
    ram_head.rotation_euler = (-math.pi / 2, 0, 0)
    ram_head.location = (0, 0.36, 0.25)
    bpy.ops.object.transform_apply(location=True, rotation=True)
    ram_head.data.materials.append(pal['bronze'])
    created_objects.append(ram_head)

    # Socket: weapon_tip_socket
    tip_empty = bpy.data.objects.new('weapon_tip_socket', None)
    tip_empty.empty_display_type = 'SPHERE'
    tip_empty.empty_display_size = 0.05
    tip_empty.location = (0, 0.42, 0.25)
    bpy.context.scene.collection.objects.link(tip_empty)
    created_objects.append(tip_empty)

    # Socket: contact_anchor
    anchor_empty = bpy.data.objects.new('contact_anchor', None)
    anchor_empty.empty_display_type = 'SPHERE'
    anchor_empty.empty_display_size = 0.05
    anchor_empty.location = (0, 0, 0.45)
    bpy.context.scene.collection.objects.link(anchor_empty)
    created_objects.append(anchor_empty)

    # 9. Stepped Indian Kangura Battlements (Parapet at Z = 0.75 to 0.88)
    # Merlons around 4 sides with stepped notch profile
    merlon_w = 0.075
    merlon_h = 0.13
    merlon_d = 0.04
    merlons = []

    for side, (rot, pos) in enumerate([
        (0, (0, 0.20)),              # Front
        (math.pi, (0, -0.20)),        # Back
        (math.pi / 2, (-0.20, 0)),    # Left
        (-math.pi / 2, (0.20, 0)),   # Right
    ]):
        for offset in [-0.12, 0.0, 0.12]:
            bpy.ops.mesh.primitive_cube_add(size=1.0)
            m = bpy.context.active_object
            m.name = f'Durg_Merlon_{side}_{offset:.2f}'
            m.scale = (merlon_w, merlon_d, merlon_h)
            if side in [0, 1]:
                m.location = (offset, pos[1], 0.75 + merlon_h / 2)
            else:
                m.location = (pos[0], offset, 0.75 + merlon_h / 2)
            bpy.ops.object.transform_apply(location=True, scale=True)
            m.data.materials.append(pal['stone'])
            merlons.append(m)
            created_objects.append(m)

    # 10. Corner Turret Finials with Gold Bands
    for cx in [-0.19, 0.19]:
        for cy in [-0.19, 0.19]:
            bpy.ops.mesh.primitive_cylinder_add(radius=0.035, depth=0.18, vertices=12)
            turret = bpy.context.active_object
            turret.name = f'Durg_CornerTurret_{"R" if cx>0 else "L"}_{"F" if cy>0 else "B"}'
            turret.location = (cx, cy, 0.84)
            bpy.ops.object.transform_apply(location=True)
            turret.data.materials.append(pal['gold'])
            created_objects.append(turret)

    # 11. Military Pennant / Banner on Brass Standard (Z = 0.75 to 1.14)
    bpy.ops.mesh.primitive_cylinder_add(radius=0.012, depth=0.42, vertices=8)
    pole = bpy.context.active_object
    pole.name = 'Durg_Banner_Pole'
    pole.location = (0.14, -0.14, 0.94)
    bpy.ops.object.transform_apply(location=True)
    pole.data.materials.append(pal['gold'])
    created_objects.append(pole)

    # Swallowtail cloth pennant (saffron/vermilion)
    p_verts = [
        (0.14, -0.14, 1.10),
        (0.14, -0.14, 0.96),
        (0.14, -0.32, 1.03), # Swallowtail fork
        (0.14, -0.38, 1.10), # Top tip
        (0.14, -0.38, 0.96), # Bottom tip
    ]
    p_faces = [
        (0, 1, 2),
        (0, 2, 3),
        (1, 4, 2),
    ]
    pennant = create_mesh_object('Durg_Banner_Cloth', p_verts, p_faces, pal['saffron'])
    created_objects.append(pennant)

    # 12. Persistent Fracture Components (Authored masonry chunks)
    # Chunks that can break away during defeat
    for i, (fx, fy, fz) in enumerate([
        (0.14, 0.14, 0.82),
        (-0.14, 0.14, 0.82),
        (0.0, -0.14, 0.82),
    ]):
        bpy.ops.mesh.primitive_ico_sphere_add(radius=0.045, subdivisions=1)
        chunk = bpy.context.active_object
        chunk.name = f'Durg_Debris_Chunk_{i+1}'
        chunk.location = (fx, fy, fz)
        bpy.ops.object.transform_apply(location=True)
        chunk.data.materials.append(pal['stone'])
        created_objects.append(chunk)

    return created_objects, wheel_objs, ram_shaft, portcullis, pennant

def build_durg_armature(scene):
    """Constructs the mechanical Durg_Rig armature."""
    arm_data = bpy.data.armatures.new('Durg_Armature')
    arm_obj = bpy.data.objects.new('Durg_Rig', arm_data)
    scene.collection.objects.link(arm_obj)
    bpy.context.view_layer.objects.active = arm_obj

    bpy.ops.object.mode_set(mode='EDIT')
    eb = arm_data.edit_bones

    root = eb.new('root')
    root.head = (0, 0, 0)
    root.tail = (0, 0, 0.05)

    chassis = eb.new('chassis')
    chassis.parent = root
    chassis.head = (0, 0, 0.05)
    chassis.tail = (0, 0, 0.15)

    turret = eb.new('turret')
    turret.parent = chassis
    turret.head = (0, 0, 0.15)
    turret.tail = (0, 0, 0.75)

    # 4 Wheel bones
    wheels = {
        'wheel_FL': (0.26, 0.17, 0.09),
        'wheel_FR': (-0.26, 0.17, 0.09),
        'wheel_BL': (0.26, -0.17, 0.09),
        'wheel_BR': (-0.26, -0.17, 0.09),
    }
    for w_name, (wx, wy, wz) in wheels.items():
        b = eb.new(w_name)
        b.parent = chassis
        b.head = (wx, wy, wz)
        b.tail = (wx, wy + 0.05, wz)

    # Battering ram bone
    ram = eb.new('ram')
    ram.parent = turret
    ram.head = (0, 0.10, 0.25)
    ram.tail = (0, 0.35, 0.25)

    # Portcullis bone
    port = eb.new('portcullis')
    port.parent = turret
    port.head = (0, 0.21, 0.24)
    port.tail = (0, 0.21, 0.35)

    # Banner flutter bone
    banner = eb.new('banner')
    banner.parent = turret
    banner.head = (0.14, -0.14, 0.94)
    banner.tail = (0.14, -0.30, 1.03)

    bpy.ops.object.mode_set(mode='OBJECT')
    return arm_obj

def author_durg_animations(arm_obj):
    """Creates the standard suite of mechanical action clips."""
    arm_obj.animation_data_create()
    pb = arm_obj.pose.bones

    # 1. Idle (1-96 frames = 4.0s @ 24fps)
    action_idle = bpy.data.actions.new('idle')
    arm_obj.animation_data.action = action_idle
    for f in [1, 48, 96]:
        chassis_bone = pb['chassis']
        chassis_bone.location = (0, 0, 0.003 * math.sin(f * math.pi / 24))
        chassis_bone.keyframe_insert('location', frame=f)

        banner_bone = pb['banner']
        banner_bone.rotation_euler = (0.05 * math.sin(f * 0.2), 0, 0.08 * math.cos(f * 0.2))
        banner_bone.keyframe_insert('rotation_euler', frame=f)

    # 2. Move (1-48 frames = 2.0s @ 24fps): wheels roll, chassis sways
    action_move = bpy.data.actions.new('move')
    arm_obj.animation_data.action = action_move
    for f in [1, 12, 24, 36, 48]:
        rot_angle = -2 * math.pi * (f - 1) / 48
        for w in ['wheel_FL', 'wheel_FR', 'wheel_BL', 'wheel_BR']:
            pb[w].rotation_euler = (rot_angle, 0, 0)
            pb[w].keyframe_insert('rotation_euler', frame=f)
        pb['chassis'].location = (0, 0, 0.008 * math.sin(f * 0.5))
        pb['chassis'].keyframe_insert('location', frame=f)
        pb['chassis'].rotation_euler = (0, 0.03 * math.sin(f * 0.5), 0)
        pb['chassis'].keyframe_insert('rotation_euler', frame=f)

    # 3. Attack Anticipation (1-24 frames): portcullis rises, ram draws back
    action_anticipate = bpy.data.actions.new('attack_anticipation')
    arm_obj.animation_data.action = action_anticipate
    pb['portcullis'].location = (0, 0, 0)
    pb['portcullis'].keyframe_insert('location', frame=1)
    pb['portcullis'].location = (0, 0, 0.12)
    pb['portcullis'].keyframe_insert('location', frame=24)

    pb['ram'].location = (0, 0, 0)
    pb['ram'].keyframe_insert('location', frame=1)
    pb['ram'].location = (0, -0.08, 0)
    pb['ram'].keyframe_insert('location', frame=24)

    # 4. Attack (1-36 frames): ram thrusts forward violently, chassis recoils
    action_attack = bpy.data.actions.new('attack')
    arm_obj.animation_data.action = action_attack
    pb['ram'].location = (0, -0.08, 0)
    pb['ram'].keyframe_insert('location', frame=1)
    pb['ram'].location = (0, 0.18, 0) # Strike impact
    pb['ram'].keyframe_insert('location', frame=12)
    pb['ram'].location = (0, 0.12, 0) # Settle
    pb['ram'].keyframe_insert('location', frame=36)

    pb['chassis'].location = (0, 0, 0)
    pb['chassis'].keyframe_insert('location', frame=1)
    pb['chassis'].location = (0, -0.04, 0) # Recoil
    pb['chassis'].keyframe_insert('location', frame=14)
    pb['chassis'].location = (0, 0, 0)
    pb['chassis'].keyframe_insert('location', frame=36)

    # 5. Defend (1-36 frames): portcullis drops, chassis hunkers down
    action_defend = bpy.data.actions.new('defend')
    arm_obj.animation_data.action = action_defend
    pb['portcullis'].location = (0, 0, 0.05)
    pb['portcullis'].keyframe_insert('location', frame=1)
    pb['portcullis'].location = (0, 0, -0.04) # Slams shut
    pb['portcullis'].keyframe_insert('location', frame=10)

    pb['chassis'].location = (0, 0, 0)
    pb['chassis'].keyframe_insert('location', frame=1)
    pb['chassis'].location = (0, 0, -0.02) # Lowers into wheels
    pb['chassis'].keyframe_insert('location', frame=12)
    pb['chassis'].location = (0, 0, 0)
    pb['chassis'].keyframe_insert('location', frame=36)

    # 6. Hit (1-24 frames): shudder recoil
    action_hit = bpy.data.actions.new('hit')
    arm_obj.animation_data.action = action_hit
    pb['turret'].rotation_euler = (0, 0, 0)
    pb['turret'].keyframe_insert('rotation_euler', frame=1)
    pb['turret'].rotation_euler = (-0.08, 0, 0.05)
    pb['turret'].keyframe_insert('rotation_euler', frame=6)
    pb['turret'].rotation_euler = (0, 0, 0)
    pb['turret'].keyframe_insert('rotation_euler', frame=24)

    # 7. Stagger (1-36 frames): heavy wobble
    action_stagger = bpy.data.actions.new('stagger')
    arm_obj.animation_data.action = action_stagger
    pb['chassis'].rotation_euler = (0, 0, 0)
    pb['chassis'].keyframe_insert('rotation_euler', frame=1)
    pb['chassis'].rotation_euler = (0.12, 0.08, -0.04)
    pb['chassis'].keyframe_insert('rotation_euler', frame=12)
    pb['chassis'].rotation_euler = (0, 0, 0)
    pb['chassis'].keyframe_insert('rotation_euler', frame=36)

    # 8. Defeat (1-48 frames): turret fracture collapse, ram drops, base stays grounded
    action_defeat = bpy.data.actions.new('defeat')
    arm_obj.animation_data.action = action_defeat
    pb['turret'].location = (0, 0, 0)
    pb['turret'].keyframe_insert('location', frame=1)
    pb['turret'].location = (0, 0, -0.06)
    pb['turret'].rotation_euler = (0.08, 0.14, -0.05)
    pb['turret'].keyframe_insert('location', frame=24)
    pb['turret'].keyframe_insert('rotation_euler', frame=24)

    pb['banner'].rotation_euler = (0, 0, 0)
    pb['banner'].keyframe_insert('rotation_euler', frame=1)
    pb['banner'].rotation_euler = (0.8, 0.4, 0.2) # Banner topples
    pb['banner'].keyframe_insert('rotation_euler', frame=28)

    # 9. Victory (1-48 frames): banner salutes, ram rises
    action_victory = bpy.data.actions.new('victory')
    arm_obj.animation_data.action = action_victory
    pb['ram'].location = (0, 0, 0)
    pb['ram'].keyframe_insert('location', frame=1)
    pb['ram'].rotation_euler = (0.22, 0, 0) # Salutes upward
    pb['ram'].keyframe_insert('rotation_euler', frame=20)

    # 10. Draw (1-36 frames): neutral stand
    action_draw = bpy.data.actions.new('draw')
    arm_obj.animation_data.action = action_draw
    pb['chassis'].location = (0, 0, 0)
    pb['chassis'].keyframe_insert('location', frame=1)

    # Reset active action to idle
    arm_obj.animation_data.action = action_idle

def parent_obj_to_bone(obj, arm_obj, bone_name):
    """Cleanly parents an object to a bone preserving world space transform."""
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    arm_obj.select_set(True)
    bpy.context.view_layer.objects.active = arm_obj
    arm_obj.data.bones.active = arm_obj.data.bones[bone_name]
    bpy.ops.object.parent_set(type='BONE')

def parent_meshes_to_bones(mesh_objs, wheel_objs, ram_shaft, portcullis, pennant, arm_obj):
    """Parents meshes to appropriate armature bones for mechanical deformation."""
    turret_names = ['Durg_Bastion', 'Durg_Gate_Arch', 'Durg_Banner_Pole', 'Plinth_Stone']
    for obj in mesh_objs:
        if obj.name.startswith('Durg_Merlon') or obj.name.startswith('Durg_CornerTurret') or obj.name.startswith('Durg_Debris'):
            turret_names.append(obj.name)

    for o in mesh_objs:
        if o.name in turret_names:
            parent_obj_to_bone(o, arm_obj, 'turret')
        elif o.name.startswith('Chassis'):
            parent_obj_to_bone(o, arm_obj, 'chassis')

    # Wheels
    for w_name, w_rim in wheel_objs.items():
        parent_obj_to_bone(w_rim, arm_obj, w_name)

    # Ram
    parent_obj_to_bone(ram_shaft, arm_obj, 'ram')

    # Portcullis
    parent_obj_to_bone(portcullis, arm_obj, 'portcullis')

    # Pennant
    parent_obj_to_bone(pennant, arm_obj, 'banner')

def main():
    scene = reset_scene()
    pal = get_white_army_palette(tex_dir=TEX_DIR)
    mesh_objs, wheel_objs, ram_shaft, portcullis, pennant = build_durg_geometry(pal)
    arm_obj = build_durg_armature(scene)
    parent_meshes_to_bones(mesh_objs, wheel_objs, ram_shaft, portcullis, pennant, arm_obj)
    author_durg_animations(arm_obj)

    # Save .blend file
    blend_path = BLENDER_DIR / 'durg.blend'
    bpy.ops.wm.save_as_mainfile(filepath=str(blend_path))
    print(f"Saved Blender file: {blend_path}")

    # Export GLB with all actions
    glb_export_path = EXPORTS_DIR / 'wR.glb'
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
    shutil.copy2(glb_export_path, PUBLIC_DEV_DIR / 'wR.glb')
    print(f"Staged to web: {PUBLIC_DEV_DIR / 'wR.glb'}")

if __name__ == '__main__':
    main()
