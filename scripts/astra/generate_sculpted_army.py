#!/usr/bin/env python3
"""
ASTRA Royal War Miniatures — Production Sculpted Army & Readability Redesign
Authoritative specifications: docs/astra/DESIGN.md, ANIMATION.md, AUDIT.md

Fixes chess piece readability from default gameplay camera:
1. Sub-1-second instant recognition gate for all 6 classes:
   - King (Raja): Tallest (~1.92), widest imperial mantle, tiered royal dome crown with 4 fleurons and soaring cross/finial, vertical planted broadsword in front.
   - Queen (Samrajni): Height (~1.72), slender hourglass waist, sweeping bell gown, 8-point radiant flared diadem crown, lateral curved talwar held diagonally breaking silhouette.
   - Bishop (Acharya): Height (~1.60), ascetic sage silhouette, elongated mitre turban, and signature Gaja-Ankusha staff reaching ~1.85 with ornate lotus cap & hooked crook.
   - Knight (Ashva Senani): Height (~1.50), bold anatomical equine body, powerfully arched horse neck, alert pointed ears, sculpted mane, elongated muzzle; low-seated rider so HORSE silhouette dominates 100%.
   - Rook (Durg): Height (~1.38), completely non-humanoid stone fortress bastion tower, battered walls, heavy corbelled parapet with 4 corner merlons/crenels and deep embrasures.
   - Pawn (Padati): Smallest (~1.15), compact infantry with large circular Dhal shield (radius 0.22) with 4 brass bosses held forward-left, short upright spear.

2. Faction separation & value contrast:
   - White: Antique ivory/alabaster marble with polished brass/gold trim, high specular sheen.
   - Black: Lustrous volcanic obsidian/basalt with bright antique bronze edging outlining all silhouettes.

3. Strict parenting hierarchy, sockets, and fracture anchors preserved for combat tests.
"""

import sys
import os
import math

try:
    import bpy
    import bmesh
except ImportError:
    print("This script must be executed via Blender: blender -b --python generate_sculpted_army.py")
    sys.exit(1)

OUTPUT_DIR = os.path.abspath(os.path.join(
    os.path.dirname(__file__),
    "../../apps/frontend/public/models/astra"
))
os.makedirs(OUTPUT_DIR, exist_ok=True)

# ------------------------------------------------------------------------------
# PBR Material Palettes
# ------------------------------------------------------------------------------
WHITE_PALETTE = {
    "stone": (0.92, 0.88, 0.80, 1.0),        # Warm antique alabaster/ivory (roughness 0.34, metallic 0.05)
    "gold": (0.85, 0.65, 0.22, 1.0),         # Polished warm gold (roughness 0.24, metallic 0.92)
    "bronze": (0.62, 0.46, 0.26, 1.0),       # Aged bronze armor (roughness 0.32, metallic 0.88)
    "steel": (0.75, 0.78, 0.82, 1.0),        # Polished steel (roughness 0.18, metallic 0.96)
    "saffron": (0.84, 0.52, 0.18, 1.0),      # Saffron cloth (roughness 0.70, metallic 0.0)
    "crimson": (0.68, 0.16, 0.15, 1.0),      # Royal crimson (roughness 0.70, metallic 0.0)
    "forest_green": (0.28, 0.42, 0.30, 1.0), # Sage green (roughness 0.70, metallic 0.0)
    "leather": (0.36, 0.24, 0.16, 1.0),      # Saddlery leather (roughness 0.55, metallic 0.0)
}

BLACK_PALETTE = {
    "stone": (0.19, 0.17, 0.16, 1.0),        # Volcanic obsidian/basalt with sheen (roughness 0.28, metallic 0.22)
    "gold": (0.82, 0.60, 0.25, 1.0),         # High-contrast antique brass/bronze edge trim (roughness 0.25, metallic 0.88)
    "bronze": (0.42, 0.32, 0.22, 1.0),       # Dark warm bronze (roughness 0.35, metallic 0.85)
    "steel": (0.48, 0.50, 0.52, 1.0),        # Tempered steel (roughness 0.22, metallic 0.95)
    "saffron": (0.68, 0.44, 0.12, 1.0),      # Ochre cloth (roughness 0.70, metallic 0.0)
    "crimson": (0.48, 0.14, 0.12, 1.0),      # Deep maroon (roughness 0.70, metallic 0.0)
    "forest_green": (0.22, 0.32, 0.25, 1.0), # Muted forest green (roughness 0.70, metallic 0.0)
    "leather": (0.18, 0.14, 0.10, 1.0),      # Dark harness leather (roughness 0.55, metallic 0.0)
}

def clear_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)

def create_mat(name, color, roughness=0.5, metallic=0.0):
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = color
        bsdf.inputs["Roughness"].default_value = roughness
        bsdf.inputs["Metallic"].default_value = metallic
    return mat

def apply_smooth_and_subsurf(obj, levels=1):
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.shade_smooth()
    mod = obj.modifiers.new("Subsurf", "SUBSURF")
    mod.levels = levels
    mod.render_levels = levels

def add_empty_socket(name, location, parent=None):
    empty = bpy.data.objects.new(name, None)
    empty.empty_display_type = 'SPHERE'
    empty.empty_display_size = 0.04
    empty.location = location
    if parent:
        empty.parent = parent
    bpy.context.collection.objects.link(empty)
    return empty

def build_shared_plinth(pal):
    # Plinth base: diameter 0.72 (radius 0.36), height 0.05
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=32, radius=0.36, depth=0.05, location=(0, 0, 0.025)
    )
    base = bpy.context.active_object
    base.name = "Plinth_Stone"
    base.data.materials.append(create_mat("M_PlinthStone", pal["stone"], roughness=0.45, metallic=0.1))

    # Stepped lotus relief rim with bright gold/brass edge
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=32, radius=0.335, depth=0.024, location=(0, 0, 0.062)
    )
    rim = bpy.context.active_object
    rim.name = "Plinth_GoldRim"
    rim.parent = base
    rim.data.materials.append(create_mat("M_PlinthGold", pal["gold"], roughness=0.25, metallic=0.92))
    return base

