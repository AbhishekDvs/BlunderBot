"""Pack artist-rendered RGBA frames; never generates model art.

Requires Python 3.10+ and Pillow with WebP support. See docs/astra/PRODUCTION.md.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path

from PIL import Image


def pack_frames(source, output, *, cell=128, columns=8, fps=24, contact=None):
    source, output = Path(source), Path(output)
    if cell not in (128, 256) or not 1 <= columns <= 8 or not 1 <= fps <= 30:
        raise ValueError('Use cell 128/256, 1–8 columns, and 1–30 fps')
    paths = sorted(source.glob('*.png'))
    if not 1 <= len(paths) <= 64:
        raise ValueError('Expected 1–64 zero-padded PNG frames per clip/view')
    if contact is not None and not 0 <= contact < len(paths):
        raise ValueError('Contact must be a zero-based frame index within the clip')
    columns = min(columns, len(paths))
    rows = math.ceil(len(paths) / columns)
    if max(columns, rows) * cell > 2048:
        raise ValueError('Atlas exceeds the 2048px texture limit')
    # No resizing, trimming, or centering: preserve the shared camera and anchor.
    atlas = Image.new('RGBA', (columns * cell, rows * cell))
    for index, path in enumerate(paths):
        with Image.open(path) as frame:
            frame.load()
            if frame.mode != 'RGBA' or frame.size != (cell, cell):
                raise ValueError(f'{path.name}: expected {cell}x{cell} RGBA')
            alpha_min, alpha_max = frame.getchannel('A').getextrema()
            if alpha_min == 255 or alpha_max == 0:
                raise ValueError(f'{path.name}: expected visible art with transparent background')
            atlas.paste(frame, ((index % columns) * cell, (index // columns) * cell))
    # No partially published manifest: finish encoding and validation first.
    from io import BytesIO
    encoded = BytesIO()
    atlas.save(encoded, format='WEBP', lossless=True, method=6)
    payload = encoded.getvalue()
    if len(payload) > 2 * 1024 * 1024:
        raise ValueError('Clip exceeds 2 MiB transfer budget; split it or simplify detail')
    manifest = {
        'schemaVersion': 1,
        'image': 'atlas.webp',
        'sha256': hashlib.sha256(payload).hexdigest(),
        'bytes': len(payload),
        'decodedBytes': atlas.width * atlas.height * 4,
        'cell': cell,
        'columns': columns,
        'frameCount': len(paths),
        'fps': fps,
        'contactFrame': contact,
        'anchor': [0.5, 0.86],
        'frames': [p.name for p in paths],
    }
    # Each export is immutable; never overwrite an approved revision.
    output.mkdir(parents=True, exist_ok=False)
    try:
        (output / 'atlas.webp').write_bytes(payload)
        (output / 'clip.json').write_text(json.dumps(manifest, indent=2) + '\n')
    except BaseException:
        for name in ('atlas.webp', 'clip.json'):
            (output / name).unlink(missing_ok=True)
        output.rmdir()
        raise
    return manifest


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path, help='One clip, direction, and resolution; zero-padded PNGs')
    parser.add_argument('output', type=Path, help='New versioned directory, must not exist')
    parser.add_argument('--cell', type=int, default=128)
    parser.add_argument('--columns', type=int, default=8)
    parser.add_argument('--fps', type=int, default=24)
    parser.add_argument('--contact', type=int, help='Zero-based impact frame, capture clips only')
    args = parser.parse_args()
    print(json.dumps(pack_frames(args.source, args.output, cell=args.cell,
                                 columns=args.columns, fps=args.fps,
                                 contact=args.contact), indent=2))
