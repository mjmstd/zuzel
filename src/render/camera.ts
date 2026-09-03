import type { OvalTrack } from '../engine/track.ts';
import type { Vec2 } from '../engine/types.ts';

export interface Camera {
  readonly scale: number;
  readonly offsetX: number;
  readonly offsetY: number;
}

/** Dopasowuje kamerę tak, żeby cały tor (z marginesem) mieścił się w płótnie. */
export function fitCamera(track: OvalTrack, canvasWidth: number, canvasHeight: number, padding = 24): Camera {
  const halfL = track.def.straightLength / 2;
  const R = track.def.turnRadius;
  const halfW = track.def.width / 2;

  const worldWidth = 2 * (halfL + R + halfW);
  const worldHeight = 2 * (R + halfW);

  const scale = Math.min(
    (canvasWidth - padding * 2) / worldWidth,
    (canvasHeight - padding * 2) / worldHeight,
  );

  return {
    scale,
    offsetX: canvasWidth / 2,
    offsetY: canvasHeight / 2,
  };
}

export function worldToScreen(camera: Camera, p: Vec2): Vec2 {
  return { x: camera.offsetX + p.x * camera.scale, y: camera.offsetY + p.y * camera.scale };
}

/** Dopasowuje rozdzielczość <canvas> do jego rozmiaru CSS z uwzględnieniem DPR. */
export function resizeCanvasToDisplaySize(canvas: HTMLCanvasElement): boolean {
  const dpr = window.devicePixelRatio || 1;
  const width = Math.round(canvas.clientWidth * dpr);
  const height = Math.round(canvas.clientHeight * dpr);
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
    return true;
  }
  return false;
}
