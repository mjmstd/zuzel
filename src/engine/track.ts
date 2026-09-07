import type { OvalTrackDef, Vec2 } from './types.ts';
import { add, scale, sub, dot, clamp, normalizeAngle } from './geometry.ts';

/**
 * Tor jako owal analityczny: dwie proste + dwa półokręgi, złożone tak, że
 * styczna (heading) jest ciągła na złączeniach segmentów (bez skoków kąta).
 * Parametr `s` narasta monotonicznie w [0, totalLength) w kierunku jazdy.
 */
export interface OvalTrack {
  readonly def: OvalTrackDef;
  readonly totalLength: number;
  readonly rightTurnCenter: Vec2;
  readonly leftTurnCenter: Vec2;
  readonly seg: {
    readonly straight1End: number; // koniec dolnej prostej
    readonly turn1End: number; // koniec prawego łuku
    readonly straight2End: number; // koniec górnej prostej
  };
}

export function createOvalTrack(def: OvalTrackDef): OvalTrack {
  const { straightLength: L, turnRadius: R } = def;
  const halfL = L / 2;
  const turnLength = Math.PI * R;
  const straight1End = L;
  const turn1End = straight1End + turnLength;
  const straight2End = turn1End + L;
  const totalLength = straight2End + turnLength;
  return {
    def,
    totalLength,
    rightTurnCenter: { x: halfL, y: 0 },
    leftTurnCenter: { x: -halfL, y: 0 },
    seg: { straight1End, turn1End, straight2End },
  };
}

export interface TrackPoint {
  readonly position: Vec2;
  readonly heading: number;
}

/** Punkt na osi toru dla danego dystansu `s` (dowolna liczba, brana modulo długość). */
export function pointAt(track: OvalTrack, s: number): TrackPoint {
  const total = track.totalLength;
  let sm = s % total;
  if (sm < 0) sm += total;

  const { straightLength: L, turnRadius: R } = track.def;
  const halfL = L / 2;
  const { straight1End, turn1End, straight2End } = track.seg;

  if (sm < straight1End) {
    return { position: { x: -halfL + sm, y: -R }, heading: 0 };
  }
  if (sm < turn1End) {
    const theta = -Math.PI / 2 + (sm - straight1End) / R;
    return {
      position: add(track.rightTurnCenter, { x: R * Math.cos(theta), y: R * Math.sin(theta) }),
      heading: normalizeAngle(theta + Math.PI / 2),
    };
  }
  if (sm < straight2End) {
    const s2 = sm - turn1End;
    return { position: { x: halfL - s2, y: R }, heading: Math.PI };
  }
  const theta = Math.PI / 2 + (sm - straight2End) / R;
  return {
    position: add(track.leftTurnCenter, { x: R * Math.cos(theta), y: R * Math.sin(theta) }),
    heading: normalizeAngle(theta + Math.PI / 2),
  };
}

/** Kierunek "na zewnątrz" toru (od osi w stronę bandy zewnętrznej) dla danego heading. */
export function outwardNormal(heading: number): Vec2 {
  return { x: Math.sin(heading), y: -Math.cos(heading) };
}

export interface TrackProjection {
  readonly s: number;
  /** Odchylenie boczne od osi toru: dodatnie = na zewnątrz, ujemne = do środka. */
  readonly offset: number;
}

interface Candidate {
  readonly s: number;
  readonly offset: number;
  readonly dist2: number;
}

function straightCandidate(p: Vec2, xFrom: number, xTo: number, y: number, sBase: number, normal: Vec2): Candidate {
  const xClamped = clamp(p.x, Math.min(xFrom, xTo), Math.max(xFrom, xTo));
  const sLocal = Math.abs(xClamped - xFrom);
  const diff = sub(p, { x: xClamped, y });
  return { s: sBase + sLocal, offset: dot(diff, normal), dist2: diff.x * diff.x + diff.y * diff.y };
}

function turnCandidate(
  p: Vec2,
  center: Vec2,
  radius: number,
  thetaMin: number,
  thetaMax: number,
  sBase: number,
): Candidate {
  const d = sub(p, center);
  let thetaRaw = Math.atan2(d.y, d.x);
  if (thetaRaw < thetaMin - Math.PI) thetaRaw += 2 * Math.PI;
  const thetaClamped = clamp(thetaRaw, thetaMin, thetaMax);
  const pointOnArc = add(center, { x: radius * Math.cos(thetaClamped), y: radius * Math.sin(thetaClamped) });
  const diff = sub(p, pointOnArc);
  const heading = normalizeAngle(thetaClamped + Math.PI / 2);
  const normal = outwardNormal(heading);
  return {
    s: sBase + (thetaClamped - thetaMin) * radius,
    offset: dot(diff, normal),
    dist2: diff.x * diff.x + diff.y * diff.y,
  };
}

/** Rzutuje dowolny punkt świata na oś toru: najbliższe `s` i boczne odchylenie. */
export function nearestOnTrack(track: OvalTrack, p: Vec2): TrackProjection {
  const { straightLength: L, turnRadius: R } = track.def;
  const halfL = L / 2;
  const { straight1End, turn1End, straight2End } = track.seg;

  const candidates: Candidate[] = [
    straightCandidate(p, -halfL, halfL, -R, 0, { x: 0, y: -1 }),
    turnCandidate(p, track.rightTurnCenter, R, -Math.PI / 2, Math.PI / 2, straight1End),
    straightCandidate(p, halfL, -halfL, R, turn1End, { x: 0, y: 1 }),
    turnCandidate(p, track.leftTurnCenter, R, Math.PI / 2, (3 * Math.PI) / 2, straight2End),
  ];

  let best = candidates[0]!;
  for (let i = 1; i < candidates.length; i++) {
    const c = candidates[i]!;
    if (c.dist2 < best.dist2) best = c;
  }
  return { s: best.s, offset: best.offset };
}

export function sectorIndex(track: OvalTrack, s: number): number {
  const quarter = track.totalLength / 4;
  let sm = s % track.totalLength;
  if (sm < 0) sm += track.totalLength;
  return clamp(Math.floor(sm / quarter), 0, 3);
}

/** Punkt na torze przesunięty bocznie o `offset` od osi (dodatnie = na zewnątrz). */
export function pointWithOffset(track: OvalTrack, s: number, offset: number): TrackPoint {
  const base = pointAt(track, s);
  const normal = outwardNormal(base.heading);
  return { position: add(base.position, scale(normal, offset)), heading: base.heading };
}

/** Pozycja startowa w torze `laneIndex` (0-based) z `laneCount` dostępnych, przy dystansie `s`. */
export function startPoint(track: OvalTrack, cfg: { riderWidth: number }, s: number, laneIndex: number, laneCount: number): TrackPoint {
  const usableWidth = track.def.width - cfg.riderWidth;
  const spacing = laneCount > 1 ? usableWidth / (laneCount - 1) : 0;
  const offset = laneCount > 1 ? -usableWidth / 2 + spacing * laneIndex : 0;
  return pointWithOffset(track, s, offset);
}

export function trackWidth(track: OvalTrack): number {
  return track.def.width;
}