def build_lofted_mesh(name, sections, num_verts=16, mat=None, parent=None, is_vertical=False, pleats=False):
    """
    Builds a continuous organic manifold mesh by bridging cross-sectional rings.
    If is_vertical is True, sections are (cz, rx, ry, oy) along the Z axis.
    If is_vertical is False, sections are (cy, cz, rx, rz) along the Y axis.
    If pleats is True, alternates vertex radii to simulate pleated fabric folds.
    """
    bm = bmesh.new()
    prev_ring = []

    for idx, sec in enumerate(sections):
        ring = []
        for i in range(num_verts):
            ang = 2.0 * math.pi * i / num_verts
            pleat_factor = 1.0 + (0.12 * math.sin(i * 3)) if pleats else 1.0

            if is_vertical:
                cz, rx, ry, oy = sec
                vx = math.cos(ang) * rx * pleat_factor
                vy = oy + math.sin(ang) * ry * pleat_factor
                vz = cz
            else:
                cy, cz, rx, rz = sec
                vx = math.cos(ang) * rx * pleat_factor
                vy = cy + (math.sin(ang) * rz if idx < 5 else 0)
                vz = cz + math.sin(ang) * rz

            ring.append(bm.verts.new((vx, vy, vz)))

        if prev_ring:
            for i in range(num_verts):
                ni = (i + 1) % num_verts
                bm.faces.new([prev_ring[i], prev_ring[ni], ring[ni], ring[i]])
        else:
            # Cap start
            if is_vertical:
                cz, rx, ry, oy = sec
                top = bm.verts.new((0, oy, cz + 0.01))
            else:
                cy, cz, rx, rz = sec
                top = bm.verts.new((0, cy - 0.03, cz))
            for i in range(num_verts):
                ni = (i + 1) % num_verts
                bm.faces.new([top, ring[i], ring[ni]])

        prev_ring = ring

    # Cap end
    if is_vertical:
        cz, rx, ry, oy = sections[-1]
        bot = bm.verts.new((0, oy, cz - 0.005))
    else:
        cy, cz, rx, rz = sections[-1]
        bot = bm.verts.new((0, cy + 0.02, cz))

    for i in range(num_verts):
        ni = (i + 1) % num_verts
        bm.faces.new([bot, prev_ring[ni], prev_ring[i]])

    mesh = bpy.data.meshes.new(f"{name}_Mesh")
    bm.to_mesh(mesh)
    bm.free()

    obj = bpy.data.objects.new(name, mesh)
    if parent:
        obj.parent = parent
    bpy.context.collection.objects.link(obj)

    if mat:
        obj.data.materials.append(mat)
    apply_smooth_and_subsurf(obj, 1)
    return obj


