#!/usr/bin/env python3
"""
ASTRA Royal War Miniatures — Procedural 3D Army Generator & Blender GLB Pipeline
Authoritative specification: docs/astra/DESIGN.md, ANIMATION.md, PRODUCTION.md

Generates verified, production-calibrated glTF/GLB models for all 6 piece classes
in both White and Black factions with proper materials, plinths, and scale.
"""

import sys
import os
import math

try:
    import bpy
except ImportError:
    print("This script must be executed via Blender: blender -b --python generate_army_models.py")
    sys.exit(1)

OUTPUT_DIR = os.path.abspath(os.path.join(
    os.path.dirname(__file__),
    "../../apps/frontend/public/models/astra"
))
os.makedirs(OUTPUT_DIR, exist_ok=True)

# Astra Color Palettes (sRGB converted to linear RGB for Blender Principled BSDF)
def hex_to_linear(hex_str):
    hex_clean = hex_str.lstrip('#')
    r = int(hex_clean[0:2], 16) / 255.0
    g = int(hex_clean[2:4], 16) / 255.0
    b = int(hex_clean[4:6], 16) / 255.0
    # sRGB to linear conversion
    to_lin = lambda c: c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    return (to_lin(r), to_lin(g), to_lin(b), 1.0)

WHITE_PALETTE = {
    "primary": hex_to_linear("#E8DDC5"),      # Warm ivory stone
    "gold": hex_to_linear("#B68A3E"),         # Brushed gold
    "bronze": hex_to_linear("#82613D"),       # Aged bronze
    "saffron": hex_to_linear("#C67E2E"),      # Saffron
    "crimson": hex_to_linear("#8D302B"),      # Crimson
    "forest_green": hex_to_linear("#3E5943"), # Forest green
    "steel": hex_to_linear("#89908B"),        # Steel blade
}

BLACK_PALETTE = {
    "primary": hex_to_linear("#261C14"),      # Dark basalt stone
    "gold": hex_to_linear("#82613D"),         # Aged bronze/brass
    "bronze": hex_to_linear("#3A3D40"),       # Blackened steel
    "saffron": hex_to_linear("#996515"),      # Ochre
    "crimson": hex_to_linear("#5C1D18"),      # Maroon
    "forest_green": hex_to_linear("#2F4335"), # Muted green
    "steel": hex_to_linear("#4F5255"),        # Dark tempered steel
}

def clear_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)

def create_material(name, color, roughness=0.5, metallic=0.0):
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    bsdf = nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = color
        bsdf.inputs["Roughness"].default_value = roughness
        bsdf.inputs["Metallic"].default_value = metallic
    return mat

def create_shared_plinth(pal):
    # Base diameter .68S -> radius .34S, height .07S
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=32,
        radius=0.34,
        depth=0.05,
        location=(0, 0, 0.025)
    )
    base = bpy.context.active_object
    base.name = "Plinth_Lower"
    base.data.materials.append(create_material("Mat_PlinthLower", pal["primary"], roughness=0.6))

    # Stepped upper bevel rim
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=32,
        radius=0.31,
        depth=0.02,
        location=(0, 0, 0.06)
    )
    rim = bpy.context.active_object
    rim.name = "Plinth_Rim"
    rim.data.materials.append(create_material("Mat_PlinthGold", pal["gold"], roughness=0.35, metallic=0.9))

