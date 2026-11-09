#!/usr/bin/env python3
"""BlunderBot white army: reproducible sculptural **blockout** GLB source.

Creates six distinct real glTF 2.0 3D meshes, with unified scale,
object naming, PBR materials, weapon groups and semantic sockets.
This is a geometry/rigging handoff, NOT an artist-sculpted production release.
Requires: numpy, trimesh, scipy.
"""
from pathlib import Path
import numpy as np, math, trimesh
from scipy.spatial.transform import Rotation

DEST = Path(__file__).resolve().parents[1] / 'models'
DEST.mkdir(parents=True, exist_ok=True)
PI=math.pi
palette = {
 'stone':('#E8DDC5',.82,0.),'sandstone':('#C7A47B',.87,0.),
 'bone':('#DBCDB4',.92,0.),'gold':('#B68A3E',.38,.90),
 'bronze':('#82613D',.50,.85),'saffron':('#C67E2E',.81,0.),
 'crimson':('#8D302B',.84,0.),'green':('#3E5943',.86,0.),
 'steel':('#89908B',.35,.92),'wood':('#62442F',.73,0.),
 'shadow':('#534332',.85,0.),'darkgold':('#78582D',.50,.80),
 'vermillion':('#B84B32',.75,0.),'linen':('#EFE3CD',.88,0.)
}
MAT={}
for k,(h,rough,metal) in palette.items():
 rgb=[int(h[i:i+2],16) for i in (1,3,5)]
 MAT[k] = trimesh.visual.material.PBRMaterial(name=k, baseColorFactor=rgb+[255],roughnessFactor=rough,metallicFactor=metal, doubleSided=True)


def set_material(m, name):
 m.visual=trimesh.visual.TextureVisuals(material=MAT[name]);return m


def tform(location=(0,0,0),rotate=None):
 M=np.eye(4);M[:3,3]=location
 if rotate is not None: M[:3,:3]=Rotation.from_euler('xyz',rotate).as_matrix()
 return M