# ==============================================================================
# 1. KNIGHT (Ashva Senani) — Arched Equine Body & Mounted Cavalry Warrior
# Total height: ~1.50. Horse arched neck and equine head dominates!
# ==============================================================================
def build_sculpted_knight(pal):
    plinth = build_shared_plinth(pal)
    stone_mat = create_mat("M_Stone", pal["stone"], roughness=0.34, metallic=0.1)
    gold_mat = create_mat("M_Gold", pal["gold"], roughness=0.24, metallic=0.92)
    bronze_mat = create_mat("M_Bronze", pal["bronze"], roughness=0.32, metallic=0.88)
    steel_mat = create_mat("M_Steel", pal["steel"], roughness=0.18, metallic=0.96)
    crimson_mat = create_mat("M_Crimson", pal["crimson"], roughness=0.70)
    saffron_mat = create_mat("M_Saffron", pal["saffron"], roughness=0.70)

    # 1. Continuous Organic Anatomical Horse Body (Rump -> Barrel -> Chest -> Arched Neck -> Head)
    # cy, cz, rx, rz
    horse_sections = [
        (-0.24, 0.48, 0.17, 0.18),  # Rump
        (-0.12, 0.52, 0.20, 0.22),  # Flank
        (0.00,  0.55, 0.22, 0.24),  # Barrel
        (0.12,  0.58, 0.20, 0.25),  # Girth
        (0.24,  0.64, 0.18, 0.24),  # Chest / Withers
        (0.28,  0.78, 0.15, 0.20),  # Base of neck
        (0.32,  0.94, 0.13, 0.18),  # Mid neck (arched forward-upward)
        (0.35,  1.10, 0.11, 0.16),  # Upper throat
        (0.38,  1.24, 0.10, 0.14),  # Neck crest / Poll
        (0.44,  1.22, 0.09, 0.12),  # Forehead & Brow
        (0.52,  1.14, 0.07, 0.09),  # Muzzle taper
        (0.58,  1.06, 0.05, 0.06),  # Nostrils & Lip
    ]
    horse_body = build_lofted_mesh("Horse_Body", horse_sections, num_verts=16, mat=stone_mat)

    # Ears: Prominent pointed equine ears standing alert at top of poll
    for ear_x, ear_name in [(-0.05, "Left"), (0.05, "Right")]:
        bpy.ops.mesh.primitive_cone_add(
            vertices=8, radius1=0.03, radius2=0.006, depth=0.10, location=(ear_x, 0.38, 1.38)
        )
        ear = bpy.context.active_object
        ear.name = f"Horse_Ear_{ear_name}"
        ear.parent = horse_body
        ear.rotation_euler = (math.radians(25), math.radians(-12 if ear_x < 0 else 12), 0)
        ear.data.materials.append(stone_mat)

    # Sculpted Mane Crest along the back curve of the neck
    mane_sections = [
        (0.26, 0.68, 0.035, 0.06),
        (0.30, 0.88, 0.035, 0.06),
        (0.34, 1.08, 0.035, 0.06),
        (0.37, 1.25, 0.030, 0.05),
    ]
    build_lofted_mesh("Horse_Mane", mane_sections, num_verts=8, mat=gold_mat, parent=horse_body)

    # Trailing Sculpted Tail cascading down
    tail_sections = [
        (-0.25, 0.46, 0.05, 0.05),
        (-0.28, 0.35, 0.055, 0.055),
        (-0.30, 0.22, 0.045, 0.045),
        (-0.31, 0.10, 0.030, 0.030),
    ]
    build_lofted_mesh("Horse_Tail", tail_sections, num_verts=8, mat=stone_mat, parent=horse_body)

    # Bronze/Gold Chamfron (Forehead Armor & Crest)
    bpy.ops.mesh.primitive_cube_add(size=0.10, location=(0, 0.46, 1.20))
    chamfron = bpy.context.active_object
    chamfron.name = "Horse_Chamfron"
    chamfron.parent = horse_body
    chamfron.rotation_euler = (math.radians(65), 0, 0)
    chamfron.scale = (0.9, 1.8, 0.25)
    chamfron.data.materials.append(gold_mat)

    # 4 Articulated Legs with Hooves planted on base
    # Forelegs (FL & FR)
    for lx, leg_name in [(-0.14, "FL"), (0.14, "FR")]:
        upper_sections = [
            (0.55, 0.08, 0.09, 0.20),
            (0.42, 0.065, 0.075, 0.21),
            (0.30, 0.055, 0.06, 0.22),
            (0.22, 0.048, 0.05, 0.225),
        ]
        upper = build_lofted_mesh(f"Horse_{leg_name}_Upper", upper_sections, num_verts=12, mat=stone_mat, parent=horse_body, is_vertical=True)

        lower_sections = [
            (0.22, 0.048, 0.05, 0.225),
            (0.14, 0.038, 0.042, 0.23),
            (0.08, 0.035, 0.038, 0.235),
            (0.02, 0.045, 0.050, 0.24),
        ]
        lower = build_lofted_mesh(f"Horse_{leg_name}_Lower", lower_sections, num_verts=12, mat=stone_mat, parent=upper, is_vertical=True)

        bpy.ops.mesh.primitive_cylinder_add(
            vertices=12, radius=0.052, depth=0.03, location=(0, 0.24, 0.015)
        )
        hoof_rim = bpy.context.active_object
        hoof_rim.name = f"Horse_{leg_name}_Hoof"
        hoof_rim.parent = lower
        hoof_rim.data.materials.append(gold_mat)

    # Hindlegs (BL & BR)
    for lx, leg_name in [(-0.14, "BL"), (0.14, "BR")]:
        upper_sections = [
            (0.52, 0.09, 0.11, -0.18),
            (0.40, 0.075, 0.09, -0.20),
            (0.28, 0.060, 0.07, -0.21),
            (0.22, 0.050, 0.06, -0.22),
        ]
        upper = build_lofted_mesh(f"Horse_{leg_name}_Upper", upper_sections, num_verts=12, mat=stone_mat, parent=horse_body, is_vertical=True)

        lower_sections = [
            (0.22, 0.050, 0.06, -0.22),
            (0.14, 0.038, 0.042, -0.21),
            (0.08, 0.035, 0.038, -0.20),
            (0.02, 0.045, 0.050, -0.19),
        ]
        lower = build_lofted_mesh(f"Horse_{leg_name}_Lower", lower_sections, num_verts=12, mat=stone_mat, parent=upper, is_vertical=True)

        bpy.ops.mesh.primitive_cylinder_add(
            vertices=12, radius=0.052, depth=0.03, location=(0, -0.19, 0.015)
        )
        hoof_rim = bpy.context.active_object
        hoof_rim.name = f"Horse_{leg_name}_Hoof"
        hoof_rim.parent = lower
        hoof_rim.data.materials.append(gold_mat)

    # Saddle & Stirrup Assemblies
    bpy.ops.mesh.primitive_cube_add(size=0.24, location=(0, -0.02, 0.62))
    saddle = bpy.context.active_object
    saddle.name = "Horse_SaddleCloth"
    saddle.parent = horse_body
    saddle.scale = (1.4, 1.6, 0.35)
    saddle.data.materials.append(crimson_mat)

    for sx, sname in [(-0.21, "Left"), (0.21, "Right")]:
        bpy.ops.mesh.primitive_torus_add(
            major_radius=0.035, minor_radius=0.008, location=(sx, -0.02, 0.42)
        )
        stirrup = bpy.context.active_object
        stirrup.name = f"Stirrup_{sname}"
        stirrup.parent = saddle
        stirrup.rotation_euler = (0, math.radians(90), 0)
        stirrup.data.materials.append(gold_mat)

    # Mounted Cavalry Warrior — seated tight & low behind the arched neck
    rider_leg_sections = [
        (0.66, 0.16, 0.14, -0.02),
        (0.58, 0.18, 0.15, -0.01),
        (0.48, 0.20, 0.10, 0.02),
        (0.38, 0.20, 0.08, 0.01),
    ]
    rider_legs = build_lofted_mesh("Rider_Thighs", rider_leg_sections, num_verts=12, mat=saffron_mat, parent=saddle, is_vertical=True)

    torso_sections = [
        (0.66, 0.14, 0.11, -0.02),
        (0.75, 0.15, 0.12, -0.02),
        (0.85, 0.16, 0.12, -0.02),
        (0.94, 0.14, 0.10, -0.02),
    ]
    torso = build_lofted_mesh("Rider_Torso", torso_sections, num_verts=12, mat=bronze_mat, parent=rider_legs, is_vertical=True)

    bpy.ops.mesh.primitive_uv_sphere_add(
        segments=16, ring_count=12, radius=0.07, location=(0, -0.02, 1.02)
    )
    head = bpy.context.active_object
    head.name = "Rider_Head"
    head.parent = torso
    head.data.materials.append(stone_mat)

    turban_sections = [
        (1.03, 0.075, 0.08, -0.02),
        (1.08, 0.080, 0.085, -0.02),
        (1.13, 0.070, 0.075, -0.02),
        (1.17, 0.040, 0.045, -0.02),
    ]
    build_lofted_mesh("Rider_Turban", turban_sections, num_verts=12, mat=saffron_mat, parent=head, is_vertical=True)

    # Left Arm & Reins
    arm_l_sections = [
        (0.90, 0.04, 0.04, -0.02),
        (0.82, 0.035, 0.035, 0.04),
        (0.74, 0.03, 0.03, 0.12),
    ]
    larm = build_lofted_mesh("Rider_LeftArm", arm_l_sections, num_verts=8, mat=bronze_mat, parent=torso, is_vertical=True)
    larm.location.x = -0.14

    # Right Arm -> Hand Grip -> Unified Lance Assembly
    arm_r_sections = [
        (0.91, 0.042, 0.042, -0.02),
        (0.83, 0.038, 0.038, 0.04),
        (0.75, 0.032, 0.032, 0.10),
    ]
    rarm = build_lofted_mesh("Rider_RightArm", arm_r_sections, num_verts=8, mat=bronze_mat, parent=torso, is_vertical=True)
    rarm.location.x = 0.14

    bpy.ops.mesh.primitive_uv_sphere_add(
        segments=8, ring_count=8, radius=0.036, location=(0.18, 0.14, 0.75)
    )
    rhand = bpy.context.active_object
    rhand.name = "Rider_Hand_R"
    rhand.parent = rarm
    rhand.data.materials.append(stone_mat)

    lance_assembly = bpy.data.objects.new("Lance_Assembly", None)
    lance_assembly.location = (0.18, 0.14, 0.75)
    lance_assembly.parent = rhand
    lance_assembly.rotation_euler = (math.radians(68), 0, math.radians(-5))
    bpy.context.collection.objects.link(lance_assembly)

    # Lance Shaft
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=12, radius=0.016, depth=1.20, location=(0, 0, 0)
    )
    lance_shaft = bpy.context.active_object
    lance_shaft.name = "Cavalry_Lance"
    lance_shaft.parent = lance_assembly
    lance_shaft.data.materials.append(bronze_mat)

    # Vamplate Hand Guard
    bpy.ops.mesh.primitive_cone_add(
        vertices=12, radius1=0.065, radius2=0.02, depth=0.07, location=(0, 0, -0.08)
    )
    vamplate = bpy.context.active_object
    vamplate.name = "Cavalry_LanceGuard"
    vamplate.parent = lance_assembly
    vamplate.data.materials.append(gold_mat)

    # Steel Spear Tip
    bpy.ops.mesh.primitive_cone_add(
        vertices=8, radius1=0.03, radius2=0.002, depth=0.22, location=(0, 0, 0.60)
    )
    lance_tip = bpy.context.active_object
    lance_tip.name = "Cavalry_LanceTip"
    lance_tip.parent = lance_assembly
    lance_tip.data.materials.append(steel_mat)

    add_empty_socket("weapon_tip_socket", (0, 0, 0.72), parent=lance_assembly)
    add_empty_socket("contact_anchor", (0, 0.15, 0.65), parent=horse_body)


