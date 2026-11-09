"""Structural GLB validation. Not a visual art or animation acceptance test."""
import json, pathlib, trimesh, math
P=pathlib.Path(__file__).resolve().parents[1] / 'models'
names=['wP','wN','wB','wR','wQ','wK']
for n in names:
 f=P/(n+'.glb');data=f.read_bytes()
 assert data[:4]==b'glTF',n
 sc=trimesh.load(f,force='scene')
 assert len(sc.geometry)>5,(n,'too few geometry groups')
 assert all(math.isfinite(v) for v in sc.bounds.flatten()),(n,'not finite')
 assert sc.bounds[0][1]>=-.001,(n,'under ground')
 assert sc.bounds[1][1]<=1.1,(n,'out of height')
 assert any('Plinth_Stone' in node for node in sc.graph.nodes_geometry),(n,'base missing')
 tri=sum(len(mesh.faces) for mesh in sc.geometry.values())
 assert tri>2000,(n,'geometry missing')
 print(n,'PASS',round(sc.bounds[1][1],3),'height;',len(sc.geometry),'meshes;',tri,'triangles')
print('STRUCTURAL PASS — no claim of visual/sculpt quality, rigging or animated contact')
