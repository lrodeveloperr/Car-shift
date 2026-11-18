// Store thumbnail scene. Thumbnails are marketing: one glance must sell "race by shape-shifting" and earn the tap.
// So: a huge orange hero car leaping off the road, a gold burst where it becomes the boat that slams into the water,
// the helicopter bursting through a gold ring above, rivals right on its tail, a low tilted camera and speed streaks.
// Built from the game's own vehicle models and palette, so it shows the real game. No text or logos (YouTube bans
// branding in Playables thumbnails). Bundled and photographed by tools/thumbnails.mjs; never part of the game bundle.
import {WebGLRenderer,Scene,PerspectiveCamera,Color,Fog,HemisphereLight,DirectionalLight,Mesh,MeshLambertMaterial,MeshBasicMaterial,
  PlaneGeometry,BoxGeometry,CylinderGeometry,ConeGeometry,IcosahedronGeometry,OctahedronGeometry,TorusGeometry,SphereGeometry,CircleGeometry,
  BufferGeometry,Float32BufferAttribute,BackSide,Group,Vector3,Box3,CatmullRomCurve3,MathUtils} from 'three';
import {createVehicle,entrantMaterials} from '../src/vehicles.mjs';

const lambert=c=>new MeshLambertMaterial({color:c,flatShading:true});
const basic=(c,opacity=1)=>new MeshBasicMaterial({color:c,transparent:opacity<1,opacity,depthWrite:opacity>=1,fog:false});
let seed=11;const rnd=()=>(seed=(seed*16807)%2147483647)/2147483647;

const renderer=new WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
renderer.setPixelRatio(devicePixelRatio);document.body.appendChild(renderer.domElement);
const scene=new Scene();scene.fog=new Fog(0xd8f1ff,45,140);
scene.add(new HemisphereLight(0xe6f6ff,0x8a7a5a,1.35));
const sun=new DirectionalLight(0xfff4e0,2.4);sun.position.set(-20,50,60);scene.add(sun);

// Sky dome: a deep, saturated blue so the orange hero pops (complementary colours).
{const g=new SphereGeometry(400,24,12),pos=g.attributes.position,col=[],top=new Color(0x1f7ae8),bottom=new Color(0xcfeeff),c=new Color();
  for(let i=0;i<pos.count;i++){c.lerpColors(bottom,top,MathUtils.clamp(pos.getY(i)/150,0,1));col.push(c.r,c.g,c.b);}
  g.setAttribute('color',new Float32BufferAttribute(col,3));scene.add(new Mesh(g,new MeshBasicMaterial({vertexColors:true,side:BackSide,fog:false})));}

// Faceted sea, and the land it meets along a shore that runs away from the camera (land left, water right).
const shore=z=>-.6-.02*z;
{const g=new PlaneGeometry(400,400,100,100).toNonIndexed();g.rotateX(-Math.PI/2);const p=g.attributes.position;
  for(let i=0;i<p.count;i++)p.setY(i,-.18+Math.sin(p.getX(i)*.9+p.getZ(i)*.6)*.08+Math.cos(p.getZ(i)*1.3)*.06);
  g.computeVertexNormals();scene.add(new Mesh(g,lambert(0x2aa8ee)));}
function strip(x0,x1,color,y){const zs=[];for(let z=20;z>=-80;z-=2)zs.push(z);const v=[];
  for(let i=0;i<zs.length-1;i++){const a=zs[i],b=zs[i+1];v.push(x0(a),0,a,x1(a),0,a,x1(b),0,b,x0(a),0,a,x1(b),0,b,x0(b),0,b);}
  const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(v,3));g.computeVertexNormals();const m=new Mesh(g,lambert(color));m.position.y=y;scene.add(m);}
strip(()=>-80,shore,0x5fc24a,.03);strip(shore,z=>shore(z)+.8,0xf2dc9e,.02);

// The road the car leaps from.
const ROAD_X=-3;
{const road=new Mesh(new BoxGeometry(3.4,.06,100),lambert(0x343944));road.position.set(ROAD_X,.06,-30);scene.add(road);
  for(let z=18;z>-80;z-=3.4){const d=new Mesh(new BoxGeometry(.22,.07,1.6),lambert(0xf5f5f0));d.position.set(ROAD_X,.07,z);scene.add(d);}
  for(const side of [-1,1]){const e=new Mesh(new BoxGeometry(.14,.07,100),lambert(0xf5f5f0));e.position.set(ROAD_X+side*1.55,.07,-30);scene.add(e);}}

// A few palms well back and to the left, so the background reads "coast" without cluttering the hero.
function palm(x,z,h=3){const g=new Group();const trunk=new Mesh(new CylinderGeometry(.13,.2,h,6),lambert(0x8a5a32));trunk.position.y=h/2;g.add(trunk);
  for(let i=0;i<6;i++){const leaf=new Mesh(new ConeGeometry(.38,1.9,4),lambert(0x2f9e44));leaf.position.set(Math.cos(i)*.62,h,Math.sin(i)*.62);
    leaf.rotation.set(Math.sin(i)*1.1,0,-Math.cos(i)*1.1);g.add(leaf);}g.position.set(x,0,z);g.rotation.z=(rnd()-.5)*.15;scene.add(g);}
