import type { RaceResult, RiderState } from '../engine/types.ts';

export type HumanCount = 1 | 2;

export function renderStartScreen(overlay: HTMLElement, onStart: (humanCount: HumanCount) => void): void {
  overlay.innerHTML = `
    <div class="panel">
      <h1>Żużel — kreski</h1>
      <p class="subtitle">
        Steruj tylko kierunkiem — gaz jest automatyczny.<br>
        Zwolnij przed łukiem, inaczej wypadniesz za bandę.
      </p>
      <div class="options">
        <button class="primary" data-count="1">1 gracz (strzałki) + 3 boty</button>
        <button data-count="2">2 graczy (strzałki / A-D) + 2 boty</button>
      </div>
    </div>
  `;
  overlay.querySelectorAll<HTMLButtonElement>('button[data-count]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const count = Number(btn.dataset['count']) as HumanCount;
      onStart(count);
    });
  });
}

export function renderResultsScreen(
  overlay: HTMLElement,
  results: readonly RaceResult[],
  riders: readonly RiderState[],
  onRestart: () => void,
): void {
  const rows = results
    .map((res) => {
      const rider = riders.find((r) => r.id === res.riderId);
      const name = rider?.name ?? `#${res.riderId}`;
      const color = rider?.color ?? '#888';
      const time = res.finishTime !== null ? `${res.finishTime.toFixed(1)} s` : '—';
      return `<tr>
        <td>${res.place}.</td>
        <td><span class="swatch" style="background:${color}"></span>${name}</td>
        <td>${res.points} pkt</td>
        <td>${time}</td>
      </tr>`;
    })
    .join('');

  overlay.innerHTML = `
    <div class="panel">
      <h1>Wyniki biegu</h1>
      <table class="results-table">
        <thead><tr><th>Miejsce</th><th>Zawodnik</th><th>Punkty</th><th>Czas</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="options">
        <button class="primary" id="restart-btn">Jeszcze raz</button>
      </div>
    </div>
  `;
  overlay.querySelector('#restart-btn')?.addEventListener('click', onRestart);
}

export function clearOverlay(overlay: HTMLElement): void {
  overlay.innerHTML = '';
}
