import type { Vec2 } from './types.ts';

export function vec(x: number, y: number): Vec2 {
  return { x, y };
}

export function add(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x + b.x, y: a.y + b.y };
}

export function sub(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x - b.x, y: a.y - b.y };
}

export function scale(a: Vec2, k: number): Vec2 {
  return { x: a.x * k, y: a.y * k };
}

export function length(a: Vec2): number {
  return Math.hypot(a.x, a.y);
}

export function distance(a: Vec2, b: Vec2): number {
  return length(sub(a, b));
}

export function dot(a: Vec2, b: Vec2): number {
  return a.x * b.x + a.y * b.y;
}

export function fromAngle(angle: number): Vec2 {
  return { x: Math.cos(angle), y: Math.sin(angle) };
}

/** Normalizuje kąt do zakresu (-PI, PI]. */
export function normalizeAngle(angle: number): number {
  let a = angle % (2 * Math.PI);
  if (a > Math.PI) a -= 2 * Math.PI;
  if (a <= -Math.PI) a += 2 * Math.PI;
  return a;
}

/** Najkrótsza różnica kątowa `to - from`, w zakresie (-PI, PI]. */
export function angleDiff(from: number, to: number): number {
  return normalizeAngle(to - from);
}

/**
 * Przesuwa `current` w stronę `target` z osobnym tempem dla wzrostu i spadku.
 * Używane zarówno dla prędkości (accel/brake) jak i innych wielkości skalarnych.
 */
export function approach(current: number, target: number, riseRate: number, fallRate: number, dt: number): number {
  if (current < target) {
    return Math.min(target, current + riseRate * dt);
  }
  if (current > target) {
    return Math.max(target, current - fallRate * dt);
  }
  return current;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
