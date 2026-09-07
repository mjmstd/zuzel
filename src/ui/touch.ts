import type { ControlScheme } from './input.ts';
import { KeyboardInput } from './input.ts';

export function isTouchDevice(): boolean {
  return window.matchMedia('(pointer: coarse)').matches;
}

/** Renderuje duże przyciski lewo/prawo dla każdego gracza-człowieka na urządzeniach dotykowych. */
export function renderTouchControls(
  container: HTMLElement,
  schemes: readonly ControlScheme[],
  input: KeyboardInput,
  onFirstTouch: () => void,
): void {
  container.innerHTML = schemes
    .map(
      (scheme, i) => `
        <div class="touch-player" data-player="${i}">
          <button class="touch-btn" data-code="${scheme.left}" aria-label="Skręt w lewo">◀</button>
          <button class="touch-btn" data-code="${scheme.right}" aria-label="Skręt w prawo">▶</button>
        </div>`,
    )
    .join('');

  container.querySelectorAll<HTMLButtonElement>('.touch-btn').forEach((btn) => {
    const code = btn.dataset['code'];
    if (!code) return;

    const press = (e: Event): void => {
      e.preventDefault();
      onFirstTouch();
      input.press(code);
      btn.classList.add('active');
    };
    const release = (e: Event): void => {
      e.preventDefault();
      input.release(code);
      btn.classList.remove('active');
    };

    btn.addEventListener('touchstart', press, { passive: false });
    btn.addEventListener('touchend', release);
    btn.addEventListener('touchcancel', release);
    // Pozwala też testować/klikać myszką na urządzeniach z ekranem dotykowym i myszką.
    btn.addEventListener('mousedown', press);
    btn.addEventListener('mouseup', release);
    btn.addEventListener('mouseleave', release);
  });
}

export function clearTouchControls(container: HTMLElement): void {
  container.innerHTML = '';
}
