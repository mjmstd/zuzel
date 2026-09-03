import { describe, expect, it } from 'vitest';
import { add, angleDiff, approach, clamp, distance, fromAngle, normalizeAngle, sub } from '../src/engine/geometry.ts';

describe('geometry', () => {
  it('add/sub są odwrotnościami', () => {
    const a = { x: 3, y: -2 };
    const b = { x: -1, y: 5 };
    expect(add(sub(a, b), b)).toEqual(a);
  });

  it('distance jest symetryczna i nieujemna', () => {
    const a = { x: 0, y: 0 };
    const b = { x: 3, y: 4 };
    expect(distance(a, b)).toBe(5);
    expect(distance(b, a)).toBe(5);
  });

  it('fromAngle zwraca wektor jednostkowy', () => {
    const v = fromAngle(Math.PI / 3);
    expect(Math.hypot(v.x, v.y)).toBeCloseTo(1, 10);
  });

  it('normalizeAngle mieści się w (-PI, PI]', () => {
    // 3*PI i -3*PI to ten sam kąt co PI (mod 2*PI) — kanoniczna wartość to +PI,
    // bo zakres jest (-PI, PI] (PI należy, -PI nie).
    expect(normalizeAngle(3 * Math.PI)).toBeCloseTo(Math.PI, 10);
    expect(normalizeAngle(-3 * Math.PI)).toBeCloseTo(Math.PI, 10);
    expect(normalizeAngle(0.5)).toBeCloseTo(0.5, 10);
  });

  it('angleDiff daje najkrótszą różnicę', () => {
    expect(angleDiff(0, Math.PI / 4)).toBeCloseTo(Math.PI / 4, 10);
    expect(angleDiff(-Math.PI + 0.1, Math.PI - 0.1)).toBeCloseTo(-0.2, 10);
  });

  it('approach nie przekracza celu i respektuje osobne tempo', () => {
    expect(approach(0, 10, 5, 20, 1)).toBe(5);
    expect(approach(0, 10, 100, 20, 1)).toBe(10);
    expect(approach(10, 0, 5, 20, 1)).toBe(0);
    expect(approach(10, 0, 5, 3, 1)).toBe(7);
    expect(approach(5, 5, 1, 1, 1)).toBe(5);
  });

  it('clamp ogranicza do przedziału', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(11, 0, 10)).toBe(10);
  });
});
