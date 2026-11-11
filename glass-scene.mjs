import * as THREE from './vendor/three-0.160.1.module.min.js';
import { createGlassStudio, createVisibleGlassMaterial } from './glass-studio.mjs?v=21d4e8f8af9f';
import { measureGlassVisibility } from './glass-visibility.mjs?v=08427a7bfa68';
import { createGlassModel } from './glass-models.mjs?v=69856564218d';
import { sampleSlot, modelPose, objectKind, OBJECT_COUNT, QUARTER_TURN, WHEEL_RADIUS } from './glass-roulette-core.mjs?v=e9d2dac7dead';

export function createGlassScene({ row, slots, onFailure = () => {} }) {
  const canvas = document.createElement('canvas');
  canvas.className = 'glass-scene'; canvas.setAttribute('aria-hidden', 'true');
  const context = canvas.getContext('webgl2', { antialias:true, alpha:false, powerPreference:'high-performance' });
  if (!context) throw new Error('WebGL2 unavailable');
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, context, antialias:true, alpha:false }); }
  catch (error) { context.getExtension('WEBGL_lose_context')?.loseContext(); throw error; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 3));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.autoClear = false;
  const background = new THREE.Color(getComputedStyle(row.closest('[data-statement]')).backgroundColor);
  renderer.setClearColor(background, 1);
  let room=null, pmrem=null, environment=null, material=null;
  let reels=[],prototypes=[];
  const geometries=new Set();
  try {
  room=createGlassStudio(); pmrem=new THREE.PMREMGenerator(renderer);
  environment=pmrem.fromScene(room.scene, .045);
  room.dispose(); room=null; pmrem.dispose(); pmrem=null;
  material=createVisibleGlassMaterial();
  prototypes=Array.from({length:OBJECT_COUNT},(_,kind)=>{
    const model=createGlassModel(kind,material);
    model.traverse(node=>{if(node.geometry)geometries.add(node.geometry);});
    return model;
  });
  reels=slots.map((slot, slotIndex) => {
    const scene = new THREE.Scene(); scene.background = background; scene.environment = environment.texture;
    const camera = new THREE.PerspectiveCamera(28, 1, .1, 30);
    camera.position.set((slotIndex - 1) * .1, .12 - slotIndex * .08, 5);
    camera.lookAt(0, 0, 0);
    const wheel = new THREE.Group(); wheel.position.z = -WHEEL_RADIUS; scene.add(wheel);
    const models = Array.from({ length:4 }, (_, index) => {
      const holder = new THREE.Group(), angle = index * QUARTER_TURN;
      holder.position.set(0, WHEEL_RADIUS * Math.sin(angle), WHEEL_RADIUS * Math.cos(angle));
      const kind=objectKind(slotIndex,index,0),shape=prototypes[kind].clone(true);
      holder.add(shape); wheel.add(holder);
      return { holder, shape, angle, kind };
    });
    return { slot, scene, camera, wheel, models, lastRound:-1 };
  });
  } catch(error) {
    room?.dispose(); pmrem?.dispose(); environment?.dispose(); material?.dispose();
    geometries.forEach(geometry=>geometry.dispose()); renderer.dispose(); renderer.forceContextLoss(); throw error;
  }
  let width=0, height=0, rectangles=[], elapsed=0, lastTime=null, frame=0, disposed=false;
  let lastAngles=[];
  const state = { visible:false, userPaused:false, reduced:false, suspended:document.hidden };
  const running = () => !disposed && width>0 && height>0 && state.visible && !state.userPaused && !state.reduced && !state.suspended;
  const draw = (force=false) => {
    if (disposed || !width || !height) return;
    const samples=reels.map((_,index)=>sampleSlot(elapsed,index));
    if (!force && samples.every((sample,index)=>sample.angle===lastAngles[index])) return;
    lastAngles=samples.map(sample=>sample.angle);
    renderer.setScissorTest(false); renderer.clear(true, true, true); renderer.setScissorTest(true);
    reels.forEach((reel, slotIndex) => {
      const rectangle = rectangles[slotIndex]; if (!rectangle || rectangle.width<=0 || rectangle.height<=0) return;
      const sample = samples[slotIndex];
      if (sample.round !== reel.lastRound) {
        const front = sample.round % 4;
        reel.models.forEach((model, index) => {
          if (reel.lastRound >= 0 && index === front) return;
          const kind=objectKind(slotIndex,index,sample.round);
          if(kind!==model.kind) {
            model.holder.remove(model.shape);
            model.shape=prototypes[kind].clone(true);model.holder.add(model.shape);model.kind=kind;
          }
          const pose = modelPose(slotIndex, index, sample.round);model.shape.rotation.set(pose.x, pose.y, pose.z);
        });
        reel.lastRound=sample.round;
      }
      reel.wheel.rotation.x=sample.angle;
      reel.models.forEach(({ holder, angle }) => {
        holder.rotation.x=-angle;
        holder.visible=Math.cos(angle - sample.angle)>.04;
      });
      renderer.setViewport(rectangle.x,rectangle.y,rectangle.width,rectangle.height);
      renderer.setScissor(rectangle.x,rectangle.y,rectangle.width,rectangle.height);
      renderer.clear(true,true,true); renderer.render(reel.scene,reel.camera);
    });
  };
  function fail() { if (disposed) return; dispose(); onFailure(); }
  function tick(now) {
    frame=0; if (!running()) { lastTime=null; return; }
    if (lastTime!==null) elapsed+=Math.min((now-lastTime)/1000,.05);
    lastTime=now;
    try { draw(); } catch (_) { fail(); return; }
    frame=requestAnimationFrame(tick);
  }
  function sync() {
    if (!running()) { cancelAnimationFrame(frame); frame=0; lastTime=null; return; }
    if (!frame) { lastTime=null; frame=requestAnimationFrame(tick); }
  }
  function resize() {
    if (disposed) return;
    const rect=row.getBoundingClientRect(); width=Math.round(rect.width); height=Math.round(rect.height);
    if (!width || !height) { sync(); return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 3)); renderer.setSize(width,height,false);
    rectangles=slots.map(slot=>{
      const box=slot.getBoundingClientRect(); return {x:box.left-rect.left,y:height-(box.top-rect.top)-box.height,width:box.width,height:box.height};
    });
    reels.forEach((reel,i)=>{ reel.camera.aspect=rectangles[i].width/rectangles[i].height; reel.camera.updateProjectionMatrix(); });
    try { draw(true); } catch (_) { fail(); return; } sync();
  }
  function lost(event) { event.preventDefault(); fail(); }
  function dispose() {
    if (disposed) return;
    disposed=true; cancelAnimationFrame(frame); frame=0; resizeObserver?.disconnect(); canvas.removeEventListener('webglcontextlost',lost);
    geometries.forEach(geometry=>geometry.dispose()); material.dispose(); environment.dispose(); renderer.dispose(); renderer.forceContextLoss();
    row.classList.remove('has-glass-scene'); canvas.remove();
  }
  const resizeObserver=typeof ResizeObserver==='function' ? new ResizeObserver(resize) : null;
  canvas.addEventListener('webglcontextlost',lost); row.append(canvas); resizeObserver?.observe(row);
  resize(); if (disposed) throw new Error('Glass rendering unavailable');
  function checkVisibility() {
    const dpr=renderer.getPixelRatio();
    return rectangles.map(rect=>{
      const x=Math.max(0,Math.round(rect.x*dpr)),y=Math.max(0,Math.round(rect.y*dpr));
      const w=Math.min(canvas.width-x,Math.round(rect.width*dpr)),h=Math.min(canvas.height-y,Math.round(rect.height*dpr));
      const pixels=new Uint8Array(w*h*4);
      context.readPixels(x,y,w,h,context.RGBA,context.UNSIGNED_BYTE,pixels);
      if(context.getError()!==context.NO_ERROR)return {visible:false,contrastRatio:0};
      return measureGlassVisibility(pixels,w,h);
    });
  }
  try {
  let visibility=checkVisibility();
  if(visibility.some(result=>!result.visible)) {
    // Preserve polished silver while strengthening a weak reflection on a driver.
    material.roughness=.20;material.envMapIntensity=1.45;material.color.set('#c2c6cc');
    material.needsUpdate=true;draw(true);visibility=checkVisibility();
  }
  row.dataset.glassContrast=Math.min(...visibility.map(result=>result.contrastRatio)).toFixed(3);
  if(visibility.some(result=>!result.visible)) throw new Error('Glass contrast below readable threshold');
  } catch(error) { dispose();throw error; }
  row.classList.add('has-glass-scene');
  return {
    setState(next) { if (disposed) return; Object.assign(state,next); sync(); },
    resize,
    renderStill() { if (!disposed) draw(true); },
    dispose
  };
}
