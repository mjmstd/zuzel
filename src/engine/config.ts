import type { OvalTrackDef, RaceConfig } from './types.ts';

/**
 * Stałe fizyki — wartości startowe, [do wyważenia] po pierwszych testach.
 * Jednostki umowne: 1 jednostka odległości ~ 1 metr, czas w sekundach.
 */
export const defaultRaceConfig: RaceConfig = {
  laps: 4,
  maxSpeed: 34,
  accel: 18,
  turnRate: 2.6,
  minGrip: 0.35,
  gripSpeedFalloff: 0.02,
  maxSlipAngle: 0.9,
  corneringDrag: 4,
  crashPenaltySeconds: 1.5,
  collisionImmunitySeconds: 0.5,
  collisionMode: 'solid',
  riderLength: 2.6,
  riderWidth: 1.0,
};

export const defaultTrack: OvalTrackDef = {
  name: 'Motoarena',
  straightLength: 40,
  turnRadius: 16,
  width: 12,
  laps: 4,
};

/** Przyczepność maleje z prędkością — przy dużej prędkości skręt jest wolniejszy. */
export function gripAt(speed: number, cfg: RaceConfig): number {
  const grip = 1 - speed * cfg.gripSpeedFalloff;
  return Math.max(cfg.minGrip, grip);
}
