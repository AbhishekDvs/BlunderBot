"""Render illustrated articulated cutouts, not procedural character geometry.

Joint hierarchy, IK foot plants, attack key poses and fragment trajectories are
editable here. Source texture identities never change between frames.
"""
import json
import math
import hashlib
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
S = 3
CONTRACT = {
    "idle": (0, 8, 10, True), "move": (8, 12, 14, True),
    "attack_anticipation": (20, 4, 12, False), "attack": (24, 8, 16, False),
    "defend": (32, 6, 12, False), "hit": (38, 4, 16, False),
    "stagger": (42, 6, 12, False), "defeat": (48, 8, 12, False),
    "victory": (56, 8, 12, False),
}


def point(a,b,t):
    return a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t


def knee(hip, foot, l1=38, l2=38, facing=1):
    dx,dy=foot[0]-hip[0], foot[1]-hip[1]
    dist=min(math.hypot(dx,dy), l1+l2-0.01)
    along=(l1*l1-l2*l2+dist*dist)/(2*dist)
    side=math.sqrt(max(0,l1*l1-along*along))
    # Both human knees bend toward the facing direction.
    return hip[0]+dx/dist*along+facing*dy/dist*side, hip[1]+dy/dist*along-facing*dx/dist*side


def planted_stride(hip_x,phase,stride,lift):
    p=(phase/math.tau)%1
    if p<.5:
        # Linear stance travel cancels linear root traversal exactly when the
        # player advances by 4*stride per cycle. No sine-wave foot sliding.
        return hip_x+stride*(1-4*p),220
    u=(p-.5)*2
    eased=u*u*(3-2*u)
    return hip_x-stride+2*stride*eased,220-lift*math.sin(math.pi*u)


