// Three.js presentation of one race. Reads engine state; never mutates it.
import {Scene,PerspectiveCamera,Color,Fog,HemisphereLight,DirectionalLight,BufferGeometry,Float32BufferAttribute,Mesh,MeshLambertMaterial,
  MeshBasicMaterial,InstancedMesh,Object3D,Group,BackSide,SphereGeometry,CircleGeometry,TorusGeometry,BoxGeometry,IcosahedronGeometry,
  ConeGeometry,CylinderGeometry,DodecahedronGeometry,Matrix4,Vector2,Vector3,Quaternion} from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {FAMILIES,hash} from '../../source/rules.mjs';
import {buildLayout,entrantTrack,gateState,pointAt,straightPath,hoopDistances,LANE_X,LANE_GAP,ROAD,SLAB_HALF} from './track.mjs';
import {createVehicle,entrantMaterials,spin,ENTRANT_COLORS} from './vehicles.mjs';

const DEPTH=-9,HELI_Y=2.7,PLANE_Y=4.6,GLIDE_Y=3.8,ROCKET_Y=7,MAX_SPARKS=260;
const CONFETTI=[0xffcf33,0xff7a1a,0x37e06a,0x2f80ed,0xd83f87,0xffffff];
const TOP={L:0,R:0,S:0,T:0,B:0,D:0,W:-.35,U:-.35,K:-.35,M:-.25};
const WATERY=new Set(['W','U','K','M']),FLOATERS=new Set(['boat','submarine','jetski']);
// Corridors only a specialist flyer crosses: its cruise height and the colour of its rings.
export const FLYERS={F:{type:'plane',y:PLANE_Y,ring:0xffc93c},C:{type:'glider',y:GLIDE_Y,ring:0x5fe0a8},O:{type:'rocket',y:ROCKET_Y,ring:0x6fe8ff}};
const THEMES=[
  {sky:[0x3a9cf5,0xd8f1ff],sea:true,floor:0x1f8bd6,cliff:0xd9c08a,tree:'palm',land:0x6fc45a},
  {sky:[0x63a9e0,0xf7dfbf],sea:false,floor:0xd6a066,cliff:0xa8673a,tree:'cactus',land:0xc99561},
  {sky:[0x4fa7ef,0xe2f5ff],sea:false,floor:0x63b347,cliff:0x8a6a48,tree:'round',land:0x86c35a},
  {sky:[0x86afd9,0xf2f7ff],sea:false,floor:0xe9f0f8,cliff:0xa9b8c9,tree:'snowpine',land:0xf2f6fb},
  {sky:[0x2378cf,0xbfe6ff],sea:true,floor:0x135f9e,cliff:0xcdb47c,tree:'palm',land:0x74c75e},
  {sky:[0x4f9cf2,0xffe8cc],sea:true,floor:0x2a8fcf,cliff:0xd6c194,tree:'round',land:0x7acb5f},
  {sky:[0x6f9fb8,0xdbe7cf],sea:false,floor:0x55703a,cliff:0x6b5a3e,tree:'round',land:0x7aa64e},
  {sky:[0x8e9fb3,0xf3d7b1],sea:false,floor:0xae8a5c,cliff:0x7a5a3e,tree:'wreck',land:0x9c8a6e},
  {sky:[0x5c94d6,0xe8f1fb],sea:false,floor:0x86a06e,cliff:0x7c7a76,tree:'pine',land:0x7fb35a},
  {sky:[0x4ea0e0,0xdff2ff],sea:false,floor:0x4f8f4a,cliff:0x9a7a5a,tree:'pine',land:0x6fb352},
  {sky:[0x5b8fd6,0xffd2a1],sea:false,floor:0xbf6a3c,cliff:0xb5562f,tree:'cactus',land:0xd59a62},
  {sky:[0x170f3d,0x7f56b0],sea:true,floor:0x2c2468,cliff:0x5a4d7a,tree:'round',land:0x6aa86a,stars:true},
];
const C=hex=>new Color(hex),LANE_GAP_HALF=LANE_GAP/2;
const COL={asphalt:C(0x434957),dash:C(0xf7f7f2),rut:C(0x8b5a33),rough:C(0xc99561),groomed:C(0xd5e6f6),snow:C(0xf2f6fb),ballast:C(0x7b746c),
  sleeper:C(0x6b4a2e),rail:C(0xd0d4da),basinW:C(0x1a6b99),basinU:C(0x0e3a5e),waterW:C(0x37b4ea),waterU:C(0x1f74b8),
  assist:C(0x4cff7a),against:C(0xff5a4c),black:C(0x22252c),white:C(0xf7f7f2),post:C(0x3a3f4b),flag:C(0xffd23f),
  wreck:C(0x8f7d68),wreckLane:C(0x5c5046),rock:C(0x8d8a85),tunnel:C(0x3b3b40),rib:C(0x6a6660),
  waterM:C(0x4a8f7a),basinM:C(0x24361f),waterK:C(0x8fdcf2),basinK:C(0x2b6f8a)};
const rng=seed=>{let a=seed>>>0;return ()=>{a=a+0x6D2B79F5>>>0;let t=Math.imul(a^a>>>15,1|a);t^=t+Math.imul(t^t>>>7,61|t);return((t^t>>>14)>>>0)/4294967296;};};
const damp=(k,dt)=>1-Math.exp(-k*dt);
const easeOutBack=t=>{t=Math.min(1,t);const c=1.9;return 1+(c+1)*Math.pow(t-1,3)+c*Math.pow(t-1,2);};

