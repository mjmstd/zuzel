import { add, angleDiff, length, scale, sub } from '../engine/geometry.ts';
import type { OvalTrack } from '../engine/track.ts';
import { pointWithOffset } from '../engine/track.ts';
import type { RiderState, Steer } from '../engine/types.ts';

export type AiLevel = 'novice' | 'pro' | 'master';

export const AI_LEVELS: readonly AiLevel[] = ['novice', 'pro', 'master'];

export const AI_LEVEL_LABELS: Record<AiLevel, string> = {
  novice: 'Nowicjusz',
  pro: 'Zawodowiec',
  master: 'Mistrz',
};

const DEAD_ZONE = 0.05;

/**
 * Promień i siła lokalnego odpychania od innych zawodników. Nawet nowicjusz
 * dostaje odrobinę tego refleksu — bez niego kilku nowicjuszy razem na starcie
 * zjeżdża się w jeden punkt i już nigdy się nie rozjedzie (żaden z nich nie
 * reaguje na resztę, więc po każdym upadku wraca dokładnie w to samo miejsce).
 * Nowicjusz reaguje dopiero z bliska i słabo — reszta różnicy poziomu bierze się
 * z krótszego zasięgu przewidywania toru, nie z całkowitego braku instynktu.
 */
const AVOID_PARAMS: Record<AiLevel, { radius: number; weight: number }> = {
  novice: { radius: 2.5, weight: 5 },
  pro: { radius: 4, weight: 6 },
  master: { radius: 4.5, weight: 7 },
};

/** Boczne odchylenie celu od osi toru: ujemne = do środka (krótsza droga na łuku). */
const RACING_LINE_BIAS: Record<AiLevel, number> = {
  novice: 0,
  pro: 0,
  master: -0.08,
};

/**
 * Sterowanie proporcjonalne (pure pursuit): celuje w punkt na torze o kawałek
 * przed sobą i skręca w jego stronę — hamowanie przed łukiem wychodzi samo
 * z ograniczonego przyczepnością skrętu, bez osobnej logiki. Poziomy różnią się
 * trzema rzeczami:
 *  - zasięgiem przewidywania (dłuższy = wcześniejsze, płynniejsze reakcje),
 *  - jak mocno i z jakiej odległości unikają innych zawodników,
 *  - linią przejazdu: mistrz celuje bliżej wewnętrznej krawędzi (krótszy łuk),
 *    reszta trzyma się osi toru.
 */
export function chooseSteer(
  rider: RiderState,
  allRiders: readonly RiderState[],
  track: OvalTrack,
  level: AiLevel = 'pro',
): Steer {
  // Ta sama baza co "pro" przy niskiej prędkości (start bez gwałtownego zjeżdżania
  // się do środka), ale rośnie ze wzrostem prędkości znacznie wolniej — nowicjusz
  // "widzi" toru mniej naprzód przy dużej prędkości, więc hamuje przed łukiem
  // później i częściej wypada. To realniejsza różnica niż krótki zasięg od zawsze,
  // który przy starcie obok innych powoduje po prostu karambol na starcie.
  const lookahead =
    level === 'novice' ? 10 + rider.speed * 0.15 : level === 'pro' ? 10 + rider.speed * 0.4 : 8 + rider.speed * 0.5;

  const biasOffset = RACING_LINE_BIAS[level] * track.def.width;
  const target = pointWithOffset(track, rider.s + lookahead, biasOffset);
  const pursue = sub(target.position, rider.position);

  const { radius, weight } = AVOID_PARAMS[level];
  let avoid = { x: 0, y: 0 };
  for (const other of allRiders) {
    if (other.id === rider.id || other.finished) continue;
    const away = sub(rider.position, other.position);
    const d = length(away);
    if (d > 1e-6 && d < radius) {
      avoid = add(avoid, scale(away, (radius - d) / d));
    }
  }
  const desired = add(pursue, scale(avoid, weight));

  const targetAngle = Math.atan2(desired.y, desired.x);
  // Do sterowania liczy się faktyczny tor jazdy (velocityAngle), nie odchylone
  // poślizgiem nadwozie (heading) — inaczej bot "widziałby" siebie skierowanego
  // gdzie indziej niż faktycznie jedzie i myliłby się w zakrętach.
  const diff = angleDiff(rider.velocityAngle, targetAngle);

  if (diff > DEAD_ZONE) return 1;
  if (diff < -DEAD_ZONE) return -1;
  return 0;
}
