import { createOvalTrack } from './engine/track.ts';
import { createInitialState, tick } from './engine/race.ts';
import type { RiderSpec } from './engine/race.ts';
import { defaultRaceConfig, defaultTrack } from './engine/config.ts';
import { scoreRace } from './engine/scoring.ts';
import { AI_LEVEL_LABELS, chooseSteer } from './ai/bot.ts';
import type { AiLevel } from './ai/bot.ts';
import { fitCamera, resizeCanvasToDisplaySize } from './render/camera.ts';
import { drawRace } from './render/canvas.ts';
import { KeyboardInput, PLAYER_CONTROLS } from './ui/input.ts';
import { renderHud, clearHud } from './ui/hud.ts';
import { renderStartScreen, renderResultsScreen, renderCountdown, clearOverlay } from './ui/screens.ts';
import type { HumanCount } from './ui/screens.ts';
import type { RaceState, Steer } from './engine/types.ts';

const canvas = document.getElementById('board') as HTMLCanvasElement;
const ctx = canvas.getContext('2d');
const hudEl = document.getElementById('hud');
const overlayEl = document.getElementById('overlay');
if (!ctx || !hudEl || !overlayEl) {
  throw new Error('Brakuje elementów DOM wymaganych do uruchomienia gry.');
}

const track = createOvalTrack(defaultTrack);
const cfg = defaultRaceConfig;
const keyboard = new KeyboardInput();

const RIDER_COLORS = ['#e6362f', '#3d7dca', '#f2f2f2', '#f4c430'];
const FIXED_DT = 1 / 60;
const MAX_STEPS_PER_FRAME = 5;
const COUNTDOWN_SECONDS = 3;

let raceState: RaceState | null = null;
let humanIds: number[] = [];
let aiLevel: AiLevel = 'pro';
let rafHandle = 0;
let accumulator = 0;
let lastTimestamp = 0;
let raceStartAt = 0;
let countdownDone = false;

function buildSpecs(humanCount: HumanCount, level: AiLevel): RiderSpec[] {
  return RIDER_COLORS.map((color, i) => ({
    id: i + 1,
    color,
    name: i < humanCount ? `Gracz ${i + 1}` : `Bot ${i - humanCount + 1} (${AI_LEVEL_LABELS[level]})`,
  }));
}

function controlsHintFor(humanCount: number): string {
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

function render(state: RaceState): void {
  resizeCanvasToDisplaySize(canvas);
  const camera = fitCamera(track, canvas.width, canvas.height);
  drawRace(ctx!, track, cfg, state.riders, camera, canvas.width, canvas.height);
  renderHud(hudEl!, state, cfg, controlsHintFor(humanIds.length));
}

function loop(timestamp: number): void {
  if (!raceState) return;

  if (timestamp < raceStartAt) {
    render(raceState);
    renderCountdown(overlayEl!, Math.ceil((raceStartAt - timestamp) / 1000));
    lastTimestamp = timestamp;
    rafHandle = requestAnimationFrame(loop);
    return;
  }
  if (!countdownDone) {
    countdownDone = true;
    clearOverlay(overlayEl!);
  }

  const frameDelta = Math.min(0.25, (timestamp - lastTimestamp) / 1000);
  lastTimestamp = timestamp;
  accumulator += frameDelta;

  let steps = 0;
  while (accumulator >= FIXED_DT && steps < MAX_STEPS_PER_FRAME) {
    const inputs = computeInputs(raceState);
    raceState = tick(raceState, track, cfg, inputs, FIXED_DT);
    accumulator -= FIXED_DT;
    steps++;
  }

  render(raceState);

  if (raceState.status === 'finished') {
    const results = scoreRace(raceState.riders);
    renderResultsScreen(overlayEl!, results, raceState.riders, showStartScreen);
    clearHud(hudEl!);
    return;
  }

  rafHandle = requestAnimationFrame(loop);
}

function startRace(humanCount: HumanCount, level: AiLevel): void {
  const specs = buildSpecs(humanCount, level);
  humanIds = specs.slice(0, humanCount).map((s) => s.id);
  aiLevel = level;
  raceState = createInitialState(track, cfg, specs);
  lastTimestamp = performance.now();
  raceStartAt = lastTimestamp + COUNTDOWN_SECONDS * 1000;
  countdownDone = false;
  accumulator = 0;
  cancelAnimationFrame(rafHandle);
  rafHandle = requestAnimationFrame(loop);
}

function showStartScreen(): void {
  raceState = null;
  clearHud(hudEl!);
  renderStartScreen(overlayEl!, startRace);
}

showStartScreen();
