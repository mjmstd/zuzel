import { angleDiff } from '../engine/geometry.ts';
import { pointWithOffset } from '../engine/track.ts';
import type { OvalTrack } from '../engine/track.ts';
import type { RaceConfig, RiderState, Vec2 } from '../engine/types.ts';
import type { Camera } from './camera.ts';
import { worldToScreen } from './camera.ts';

const GRASS_COLOR = '#2f6b3a';
const TRACK_COLOR = '#b9713f';
const TRACK_COLOR_DARK = '#a5622f';
const CURB_COLOR = '#e8e8e8';
const START_LINE_COLOR = '#ffffff';

const BOUNDARY_SAMPLES = 160;

function boundaryPath(ctx: CanvasRenderingContext2D, track: OvalTrack, camera: Camera, offset: number): void {
  ctx.beginPath();
  for (let i = 0; i <= BOUNDARY_SAMPLES; i++) {
    const s = (i / BOUNDARY_SAMPLES) * track.totalLength;
    const { position } = pointWithOffset(track, s, offset);
    const p = worldToScreen(camera, position);
    if (i === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  }
  ctx.closePath();
}

export function drawTrack(ctx: CanvasRenderingContext2D, track: OvalTrack, camera: Camera, width: number, height: number): void {
  ctx.fillStyle = GRASS_COLOR;
  ctx.fillRect(0, 0, width, height);

  const halfWidth = track.def.width / 2;

  // Nawierzchnia toru: obszar między bandą zewnętrzną a wewnętrzną.
  const grad = ctx.createRadialGradient(camera.offsetX, camera.offsetY, 0, camera.offsetX, camera.offsetY, Math.max(width, height));
  grad.addColorStop(0, TRACK_COLOR);
  grad.addColorStop(1, TRACK_COLOR_DARK);

  boundaryPath(ctx, track, camera, halfWidth);
  ctx.fillStyle = grad;
  ctx.fill();

  boundaryPath(ctx, track, camera, -halfWidth);
  ctx.fillStyle = GRASS_COLOR;
  ctx.fill();

  ctx.lineWidth = Math.max(2, camera.scale * 0.15);
  ctx.strokeStyle = CURB_COLOR;
  boundaryPath(ctx, track, camera, halfWidth);
  ctx.stroke();
  boundaryPath(ctx, track, camera, -halfWidth);
  ctx.stroke();

  // Linia startu/mety.
  const outer = worldToScreen(camera, pointWithOffset(track, 0, halfWidth).position);
  const inner = worldToScreen(camera, pointWithOffset(track, 0, -halfWidth).position);
  ctx.beginPath();
  ctx.moveTo(outer.x, outer.y);
  ctx.lineTo(inner.x, inner.y);
  ctx.strokeStyle = START_LINE_COLOR;
  ctx.lineWidth = Math.max(2, camera.scale * 0.3);
  ctx.setLineDash([camera.scale * 0.4, camera.scale * 0.25]);
  ctx.stroke();
  ctx.setLineDash([]);
}

const TRAIL_LENGTH = 16;

/** Zanikający ślad za zawodnikiem, budowany z ostatnich N pozycji. */
export function drawTrail(ctx: CanvasRenderingContext2D, trail: readonly Vec2[], color: string, camera: Camera): void {
  if (trail.length < 2) return;
  for (let i = 1; i < trail.length; i++) {
    const alpha = (i / trail.length) * 0.35;
    const a = worldToScreen(camera, trail[i - 1]!);
    const b = worldToScreen(camera, trail[i]!);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.strokeStyle = color;
    ctx.globalAlpha = alpha;
    ctx.lineWidth = Math.max(1, camera.scale * 0.5 * (i / trail.length));
    ctx.lineCap = 'round';
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

const WHEEL_COLOR = '#161616';
const RIDER_SUIT_COLOR = '#20242c';

/**
 * Motocykl żużlowy z zawodnikiem, z lotu ptaka: dwie opony, wydłużona rama w kolorze
 * zawodnika (zorientowana wzdłuż `heading`, czyli nadwozia — nie faktycznego toru
 * jazdy), i sylwetka kierowcy przesunięta w bok o bieżący kąt poślizgu
 * (`heading` − `velocityAngle`), żeby było widać charakterystyczne dla żużla
 * "wywieszanie się" z motocykla podczas ślizgu w łuku.
 */
export function drawRider(ctx: CanvasRenderingContext2D, rider: RiderState, cfg: RaceConfig, camera: Camera, time: number): void {
  const p = worldToScreen(camera, rider.position);
  const len = Math.max(8, cfg.riderLength * camera.scale);
  const wid = Math.max(4, cfg.riderWidth * camera.scale);
  const halfLen = len / 2;
  const halfWid = wid / 2;
  const crashed = rider.crashedUntil > time;

  if (crashed) {
    const pulse = 0.5 + 0.5 * Math.sin(time * 12);
    ctx.beginPath();
    ctx.arc(p.x, p.y, Math.max(halfLen, halfWid) * (1.5 + pulse * 0.4), 0, Math.PI * 2);
    ctx.strokeStyle = '#ff4d4d';
    ctx.globalAlpha = 0.5 * pulse;
    ctx.lineWidth = Math.max(1, halfWid * 0.3);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(rider.heading);
  ctx.globalAlpha = crashed ? 0.55 : 1;

  // Opony: tylna (napędowa, ślizgająca się) i przednia.
  ctx.fillStyle = WHEEL_COLOR;
  ctx.beginPath();
  ctx.ellipse(-halfLen * 0.72, 0, halfWid * 0.5, halfWid * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(halfLen * 0.78, 0, halfWid * 0.46, halfWid * 0.28, 0, 0, Math.PI * 2);
  ctx.fill();

  // Rama: wydłużony sześciokąt w kolorze zawodnika.
  ctx.fillStyle = rider.color;
  ctx.beginPath();
  ctx.moveTo(halfLen, 0);
  ctx.lineTo(halfLen * 0.35, -halfWid * 0.48);
  ctx.lineTo(-halfLen * 0.55, -halfWid * 0.4);
  ctx.lineTo(-halfLen, 0);
  ctx.lineTo(-halfLen * 0.55, halfWid * 0.4);
  ctx.lineTo(halfLen * 0.35, halfWid * 0.48);
  ctx.closePath();
  ctx.fill();
  ctx.lineWidth = Math.max(1, wid * 0.08);
  ctx.strokeStyle = '#1a1a1a';
  ctx.stroke();

  // Kierowca — przesunięty bocznie o kąt poślizgu (broadside): im mocniej ślizga
  // się tylne koło w łuku, tym bardziej "wywiesza się" z motocykla do środka.
  const slip = angleDiff(rider.velocityAngle, rider.heading);
  const lean = slip * halfWid * 1.3;
  ctx.fillStyle = RIDER_SUIT_COLOR;
  ctx.beginPath();
  ctx.ellipse(halfLen * 0.02, lean, halfWid * 0.34, halfWid * 0.46, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = rider.color;
  ctx.beginPath();
  ctx.arc(halfLen * 0.34, lean, halfWid * 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = Math.max(1, wid * 0.06);
  ctx.strokeStyle = '#1a1a1a';
  ctx.stroke();

  ctx.restore();
}

export function drawRace(
  ctx: CanvasRenderingContext2D,
  track: OvalTrack,
  cfg: RaceConfig,
  riders: readonly RiderState[],
  camera: Camera,
  width: number,
  height: number,
  time: number,
  trails?: ReadonlyMap<number, readonly Vec2[]>,
): void {
  drawTrack(ctx, track, camera, width, height);
  if (trails) {
    for (const rider of riders) {
      const trail = trails.get(rider.id);
      if (trail) drawTrail(ctx, trail, rider.color, camera);
    }
  }
  for (const rider of riders) {
    drawRider(ctx, rider, cfg, camera, time);
  }
}

export { TRAIL_LENGTH };
