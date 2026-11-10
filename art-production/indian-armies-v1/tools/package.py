"""Package encounter contact timing, isolated effects and local scale reviews.

Run after render_rigs.py. No game/runtime source is modified.
"""
import hashlib
import json
import math
import PIL
from pathlib import Path
from PIL import Image, ImageDraw
from render_rigs import ROOT, Rig, S, CONTRACT

CODES=[f"{side}{piece}" for side in "wb" for piece in "PNBRQK"]
CARD_DIMENSIONS={"P":[.96,1.05],"N":[1.25,1.28],"B":[1.10,1.32],"R":[1.10,1.15],"Q":[1.20,1.38],"K":[1.30,1.45]}


def write(path,data):
    path.write_text(json.dumps(data,indent=2)+"\n",encoding="utf-8")


def effects(side):
    rig=Rig(side+"P")
    target=ROOT/"runtime"/"effects"
    target.mkdir(exist_ok=True)
    atlas=Image.new("RGBA",(2048,512))
    for i in range(16):
        canvas=Image.new("RGBA",(768,768))
        t=(i+1)/16
        opacity=math.sin(math.pi*min(1,t*1.6))*.65 if i<10 else max(0,1-(i-10)/6)
        width=15+min(t,.6)*65
        rig.draw(canvas,11,(.1,.5),(.9,.5),(128-width/2,128),(128+width/2,128),opacity)
        for j in range(5):
            angle=j*math.tau/5+.3
            x=128+math.cos(angle)*t*62
            y=128+math.sin(angle)*t*40+t*t*25
            rig.draw(canvas,10,(.1,.5),(.9,.5),(x-5,y),(x+5,y+t*(j-2)*3),min(1,t*8)*max(0,1-t*.6))
        frame=canvas.resize((256,256),Image.Resampling.LANCZOS)
        atlas.alpha_composite(frame,((i%8)*256,(i//8)*256))
    path=target/f"{side}_impact_debris.webp"
    atlas.save(path,lossless=True,method=0)
    return {"image":f"effects/{path.name}","cols":8,"rows":2,"cell":256,"count":16,"fps":24,
            "loop":False,"anchor":[.5,.5],"durationMs":1000*16/24,"faction":"white" if side=="w" else "black"}


def atlas_frame(atlas,index):
    return atlas.crop(((index%8)*256,(index//8)*256,(index%8+1)*256,(index//8+1)*256))


def contact(attacker,defender):
    a=json.loads((ROOT/"runtime"/attacker/f"{attacker}_clip.json").read_text())
    b=json.loads((ROOT/"runtime"/defender/f"{defender}_clip.json").read_text())
    tip=a["clips"]["attack"]["socketsPx"][4]["weaponTip"]
    segment=b["clips"]["defend"]["socketsPx"][-1]["staffSegment"]
    top,bottom=segment
    u=(tip[1]-top[1])/(bottom[1]-top[1])
    if not 0<=u<=1:
        raise ValueError(f"{attacker}/{defender}: lance does not meet staff segment; u={u}")
    shaft=[top[0]+u*(bottom[0]-top[0]),tip[1]]
    dx=tip[0]-shaft[0]
    aw,ah=CARD_DIMENSIONS[attacker[1]];bw,bh=CARD_DIMENSIONS[defender[1]]
    # Match heights using the verified class-specific card dimensions, not
    # equal-pixel assumptions. Shared tilt then also matches world depth.
    by=220-(220-tip[1])*ah/bh
    world_u=(by-top[1])/(bottom[1]-top[1])
    if not 0<=world_u<=1:raise ValueError("World-scale contact lies outside staff")
    bx=top[0]+world_u*(bottom[0]-top[0])
    height=(220-tip[1])*ah/256
    apos=[(tip[0]-128)*aw/256,height*math.cos(-.58),height*math.sin(-.58)]
    bpos=[(bx-128)*bw/256,apos[1],apos[2]]
    world_offset=[apos[0]-bpos[0],0,0]
    return {"attacker":attacker,"defender":defender,"contactTimeMs":1440,"attackStartMs":1190,
            "attackClip":"attack","contactFrame":4,"contactLocalTimeMs":250,
            "defenseClip":"defend","defenseFrame":5,"defenseHoldUntilMs":1503,
            "attackerContactPx":tip,"defenderContactPx":shaft,"defenderStaffSegmentPx":segment,
            "defenderRootOffsetPx":[dx,0],"sharedBaselinePx":220,"contactErrorPx":0,
            "nativeCardDimensions":{"attacker":[aw,ah],"defender":[bw,bh]},
            "worldContact":{"attackerLocal":apos,"defenderLocal":bpos,"defenderRootOffset":world_offset,"defenderContactPx":[bx,by],"tiltRad":-.58,"error":0},
            "timeline":[
                {"timeMs":0,"attackerClip":"attack_anticipation","defenderClip":"defend","event":"coil; raise staff"},
                {"timeMs":333,"attackerClip":"move","event":"articulated cavalry charge; hold staff block"},
                {"timeMs":1190,"attackerClip":"attack","event":"lower lance and extend"},
                {"timeMs":1440,"attackerFrame":4,"defenderClip":"defend","defenderFrame":5,"event":"contact; warm dust/chips"},
                {"timeMs":1503,"defenderClip":"hit","event":"recoil from held staff block"},
                {"timeMs":1690,"attackerClip":"idle","event":"recover stance"},
                {"timeMs":1753,"defenderClip":"stagger","event":"stagger back"},
                {"timeMs":2253,"defenderClip":"defeat","event":"split sculpted shell; falling fragments"},
                {"timeMs":2920,"event":"hold debris briefly"},
                {"timeMs":3357,"event":"end"}],
            "placement":"fixed angle only; pixel offset is for equal-size review. In game use worldContact and native card dimensions, with feet anchors registered first.",
            "status":"offline synchronized art candidate; actual board contact approval pending"}


def review_duel(spec):
    ac,bc=spec["attacker"],spec["defender"]
    with Image.open(ROOT/"runtime"/ac/f"{ac}_atlas.webp") as im:a=im.copy()
    with Image.open(ROOT/"runtime"/bc/f"{bc}_atlas.webp") as im:b=im.copy()
    fx=Image.open(ROOT/"runtime"/"effects"/f"{bc[0]}_impact_debris.webp").copy()
    frames=[]
    for ms in range(0,3380,42):
        if ms<333:an="attack_anticipation";ai=min(3,int(ms*12/1000));ax=30
        elif ms<1190:an="move";ai=min(11,int((ms-333)*14/1000));ax=30+100*(ms-333)/857
        elif ms<1690:an="attack";ai=min(7,int((ms-1190)*16/1000));ax=130
        else:an="idle";ai=int((ms-1690)*10/1000)%8;ax=130
        if ms<1503:bn="defend";bi=min(5,int(ms*12/1000))
        elif ms<1753:bn="hit";bi=min(3,int((ms-1503)*16/1000))
        elif ms<2253:bn="stagger";bi=min(5,int((ms-1753)*12/1000))
        else:bn="defeat";bi=min(7,int((ms-2253)*12/1000))
        bg=Image.new("RGBA",(640,360),"#4f5144")
        d=ImageDraw.Draw(bg)
        for x in range(0,640,80):d.polygon([(x,300),(x+80,300),(x+120,360),(x+40,360)],fill="#736b50" if x%160 else "#b49b72")
        astart=CONTRACT[an][0]+ai;bstart=CONTRACT[bn][0]+bi
        bg.alpha_composite(atlas_frame(a,astart),(round(ax),80))
        bx=round(130+spec["defenderRootOffsetPx"][0])
        bg.alpha_composite(atlas_frame(b,bstart),(bx,80))
        if 1440<=ms<2106:
            f=min(15,int((ms-1440)*24/1000))
            x,y=spec["attackerContactPx"]
            bg.alpha_composite(atlas_frame(fx,f),(round(130+x-128),round(80+y-128)))
        d.text((18,18),f"{ac} / {bc}  |  {ms} ms  |  contact 1440 ms",fill="#fff1ce")
        frames.append(bg.convert("RGB"))
    frames[0].save(ROOT/"review"/f"{ac}_{bc}_duel.gif",save_all=True,append_images=frames[1:],duration=42,loop=0,disposal=2)
    frames[35].save(ROOT/"review"/f"{ac}_{bc}_contact.jpg")


def scale_review():
    output=Image.new("RGB",(1000,640),"#756f60");d=ImageDraw.Draw(output)
    for j,code in enumerate(CODES):
        with Image.open(ROOT/"runtime"/code/f"{code}_atlas.webp") as atlas:
            frame=atlas_frame(atlas,0)
        x=(j%6)*164;y=(j//6)*320
        for px,offset in ((128,0),(64,140),(48,220)):
            f=frame.resize((px,px),Image.Resampling.LANCZOS)
            output.paste(f,(x,y+offset),f)
        d.text((x+5,y+286),f"{code}: 128 / 64 / 48 px",fill="white")
    output.save(ROOT/"review"/"gameplay_scale.jpg")


if __name__=="__main__":
    fx={side:effects(side) for side in "wb"}
    pairs=[contact(a,b) for a,b in (("wN","wB"),("wN","bB"),("bN","wB"))]
    write(ROOT/"runtime"/"encounters.json",{"version":1,"encounters":pairs})
    write(ROOT/"runtime"/"endings.json",{
        "kingCapture":False,
        "whiteVictory":{"winners":[{"piece":c,"clip":"victory","texture":"main"} for c in CODES if c[0]=="w"],"losingKing":{"piece":"bK","clip":"defeat_acknowledgement","texture":"endings"}},
        "blackVictory":{"winners":[{"piece":c,"clip":"victory","texture":"main"} for c in CODES if c[0]=="b"],"losingKing":{"piece":"wK","clip":"defeat_acknowledgement","texture":"endings"}},
        "draw":{"units":[{"piece":c,"clip":"draw_disengagement","texture":"endings"} for c in CODES]}})
    master={"version":"1.0.0-art-candidate","pieces":CODES,"cell":256,"cols":8,"rows":8,"cameraAngleDeg":48,
            "baseCommit":"4aa2b90109ea512a1682297138f5df96aef1c9ca","selectedInGame":False,
            "mainFramesPerPiece":64,"endingFramesPerPiece":16,"effectFrames":32,
            "totalCharacterFrames":960,"effects":fx,
            "clips":{n:{"start":s,"count":c,"fps":f,"loop":l} for n,(s,c,f,l) in CONTRACT.items()},
            "manifests":{c:f"{c}/{c}_clip.json" for c in CODES},
            "encounters":"encounters.json","endings":"endings.json",
            "cameraValidation":"pending in-game art review; 48 degrees supplied to illustration generator",
            "runtimeCompatibility":"main 8x8 layout exactly matches verified CLIPS_DEF; supplementary endings use 8x2 grids and their supplied clip metadata",
            "sources":"../source","export":"../tools/render_rigs.py"}
    master["verifiedCardDimensions"]=CARD_DIMENSIONS
    master["planeTiltRad"]=-.58
    master["planeCenterFromFootAnchor"]={c:[0,(220/256-.5)*h*math.cos(-.58),(220/256-.5)*h*math.sin(-.58)] for c,(w,h) in CARD_DIMENSIONS.items()}
    write(ROOT/"runtime"/"manifest.json",master)
    source_files=sorted((ROOT/"source").glob("*.png"))
    write(ROOT/"source"/"provenance.json",{
        "method":"built-in image generation of matched illustrated cutout source components; deterministic articulated export",
        "referenceBaseCommit":master["baseCommit"],
        "references":[f"BlunderBot_White_Army_AssetKit/reference/approved_identity_concept_cutouts/w{c}_concept.png" for c in "PNBRQK"],
        "pillowVersion":PIL.__version__,
        "files":{p.name:{"sha256":hashlib.sha256(p.read_bytes()).hexdigest(),"bytes":p.stat().st_size,"dimensions":list(Image.open(p).size)} for p in source_files},
        "reproduction":"source painting regeneration is stochastic; all selected painting pixels are retained. render_rigs.py reproduces exports without an image-generation call."})
    (ROOT/"tools"/"requirements.txt").write_text(f"Pillow=={PIL.__version__}\n",encoding="utf-8")
    for spec in pairs:review_duel(spec)
    scale_review()
    print("Packaged 12 characters, 32 FX frames, 3 synchronized encounter recipes, ending compositions and local scale reviews.")
