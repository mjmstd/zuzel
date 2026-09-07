import { describe, expect, it } from 'vitest';
import { createOvalTrack } from '../src/engine/track.ts';
import { createInitialState, tick } from '../src/engine/race.ts';
import { defaultRaceConfig, defaultTrack } from '../src/engine/config.ts';
import { AI_LEVELS, chooseSteer } from '../src/ai/bot.ts';
import type { AiLevel } from '../src/ai/bot.ts';

const track = createOvalTrack(defaultTrack);
const dt = 1 / 60;
const MAX_SIM_SECONDS = 150;

function runRace(levels: readonly AiLevel[]) {
  const specs = levels.map((_, i) => ({ id: i + 1, color: `c${i}`, name: `bot${i}` }));
  let state = createInitialState(track, defaultRaceConfig, specs);

  for (let i = 0; i < 60 * MAX_SIM_SECONDS && state.status !== 'finished'; i++) {
    const inputs: Record<number, -1 | 0 | 1> = {};
    for (const r of state.riders) {
      const level = levels[r.id - 1]!;
      inputs[r.id] = r.finished ? 0 : chooseSteer(r, state.riders, track, level);
    }
    state = tick(state, track, defaultRaceConfig, inputs, dt);
  }
  return state;
}

/**
 * Reguła sprawdzana tutaj: żadna kombinacja poziomów AI (ani sama ze sobą, ani
 * wymieszana) nie może zawiesić biegu na zawsze. Historycznie zdarzyło się to
 * dwukrotnie — najpierw przez nieskończenie przedłużaną karę za kolizję między
 * już ukaranymi zawodnikami, potem przez zbyt agresywną linię przejazdu "mistrza"
 * powodującą powtarzalne upadki na tej samej krawędzi toru. Ten test to regresja
 * na oba przypadki: każda kombinacja MUSI dojechać w rozsądnym czasie symulacji.
 */
describe('pełny bieg AI dla każdej kombinacji poziomów', () => {
  it.each([
    ['novice', 'novice', 'novice', 'novice'],
    ['pro', 'pro', 'pro', 'pro'],
    ['master', 'master', 'master', 'master'],
    ['novice', 'pro', 'master', 'pro'],
    ['master', 'master', 'master', 'novice'],
    ['novice', 'novice', 'novice', 'master'],
  ] as const)('%s + %s + %s + %s kończy bieg', (...levels) => {
    const state = runRace(levels);
    expect(state.status).toBe('finished');
    for (const r of state.riders) {
      expect(r.lap).toBeGreaterThanOrEqual(defaultRaceConfig.laps);
      expect(r.finishTime).not.toBeNull();
    }
  });

  it('AI_LEVELS zawiera dokładnie trzy zdefiniowane poziomy', () => {
    expect(AI_LEVELS).toEqual(['novice', 'pro', 'master']);
  });
});
