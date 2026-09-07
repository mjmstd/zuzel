import type { RaceConfig, RiderState, Steer } from './types.ts';
import { add, approach, fromAngle, normalizeAngle, scale } from './geometry.ts';
import { gripAt } from './config.ts';

/**
 * Krok fizyki jednego zawodnika: sterowanie to wyłącznie kierunek (`steer`),
 * gaz jest automatyczny. Nie zna toru ani innych zawodników — tym zajmuje się rules.ts.
 *
 * Motocykl żużlowy jeździ bez hamulców i pokonuje łuki bokiem (broadside) — tylne koło
 * ślizga się, więc nadwodzie (`heading`) jest odchylone od faktycznego toru jazdy
 * (`velocityAngle`) o rosnący z prędkością kąt poślizgu. Fizycznie ważny jest wyłącznie
 * `velocityAngle` (napędza pozycję, dokładnie tak samo jak dawniej robił to `heading`,
 * więc balans jazdy — ile trzeba zwolnić przed łukiem — się nie zmienia). `heading` jest
 * pochodną używaną tylko do rysowania motocykla i orientacji jego hitboxa.
 */
export function stepRider(rider: RiderState, steer: Steer, cfg: RaceConfig, dt: number): RiderState {
  const grip = gripAt(rider.speed, cfg);
  const angularVelocity = steer * cfg.turnRate * grip;
  const velocityAngle = normalizeAngle(rider.velocityAngle + angularVelocity * dt);

  const targetSpeed = steer !== 0 ? cfg.cornerSpeed : cfg.maxSpeed;
  const speed = approach(rider.speed, targetSpeed, cfg.accel, cfg.brake, dt);

  const slipAngle = steer * cfg.maxSlipAngle * (1 - grip);
  const heading = normalizeAngle(velocityAngle + slipAngle);

  const position = add(rider.position, scale(fromAngle(velocityAngle), speed * dt));

  return { ...rider, heading, velocityAngle, speed, position };
}