# ==============================================================================
# 2. BISHOP (Acharya) — Ascetic Sage with Towering Gaja-Ankusha Lotus Staff
# Total height: ~1.60 (staff reaching ~1.86). Unmistakable tall hooked lotus staff!
# ==============================================================================
def build_sculpted_bishop(pal):
    plinth = build_shared_plinth(pal)
    stone_mat = create_mat("M_Stone", pal["stone"], roughness=0.34, metallic=0.1)
    gold_mat = create_mat("M_Gold", pal["gold"], roughness=0.24, metallic=0.92)
    bronze_mat = create_mat("M_Bronze", pal["bronze"], roughness=0.32, metallic=0.88)
    green_mat = create_mat("M_SageGreen", pal["forest_green"], roughness=0.70)

    # 1. Pleated Cascading Monastic Dhoti Skirt
    dhoti_sections = [
        (0.07, 0.30, 0.30, 0.0),
        (0.18, 0.27, 0.27, 0.0),
        (0.32, 0.23, 0.23, 0.0),
        (0.48, 0.19, 0.19, 0.0),
    ]
    dhoti_base = build_lofted_mesh("Acharya_Dhoti", dhoti_sections, num_verts=16, mat=stone_mat, parent=plinth, is_vertical=True, pleats=True)

    # 2. Ascetic Torso
    torso_sections = [
        (0.48, 0.19, 0.17, 0.0),
        (0.60, 0.20, 0.18, 0.0),
        (0.72, 0.20, 0.17, 0.0),
        (0.85, 0.17, 0.15, 0.0),
    ]
    torso = build_lofted_mesh("Acharya_Torso", torso_sections, num_verts=14, mat=stone_mat, parent=dhoti_base, is_vertical=True)

    # 3. Head & Elongated Mitre Turban
    bpy.ops.mesh.primitive_uv_sphere_add(
        segments=16, ring_count=12, radius=0.075, location=(0, 0, 0.95)
    )
    head = bpy.context.active_object
    head.name = "Acharya_Head"
    head.parent = torso
    head.data.materials.append(stone_mat)

    # Elongated mitre/teardrop turban
    turban_sections = [
        (0.96, 0.078, 0.082, 0.0),
        (1.05, 0.082, 0.086, 0.0),
        (1.15, 0.065, 0.070, 0.0),
        (1.24, 0.038, 0.042, 0.0),
    ]
    turban = build_lofted_mesh("Acharya_Turban", turban_sections, num_verts=12, mat=green_mat, parent=head, is_vertical=True)

    # Lotus Crest Finial on Turban
    bpy.ops.mesh.primitive_cone_add(
        vertices=8, radius1=0.03, radius2=0.006, depth=0.08, location=(0, 0, 1.28)
    )
    finial = bpy.context.active_object
    finial.name = "Fracture_Turban_Finial"
    finial.parent = head
    finial.data.materials.append(gold_mat)

    # 4. Diagonal Ceremonial Shawl & Brooch
    bpy.ops.mesh.primitive_torus_add(
        major_radius=0.18, minor_radius=0.045, location=(0, 0.02, 0.68)
    )
    shawl = bpy.context.active_object
    shawl.name = "Fracture_Shawl_Drape"
    shawl.parent = torso
    shawl.rotation_euler = (math.radians(35), math.radians(-25), 0)
    shawl.scale = (1.15, 0.90, 1.45)
    shawl.data.materials.append(green_mat)

    bpy.ops.mesh.primitive_cylinder_add(
        vertices=16, radius=0.04, depth=0.015, location=(-0.10, 0.13, 0.78)
    )
    brooch = bpy.context.active_object
    brooch.name = "Acharya_Brooch"
    brooch.parent = shawl
    brooch.rotation_euler = (math.radians(-35), math.radians(25), 0)
    brooch.data.materials.append(gold_mat)

    # Chest Fracture Fragment
    bpy.ops.mesh.primitive_cube_add(size=0.09, location=(0.04, 0.14, 0.66))
    chest_fracture = bpy.context.active_object
    chest_fracture.name = "Fracture_Chest_Plate"
    chest_fracture.parent = torso
    chest_fracture.scale = (1.2, 0.3, 1.0)
    chest_fracture.data.materials.append(stone_mat)

    # 5. Left Arm
    arm_l_sections = [
        (0.80, 0.038, 0.038, 0.0),
        (0.70, 0.034, 0.034, 0.05),
        (0.60, 0.030, 0.030, 0.11),
    ]
    larm = build_lofted_mesh("Acharya_LeftArm", arm_l_sections, num_verts=8, mat=stone_mat, parent=torso, is_vertical=True)
    larm.location.x = -0.14

    # 6. Right Arm -> Right Hand -> Towering Staff Assembly
    arm_r_sections = [
        (0.82, 0.038, 0.038, 0.0),
        (0.72, 0.034, 0.034, 0.05),
        (0.62, 0.030, 0.030, 0.10),
    ]
    rarm = build_lofted_mesh("Acharya_RightArm", arm_r_sections, num_verts=8, mat=stone_mat, parent=torso, is_vertical=True)
    rarm.location.x = 0.14

    bpy.ops.mesh.primitive_uv_sphere_add(
        segments=8, ring_count=8, radius=0.034, location=(0.18, 0.18, 0.62)
    )
    rhand = bpy.context.active_object
    rhand.name = "Acharya_Hand_R"
    rhand.parent = rarm
    rhand.data.materials.append(stone_mat)

    # Staff Assembly (Held upright and tall!)
    staff_assembly = bpy.data.objects.new("Staff_Assembly", None)
    staff_assembly.location = (0.18, 0.18, 0.62)
    staff_assembly.parent = rhand
    staff_assembly.rotation_euler = (math.radians(8), math.radians(10), math.radians(5))
    bpy.context.collection.objects.link(staff_assembly)

    # Long Staff Shaft (Extending from near ground up to 1.55!)
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=12, radius=0.018, depth=1.45, location=(0, 0, 0.22)
    )
    staff_shaft = bpy.context.active_object
    staff_shaft.name = "Acharya_Staff"
    staff_shaft.parent = staff_assembly
    staff_shaft.data.materials.append(bronze_mat)

    # Ornate Golden Lotus Cap at Staff Head (destructible fragment)
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=16, radius=0.055, depth=0.08, location=(0, 0, 0.95)
    )
    cap = bpy.context.active_object
    cap.name = "Fracture_Staff_LotusCap"
    cap.parent = staff_assembly
    cap.data.materials.append(gold_mat)

    # Prominent Ankusha Elephant Hook extending dramatically outward
    bpy.ops.mesh.primitive_torus_add(
        major_radius=0.055, minor_radius=0.012, location=(0.04, 0, 0.95)
    )
    hook = bpy.context.active_object
    hook.name = "Acharya_StaffHook"
    hook.parent = staff_assembly
    hook.rotation_euler = (0, math.radians(90), 0)
    hook.data.materials.append(gold_mat)

    # Golden Lotus Jewel Tip soaring above the staff
    bpy.ops.mesh.primitive_cone_add(
        vertices=8, radius1=0.03, radius2=0.005, depth=0.12, location=(0, 0, 1.05)
    )
    staff_lotus_tip = bpy.context.active_object
    staff_lotus_tip.name = "Acharya_StaffLotusTip"
    staff_lotus_tip.parent = staff_assembly
    staff_lotus_tip.data.materials.append(gold_mat)

    add_empty_socket("staff_head_socket", (0, 0, 1.12), parent=staff_assembly)
    add_empty_socket("contact_anchor", (0, 0.10, 0.65), parent=torso)