class Model:
 def __init__(self,code):
  self.s=trimesh.Scene();self.code=code
  self.s.graph.update(frame_from=self.s.graph.base_frame,frame_to='Army_Root',matrix=np.eye(4))
 def node(self,name,location=(0,0,0), parent='Army_Root'):
  self.s.graph.update(frame_from=parent,frame_to=name,matrix=tform(location))
 def put(self,mesh,name,mat,parent='Army_Root',location=(0,0,0),rot=None):
  set_material(mesh,mat)
  self.s.add_geometry(mesh,node_name=name,geom_name=name,parent_node_name=parent,transform=tform(location,rot))
  return name
 def orb(self,name,mat,pos,radii,sub=2,parent='Army_Root'):
  m=trimesh.creation.icosphere(subdivisions=sub,radius=1);m.apply_scale(radii);return self.put(m,name,mat,parent,pos)
 def tube(self,name,mat,pts,rad, parent='Army_Root',sides=12):
  pts=np.asarray(pts,dtype=float)
  if isinstance(rad,(int,float)):rs=np.full(len(pts),float(rad))
  else: rs=np.array(rad,dtype=float)
  tang=[]
  for i in range(len(pts)):
   t=pts[min(i+1,len(pts)-1)]-pts[max(i-1,0)];t=t/(np.linalg.norm(t)+1e-9);tang.append(t)
  verts=[]
  for i,p in enumerate(pts):
   t=tang[i]; arbitrary=np.array([1.,0.,0.]) if abs(t[0])<.85 else np.array([0.,0.,1.])
   u=np.cross(t,arbitrary);u=u/(np.linalg.norm(u)+1e-8);v=np.cross(t,u)
   for j in range(sides):
    angle=j*2*PI/sides;verts.append(p+rs[i]*(u*math.cos(angle)+v*math.sin(angle)))
  faces=[]
  for i in range(len(pts)-1):
   for j in range(sides):
    a=i*sides+j;b=i*sides+(j+1)%sides;c=(i+1)*sides+(j+1)%sides;d=(i+1)*sides+j
    faces.extend([[a,b,c],[a,c,d]])
  for j in range(1,sides-1):faces.extend([[0,j+1,j],[(len(pts)-1)*sides,(len(pts)-1)*sides+j,(len(pts)-1)*sides+j+1]])
  m=trimesh.Trimesh(vertices=np.array(verts),faces=np.array(faces),process=True)
  return self.put(m,name,mat,parent)
 def loft(self,name,mat,rings, sides=32, waviness=0, parent='Army_Root', phase=0):
  # x radius, z radius, y, xoffset, zoffset; non-circular organic drapes.
  vv=[];ff=[]
  for i,(rx,rz,y,ox,oz) in enumerate(rings):
   for j in range(sides):
    a=2*PI*j/sides
    pleat=(1+waviness*math.cos(8*a+phase+.7*y))
    vv.append((ox+rx*math.cos(a)*pleat,y,oz+rz*math.sin(a)*pleat))
  for i in range(len(rings)-1):
   for j in range(sides):
    a=i*sides+j;b=i*sides+(j+1)%sides;c=(i+1)*sides+(j+1)%sides;d=(i+1)*sides+j
    ff.extend([[a,b,c],[a,c,d]])
  for j in range(1,sides-1):ff.append([0,j,j+1]);ff.append([(len(rings)-1)*sides,(len(rings)-1)*sides+j+1,(len(rings)-1)*sides+j])
  return self.put(trimesh.Trimesh(vertices=vv,faces=ff,process=True),name,mat,parent)
 def box(self,name,mat,size,pos=(0,0,0),parent='Army_Root'):
  return self.put(trimesh.creation.box(extents=size),name,mat,parent,pos)
 def ring(self,name,mat,y,r1,r2,depth=.012,parent='Army_Root',sides=48):
  rings=[(r2,r2,y-depth/2,0,0),(r2,r2,y+depth/2,0,0),(r1,r1,y+depth/2,0,0),(r1,r1,y-depth/2,0,0)]
  return self.loft(name,mat,rings,sides=sides)
 def cloth(self,name,mat,xz,y_top,y_bottom,rx_top,rz_top,rx_bot,rz_bot,w=.045):
  x,z=xz
  rings=[(rx_bot,rz_bot,y_bottom,x,z),(rx_bot*.95,rz_bot*.94,y_bottom+.045,x,z),(rx_top*1.35,rz_top*1.2,(y_top+y_bottom)/2,x,z),(rx_top,rz_top,y_top,x,z)]
  return self.loft(name,mat,rings,waviness=w)
 def export(self):
  path=DEST/(self.code+'.glb');self.s.export(path,file_type='glb');return path


def pedestal(a):
 a.loft('Plinth_Stone','stone',[(.332,.332,0,0,0),(.34,.34,.035,0,0),(.32,.32,.051,0,0),(.30,.30,.061,0,0)],sides=56)
 a.ring('Plinth_GoldRim','gold',.049,.305,.334,.011)
 a.ring('Plinth_BronzeFillet','bronze',.018,.322,.338,.009)
 for j in range(12):
  theta=j*PI/6
  x,z=.313*math.cos(theta),.313*math.sin(theta)
  a.orb('Base_LotusPetal_%02d'%j,'gold',(x,.052,z),(.018,.006,.035),sub=1)


def head(a,y=.59,name='Head',x=0,z=.015,scale=1):
 a.orb(name,'stone',(x,y,z),(.064*scale,.085*scale,.064*scale),sub=3)
 a.orb(name+'_Nose','bone',(x,y-.005,z+.063*scale),(.012,.019,.016),sub=1)
 for side in [-1,1]:
  a.orb(name+('_Ear_L' if side<0 else '_Ear_R'),'stone',(x+side*.061*scale,y,z),(.017,.028,.014),sub=1)
  a.orb(name+('_Brow_L' if side<0 else '_Brow_R'),'bronze',(x+side*.022*scale,y+.025*scale,z+.055*scale),(.022,.004,.004),sub=1)


