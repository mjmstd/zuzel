import type { OvalTrack } from './track.ts';
import { startPoint } from './track.ts';
import type { RaceConfig, RaceState, RiderState, Steer } from './types.ts';
import { stepRider } from './physics.ts';
import {
  applyCrash,
  isCrashed,
  isOffTrack,
  recoverOntoTrack,
  resolveCollisions,
  updateLap,
  withTrackProjection,
} from './rules.ts';

export interface RiderSpec {
  readonly id: number;
  readonly color: string;
  readonly name: string;
}

export function createInitialState(track: OvalTrack, cfg: RaceConfig, specs: readonly RiderSpec[]): RaceState {
  const startS = track.def.straightLength * 0.15;
  const riders: RiderState[] = specs.map((spec, i) => {
    const { position, heading } = startPoint(track, cfg, startS, i, specs.length);
    return {
      id: spec.id,
      color: spec.color,
      name: spec.name,
      position,
      heading,
      speed: 0,
      s: startS,
      offset: 0,
      lap: 0,
      sectorIndex: 0,
      crashedUntil: 0,
      finished: false,
      finishTime: null,
    };
  });
  return { status: 'idle', time: 0, riders };
}

export type SteerInputs = Readonly<Record<number, Steer>>;

/** Jeden krok symulacji o stałym `dt`. Czysta funkcja: nie mutuje `state`. */
export function tick(state: RaceState, track: OvalTrack, cfg: RaceConfig, inputs: SteerInputs, dt: number): RaceState {
  if (state.status === 'finished') return state;

  const time = state.time + dt;
  let riders = state.riders.map((rider) => {
    if (rider.finished) return rider;

    if (isCrashed(rider, time)) {
      return { ...rider, speed: 0 };
    }

    const steer = inputs[rider.id] ?? 0;
    let next = stepRider(rider, steer, cfg, dt);
    next = withTrackProjection(next, track);

    if (isOffTrack(next, track)) {
      return applyCrash(recoverOntoTrack(next, track), time, cfg);
    }

    next = updateLap(next, track);
    if (next.lap >= cfg.laps && !next.finished) {
      next = { ...next, finished: true, finishTime: time };
    }
    return next;
  });

  riders = resolveCollisions(riders, cfg, time);

  const allFinished = riders.every((r) => r.finished);
  const status = allFinished ? 'finished' : 'running';

  return { status, time, riders };
}