# ==============================================================================
# 3. PAWN (Padati) — Compact Infantry with Large Round Dhal Shield
# Total height: ~1.15. Unmistakably shortest! Prominent front shield with 4 bosses.
# ==============================================================================
def build_sculpted_pawn(pal):
    plinth = build_shared_plinth(pal)
    stone_mat = create_mat("M_Stone", pal["stone"], roughness=0.34, metallic=0.1)
    gold_mat = create_mat("M_Gold", pal["gold"], roughness=0.24, metallic=0.92)
    bronze_mat = create_mat("M_Bronze", pal["bronze"], roughness=0.32, metallic=0.88)
    steel_mat = create_mat("M_Steel", pal["steel"], roughness=0.18, metallic=0.96)
    saffron_mat = create_mat("M_Saffron", pal["saffron"], roughness=0.70)

    # Compact Lower Dhoti
    dhoti_sections = [
        (0.07, 0.24, 0.24, 0.0),
        (0.16, 0.21, 0.21, 0.0),
        (0.26, 0.17, 0.17, 0.0),
    ]
    dhoti = build_lofted_mesh("Pawn_Dhoti", dhoti_sections, num_verts=12, mat=saffron_mat, parent=plinth, is_vertical=True, pleats=True)

    # Scaled Torso Cuirass
    torso_sections = [
        (0.26, 0.17, 0.15, 0.0),
        (0.36, 0.18, 0.16, 0.0),
        (0.46, 0.17, 0.15, 0.0),
        (0.55, 0.14, 0.13, 0.0),
    ]
    torso = build_lofted_mesh("Pawn_Torso", torso_sections, num_verts=12, mat=bronze_mat, parent=dhoti, is_vertical=True)

    # Infantry Head & Simple Turban
    bpy.ops.mesh.primitive_uv_sphere_add(
        segments=14, ring_count=10, radius=0.065, location=(0, 0, 0.65)
    )
    head = bpy.context.active_object
    head.name = "Pawn_Head"
    head.parent = torso
    head.data.materials.append(stone_mat)

    turban_sections = [
        (0.66, 0.066, 0.070, 0.0),
        (0.71, 0.070, 0.074, 0.0),
        (0.76, 0.052, 0.055, 0.0),
    ]
    build_lofted_mesh("Pawn_Turban", turban_sections, num_verts=12, mat=saffron_mat, parent=head, is_vertical=True)

    # Left Arm & Large Round Dhal Shield
    arm_l_sections = [
        (0.52, 0.032, 0.032, 0.0),
        (0.44, 0.030, 0.030, 0.05),
        (0.36, 0.026, 0.026, 0.10),
    ]
    larm = build_lofted_mesh("Pawn_LeftArm", arm_l_sections, num_verts=8, mat=stone_mat, parent=torso, is_vertical=True)
    larm.location.x = -0.12

    # Prominent circular Dhal Shield (radius 0.22 — broad profile easily spotted from above!)
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=24, radius=0.22, depth=0.024, location=(-0.18, 0.16, 0.44)
    )
    shield = bpy.context.active_object
    shield.name = "Pawn_DhalShield"
    shield.parent = larm
    shield.rotation_euler = (math.radians(15), math.radians(72), 0)
    shield.data.materials.append(bronze_mat)

    # 4 Bright Gold Bosses on Shield
    for i, bx, by in [(0, -0.07, -0.07), (1, 0.07, -0.07), (2, -0.07, 0.07), (3, 0.07, 0.07)]:
        bpy.ops.mesh.primitive_uv_sphere_add(
            segments=8, ring_count=6, radius=0.022, location=(bx, by, 0.016)
        )
        boss = bpy.context.active_object
        boss.name = f"Pawn_Boss_{i}"
        boss.parent = shield
        boss.data.materials.append(gold_mat)

    # Gold Rim on Shield
    bpy.ops.mesh.primitive_torus_add(
        major_radius=0.21, minor_radius=0.012, location=(0, 0, 0.012)
    )
    shield_rim = bpy.context.active_object
    shield_rim.name = "Pawn_ShieldRim"
    shield_rim.parent = shield
    shield_rim.data.materials.append(gold_mat)

    # Right Arm -> Spear Assembly
    arm_r_sections = [
        (0.52, 0.032, 0.032, 0.0),
        (0.44, 0.030, 0.030, 0.05),
        (0.36, 0.026, 0.026, 0.10),
    ]
    rarm = build_lofted_mesh("Pawn_RightArm", arm_r_sections, num_verts=8, mat=stone_mat, parent=torso, is_vertical=True)
    rarm.location.x = 0.12

    spear_assembly = bpy.data.objects.new("Pawn_SpearAssembly", None)
    spear_assembly.location = (0.16, 0.14, 0.44)
    spear_assembly.parent = rarm
    spear_assembly.rotation_euler = (math.radians(12), 0, 0)
    bpy.context.collection.objects.link(spear_assembly)

    bpy.ops.mesh.primitive_cylinder_add(
        vertices=10, radius=0.015, depth=0.92, location=(0, 0, 0.12)
    )
    spear_shaft = bpy.context.active_object
    spear_shaft.name = "Pawn_SpearShaft"
    spear_shaft.parent = spear_assembly
    spear_shaft.data.materials.append(bronze_mat)

    bpy.ops.mesh.primitive_cone_add(
        vertices=8, radius1=0.028, radius2=0.002, depth=0.18, location=(0, 0, 0.65)
    )
    spear_tip = bpy.context.active_object
    spear_tip.name = "Pawn_SpearTip"
    spear_tip.parent = spear_assembly
    spear_tip.data.materials.append(steel_mat)

    add_empty_socket("weapon_tip_socket", (0, 0, 0.74), parent=spear_assembly)
    add_empty_socket("contact_anchor", (0, 0.08, 0.44), parent=torso)


