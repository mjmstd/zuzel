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

  it('skręt (steer=1) zwiększa heading i spowalnia przez opór poślizgu', () => {
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
    const rider = makeRider({ speed: 12, heading: 0.3, velocityAngle: 0.3 });
    const a = stepRider(rider, 1, defaultRaceConfig, 0.1);
    const b = stepRider(rider, 1, defaultRaceConfig, 0.1);
    expect(a).toEqual(b);
  });
});

describe('poślizg (heading vs velocityAngle)', () => {
  it('jadąc prosto (steer=0) nie ma poślizgu — heading i velocityAngle są równe', () => {
    const rider = makeRider({ speed: 25, heading: 0.4, velocityAngle: 0.4 });
    const next = stepRider(rider, 0, defaultRaceConfig, 0.1);
    expect(next.heading).toBeCloseTo(next.velocityAngle, 10);
  });

  it('pozycja zawsze podąża za velocityAngle, nie za heading', () => {
    // Duży, sztuczny rozjazd heading/velocityAngle na starcie kroku — pozycja MUSI
    // pójść w stronę velocityAngle (to on jest "fizyczny"), nie w stronę heading.
    const rider = makeRider({ speed: 20, heading: 1.2, velocityAngle: 0 });
    const next = stepRider(rider, 0, defaultRaceConfig, 0.05);
    expect(next.position.y).toBeCloseTo(0, 6);
    expect(next.position.x).toBeGreaterThan(0);
  });

  it('w zakręcie przy dużej prędkości heading wyprzedza velocityAngle (motocykl jedzie bokiem)', () => {
    const rider = makeRider({ speed: defaultRaceConfig.maxSpeed, heading: 0, velocityAngle: 0 });
    const next = stepRider(rider, 1, defaultRaceConfig, 1 / 60);
    const slip = next.heading - next.velocityAngle;
    expect(slip).toBeGreaterThan(0);
    expect(slip).toBeLessThanOrEqual(defaultRaceConfig.maxSlipAngle + 1e-9);
  });

  it('przy zerowej prędkości (pełny grip) poślizg jest zerowy', () => {
    const rider = makeRider({ speed: 0, heading: 0, velocityAngle: 0 });
    const next = stepRider(rider, 1, defaultRaceConfig, 1 / 60);
    expect(next.heading).toBeCloseTo(next.velocityAngle, 10);
  });
});

describe('brak hamulca — spowolnienie w zakręcie to opór poślizgu, nie skok do celu', () => {
  it('przy stałym skręcie prędkość spada płynnie klatka po klatce, bez skoku', () => {
    let rider = makeRider({ speed: defaultRaceConfig.maxSpeed, heading: 0, velocityAngle: 0 });
    let prevSpeed = rider.speed;
    for (let i = 0; i < 30; i++) {
      rider = stepRider(rider, 1, defaultRaceConfig, 1 / 60);
      // Żaden pojedynczy krok fizyki nie ścina prędkości gwałtownie — to nie hamulec.
      expect(prevSpeed - rider.speed).toBeLessThan(defaultRaceConfig.maxSpeed * 0.1);
      prevSpeed = rider.speed;
    }
    // Ale po chwili trwałego skrętu prędkość faktycznie zauważalnie spadła.
    expect(rider.speed).toBeLessThan(defaultRaceConfig.maxSpeed * 0.85);
  });

  it('bardzo rozpędzony motocykl traci prędkość w zakręcie, wolny może nawet przyspieszać', () => {
    // To jest sedno: ubytek prędkości zależy od bieżącego pędu, nie od jednego stałego
    // celu ("corner speed") — więc przy tym samym skręcie szybki motocykl zwalnia,
    // a wolny (poniżej naturalnego punktu równowagi silnik/poślizg) wciąż przyspiesza.
    const fast = makeRider({ speed: 30, heading: 0, velocityAngle: 0 });
    const slow = makeRider({ speed: 10, heading: 0, velocityAngle: 0 });
    const nextFast = stepRider(fast, 1, defaultRaceConfig, 1 / 60);
    const nextSlow = stepRider(slow, 1, defaultRaceConfig, 1 / 60);
    expect(nextFast.speed).toBeLessThan(fast.speed);
    expect(nextSlow.speed).toBeGreaterThan(slow.speed);
  });
});