def wrap_turban(a,name,y,x=0,z=0,color='saffron',radius=.068,mid_height=.035):
 for i in range(4):
  yy=y+.008*i
  pts=[(x+(radius+.004*math.sin(4*ang+i))*math.cos(ang), yy+mid_height*math.sin(ang+i*1.1)*.20,z+(radius+.004*math.sin(3*ang))*math.sin(ang)) for ang in np.linspace(-PI,PI,26)]
  a.tube(name+'_%d'%i,color,pts,rad=.012,sides=9)
 a.orb(name+'_Cap',color,(x,y+.045,z),(.053,.021,.047),sub=2)
 a.orb(name+'_Jewel','gold',(x,y+.029,z+.066),(.012,.013,.006),sub=1)


def helm(a,name,y,x=0,z=0):
 a.orb(name+'_Crown','bronze',(x,y,z),(.075,.040,.071),sub=2)
 a.ring(name+'_Rim','gold',y-.020,.064,.076,.008)
 a.orb(name+'_Crest','crimson',(x,y+.052,z),(.020,.054,.017),sub=2)


def arm(a,name,side,sh,el,hand,armor='bronze',pose='neutral'):
 a.tube(name+'_Upper','stone',[sh,((sh[0]+el[0])/2, (sh[1]+el[1])/2, (sh[2]+el[2])/2),el],[.042,.038,.030],sides=12)
 a.tube(name+'_Fore','bone',[el,((el[0]+hand[0])/2,(el[1]+hand[1])/2,(el[2]+hand[2])/2),hand],[.032,.028,.021],sides=12)
 a.orb(name+'_Pauldron',armor,sh,(.059,.042,.061),sub=2)
 a.orb(name+'_Glove','stone',hand,(.027,.028,.024),sub=2)
 return hand


def two_legs(a,name,height=.31,spacing=.085,footz=.035,cloth='linen'):
 for side in [-1,1]:
  x=side*spacing
  a.tube(name+'_Leg_'+str(side),'stone',[(x,height,0),(x+.004*side,height*.70,-.004),(x,height*.38,.016),(x,.104,footz)],[.041,.037,.032,.029],sides=12)
  a.orb(name+'_Foot_'+str(side),'stone',(x,.080,footz+.038),(.047,.029,.070),sub=2)
  a.tube(name+'_Anklet_'+str(side),'bronze',[(x-.022,.123,footz),(x,.118,footz),(x+.023,.123,footz)],[.008]*3)


def shield(a,name,x,y,z,r=.112,mat='bronze'):
 # nearly planar dished shield, convex forward +Z, using radial rings.
 vs=[];fs=[];n=36
 for rr,dep in [(0,.048),(.32,.052),(.64,.046),(.82,.028),(1,0)]:
  for j in range(n):
   ang=2*PI*j/n;vs.append((x+r*rr*math.cos(ang),y+r*rr*math.sin(ang),z+dep))
 for i in range(4):
  for j in range(n):
   u=i*n+j;v=i*n+(j+1)%n;w=(i+1)*n+(j+1)%n;t=(i+1)*n+j
   fs.extend([[u,v,w],[u,w,t]])
 a.put(trimesh.Trimesh(vertices=vs,faces=fs,process=True),name,mat)
 for k in range(12):
  ang=2*PI*k/12
  a.orb(name+'_Rim_Stud%02d'%k,'gold',(x+r*.91*math.cos(ang),y+r*.91*math.sin(ang),z+.008),(.007,.007,.007),sub=1)
 a.orb(name+'_Boss','gold',(x,y,z+.055),(.030,.030,.012),sub=2)
 a.orb(name+'_Flower','darkgold',(x,y,z+.067),(.014,.014,.006),sub=2)


def shaped_blade(a,name,pivot,dir='down',curved=False):
 # Weapon assembly pivot: all blade/grip/guard use shared parent.
 x,y,z=pivot
 a.node(name+'_Assembly',(x,y,z))
 if curved:
  p=[(0,0,0),(.012,-.06,.025),(.025,-.17,.055),(.055,-.29,.075)]
  a.tube(name+'_Blade','steel',p,[.019,.019,.015,.002],parent=name+'_Assembly',sides=12)
  a.tube(name+'_GoldEdge','gold',[(.015,-.040,.029),(.025,-.14,.06),(.05,-.27,.078)],[.0035,.003,.002],parent=name+'_Assembly',sides=6)
 else:
  a.tube(name+'_Blade','steel',[(0,0,0),(0,.08,.01),(0,.25,.015),(0,.30,.018)],[.014,.020,.010,.001],parent=name+'_Assembly',sides=10)
 a.tube(name+'_Hilt','wood',[(0,-.052,0),(0,-.009,0)],[.014,.014],parent=name+'_Assembly')
 a.tube(name+'_Guard','gold',[(-.047,-.003,0),(0,-.005,0),(.047,-.003,0)],[.008,.012,.008],parent=name+'_Assembly')
 a.orb(name+'_Pommel','gold',(x,y-.061,z),(.018,.019,.018),sub=1)
 a.node(name+'_TipSocket', (x+.055 if curved else x,y-.29 if curved else y+.30,z+.075 if curved else z+.018))


