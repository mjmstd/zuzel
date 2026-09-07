import type { Steer } from '../engine/types.ts';

export interface ControlScheme {
  readonly label: string;
  readonly left: string;
  readonly right: string;
}

export const PLAYER_CONTROLS: readonly ControlScheme[] = [
  { label: 'Strzałki ←/→', left: 'ArrowLeft', right: 'ArrowRight' },
  { label: 'A / D', left: 'KeyA', right: 'KeyD' },
];

/**
 * Śledzi wciśnięte klawisze/dotyk i przelicza je na sterowanie (-1/0/1) per gracz.
 * Klawiatura i przyciski dotykowe (ui/touch.ts) współdzielą ten sam zbiór "wciśniętych"
 * kodów (te same stringi co `ControlScheme.left/right`), więc dla silnika gry nie ma
 * różnicy, skąd przyszedł input.
 */
export class KeyboardInput {
  private readonly pressed = new Set<string>();
  private readonly onKeyDown = (e: KeyboardEvent): void => {
    this.pressed.add(e.code);
  };
  private readonly onKeyUp = (e: KeyboardEvent): void => {
    this.pressed.delete(e.code);
  };
  private readonly onBlur = (): void => {
    this.pressed.clear();
  };

  constructor() {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
  }

  steerFor(scheme: ControlScheme): Steer {
    const left = this.pressed.has(scheme.left);
    const right = this.pressed.has(scheme.right);
    if (left && !right) return -1;
    if (right && !left) return 1;
    return 0;
  }

  press(code: string): void {
    this.pressed.add(code);
  }

  release(code: string): void {
    this.pressed.delete(code);
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
  }
}
