"""Packs rendered 2.5D animation frames from /tmp/blunderbot_frames/ into 2048x2048 WebP atlases.
Outputs:
- apps/frontend/public/pieces/2p5d-animated/{piece}_atlas.webp
- apps/frontend/public/pieces/2p5d-animated/{piece}_clip.json
- apps/frontend/public/pieces/2p5d-animated/manifest.json
"""
import json
import os
import sys
from pathlib import Path
from PIL import Image

PROJECT_ROOT = Path('/home/fullmetal-alchemist/Documents/projects/BlunderBot')
TMP_DIR = Path('/tmp/blunderbot_frames')
OUT_DIR = PROJECT_ROOT / 'apps/frontend/public/pieces/2p5d-animated'
OUT_DIR.mkdir(parents=True, exist_ok=True)

CLIP_MANIFEST_TEMPLATE = {
    'cols': 8,
    'rows': 8,
    'cell': 256,
    'clips': {
        'idle': {'start': 0, 'count': 8, 'fps': 10, 'loop': True},
        'move': {'start': 8, 'count': 12, 'fps': 14, 'loop': True},
        'attack_anticipation': {'start': 20, 'count': 4, 'fps': 12, 'loop': False},
        'attack': {'start': 24, 'count': 8, 'fps': 16, 'loop': False, 'contactFrame': 4},
        'defend': {'start': 32, 'count': 6, 'fps': 12, 'loop': False},
        'hit': {'start': 38, 'count': 4, 'fps': 16, 'loop': False},
        'stagger': {'start': 42, 'count': 6, 'fps': 12, 'loop': False},
        'defeat': {'start': 48, 'count': 8, 'fps': 12, 'loop': False},
        'victory': {'start': 56, 'count': 8, 'fps': 12, 'loop': False},
    }
}

def pack_atlas_for_piece(piece_code):
    atlas = Image.new('RGBA', (8 * 256, 8 * 256), (0, 0, 0, 0))
    missing = 0
    for idx in range(64):
        frame_path = TMP_DIR / f'{piece_code}_{idx:02d}.png'
        col = idx % 8
        row = idx // 8
        if frame_path.exists():
            with Image.open(frame_path) as frame:
                atlas.paste(frame, (col * 256, row * 256))
        else:
            missing += 1

    webp_path = OUT_DIR / f'{piece_code}_atlas.webp'
    atlas.save(str(webp_path), format='WEBP', lossless=True, method=6)
    kb = webp_path.stat().st_size / 1024
    print(f"Packed {piece_code} -> {webp_path.name} ({kb:.1f} KB, missing frames: {missing})")

    manifest = dict(CLIP_MANIFEST_TEMPLATE)
    manifest['pieceCode'] = piece_code
    manifest['image'] = f'/pieces/2p5d-animated/{piece_code}_atlas.webp'

    json_path = OUT_DIR / f'{piece_code}_clip.json'
    with open(json_path, 'w') as f:
        json.dump(manifest, f, indent=2)
    return manifest

def main():
    pieces = ['wP', 'wN', 'wB', 'wR', 'wQ', 'wK', 'bP', 'bN', 'bB', 'bR', 'bQ', 'bK']
    available_pieces = []
    for p in pieces:
        # Check if at least frame 0 exists
        if (TMP_DIR / f'{p}_00.png').exists():
            pack_atlas_for_piece(p)
            available_pieces.append(p)

    # Master manifest
    master = {
        'version': '1.0.0',
        'cell': 256,
        'cols': 8,
        'rows': 8,
        'cameraAngleDeg': 48,
        'pieces': available_pieces
    }
    with open(OUT_DIR / 'manifest.json', 'w') as f:
        json.dump(master, f, indent=2)
    print(f"\nGenerated master manifest for {len(available_pieces)} pieces: {available_pieces}")

if __name__ == '__main__':
    main()
