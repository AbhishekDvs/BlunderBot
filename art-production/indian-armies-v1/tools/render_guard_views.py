"""Export only the additional left-facing Pawn encounter defense performances.

Original board/attack atlases are never rewritten. Same independent joints,
authored reactions, foot pivot, clip indices and timing as the established rig.
"""
import hashlib
import json
import shutil
from pathlib import Path
from PIL import Image
from render_rigs import ROOT, CONTRACT, Rig


def export(code):
    source = ROOT / 'source' / f'{code}_guard_parts.png'
    rig = Rig(code, source.name, left_view=True)
    atlas = Image.new('RGBA', (2048, 2048))
    clips = {}
    preview = Image.new('RGBA', (1024, 512), '#202b29')
    samples = []
    for clip in ('idle', 'defend', 'hit', 'stagger', 'defeat'):
        start, count, fps, loop = CONTRACT[clip]
        sockets = []
        for i in range(count):
            frame, points = rig.render(clip, i, count)
            atlas.alpha_composite(frame, (((start+i) % 8)*256, ((start+i)//8)*256))
            sockets.append(points)
            if (clip, i) in [('idle',0),('defend',0),('defend',3),('defend',5),('hit',2),('stagger',3),('defeat',3),('defeat',7)]:
                samples.append(frame)
        clips[clip] = dict(start=start, count=count, fps=fps, loop=loop,
                           frameDurationsMs=[1000/fps]*count, socketsPx=sockets)
    out = ROOT / 'runtime' / code
    out.mkdir(parents=True, exist_ok=True)
    filename = f'{code}_guard.webp'
    atlas.save(out / filename, lossless=True, method=0)
    metadata = dict(pieceCode=code, cols=8, rows=8, cell=256, image=filename,
                    anchor=[.5,220/256], baselinePx=220, direction='screen-left-three-quarter',
                    cameraAngleDeg=48, clips=clips, sourceImage=f'../../source/{source.name}',
                    sourceSha256=hashlib.sha256(source.read_bytes()).hexdigest(),
                    equipment=dict(rightHand='short spear',leftHand='round shield'),
                    technique='independently painted opposite view; articulated original joint hierarchy; no pixel mirroring')
    manifest = out / f'{code}_guard_clip.json'
    manifest.write_text(json.dumps(metadata, indent=2)+'\n', encoding='utf-8')
    public = ROOT.parents[1] / 'apps/frontend/public/pieces/indian-armies-v1' / code
    shutil.copy2(out/filename, public/filename)
    shutil.copy2(manifest, public/manifest.name)
    cache = ROOT.parents[1] / '.cache/visual'
    cache.mkdir(parents=True, exist_ok=True)
    for i, frame in enumerate(samples):
        preview.alpha_composite(frame, ((i%4)*256,(i//4)*256))
    preview.save(cache/f'{code}-guard-poses.png')
    print(f'{code}: 32 additional defense-view frames; original atlas preserved')


if __name__ == '__main__':
    for code in ('wP', 'bP'):
        export(code)
    for master in (ROOT/'runtime/manifest.json', ROOT.parents[1]/'apps/frontend/public/pieces/indian-armies-v1/manifest.json'):
        data=json.loads(master.read_text(encoding='utf-8'))
        data['defenseViews']={code:f'{code}/{code}_guard_clip.json' for code in ('wP','bP')}
        master.write_text(json.dumps(data,indent=2)+'\n',encoding='utf-8')
