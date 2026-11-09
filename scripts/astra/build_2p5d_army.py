#!/usr/bin/env python3
"""
BlunderBot Stylized 2.5D Indian War Chess Asset Pipeline.
Authoritative specification:
- FLASH — BLUNDERBOT: PIVOT TO 2.5D STYLIZED INDIAN WAR CHESS
- FLASH — ADDENDUM: WARCRAFT-INSPIRED 2.5D COMBAT & ANIMATION

Builds high-resolution, normalized 2.5D sprites with:
1. Strict height hierarchy and ground contact anchor
2. White Royal Army: Ivory, brushed gold, aged bronze, saffron, and forest green
3. Black Asura Army: Volcanic obsidian, hammered iron, burnished brass/gold, and deep vermilion
4. Soft contact shadows and high-contrast rim lighting for instant sub-1-second visual recognition
"""

import os
import sys
import numpy as np
from PIL import Image, ImageFilter, ImageEnhance, ImageDraw

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
CUTOUTS_DIR = os.path.join(PROJECT_ROOT, "BlunderBot_White_Army_AssetKit/reference/approved_identity_concept_cutouts")
PUBLIC_PIECES_DIR = os.path.join(PROJECT_ROOT, "apps/frontend/public/pieces/2p5d-indian")
ART_SPRITES_DIR = os.path.join(PROJECT_ROOT, "art/2p5d_war_chess/sprites")
RECOVERY_DIR = os.path.join(PROJECT_ROOT, "docs/astra/recovery")
ARTIFACT_DIR = "/home/fullmetal-alchemist/.gemini/antigravity/brain/fe8171a3-a9c0-4d07-a5a7-03e04572af33"

for d in [PUBLIC_PIECES_DIR, ART_SPRITES_DIR, RECOVERY_DIR, ARTIFACT_DIR]:
    os.makedirs(d, exist_ok=True)

# Target Height Hierarchy on 512x512 Canvas (Anchor Y = 470)
HEIGHT_TARGETS = {
    'wP': 300,  # Padati - Infantry Pawn (smallest, compact spear & shield)
    'wR': 335,  # Durg - Wheeled Fortress Rook (broad stone battlements)
    'wN': 375,  # Ashva Senani - Armored Cavalry Knight (horse profile & lance)
    'wB': 390,  # Acharya - Royal Preceptor Bishop (tall staff & turban)
    'wQ': 410,  # Samrajni - Imperial Battle Queen (flared crown & talwar)
    'wK': 430,  # Raja - Royal Sovereign King (towering 3-tier mukuta & Khanda)
}

def add_contact_shadow(base_img, cx=256, cy=468, rx=110, ry=28, opacity=0.42):
    """Draws a soft ground contact shadow plinth underneath the piece."""
    shadow = Image.new('RGBA', (512, 512), (0, 0, 0, 0))
    draw = ImageDraw.Draw(shadow)
    bbox = [cx - rx, cy - ry, cx + rx, cy + ry]
    draw.ellipse(bbox, fill=(12, 10, 8, int(255 * opacity)))
    # Inner denser core
    draw.ellipse([cx - rx * 0.65, cy - ry * 0.65, cx + rx * 0.65, cy + ry * 0.65], fill=(8, 6, 4, int(255 * opacity * 1.4)))
    shadow = shadow.filter(ImageFilter.GaussianBlur(radius=8))
    return Image.alpha_composite(shadow, base_img)

def create_rim_light(img, color=(255, 235, 190), intensity=0.6, width=3):
    """Adds a subtle edge rim highlight to make silhouettes pop against any background."""
    alpha = img.split()[3]
    dilated = alpha.filter(ImageFilter.MaxFilter(width * 2 + 1))
    edge = Image.new('L', (512, 512), 0)
    
    a_arr = np.array(alpha, dtype=float)
    d_arr = np.array(dilated, dtype=float)
    edge_arr = np.clip(d_arr - a_arr, 0, 255).astype(np.uint8)
    edge = Image.fromarray(edge_arr).filter(ImageFilter.GaussianBlur(radius=1.5))
    
    rim = Image.new('RGBA', (512, 512), (*color, 0))
    r_arr = np.array(rim)
    r_arr[:, :, 3] = (np.array(edge, dtype=float) * intensity).astype(np.uint8)
    rim_img = Image.fromarray(r_arr)
    
    return Image.alpha_composite(rim_img, img)

