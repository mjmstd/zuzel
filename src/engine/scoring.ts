import type { RaceResult, RiderState } from './types.ts';

const RACE_POINTS = [3, 2, 1, 0] as const;

/** Kolejność w wyścigu: najpierw zawodnicy, którzy dojechali (wg czasu mety),
 * potem pozostali wg okrążenia i postępu na torze. */
export function classify(riders: readonly RiderState[]): RiderState[] {
  return riders.slice().sort((a, b) => {
    if (a.finished !== b.finished) return a.finished ? -1 : 1;
    if (a.finished && b.finished) return (a.finishTime ?? 0) - (b.finishTime ?? 0);
    if (a.lap !== b.lap) return b.lap - a.lap;
    return b.s - a.s;
  });
}

export function scoreRace(riders: readonly RiderState[]): RaceResult[] {
  return classify(riders).map((r, i) => ({
    riderId: r.id,
    place: i + 1,
    points: RACE_POINTS[i] ?? 0,
    finishTime: r.finishTime,
  }));
}
