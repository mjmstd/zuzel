import { describe, expect, it } from 'vitest';
import { createOvalTrack, pointAt, outwardNormal } from '../src/engine/track.ts';
import {
  applyCrash,
  isCollisionImmune,
  isCrashed,
  isOffTrack,
  resolveCollisions,
  updateLap,
  withTrackProjection,
} from '../src/engine/rules.ts';
import { defaultRaceConfig, defaultTrack } from '../src/engine/config.ts';
import type { RiderState } from '../src/engine/types.ts';
import { add, scale } from '../src/engine/geometry.ts';

const track = createOvalTrack(defaultTrack);

function makeRider(overrides: Partial<RiderState> = {}): RiderState {
  return {
    id: 1,
    color: 'red',
    name: 'Test',
    position: { x: 0, y: 0 },
    heading: 0,
    velocityAngle: 0,
    speed: 0,
    s: 0,
    offset: 0,
    lap: 0,
    sectorIndex: 0,
    crashedUntil: 0,
    collisionImmuneUntil: 0,
    finished: false,
    finishTime: null,
    ...overrides,
  };
}

describe('isOffTrack', () => {
  it('jest false na osi toru i true daleko za bandą', () => {
    const onAxis = withTrackProjection(makeRider({ position: pointAt(track, 10).position }), track);
    expect(isOffTrack(onAxis, track)).toBe(false);

    const base = pointAt(track, 10);
    const normal = outwardNormal(base.heading);
    const farOut = add(base.position, scale(normal, defaultTrack.width));
    const off = withTrackProjection(makeRider({ position: farOut }), track);
    expect(isOffTrack(off, track)).toBe(true);
  });
});

describe('applyCrash / isCrashed / isCollisionImmune', () => {
  it('zeruje prędkość i blokuje na czas kary', () => {
    const rider = makeRider({ speed: 20 });
    const crashed = applyCrash(rider, 10, defaultRaceConfig, track);
    expect(crashed.speed).toBe(0);
    expect(isCrashed(crashed, 10)).toBe(true);
    expect(isCrashed(crashed, 10 + defaultRaceConfig.crashPenaltySeconds + 0.01)).toBe(false);
  });

  it('nietykalność na kolizje trwa dłużej niż sama kara ruchowa', () => {
    const rider = makeRider();
    const crashed = applyCrash(rider, 10, defaultRaceConfig, track);
    const unfreezeAt = 10 + defaultRaceConfig.crashPenaltySeconds;
    // Zaraz po odblokowaniu ruchu zawodnik może jechać, ale wciąż jest odporny na nową kolizję.
    expect(isCrashed(crashed, unfreezeAt + 0.01)).toBe(false);
    expect(isCollisionImmune(crashed, unfreezeAt + 0.01)).toBe(true);
    expect(isCollisionImmune(crashed, unfreezeAt + defaultRaceConfig.collisionImmunitySeconds + 0.01)).toBe(false);
  });
});

describe('updateLap', () => {
  it('nalicza okrążenie przy przejściu z sektora 3 do 0', () => {
    const rider = makeRider({ sectorIndex: 3, lap: 0, s: track.totalLength - 0.001 });
    const moved = { ...rider, s: 0.5 };
    const next = updateLap(moved, track);
    expect(next.lap).toBe(1);
    expect(next.sectorIndex).toBe(0);
  });

  it('nie nalicza okrążenia przy zwykłym przejściu sektorów 0->1', () => {
    const rider = makeRider({ sectorIndex: 0, lap: 0 });
    const q = track.totalLength / 4;
    const moved = { ...rider, s: q + 1 };
    const next = updateLap(moved, track);
    expect(next.lap).toBe(0);
    expect(next.sectorIndex).toBe(1);
  });
});