# 1. Pawn (Padati, Height .69S)
def build_pawn(pal):
    create_shared_plinth(pal)

    # Legs & Dhoti
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=16, radius=0.12, depth=0.18, location=(0, 0, 0.16)
    )
    dhoti = bpy.context.active_object
    dhoti.name = "Pawn_Dhoti"
    dhoti.data.materials.append(create_material("Mat_PawnSash", pal["saffron"], roughness=0.7))

    # Armored Cuirass Torso
    bpy.ops.mesh.primitive_cone_add(
        vertices=16, radius1=0.15, radius2=0.11, depth=0.22, location=(0, 0, 0.33)
    )
    torso = bpy.context.active_object
    torso.name = "Pawn_Torso"
    torso.data.materials.append(create_material("Mat_PawnArmor", pal["bronze"], roughness=0.45, metallic=0.8))

    # Carved Ivory Head
    bpy.ops.mesh.primitive_uv_sphere_add(
        segments=16, ring_count=12, radius=0.08, location=(0, 0, 0.49)
    )
    head = bpy.context.active_object
    head.name = "Pawn_Head"
    head.data.materials.append(create_material("Mat_PawnIvory", pal["primary"], roughness=0.6))

    # Turban with Pointed Crest
    bpy.ops.mesh.primitive_cone_add(
        vertices=16, radius1=0.085, radius2=0.01, depth=0.14, location=(0, 0, 0.60)
    )
    crest = bpy.context.active_object
    crest.name = "Pawn_Helmet"
    crest.data.materials.append(create_material("Mat_PawnGold", pal["gold"], roughness=0.35, metallic=0.9))

    # Circular Dhal Shield (Left arm)
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=24, radius=0.12, depth=0.02, location=(-0.16, 0.05, 0.34)
    )
    shield = bpy.context.active_object
    shield.name = "Pawn_Shield"
    shield.rotation_euler = (0, math.radians(70), 0)
    shield.data.materials.append(create_material("Mat_ShieldBronze", pal["bronze"], roughness=0.4, metallic=0.85))

    # Shield Boss (Center)
    bpy.ops.mesh.primitive_uv_sphere_add(
        segments=12, ring_count=8, radius=0.03, location=(-0.17, 0.05, 0.34)
    )
    boss = bpy.context.active_object
    boss.name = "Pawn_ShieldBoss"
    boss.data.materials.append(create_material("Mat_BossGold", pal["gold"], roughness=0.3, metallic=0.95))

    # Steel Infantry Spear (Right hand)
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=8, radius=0.012, depth=0.65, location=(0.14, 0.04, 0.45)
    )
    spear_shaft = bpy.context.active_object
    spear_shaft.name = "Pawn_SpearShaft"
    spear_shaft.data.materials.append(create_material("Mat_SpearWood", pal["bronze"], roughness=0.6))

    # Spear Blade Tip
    bpy.ops.mesh.primitive_cone_add(
        vertices=8, radius1=0.025, radius2=0.001, depth=0.12, location=(0.14, 0.04, 0.81)
    )
    spear_tip = bpy.context.active_object
    spear_tip.name = "Pawn_SpearTip"
    spear_tip.data.materials.append(create_material("Mat_SpearSteel", pal["steel"], roughness=0.25, metallic=0.95))

# 2. Rook (Durg, Height .72S)
def build_rook(pal):
    create_shared_plinth(pal)

    # Octagonal Fortified Stone Bastion Body
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=8, radius=0.28, depth=0.48, location=(0, 0, 0.31)
    )
    tower = bpy.context.active_object
    tower.name = "Durg_Tower"
    tower.data.materials.append(create_material("Mat_DurgStone", pal["primary"], roughness=0.7))

    # Corner Buttresses
    for i in range(4):
        angle = i * (math.pi / 2) + (math.pi / 4)
        x = math.cos(angle) * 0.24
        y = math.sin(angle) * 0.24
        bpy.ops.mesh.primitive_cube_add(
            size=0.08, location=(x, y, 0.24)
        )
        buttress = bpy.context.active_object
        buttress.name = f"Durg_Buttress_{i}"
        buttress.scale = (1.0, 1.0, 3.2)
        buttress.data.materials.append(create_material("Mat_DurgBronze", pal["bronze"], roughness=0.45, metallic=0.8))

    # Crenellated Battlements Ring (Top)
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=16, radius=0.30, depth=0.12, location=(0, 0, 0.60)
    )
    parapet = bpy.context.active_object
    parapet.name = "Durg_Parapet"
    parapet.data.materials.append(create_material("Mat_DurgStoneTop", pal["primary"], roughness=0.65))

    # Crenellation Teeth
    for i in range(8):
        angle = i * (math.pi / 4)
        x = math.cos(angle) * 0.28
        y = math.sin(angle) * 0.28
        bpy.ops.mesh.primitive_cube_add(
            size=0.06, location=(x, y, 0.69)
        )
        tooth = bpy.context.active_object
        tooth.name = f"Durg_Crenel_{i}"
        tooth.data.materials.append(create_material("Mat_DurgGold", pal["gold"], roughness=0.35, metallic=0.9))

    # Forward Bronze Battering Ram & Gate
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=12, radius=0.06, depth=0.18, location=(0, 0.24, 0.22)
    )
    ram = bpy.context.active_object
    ram.name = "Durg_Ram"
    ram.rotation_euler = (math.radians(90), 0, 0)
    ram.data.materials.append(create_material("Mat_DurgRam", pal["steel"], roughness=0.3, metallic=0.9))