def speargroup(a,name,pivot,top=.38,bot=-.35,curved=False):
 x,y,z=pivot
 a.node(name+'_Assembly',pivot)
 a.tube(name+'_Shaft','wood',[(0,bot,0),(0,(bot+top)/2,0),(0,top-.065,0)],[.011,.010,.009],parent=name+'_Assembly',sides=10)
 a.tube(name+'_Fitting','gold',[(0,top-.087,0),(0,top-.049,0)],[.014,.012],parent=name+'_Assembly')
 a.tube(name+'_Head','steel',[(0,top-.055,0),(0,top-.025,0),(0,top,0)],[.015,.020,.001],parent=name+'_Assembly',sides=8)
 a.node(name+'_TipSocket',(x,y+top,z))


def pawn():
 a=Model('wP');pedestal(a)
 two_legs(a,'Pawn',height=.29,spacing=.062)
 a.cloth('Pawn_Dhoti','linen',(0,.002),.39,.18,.13,.10,.17,.15)
 a.loft('Pawn_Torso','bronze',[(.12,.082,.33,0,0),(.117,.083,.44,0,0),(.095,.077,.51,0,0),(.077,.063,.54,0,0)],sides=30)
 for k in range(4):
  yy=.372+.029*k
  a.tube('Pawn_Cuirass_Rib%02d'%k,'gold',[(-.1,yy,.07), (0,yy+.007,.099),(.1,yy,.07)],[.005,.007,.005])
 head(a,.607,'Pawn_Head');wrap_turban(a,'Pawn_Turban',.66,radius=.071)
 arm(a,'Pawn_RightArm',1,(.105,.491,0),(.164,.402,.024),(.197,.352,.052))
 arm(a,'Pawn_LeftArm',-1,(-.105,.491,0),(-.174,.412,.04),(-.193,.380,.09))
 shield(a,'Pawn_DhalShield',-.209,.374,.090,r=.091)
 speargroup(a,'Pawn_Spear',(.199,.353,.045),top=.390,bot=-.30)
 return a


def bishop():
 a=Model('wB');pedestal(a)
 two_legs(a,'Acharya',height=.31,spacing=.057)
 a.cloth('Acharya_Garment','linen',(0,0),.59,.13,.12,.09,.21,.18,w=.064)
 a.cloth('Acharya_GarmentUnderlay','stone',(.02,-.018),.46,.14,.10,.085,.17,.16,w=.035)
 a.loft('Acharya_Torso','stone',[(.11,.08,.38,0,0),(.14,.10,.50,0,0),(.119,.095,.62,0,0)],sides=32)
 a.tube('Acharya_DiagonalShawl','green',[(-.138,.625,.067),(-.075,.558,.108),(.008,.500,.115),(.095,.420,.112),(.143,.255,.038)],[.035,.035,.030,.028,.02],sides=11)
 a.orb('Acharya_BronzeBrooch','bronze',(-.108,.601,.11),(.025,.025,.009),sub=2)
 head(a,.708,'Acharya_Head');wrap_turban(a,'Acharya_Turban',.764,color='linen',radius=.071)
 arm(a,'Acharya_RightArm',1,(.12,.596,.015),(.165,.49,.057),(.159,.423,.133),armor='stone')
 arm(a,'Acharya_LeftArm',-1,(-.12,.596,.015),(-.113,.515,.086),(.16,.496,.125),armor='linen')
 speargroup(a,'Acharya_Staff',(.159,.475,.132),top=.360,bot=-.37)
 a.orb('Acharya_StaffCap','bronze',(.159,.838,.132),(.025,.02,.025),sub=1)
 return a