for(const [x,z,h] of [[-7.5,-6,3.6],[-9.5,-14,3.4],[-7,-22,3.2],[-11,-28,3.8],[-14,-10,3.4],[-8,-36,3.4]])palm(x,z,h);
function cloud(x,y,z,s){const g=new Group();for(let i=0;i<5;i++){const b=new Mesh(new IcosahedronGeometry(s*(.6+rnd()*.5),0),lambert(0xffffff));
  b.position.set((i-2)*s*.75,(rnd()-.3)*s*.4,(rnd()-.5)*s*.4);g.add(b);}g.position.set(x,y,z);scene.add(g);}
cloud(-16,15,-50,3);cloud(18,17,-60,3.4);cloud(-34,12,-75,3.6);cloud(36,13,-85,3.8);
for(const [x,z] of [[5.5,-6],[1.8,-14]]){const b=new Group();const base=new Mesh(new CylinderGeometry(.24,.32,.55,8),lambert(0xe8263c));base.position.y=.1;b.add(base);
  const cap=new Mesh(new ConeGeometry(.22,.45,8),lambert(0xf5f5f0));cap.position.y=.6;b.add(cap);b.position.set(x,0,z);scene.add(b);}

// Racers. Each sits in a pose group (pitch and bank in model space; models face -z); the outer group turns it toward
// the camera. The orange player appears in all three forms; blue and pink rivals are right behind.
function racer(type,colour,scale=1){const m=createVehicle(type,entrantMaterials(colour));for(const s of m.userData.spinners)s.pivot.rotation[s.axis]=.6;
  const pose=new Group();pose.add(m);const outer=new Group();outer.add(pose);outer.scale.setScalar(scale);scene.add(outer);return {outer,pose,model:m};}
const car=racer('car',0,1.5),boat=racer('boat',0,1.5),heli=racer('helicopter',0,1.6);
const rivalCar=racer('car',1,1.2),rivalBoat=racer('boat',2,1.2),rivalHeli=racer('helicopter',1);
const RACERS={car,boat,heli,rivalCar,rivalBoat,rivalHeli};
car.pose.rotation.set(.2,0,-.12);boat.pose.rotation.set(.12,0,.1);heli.pose.rotation.set(-.2,0,.16);rivalBoat.pose.rotation.set(.08,0,0);

// The car is airborne: a soft shadow on the ground under it sells the height.
const shadow=new Mesh(new CircleGeometry(1.6,20),basic(0x000000,.22));shadow.rotation.x=-Math.PI/2;scene.add(shadow);

// Spray in the boat's own frame (bow at -z): a rooster tail off the stern and low bow waves to the sides, never over
// the hull, so the boat stays readable.
const splash=new Group();scene.add(splash);
for(let i=0;i<10;i++){const t=i/9;const f=new Mesh(new IcosahedronGeometry(.25+t*.35,0),lambert(0xffffff));
  f.position.set((rnd()-.5)*.8*(1+t),.3+Math.sin(t*Math.PI)*1.6,2.4+t*3.2);splash.add(f);}
for(let i=0;i<10;i++){const side=i%2?1:-1,t=Math.floor(i/2)/4;const f=new Mesh(new IcosahedronGeometry(.2+t*.15,0),lambert(0xffffff));
  f.scale.y=.6;f.position.set(side*(1.3+t*1.1),.12+t*.3,-1.2+t*3);splash.add(f);}

// The shift burst between car and boat: a white flash ring, gold rays and a sparkle trail on up to the helicopter.
const burst=new Group();scene.add(burst);
burst.add(new Mesh(new TorusGeometry(1.15,.09,8,40),basic(0xffffff)));
burst.add(new Mesh(new CircleGeometry(.9,24),basic(0xfff4b0,.55)));
for(let i=0;i<14;i++){const a=i/14*Math.PI*2+.1,r=1.6+(i%3)*.35;
  const d=new Mesh(new OctahedronGeometry(i%2?.2:.14,0),basic(i%3?0xffd23f:0xffffff));d.position.set(Math.cos(a)*r,Math.sin(a)*r,0);d.rotation.z=a;burst.add(d);
  const ray=new Mesh(new BoxGeometry(.06,.5,.02),basic(0xffe680,.85));ray.position.set(Math.cos(a)*(r-.55),Math.sin(a)*(r-.55),0);ray.rotation.z=a-Math.PI/2;burst.add(ray);}
const trail=new Group();scene.add(trail);

// Flight rings: the helicopter has just burst through the near one.
const rings=[0].map(()=>{const r=new Mesh(new TorusGeometry(2.7,.22,10,40),lambert(0xffc93c));scene.add(r);return r;});