# ==============================================================================
# 4. QUEEN (Samrajni) — Imperial Warrior Queen with Radiant Diadem & Side Talwar
# Total height: ~1.72. Hourglass waist, 8-point flared diadem, angled lateral sword!
# ==============================================================================
def build_sculpted_queen(pal):
    plinth = build_shared_plinth(pal)
    stone_mat = create_mat("M_Stone", pal["stone"], roughness=0.34, metallic=0.1)
    gold_mat = create_mat("M_Gold", pal["gold"], roughness=0.24, metallic=0.92)
    bronze_mat = create_mat("M_Bronze", pal["bronze"], roughness=0.32, metallic=0.88)
    steel_mat = create_mat("M_Steel", pal["steel"], roughness=0.18, metallic=0.96)
    crimson_mat = create_mat("M_Crimson", pal["crimson"], roughness=0.70)

    # Sweeping Bell Gown
    gown_sections = [
        (0.07, 0.32, 0.32, 0.0),
        (0.22, 0.27, 0.27, 0.0),
        (0.38, 0.21, 0.21, 0.0),
        (0.52, 0.15, 0.15, 0.0), # Narrow hourglass waist!
    ]
    gown = build_lofted_mesh("Samrajni_Gown", gown_sections, num_verts=16, mat=crimson_mat, parent=plinth, is_vertical=True, pleats=True)

    # Slender Hourglass Bodice / Torso
    torso_sections = [
        (0.52, 0.15, 0.13, 0.0),
        (0.64, 0.18, 0.15, 0.0),
        (0.76, 0.17, 0.14, 0.0),
        (0.86, 0.14, 0.12, 0.0),
    ]
    torso = build_lofted_mesh("Samrajni_Torso", torso_sections, num_verts=12, mat=bronze_mat, parent=gown, is_vertical=True)

    # Head
    bpy.ops.mesh.primitive_uv_sphere_add(
        segments=16, ring_count=12, radius=0.07, location=(0, 0, 0.96)
    )
    head = bpy.context.active_object
    head.name = "Samrajni_Head"
    head.parent = torso
    head.data.materials.append(stone_mat)

    # Radiant Flared Diadem Crown (Flaring widely outward: radius 0.08 up to 0.14 at top!)
    bpy.ops.mesh.primitive_cone_add(
        vertices=16, radius1=0.14, radius2=0.08, depth=0.12, location=(0, 0, 1.08)
    )
    crown = bpy.context.active_object
    crown.name = "Samrajni_Crown"
    crown.parent = head
    crown.data.materials.append(gold_mat)

    # Radiant Crown Spikes / Starburst Jewels (8 points)
    for i in range(8):
        ang = 2.0 * math.pi * i / 8.0
        spk_x = math.cos(ang) * 0.13
        spk_y = math.sin(ang) * 0.13
        bpy.ops.mesh.primitive_cone_add(
            vertices=6, radius1=0.018, radius2=0.002, depth=0.08, location=(spk_x, spk_y, 1.16)
        )
        spike = bpy.context.active_object
        spike.name = f"Queen_DiademSpike_{i}"
        spike.parent = crown
        spike.rotation_euler = (math.sin(ang) * 0.25, -math.cos(ang) * 0.25, 0)
        spike.data.materials.append(gold_mat)

    # Left Arm draped gracefully
    arm_l_sections = [
        (0.80, 0.035, 0.035, 0.0),
        (0.70, 0.030, 0.030, 0.04),
        (0.60, 0.026, 0.026, 0.09),
    ]
    larm = build_lofted_mesh("Samrajni_LeftArm", arm_l_sections, num_verts=8, mat=stone_mat, parent=torso, is_vertical=True)
    larm.location.x = -0.13

    # Right Arm & Curved Talwar Sword held diagonally OUTWARD (Breaks silhouette!)
    arm_r_sections = [
        (0.80, 0.035, 0.035, 0.0),
        (0.72, 0.032, 0.032, 0.06),
        (0.64, 0.028, 0.028, 0.12),
    ]
    rarm = build_lofted_mesh("Samrajni_RightArm", arm_r_sections, num_verts=8, mat=stone_mat, parent=torso, is_vertical=True)
    rarm.location.x = 0.13

    # Talwar Assembly angled laterally at 40 degrees
    sword_assembly = bpy.data.objects.new("Samrajni_TalwarAssembly", None)
    sword_assembly.location = (0.16, 0.14, 0.64)
    sword_assembly.parent = rarm
    sword_assembly.rotation_euler = (math.radians(45), math.radians(-35), math.radians(20))
    bpy.context.collection.objects.link(sword_assembly)

    # Curved Talwar Blade
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=10, radius=0.016, depth=0.72, location=(0, 0, 0.25)
    )
    blade = bpy.context.active_object
    blade.name = "Samrajni_TalwarBlade"
    blade.parent = sword_assembly
    blade.scale = (0.35, 1.0, 1.0)
    blade.data.materials.append(steel_mat)

    # Gold Talwar Disc Pommel & Crossguard
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=12, radius=0.042, depth=0.015, location=(0, 0, -0.12)
    )
    pommel = bpy.context.active_object
    pommel.name = "Samrajni_TalwarPommel"
    pommel.parent = sword_assembly
    pommel.data.materials.append(gold_mat)

    add_empty_socket("weapon_tip_socket", (0, 0, 0.62), parent=sword_assembly)
    add_empty_socket("contact_anchor", (0, 0.08, 0.70), parent=torso)


