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
  /** Maksymalny kąt poślizgu (rad) między nadwoziem a torem jazdy przy zerowym grip. */
  maxSlipAngle: number;
  crashPenaltySeconds: number;
  /** Dodatkowe okno nietykalności na kolizje po wybudzeniu z kary — patrz rules.ts. */
  collisionImmunitySeconds: number;
  collisionMode: 'ghost' | 'solid';
  /** Pełna długość motocykla z zawodnikiem (nos-ogon), wzdłuż heading. */
  riderLength: number;
  /** Pełna szerokość motocykla z zawodnikiem, w poprzek heading. */
  riderWidth: number;
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
  /** Orientacja nadwozia motocykla — do rysowania i hitboxa. Może odbiegać od
   * kierunku faktycznej jazdy (poślizg), patrz `velocityAngle`. */
  readonly heading: number;
  /** Faktyczny kierunek jazdy (napędza pozycję) — to on jest "przyczepnością ograniczony". */
  readonly velocityAngle: number;
  readonly speed: number;
  readonly s: number;
  readonly offset: number;
  readonly lap: number;
  readonly sectorIndex: number;
  readonly crashedUntil: number;
  /** Do kiedy zawodnik jest odporny na NOWĄ kolizję (ale nie na upadek za bandę) — patrz rules.ts. */
  readonly collisionImmuneUntil: number;
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