// Flat-colour triangle soup; quads orient themselves toward the requested normal so winding cannot go wrong.
class Builder{
  constructor(){this.p=[];this.c=[];}
  tri(a,b,c,col){this.p.push(...a,...b,...c);for(let i=0;i<3;i++)this.c.push(col.r,col.g,col.b);}
  quad(a,b,c,d,col,n){
    const ux=b[0]-a[0],uy=b[1]-a[1],uz=b[2]-a[2],vx=c[0]-a[0],vy=c[1]-a[1],vz=c[2]-a[2];
    const dot=(uy*vz-uz*vy)*n[0]+(uz*vx-ux*vz)*n[1]+(ux*vy-uy*vx)*n[2];
    if(dot>=0){this.tri(a,b,c,col);this.tri(a,c,d,col);}else{this.tri(a,c,b,col);this.tri(a,d,c,col);}
  }
  box(x0,x1,y0,y1,z0,z1,col,side=col){
    const U=[0,1,0];
    this.quad([x0,y1,z0],[x1,y1,z0],[x1,y1,z1],[x0,y1,z1],col,U);
    this.quad([x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1],side,[0,0,1]);
    this.quad([x0,y0,z0],[x1,y0,z0],[x1,y1,z0],[x0,y1,z0],side,[0,0,-1]);
    this.quad([x1,y0,z0],[x1,y0,z1],[x1,y1,z1],[x1,y1,z0],side,[1,0,0]);
    this.quad([x0,y0,z0],[x0,y0,z1],[x0,y1,z1],[x0,y1,z0],side,[-1,0,0]);
  }
  // Ribbon between lateral offsets a..b of a lane-local path; world = (x, y, -s).
  ribbon(path,s0,lane,a,b,y,col){
    const n=path.s.length;let prev=null;
    for(let i=0;i<n;i++){
      const i0=Math.max(0,i-1),i1=Math.min(n-1,i+1),ts=path.s[i1]-path.s[i0],tx=path.x[i1]-path.x[i0],len=Math.hypot(ts,tx)||1;
      const ps=-tx/len,px=ts/len,s=s0+path.s[i],x=lane+path.x[i];
      const L=[x+a*px,y,-(s+a*ps)],R=[x+b*px,y,-(s+b*ps)];
      if(prev)this.quad(prev[0],prev[1],R,L,col,[0,1,0]);prev=[L,R];
    }
  }
  geometry(){
    const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(this.p,3));g.setAttribute('color',new Float32BufferAttribute(this.c,3));
    g.computeVertexNormals();return g;
  }
}

function waterMaterial({opacity=1,amp=.09,freq=1}={}){
  const m=new MeshLambertMaterial({vertexColors:true,flatShading:true,transparent:opacity<1,opacity,depthWrite:opacity>=1});
  const uniforms={uTime:{value:0},uAmp:{value:amp},uFreq:{value:freq}};m.userData.uniforms=uniforms;
  m.onBeforeCompile=sh=>{
    Object.assign(sh.uniforms,uniforms);
    sh.vertexShader='uniform float uTime,uAmp,uFreq;\nvarying float vWave;\n'+sh.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
      vec4 wp=modelMatrix*vec4(transformed,1.0);
      float w=sin(wp.x*.55*uFreq+uTime*1.9)*.5+sin(wp.z*.42*uFreq-uTime*1.4)*.5;
      transformed.y+=w*uAmp;vWave=w;`);
    sh.fragmentShader='varying float vWave;\n'+sh.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      diffuseColor.rgb=mix(diffuseColor.rgb,vec3(1.0),smoothstep(.5,1.,vWave)*.3);`);
  };
  return m;
}
function painted(geometry,hex,pos=[0,0,0],scale=[1,1,1],rot=[0,0,0]){
  const g=geometry.index?geometry.toNonIndexed():geometry.clone();g.deleteAttribute('uv');geometry.dispose();
  g.applyMatrix4(new Matrix4().compose(new Vector3(...pos),new Quaternion().setFromAxisAngle(new Vector3(1,0,0),rot[0]),new Vector3(...scale)));
  const c=new Color(hex),n=g.attributes.position.count,col=new Float32Array(n*3);for(let i=0;i<n;i++)col.set([c.r,c.g,c.b],i*3);
  g.setAttribute('color',new Float32BufferAttribute(col,3));return g;
}
const merge=parts=>{const g=mergeGeometries(parts);parts.forEach(x=>x.dispose());return g;};
const PROPS={
  round:()=>merge([painted(new CylinderGeometry(.18,.26,1.2,6),0x7a5230,[0,.6,0]),painted(new IcosahedronGeometry(1.1,0),0x4caf50,[0,1.9,0])]),
  pine:()=>merge([painted(new CylinderGeometry(.16,.22,.8,6),0x6b4a2e,[0,.4,0]),painted(new ConeGeometry(1,1.6,7),0x2f7d4a,[0,1.4,0]),painted(new ConeGeometry(.75,1.3,7),0x358a52,[0,2.2,0])]),
  snowpine:()=>merge([painted(new CylinderGeometry(.16,.22,.8,6),0x6b4a2e,[0,.4,0]),painted(new ConeGeometry(1,1.6,7),0x2f6d4a,[0,1.4,0]),painted(new ConeGeometry(.72,1.25,7),0xf4f8ff,[0,2.25,0])]),
  palm:()=>merge([painted(new CylinderGeometry(.13,.2,2.4,6),0x9b6b3f,[0,1.2,0]),painted(new ConeGeometry(1.5,.7,7),0x3fae57,[0,2.6,0])]),
  cactus:()=>merge([painted(new CylinderGeometry(.28,.3,2.2,7),0x4f9a4a,[0,1.1,0]),painted(new CylinderGeometry(.18,.18,.9,6),0x4f9a4a,[.5,1.3,0]),painted(new CylinderGeometry(.18,.18,.7,6),0x4f9a4a,[-.45,1.6,0])]),
  rock:()=>painted(new DodecahedronGeometry(.8,0),0x9a948c,[0,.35,0],[1,.7,1]),
  cloud:()=>merge([painted(new IcosahedronGeometry(2.2,0),0xffffff),painted(new IcosahedronGeometry(1.6,0),0xffffff,[2.2,-.3,.2]),painted(new IcosahedronGeometry(1.5,0),0xffffff,[-2.1,-.4,-.1])]),
  island:()=>merge([painted(new ConeGeometry(9,3,9),0xe3cf98,[0,1.5,0]),painted(new CylinderGeometry(.18,.26,3,6),0x9b6b3f,[0,4.4,0]),painted(new ConeGeometry(2,.9,7),0x3fae57,[0,5.9,0])]),
  buoy:()=>merge([painted(new SphereGeometry(.28,8,6),0xff4d4d),painted(new CylinderGeometry(.1,.1,.4,6),0xf7f7f2,[0,.38,0])]),
  reed:()=>merge([painted(new ConeGeometry(.12,1.6,4),0x7d8f3a,[0,.8,0]),painted(new ConeGeometry(.1,1.2,4),0x93a24a,[.25,.6,.1]),painted(new CylinderGeometry(.09,.09,.4,5),0x6b4a2e,[-.2,1.3,0])]),
  wreck:()=>merge([painted(new BoxGeometry(1.6,.55,2.6),0xb0643a,[0,.28,0]),painted(new BoxGeometry(1.2,.36,1.1),0x4a4f5a,[0,.72,.2]),painted(new CylinderGeometry(.34,.34,.3,8),0x2a2f3a,[.9,.34,.8],[1,1,1])]),
};
const propCache={};const prop=name=>propCache[name]??=PROPS[name]();
const propMaterial=new MeshLambertMaterial({vertexColors:true,flatShading:true}),cloudMaterial=new MeshLambertMaterial({vertexColors:true,flatShading:true,emissive:0x8a96a8});

