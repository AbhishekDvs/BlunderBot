"""Experimental 2.5D concept cutouts from the existing illustrated source sheet.
NOT 3D models, NOT animation atlas frames, and NOT production-approved sprites.
"""
from pathlib import Path
from PIL import Image, ImageFilter, ImageEnhance, ImageDraw, ImageFont
import numpy as np, cv2
ROOT=Path(__file__).resolve().parents[1]
ORIG=ROOT/'reference'/'illustrative_white_army_sheet.png'
SRC=ROOT/'reference'/'illustrative_white_army_sheet.png'
SRC.parent.mkdir(exist_ok=True)
if not SRC.exists():
 SRC.write_bytes(ORIG.read_bytes())
img=Image.open(SRC).convert('RGB')
rectangles={
 'wK':(14,6,466,452),'wQ':(520,6,999,450),'wB':(1021,6,1524,451),
 'wN':(12,508,471,946),'wR':(514,504,1024,940),'wP':(1039,513,1527,943)
}
O=ROOT/'reference'/'cutouts';O.mkdir(exist_ok=True)
for code,rect in rectangles.items():
 crop=img.crop(rect);a=np.array(crop)
 h,w=a.shape[:2]
 mask=np.zeros((h,w),np.uint8)
 # GrabCut rectangle initializes likely foreground, but leaves safe border as background.
 fg_rect=(8,8,w-16,h-16)
 bgr=cv2.cvtColor(a,cv2.COLOR_RGB2BGR)
 bg=np.zeros((1,65),np.float64);fg=np.zeros((1,65),np.float64)
 cv2.grabCut(bgr,mask,fg_rect,bg,fg,5,cv2.GC_INIT_WITH_RECT)
 binary=np.where((mask==2)|(mask==0),0,255).astype('uint8')
 # Keep only principal connected components, preserving narrow spear sections if contiguous.
 num,labels,stats,centroids=cv2.connectedComponentsWithStats(binary,8)
 if num>1:
  largest=np.argsort(stats[1:,cv2.CC_STAT_AREA])[::-1][:3]+1
  binary=np.where(np.isin(labels,largest),binary,0).astype('uint8')
 # Soft edge 1px. Note: some dark clothing details may be lost by segmentation.
 binary=cv2.GaussianBlur(binary,(3,3),.6)
 rgba=np.dstack([a,binary]);out=Image.fromarray(rgba,'RGBA')
 out.save(O/(code+'_concept_alpha.png'))
 for sz in [256,512]:
  o=out.copy();o.thumbnail((sz,sz),Image.Resampling.LANCZOS)
  canvas=Image.new('RGBA',(sz,sz),(0,0,0,0));canvas.alpha_composite(o,((sz-o.width)//2,(sz-o.height)//2))
  canvas.save(O/(code+f'_concept_{sz}.png'))
 print(code,'segmented',flush=True)
# contact on real board square colors, for assessing size
preview=Image.new('RGB',(960,440),(30,30,34));d=ImageDraw.Draw(preview)
labels={'wK':'KING','wQ':'QUEEN','wB':'BISHOP','wN':'KNIGHT','wR':'ROOK','wP':'PAWN'}
for idx,c in enumerate(['wK','wQ','wB','wN','wR','wP']):
 x=idx*160;y=28
 color=(197,164,119) if idx%2==0 else (76,53,41)
 d.rectangle((x,0,x+159,440),fill=color)
 piece=Image.open(O/(c+'_concept_256.png')).convert('RGBA');piece=piece.resize((150,150))
 preview.paste(piece,(x+5,90),piece)
 d.text((x+36,270),labels[c],fill=(255,255,255))
 d.text((x+17,309),'Concept only',fill=(255,255,255))
preview.save(ROOT/'previews'/'2p5d-illustrative-proxy.png')
