import type { RaceConfig, RiderState, Steer } from './types.ts';
import { add, approach, fromAngle, scale } from './geometry.ts';
import { gripAt } from './config.ts';

/**
 * Krok fizyki jednego zawodnika: sterowanie to wyłącznie kierunek (`steer`),
 * gaz jest automatyczny. Nie zna toru ani innych zawodników — tym zajmuje się rules.ts.
 */
export function stepRider(rider: RiderState, steer: Steer, cfg: RaceConfig, dt: number): RiderState {
  const grip = gripAt(rider.speed, cfg);
  const angularVelocity = steer * cfg.turnRate * grip;
  const heading = rider.heading + angularVelocity * dt;

  const targetSpeed = steer !== 0 ? cfg.cornerSpeed : cfg.maxSpeed;
  const speed = approach(rider.speed, targetSpeed, cfg.accel, cfg.brake, dt);

  const position = add(rider.position, scale(fromAngle(heading), speed * dt));

  return { ...rider, heading, speed, position };
}