def generate_white_piece(piece_code):
    src_file = os.path.join(CUTOUTS_DIR, f"{piece_code}_concept.png")
    if not os.path.exists(src_file):
        raise FileNotFoundError(f"Missing {src_file}")
    
    raw = Image.open(src_file).convert('RGBA')
    bbox = raw.getbbox()
    cropped = raw.crop(bbox)
    
    target_h = HEIGHT_TARGETS[piece_code]
    aspect = cropped.width / cropped.height
    new_w = int(target_h * aspect)
    new_h = target_h
    
    resized = cropped.resize((new_w, new_h), Image.Resampling.LANCZOS)
    
    # Slight contrast & vibrancy boost for rich Mosslight / RTS miniature feel
    enhancer = ImageEnhance.Color(resized)
    enhanced = enhancer.enhance(1.12)
    enhancer2 = ImageEnhance.Contrast(enhanced)
    enhanced = enhancer2.enhance(1.08)
    
    # Place on 512x512 canvas centered at bottom anchor Y=470
    canvas = Image.new('RGBA', (512, 512), (0, 0, 0, 0))
    paste_x = (512 - new_w) // 2
    paste_y = 470 - new_h
    canvas.paste(enhanced, (paste_x, paste_y), enhanced)
    
    # Add rim light (warm golden-ivory edge)
    with_rim = create_rim_light(canvas, color=(255, 240, 205), intensity=0.55, width=2)
    
    # Add grounded contact shadow
    rx = int(new_w * 0.44)
    final_img = add_contact_shadow(with_rim, cx=256, cy=468, rx=max(rx, 65), ry=24, opacity=0.45)
    return final_img

def transform_to_black_piece(white_img, piece_code):
    """
    Transforms the White Army asset into the Asura/Chola imperial Black counter-faction:
    - Volcanic obsidian/basalt stone body with deep charcoal luster
    - Hammered dark iron & tempered steel armor
    - Burnished antique gold & brass reliefs
    - Imperial blood-crimson and ember-maroon woven silks
    - Crisp burnished brass rim lighting for clear silhouette definition on dark tiles
    """
    arr = np.array(white_img, dtype=float)
    rgb = arr[:, :, :3]
    alpha = arr[:, :, 3]
    
    # Calculate luminance
    lum = (rgb[:, :, 0] * 0.299 + rgb[:, :, 1] * 0.587 + rgb[:, :, 2] * 0.114) / 255.0
    
    # Distinguish warm gold/saffron accents vs ivory stone
    r, g, b = rgb[:, :, 0], rgb[:, :, 1], rgb[:, :, 2]
    is_warm_accent = (r > g * 1.15) & (r > b * 1.3)
    is_green = (g > r * 1.05) & (g > b * 1.05)
    
    # Black Faction Palette Shading:
    # 1. Dark Basalt/Obsidian base: deep charcoal with subtle warm undertone
    dark_stone = np.zeros_like(rgb)
    dark_stone[:, :, 0] = lum * 75.0 + 18.0   # subtle warm red in shadow
    dark_stone[:, :, 1] = lum * 72.0 + 16.0   # green
    dark_stone[:, :, 2] = lum * 78.0 + 20.0   # deep basalt blue-gray
    
    # 2. Burnished Brass / Antique Gold for high-contrast rank trims
    brass_trim = np.zeros_like(rgb)
    brass_trim[:, :, 0] = np.clip(lum * 220.0 + 35.0, 0, 255)
    brass_trim[:, :, 1] = np.clip(lum * 165.0 + 20.0, 0, 255)
    brass_trim[:, :, 2] = np.clip(lum * 65.0 + 8.0, 0, 255)
    
    # 3. Imperial Blood-Crimson / Vermilion Silk for banners & sashes
    crimson_silk = np.zeros_like(rgb)
    crimson_silk[:, :, 0] = np.clip(lum * 160.0 + 35.0, 0, 255)
    crimson_silk[:, :, 1] = np.clip(lum * 35.0 + 8.0, 0, 255)
    crimson_silk[:, :, 2] = np.clip(lum * 30.0 + 8.0, 0, 255)
    
    # Composite into final Black Faction texture
    black_rgb = dark_stone.copy()
    
    # High-luminance highlights become gleaming gold/brass trim
    high_spec = lum > 0.62
    black_rgb[high_spec] = brass_trim[high_spec] * 0.85 + dark_stone[high_spec] * 0.15
    
    # Warm accents become rich imperial blood-crimson
    black_rgb[is_warm_accent] = crimson_silk[is_warm_accent]
    
    # Green sage trim becomes deep ember-ochre
    ember_trim = crimson_silk * 0.7 + brass_trim * 0.3
    black_rgb[is_green] = ember_trim[is_green]
    
    # Boost contrast & specular definition
    black_rgb = np.clip(black_rgb * 1.15, 0, 255)
    
    out_arr = np.zeros_like(arr, dtype=np.uint8)
    out_arr[:, :, :3] = black_rgb.astype(np.uint8)
    out_arr[:, :, 3] = alpha.astype(np.uint8)
    
    black_img = Image.fromarray(out_arr)
    
    # Add high-contrast antique brass rim light so Black pieces read instantly on dark tiles
    black_with_rim = create_rim_light(black_img, color=(225, 175, 75), intensity=0.75, width=2)
    return black_with_rim

