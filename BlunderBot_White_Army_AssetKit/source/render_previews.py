from pathlib import Path
import trimesh, numpy as np, vtk
from PIL import Image,ImageDraw,ImageFont
ROOT=Path(__file__).resolve().parents[1]
DIR=ROOT/'models'
PRE=ROOT/'previews'; PRE.mkdir(exist_ok=True)

def render_piece(code, orientation=0):
 scene=trimesh.load(DIR/(code+'.glb'),force='scene')
 ren=vtk.vtkRenderer();ren.SetBackground(.075,.078,.085)
 win=vtk.vtkRenderWindow();win.SetOffScreenRendering(1);win.AddRenderer(ren);win.SetSize(520,620);win.SetMultiSamples(4)
 for name in scene.graph.nodes_geometry:
  mat, geom_id=scene.graph[name];mesh=scene.geometry[geom_id]
  pts=vtk.vtkPoints();v=trimesh.transform_points(mesh.vertices,mat)
  for p in v:pts.InsertNextPoint(*[float(x) for x in p])
  triangles=vtk.vtkCellArray()
  for face in mesh.faces:
   tri=vtk.vtkTriangle()
   for ix, vid in enumerate(face):tri.GetPointIds().SetId(ix,int(vid))
   triangles.InsertNextCell(tri)
  poly=vtk.vtkPolyData();poly.SetPoints(pts);poly.SetPolys(triangles)
  normal=vtk.vtkPolyDataNormals();normal.SetInputData(poly);normal.ConsistencyOn();normal.AutoOrientNormalsOn();normal.SplittingOff();normal.Update()
  mapper=vtk.vtkPolyDataMapper();mapper.SetInputConnection(normal.GetOutputPort())
  actor=vtk.vtkActor();actor.SetMapper(mapper)
  material=getattr(mesh.visual,'material',None)
  col=np.asarray(material.baseColorFactor if material and material.baseColorFactor is not None else [190,175,155,255],dtype=float)
  if max(col)>1:col/=255.
  actor.GetProperty().SetColor(float(col[0]),float(col[1]),float(col[2]));actor.GetProperty().SetSpecular(.20);actor.GetProperty().SetSpecularPower(20)
  ren.AddActor(actor)
 cam=ren.GetActiveCamera();cam.SetFocalPoint(0,.46,0)
 if code=='wN':
  cam.SetPosition(1.25,1.16,1.85)
 else:cam.SetPosition(1.28,1.19,1.92)
 cam.SetViewUp(0,1,0);cam.SetViewAngle(28);ren.ResetCameraClippingRange()
 light=vtk.vtkLight();light.SetPosition(-2,4,4);light.SetFocalPoint(0,.5,0);light.SetIntensity(.95);ren.AddLight(light)
 light2=vtk.vtkLight();light2.SetPosition(3,2,0);light2.SetFocalPoint(0,.5,0);light2.SetIntensity(.4);ren.AddLight(light2)
 win.Render()
 cap=vtk.vtkWindowToImageFilter();cap.SetInput(win);cap.Update()
 png=vtk.vtkPNGWriter();png.SetInputConnection(cap.GetOutputPort());png.SetFileName(str(PRE/(code+'.png')));png.Write()
 win.Finalize()

for code in ['wK','wQ','wB','wN','wR','wP']:
 render_piece(code);print('rendered',code,flush=True)

def font(size):
 candidates=['/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf','/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf']
 for x in candidates:
  if Path(x).exists():return ImageFont.truetype(x,size)
 return ImageFont.load_default()
labels={'wK':'RAJA • King','wQ':'SAMRAJNI • Queen','wB':'ACHARYA • Bishop','wN':'ASHVA SENANI • Knight','wR':'DURG • Rook','wP':'PADATI • Pawn'}
out=Image.new('RGB',(1560,1392),(17,20,26));d=ImageDraw.Draw(out)
for j,code in enumerate(['wK','wQ','wB','wN','wR','wP']):
 x=(j%3)*520;y=(j//3)*696
 im=Image.open(PRE/(code+'.png')).convert('RGB');out.paste(im,(x,y+42))
 d.rectangle((x,y,x+519,y+42),fill=(28,32,39))
 d.text((x+17,y+10),labels[code],font=font(18),fill=(225,210,185))
 d.text((x+20,y+650),'GEOMETRY STUDY • NOT PRODUCTION ART',font=font(12),fill=(165,159,147))
out.save(PRE/'contact-sheet.png',optimize=True)
print('contact sheet')
