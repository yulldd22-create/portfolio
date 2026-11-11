import * as THREE from './vendor/three-0.160.1.module.min.js';

/* Neutral studio bands reveal polished silver on a light page.
   Export names stay compatible with the existing roulette scene. */
export function createGlassStudio() {
  const scene=new THREE.Scene();
  scene.background=new THREE.Color('#737373');
  const geometry=new THREE.PlaneGeometry(1,1),materials=[];
  const panels=[
    {position:[-4,2,4],size:[3.2,8],color:'#ffffff',intensity:1.8},
    {position:[4,0,3],size:[2.4,7],color:'#eeeeee',intensity:1.3},
    {position:[0,6,0],size:[5,3],color:'#ffffff',intensity:1.65},
    {position:[-1,0,4.8],size:[.9,8],color:'#050505',intensity:1},
    {position:[5,1,-4],size:[1.4,8],color:'#ffffff',intensity:1.9},
    {position:[0,-4,1],size:[6,2],color:'#d9d9d9',intensity:1}
  ];
  panels.forEach(panel=>{
    const material=new THREE.MeshBasicMaterial({color:new THREE.Color(panel.color).multiplyScalar(panel.intensity),toneMapped:false});
    const mesh=new THREE.Mesh(geometry,material);
    mesh.position.fromArray(panel.position);mesh.scale.set(panel.size[0],panel.size[1],1);mesh.lookAt(0,0,0);
    scene.add(mesh);materials.push(material);
  });
  let disposed=false;
  return {scene,dispose(){
    if(disposed)return;
    disposed=true;geometry.dispose();materials.forEach(material=>material.dispose());
  }};
}

export function createVisibleGlassMaterial() {
  return new THREE.MeshPhysicalMaterial({
    color:0xe5e5e5,toneMapped:true,metalness:1,roughness:.14,
    transmission:0,thickness:0,
    clearcoat:1,clearcoatRoughness:.06,
    iridescence:0,envMapIntensity:1.15
  });
}
