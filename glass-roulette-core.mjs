/* Deterministic wheel motion: no per-frame randomness, timers, or DOM. */
export const CYCLE_SECONDS = 3.4;
export const OBJECT_COUNT = 6;
export const QUARTER_TURN = Math.PI / 2;
export const WHEEL_RADIUS = 3.5;
const clamp = value => Math.max(0, Math.min(1, value));
export function sampleSlot(seconds, slot) {
  const t = Math.max(0, seconds - slot * .17);
  const round = Math.floor(t / CYCLE_SECONDS);
  const phase = t - round * CYCLE_SECONDS;
  const duration = 1.35 + slot * .18;
  const progress = clamp(phase / duration);
  const eased = 1 - (1 - progress) ** 4;
  const steps = 9 + slot * 4;
  return {
    round, progress, settled:progress === 1,
    angle:(round * steps + steps * eased) * QUARTER_TURN,
    frontIndex:((round + (progress === 1 ? 1 : 0)) % 4),
    targetShape:(round + slot + 1) % OBJECT_COUNT
  };
}
export function modelPose(slot, index, round) {
  const seed = (slot + 1) * 71 + (index + 1) * 113 + round * 137;
  const random = n => { const value = Math.sin(seed * 1.731 + n * 73.713) * 43758.5453; return value - Math.floor(value); };
  return { x:(random(1) - .5) * .72, y:(random(2) - .5) * 1.15, z:(random(3) - .5) * .68 };
}
export function wheelPosition(index, angle) {
  const theta = index * QUARTER_TURN - angle;
  return { y:WHEEL_RADIUS * Math.sin(theta), z:WHEEL_RADIUS * (Math.cos(theta) - 1), visible:Math.cos(theta) > .04 };
}

/* Four positions on each wheel; six shapes cycle through them without repeating a stop. */
export function objectKind(slot,wheelIndex,round) {
  const nextFront=(round+1)%4;
  return (wheelIndex+slot+round+1-nextFront)%OBJECT_COUNT;
}
