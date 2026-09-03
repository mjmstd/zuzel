import { describe, expect, it } from 'vitest';
import { stepRider } from '../src/engine/physics.ts';
import { defaultRaceConfig } from '../src/engine/config.ts';
import type { RiderState } from '../src/engine/types.ts';

function makeRider(overrides: Partial<RiderState> = {}): RiderState {
  return {
    id: 1,
    color: 'red',
    name: 'Test',
    position: { x: 0, y: 0 },
    heading: 0,
    speed: 0,
    s: 0,
    offset: 0,
    lap: 0,
    sectorIndex: 0,
    crashedUntil: 0,
    finished: false,
    finishTime: null,
    ...overrides,
  };
}

describe('stepRider', () => {
  it('jadąc prosto (steer=0) przyspiesza w stronę maxSpeed', () => {
    const rider = makeRider();
    const next = stepRider(rider, 0, defaultRaceConfig, 0.1);
    expect(next.speed).toBeGreaterThan(0);
    expect(next.speed).toBeLessThanOrEqual(defaultRaceConfig.maxSpeed);
    expect(next.heading).toBeCloseTo(0, 10);
  });

  it('prędkość nigdy nie przekracza maxSpeed przy długiej jeździe na wprost', () => {
    let rider = makeRider();
    for (let i = 0; i < 2000; i++) {
      rider = stepRider(rider, 0, defaultRaceConfig, 1 / 60);
    }
    expect(rider.speed).toBeCloseTo(defaultRaceConfig.maxSpeed, 5);
  });

  it('skręt (steer=1) zwiększa heading i celuje w cornerSpeed', () => {
    let rider = makeRider({ speed: defaultRaceConfig.maxSpeed });
    const next = stepRider(rider, 1, defaultRaceConfig, 0.1);
    expect(next.heading).toBeGreaterThan(0);
    expect(next.speed).toBeLessThan(rider.speed);
  });

  it('skręt w lewo (steer=-1) zmniejsza heading', () => {
    const rider = makeRider();
    const next = stepRider(rider, -1, defaultRaceConfig, 0.1);
    expect(next.heading).toBeLessThan(0);
  });

  it('pozycja porusza się zgodnie z heading i prędkością', () => {
    const rider = makeRider({ speed: 10, heading: 0 });
    const next = stepRider(rider, 0, defaultRaceConfig, 0.1);
    expect(next.position.y).toBeCloseTo(0, 6);
    expect(next.position.x).toBeGreaterThan(0);
  });

  it('jest deterministyczna: te same wejścia dają ten sam wynik', () => {
    const rider = makeRider({ speed: 12, heading: 0.3 });
    const a = stepRider(rider, 1, defaultRaceConfig, 0.1);
    const b = stepRider(rider, 1, defaultRaceConfig, 0.1);
    expect(a).toEqual(b);
  });
});
