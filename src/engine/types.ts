export interface Vec2 {
  readonly x: number;
  readonly y: number;
}

/** Skręt: -1 = lewo, 0 = prosto, 1 = prawo. */
export type Steer = -1 | 0 | 1;

export interface RaceConfig {
  laps: number;
  maxSpeed: number;
  cornerSpeed: number;
  accel: number;
  brake: number;
  turnRate: number;
  minGrip: number;
  gripSpeedFalloff: number;
  crashPenaltySeconds: number;
  collisionMode: 'ghost' | 'solid';
  riderRadius: number;
}

export interface OvalTrackDef {
  name: string;
  straightLength: number;
  turnRadius: number;
  width: number;
  laps: number;
}

export interface RiderState {
  readonly id: number;
  readonly color: string;
  readonly name: string;
  readonly position: Vec2;
  readonly heading: number;
  readonly speed: number;
  readonly s: number;
  readonly offset: number;
  readonly lap: number;
  readonly sectorIndex: number;
  readonly crashedUntil: number;
  readonly finished: boolean;
  readonly finishTime: number | null;
}

export type RaceStatus = 'idle' | 'running' | 'finished';

export interface RaceState {
  readonly status: RaceStatus;
  readonly time: number;
  readonly riders: readonly RiderState[];
}

export interface RaceResult {
  readonly riderId: number;
  readonly place: number;
  readonly points: number;
  readonly finishTime: number | null;
}