# 3. Knight (Ashva Senani, Height .86S)
def build_knight(pal):
    create_shared_plinth(pal)

    # Armored War Horse Torso & Rump
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=16, radius=0.16, depth=0.32, location=(0, -0.04, 0.24)
    )
    horse_body = bpy.context.active_object
    horse_body.name = "Horse_Body"
    horse_body.rotation_euler = (math.radians(25), 0, 0)
    horse_body.data.materials.append(create_material("Mat_HorseIvory", pal["primary"], roughness=0.6))

    # Arched Powerful Horse Neck
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=12, radius=0.11, depth=0.28, location=(0, 0.08, 0.42)
    )
    horse_neck = bpy.context.active_object
    horse_neck.name = "Horse_Neck"
    horse_neck.rotation_euler = (math.radians(-30), 0, 0)
    horse_neck.data.materials.append(create_material("Mat_HorseNeck", pal["primary"], roughness=0.6))

    # Horse Head & Chamfron Armor
    bpy.ops.mesh.primitive_cone_add(
        vertices=12, radius1=0.10, radius2=0.04, depth=0.20, location=(0, 0.16, 0.54)
    )
    horse_head = bpy.context.active_object
    horse_head.name = "Horse_Head"
    horse_head.rotation_euler = (math.radians(50), 0, 0)
    horse_head.data.materials.append(create_material("Mat_HorseChamfron", pal["bronze"], roughness=0.4, metallic=0.85))

    # Crimson Saddle Cloth
    bpy.ops.mesh.primitive_cube_add(
        size=0.18, location=(0, -0.05, 0.32)
    )
    saddle = bpy.context.active_object
    saddle.name = "Horse_Saddle"
    saddle.scale = (1.2, 1.4, 0.4)
    saddle.data.materials.append(create_material("Mat_SaddleCloth", pal["crimson"], roughness=0.7))

    # Mounted Rider Torso
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=12, radius=0.10, depth=0.22, location=(0, -0.05, 0.46)
    )
    rider_torso = bpy.context.active_object
    rider_torso.name = "Rider_Torso"
    rider_torso.data.materials.append(create_material("Mat_RiderArmor", pal["bronze"], roughness=0.45, metallic=0.8))

    # Rider Helmet & Plume
    bpy.ops.mesh.primitive_uv_sphere_add(
        segments=12, ring_count=8, radius=0.07, location=(0, -0.05, 0.62)
    )
    rider_helm = bpy.context.active_object
    rider_helm.name = "Rider_Helm"
    rider_helm.data.materials.append(create_material("Mat_RiderGold", pal["gold"], roughness=0.35, metallic=0.9))

    # Cavalry Lance
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=8, radius=0.014, depth=0.78, location=(0.14, 0.10, 0.52)
    )
    lance = bpy.context.active_object
    lance.name = "Cavalry_Lance"
    lance.rotation_euler = (math.radians(20), 0, 0)
    lance.data.materials.append(create_material("Mat_LanceSteel", pal["steel"], roughness=0.25, metallic=0.95))

