// Procedural low-poly vehicles: no model files to download. Each model faces -z with its wheels/hull at y=0.
import {BoxGeometry,CylinderGeometry,ConeGeometry,SphereGeometry,Group,Mesh,Matrix4,Euler,Quaternion,Vector3,MeshLambertMaterial} from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

export const ENTRANT_COLORS=[{body:0xff7a1a,trim:0xffd23f},{body:0x2f80ed,trim:0x9ad0ff},{body:0xd83f87,trim:0xffb3d1}];
const SHARED={dark:0x2a2f3a,glass:0xbfe9ff,light:0xf5f5f0,metal:0x9aa3ad};

const box=(w,h,l)=>new BoxGeometry(w,h,l);
const cyl=(top,bottom,h,seg=10)=>new CylinderGeometry(top,bottom,h,seg);
const cone=(r,h,seg=8)=>new ConeGeometry(r,h,seg);
const ball=(r,w=10,h=8)=>new SphereGeometry(r,w,h);
const X=Math.PI/2;
// part(material, geometry, position, rotation, scale)
const p=(m,g,pos,rot=[0,0,0],scale=[1,1,1])=>({m,g,pos,rot,scale});
const wheel=(r,w,pos)=>p('dark',cyl(r,r,w,10),pos,[0,0,X]);

const DEFS={
  car:()=>({parts:[
    p('body',box(1.7,.5,2.8),[0,.55,0]),p('glass',box(1.36,.42,1.3),[0,1,.2]),p('body',box(1.42,.12,1.36),[0,1.27,.2]),
    p('trim',box(.32,.02,2.82),[0,.81,0]),p('dark',box(1.74,.16,.12),[0,.36,-1.42]),p('dark',box(1.74,.16,.12),[0,.36,1.42]),
    p('light',box(.32,.14,.05),[.52,.62,-1.42]),p('light',box(.32,.14,.05),[-.52,.62,-1.42]),
    ...[[.86,-.9],[-.86,-.9],[.86,.9],[-.86,.9]].map(([x,z])=>wheel(.36,.3,[x,.36,z])),
  ]}),
  bike:()=>({parts:[
    wheel(.48,.18,[0,.48,-.78]),wheel(.48,.18,[0,.48,.78]),
    p('body',box(.26,.36,1.2),[0,.86,0]),p('trim',box(.42,.26,.5),[0,1.06,-.15]),p('dark',box(.36,.12,.62),[0,1.05,.32]),
    p('metal',box(.1,.72,.1),[0,.82,-.66],[-.3,0,0]),p('metal',box(.82,.07,.07),[0,1.25,-.58]),
    p('body',box(.46,.6,.36),[0,1.5,.12],[-.4,0,0]),p('body',ball(.26,8,6),[0,1.95,-.06]),p('glass',box(.3,.1,.05),[0,1.97,-.3]),
  ]}),
  snowmobile:()=>({parts:[
    p('metal',box(.16,.06,1.25),[.5,.1,-.85]),p('metal',box(.16,.06,1.25),[-.5,.1,-.85]),
    p('dark',box(.08,.42,.08),[.5,.34,-.8]),p('dark',box(.08,.42,.08),[-.5,.34,-.8]),
    p('body',box(1.1,.5,1.6),[0,.62,-.3]),p('trim',box(1,.36,.62),[0,.56,-1.2],[.35,0,0]),
    p('dark',box(.82,.42,1.4),[0,.3,.62]),p('dark',box(.62,.2,.9),[0,.96,.5]),
    p('glass',box(.92,.42,.05),[0,1.07,-.56],[-.5,0,0]),p('metal',box(.92,.06,.06),[0,1.06,-.36]),
  ]}),
  train:()=>({parts:[
    p('dark',box(1.5,.36,3.6),[0,.46,0]),p('body',cyl(.62,.62,2.2,10),[0,1.16,-.5],[X,0,0]),
    p('body',box(1.5,1.3,1.2),[0,1.26,1.1]),p('trim',box(1.7,.12,1.42),[0,1.96,1.1]),p('glass',box(1.52,.4,.62),[0,1.46,1.1]),
    p('dark',cyl(.2,.26,.62,8),[0,1.96,-1.2]),p('trim',box(1.52,.1,3.62),[0,.67,0]),
    p('light',cyl(.16,.16,.12,8),[0,1.16,-1.66],[X,0,0]),p('trim',cone(.74,.6,4),[0,.36,-1.95],[-X,Math.PI/4,0],[1,1,.6]),
    ...[-1.2,-.2,.8].flatMap(z=>[wheel(.38,.2,[.72,.38,z]),wheel(.38,.2,[-.72,.38,z])]),
  ]}),
  boat:()=>({parts:[
    p('body',box(1.4,.56,2.2),[0,.3,.25]),p('body',cone(.99,1.2,4),[0,.3,-1.45],[-X,Math.PI/4,0],[1,1,.56]),
    p('light',box(1.3,.06,2),[0,.6,.3]),p('trim',box(1.42,.1,2.22),[0,.36,.25]),
    p('glass',box(1.12,.36,.08),[0,.8,-.32],[-.5,0,0]),p('dark',box(.92,.3,.42),[0,.78,.5]),p('dark',box(.36,.62,.3),[0,.46,1.46]),
  ]}),
  submarine:()=>({parts:[
    p('body',cyl(.6,.6,2.2,12),[0,.6,0],[X,0,0]),p('body',ball(.6,12,8),[0,.6,-1.1],[0,0,0],[1,1,1.2]),
    p('body',cone(.6,.9,12),[0,.6,1.55],[X,0,0]),p('trim',box(.5,.62,.92),[0,1.36,-.1]),p('metal',cyl(.05,.05,.5,6),[0,1.9,-.3]),
    p('trim',box(1.62,.06,.4),[0,.6,1.4]),p('trim',box(.06,.92,.4),[0,.6,1.5]),
    ...[-.6,0,.5].flatMap(z=>[p('glass',ball(.13,8,6),[.58,.66,z],[0,0,0],[.4,1,1]),p('glass',ball(.13,8,6),[-.58,.66,z],[0,0,0],[.4,1,1])]),
  ],spinners:[{axis:'z',speed:22,pivot:[0,.6,2.02],parts:[p('metal',box(.92,.12,.05),[0,0,0]),p('metal',box(.12,.92,.05),[0,0,0])]}]}),
  helicopter:()=>({parts:[
    p('body',ball(.85,10,8),[0,1.2,-.2],[0,0,0],[1,.85,1.25]),p('glass',ball(.6,10,8),[0,1.36,-.78],[0,0,0],[1,.8,.9]),
    p('body',cyl(.12,.22,2,8),[0,1.36,1.4],[X,0,0]),p('trim',box(.08,.62,.42),[0,1.62,2.36]),
    p('metal',box(.1,.1,2),[.62,.18,-.1]),p('metal',box(.1,.1,2),[-.62,.18,-.1]),
    ...[[.58,-.6],[-.58,-.6],[.58,.4],[-.58,.4]].map(([x,z])=>p('metal',box(.08,.56,.08),[x,.46,z])),
    p('dark',cyl(.08,.08,.36,6),[0,2.14,-.2]),
  ],spinners:[
    {axis:'y',speed:26,pivot:[0,2.32,-.2],parts:[p('dark',box(4.2,.04,.22),[0,0,0]),p('dark',box(.22,.04,4.2),[0,0,0])]},
    {axis:'x',speed:34,pivot:[.12,1.62,2.42],parts:[p('dark',box(.04,.92,.12),[0,0,0])]},
  ]}),
  plane:()=>({parts:[
    p('body',cyl(.28,.46,3,10),[0,1,0],[X,0,0]),p('metal',cone(.24,.36,8),[0,1,-1.68],[-X,0,0]),
    p('trim',box(4,.1,.82),[0,.96,-.3]),p('glass',ball(.34,8,6),[0,1.38,-.42],[0,0,0],[1,.8,1.6]),
    p('trim',box(1.62,.08,.46),[0,1.1,1.36]),p('body',box(.08,.72,.52),[0,1.46,1.36]),
    wheel(.16,.12,[.6,.16,-.4]),wheel(.16,.12,[-.6,.16,-.4]),p('metal',box(.06,.6,.06),[.6,.5,-.4]),p('metal',box(.06,.6,.06),[-.6,.5,-.4]),
  ],spinners:[{axis:'z',speed:40,pivot:[0,1,-1.8],parts:[p('dark',box(1.52,.1,.04),[0,0,0]),p('dark',box(.1,1.52,.04),[0,0,0])]}]}),
};
export const VEHICLES=Object.keys(DEFS);

