import type { OvalTrack } from './track.ts';
import { nearestOnTrack, pointWithOffset, sectorIndex as sectorIndexAt } from './track.ts';
import type { RaceConfig, RiderState } from './types.ts';
import { add, fromAngle, length, scale, sub } from './geometry.ts';

/** Margines, żeby zawodnik po upadku nie wylądował dokładnie na granicy bandy. */
const RECOVERY_MARGIN = 0.15;

export function isCrashed(rider: RiderState, time: number): boolean {
  return rider.crashedUntil > time;
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
 * Cofa zawodnika na tor: przycina boczne odchylenie do legalnego zakresu i ustawia
 * go z powrotem w kierunku jazdy toru w tym miejscu. Bez korekty kierunku zawodnik
 * wybudzony z kary miałby wciąż heading skierowany w bandę i natychmiast wypadałby
 * ponownie w dokładnie ten sam sposób — deterministyczna pętla bez wyjścia.
 */
export function recoverOntoTrack(rider: RiderState, track: OvalTrack): RiderState {
  const halfWidth = track.def.width / 2 - RECOVERY_MARGIN;
  const clampedOffset = Math.max(-halfWidth, Math.min(halfWidth, rider.offset));
  const { position, heading } = pointWithOffset(track, rider.s, clampedOffset);
  return { ...rider, position, offset: clampedOffset, heading };
}

export function applyCrash(rider: RiderState, time: number, cfg: RaceConfig): RiderState {
  return { ...rider, speed: 0, crashedUntil: time + cfg.crashPenaltySeconds };
}

/** Nalicza okrążenie, gdy zawodnik przejdzie z sektora 3 do sektora 0. */
export function updateLap(rider: RiderState, track: OvalTrack): RiderState {
  const newSector = sectorIndexAt(track, rider.s);
  if (newSector === rider.sectorIndex) return rider;
  const wrapped = rider.sectorIndex === 3 && newSector === 0;
  return { ...rider, sectorIndex: newSector, lap: wrapped ? rider.lap + 1 : rider.lap };
}

/**
 * Zawodnicy bliżej siebie niż 2x promień tracą prędkość, jak przy upadku.
 * Nakładających się zawodników od razu rozsuwa się na dokładną minimalną odległość
 * (inaczej, stojąc w miejscu z prędkością 0, nigdy by się nie rozdzielili i zderzenie
 * trwałoby w nieskończoność). Karę czasową (nowy `crashedUntil`) dostają tylko ci,
 * którzy jeszcze jej nie odbywają — już ukaranemu para się nie przedłuża.
 */
export function resolveCollisions(riders: readonly RiderState[], cfg: RaceConfig, time: number): RiderState[] {
  const result = riders.slice();
  if (cfg.collisionMode === 'ghost') return result;

  const minDist = cfg.riderRadius * 2;
  const toCrash = new Set<number>();

  for (let i = 0; i < result.length; i++) {
    for (let j = i + 1; j < result.length; j++) {
      const a = result[i]!;
      const b = result[j]!;
      if (a.finished || b.finished) continue;

      const delta = sub(a.position, b.position);
      const dist = length(delta);
      if (dist >= minDist) continue;

      const overlap = minDist - dist;
      const dir = dist > 1e-6 ? scale(delta, 1 / dist) : fromAngle((a.id - b.id) * 1.234);
      result[i] = { ...a, position: add(a.position, scale(dir, overlap / 2)) };
      result[j] = { ...b, position: sub(b.position, scale(dir, overlap / 2)) };

      if (!isCrashed(a, time)) toCrash.add(a.id);
      if (!isCrashed(b, time)) toCrash.add(b.id);
    }
  }

  if (toCrash.size === 0) return result;
  return result.map((r) => (toCrash.has(r.id) ? applyCrash(r, time, cfg) : r));
}
