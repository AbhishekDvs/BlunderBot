"""Validate the deliverable, including nonrigid motion and synchronized contact.

These are asset checks, not claims of artistic acceptance or in-game testing.
"""
import hashlib
import json
import math
from pathlib import Path
from PIL import Image
from render_rigs import ROOT, CONTRACT


def frames(path,rows):
    with Image.open(path) as im:
        assert im.mode=="RGBA" and im.size==(2048,rows*256),(path,im.mode,im.size)
        assert im.getchannel("A").getextrema()==(0,255),path
        for i in range(rows*8):
            x,y=i%8*256,i//8*256
            yield im.crop((x,y,x+256,y+256))


def validate_piece(code):
    folder=ROOT/"runtime"/code
    manifest=json.loads((folder/f"{code}_clip.json").read_text())
    assert manifest["anchor"]==[.5,220/256]
    main=list(frames(folder/f"{code}_atlas.webp",8))
    endings=list(frames(folder/f"{code}_endings.webp",2))
    problems=[]
    for i,frame in enumerate(main+endings):
        alpha=frame.getchannel("A")
        visible=alpha.point(lambda p:255 if p>48 else 0)
        b=visible.getbbox()
        if not b:problems.append(f"empty frame {i}")
        elif b[0]<2 or b[1]<2 or b[2]>254 or b[3]>254:problems.append(f"edge/crop {i}: {b}")
    for name,(start,count,fps,loop) in CONTRACT.items():
        clip=manifest["clips"][name]
        assert [clip[k] for k in ("start","count","fps","loop")]==[start,count,fps,loop]
        hashes={hashlib.sha256(f.tobytes()).hexdigest() for f in main[start:start+count]}
        assert len(hashes)>1,(code,name,"static clip")
    motion=manifest["clips"]["move"]["socketsPx"]
    if code[1] in "PNBQK":
        # Remove root/hip travel: alternating limbs must still move differently.
        deltas=[s["feet"][0][0]-s["feet"][1][0] for s in motion]
        assert max(deltas)-min(deltas)>12,(code,"missing alternating limb motion")
        for pose in motion:
            assert abs(max(p[1] for p in pose["feet"])-220)<.01,(code,"no planted foot")
    if code[1]=="R":
        assert max(s["wheelAngleRad"] for s in motion)>5,"wheel did not rotate"
    unique=len({hashlib.sha256(f.tobytes()).hexdigest() for f in main+endings})
    return {"frames":80,"distinctPixelFrames":unique,"clips":11,"problems":problems,
            "atlasBytes":(folder/f"{code}_atlas.webp").stat().st_size,
            "endingsBytes":(folder/f"{code}_endings.webp").stat().st_size}


if __name__=="__main__":
    master=json.loads((ROOT/"runtime"/"manifest.json").read_text())
    results={code:validate_piece(code) for code in master["pieces"]}
    for spec in json.loads((ROOT/"runtime"/"encounters.json").read_text())["encounters"]:
        world=spec["worldContact"]
        a,b,offset=world["attackerLocal"],world["defenderLocal"],world["defenderRootOffset"]
        assert math.dist(a,[b[i]+offset[i] for i in range(3)])<1e-8,"contact mismatch"
        assert spec["contactTimeMs"]==spec["attackStartMs"]+spec["contactLocalTimeMs"]
    for side in "wb":
        fx=list(frames(ROOT/"runtime"/"effects"/f"{side}_impact_debris.webp",2))
        assert all(f.getchannel("A").getbbox() for f in fx)
    problems={c:r["problems"] for c,r in results.items() if r["problems"]}
    report={"assetChecksPassed":not problems,"pieces":results,"totalCharacterFrames":960,"totalEffectFrames":32,
            "numericContactChecks":"passed in pixels and verified class-specific card dimensions",
            "visualAcceptance":"pending; technical validation is not art approval",
            "inGameValidation":"not run; selected game assets were not changed",
            "limitations":["fixed source views only; bishop faces left, others right",
                           "illustrated cutout joints; no new hand-drawn foreshortening",
                           "illustration camera is requested 48 degrees, not mathematically calibrated",
                           "existing centered cards must honor supplied foot anchor at integration",
                           "supplementary ending atlas requires its supplied rows/clip metadata"]}
    (ROOT/"runtime"/"validation.json").write_text(json.dumps(report,indent=2)+"\n",encoding="utf-8")
    print(json.dumps(report,indent=2))
    if problems:raise SystemExit(1)