class Rig:
    def __init__(self, code):
        self.code=code
        self.parts=[]
        with Image.open(ROOT/"source"/f"{code}_parts.png") as sheet:
            if sheet.mode != "RGBA" or sheet.getchannel("A").getextrema() != (0,255):
                raise ValueError(f"{code}: transparent RGBA required")
            rows=4 if code[1]=="N" else (2 if code[1]=="R" else 3)
            for i in range(4*rows):
                x,y=i%4,i//4
                tile=sheet.crop((round(x*sheet.width/4),round(y*sheet.height/rows),round((x+1)*sheet.width/4),round((y+1)*sheet.height/rows)))
                bounds=tile.getchannel("A").point(lambda p: 255 if p>96 else 0).getbbox()
                if bounds is None: raise ValueError(f"{code}: missing part {i}")
                self.parts.append(tile.crop(bounds))
        if code[1]=="N":
            with Image.open(ROOT/"source"/f"{code}_lance.png") as accessory:
                bounds=accessory.getchannel("A").point(lambda p: 255 if p>96 else 0).getbbox()
                self.parts[12]=accessory.crop(bounds)
        if code[1] in "KQ":
            with Image.open(ROOT/"source"/"royal_torsos.png") as royals:
                col=0 if code[0]=="w" else 1
                row=0 if code[1]=="K" else 1
                tile=royals.crop((round(col*royals.width/2),round(row*royals.height/2),round((col+1)*royals.width/2),round((row+1)*royals.height/2)))
                bounds=tile.getchannel("A").point(lambda p:255 if p>96 else 0).getbbox()
                self.parts[0]=tile.crop(bounds)
        if code[1] in "KQB":
            # Rig connectors are overlap tabs, never garment hems. Exclude the
            # lower connector from the long cloth panel's visible trim box.
            for idx in (1,2):
                panel=self.parts[idx]
                self.parts[idx]=panel.crop((0,0,panel.width,round(panel.height*.82)))
        self.base_count=len(self.parts)
        torso=self.parts[0]
        # Six independently moving shell texture pieces used only during break.
        for row in range(3):
            for col in range(2):
                self.parts.append(torso.crop((round(col*torso.width/2),round(row*torso.height/3),round((col+1)*torso.width/2),round((row+1)*torso.height/3))))
        self.sockets={}

    def draw(self, canvas, idx, src1,src2, dst1,dst2, opacity=1):
        im=self.parts[idx]
        p=(src1[0]*im.width,src1[1]*im.height)
        q=(src2[0]*im.width,src2[1]*im.height)
        a=complex(q[0]-p[0],q[1]-p[1])
        b=complex((dst2[0]-dst1[0])*S,(dst2[1]-dst1[1])*S)
        z=b/a
        inv=1/z
        origin=complex(dst1[0]*S,dst1[1]*S)-z*complex(*p)
        off=-origin*inv
        mapping=lambda uv: ((origin+z*complex(uv[0]*im.width,uv[1]*im.height)).real/S,
                            (origin+z*complex(uv[0]*im.width,uv[1]*im.height)).imag/S)
        if opacity<=0:return mapping
        corners=[origin+z*complex(x,y) for x in (0,im.width) for y in (0,im.height)]
        x0=max(0,math.floor(min(c.real for c in corners))-2)
        y0=max(0,math.floor(min(c.imag for c in corners))-2)
        x1=min(canvas.width,math.ceil(max(c.real for c in corners))+2)
        y1=min(canvas.height,math.ceil(max(c.imag for c in corners))+2)
        if x1<=x0 or y1<=y0:return mapping
        localoff=off+inv*complex(x0,y0)
        layer=im.transform((x1-x0,y1-y0),Image.Transform.AFFINE,(inv.real,-inv.imag,localoff.real,inv.imag,inv.real,localoff.imag),Image.Resampling.BICUBIC)
        if opacity<1:
            layer.putalpha(layer.getchannel("A").point(lambda a: round(a*opacity)))
        canvas.alpha_composite(layer,(x0,y0))
        return mapping

    def human(self, clip, i, count):
        t=i/max(1,count-1)
        phase=2*math.pi*i/count
        bob=math.sin(phase)*0.7
        adviser=self.code[1]=="B"
        royal=self.code[1] in "KQ"
        facing=-1 if adviser else 1
        lean=0
        crouch=0
        shield=0
        spear=0
        reach=0
        # Authored attack silhouettes: draw back, coil, extend, contact, recoil.
        if clip=="attack_anticipation":
            crouch=4*t; lean=-4*t; spear=-0.4*t; shield=-0.5*t
        elif clip=="attack":
            reach=[-2,-5,1,14,23,17,7,0][i]
            spear=[-0.4,-0.7,0.2,1.1,1.5,1.3,0.6,0][i]
            crouch=[4,6,4,2,3,3,1,0][i]
            lean=[-4,-6,0,4,7,4,2,0][i]
        elif clip=="defend":
            shield=math.sin(math.pi*t)*1.2+0.4; crouch=4*math.sin(math.pi*t)
        elif clip in ("hit","stagger"):
            lean=-math.sin(math.pi*t)*12; crouch=math.sin(math.pi*t)*8
            spear=-math.sin(math.pi*t)*0.4
        elif clip=="victory":
            spear=-math.sin(math.pi*t/2)*.45; shield=math.sin(math.pi*t/2)*0.35
        elif clip=="defeat_acknowledgement":
            lean=5*t; spear=0.8*t; crouch=2*t
        elif clip=="draw_disengagement":
            spear=0.8*t; shield=-0.4*t
        if adviser and clip=="defend":
            spear=-.65*math.sin(math.pi*t*.5)
        if adviser and clip=="hit":
            spear=-.65*(1-t)-math.sin(math.pi*t)*.3
            shield=.4*(1-t)
        canvas=Image.new("RGBA",(256*S,256*S))
        hip=(124+lean,147+crouch+bob)
        torso_top=(124+lean*1.7,44+crouch+bob)
        farhip=(hip[0]-6,hip[1])
        nearhip=(hip[0]+8,hip[1])
        # Actual alternating thigh/calf articulation. Roots remain in place.
        feet=[]
        for j,h in enumerate((farhip,nearhip)):
            if clip=="move":
                p=phase+j*math.pi
                stride={"P":19,"B":13,"Q":15,"K":10}[self.code[1]]
                foot=planted_stride(h[0],p,stride,10 if royal else 15)
            else:
                foot=(h[0]+(-11 if j==0 else 15)+reach*(0.12 if j==0 else 0.45),220)
            feet.append(foot)
        defeat=max(0,(t-0.17)/0.83) if clip=="defeat" else 0
        if defeat:
            # A separated sculpted shell breaks into its actual layered pieces.
            # No whole-character shrinking. Fragments have independent trajectories.
            hip=(hip[0]-defeat*12,hip[1]+defeat*28)
            torso_top=(torso_top[0]-defeat*23,torso_top[1]+defeat*42)
        flip=lambda p: (256-p[0],p[1]) if adviser else p
        def paint(idx,p,q,a,b,opacity=1):
            return self.draw(canvas,idx,p,q,flip(a),flip(b),opacity)
        self.sockets={"feet":[flip(f) for f in feet],"hip":flip(hip)}
        shell=max(0,1-defeat*2.5)
        for j,(h,f) in enumerate(zip((farhip,nearhip),feet)):
            k=knee(h,f)
            paint(3+j,(.36,.10),(.36,1),k,f,shell)
            # Long layered garments overlap the articulated knees/calves.
            panel=point(k,f,.76 if royal else (.48 if adviser else 0))
            paint(1+j,(.5,.10),(.5,.90),h,panel,shell)
        swing=math.sin(phase)*4 if clip=="move" else 0
        shoulder=(hip[0]-22,hip[1]-49)
        elbow=(shoulder[0]-25+reach*.4+swing,shoulder[1]+21)
        if adviser:
            shoulder=(hip[0]+19,hip[1]-49)
            elbow=(hip[0]+30+reach*.3,hip[1]-26-shield*5)
            if clip=="defend":elbow=(elbow[0],elbow[1]+12)
            if clip=="hit":elbow=(elbow[0],elbow[1]+12*(1-t))
        if clip=="victory":
            elbow=(elbow[0]+t*6,elbow[1]-t*23)
        hand=(elbow[0]+24+reach*.5,elbow[1]+4)
        paint(6,(.5,.15),(.5,.87),shoulder,elbow,shell)
        v=(hand[0]-elbow[0],hand[1]-elbow[1])
        hand=(elbow[0]+v[0]*math.cos(spear)-v[1]*math.sin(spear),elbow[1]+v[0]*math.sin(spear)+v[1]*math.cos(spear))
        wsrc=((.95,.6),(.30,.6),(.27,.02)) if adviser else (((.05,.73),(.8,.73),(.94,.02)) if royal else ((.06,.64),(.77,.64),(.77,.02)))
        gripmap=paint(8,wsrc[0],wsrc[1],elbow,hand,0)
        self.sockets["weaponTip"]=gripmap(wsrc[2])
        if adviser:
            self.sockets["staffSegment"]=[gripmap((.27,.02)),gripmap((.27,.97))]
        if royal:
            paint(9,(.5,.04),(.5,.94),(hip[0]-17,hip[1]-52),(hip[0]-29+math.sin(phase-.8)*5,212),shell)
        elif adviser:
            paint(9,(.5,.04),(.5,.94),(hip[0]-8,hip[1]-42),(hip[0]-22+math.sin(phase-.8)*4,203),shell)
        else:
            paint(9,(.5,.04),(.5,.94),(hip[0]+2,hip[1]-8),(hip[0]+7+math.sin(phase-.8)*5,hip[1]+31),shell)
        paint(0,(.5,0),(.5,1),torso_top,hip,shell)
        paint(8,wsrc[0],wsrc[1],elbow,hand,shell)
        sh=(hip[0]+19,hip[1]-48)
        el=(sh[0]+8-shield*8-swing*.6,sh[1]+23-shield*8)
        wrist=(el[0]+18,el[1]+10-shield*15)
        paint(5,(.5,.15),(.5,.87),sh,el,shell)
        lsrc=((.96,.80),(.18,.34)) if adviser else (((.06,.35),(.9,.52)) if royal else ((.07,.18),(.43,.43)))
        palm=paint(7,lsrc[0],lsrc[1],el,wrist,shell)
        self.sockets["defenseContact"]=palm((.1,.4) if adviser else (.7,.5))
        if defeat:
            for j in range(6):
                col,row=j%2,j//2
                x=105+col*29+(col-.5)*defeat*56
                y=60+row*33-(25+j*4)*math.sin(math.pi*defeat)+defeat*(136-row*20)
                paint(self.base_count+j,(.1,.5),(.9,.5),(x-9,y),(x+9,y+(j-2)*defeat*4),min(1,defeat*5))
            for j in range(5):
                x=123+(j-2)*defeat*24
                y=155-(20+j*6)*math.sin(math.pi*defeat)+defeat*61
                paint(10,(.1,.5),(.9,.5),(x-7,y),(x+7,y+(j-2)*defeat*3),min(1,defeat*5))
            paint(11,(.1,.5),(.9,.5),(108-defeat*8,199),(148+defeat*8,199),math.sin(math.pi*defeat)*.7)
        frame=canvas.resize((256,256),Image.Resampling.LANCZOS)
        return frame,self.sockets.copy()

    def cavalry(self,clip,i,count):
        t=i/max(1,count-1); phase=2*math.pi*i/count
        moving=clip=="move"
        bodybob=-2*math.cos(phase*2) if moving else math.sin(phase)*.5
        anticipation=t if clip=="attack_anticipation" else 0
        if clip=="defend":anticipation=.2+.6*math.sin(math.pi*t)
        strike=[0,.1,.3,.8,1,.7,.3,0][i] if clip=="attack" else 0
        impact=math.sin(math.pi*t) if clip in ("hit","stagger") else 0
        defeat=t if clip=="defeat" else 0
        alive=max(0,1-defeat*2.5)
        lean=3*strike-4*anticipation-6*impact
        canvas=Image.new("RGBA",(256*S,256*S))
        legs=[]
        # Four independent two-bone chains; no transformed whole-horse walk.
        for j,(x,upper,lower,offset) in enumerate(((78,6,7,1.4+math.pi),(153,8,9,math.pi),(84,2,3,1.4),(160,4,5,0))):
            hip=(x+lean,167+bodybob)
            p=phase+offset
            foot=planted_stride(x,p,19,16) if moving else (x+(-8 if j%2==0 else 3),220-(anticipation*8+strike*12 if j%2 else 0))
            k=knee(hip,foot,29,29, -1 if j%2==0 else 1)
            self.draw(canvas,upper,(.5,.09),(.5,.90),hip,k,alive)
            self.draw(canvas,lower,(.4,.06),(.4,1),k,foot,alive)
            legs.append(foot)
        self.draw(canvas,10,(.5,.05),(.5,.95),(63+lean,148+bodybob),(53+math.sin(phase-.5)*6,193+bodybob),alive)
        self.draw(canvas,0,(.05,.5),(.95,.5),(62+lean,157+bodybob),(164+lean,157+bodybob),alive)
        self.draw(canvas,15,(.5,.05),(.5,.95),(116+lean,91+bodybob),(90+math.sin(phase-.6)*7,151+bodybob),alive)
        headshift=math.sin(phase+.3)*3 if moving else -anticipation*6+strike*5-impact*4
        self.draw(canvas,1,(.25,.94),(.62,.25),(159+lean,150+bodybob),(185+headshift+lean,101+bodybob),alive)
        riderhip=(120+lean,128+bodybob)
        riderhead=(116+lean*2,53+bodybob+(math.sin(phase+.8)*1.5 if moving else 0))
        self.draw(canvas,11,(.5,.01),(.5,.98),riderhead,riderhip,alive)
        self.draw(canvas,14,(.5,.07),(.5,.94),(riderhip[0]-3,riderhip[1]-1),(riderhip[0]+4,171+bodybob),alive)
        shoulder=(113+lean,96+bodybob)
        elbow=(112+lean,119+bodybob-5*anticipation)
        angle=-.25*anticipation+1.5*strike
        if clip=="victory":
            elbow=(elbow[0],elbow[1]-8*t);angle=-.15*t
        if clip in ("defeat_acknowledgement","draw_disengagement"):
            angle=.75*t
        hand=(elbow[0]+24*math.cos(angle),elbow[1]+24*math.sin(angle))
        self.draw(canvas,13,(.5,.13),(.5,.90),shoulder,elbow,alive)
        mapping=self.draw(canvas,12,(.05,.75),(.86,.75),elbow,hand,alive)
        tip=mapping((.86,.005))
        self.sockets={"feet":legs,"hip":riderhip,"weaponTip":tip,"horseHead":[185+headshift+lean,101+bodybob]}
        if defeat:
            for j in range(6):
                x=72+(j%2)*62+(j%2-.5)*45*defeat
                y=130+(j//2)*20+defeat*50-40*math.sin(math.pi*defeat)
                self.draw(canvas,self.base_count+j,(.1,.5),(.9,.5),(x-14,y),(x+14,y+(j-3)*7*defeat),min(1,defeat*5))
        return canvas.resize((256,256),Image.Resampling.LANCZOS),self.sockets.copy()

    def fortress(self,clip,i,count):
        t=i/max(1,count-1);phase=2*math.pi*i/count
        moving=clip=="move"
        angle=phase if moving else 0
        rock=math.sin(phase)*1.8 if moving else math.sin(phase)*.4
        ram=[-2,-4,0,10,22,14,5,0][i] if clip=="attack" else 0
        if clip=="attack_anticipation":ram=-5*t
        if clip=="defend":ram=-7*math.sin(math.pi*t);rock=-2*math.sin(math.pi*t)
        if clip in ("hit","stagger"):rock=-math.sin(math.pi*t)*6
        defeat=t if clip=="defeat" else 0
        alive=max(0,1-defeat*2)
        canvas=Image.new("RGBA",(256*S,256*S))
        farcenter=(160+defeat*20,202+defeat*7)
        self.wheel(canvas,3,farcenter,(16,20),angle,alive)
        self.draw(canvas,5,(.05,.5),(.95,.5),(92+ram,177),(184+ram,177),alive)
        self.draw(canvas,0,(.5,.02),(.5,.98),(126+rock,90),(126,197),alive)
        self.draw(canvas,1,(.1,.5),(.9,.5),(73+rock,87),(178+rock,87),alive)
        flagtilt=math.sin(phase)*3
        if clip=="victory":flagtilt+=t*9
        if clip in ("defeat_acknowledgement","draw_disengagement"):flagtilt+=t*18
        self.draw(canvas,4,(.08,.98),(.08,.04),(107+rock,81),(108+rock+flagtilt,43),alive)
        # Elliptical wheel spins in its own plane; tower is never spun with it.
        center=(99-defeat*27,202+defeat*7)
        self.wheel(canvas,2,center,(18,22),angle,alive)
        if defeat:
            for j in range(6):
                x=100+(j%2)*40+(j%2-.5)*defeat*60
                y=105+(j//2)*30-35*math.sin(math.pi*defeat)+defeat*(100-j//2*22)
                self.draw(canvas,self.base_count+j,(.1,.5),(.9,.5),(x-14,y),(x+14,y+(j-3)*defeat*5),min(1,defeat*5))
            self.draw(canvas,6,(.1,.5),(.9,.5),(98,208),(154,208),min(1,defeat*3))
            self.draw(canvas,7,(.1,.5),(.9,.5),(97,195),(159,195),math.sin(math.pi*defeat)*.6)
        return canvas.resize((256,256),Image.Resampling.LANCZOS),{"weaponTip":[184+ram,177],"feet":[[99,220],[160,220]],"wheelAngleRad":angle}

    def wheel(self,canvas,idx,center,radii,angle,opacity):
        # Deproject, spin spokes, reproject. The elliptical wheel silhouette
        # keeps its orientation instead of rotating like a flat coin.
        im=self.parts[idx];cx,cy=center;rx,ry=radii
        co,si=math.cos(angle),math.sin(angle)
        a=im.width*.5*co/(rx*S);b=im.width*.5*si/(ry*S)
        d=-im.height*.5*si/(rx*S);e=im.height*.5*co/(ry*S)
        c=im.width*.5-a*cx*S-b*cy*S;f=im.height*.5-d*cx*S-e*cy*S
        x0=max(0,math.floor((cx-rx*1.5)*S));y0=max(0,math.floor((cy-ry*1.5)*S))
        x1=min(canvas.width,math.ceil((cx+rx*1.5)*S));y1=min(canvas.height,math.ceil((cy+ry*1.5)*S))
        layer=im.transform((x1-x0,y1-y0),Image.Transform.AFFINE,(a,b,c+a*x0+b*y0,d,e,f+d*x0+e*y0),Image.Resampling.BICUBIC)
        if opacity<1:layer.putalpha(layer.getchannel("A").point(lambda p:round(p*opacity)))
        canvas.alpha_composite(layer,(x0,y0))

    def render(self,clip,i,count):
        if self.code[1]=="N":return self.cavalry(clip,i,count)
        if self.code[1]=="R":return self.fortress(clip,i,count)
        return self.human(clip,i,count)


def export(code):
    rig=Rig(code)
    out=ROOT/"runtime"/code
    out.mkdir(parents=True,exist_ok=True)
    review=ROOT/"review"
    review.mkdir(exist_ok=True)
    atlas=Image.new("RGBA",(2048,2048))
    manifests={}
    allframes=[]
    for clip,(start,count,fps,loop) in CONTRACT.items():
        frames=[]; sockets=[]
        for i in range(count):
            frame,pts=rig.render(clip,i,count)
            atlas.alpha_composite(frame,(((start+i)%8)*256,((start+i)//8)*256))
            frames.append(frame); sockets.append(pts)
            allframes.append((clip,i,frame))
        manifests[clip]={"start":start,"count":count,"fps":fps,"loop":loop,
                         "frameDurationsMs":[1000/fps]*count,"socketsPx":sockets}
        if clip=="attack":manifests[clip]["contactFrame"]=4
        previews=[]
        for f in frames:
            bg=Image.new("RGBA",f.size,"#756f60"); bg.alpha_composite(f)
            previews.append(bg.convert("RGB"))
        previews[0].save(review/f"{code}_{clip}.gif",save_all=True,append_images=previews[1:],duration=round(1000/fps),loop=0,disposal=2)
    atlas.save(out/f"{code}_atlas.webp",lossless=True,method=0)
    ending=Image.new("RGBA",(2048,512))
    ending_clips={}
    for j,name in enumerate(("defeat_acknowledgement","draw_disengagement")):
        sockets=[]
        for i in range(8):
            f,pts=rig.render(name,i,8)
            ending.alpha_composite(f,(i*256,j*256));sockets.append(pts)
        ending_clips[name]={"start":j*8,"count":8,"fps":12,"loop":False,"socketsPx":sockets}
    ending.save(out/f"{code}_endings.webp",lossless=True,method=0)
    manifest={"pieceCode":code,"cols":8,"rows":8,"cell":256,"image":f"./{code}_atlas.webp",
              "clips":manifests,"anchor":[.5,220/256],"baselinePx":220,"faction":"white" if code[0]=="w" else "black",
              "direction":"screen-left-three-quarter" if code[1]=="B" else "screen-right-three-quarter","cameraAngleDeg":48,
              "cameraValidation":"art direction requested; board verification pending",
              "technique":"illustrated hierarchical cutout rig; independent thigh/calf and arm hinges; IK foot plants",
              "authoredFrameCount":80,"runtimeFrameCount":64,"endingFrameCount":16,
              "sourceImage":f"../../source/{code}_parts.png",
              "sourceSha256":hashlib.sha256((ROOT/"source"/f"{code}_parts.png").read_bytes()).hexdigest(),
              "sourceWeaponSha256":hashlib.sha256((ROOT/"source"/f"{code}_lance.png").read_bytes()).hexdigest() if code[1]=="N" else None,
              "sourceTorsoSha256":hashlib.sha256((ROOT/"source"/"royal_torsos.png").read_bytes()).hexdigest() if code[1] in "KQ" else None,
              "traversal":{"nominalStridePx":({"P":76,"B":52,"Q":60,"K":40,"N":76,"R":math.tau*18}[code[1]]),
                           "sync":"advance root linearly by nominalStridePx per move cycle at 256px card size; use class card width/256 for world units",
                           "stance":"grounded leg trajectory is linear; swing lifts and bends separate joints"},
              "endings":{"image":f"./{code}_endings.webp","cols":8,"rows":2,"cell":256,"clips":ending_clips},
              "status":"art review candidate; integration not approved",
              "checkmatePolicy":"play defeat_acknowledgement, NEVER defeat, for a checked king"}
    (out/f"{code}_clip.json").write_text(json.dumps(manifest,indent=2)+"\n",encoding="utf-8")
    sheet=Image.new("RGB",(8*256,8*280),"#756f60");d=ImageDraw.Draw(sheet)
    for j,(clip,i,frame) in enumerate(allframes):
        x,y=(j%8)*256,(j//8)*280;sheet.paste(frame,(x,y),frame);d.text((x+4,y+258),f"{clip}:{i}",fill="white")
    sheet.save(review/f"{code}_rig_poses.jpg")
    print(f"{code}: 64 rig frames + 16 ending frames exported")


if __name__=="__main__":
    import sys
    for code in sys.argv[1:] or ["wP"]:export(code)