def main():
    print("=== Building BlunderBot Stylized 2.5D Indian War Chess Pieces ===")
    classes = ['wP', 'wR', 'wN', 'wB', 'wQ', 'wK']
    white_pieces = {}
    black_pieces = {}
    
    for c in classes:
        print(f"Generating White {c}...")
        w_img = generate_white_piece(c)
        white_pieces[c] = w_img
        
        # Save White piece
        w_out_public = os.path.join(PUBLIC_PIECES_DIR, f"{c}.png")
        w_out_art = os.path.join(ART_SPRITES_DIR, f"{c}.png")
        w_img.save(w_out_public)
        w_img.save(w_out_art)
        
        # Build Black Counterpart
        b_code = 'b' + c[1]
        print(f"Transforming to Black {b_code} (Asura/Chola Imperial)...")
        b_img = transform_to_black_piece(w_img, b_code)
        black_pieces[b_code] = b_img
        
        # Save Black piece
        b_out_public = os.path.join(PUBLIC_PIECES_DIR, f"{b_code}.png")
        b_out_art = os.path.join(ART_SPRITES_DIR, f"{b_code}.png")
        b_img.save(b_out_public)
        b_img.save(b_out_art)
    
    # Generate 12-Piece Lineup Comparison Sheet
    print("Compositing 12-piece Lineup Sheet...")
    sheet_w = 6 * 260 + 60
    sheet_h = 2 * 340 + 120
    sheet = Image.new('RGBA', (sheet_w, sheet_h), (16, 18, 22, 255))
    draw = ImageDraw.Draw(sheet)
    
    # Title Header
    from PIL import ImageFont
    try:
        font_title = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 26)
        font_label = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 16)
        font_sub = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 18)
    except Exception:
        font_title = ImageFont.load_default()
        font_label = ImageFont.load_default()
        font_sub = ImageFont.load_default()
    
    draw.text((30, 20), "BLUNDERBOT — STYLIZED 2.5D INDIAN WAR CHESS", fill=(245, 230, 195), font=font_title)
    draw.text((30, 52), "Authoritative 12-Piece Lineup: White Royal Army vs Black Asura Army (Mosslight/RTS Stylization)", fill=(180, 170, 150), font=font_label)
    
    class_names = [
        ('P', 'Padati (Pawn)'),
        ('R', 'Durg (Rook)'),
        ('N', 'Ashva (Knight)'),
        ('B', 'Acharya (Bishop)'),
        ('Q', 'Samrajni (Queen)'),
        ('K', 'Raja (King)')
    ]
    
    # Row 1: White Army
    draw.text((30, 85), "WHITE ROYAL ARMY — Ivory / Antique Gold / Saffron / Forest Green", fill=(235, 220, 180), font=font_sub)
    for i, (code_suffix, name) in enumerate(class_names):
        w_code = 'w' + code_suffix
        im = white_pieces[w_code].resize((220, 220), Image.Resampling.LANCZOS)
        x = 30 + i * 260
        y = 115
        # Draw background subtle plinth square
        draw.rectangle([x, y, x + 240, y + 250], fill=(24, 28, 34), outline=(48, 54, 66), width=1)
        sheet.paste(im, (x + 10, y + 15), im)
        draw.text((x + 20, y + 225), f"{w_code} — {name}", fill=(230, 220, 200), font=font_label)
    
    # Row 2: Black Army
    row2_y = 420
    draw.text((30, row2_y), "BLACK ASURA ARMY — Volcanic Obsidian / Hammered Iron / Burnished Brass / Deep Vermilion", fill=(210, 140, 80), font=font_sub)
    for i, (code_suffix, name) in enumerate(class_names):
        b_code = 'b' + code_suffix
        im = black_pieces[b_code].resize((220, 220), Image.Resampling.LANCZOS)
        x = 30 + i * 260
        y = row2_y + 30
        draw.rectangle([x, y, x + 240, y + 250], fill=(22, 20, 24), outline=(66, 48, 36), width=1)
        sheet.paste(im, (x + 10, y + 15), im)
        draw.text((x + 20, y + 225), f"{b_code} — {name}", fill=(215, 165, 105), font=font_label)
    
    lineup_path1 = os.path.join(RECOVERY_DIR, "2p5d-stylized-lineup.png")
    lineup_path2 = os.path.join(ARTIFACT_DIR, "2p5d-stylized-lineup.png")
    sheet.save(lineup_path1)
    sheet.save(lineup_path2)
    print(f"Saved lineup sheet: {lineup_path1} ({os.path.getsize(lineup_path1) // 1024} KB)")
    print("=== 2.5D Stylized Army Build Complete! ===")

if __name__ == '__main__':
    main()
