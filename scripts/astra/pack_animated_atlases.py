"""Packs rendered 2.5D animation frames or sheets into lossless 2048x2048 WebP atlases.
Outputs:
- apps/frontend/public/pieces/2p5d-animated/{piece}_atlas.webp
- apps/frontend/public/pieces/2p5d-animated/{piece}_back_atlas.webp
- apps/frontend/public/pieces/2p5d-animated/{piece}_clip.json
- apps/frontend/public/pieces/2p5d-animated/manifest.json
"""
import json
import sys
import tempfile
from pathlib import Path
from PIL import Image

PROJECT_ROOT = Path(__file__).resolve().parents[2]
TMP_DIR = Path(tempfile.gettempdir()) / 'blunderbot_frames'
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
        'defeat': {'start': 48, 'count': 6, 'fps': 10, 'loop': False},
        'victory': {'start': 54, 'count': 6, 'fps': 10, 'loop': True},
        'draw': {'start': 60, 'count': 4, 'fps': 6, 'loop': False},
    },
}


def pack_sheet(png_path: Path, webp_path: Path):
    with Image.open(png_path) as img:
        rgba = img.convert('RGBA')
        if rgba.size != (2048, 2048):
            rgba = rgba.resize((2048, 2048), Image.Resampling.LANCZOS)
        rgba.save(str(webp_path), format='WEBP', lossless=True, method=6)
    return webp_path.stat().st_size / 1024


def pack_atlas_for_piece(piece_code: str, frames_dir: Path):
    front_sheet = frames_dir / f'{piece_code}_sheet_front.png'
    back_sheet = frames_dir / f'{piece_code}_sheet_back.png'

    if front_sheet.exists():
        kb = pack_sheet(front_sheet, OUT_DIR / f'{piece_code}_atlas.webp')
        print(f'Packed {piece_code}_atlas.webp ({kb:.1f} KB)')
    else:
        atlas = Image.new('RGBA', (8 * 256, 8 * 256), (0, 0, 0, 0))
        missing = 0
        for idx in range(64):
            frame_path = frames_dir / f'{piece_code}_{idx:02d}.png'
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
        print(f'Packed {piece_code} -> {webp_path.name} ({kb:.1f} KB, missing frames: {missing})')

    has_back = False
    if back_sheet.exists():
        kb_back = pack_sheet(back_sheet, OUT_DIR / f'{piece_code}_back_atlas.webp')
        print(f'Packed {piece_code}_back_atlas.webp ({kb_back:.1f} KB)')
        has_back = True

    manifest = json.loads(json.dumps(CLIP_MANIFEST_TEMPLATE))
    manifest['pieceCode'] = piece_code
    manifest['image'] = f'/pieces/2p5d-animated/{piece_code}_atlas.webp'
    if has_back:
        manifest['backImage'] = f'/pieces/2p5d-animated/{piece_code}_back_atlas.webp'
        manifest['directions'] = ['front', 'back']

    json_path = OUT_DIR / f'{piece_code}_clip.json'
    with open(json_path, 'w') as f:
        json.dump(manifest, f, indent=2)
    return manifest


def main():
    frames_dir = Path(sys.argv[1]) if len(sys.argv) > 1 else TMP_DIR
    pieces = ['wP', 'wN', 'wB', 'wR', 'wQ', 'wK', 'bP', 'bN', 'bB', 'bR', 'bQ', 'bK']
    available_pieces = []
    has_directional = True
    for p in pieces:
        if (frames_dir / f'{p}_sheet_front.png').exists() or (frames_dir / f'{p}_00.png').exists():
            m = pack_atlas_for_piece(p, frames_dir)
            available_pieces.append(p)
            if 'backImage' not in m:
                has_directional = False

    master = {
        'version': '2.0.0',
        'cell': 256,
        'cols': 8,
        'rows': 8,
        'cameraAngleDeg': 48,
        'directional': has_directional,
        'directions': ['front', 'back'] if has_directional else ['front'],
        'pieces': available_pieces,
    }
    with open(OUT_DIR / 'manifest.json', 'w') as f:
        json.dump(master, f, indent=2)
    print(f'\nGenerated master manifest for {len(available_pieces)} pieces: {available_pieces}')


if __name__ == '__main__':
    main()
