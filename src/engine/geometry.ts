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

export interface SegmentDistanceResult {
  readonly pointOnFirst: Vec2;
  readonly pointOnSecond: Vec2;
  readonly distance: number;
}

const SEGMENT_EPS = 1e-9;

/**
 * Najkrótszy dystans między dwoma odcinkami [p1,q1] i [p2,q2] oraz punkty, w których
 * ten dystans występuje. Standardowy algorytm (Ericson, "Real-Time Collision
 * Detection", closestPtSegmentSegment) — używany do kolizji kapsuła-kapsuła
 * (motocykl z zawodnikiem to odcinek nos-ogon + promień), bo zwykła odległość
 * środek-środek nie ma sensu dla wydłużonego kształtu.
 */
export function closestPointsSegmentSegment(p1: Vec2, q1: Vec2, p2: Vec2, q2: Vec2): SegmentDistanceResult {
  const d1 = sub(q1, p1);
  const d2 = sub(q2, p2);
  const r = sub(p1, p2);
  const a = dot(d1, d1);
  const e = dot(d2, d2);
  const f = dot(d2, r);

  let s: number;
  let t: number;

  if (a <= SEGMENT_EPS && e <= SEGMENT_EPS) {
    s = 0;
    t = 0;
  } else if (a <= SEGMENT_EPS) {
    s = 0;
    t = clamp(f / e, 0, 1);
  } else {
    const c = dot(d1, r);
    if (e <= SEGMENT_EPS) {
      t = 0;
      s = clamp(-c / a, 0, 1);
    } else {
      const b = dot(d1, d2);
      const denom = a * e - b * b;
      s = denom > SEGMENT_EPS ? clamp((b * f - c * e) / denom, 0, 1) : 0;
      t = (b * s + f) / e;
      if (t < 0) {
        t = 0;
        s = clamp(-c / a, 0, 1);
      } else if (t > 1) {
        t = 1;
        s = clamp((b - c) / a, 0, 1);
      }
    }
  }

  const pointOnFirst = add(p1, scale(d1, s));
  const pointOnSecond = add(p2, scale(d2, t));
  return { pointOnFirst, pointOnSecond, distance: distance(pointOnFirst, pointOnSecond) };
}
