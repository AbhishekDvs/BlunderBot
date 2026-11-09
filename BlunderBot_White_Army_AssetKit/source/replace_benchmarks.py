from PIL import Image,ImageDraw
import numpy as np,cv2
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
SRC=Image.open(ROOT/'reference'/'astra_original_three_class_benchmark.png').convert('RGB')
OUT=ROOT/'reference'/'approved_identity_concept_cutouts'
rects={'wP':(85,97,420,862),'wN':(460,78,1020,867),'wQ':(1055,4,1505,861)}
for code,r in rects.items():
 c=SRC.crop(r);a=np.array(c);h,w=a.shape[:2];mask=np.zeros((h,w),np.uint8)
 cv2.grabCut(cv2.cvtColor(a,cv2.COLOR_RGB2BGR),mask,(5,5,w-10,h-10),np.zeros((1,65),np.float64),np.zeros((1,65),np.float64),7,cv2.GC_INIT_WITH_RECT)
 alpha=np.where((mask==2)|(mask==0),0,255).astype(np.uint8)
 num,labels,stats,cent=cv2.connectedComponentsWithStats(alpha,8)
 if num>1:
  largest=np.argsort(stats[1:,cv2.CC_STAT_AREA])[::-1][:4]+1
  alpha=np.where(np.isin(labels,largest),alpha,0).astype(np.uint8)
 alpha=cv2.GaussianBlur(alpha,(3,3),.6)
 Image.fromarray(np.dstack([a,alpha])).save(OUT/(code+'_concept.png'))
 c.save(OUT/(code+'_unmasked_reference.jpg'),quality=90)
 print(code,int((alpha>0).sum()),'px alpha')
preview=Image.new('RGB',(1200,520),(33,34,39));d=ImageDraw.Draw(preview)
for i,c in enumerate(['wK','wQ','wB','wN','wR','wP']):
 im=Image.open(OUT/(c+'_concept.png')).convert('RGBA')
 im.thumbnail((196,413))
 x=i*200+(200-im.width)//2
 preview.paste(im,(x,25),im)
 d.text((i*200+20,470),c+' visual reference',fill=(240,238,234))
preview.save(ROOT/'previews'/'approved-identities-2p5d-concepts.png')
