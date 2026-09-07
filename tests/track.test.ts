import { describe, expect, it } from 'vitest';
import { createOvalTrack, nearestOnTrack, pointAt, sectorIndex, startPoint, outwardNormal } from '../src/engine/track.ts';
import { add, scale } from '../src/engine/geometry.ts';
import type { OvalTrackDef } from '../src/engine/types.ts';

const def: OvalTrackDef = { name: 'Test', straightLength: 40, turnRadius: 16, width: 12, laps: 4 };
const track = createOvalTrack(def);

describe('createOvalTrack', () => {
  it('totalLength = 2*straight + 2*PI*radius', () => {
    expect(track.totalLength).toBeCloseTo(2 * def.straightLength + 2 * Math.PI * def.turnRadius, 8);
  });
});

describe('pointAt', () => {
  it('jest okresowa: pointAt(s) === pointAt(s + totalLength)', () => {
    for (const s of [0, 10, 50, 100, 150]) {
      const a = pointAt(track, s);
      const b = pointAt(track, s + track.totalLength);
      expect(a.position.x).toBeCloseTo(b.position.x, 8);
      expect(a.position.y).toBeCloseTo(b.position.y, 8);
      expect(a.heading).toBeCloseTo(b.heading, 8);
    }
  });

  it('heading jest ciągły na złączeniach segmentów (bez skoków)', () => {
    const boundaries = [track.seg.straight1End, track.seg.turn1End, track.seg.straight2End, track.totalLength];
    for (const b of boundaries) {
      const before = pointAt(track, b - 1e-4);
      const after = pointAt(track, b + 1e-4);
      const dx = Math.abs(before.position.x - after.position.x);
      const dy = Math.abs(before.position.y - after.position.y);
      expect(dx).toBeLessThan(1e-2);
      expect(dy).toBeLessThan(1e-2);
      const headingDiff = Math.atan2(Math.sin(after.heading - before.heading), Math.cos(after.heading - before.heading));
      expect(Math.abs(headingDiff)).toBeLessThan(1e-2);
    }
  });

  it('cały owal jest zamkniętą pętlą (s=totalLength wraca do s=0)', () => {
    const start = pointAt(track, 0);
    const next = pointAt(track, track.totalLength);
    expect(next.position.x).toBeCloseTo(start.position.x, 6);
    expect(next.position.y).toBeCloseTo(start.position.y, 6);
    expect(next.heading).toBeCloseTo(start.heading, 6);
  });
});

describe('nearestOnTrack', () => {
  it('dla punktu na osi toru zwraca offset ≈ 0 i to samo s', () => {
    for (const s of [0, 5, 39, 41, 90, 100, 170]) {
      const p = pointAt(track, s);
      const proj = nearestOnTrack(track, p.position);
      expect(proj.offset).toBeCloseTo(0, 6);
      const sDiff = Math.min(Math.abs(proj.s - s), track.totalLength - Math.abs(proj.s - s));
      expect(sDiff).toBeLessThan(1e-4);
    }
  });

  it('punkt przesunięty na zewnątrz ma dodatni offset o poprawnej wartości', () => {
    const s = 20; // środek dolnej prostej
    const base = pointAt(track, s);
    const normal = outwardNormal(base.heading);
    const outside = add(base.position, scale(normal, 3));
    const proj = nearestOnTrack(track, outside);
    expect(proj.offset).toBeCloseTo(3, 6);
  });

  it('punkt przesunięty do środka ma ujemny offset', () => {
    const s = 20;
    const base = pointAt(track, s);
    const normal = outwardNormal(base.heading);
    const inside = add(base.position, scale(normal, -2));
    const proj = nearestOnTrack(track, inside);
    expect(proj.offset).toBeCloseTo(-2, 6);
  });

  it('działa też w łukach (offset radialny)', () => {
    const s = track.seg.straight1End + 10; // wewnątrz prawego łuku
    const base = pointAt(track, s);
    const normal = outwardNormal(base.heading);
    const outside = add(base.position, scale(normal, 4));
    const proj = nearestOnTrack(track, outside);
    expect(proj.offset).toBeCloseTo(4, 5);
  });
});

describe('sectorIndex', () => {
  it('dzieli tor na 4 równe ćwiartki 0..3', () => {
    const q = track.totalLength / 4;
    expect(sectorIndex(track, 0)).toBe(0);
    expect(sectorIndex(track, q - 0.01)).toBe(0);
    expect(sectorIndex(track, q + 0.01)).toBe(1);
    expect(sectorIndex(track, 3 * q + 0.01)).toBe(3);
    expect(sectorIndex(track, track.totalLength - 0.01)).toBe(3);
  });
});

describe('startPoint', () => {
  it('rozstawia zawodników w równych odstępach w granicach szerokości toru', () => {
    const cfg = { riderWidth: 1.0 };
    const laneCount = 4;
    const positions = Array.from({ length: laneCount }, (_, i) => startPoint(track, cfg, 5, i, laneCount));
    for (const p of positions) {
      const proj = nearestOnTrack(track, p.position);
      expect(Math.abs(proj.offset)).toBeLessThanOrEqual(def.width / 2 - cfg.riderWidth / 2 + 1e-6);
    }
    // skrajne pozycje są symetryczne względem osi
    const first = nearestOnTrack(track, positions[0]!.position);
    const last = nearestOnTrack(track, positions[laneCount - 1]!.position);
    expect(first.offset).toBeCloseTo(-last.offset, 6);
  });
});