const m4=new Matrix4(),q=new Quaternion(),e=new Euler(),v=new Vector3(),sc=new Vector3();
function bake(parts){
  const byMat=new Map();
  for(const part of parts){
    const g=part.g.index?part.g.toNonIndexed():part.g.clone();g.deleteAttribute('uv');
    m4.compose(v.fromArray(part.pos),q.setFromEuler(e.set(...part.rot)),sc.fromArray(part.scale));g.applyMatrix4(m4);
    if(!byMat.has(part.m))byMat.set(part.m,[]);byMat.get(part.m).push(g);part.g.dispose();
  }
  return [...byMat].map(([m,list])=>{const merged=mergeGeometries(list);list.forEach(g=>g.dispose());return {m,geometry:merged};});
}
// Geometry is baked once per vehicle type and shared by all entrants.
const cache=new Map();
function geometryFor(type){
  if(!cache.has(type)){const def=DEFS[type]();cache.set(type,{body:bake(def.parts),spinners:(def.spinners??[]).map(s=>({...s,meshes:bake(s.parts)}))});}
  return cache.get(type);
}
const sharedMaterials=Object.fromEntries(Object.entries(SHARED).map(([k,c])=>[k,new MeshLambertMaterial({color:c,flatShading:true})]));
export function entrantMaterials(index){
  const c=ENTRANT_COLORS[index];
  return {...sharedMaterials,body:new MeshLambertMaterial({color:c.body,flatShading:true}),trim:new MeshLambertMaterial({color:c.trim,flatShading:true})};
}
export function createVehicle(type,materials){
  const data=geometryFor(type),root=new Group();root.name=type;
  for(const part of data.body)root.add(new Mesh(part.geometry,materials[part.m]));
  root.userData.spinners=data.spinners.map(s=>{
    const pivot=new Group();pivot.position.fromArray(s.pivot);
    for(const part of s.meshes)pivot.add(new Mesh(part.geometry,materials[part.m]));
    root.add(pivot);return {pivot,axis:s.axis,speed:s.speed};
  });
  return root;
}
export function spin(vehicle,dt){for(const s of vehicle.userData.spinners)s.pivot.rotation[s.axis]+=s.speed*dt;}