def king():
 a=Model('wK');pedestal(a);two_legs(a,'Raja',height=.31)
 a.cloth('Raja_Robe','linen',(0,0),.64,.15,.17,.115,.255,.22,w=.055)
 a.cloth('Raja_CrimsonMantle','crimson',(0,-.04),.69,.19,.20,.13,.23,.20,w=.047)
 a.loft('Raja_Cuirass','bronze',[(.16,.11,.40,0,.012),(.20,.105,.51,0,0),(.198,.124,.65,0,0),(.16,.107,.715,0,0)],sides=36)
 a.orb('Raja_BroadShoulderLeft','gold',(-.214,.665,0),(.063,.065,.11),sub=2)
 a.orb('Raja_BroadShoulderRight','gold',(.214,.665,0),(.063,.065,.11),sub=2)
 a.tube('Raja_Belt','gold',[(-.143,.440,.06),(0,.445,.122),(.143,.440,.06)],[.014,.017,.014])
 head(a,.764,'Raja_Head',scale=1.02)
 for i,(rad,yy) in enumerate([(.081,.823),(.072,.854),(.052,.887)]):
  a.loft('Raja_CrownTier%d'%i,'gold',[(rad,rad*.84,yy-.012,0,.011),(rad*.86,rad*.78,yy+.012,0,.011)],sides=24,waviness=.04)
 a.orb('Raja_Finial','gold',(0,.905,.011),(.014,.026,.014),sub=1)
 arm(a,'Raja_LeftArm',-1,(-.179,.653,.035),(-.137,.534,.099),(-.020,.494,.151))
 arm(a,'Raja_RightArm',1,(.179,.653,.035),(.137,.534,.099),(.020,.494,.151))
 shaped_blade(a,'Raja_Sword',(0,.502,.152),curved=False)
 return a


def queen():
 a=Model('wQ');pedestal(a);two_legs(a,'Samrajni',height=.28,spacing=.064)
 a.cloth('Samrajni_Skirt','linen',(0,0),.51,.14,.10,.07,.265,.23,w=.083)
 a.cloth('Samrajni_CrimsonOverSkirt','crimson',(.015,-.055),.56,.165,.11,.076,.195,.155,w=.086)
 a.loft('Samrajni_Cuirass','bronze',[(.105,.085,.455,0,0),(.130,.092,.57,0,0),(.128,.096,.665,0,0),(.10,.083,.72,0,0)],sides=32)
 a.tube('Samrajni_Chest_GoldTrim','gold',[(-.113,.613,.075),(0,.636,.099),(.113,.613,.075)],[.009,.011,.009])
 a.orb('Samrajni_BeltBuckle','gold',(0,.465,.1),(.029,.030,.013),sub=2)
 head(a,.760,'Samrajni_Head',scale=.92)
 # Characteristic silhouette: shallow *flared* triangular fan crown, not king tiers.
 for i in range(7):
  x=(i-3)*.031
  a.tube('Samrajni_CrownRay%02d'%i,'gold',[(x*.7,.818,.003),(x,.85,.007),(x*1.45,.87+ .045*(1-abs(i-3)/4),.008)],[.014,.014,.004],sides=7)
 a.tube('Samrajni_BrowCrest','gold',[(-.105,.822,.057),(0,.824,.077),(.105,.822,.057)],[.012,.014,.012])
 arm(a,'Samrajni_LeftArm',-1,(-.125,.667,0),(-.178,.53,.025),(-.185,.483,.091),armor='gold')
 arm(a,'Samrajni_RightArm',1,(.125,.667,0),(.191,.55,.025),(.212,.458,.07),armor='gold')
 shaped_blade(a,'Samrajni_Talwar',(.211,.453,.080),curved=True)
 return a


