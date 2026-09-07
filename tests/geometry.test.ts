import { describe, expect, it } from 'vitest';
import {
  add,
  angleDiff,
  clamp,
  closestPointsSegmentSegment,
  distance,
  fromAngle,
  normalizeAngle,
  sub,
} from '../src/engine/geometry.ts';

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

  it('clamp ogranicza do przedziału', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(11, 0, 10)).toBe(10);
  });

  describe('closestPointsSegmentSegment', () => {
    it('dla równoległych odcinków daje odległość prostopadłą', () => {
      const r = closestPointsSegmentSegment({ x: -1, y: 0 }, { x: 1, y: 0 }, { x: -1, y: 2 }, { x: 1, y: 2 });
      expect(r.distance).toBeCloseTo(2, 10);
    });

    it('dla przecinających się odcinków odległość wynosi 0', () => {
      const r = closestPointsSegmentSegment({ x: -1, y: 0 }, { x: 1, y: 0 }, { x: 0, y: -1 }, { x: 0, y: 1 });
      expect(r.distance).toBeCloseTo(0, 10);
    });

    it('dla współliniowych, nienachodzących odcinków liczy lukę między końcami', () => {
      const r = closestPointsSegmentSegment({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 });
      expect(r.distance).toBeCloseTo(1, 10);
    });

    it('dla prostopadłych, mijających się odcinków (najbliżej są końce)', () => {
      // Odcinek 1: pozioma kreska daleko z boku. Odcinek 2: pionowa kreska gdzie indziej.
      const r = closestPointsSegmentSegment({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 5, y: 5 }, { x: 5, y: 8 });
      expect(r.distance).toBeCloseTo(distance({ x: 1, y: 0 }, { x: 5, y: 5 }), 10);
    });

    it('jest symetryczna względem kolejności odcinków', () => {
      const p1 = { x: -1, y: 0 };
      const q1 = { x: 1, y: 0.3 };
      const p2 = { x: 0, y: 2 };
      const q2 = { x: 2, y: 3 };
      const a = closestPointsSegmentSegment(p1, q1, p2, q2);
      const b = closestPointsSegmentSegment(p2, q2, p1, q1);
      expect(a.distance).toBeCloseTo(b.distance, 10);
    });
  });
});