export class World{
  constructor(renderer){
    this.renderer=renderer;this.scene=new Scene();this.camera=new PerspectiveCamera(55,1,.5,1400);
    this.hemi=new HemisphereLight(0xdff3ff,0x8a7a5a,1.25);this.sun=new DirectionalLight(0xffffff,2.1);this.sun.position.set(-40,80,30);
    this.scene.add(this.hemi,this.sun);
    this.skyGeo=new SphereGeometry(1000,16,10);this.sky=new Mesh(this.skyGeo,new MeshBasicMaterial({vertexColors:true,side:BackSide,fog:false,depthWrite:false}));
    this.sky.renderOrder=-1;this.scene.add(this.sky);this.scene.fog=new Fog(0xffffff,70,330);
    this.waterTrack=waterMaterial({opacity:.82});this.waterFloor=waterMaterial({amp:.45,freq:.35});this.waterRapid=waterMaterial({opacity:.88,amp:.22,freq:1.8});
    // Stars ride on the sky dome; only the space family shows them.
    const starGeo=new BoxGeometry(2.2,2.2,2.2),stars=new InstancedMesh(starGeo,new MeshBasicMaterial({color:0xffffff,fog:false}),260),d=new Object3D(),sr=rng(7);
    for(let i=0;i<260;i++){const a=sr()*6.283,h=.15+sr()*.85;d.position.set(Math.cos(a)*Math.sqrt(1-h*h)*900,h*900,Math.sin(a)*Math.sqrt(1-h*h)*900);d.scale.setScalar(.5+sr());d.updateMatrix();stars.setMatrixAt(i,d.matrix);}
    stars.visible=false;this.stars=stars;this.sky.add(stars);
    this.trackMaterial=new MeshLambertMaterial({vertexColors:true,flatShading:true});
    this.course=new Group();this.scene.add(this.course);
    this.materials=[0,1,2].map(entrantMaterials);
    this.shadowGeo=new CircleGeometry(1.3,16).rotateX(-Math.PI/2);this.shadowMat=new MeshBasicMaterial({color:0x000000,transparent:true,opacity:.24,depthWrite:false});
    this.markerMat=new MeshBasicMaterial({color:ENTRANT_COLORS[0].trim});this.markerGeo=new ConeGeometry(.5,.9,4).rotateX(Math.PI);
    this.gateMats={open:new MeshBasicMaterial({color:0x37e06a}),warn:new MeshBasicMaterial({color:0xffc93c}),closed:new MeshBasicMaterial({color:0xff4040})};
    this.gateBarGeo=new BoxGeometry(2.7,.2,.2).translate(1.35,0,0);this.gateLampGeo=new SphereGeometry(.26,8,6);
    this.barMats={open:new MeshLambertMaterial({color:0xf7f7f2,flatShading:true}),closed:new MeshLambertMaterial({color:0xff4040,flatShading:true})};
    this.particles=new InstancedMesh(new BoxGeometry(.34,.34,.34),new MeshBasicMaterial({color:0xffffff}),MAX_SPARKS);this.particles.count=0;this.particles.frustumCulled=false;
    for(let i=0;i<MAX_SPARKS;i++)this.particles.setColorAt(i,new Color(1,1,1));
    this.scene.add(this.particles);this.sparks=[];this.dummy=new Object3D();this.time=0;
  }
  setCourse(course){
    this.clear();this.data=course;this.layout=buildLayout(course);this.family=course.family;
    const theme=THEMES[course.family],r=rng(course.seed);
    this.applyTheme(theme);
    const solid=new Builder(),water={calm:new Builder(),rapid:new Builder()},props={tree:[],rock:[],cloud:[],buoy:[],island:[],hoop:[],reed:[],wreck:[]};
    const lead={s:-60,length:60,options:[{t:this.layout.blocks[0].options[0].t,path:straightPath(60),d:60,m:null}]};
    const last=this.layout.blocks.at(-1),tail={s:this.layout.total,length:90,options:[{t:last.options[0].t,path:straightPath(90),d:90,m:null}]};
    const segments=[lead,...this.layout.blocks,tail];
    segments.forEach((seg,i)=>this.buildSegment(seg,segments[i-1],segments[i+1],theme,solid,water,props,r));
    this.buildLine(solid,0,TOP[this.layout.blocks[0].options[0].t],false);
    this.buildLine(solid,this.layout.total,TOP[last.options[0].t],true);
    for(const index of course.checkpoints){const b=this.layout.blocks[index],y=TOP[b.options[0].t]??0;for(const side of [-1,1])this.flag(solid,side*(SLAB_HALF-.7),y,-b.s);}
    this.buildGates();this.buildFloor(theme,props,r);
    this.owned(new Mesh(solid.geometry(),this.trackMaterial));
    if(water.calm.p.length)this.owned(new Mesh(water.calm.geometry(),this.waterTrack)).renderOrder=2;
    if(water.rapid.p.length)this.owned(new Mesh(water.rapid.geometry(),this.waterRapid)).renderOrder=2;
    for(const [name,list] of [[theme.tree,props.tree],['rock',props.rock],['cloud',props.cloud],['buoy',props.buoy],['island',props.island],['reed',props.reed],['wreck',props.wreck]])
      if(list.length)this.course.add(this.instanced(prop(name),list,name==='cloud'?cloudMaterial:propMaterial));
    this.hoopGeo??=new TorusGeometry(1.7,.2,6,18);this.hoopMat??=new MeshLambertMaterial({color:0xffffff,flatShading:true,emissive:0x555555});
    if(props.hoop.length)this.course.add(this.instanced(this.hoopGeo,props.hoop,this.hoopMat));
    this.stars.visible=!!theme.stars;
    this.buildEntrants();this.prev=null;this.snap=true;
  }
  applyTheme(theme){
    const top=new Color(theme.sky[0]),bottom=new Color(theme.sky[1]),pos=this.skyGeo.attributes.position,col=new Float32Array(pos.count*3);
    for(let i=0;i<pos.count;i++){const k=Math.max(0,Math.min(1,pos.getY(i)/600+.15));const c=bottom.clone().lerp(top,Math.sqrt(k));col.set([c.r,c.g,c.b],i*3);}
    this.skyGeo.setAttribute('color',new Float32BufferAttribute(col,3));this.scene.fog.color.copy(bottom);this.hemi.groundColor.set(theme.floor);
  }
  buildSegment(seg,before,after,theme,solid,water,props,r){
    const t=seg.options[0].t,top=TOP[t],z0=-seg.s,z1=-(seg.s+seg.length),cliff=C(theme.cliff),H=SLAB_HALF;
    const end=neighbor=>{const nt=neighbor&&TOP[neighbor.options[0].t];return nt===undefined||nt<top-1e-6;};
    if(top!==undefined&&WATERY.has(t)){
      const basin={U:-3.4,M:-1.2}[t]??-2.4,surface={U:COL.waterU,M:COL.waterM,K:COL.waterK}[t]??COL.waterW,sheet=t==='K'?water.rapid:water.calm;
      solid.quad([-H,basin,z0],[H,basin,z0],[H,basin,z1],[-H,basin,z1],{U:COL.basinU,M:COL.basinM,K:COL.basinK}[t]??COL.basinW,[0,1,0]);
      for(const x of [-H,H])solid.quad([x,DEPTH,z0],[x,DEPTH,z1],[x,top,z1],[x,top,z0],cliff,[Math.sign(x),0,0]);
      if(!before||TOP[before.options[0].t]===undefined)solid.quad([-H,DEPTH,z0],[H,DEPTH,z0],[H,top,z0],[-H,top,z0],cliff,[0,0,1]);
      if(!after||TOP[after.options[0].t]===undefined)solid.quad([-H,DEPTH,z1],[H,DEPTH,z1],[H,top,z1],[-H,top,z1],cliff,[0,0,-1]);
      const step=2.6,nx=Math.ceil(2*H/step),nz=Math.max(1,Math.ceil(seg.length/(step*1.4)));
      for(let i=0;i<nx;i++)for(let j=0;j<nz;j++){
        const xa=-H+2*H*i/nx,xb=-H+2*H*(i+1)/nx,za=z0+(z1-z0)*j/nz,zb=z0+(z1-z0)*(j+1)/nz;
        sheet.quad([xa,top,za],[xb,top,za],[xb,top,zb],[xa,top,zb],surface,[0,1,0]);
      }
      // Lane markers: buoys on open water, reeds in the marsh, rocks breaking the rapids.
      const marker=t==='M'?props.reed:props.buoy;
      for(let lane=0;lane<3;lane++)for(const o of seg.options){
        const w=seg.options.length>1?ROAD*.4:ROAD*.55;
        for(let d=4;d<o.path.length-2;d+=t==='M'?7:12)for(const side of [-w,w]){const q=pointAt(o.path,d/o.path.length);
          marker.push({x:LANE_X[lane]+q.x+side*q.ds,y:top-.05,z:-(seg.s+q.s-side*q.dx),s:t==='M'?.7+r()*.4:1,ry:r()*6.28});}
      }
      if(t==='K')for(let d=3;d<seg.length-2;d+=5+r()*4)for(const x of [-LANE_GAP_HALF,LANE_GAP_HALF,-(H-1.5),H-1.5])
        if(r()<.6)props.rock.push({x:x+(r()-.5)*1.6,y:top-.25,z:-(seg.s+d),s:.6+r()*.5,ry:r()*6.28});
    }else if(top!==undefined){
      const ground={R:COL.rough,S:COL.snow,B:COL.wreck,D:COL.rock}[t]??C(theme.land);
      solid.quad([-H,top,z0],[H,top,z0],[H,top,z1],[-H,top,z1],ground,[0,1,0]);
      for(const x of [-H,H])solid.quad([x,DEPTH,z0],[x,DEPTH,z1],[x,top,z1],[x,top,z0],cliff,[Math.sign(x),0,0]);
      if(end(before))solid.quad([-H,DEPTH,z0],[H,DEPTH,z0],[H,top,z0],[-H,top,z0],cliff,[0,0,1]);
      if(end(after))solid.quad([-H,DEPTH,z1],[H,DEPTH,z1],[H,top,z1],[-H,top,z1],cliff,[0,0,-1]);
      for(let lane=0;lane<3;lane++)for(const o of seg.options)this.road(solid,o,seg.s,LANE_X[lane],top,seg.options.length>1);
      if(t==='D')this.mountain(solid,seg,top,cliff);
      else{
        const kind=t==='R'?'rock':t==='B'?'wreck':'tree';
        for(let d=2;d<seg.length-1;d+=4+r()*3)for(const side of [-1,1]){
          if(r()<.25)continue;const x=side*(H-1.2-r()*1.3);
          (r()<.75?props[kind]:props.rock).push({x,y:top,z:-(seg.s+d),s:.55+r()*.5,ry:r()*6.28});
        }
        if(t==='B'&&!seg.fork)for(let d=4;d<seg.length-3;d+=6+r()*5)for(const x of [-LANE_GAP_HALF,LANE_GAP_HALF])
          if(r()<.55)props.wreck.push({x:x+(r()-.5),y:top,z:-(seg.s+d),s:.7+r()*.3,ry:r()*6.28});
      }
    }else{
      for(let k=0;k<Math.ceil(seg.length/24);k++)props.cloud.push({x:(r()-.5)*2*H,y:-6-r()*1.5,z:-(seg.s+r()*seg.length),s:.45+r()*.35,ry:r()*6.28});
      const fly=FLYERS[t];
      if(fly)for(let lane=0;lane<3;lane++)for(const d of hoopDistances(seg.length))props.hoop.push({x:LANE_X[lane],y:fly.y+.95,z:-(seg.s+d),s:1,ry:0,c:fly.ring});
    }
    seg.options.forEach(o=>{if(o.m)this.arrows(solid,o,seg.s,t);});
  }
  road(b,o,s0,lane,top,fork){
    const y=top+.02,w=(fork?ROAD*.82:ROAD)/2,path=o.path;
    if(o.t==='L'){b.ribbon(path,s0,lane,-w,w,y,COL.asphalt);for(let d=1;d<path.length-1;d+=4)this.dash(b,path,s0,lane,d,1.6,y+.01,.14,COL.dash);}
    else if(o.t==='R'){b.ribbon(path,s0,lane,-w,-w+.6,y,COL.rut);b.ribbon(path,s0,lane,w-.6,w,y,COL.rut);}
    else if(o.t==='S'){b.ribbon(path,s0,lane,-w,w,y,COL.groomed);for(let d=.5;d<path.length-.5;d+=2.2)this.dash(b,path,s0,lane,d,.18,y+.01,w*.9,COL.snow);}
    else if(o.t==='B'){b.ribbon(path,s0,lane,-w,w,y,COL.wreckLane);}
    else if(o.t==='D'){b.ribbon(path,s0,lane,-w,w,y,COL.tunnel);for(let d=.5;d<path.length-.5;d+=3)this.dash(b,path,s0,lane,d,.3,y+.01,.08,COL.flag);}
    else if(o.t==='T'){
      b.ribbon(path,s0,lane,-w,w,y,COL.ballast);
      for(let d=.4;d<path.length-.3;d+=1.1)this.dash(b,path,s0,lane,d,.34,y+.04,.9,COL.sleeper);
      for(const off of [-.5,.5])b.ribbon(path,s0,lane,off-.07,off+.07,y+.16,COL.rail);
    }
  }
  // Mountain tunnel: tall rock walls, low portals with three mouths, and roof ribs over each lane (no roof, so vehicles stay visible).
  mountain(b,seg,top,cliff){
    const H=SLAB_HALF,z0=-seg.s,z1=-(seg.s+seg.length),mouth=1.7,lintel=top+3.4,face=top+4.6,peak=COL.rock.clone().lerp(new Color(1,1,1),.35);
    for(const side of [-1,1]){
      const x=side*(H-.4);b.box(Math.min(x,side*H),Math.max(x,side*H),top,top+9,z1,z0,cliff,cliff);
      for(let z=z0;z>z1;z-=6){const zz=Math.max(z1,z-6),mid=(z+zz)/2,h=top+11+((Math.abs(Math.round(z))*7)%5),xi=side*(H-.4);
        b.quad([xi,top+9,z],[xi,top+9,zz],[xi,h,mid],[xi,h,mid],peak,[-side,0,0]);}
    }
    for(const [z,n] of [[z0,1],[z1,-1]]){
      const zo=z+n*.01,edges=[-H,...LANE_X.slice().sort((a,b)=>a-b).flatMap(x=>[x-mouth,x+mouth]),H];
      b.quad([-H,lintel,zo],[H,lintel,zo],[H,face,zo],[-H,face,zo],cliff,[0,0,n]);
      for(let i=0;i<edges.length;i+=2)b.quad([edges[i],top,zo],[edges[i+1],top,zo],[edges[i+1],lintel,zo],[edges[i],lintel,zo],cliff,[0,0,n]);
      b.box(-H,H,face,face+.5,Math.min(zo,zo-n*1.2),Math.max(zo,zo-n*1.2),peak,cliff);
    }
    for(const x of LANE_X)for(let d=5;d<seg.length-2;d+=9)b.box(x-mouth,x+mouth,lintel-.3,lintel,-(seg.s+d+.4),-(seg.s+d-.4),COL.rib);
  }
  dash(b,path,s0,lane,d,len,y,half,col){
    const a=pointAt(path,d/path.length),c=pointAt(path,Math.min(1,(d+len)/path.length));
    const P=(q,o)=>[lane+q.x+o*q.ds,y,-(s0+q.s-o*q.dx)];
    b.quad(P(a,-half),P(a,half),P(c,half),P(c,-half),col,[0,1,0]);
  }
  arrows(b,o,s0,t){
    const y=WATERY.has(t)?-.12:FLYERS[t]?FLYERS[t].y-.6:HELI_Y-.7,col=o.dir>0?COL.assist:COL.against;
    for(let lane=0;lane<3;lane++)for(let d=4;d<o.path.length-3;d+=7){
      const q=pointAt(o.path,d/o.path.length),x=LANE_X[lane]+q.x,s=s0+q.s,tip=o.dir>0?1:-1;
      b.quad([x-.8,y,-(s-tip*.5)],[x,y,-(s+tip*.6)],[x+.8,y,-(s-tip*.5)],[x,y,-(s-tip*.05)],col,[0,1,0]);
    }
  }
  buildLine(b,s,top=0,finish){
    const y=top+.04,H=SLAB_HALF;
    for(let i=0;i<Math.round(2*H);i++)for(let row=0;row<2;row++)
      b.quad([-H+i,y,-(s+row)],[-H+i+1,y,-(s+row)],[-H+i+1,y,-(s+row+1)],[-H+i,y,-(s+row+1)],(i+row)%2?COL.black:COL.white,[0,1,0]);
    if(!finish)return;
    for(const x of [-H+.6,H-.6])b.box(x-.35,x+.35,top,top+7.4,-(s+.35),-(s-.35),COL.post);
    b.box(-H+.25,H-.25,top+6,top+7.4,-(s+.3),-(s-.3),COL.black);
    for(let i=0;i<Math.round(2*H-.5);i++)for(let row=0;row<2;row++)if((i+row)%2)
      b.quad([-H+.25+i,top+6+row*.7,-(s-.31)],[-H+1.25+i,top+6+row*.7,-(s-.31)],[-H+1.25+i,top+6.7+row*.7,-(s-.31)],[-H+.25+i,top+6.7+row*.7,-(s-.31)],COL.white,[0,0,1]);
  }
  flag(b,x,y,z){
    const tip=[x-Math.sign(x)*1.3,y+2.7,z],a=[x,y+2.2,z],c=[x,y+3.2,z];
    b.box(x-.08,x+.08,y,y+3.2,z-.08,z+.08,COL.post);if(x<0)b.tri(a,tip,c,COL.flag);else b.tri(a,c,tip,COL.flag);
  }
  buildGates(){
    this.gates=[];
    this.layout.blocks.forEach((block,bi)=>{
      const o=block.options[0];if(!block.fork||!o.g)return;
      const q=pointAt(o.path,o.g.at/o.d),top=TOP[o.t]??0;
      for(let lane=0;lane<3;lane++){
        const x=LANE_X[lane]+q.x,z=-(block.s+q.s),half=ROAD*.5+.15,root=new Group();root.position.set(x,top,z);
        const posts=new Mesh(this.postGeo??=new BoxGeometry(.24,1.6,.24).translate(0,.8,0),this.barMats.open);
        const right=posts.clone();posts.position.x=-half;right.position.x=half;
        const pivot=new Group();pivot.position.set(-half,1.25,0);const bar=new Mesh(this.gateBarGeo,this.barMats.closed);pivot.add(bar);
        const lamp=new Mesh(this.gateLampGeo,this.gateMats.closed);lamp.position.set(half,1.85,0);
        root.add(posts,right,pivot,lamp);this.course.add(root);this.gates.push({gate:o.g,pivot,bar,lamp,angle:0});
      }
    });
  }
  buildFloor(theme,props,r){
    const len=this.layout.total+900,cell=theme.sea?60:30,nx=Math.ceil(1400/cell),nz=Math.ceil(len/cell),b=new Builder(),col=C(theme.floor);
    const h=(i,j)=>theme.sea?0:(hash(`${i}:${j}:${this.data.seed}`)%1000/1000-.5)*3.2*(Math.abs(i-nx/2)>2?1:0);
    for(let i=0;i<nx;i++)for(let j=0;j<nz;j++){
      const x0=-700+i*cell,x1=x0+cell,z0=300-j*cell,z1=z0-cell,shade=col.clone().multiplyScalar(theme.sea?1:.94+((i*7+j*13)%5)*.03);
      b.quad([x0,DEPTH+h(i,j),z0],[x1,DEPTH+h(i+1,j),z0],[x1,DEPTH+h(i+1,j+1),z1],[x0,DEPTH+h(i,j+1),z1],shade,[0,1,0]);
    }
    this.owned(new Mesh(b.geometry(),theme.sea?this.waterFloor:this.trackMaterial));
    const span=this.layout.total+400;
    if(theme.sea)for(let k=0;k<16;k++){const side=r()<.5?-1:1;props.island.push({x:side*(60+r()*220),y:DEPTH-1,z:200-r()*span,s:.7+r()*.9,ry:r()*6.28});}
    else for(let k=0;k<180;k++){const side=r()<.5?-1:1;(r()<.7?props.tree:props.rock).push({x:side*(SLAB_HALF+6+r()*150),y:DEPTH,z:200-r()*span,s:1+r()*1.6,ry:r()*6.28});}
    for(let k=0;k<26;k++){const side=r()<.5?-1:1;props.cloud.push({x:side*(25+r()*240),y:22+r()*40,z:150-r()*span,s:1.2+r()*2.2,ry:r()*6.28});}
  }
  instanced(geometry,list,material=propMaterial){
    const mesh=new InstancedMesh(geometry,material,Math.max(1,list.length));mesh.count=list.length;
    const d=this.dummy;
    list.forEach((p,i)=>{d.position.set(p.x,p.y,p.z);d.rotation.set(0,p.ry,0);d.scale.setScalar(p.s);d.updateMatrix();mesh.setMatrixAt(i,d.matrix);if(p.c!==undefined)mesh.setColorAt(i,new Color(p.c));});
    mesh.computeBoundingSphere();return mesh;
  }
  buildEntrants(){
    const vehicles=FAMILIES[this.family].vehicles;
    this.entrants=[0,1,2].map(i=>{
      const root=new Group(),models=vehicles.map(type=>{const m=createVehicle(type,this.materials[i]);m.visible=false;root.add(m);return m;});
      const shadow=new Mesh(this.shadowGeo,this.shadowMat);this.course.add(shadow);this.course.add(root);
      let marker=null;if(i===0){marker=new Mesh(this.markerGeo,this.markerMat);this.course.add(marker);}
      return {root,models,shadow,marker,shown:-1,pop:1,y:0,yaw:0,pitch:0,vy:0};
    });
  }
  owned(mesh){mesh.userData.owned=true;this.course.add(mesh);return mesh;}
  // Only per-course geometry is disposed; vehicle, prop and gate geometry is cached and shared between courses.
  clear(){
    for(const child of [...this.course.children]){
      if(child.userData.owned)child.geometry.dispose();
      if(child.isInstancedMesh)child.dispose();
      this.course.remove(child);
    }
    this.sparks.length=0;this.particles.count=0;this.gates=[];
  }
  // Interpolation: remember where entrants were before each fixed 20 ms tick.
  capture(entrants,ms){this.prev=entrants.map(e=>entrantTrack(this.layout,e,ms));}
  burst(x,y,z,hex,count=16,power=1,life=.55){
    for(let k=0;k<count;k++){const a=k/count*6.283+Math.random()*.4,up=(2+Math.random()*4)*power,colour=new Color(Array.isArray(hex)?hex[k%hex.length]:hex);
      if(this.sparks.length>=MAX_SPARKS)this.sparks.shift();
      this.sparks.push({x,y:y+1,z,vx:Math.cos(a)*5*power*(.6+Math.random()*.6),vy:up,vz:Math.sin(a)*5*power*(.6+Math.random()*.6),life,max:life,
        c:Array.isArray(hex)?colour:colour.lerp(new Color(1,1,1),Math.random()*.5)});}
  }
  // Celebration and reward bursts at an entrant's current position.
  sparkle(i,hex=0xffcf33){const p=this.entrants[i]?.root.position;if(p)this.burst(p.x,p.y+.6,p.z,hex,14,.8,.5);}
  confetti(i){const p=this.entrants[i]?.root.position;if(p)this.burst(p.x,p.y+1,p.z-2,CONFETTI,120,2.1,1.6);}
  update(entrants,ms,alpha,dt,reducedMotion=false){
    this.time+=dt;const course=this.data,n=course.blocks.length,vehicles=FAMILIES[this.family].vehicles;
    this.waterTrack.userData.uniforms.uTime.value=this.time;this.waterFloor.userData.uniforms.uTime.value=this.time;
    let focus=null;
    entrants.forEach((e,i)=>{
      const v=this.entrants[i],cur=entrantTrack(this.layout,e,ms),pre=this.prev?.[i]??cur,s=pre.s+(cur.s-pre.s)*alpha,lx=pre.x+(cur.x-pre.x)*alpha;
      const x=LANE_X[i]+lx,z=-s,b=Math.min(e.block,n-1),leg=course.blocks[b].options[e.choice]??course.blocks[b].options[0];
      const type=vehicles[e.slot],t=leg.t,prevTop=b>0?TOP[course.blocks[b-1].options[0].t]??0:0,top=TOP[t];
      const fly=FLYERS[t],flyer=type==='plane'||type==='glider'||type==='rocket';
      let y=type==='helicopter'?HELI_Y:fly?.type===type?fly.y:type==='submarine'&&t==='U'?-1.75:top===undefined?prevTop:
        type==='hovercraft'?top+.32:WATERY.has(t)?(FLOATERS.has(type)?-.55:-.66):top;
      if(this.snap){v.y=y;v.yaw=0;}
      const oldY=v.y;v.y+=(y-v.y)*damp(flyer?2.2:5,dt);v.vy=dt>0?(v.y-oldY)/dt:0;
      if(v.shown!==e.slot){
        if(v.shown>=0){v.pop=0;if(!this.snap)this.burst(x,v.y,z,ENTRANT_COLORS[i].body);}
        v.models.forEach((m,k)=>m.visible=k===e.slot);v.shown=e.slot;
      }
      v.pop=Math.min(1,v.pop+dt/.38);
      const model=v.models[e.slot],yaw=Math.atan2(-cur.dx,cur.ds);v.yaw+=(yaw-v.yaw)*damp(10,dt);
      const bob=type==='helicopter'||type==='hovercraft'?Math.sin(this.time*3+i)*.12:FLOATERS.has(type)?Math.sin(this.time*4+i)*.05:(t==='R'||t==='B')&&!reducedMotion?Math.sin(this.time*24+i)*.03:0;
      v.root.position.set(x,v.y+bob,z);
      v.root.rotation.set(flyer?Math.max(-.35,Math.min(.35,v.vy*.12)):0,v.yaw+(1-easeOutBack(v.pop))*Math.PI*1.2,FLOATERS.has(type)?Math.sin(this.time*2.6+i)*.06:0);
      const scale=v.pop<1?Math.max(.01,easeOutBack(v.pop)):1;model.scale.setScalar(scale);spin(model,dt);
      const groundY=top===undefined?(e.pos<.5?prevTop:null):top;
      v.shadow.visible=groundY!==null&&!(type==='submarine'&&t==='U');
      if(v.shadow.visible){v.shadow.position.set(x,groundY+(WATERY.has(t)?.12:.03),z);const k=1/(1+Math.max(0,v.y-groundY)*.18);v.shadow.scale.setScalar(k);}
      if(v.marker){v.marker.position.set(x,v.y+(type==='helicopter'?3.1:flyer?2.8:type==='monstertruck'?4:3.4)+Math.sin(this.time*4)*.18,z);v.marker.rotation.y=this.time*2;}
      // Trails: drill grit, rocket flame, crushed scrap and spray from anything skimming water.
      v.trail=(v.trail??0)-dt;
      if(v.trail<=0&&e.finish===null&&cur.s>pre.s+1e-6&&!reducedMotion&&v.pop>=1){
        v.trail=.08;const trail=type==='drill'&&t==='D'?[0x9a8f80,-1.6,.35]:type==='rocket'&&t==='O'?[[0xffa62b,0xffd23f,0xff5a2b],2.2,.25]:
          type==='monstertruck'&&t==='B'?[0x8f6a4a,1.4,.4]:WATERY.has(t)&&(FLOATERS.has(type)||type==='hovercraft')&&type!=='submarine'?[0xffffff,1.2,.3]:null;
        if(trail)this.burst(x,v.y-.6,z+trail[1],trail[0],2,trail[2],.45);
      }
      if(i===0)focus={x,y:v.y,z};
    });
    for(const g of this.gates){
      const st=gateState(g.gate,ms),target=st.open?1.35:0;g.angle+=(target-g.angle)*damp(9,dt);g.pivot.rotation.z=g.angle;
      g.lamp.material=st.open?(st.remaining<700?this.gateMats.warn:this.gateMats.open):this.gateMats.closed;g.bar.material=st.open?this.barMats.open:this.barMats.closed;
    }
    this.updateSparks(dt);if(focus)this.follow(focus,dt);this.snap=false;
  }
  updateSparks(dt){
    const d=this.dummy;let k=0;
    this.sparks=this.sparks.filter(p=>(p.life-=dt)>0);
    for(const p of this.sparks){p.vy-=(p.max>1?7:14)*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;
      d.position.set(p.x,p.y,p.z);d.rotation.set(p.life*9,p.life*7,0);d.scale.setScalar(p.life/p.max);d.updateMatrix();
      this.particles.setMatrixAt(k,d.matrix);this.particles.setColorAt(k,p.c);k++;}
    this.particles.count=k;this.particles.instanceMatrix.needsUpdate=true;if(this.particles.instanceColor)this.particles.instanceColor.needsUpdate=true;
  }
  follow(f,dt){
    const cam=this.camera,aspect=this.aspect;
    const half=Math.atan(Math.tan(this.fov*Math.PI/360)*aspect),dist=Math.max(14,Math.min(34,(aspect<1?10.4:13)/Math.tan(half)));
    const px=f.x*.5,py=Math.max(f.y,0)*.85+dist*.42,pz=f.z+dist*.82,k=this.snap?1:damp(5,dt);
    cam.position.set(cam.position.x+(px-cam.position.x)*k,cam.position.y+(py-cam.position.y)*k,cam.position.z+(pz-cam.position.z)*k);
    this.look??=new Vector3();this.look.set(f.x*.5,Math.max(f.y,0)*.85+.5,f.z-12);cam.lookAt(this.look);
    this.sky.position.copy(cam.position);this.sun.position.set(cam.position.x-40,80,cam.position.z+30);this.sun.target.position.set(cam.position.x,0,cam.position.z-30);this.sun.target.updateMatrixWorld();
  }
  // Landscape lifts the image with a view offset so the bottom HUD row never covers the player's vehicle.
  resize(width,height){
    const lift=width>=height?.4:0,cam=this.camera;this.aspect=width/height;this.fov=width>=height?50:72;
    cam.aspect=width/(height*(1+lift));cam.fov=Math.atan(Math.tan(this.fov*Math.PI/360)*(1+lift))*360/Math.PI;
    if(lift)cam.setViewOffset(width,height*(1+lift),0,height*lift,width,height);else cam.clearViewOffset();
    cam.updateProjectionMatrix();
  }
  render(){this.renderer.render(this.scene,this.camera);}
  // Vehicle thumbnails for the slot buttons, drawn with the same models into a corner of the canvas.
  icons(family,backgrounds,size=96){
    const renderer=this.renderer,canvas=renderer.domElement,ratio=renderer.getPixelRatio(),px=Math.round(size*ratio);
    const scene=new Scene();scene.add(new HemisphereLight(0xffffff,0x667788,1.6));const sun=new DirectionalLight(0xffffff,2.2);sun.position.set(-3,6,-4);scene.add(sun);
    const camera=new PerspectiveCamera(30,1,.1,100),out=[],tmp=document.createElement('canvas');tmp.width=tmp.height=px;const ctx=tmp.getContext('2d');
    const clear=new Color();renderer.getClearColor(clear);const clearAlpha=renderer.getClearAlpha();
    FAMILIES[family].vehicles.forEach((type,slot)=>{
      const model=createVehicle(type,this.materials[0]);scene.add(model);
      const wide={helicopter:1.3,plane:1.3,glider:1.75,rocket:1.2,monstertruck:1.2}[type]??1;camera.position.set(4.6*wide,3.2*wide,-6.2*wide);camera.lookAt(0,1,0);
      renderer.setClearColor(backgrounds[slot],1);renderer.setScissorTest(true);renderer.setViewport(0,0,size,size);renderer.setScissor(0,0,size,size);
      renderer.render(scene,camera);ctx.clearRect(0,0,px,px);ctx.drawImage(canvas,0,canvas.height-px,px,px,0,0,px,px);
      out.push(tmp.toDataURL('image/png'));scene.remove(model);
    });
    renderer.setScissorTest(false);renderer.setClearColor(clear,clearAlpha);const s=renderer.getSize(new Vector2());renderer.setViewport(0,0,s.x,s.y);
    return out;
  }
}