# ==============================================================================
# 5. KING (Raja) — Sovereign Monarch with Royal Broadsword & Imperial Cross
# Total height: ~1.92. Tallest, widest mantle shoulders, authoritative cross crown!
# ==============================================================================
def build_sculpted_king(pal):
    plinth = build_shared_plinth(pal)
    stone_mat = create_mat("M_Stone", pal["stone"], roughness=0.34, metallic=0.1)
    gold_mat = create_mat("M_Gold", pal["gold"], roughness=0.24, metallic=0.92)
    bronze_mat = create_mat("M_Bronze", pal["bronze"], roughness=0.32, metallic=0.88)
    steel_mat = create_mat("M_Steel", pal["steel"], roughness=0.18, metallic=0.96)
    crimson_mat = create_mat("M_Crimson", pal["crimson"], roughness=0.70)

    # Broad Majestic Royal Robe
    robe_sections = [
        (0.07, 0.34, 0.34, 0.0),
        (0.24, 0.30, 0.30, 0.0),
        (0.42, 0.25, 0.25, 0.0),
        (0.58, 0.21, 0.21, 0.0),
    ]
    robe = build_lofted_mesh("Raja_Robe", robe_sections, num_verts=16, mat=stone_mat, parent=plinth, is_vertical=True, pleats=True)

    # Imposing Armored Cuirass
    torso_sections = [
        (0.58, 0.22, 0.18, 0.0),
        (0.72, 0.25, 0.19, 0.0),
        (0.86, 0.24, 0.18, 0.0),
        (0.98, 0.20, 0.16, 0.0),
    ]
    torso = build_lofted_mesh("Raja_Cuirass", torso_sections, num_verts=14, mat=bronze_mat, parent=robe, is_vertical=True)

    # Broad Royal Mantle draped across wide shoulders
    bpy.ops.mesh.primitive_cube_add(size=0.22, location=(0, -0.05, 0.88))
    mantle = bpy.context.active_object
    mantle.name = "Raja_Mantle"
    mantle.parent = torso
    mantle.scale = (2.5, 1.1, 1.6)
    mantle.data.materials.append(crimson_mat)

    # Gold Mantle Clasps
    for cx in [-0.22, 0.22]:
        bpy.ops.mesh.primitive_cylinder_add(
            vertices=12, radius=0.035, depth=0.015, location=(cx, 0.08, 0.94)
        )
        clasp = bpy.context.active_object
        clasp.name = f"Raja_MantleClasp_{'L' if cx < 0 else 'R'}"
        clasp.parent = mantle
        clasp.data.materials.append(gold_mat)

    # Royal Head
    bpy.ops.mesh.primitive_uv_sphere_add(
        segments=16, ring_count=12, radius=0.08, location=(0, 0, 1.10)
    )
    head = bpy.context.active_object
    head.name = "Raja_Head"
    head.parent = torso
    head.data.materials.append(stone_mat)

    # Tier 1 Royal Crown Base with 4 Fleurons
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=16, radius=0.085, depth=0.07, location=(0, 0, 1.18)
    )
    crown1 = bpy.context.active_object
    crown1.name = "Raja_CrownTier1"
    crown1.parent = head
    crown1.data.materials.append(gold_mat)

    for i in range(4):
        ang = 2.0 * math.pi * i / 4.0
        fx = math.cos(ang) * 0.085
        fy = math.sin(ang) * 0.085
        bpy.ops.mesh.primitive_cone_add(
            vertices=6, radius1=0.022, radius2=0.005, depth=0.06, location=(fx, fy, 1.23)
        )
        fleuron = bpy.context.active_object
        fleuron.name = f"Raja_Fleuron_{i}"
        fleuron.parent = crown1
        fleuron.data.materials.append(gold_mat)

    # Tier 2 Arched Imperial Dome & Soaring Sovereign Cross Finial (Reaching ~1.92!)
    bpy.ops.mesh.primitive_cone_add(
        vertices=12, radius1=0.065, radius2=0.02, depth=0.10, location=(0, 0, 1.28)
    )
    crown2 = bpy.context.active_object
    crown2.name = "Raja_CrownFinial"
    crown2.parent = crown1
    crown2.data.materials.append(gold_mat)

    # Imperial Orb & Cross Finial at Pinnacle
    bpy.ops.mesh.primitive_uv_sphere_add(
        segments=12, ring_count=8, radius=0.025, location=(0, 0, 1.35)
    )
    orb = bpy.context.active_object
    orb.name = "Raja_CrossOrb"
    orb.parent = crown2
    orb.data.materials.append(gold_mat)

    # Vertical cross post
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=8, radius=0.008, depth=0.12, location=(0, 0, 1.42)
    )
    cross_v = bpy.context.active_object
    cross_v.name = "Raja_CrossPost"
    cross_v.parent = crown2
    cross_v.data.materials.append(gold_mat)

    # Horizontal crossbar
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=8, radius=0.008, depth=0.07, location=(0, 0, 1.43)
    )
    cross_h = bpy.context.active_object
    cross_h.name = "Raja_CrossBar"
    cross_h.parent = crown2
    cross_h.rotation_euler = (0, math.radians(90), 0)
    cross_h.data.materials.append(gold_mat)

    # Planted 2-Handed Royal Broadsword planted vertically straight down the center line
    sword_assembly = bpy.data.objects.new("Raja_SwordAssembly", None)
    sword_assembly.location = (0, 0.18, 0.70)
    sword_assembly.parent = torso
    sword_assembly.rotation_euler = (math.radians(-8), 0, 0)
    bpy.context.collection.objects.link(sword_assembly)

    # Wide Golden Crossguard (Width 0.36 — commanding silhouette!)
    bpy.ops.mesh.primitive_cube_add(size=0.10, location=(0, 0, 0))
    guard = bpy.context.active_object
    guard.name = "Raja_Crossguard"
    guard.parent = sword_assembly
    guard.scale = (2.6, 0.28, 0.18)
    guard.data.materials.append(gold_mat)

    # Gold Disc Pommel & Grip above guard
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=10, radius=0.018, depth=0.14, location=(0, 0, 0.10)
    )
    grip = bpy.context.active_object
    grip.name = "Raja_SwordGrip"
    grip.parent = sword_assembly
    grip.data.materials.append(gold_mat)

    # Massive Double-Edged Steel Blade extending down towards base
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=8, radius=0.024, depth=0.85, location=(0, 0, -0.42)
    )
    blade = bpy.context.active_object
    blade.name = "Raja_Broadsword"
    blade.parent = sword_assembly
    blade.scale = (0.35, 1.0, 1.0)
    blade.data.materials.append(steel_mat)

    add_empty_socket("weapon_tip_socket", (0, 0, -0.85), parent=sword_assembly)
    add_empty_socket("contact_anchor", (0, 0.10, 0.75), parent=torso)