# 4. Bishop (Acharya, Height .81S)
def build_bishop(pal):
    create_shared_plinth(pal)

    # Flowing Ascetic Robe Lower Section
    bpy.ops.mesh.primitive_cone_add(
        vertices=16, radius1=0.20, radius2=0.12, depth=0.35, location=(0, 0, 0.24)
    )
    robe_lower = bpy.context.active_object
    robe_lower.name = "Acharya_RobeLower"
    robe_lower.data.materials.append(create_material("Mat_AcharyaRobe", pal["primary"], roughness=0.65))

    # Draped Shawl with Forest Green Border
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=16, radius=0.14, depth=0.24, location=(0, 0, 0.45)
    )
    torso = bpy.context.active_object
    torso.name = "Acharya_Torso"
    torso.data.materials.append(create_material("Mat_AcharyaShawl", pal["forest_green"], roughness=0.7))

    # Ivory Head & Downward Contemplative Chin
    bpy.ops.mesh.primitive_uv_sphere_add(
        segments=16, ring_count=12, radius=0.08, location=(0, 0, 0.61)
    )
    head = bpy.context.active_object
    head.name = "Acharya_Head"
    head.data.materials.append(create_material("Mat_AcharyaIvory", pal["primary"], roughness=0.6))

    # High Rounded Topknot Turban
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=16, radius=0.075, depth=0.14, location=(0, 0, 0.72)
    )
    turban = bpy.context.active_object
    turban.name = "Acharya_Turban"
    turban.data.materials.append(create_material("Mat_AcharyaGold", pal["gold"], roughness=0.35, metallic=0.85))

    # Sacred Battle Staff (Gaja-Ankusha)
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=8, radius=0.015, depth=0.82, location=(0.14, 0.05, 0.46)
    )
    staff = bpy.context.active_object
    staff.name = "Acharya_Staff"
    staff.data.materials.append(create_material("Mat_StaffBronze", pal["bronze"], roughness=0.4, metallic=0.85))

    # Staff Finial Cap
    bpy.ops.mesh.primitive_cone_add(
        vertices=8, radius1=0.035, radius2=0.005, depth=0.10, location=(0.14, 0.05, 0.84)
    )
    finial = bpy.context.active_object
    finial.name = "Acharya_StaffFinial"
    finial.data.materials.append(create_material("Mat_StaffGold", pal["gold"], roughness=0.3, metallic=0.95))

# 5. Queen (Samrajni, Height .94S)
def build_queen(pal):
    create_shared_plinth(pal)

    # Layered Ivory Gown Flared Hem
    bpy.ops.mesh.primitive_cone_add(
        vertices=20, radius1=0.24, radius2=0.11, depth=0.42, location=(0, 0, 0.28)
    )
    gown = bpy.context.active_object
    gown.name = "Samrajni_Gown"
    gown.data.materials.append(create_material("Mat_QueenGown", pal["primary"], roughness=0.6))

    # Crimson Outer Mantle Panels
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=16, radius=0.15, depth=0.38, location=(0, -0.03, 0.30)
    )
    mantle = bpy.context.active_object
    mantle.name = "Samrajni_Mantle"
    mantle.scale = (1.1, 0.8, 1.0)
    mantle.data.materials.append(create_material("Mat_QueenCrimson", pal["crimson"], roughness=0.65))

    # Sculpted Royal Cuirass & Narrow Waist
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=16, radius=0.12, depth=0.22, location=(0, 0, 0.54)
    )
    torso = bpy.context.active_object
    torso.name = "Samrajni_Torso"
    torso.data.materials.append(create_material("Mat_QueenGold", pal["gold"], roughness=0.32, metallic=0.9))

    # Carved Ivory Head
    bpy.ops.mesh.primitive_uv_sphere_add(
        segments=16, ring_count=12, radius=0.075, location=(0, 0, 0.70)
    )
    head = bpy.context.active_object
    head.name = "Samrajni_Head"
    head.data.materials.append(create_material("Mat_QueenIvory", pal["primary"], roughness=0.6))

    # Tall Flared Imperial Diadem Crown
    bpy.ops.mesh.primitive_cone_add(
        vertices=16, radius1=0.05, radius2=0.11, depth=0.16, location=(0, 0, 0.83)
    )
    crown = bpy.context.active_object
    crown.name = "Samrajni_Crown"
    crown.data.materials.append(create_material("Mat_CrownGold", pal["gold"], roughness=0.28, metallic=0.95))

    # Curved Royal Talwar Sword (Right hand, held low at ready)
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=8, radius=0.012, depth=0.48, location=(0.17, 0.08, 0.40)
    )
    sword = bpy.context.active_object
    sword.name = "Samrajni_Sword"
    sword.rotation_euler = (math.radians(35), math.radians(20), 0)
    sword.data.materials.append(create_material("Mat_QueenBlade", pal["steel"], roughness=0.2, metallic=0.98))

