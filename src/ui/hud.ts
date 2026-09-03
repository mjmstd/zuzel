import type { RaceConfig, RaceState } from '../engine/types.ts';
import { classify } from '../engine/scoring.ts';

export function renderHud(hudEl: HTMLElement, state: RaceState, cfg: RaceConfig, controlsHint: string): void {
  const leaderLap = state.riders.reduce((max, r) => Math.max(max, r.lap), 0);
  const displayLap = Math.min(leaderLap + 1, cfg.laps);
  const ranked = classify(state.riders);

  const standingsRows = ranked
    .map(
      (r, i) => `
        <div class="standings-row">
          <span>${i + 1}.</span>
          <span class="swatch" style="background:${r.color}"></span>
          <span>${r.name}</span>
          <span style="margin-left:auto">${Math.min(r.lap, cfg.laps)}/${cfg.laps}</span>
        </div>`,
    )
    .join('');

  hudEl.innerHTML = `
    <div class="lap-counter">Okrążenie ${displayLap}/${cfg.laps}</div>
    <div class="standings">${standingsRows}</div>
    <div class="controls-hint">${controlsHint}</div>
  `;
}

export function clearHud(hudEl: HTMLElement): void {
  hudEl.innerHTML = '';
}
