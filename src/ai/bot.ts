import { add, angleDiff, length, scale, sub } from '../engine/geometry.ts';
import type { OvalTrack } from '../engine/track.ts';
import { pointAt } from '../engine/track.ts';
import type { RiderState, Steer } from '../engine/types.ts';

export type AiLevel = 'novice' | 'pro' | 'master';

const DEAD_ZONE = 0.05;
const AVOID_RADIUS = 4;
const AVOID_WEIGHT = 6;

/**
 * Sterowanie proporcjonalne (pure pursuit): celuje w punkt na osi toru o kawałek
 * przed sobą i skręca w jego stronę — hamowanie przed łukiem wychodzi samo
 * z ograniczonego przyczepnością skrętu, bez osobnej logiki. Od poziomu "pro" w górę
 * dochodzi lokalne odpychanie od pobliskich rywali, żeby boty nie zjeżdżały się
 * w jeden punkt na prostej i nie blokowały się nawzajem w nieskończoność.
 */
export function chooseSteer(
  rider: RiderState,
  allRiders: readonly RiderState[],
  track: OvalTrack,
  level: AiLevel = 'pro',
): Steer {
  const lookahead =
    level === 'novice' ? 6 : level === 'pro' ? 10 + rider.speed * 0.4 : 8 + rider.speed * 0.5;

  const target = pointAt(track, rider.s + lookahead);
  const pursue = sub(target.position, rider.position);

  let desired = pursue;
  if (level !== 'novice') {
    let avoid = { x: 0, y: 0 };
    for (const other of allRiders) {
      if (other.id === rider.id || other.finished) continue;
      const away = sub(rider.position, other.position);
      const d = length(away);
      if (d > 1e-6 && d < AVOID_RADIUS) {
        avoid = add(avoid, scale(away, (AVOID_RADIUS - d) / d));
      }
    }
    desired = add(pursue, scale(avoid, AVOID_WEIGHT));
  }

  const targetAngle = Math.atan2(desired.y, desired.x);
  const diff = angleDiff(rider.heading, targetAngle);

  if (diff > DEAD_ZONE) return 1;
  if (diff < -DEAD_ZONE) return -1;
  return 0;
}