// Speed streaks.
const streaks=new Group();scene.add(streaks);
for(let i=0;i<26;i++){const len=2.5+rnd()*4;const s=new Mesh(new BoxGeometry(.05,.05,len),basic(0xffffff,.5+rnd()*.3));
  s.position.set((rnd()-.5)*18,.4+rnd()*7,-14+rnd()*16);streaks.add(s);}

// Two layouts. Wide frames spread the three forms left to right; tall frames stack them bottom to top. The camera
// then backs off until every corner of the three orange bodies projects inside the frame with a small margin.
const LAYOUT={
  wide:{car:[-2.1,1.3,7.4],boat:[3.3,-.05,4.4],heli:[.9,5.6,-1.2],rivalCar:[ROAD_X,.08,-1.5],rivalBoat:[5.6,-.05,-6],rivalHeli:[-3,8,-16],
    view:[.1,.17,1],fov:52,roll:-.07,margin:.9,burst:.85},
  tall:{car:[-1.5,1.2,9.4],boat:[2,-.05,3],heli:[.2,8.4,-3.4],rivalCar:[ROAD_X,.08,-1.8],rivalBoat:[4.6,-.05,-6],rivalHeli:[-3,9.5,-15],
    view:[.06,.2,1],fov:58,roll:-.05,margin:.88,burst:.8},
};
const YAW={car:.6,boat:-1.05,heli:.35,rivalCar:.3,rivalBoat:-.8,rivalHeli:.2};
const camera=new PerspectiveCamera(50,1,.1,900);
const v3=a=>new Vector3(...a);
window.render=(w,h)=>{
  renderer.setSize(w,h);const aspect=w/h,L=aspect<1?LAYOUT.tall:LAYOUT.wide;camera.aspect=aspect;camera.fov=L.fov;camera.updateProjectionMatrix();
  const view=v3(L.view).normalize(),face=Math.atan2(view.x,view.z);
  for(const [k,r] of Object.entries(RACERS)){r.outer.position.copy(v3(L[k]));r.outer.rotation.y=Math.PI+face+YAW[k];}
  const C=car.outer.position,B=boat.outer.position,H=heli.outer.position;
  shadow.position.set(C.x,.09,C.z);
  splash.position.set(B.x,-.05,B.z);splash.rotation.y=boat.outer.rotation.y;
  burst.position.copy(C).lerp(B,.42).add(new Vector3(0,1.9,0));burst.scale.setScalar(L.burst);
  rings[0].position.copy(H).add(new Vector3(0,.5,-3.2));
  // Sparkle trail: car to burst to boat, then up to the helicopter.
  trail.clear();const arc=new CatmullRomCurve3([C.clone().add(new Vector3(.3,1.4,0)),burst.position.clone(),B.clone().add(new Vector3(0,2,0)),
    B.clone().lerp(H,.5).add(new Vector3(.6,1,0)),H.clone().add(new Vector3(0,-.4,0))]);
  for(let i=0;i<=36;i++){const t=i/36,p=arc.getPoint(t),s=.09+.08*Math.sin(t*Math.PI*4)**2;
    const g=new Mesh(new OctahedronGeometry(s,0),basic(i%3?0xffd23f:0xffffff));g.position.copy(p);g.rotation.set(t*5,t*3,0);trail.add(g);}
  const corners=[];for(const r of [car,boat,heli]){r.outer.updateMatrixWorld(true);const b=new Box3();for(const m of r.model.children)if(m.isMesh)b.expandByObject(m);
    for(let i=0;i<8;i++)corners.push(new Vector3(i&1?b.max.x:b.min.x,i&2?b.max.y:b.min.y,i&4?b.max.z:b.min.z));}
  const center=new Box3().setFromPoints(corners).getCenter(new Vector3()),p=new Vector3();
  for(let dist=4;dist<80;dist+=.05){
    camera.position.copy(center).addScaledVector(view,dist);camera.up.set(Math.sin(L.roll),Math.cos(L.roll),0);camera.lookAt(center);camera.updateMatrixWorld();
    if(corners.every(c=>{p.copy(c).project(camera);return Math.abs(p.x)<=L.margin&&Math.abs(p.y)<=L.margin;}))break;
  }
  // Then crop: centre the three orange bodies and zoom until they fill the margin box, so they are as big as possible.
  let x0=1,x1=-1,y0=1,y1=-1;for(const c of corners){p.copy(c).project(camera);x0=Math.min(x0,p.x);x1=Math.max(x1,p.x);y0=Math.min(y0,p.y);y1=Math.max(y1,p.y);}
  const zoom=Math.max(1,Math.min(L.margin/((x1-x0)/2),L.margin/((y1-y0)/2))),cw=w/zoom,ch=h/zoom;
  camera.setViewOffset(w,h,((x0+x1)/2+1)/2*w-cw/2,(1-(y0+y1)/2)/2*h-ch/2,cw,ch);
  // Flat effects face the camera.
  burst.quaternion.copy(camera.quaternion);for(const r of rings)r.lookAt(camera.position);
  renderer.render(scene,camera);
};
document.body.dataset.ready='1';
