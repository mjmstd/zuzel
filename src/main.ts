import { createOvalTrack } from './engine/track.ts';
import { createInitialState, tick } from './engine/race.ts';
import type { RiderSpec } from './engine/race.ts';
import { defaultRaceConfig, defaultTrack } from './engine/config.ts';
import { scoreRace } from './engine/scoring.ts';
import { AI_LEVEL_LABELS, chooseSteer } from './ai/bot.ts';
import type { AiLevel } from './ai/bot.ts';
import { fitCamera, resizeCanvasToDisplaySize } from './render/camera.ts';
import { drawRace, TRAIL_LENGTH } from './render/canvas.ts';
import { KeyboardInput, PLAYER_CONTROLS } from './ui/input.ts';
import { renderTouchControls, clearTouchControls, isTouchDevice } from './ui/touch.ts';
import { renderHud, clearHud } from './ui/hud.ts';
import { renderStartScreen, renderResultsScreen, renderCountdown, clearOverlay } from './ui/screens.ts';
import type { HumanCount } from './ui/screens.ts';
import type { RaceState, Steer, Vec2 } from './engine/types.ts';
import type { RaceConfig } from './engine/types.ts';
import { sound } from './audio/sound.ts';
import { renderTuningPanel, clearTuningPanel } from './ui/tuning.ts';

const canvas = document.getElementById('board') as HTMLCanvasElement;
const ctx = canvas.getContext('2d');
const hudEl = document.getElementById('hud');
const overlayEl = document.getElementById('overlay');
const touchEl = document.getElementById('touch-controls');
const settingsEl = document.getElementById('settings');
const tuningPanelEl = document.getElementById('tuning-panel');
if (!ctx || !hudEl || !overlayEl || !touchEl || !settingsEl || !tuningPanelEl) {
  throw new Error('Brakuje elementów DOM wymaganych do uruchomienia gry.');
}

const track = createOvalTrack(defaultTrack);
// Własna kopia — `defaultRaceConfig` zostaje nietknięty jako punkt odniesienia dla
// przycisku "Przywróć domyślne" w panelu strojenia.
const cfg: RaceConfig = { ...defaultRaceConfig };
const keyboard = new KeyboardInput();
const touchCapable = isTouchDevice();

const RIDER_COLORS = ['#e6362f', '#3d7dca', '#f2f2f2', '#f4c430'];
const FIXED_DT = 1 / 60;
const MAX_STEPS_PER_FRAME = 5;
const COUNTDOWN_SECONDS = 3;
const MUTE_STORAGE_KEY = 'zuzel-muted';
const TUNING_STORAGE_KEY = 'zuzel-tuning';

let raceState: RaceState | null = null;
let humanIds: number[] = [];
let aiLevel: AiLevel = 'pro';
let lastSpecs: RiderSpec[] = [];
let rafHandle = 0;
let accumulator = 0;
let lastTimestamp = 0;
let raceStartAt = 0;
let countdownDone = false;
let lastCountdownBeep = -1;

let isReplay = false;
let replayIndex = 0;
let recordedInputs: Record<number, Steer>[] = [];

const trails = new Map<number, Vec2[]>();
const prevCrashedUntil = new Map<number, number>();
let crashSoundQueued = false;
let finishSoundPlayed = false;

function buildSpecs(humanCount: HumanCount, level: AiLevel): RiderSpec[] {
  return RIDER_COLORS.map((color, i) => ({
    id: i + 1,
    color,
    name: i < humanCount ? `Gracz ${i + 1}` : `Bot ${i - humanCount + 1} (${AI_LEVEL_LABELS[level]})`,
  }));
}

function controlsHintFor(humanCount: number): string {
  if (isReplay) return 'Oglądasz powtórkę nagranego biegu';
  if (touchCapable) return humanCount === 1 ? 'Ty: przyciski na dole ekranu' : 'Przyciski na dole: Gracz 1 / Gracz 2';
  return humanCount === 1 ? 'Ty: strzałki ←/→' : 'Gracz 1: strzałki ←/→ · Gracz 2: A/D';
}

function computeInputs(state: RaceState): Record<number, Steer> {
  const inputs: Record<number, Steer> = {};
  for (const rider of state.riders) {
    if (rider.finished) {
      inputs[rider.id] = 0;
      continue;
    }
    const humanIndex = humanIds.indexOf(rider.id);
    const scheme = humanIndex >= 0 ? PLAYER_CONTROLS[humanIndex] : undefined;
    inputs[rider.id] = scheme ? keyboard.steerFor(scheme) : chooseSteer(rider, state.riders, track, aiLevel);
  }
  return inputs;
}