def rook():
 a=Model('wR');pedestal(a)
 # Articulated fortress with stepped square masses and gate; substantially distinct from figures.
 a.box('Durg_SiegeCarriage','wood',(.53,.09,.48),(0,.115,0))
 for sx in [-1,1]:
  for sz in [-1,1]:
   a.orb('Durg_Roller_%d_%d'%(sx,sz),'bronze',(sx*.238,.101,sz*.191),(.067,.063,.048),sub=1)
 a.box('Durg_Bastion','sandstone',(.47,.405,.46),(0,.365,0))
 a.box('Durg_Bastion_Parapet','stone',(.57,.075,.54),(0,.586,0))
 for side in [-1,1]:
  for col in [-1,0,1]:
   a.box('Durg_Crenel_%d_%d'%(side,col),'stone',(.14,.105,.085),(col*.19,.674,side*.23))
 for side in [-1,1]:
  for col in [-1,0,1]:
   a.box('Durg_SideMerlon_%d_%d'%(side,col),'stone',(.083,.10,.12),(side*.24,.673,col*.135))
 # Carved recessed gate contrasts with wall.
 a.box('Durg_GateRecess','shadow',(.177,.270,.012),(0,.298,.237))
 a.orb('Durg_GateArch','bronze',(0,.426,.241),(.092,.055,.009),sub=2)
 for x in [-.065,-.028,.028,.065]:
  a.box('Durg_GateBars_%s'%x,'gold',(.007,.16,.016),(x,.264,.250))
 for y in [.24,.355,.476]:
  a.box('Durg_MasonryCourse%s'%y,'gold',(.478,.009,.47),(0,y,0))
 a.node('Durg_Ram_Assembly',(0,.20,.27))
 a.tube('Durg_Ram','bronze',[(0,0,-.015),(0,0,.10),(0,0,.16)],[.048,.046,.006],parent='Durg_Ram_Assembly')
 a.orb('Durg_CarvedEmblem','gold',(0,.521,.240),(.052,.04,.009),sub=2)
 return a


def horse_sculpt(a):
 # Smooth parametric equine trunk, with anatomy-appropriate shoulder/hips and chest.
 a.orb('Horse_Body','stone',(0,.366,-.055),(.145,.133,.273),sub=3)
 a.orb('Horse_Shoulder','stone',(0,.376,.127),(.150,.146,.152),sub=3)
 a.orb('Horse_Hindquarters','stone',(0,.37,-.240),(.143,.150,.141),sub=3)
 # Neck angling forward and up, smooth multi-profile sweep.
 a.tube('Horse_Neck','stone',[(0,.40,.172),(0,.468,.216),(0,.532,.262),(0,.579,.312)],[.103,.102,.079,.064],sides=24)
 a.orb('Horse_Head','stone',(0,.566,.345),(.066,.092,.092),sub=3)
 a.orb('Horse_Muzzle','bone',(0,.527,.426),(.052,.045,.065),sub=2)
 for side in [-1,1]:
  a.tube('Horse_Ear'+str(side),'stone',[(side*.035,.629,.32),(side*.045,.674,.32)],[.027,.005],sides=8)
  a.orb('Horse_Eye'+str(side),'shadow',(side*.067,.588,.375),(.009,.010,.012),sub=1)
  a.tube('Horse_Rein'+str(side),'wood',[(side*.058,.555,.42),(side*.07,.480,.331),(side*.082,.446,.208),(side*.09,.51,.03)],[.006,.005,.004,.005],sides=6)
 for side in [-1,1]:
  for fore in [False,True]:
   zz=.155 if fore else -.247
   xx=side*.10
   if fore:
    path=[(xx,.335,zz),(xx*1.07,.287,zz+.024),(xx*1.09,.221,zz+.049),(xx,.174,zz+.041),(xx,.098,zz+.066)]
   else:
    path=[(xx,.350,zz),(xx*1.12,.298,zz-.059),(xx*1.15,.217,zz-.047),(xx*.94,.167,zz-.02),(xx,.097,zz-.015)]
   a.tube('Horse_Leg_%s_%s'%(side,'F' if fore else 'B'),'stone',path,[.057,.052,.039,.030,.025],sides=16)
   a.orb('Horse_Hoof_%s_%s'%(side,'F' if fore else 'B'),'bone',(xx,.082,path[-1][2]+.021),(.038,.022,.053),sub=2)
 a.tube('Horse_Tail','stone',[(0,.438,-.351),(.012,.356,-.436),(.03,.22,-.44),(.045,.139,-.414)],[.053,.047,.035,.004],sides=15)
 for j in range(5):
  xx=(j-2)*.019
  a.tube('Horse_Mane_%d'%j,'saffron',[(xx,.617,.290-j*.025),(xx+.002,.594,.240-j*.022),(xx+.009,.552,.205-j*.024)],[.011,.013,.002],sides=7)
 # Horse armor and tack: compact, appropriate chess dimensions.
 a.orb('Horse_Chamfron','bronze',(0,.615,.371),(.050,.060,.018),sub=2)
 a.orb('Horse_Saddle','wood',(0,.495,-.083),(.119,.027,.109),sub=2)
 a.box('Horse_SaddleBlanket','crimson',(.250,.018,.245),(0,.475,-.082))
 for side in [-1,1]:
  a.tube('Horse_StirrupStrap_%d'%side,'wood',[(side*.12,.48,-.080),(side*.147,.389,-.076),(side*.135,.347,-.060)],[.007,.006,.007],sides=6)
  a.tube('Horse_Stirrup_%d'%side,'gold',[(side*.119,.347,-.080),(side*.140,.335,-.060),(side*.155,.347,-.050)],[.012,.010,.010],sides=6)


