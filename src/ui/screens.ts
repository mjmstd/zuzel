import { AI_LEVELS, AI_LEVEL_LABELS } from '../ai/bot.ts';
import type { AiLevel } from '../ai/bot.ts';
import type { RaceResult, RiderState } from '../engine/types.ts';

export type HumanCount = 1 | 2;

function wireChoiceGroup(overlay: HTMLElement, groupSelector: string, attr: string, onChange: (value: string) => void): void {
  const buttons = overlay.querySelectorAll<HTMLButtonElement>(`${groupSelector} button.choice`);
  buttons.forEach((btn) => {
    btn.addEventListener('click', () => {
      buttons.forEach((b) => b.classList.remove('selected'));
      btn.classList.add('selected');
      onChange(btn.dataset[attr] ?? '');
    });
  });
}

export function renderStartScreen(overlay: HTMLElement, onStart: (humanCount: HumanCount, aiLevel: AiLevel) => void): void {
  let humanCount: HumanCount = 1;
  let aiLevel: AiLevel = 'pro';

  const levelButtons = AI_LEVELS.map(
    (level) =>
      `<button class="choice${level === aiLevel ? ' selected' : ''}" data-level="${level}">${AI_LEVEL_LABELS[level]}</button>`,
  ).join('');

  overlay.innerHTML = `
    <div class="panel">
      <h1>Żużel — kreski</h1>
      <p class="subtitle">
        Steruj tylko kierunkiem — gaz jest automatyczny.<br>
        Zwolnij przed łukiem, inaczej wypadniesz za bandę.
      </p>
      <details>
        <summary>Jak grać?</summary>
        <ul>
          <li>Jedyne, czym sterujesz, to kierunek — gaz dodaje się sam.</li>
          <li>Im szybciej jedziesz, tym wolniej skręcasz — przed łukiem ściągnij wcześniej.</li>
          <li>Wypadnięcie za bandę albo zderzenie z rywalem = krótki upadek i utrata prędkości.</li>
          <li>Wygrywa bieg (4 okrążenia) — liczy się kolejność na mecie.</li>
        </ul>
      </details>
      <div class="option-group" id="human-group">
        <p class="group-label">Ilu graczy?</p>
        <div class="options row">
          <button class="choice selected" data-human="1">1 gracz</button>
          <button class="choice" data-human="2">2 graczy</button>
        </div>
      </div>
      <div class="option-group" id="level-group">
        <p class="group-label">Poziom botów</p>
        <div class="options row">${levelButtons}</div>
      </div>
      <button class="primary start-btn" id="start-btn">Start wyścigu</button>
    </div>
  `;

  wireChoiceGroup(overlay, '#human-group', 'human', (v) => {
    humanCount = Number(v) as HumanCount;
  });
  wireChoiceGroup(overlay, '#level-group', 'level', (v) => {
    aiLevel = v as AiLevel;
  });
  overlay.querySelector('#start-btn')?.addEventListener('click', () => onStart(humanCount, aiLevel));
}

export function renderCountdown(overlay: HTMLElement, secondsLeft: number): void {
  overlay.innerHTML = `<div class="countdown">${secondsLeft > 0 ? secondsLeft : 'START!'}</div>`;
}

export function renderResultsScreen(
  overlay: HTMLElement,
  results: readonly RaceResult[],
  riders: readonly RiderState[],
  onRestart: () => void,
  onReplay: () => void,
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
        <button id="replay-btn">Obejrzyj powtórkę</button>
      </div>
    </div>
  `;
  overlay.querySelector('#restart-btn')?.addEventListener('click', onRestart);
  overlay.querySelector('#replay-btn')?.addEventListener('click', onReplay);
}

export function clearOverlay(overlay: HTMLElement): void {
  overlay.innerHTML = '';
}
