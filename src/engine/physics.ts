import type { RaceConfig, RiderState, Steer } from './types.ts';
import { add, fromAngle, normalizeAngle, scale } from './geometry.ts';
import { gripAt } from './config.ts';

/**
 * Krok fizyki jednego zawodnika: sterowanie to wyłącznie kierunek (`steer`),
 * gaz jest automatyczny. Nie zna toru ani innych zawodników — tym zajmuje się rules.ts.
 *
 * Motocykl żużlowy **nie ma hamulca** — nie ma tu żadnego "celu prędkości", do którego
 * zjeżdżamy przy skręcie. Silnik zawsze ciągnie w stronę `maxSpeed`; jedyne spowolnienie
 * w zakręcie to opór od poślizgu (tarcie zużyte na boczne przytrzymanie toru zamiast na
 * napęd do przodu), proporcjonalny do bieżącej prędkości i do tego, jak bardzo motocykl
 * się aktualnie ślizga (kąt poślizgu). Efekt: bardzo rozpędzony motocykl traci prędkość
 * stopniowo, nie skokiem — ma więcej pędu do rozproszenia, więc zjeżdża z prędkości
 * wolniej niż motocykl, który wjechał w zakręt już wolniej. To naturalna konsekwencja
 * fizyki, nie osobno ustawiany parametr.
 *
 * Nadwodzie (`heading`) jest odchylone od faktycznego toru jazdy (`velocityAngle`,
 * napędza pozycję) o ten sam kąt poślizgu — to widoczny na zewnątrz "broadside".
 */
export function stepRider(rider: RiderState, steer: Steer, cfg: RaceConfig, dt: number): RiderState {
  const grip = gripAt(rider.speed, cfg);
  const angularVelocity = steer * cfg.turnRate * grip;
  const velocityAngle = normalizeAngle(rider.velocityAngle + angularVelocity * dt);

  const slipAngle = steer * cfg.maxSlipAngle * (1 - grip);
  const heading = normalizeAngle(velocityAngle + slipAngle);

  const accelerated = Math.min(cfg.maxSpeed, rider.speed + cfg.accel * dt);
  const dragRate = cfg.corneringDrag * Math.abs(slipAngle);
  const speed = Math.max(0, accelerated * (1 - dragRate * dt));

  const position = add(rider.position, scale(fromAngle(velocityAngle), speed * dt));

  return { ...rider, heading, velocityAngle, speed, position };
}