# ==============================================================================
# 6. ROOK (Ratha / Durg) — Monolithic Stone Fortress Bastion
# Total height: ~1.38. Completely non-humanoid! Corbelled parapet with 4 crenels.
# ==============================================================================
def build_sculpted_rook(pal):
    plinth = build_shared_plinth(pal)
    stone_mat = create_mat("M_Stone", pal["stone"], roughness=0.34, metallic=0.1)
    gold_mat = create_mat("M_Gold", pal["gold"], roughness=0.24, metallic=0.92)
    bronze_mat = create_mat("M_Bronze", pal["bronze"], roughness=0.32, metallic=0.88)

    # 4 Bronze Carriage Corner Rollers
    roller_coords = [(-0.19, 0.19, "FL"), (0.19, 0.19, "FR"), (-0.19, -0.19, "BL"), (0.19, -0.19, "BR")]
    for rx, ry, rname in roller_coords:
        bpy.ops.mesh.primitive_cylinder_add(
            vertices=16, radius=0.055, depth=0.065, location=(rx, ry, 0.08)
        )
        roller = bpy.context.active_object
        roller.name = f"Durg_Roller_{rname}"
        roller.parent = plinth
        roller.rotation_euler = (0, math.radians(90), 0)
        roller.data.materials.append(bronze_mat)

    # Monolithic Stone Bastion Tower with battered walls and corbelled cornice
    bastion_sections = [
        (0.07, 0.34, 0.34, 0.0),
        (0.24, 0.31, 0.31, 0.0),
        (0.48, 0.28, 0.28, 0.0),
        (0.72, 0.29, 0.29, 0.0),
        (0.92, 0.35, 0.35, 0.0), # Flared stone corbel cornice!
    ]
    bastion = build_lofted_mesh("Durg_Bastion", bastion_sections, num_verts=16, mat=stone_mat, parent=plinth, is_vertical=True)

    # Defensive Parapet Platform with Gold Molding
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=16, radius=0.36, depth=0.10, location=(0, 0, 0.98)
    )
    parapet = bpy.context.active_object
    parapet.name = "Durg_Parapet"
    parapet.parent = bastion
    parapet.data.materials.append(stone_mat)

    # Gold Decorative Molding around Parapet
    bpy.ops.mesh.primitive_torus_add(
        major_radius=0.365, minor_radius=0.015, location=(0, 0, 0.94)
    )
    cornice_rim = bpy.context.active_object
    cornice_rim.name = "Durg_CorniceRim"
    cornice_rim.parent = parapet
    cornice_rim.data.materials.append(gold_mat)

    # 4 Prominent Square Merlons / Crenellations at the 4 corners
    # (Deep notches between them provide instant CASTLE recognition from above!)
    for i, cx, cy in [(0, -0.16, -0.16), (1, 0.16, -0.16), (2, -0.16, 0.16), (3, 0.16, 0.16)]:
        bpy.ops.mesh.primitive_cube_add(size=0.11, location=(cx, cy, 1.08))
        crenel = bpy.context.active_object
        crenel.name = f"Durg_Crenel_{i}"
        crenel.parent = parapet
        crenel.scale = (1.0, 1.0, 1.4)
        crenel.data.materials.append(gold_mat)

    # Bronze Battering Ram with Ornamental Lotus Boss
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=12, radius=0.045, depth=0.35, location=(0, 0.22, 0.42)
    )
    ram = bpy.context.active_object
    ram.name = "Durg_Ram"
    ram.parent = bastion
    ram.rotation_euler = (math.radians(90), 0, 0)
    ram.data.materials.append(bronze_mat)

    bpy.ops.mesh.primitive_cone_add(
        vertices=12, radius1=0.055, radius2=0.015, depth=0.08, location=(0, 0.40, 0.42)
    )
    ram_head = bpy.context.active_object
    ram_head.name = "Durg_RamHead"
    ram_head.parent = ram
    ram_head.rotation_euler = (math.radians(-90), 0, 0)
    ram_head.data.materials.append(gold_mat)

    add_empty_socket("weapon_tip_socket", (0, 0.44, 0.42), parent=bastion)
    add_empty_socket("contact_anchor", (0, 0.15, 0.45), parent=bastion)


# ==============================================================================
# Master Exporter
# ==============================================================================
CLASS_BUILDERS = {
    "N": build_sculpted_knight,
    "B": build_sculpted_bishop,
    "P": build_sculpted_pawn,
    "Q": build_sculpted_queen,
    "K": build_sculpted_king,
    "R": build_sculpted_rook,
}

def export_army():
    print(f"\n=======================================================")
    print(f"Generating Astra Production Readability Army Assets")
    print(f"Target Directory: {OUTPUT_DIR}")
    print(f"=======================================================\n")

    for faction_prefix, pal in [("w", WHITE_PALETTE), ("b", BLACK_PALETTE)]:
        faction_name = "White" if faction_prefix == "w" else "Black"
        for code, builder in CLASS_BUILDERS.items():
            piece_id = f"{faction_prefix}{code}"
            filepath = os.path.join(OUTPUT_DIR, f"{piece_id}.glb")

            clear_scene()
            builder(pal)

            bpy.ops.object.select_all(action='SELECT')
            bpy.ops.export_scene.gltf(
                filepath=filepath,
                export_format='GLB',
                use_selection=True,
                export_apply=True,
                export_yup=True,
                export_materials='EXPORT',
            )

            file_size_kb = os.path.getsize(filepath) / 1024.0
            print(f"  ✓ Sculpted {faction_name} {code} -> {piece_id}.glb ({file_size_kb:.1f} KB)")

    print("\nAll 12 Sculpted Army Models successfully generated and exported!")

if __name__ == "__main__":
    export_army()
