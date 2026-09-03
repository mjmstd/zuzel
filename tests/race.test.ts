import { describe, expect, it } from 'vitest';
import { createOvalTrack } from '../src/engine/track.ts';
import { createInitialState, tick } from '../src/engine/race.ts';
import { defaultRaceConfig, defaultTrack } from '../src/engine/config.ts';
import { classify, scoreRace } from '../src/engine/scoring.ts';
import { chooseSteer } from '../src/ai/bot.ts';

const track = createOvalTrack(defaultTrack);
const specs = [
  { id: 1, color: 'red', name: 'A' },
  { id: 2, color: 'blue', name: 'B' },
  { id: 3, color: 'white', name: 'C' },
  { id: 4, color: 'yellow', name: 'D' },
];

describe('createInitialState', () => {
  it('startuje 4 zawodników na torze, status idle', () => {
    const state = createInitialState(track, defaultRaceConfig, specs);
    expect(state.status).toBe('idle');
    expect(state.riders).toHaveLength(4);
    for (const r of state.riders) {
      expect(r.lap).toBe(0);
      expect(r.speed).toBe(0);
    }
  });
});

describe('tick', () => {
  it('AI (pro) przejeżdża pełny bieg bez trwałego zawieszenia', () => {
    let state = createInitialState(track, defaultRaceConfig, specs);
    const dt = 1 / 60;
    const maxTicks = 60 * 120; // 120 s bezpiecznika

    for (let i = 0; i < maxTicks && state.status !== 'finished'; i++) {
      const inputs: Record<number, -1 | 0 | 1> = {};
      for (const r of state.riders) {
        inputs[r.id] = r.finished ? 0 : chooseSteer(r, state.riders, track, 'pro');
      }
      state = tick(state, track, defaultRaceConfig, inputs, dt);
    }

    expect(state.status).toBe('finished');
    for (const r of state.riders) {
      expect(r.lap).toBeGreaterThanOrEqual(defaultRaceConfig.laps);
      expect(r.finishTime).not.toBeNull();
    }
  });

  it('jest deterministyczna dla tych samych wejść', () => {
    const state0 = createInitialState(track, defaultRaceConfig, specs);
    const inputs = { 1: 1 as const, 2: 0 as const, 3: -1 as const, 4: 0 as const };
    let a = state0;
    let b = state0;
    for (let i = 0; i < 300; i++) {
      a = tick(a, track, defaultRaceConfig, inputs, 1 / 60);
      b = tick(b, track, defaultRaceConfig, inputs, 1 / 60);
    }
    expect(a).toEqual(b);
  });
});

describe('scoring', () => {
  it('przydziela punkty 3/2/1/0 wg kolejności', () => {
    const state = createInitialState(track, defaultRaceConfig, specs);
    const finished = state.riders.map((r, i) => ({ ...r, finished: true, finishTime: i, lap: defaultRaceConfig.laps }));
    const results = scoreRace(finished);
    expect(results.map((r) => r.points)).toEqual([3, 2, 1, 0]);
    expect(results.map((r) => r.riderId)).toEqual([1, 2, 3, 4]);
  });

  it('classify stawia niedojechanych za dojechanymi, wg okrążenia i postępu', () => {
    const state = createInitialState(track, defaultRaceConfig, specs);
    const riders = [
      { ...state.riders[0]!, finished: true, finishTime: 5 },
      { ...state.riders[1]!, finished: false, lap: 2, s: 10 },
      { ...state.riders[2]!, finished: false, lap: 2, s: 50 },
      { ...state.riders[3]!, finished: false, lap: 1, s: 999 },
    ];
    const ranked = classify(riders);
    expect(ranked.map((r) => r.id)).toEqual([1, 3, 2, 4]);
  });
});
