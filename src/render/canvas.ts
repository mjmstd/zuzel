import { pointWithOffset } from '../engine/track.ts';
import type { OvalTrack } from '../engine/track.ts';
import type { RaceConfig, RiderState } from '../engine/types.ts';
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

export function drawRider(ctx: CanvasRenderingContext2D, rider: RiderState, cfg: RaceConfig, camera: Camera): void {
  const p = worldToScreen(camera, rider.position);
  const r = Math.max(3, cfg.riderRadius * camera.scale);
  const crashed = rider.crashedUntil > 0 && rider.speed === 0;

  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(rider.heading);

  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fillStyle = rider.color;
  ctx.globalAlpha = crashed ? 0.5 : 1;
  ctx.fill();
  ctx.lineWidth = Math.max(1, r * 0.2);
  ctx.strokeStyle = '#1a1a1a';
  ctx.stroke();

  // Wskazówka kierunku jazdy.
  ctx.beginPath();
  ctx.moveTo(r * 0.2, 0);
  ctx.lineTo(r * 1.3, 0);
  ctx.lineWidth = Math.max(1, r * 0.25);
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
): void {
  drawTrack(ctx, track, camera, width, height);
  for (const rider of riders) {
    drawRider(ctx, rider, cfg, camera);
  }
}