function updateTrails(state: RaceState): void {
  for (const rider of state.riders) {
    let arr = trails.get(rider.id);
    if (!arr) {
      arr = [];
      trails.set(rider.id, arr);
    }
    arr.push(rider.position);
    if (arr.length > TRAIL_LENGTH) arr.shift();
  }
}

function updateEngineSounds(state: RaceState): void {
  for (const id of humanIds) {
    const rider = state.riders.find((r) => r.id === id);
    if (!rider) continue;
    sound.updateEngine(id, Math.min(1, rider.speed / cfg.maxSpeed));
  }
}

/** Wykrywa świeże upadki (przejście w stan "ukarany") między dwoma tickami. */
function detectCrashes(state: RaceState): void {
  for (const rider of state.riders) {
    const prev = prevCrashedUntil.get(rider.id) ?? 0;
    if (rider.crashedUntil > prev) {
      crashSoundQueued = true;
    }
    prevCrashedUntil.set(rider.id, rider.crashedUntil);
  }
}

function stepOnce(state: RaceState): RaceState {
  let inputs: Record<number, Steer>;
  if (isReplay) {
    inputs = recordedInputs[replayIndex] ?? {};
    replayIndex++;
  } else {
    inputs = computeInputs(state);
    recordedInputs.push(inputs);
  }
  const next = tick(state, track, cfg, inputs, FIXED_DT);
  detectCrashes(next);
  return next;
}

function render(state: RaceState): void {
  resizeCanvasToDisplaySize(canvas);
  const camera = fitCamera(track, canvas.width, canvas.height);
  updateTrails(state);
  drawRace(ctx!, track, cfg, state.riders, camera, canvas.width, canvas.height, state.time, trails);
  renderHud(hudEl!, state, cfg, controlsHintFor(humanIds.length));
}

function loop(timestamp: number): void {
  if (!raceState) return;

  if (timestamp < raceStartAt) {
    render(raceState);
    const secondsLeft = Math.ceil((raceStartAt - timestamp) / 1000);
    renderCountdown(overlayEl!, secondsLeft);
    if (secondsLeft !== lastCountdownBeep) {
      lastCountdownBeep = secondsLeft;
      if (secondsLeft > 0) sound.countdownTick();
    }
    lastTimestamp = timestamp;
    rafHandle = requestAnimationFrame(loop);
    return;
  }
  if (!countdownDone) {
    countdownDone = true;
    clearOverlay(overlayEl!);
    sound.countdownGo();
  }

  const frameDelta = Math.min(0.25, (timestamp - lastTimestamp) / 1000);
  lastTimestamp = timestamp;
  accumulator += frameDelta;

  crashSoundQueued = false;
  let steps = 0;
  while (accumulator >= FIXED_DT && steps < MAX_STEPS_PER_FRAME) {
    raceState = stepOnce(raceState);
    accumulator -= FIXED_DT;
    steps++;
    if (isReplay && replayIndex >= recordedInputs.length && raceState.status !== 'finished') {
      // Nagranie się skończyło (nie powinno, ale na wszelki wypadek nie kręcimy w nieskończoność).
      break;
    }
  }
  if (crashSoundQueued) sound.crash();

  render(raceState);
  updateEngineSounds(raceState);

  if (raceState.status === 'finished') {
    if (!finishSoundPlayed) {
      finishSoundPlayed = true;
      sound.finishJingle();
    }
    sound.stopAllEngines();
    if (isReplay) {
      renderCountdown(overlayEl!, 0);
      overlayEl!.innerHTML = `
        <div class="panel">
          <h1>Koniec powtórki</h1>
          <div class="options">
            <button class="primary" id="replay-close">Wróć do menu</button>
          </div>
        </div>`;
      overlayEl!.querySelector('#replay-close')?.addEventListener('click', showStartScreen);
      clearTouchControls(touchEl!);
      return;
    }
    const results = scoreRace(raceState.riders);
    renderResultsScreen(overlayEl!, results, raceState.riders, showStartScreen, startReplay);
    clearHud(hudEl!);
    clearTouchControls(touchEl!);
    return;
  }

  rafHandle = requestAnimationFrame(loop);
}

function resetSharedState(): void {
  trails.clear();
  prevCrashedUntil.clear();
  crashSoundQueued = false;
  finishSoundPlayed = false;
  lastCountdownBeep = -1;
  sound.stopAllEngines();
}

