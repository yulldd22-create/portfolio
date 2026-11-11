import * as THREE from './vendor/three-0.160.1.module.min.js';

export const CHROME_OBJECT_NAMES=Object.freeze(['star','heart','crescent','sparkles','flower','infinity']);

/* A closed inflated silhouette, with shared poles and no bevel-offset intersections. */
function puffyOutline(points,depth=.25,latitudes=40) {
  points=points.map(p=>new THREE.Vector2(p.x,p.y));
  const area=points.reduce((sum,p,i)=>{const q=points[(i+1)%points.length];return sum+p.x*q.y-q.x*p.y;},0);
  if(area<0)points.reverse();
  const count=points.length,positions=[0,0,depth],indices=[];
  for(let ring=1;ring<latitudes;ring++) {
    const angle=ring/latitudes*Math.PI,scale=Math.sin(angle),z=depth*Math.cos(angle);
    points.forEach(p=>positions.push(p.x*scale,p.y*scale,z));
  }
  const bottom=positions.length/3;positions.push(0,0,-depth);
  for(let j=0;j<count;j++)indices.push(0,1+j,1+(j+1)%count);
  for(let ring=0;ring<latitudes-2;ring++)for(let j=0;j<count;j++) {
    const a=1+ring*count+j,b=1+(ring+1)*count+j,c=1+(ring+1)*count+(j+1)%count,d=1+ring*count+(j+1)%count;
    indices.push(a,b,d,b,c,d);
  }
  const last=1+(latitudes-2)*count;
  for(let j=0;j<count;j++)indices.push(last+j,bottom,last+(j+1)%count);
  return geometryFrom(positions,indices);
}
function geometryFrom(positions,indices) {
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setIndex(indices);geometry.computeVertexNormals();return geometry;
}
function radialPoints(lobes,base,amount,phase=0,count=200) {
  return Array.from({length:count},(_,i)=>{
    const angle=i/count*Math.PI*2,r=base+amount*Math.cos(lobes*(angle-phase));
    return new THREE.Vector2(r*Math.cos(angle),r*Math.sin(angle));
  });
}
function heartGeometry() {
  const path=new THREE.Shape();
  path.moveTo(0,-.96);
  path.bezierCurveTo(-1.12,-.18,-1.19,.71,-.63,.94);
  path.bezierCurveTo(-.32,1.08,-.08,.87,0,.65);
  path.bezierCurveTo(.08,.87,.32,1.08,.63,.94);
  path.bezierCurveTo(1.19,.71,1.12,-.18,0,-.96);
  const points=path.getSpacedPoints(220);points.pop();
  return puffyOutline(points,.31,44);
}
function crescentGeometry() {
  const around=160,across=32,R=.77,positions=[],indices=[];
  const at=t=>Math.PI/3+t*Math.PI*4/3;
  positions.push(R*Math.cos(at(0)),R*Math.sin(at(0)),0);
  for(let i=1;i<around;i++) {
    const t=i/around,angle=at(t),taper=Math.pow(Math.sin(Math.PI*t),.64);
    for(let j=0;j<across;j++) {
      const v=j/across*Math.PI*2,r=R+.285*taper*Math.cos(v);
      positions.push(r*Math.cos(angle),r*Math.sin(angle),.205*taper*Math.sin(v));
    }
  }
  const end=positions.length/3;positions.push(R*Math.cos(at(1)),R*Math.sin(at(1)),0);
  for(let j=0;j<across;j++)indices.push(0,1+j,1+(j+1)%across);
  for(let i=0;i<around-2;i++)for(let j=0;j<across;j++) {
    const a=1+i*across+j,b=1+(i+1)*across+j,c=1+(i+1)*across+(j+1)%across,d=1+i*across+(j+1)%across;
    indices.push(a,b,d,b,c,d);
  }
  const last=1+(around-2)*across;
  for(let j=0;j<across;j++)indices.push(last+j,end,last+(j+1)%across);
  const geometry=geometryFrom(positions,indices);
  geometry.rotateZ(-.48);return geometry;
}
class OvalCurve extends THREE.Curve {
  getPoint(t,target=new THREE.Vector3()) {const a=t*Math.PI*2;return target.set(.25*Math.cos(a),.58*Math.sin(a),0);}
}
class InfinityCurve extends THREE.Curve {
  getPoint(t,target=new THREE.Vector3()) {const a=t*Math.PI*2;return target.set(.82*Math.sin(a),.37*Math.sin(2*a),.15*Math.cos(a));}
}

export function createGlassModel(kind,material) {
  const group=new THREE.Group(),mesh=geometry=>new THREE.Mesh(geometry,material);
  switch(((kind%6)+6)%6) {
    case 0:group.add(mesh(puffyOutline(radialPoints(5,.66,.25,Math.PI/2),.24,44)));break;
    case 1:group.add(mesh(heartGeometry()));break;
    case 2:group.add(mesh(crescentGeometry()));break;
    case 3:{
      const geometry=puffyOutline(radialPoints(4,.48,.23),.17,36);
      const main=mesh(geometry),small=mesh(geometry);
      main.position.set(-.19,-.12,0);main.rotation.z=.08;
      small.position.set(.48,.62,.02);small.scale.setScalar(.48);small.rotation.z=.08;
      group.add(main,small);break;
    }
    case 4:{
      const geometry=new THREE.TubeGeometry(new OvalCurve(),128,.065,24,true);
      for(let i=0;i<5;i++) {
        const angle=i/5*Math.PI*2,petal=mesh(geometry);
        petal.position.set(-.46*Math.sin(angle),.46*Math.cos(angle),0);petal.rotation.z=angle;
        group.add(petal);
      }
      group.add(mesh(new THREE.SphereGeometry(.18,40,28)));break;
    }
    case 5:group.add(mesh(new THREE.TubeGeometry(new InfinityCurve(),192,.105,28,true)));break;
  }
  const box=new THREE.Box3().setFromObject(group),center=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3());
  group.children.forEach(child=>child.position.sub(center));
  group.scale.setScalar(2.04/Math.max(size.x,size.y,size.z));
  group.name=CHROME_OBJECT_NAMES[((kind%6)+6)%6];
  return group;
}