describe('resolveCollisions', () => {
  // Zawodnicy "obok siebie": heading=0 (skierowani wzdłuż +x), przesunięci w Y
  // (w poprzek kierunku jazdy) — to jest szerokość kapsuły, nie długość.
  it('w trybie ghost nic nie zmienia', () => {
    const cfg = { ...defaultRaceConfig, collisionMode: 'ghost' as const };
    const a = makeRider({ id: 1, position: { x: 0, y: 0 }, speed: 15 });
    const b = makeRider({ id: 2, position: { x: 0, y: 0.1 }, speed: 15 });
    const result = resolveCollisions([a, b], cfg, 5, track);
    expect(result[0]!.speed).toBe(15);
    expect(result[1]!.speed).toBe(15);
  });

  it('w trybie solid zderzenie zeruje prędkość obu blisko siebie zawodników', () => {
    const cfg = { ...defaultRaceConfig, collisionMode: 'solid' as const, riderWidth: 1 };
    const a = makeRider({ id: 1, position: { x: 0, y: 0 }, speed: 15 });
    const b = makeRider({ id: 2, position: { x: 0, y: 0.4 }, speed: 15 });
    const c = makeRider({ id: 3, position: { x: 100, y: 100 }, speed: 15 });
    const result = resolveCollisions([a, b, c], cfg, 5, track);
    expect(result.find((r) => r.id === 1)!.speed).toBe(0);
    expect(result.find((r) => r.id === 2)!.speed).toBe(0);
    expect(result.find((r) => r.id === 3)!.speed).toBe(15);
  });

  it('nie zderza zawodników po mecie', () => {
    const cfg = { ...defaultRaceConfig, collisionMode: 'solid' as const, riderWidth: 1 };
    const a = makeRider({ id: 1, position: { x: 0, y: 0 }, speed: 15, finished: true });
    const b = makeRider({ id: 2, position: { x: 0, y: 0.4 }, speed: 15, finished: true });
    const result = resolveCollisions([a, b], cfg, 5, track);
    expect(result[0]!.speed).toBe(15);
    expect(result[1]!.speed).toBe(15);
  });

  it('rozsuwa nakładających się zawodników na dokładną minimalną odległość (szerokość kapsuły)', () => {
    const cfg = { ...defaultRaceConfig, collisionMode: 'solid' as const, riderWidth: 1 };
    const a = makeRider({ id: 1, position: { x: 0, y: 0 }, speed: 15 });
    const b = makeRider({ id: 2, position: { x: 0, y: 0.4 }, speed: 15 });
    const result = resolveCollisions([a, b], cfg, 5, track);
    const ra = result.find((r) => r.id === 1)!;
    const rb = result.find((r) => r.id === 2)!;
    const dist = Math.hypot(ra.position.x - rb.position.x, ra.position.y - rb.position.y);
    expect(dist).toBeCloseTo(cfg.riderWidth, 6);
  });

  it('kapsuła jest wąska w bok, ale długa wzdłuż heading — to nie kulka', () => {
    const cfg = { ...defaultRaceConfig, collisionMode: 'solid' as const, riderWidth: 1, riderLength: 2.6 };
    // Ta sama odległość środek-środek (2.0): obok siebie bezpiecznie, dziób-w-ogon kolizja.
    const sideBySideA = makeRider({ id: 1, position: { x: 0, y: 0 }, speed: 15 });
    const sideBySideB = makeRider({ id: 2, position: { x: 0, y: 2.0 }, speed: 15 });
    const sideResult = resolveCollisions([sideBySideA, sideBySideB], cfg, 5, track);
    expect(sideResult.find((r) => r.id === 1)!.speed).toBe(15);
    expect(sideResult.find((r) => r.id === 2)!.speed).toBe(15);

    const noseToTailA = makeRider({ id: 1, position: { x: 0, y: 0 }, speed: 15 });
    const noseToTailB = makeRider({ id: 2, position: { x: 2.0, y: 0 }, speed: 15 });
    const noseResult = resolveCollisions([noseToTailA, noseToTailB], cfg, 5, track);
    expect(noseResult.find((r) => r.id === 1)!.speed).toBe(0);
    expect(noseResult.find((r) => r.id === 2)!.speed).toBe(0);
  });

  it('nie przedłuża w nieskończoność kary dwóm już odpornym, wciąż zachodzącym na siebie', () => {
    const cfg = { ...defaultRaceConfig, collisionMode: 'solid' as const, riderWidth: 1 };
    const a = makeRider({ id: 1, position: { x: 0, y: 0 }, speed: 0, crashedUntil: 10, collisionImmuneUntil: 10 });
    const b = makeRider({ id: 2, position: { x: 0, y: 0.4 }, speed: 0, crashedUntil: 10, collisionImmuneUntil: 10 });
    const result = resolveCollisions([a, b], cfg, 5, track);
    expect(result.find((r) => r.id === 1)!.crashedUntil).toBe(10);
    expect(result.find((r) => r.id === 2)!.crashedUntil).toBe(10);
  });
});