function setupHumanEngines(): void {
  humanIds.forEach((id, i) => {
    const pan = humanIds.length > 1 ? (i === 0 ? -0.4 : 0.4) : 0;
    sound.startEngine(id, pan);
  });
}

function setupTouchControls(): void {
  if (!touchCapable) return;
  const schemes = PLAYER_CONTROLS.slice(0, humanIds.length);
  renderTouchControls(touchEl!, schemes, keyboard, () => sound.resume());
}

function startRace(humanCount: HumanCount, level: AiLevel): void {
  sound.resume();
  isReplay = false;
  recordedInputs = [];
  replayIndex = 0;
  resetSharedState();

  const specs = buildSpecs(humanCount, level);
  lastSpecs = specs;
  humanIds = specs.slice(0, humanCount).map((s) => s.id);
  aiLevel = level;
  raceState = createInitialState(track, cfg, specs);

  setupHumanEngines();
  setupTouchControls();

  lastTimestamp = performance.now();
  raceStartAt = lastTimestamp + COUNTDOWN_SECONDS * 1000;
  countdownDone = false;
  accumulator = 0;
  cancelAnimationFrame(rafHandle);
  rafHandle = requestAnimationFrame(loop);
}

function startReplay(): void {
  sound.resume();
  isReplay = true;
  replayIndex = 0;
  resetSharedState();

  raceState = createInitialState(track, cfg, lastSpecs);
  setupHumanEngines();
  clearTouchControls(touchEl!);
  clearOverlay(overlayEl!);

  lastTimestamp = performance.now();
  raceStartAt = 0;
  countdownDone = true;
  accumulator = 0;
  cancelAnimationFrame(rafHandle);
  rafHandle = requestAnimationFrame(loop);
}

function persistTuning(): void {
  try {
    localStorage.setItem(TUNING_STORAGE_KEY, JSON.stringify(cfg));
  } catch {
    // localStorage może być niedostępny (np. tryb prywatny) — ustawienia po prostu
    // nie przetrwają odświeżenia strony.
  }
}

function applyStoredTuning(): void {
  try {
    const raw = localStorage.getItem(TUNING_STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Partial<RaceConfig>;
    for (const key of Object.keys(defaultRaceConfig) as (keyof RaceConfig)[]) {
      if (key in parsed) (cfg as unknown as Record<string, unknown>)[key] = parsed[key];
    }
  } catch {
    // Brak zapisanych ustawień albo dane uszkodzone — zostajemy przy domyślnych.
  }
}

function openTuningPanel(): void {
  // Na dotyku panel jest węższy niż ekran — chowamy przyciski sterowania pod spodem,
  // żeby nie przebijały się na brzegach i nie łapały przypadkowych dotknięć.
  touchEl!.classList.add('hidden-while-tuning');
  renderTuningPanel(tuningPanelEl!, cfg, {
    onChange: persistTuning,
    onReset: () => {
      Object.assign(cfg, defaultRaceConfig);
      persistTuning();
      openTuningPanel();
    },
    onClose: closeTuningPanel,
  });
}

function closeTuningPanel(): void {
  clearTuningPanel(tuningPanelEl!);
  touchEl!.classList.remove('hidden-while-tuning');
}

function toggleTuningPanel(): void {
  if (tuningPanelEl!.childElementCount > 0) closeTuningPanel();
  else openTuningPanel();
}

function renderSettings(): void {
  settingsEl!.innerHTML = `
    <button id="tuning-btn" aria-label="Ustawienia fizyki">⚙</button>
    <button id="mute-btn" aria-label="Wycisz dźwięk">${sound.muted ? '🔇' : '🔊'}</button>`;
  settingsEl!.querySelector('#mute-btn')?.addEventListener('click', () => {
    sound.resume();
    sound.setMuted(!sound.muted);
    localStorage.setItem(MUTE_STORAGE_KEY, sound.muted ? '1' : '0');
    renderSettings();
  });
  settingsEl!.querySelector('#tuning-btn')?.addEventListener('click', toggleTuningPanel);
}

function showStartScreen(): void {
  cancelAnimationFrame(rafHandle);
  raceState = null;
  isReplay = false;
  sound.stopAllEngines();
  clearHud(hudEl!);
  clearTouchControls(touchEl!);
  renderStartScreen(overlayEl!, startRace);
}

try {
  sound.setMuted(localStorage.getItem(MUTE_STORAGE_KEY) === '1');
} catch {
  // localStorage może być niedostępny (np. tryb prywatny) — zaczynamy z dźwiękiem włączonym.
}
applyStoredTuning();
renderSettings();
showStartScreen();