def knight():
 a=Model('wN');pedestal(a);horse_sculpt(a)
 # Rider seated lower on saddle; distinguish mounted class from infantry.
 a.loft('Rider_Torso','bronze',[(.090,.073,.477,0,-.091),(.095,.076,.559,0,-.09),(.070,.064,.635,0,-.097)],sides=28)
 a.orb('Rider_Belt','gold',(0,.483,-.019),(.063,.015,.023),sub=1)
 for side in [-1,1]:
  a.tube('Rider_Thigh_%d'%side,'linen',[(side*.07,.491,-.13),(side*.14,.426,-.072),(side*.142,.346,-.03)],[.048,.041,.026],sides=12)
  a.orb('Rider_Boot_%d'%side,'bronze',(side*.143,.338,-.026),(.038,.046,.034),sub=2)
 head(a,.670,'Rider_Head',z=-.097,scale=.78)
 helm(a,'Rider_Helmet',.734,z=-.097)
 arm(a,'Rider_RightArm',1,(.091,.601,-.095),(.132,.543,-.041),(.155,.526,.006))
 arm(a,'Rider_LeftArm',-1,(-.091,.601,-.095),(-.13,.541,-.043),(-.03,.484,.035))
 # Kept within footprint; lance projects forward at a recognizable diagonal.
 a.node('Lance_Assembly',(.152,.527,.008))
 a.tube('Cavalry_Lance','wood',[(0,-.174,-.025),(0,0,0),(-.013,.23,.16)],[.013,.012,.008],parent='Lance_Assembly',sides=10)
 a.tube('Cavalry_LanceTip','steel',[(-.013,.23,.16),(-.016,.252,.185),(-.018,.303,.235)],[.016,.021,.001],parent='Lance_Assembly',sides=10)
 a.orb('Cavalry_LanceGuard','gold',(.0,.01,.006),(.022,.024,.021),sub=1,parent='Lance_Assembly')
 a.node('Cavalry_WeaponTipSocket',(.134,.830,.243))
 return a


def main():
 builders={'wP':pawn,'wN':knight,'wB':bishop,'wR':rook,'wQ':queen,'wK':king}
 import json
 index={}
 for code,fn in builders.items():
  m=fn();path=m.export();s=trimesh.load(path,force='scene')
  tris=sum(len(g.faces) for g in s.geometry.values())
  index[code]={'filename':path.name,'vertices':sum(len(g.vertices) for g in s.geometry.values()),'triangles':tris,'materials':list(palette.keys()),'bounds':s.bounds.tolist(),'bytes':path.stat().st_size,'category':'DEVELOPMENT_MODEL_NOT_APPROVED'}
  print(code,path.stat().st_size,'bytes',tris,'faces',np.round(s.bounds,2))
 (DEST/'asset-index.json').write_text(json.dumps(index,indent=2))

if __name__=='__main__':main()