# 6. King (Raja, Height .87S)
def build_king(pal):
    create_shared_plinth(pal)

    # Broad Royal Mantle Lower Robe
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=18, radius=0.22, depth=0.38, location=(0, 0, 0.26)
    )
    robe = bpy.context.active_object
    robe.name = "Raja_Robe"
    robe.data.materials.append(create_material("Mat_KingRobe", pal["primary"], roughness=0.65))

    # Crimson Royal Shoulder Mantle
    bpy.ops.mesh.primitive_cube_add(
        size=0.26, location=(0, 0, 0.44)
    )
    mantle = bpy.context.active_object
    mantle.name = "Raja_Mantle"
    mantle.scale = (1.3, 0.9, 0.4)
    mantle.data.materials.append(create_material("Mat_KingCrimson", pal["crimson"], roughness=0.65))

    # Engraved Heavy Bronze & Gold Cuirass
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=16, radius=0.15, depth=0.24, location=(0, 0, 0.52)
    )
    torso = bpy.context.active_object
    torso.name = "Raja_Cuirass"
    torso.data.materials.append(create_material("Mat_KingArmor", pal["gold"], roughness=0.32, metallic=0.9))

    # Regal Carved Ivory Head
    bpy.ops.mesh.primitive_uv_sphere_add(
        segments=16, ring_count=12, radius=0.08, location=(0, 0, 0.68)
    )
    head = bpy.context.active_object
    head.name = "Raja_Head"
    head.data.materials.append(create_material("Mat_KingIvory", pal["primary"], roughness=0.6))

    # Three-Tiered Upright Royal Crown with Central Finial
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=16, radius=0.09, depth=0.10, location=(0, 0, 0.77)
    )
    crown_base = bpy.context.active_object
    crown_base.name = "Raja_CrownBase"
    crown_base.data.materials.append(create_material("Mat_KingGold", pal["gold"], roughness=0.3, metallic=0.95))

    bpy.ops.mesh.primitive_cone_add(
        vertices=12, radius1=0.06, radius2=0.01, depth=0.08, location=(0, 0, 0.85)
    )
    crown_finial = bpy.context.active_object
    crown_finial.name = "Raja_CrownFinial"
    crown_finial.data.materials.append(create_material("Mat_KingFinial", pal["gold"], roughness=0.25, metallic=0.95))

    # Vertical Central Ceremonial Broadsword
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=8, radius=0.015, depth=0.55, location=(0, 0.14, 0.35)
    )
    sword = bpy.context.active_object
    sword.name = "Raja_Sword"
    sword.data.materials.append(create_material("Mat_KingBlade", pal["steel"], roughness=0.2, metallic=0.98))

    # Crossguard
    bpy.ops.mesh.primitive_cube_add(
        size=0.03, location=(0, 0.14, 0.55)
    )
    guard = bpy.context.active_object
    guard.name = "Raja_Crossguard"
    guard.scale = (4.0, 1.0, 1.0)
    guard.data.materials.append(create_material("Mat_KingGuard", pal["gold"], roughness=0.3, metallic=0.95))

BUILDERS = {
    "P": build_pawn,
    "R": build_rook,
    "N": build_knight,
    "B": build_bishop,
    "Q": build_queen,
    "K": build_king,
}

def export_all():
    print(f"Generating Astra 3D Army GLB assets into: {OUTPUT_DIR}")
    for faction_prefix, pal in [("w", WHITE_PALETTE), ("b", BLACK_PALETTE)]:
        faction_name = "White" if faction_prefix == "w" else "Black"
        for code, builder in BUILDERS.items():
            piece_id = f"{faction_prefix}{code}"
            filepath = os.path.join(OUTPUT_DIR, f"{piece_id}.glb")
            
            clear_scene()
            builder(pal)
            
            # Select all objects and export GLB
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
            print(f"  ✓ Exported {faction_name} {code} -> {piece_id}.glb ({file_size_kb:.1f} KB)")

    print("\nAll 12 Astra 3D army models successfully exported!")

if __name__ == "__main__":
    export_all()
