import type { OvalTrack } from './track.ts';
import { nearestOnTrack, pointAt, pointWithOffset, sectorIndex as sectorIndexAt } from './track.ts';
import type { RaceConfig, RiderState, Vec2 } from './types.ts';
import { add, closestPointsSegmentSegment, fromAngle, scale, sub } from './geometry.ts';

/** Margines, żeby zawodnik po upadku nie wylądował dokładnie na granicy bandy. */
const RECOVERY_MARGIN = 0.15;

export function isCrashed(rider: RiderState, time: number): boolean {
  return rider.crashedUntil > time;
}

/** Czy zawodnik jest (jeszcze) odporny na nową karę za kolizję — patrz applyCrash. */
export function isCollisionImmune(rider: RiderState, time: number): boolean {
  return rider.collisionImmuneUntil > time;
}

/** Przelicza pozycję zawodnika na współrzędne toru (`s`, `offset`). */
export function withTrackProjection(rider: RiderState, track: OvalTrack): RiderState {
  const { s, offset } = nearestOnTrack(track, rider.position);
  return { ...rider, s, offset };
}

export function isOffTrack(rider: RiderState, track: OvalTrack): boolean {
  return Math.abs(rider.offset) > track.def.width / 2;
}

/**
 * Cofa zawodnika na tor: przycina boczne odchylenie do legalnego zakresu. Samego
 * kierunku nie dotyka — tym zajmuje się teraz jednolicie `applyCrash` (patrz niżej),
 * wywoływane zaraz po tej funkcji przy każdym upadku za bandę.
 */
export function recoverOntoTrack(rider: RiderState, track: OvalTrack): RiderState {
  const halfWidth = track.def.width / 2 - RECOVERY_MARGIN;
  const clampedOffset = Math.max(-halfWidth, Math.min(halfWidth, rider.offset));
  const { position } = pointWithOffset(track, rider.s, clampedOffset);
  return { ...rider, position, offset: clampedOffset };
}

/**
 * Kara za upadek: zerowanie prędkości na `crashPenaltySeconds`, plus dodatkowe okno
 * nietykalności na NOWĄ kolizję (`collisionImmunitySeconds` ponad to — patrz
 * `resolveCollisions`). Ustawia też nadwozie i tor jazdy z powrotem wzdłuż toru
 * w bieżącym `s` — dotyczy to KAŻDEGO upadku, nie tylko wypadnięcia za bandę.
 * Bez tego zawodnik, który upadł w wyniku kolizji, wstawał z headingiem zamrożonym
 * pod dowolnym kątem sprzed zderzenia (np. w połowie skrętu) i jechał nim prosto,
 * aż prędzej czy później znów wypadał za bandę pod tym samym złym kątem — z zewnątrz
 * wyglądało to jak utknięcie w miejscu na resztę biegu, choć technicznie to był
 * ciąg osobnych upadków.
 */
export function applyCrash(rider: RiderState, time: number, cfg: RaceConfig, track: OvalTrack): RiderState {
  const crashedUntil = time + cfg.crashPenaltySeconds;
  const heading = pointAt(track, rider.s).heading;
  return {
    ...rider,
    heading,
    velocityAngle: heading,
    speed: 0,
    crashedUntil,
    collisionImmuneUntil: crashedUntil + cfg.collisionImmunitySeconds,
  };
}

/** Nalicza okrążenie, gdy zawodnik przejdzie z sektora 3 do sektora 0. */
export function updateLap(rider: RiderState, track: OvalTrack): RiderState {
  const newSector = sectorIndexAt(track, rider.s);
  if (newSector === rider.sectorIndex) return rider;
  const wrapped = rider.sectorIndex === 3 && newSector === 0;
  return { ...rider, sectorIndex: newSector, lap: wrapped ? rider.lap + 1 : rider.lap };
}

/** Odcinek nos-ogon motocykla z zawodnikiem, wzdłuż `heading` — podstawa hitboxa kapsuły. */
function riderSegment(rider: RiderState, cfg: RaceConfig): { nose: Vec2; tail: Vec2 } {
  const half = scale(fromAngle(rider.heading), cfg.riderLength / 2);
  return { nose: add(rider.position, half), tail: sub(rider.position, half) };
}

/**
 * Zawodnicy bliżej siebie niż suma połówek szerokości (mierzone jako odległość między
 * odcinkami nos-ogon, nie środek-środek — motocykl z zawodnikiem to wydłużony kształt,
 * nie kulka: dwaj jadący blisko obok siebie równolegle mieszczą się bezpiecznie, ale
 * najechanie na tył kogoś wymaga więcej zapasu wzdłuż toru) tracą prędkość, jak przy
 * upadku. Nakładających się zawodników od razu rozsuwa się na dokładną minimalną
 * odległość (inaczej, stojąc w miejscu z prędkością 0, nigdy by się nie rozdzielili
 * i zderzenie trwałoby w nieskończoność). Karę czasową (nowy `crashedUntil`) dostają
 * tylko ci, którzy nie są jeszcze odporni po poprzedniej karze.
 */
export function resolveCollisions(
  riders: readonly RiderState[],
  cfg: RaceConfig,
  time: number,
  track: OvalTrack,
): RiderState[] {
  const result = riders.slice();
  if (cfg.collisionMode === 'ghost') return result;

  const minDist = cfg.riderWidth;
  const toCrash = new Set<number>();

  for (let i = 0; i < result.length; i++) {
    for (let j = i + 1; j < result.length; j++) {
      const a = result[i]!;
      const b = result[j]!;
      if (a.finished || b.finished) continue;

      const segA = riderSegment(a, cfg);
      const segB = riderSegment(b, cfg);
      const closest = closestPointsSegmentSegment(segA.nose, segA.tail, segB.nose, segB.tail);
      if (closest.distance >= minDist) continue;

      const delta = sub(closest.pointOnFirst, closest.pointOnSecond);
      const dist = closest.distance;
      const overlap = minDist - dist;
      const dir = dist > 1e-6 ? scale(delta, 1 / dist) : fromAngle((a.id - b.id) * 1.234);
      result[i] = { ...a, position: add(a.position, scale(dir, overlap / 2)) };
      result[j] = { ...b, position: sub(b.position, scale(dir, overlap / 2)) };

      if (!isCollisionImmune(a, time)) toCrash.add(a.id);
      if (!isCollisionImmune(b, time)) toCrash.add(b.id);
    }
  }

  if (toCrash.size === 0) return result;
  return result.map((r) => (toCrash.has(r.id) ? applyCrash(r, time, cfg, track) : r));
}
