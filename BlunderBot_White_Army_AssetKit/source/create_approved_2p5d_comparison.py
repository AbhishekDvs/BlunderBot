from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import numpy as np,cv2
ROOT=Path(__file__).resolve().parents[1]
p=ROOT/'reference'/'approved_six_class_concept_board.png'
img=Image.open(p).convert('RGB')
OUT=ROOT/'reference'/'approved_identity_concept_cutouts';OUT.mkdir(exist_ok=True)
# Crops in key art. Some interpenetration of background art is possible; conceptual ONLY.
rects={
'wK':(315,0,544,353),
'wQ':(510,0,797,351),
'wB':(785,0,1015,351),
'wN':(1010,0,1253,355),
'wR':(1235,9,1461,355),
'wP':(1438,0,1663,353)}
for code, r in rects.items():
 c=img.crop(r); a=np.array(c);h,w=a.shape[:2]
 # initialize interior as probable foreground, outer edge probable background.
 mask=np.zeros((h,w),np.uint8)
 cv2.grabCut(cv2.cvtColor(a,cv2.COLOR_RGB2BGR),mask,(8,8,w-16,h-16),np.zeros((1,65),np.float64),np.zeros((1,65),np.float64),5,cv2.GC_INIT_WITH_RECT)
 alpha=np.where((mask==2)|(mask==0),0,255).astype(np.uint8)
 # GrabCut cannot guarantee perfect extraction in complex background. Keep raw crop too.
 Image.fromarray(np.dstack([a,cv2.GaussianBlur(alpha,(3,3),.6)])).save(OUT/(code+'_concept.png'))
 c.save(OUT/(code+'_unmasked_reference.jpg'),quality=90)
print('saved all six visual comparisons')
