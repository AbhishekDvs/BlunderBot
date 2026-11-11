"""Re-export one revised clip without repainting or rendering other clips.

Example: python tools/refresh_clip.py defeat wP bP
Full render_rigs.py also reproduces exactly the corrected artwork.
"""
import json
import sys
from PIL import Image
from render_rigs import ROOT,Rig,CONTRACT


def refresh(clip,code):
    start,count,fps,loop=CONTRACT[clip]
    folder=ROOT/"runtime"/code
    path=folder/f"{code}_atlas.webp"
    with Image.open(path) as im:atlas=im.copy()
    rig=Rig(code);sockets=[];previews=[]
    for i in range(count):
        frame,points=rig.render(clip,i,count)
        sockets.append(points)
        x,y=(start+i)%8*256,(start+i)//8*256
        atlas.paste(frame,(x,y))
        bg=Image.new("RGBA",frame.size,"#756f60");bg.alpha_composite(frame)
        previews.append(bg.convert("RGB"))
    atlas.save(path,lossless=True,method=0)
    manifest_path=folder/f"{code}_clip.json"
    manifest=json.loads(manifest_path.read_text())
    manifest["clips"][clip]["socketsPx"]=sockets
    manifest_path.write_text(json.dumps(manifest,indent=2)+"\n",encoding="utf-8")
    previews[0].save(ROOT/"review"/f"{code}_{clip}.gif",save_all=True,append_images=previews[1:],duration=round(1000/fps),loop=0,disposal=2)
    print(f"Refreshed {code}/{clip}: {count} frames",flush=True)


if __name__=="__main__":
    clip=sys.argv[1]
    for code in sys.argv[2:]:refresh(clip,code)
