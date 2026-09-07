import type { RaceConfig } from '../engine/types.ts';

interface NumericField {
  key: Exclude<keyof RaceConfig, 'collisionMode' | 'laps'>;
  label: string;
  min: number;
  max: number;
  step: number;
  unit?: string;
  toDisplay?: (raw: number) => number;
  fromDisplay?: (display: number) => number;
}

interface FieldGroup {
  title: string;
  fields: NumericField[];
}

const RAD_TO_DEG = 180 / Math.PI;

const TUNING_GROUPS: FieldGroup[] = [
  {
    title: 'Prędkość',
    fields: [
      { key: 'maxSpeed', label: 'Prędkość maksymalna', min: 15, max: 50, step: 1, unit: 'j/s' },
      { key: 'accel', label: 'Przyspieszenie', min: 5, max: 40, step: 1, unit: 'j/s²' },
    ],
  },
  {
    title: 'Skręt i poślizg',
    fields: [
      { key: 'turnRate', label: 'Szybkość skrętu', min: 1, max: 6, step: 0.1, unit: 'rad/s' },
      { key: 'minGrip', label: 'Minimalna przyczepność', min: 0.1, max: 1, step: 0.05 },
      { key: 'gripSpeedFalloff', label: 'Utrata przyczepności z prędkością', min: 0, max: 0.05, step: 0.002 },
      {
        key: 'maxSlipAngle',
        label: 'Maks. kąt poślizgu',
        min: 0,
        max: 80,
        step: 1,
        unit: '°',
        toDisplay: (rad) => rad * RAD_TO_DEG,
        fromDisplay: (deg) => deg / RAD_TO_DEG,
      },
      { key: 'corneringDrag', label: 'Opór od poślizgu', min: 0.5, max: 15, step: 0.5 },
    ],
  },
  {
    title: 'Upadki i kolizje',
    fields: [
      { key: 'crashPenaltySeconds', label: 'Kara czasowa za upadek', min: 0.3, max: 4, step: 0.1, unit: 's' },
      { key: 'collisionImmunitySeconds', label: 'Nietykalność po upadku', min: 0, max: 2, step: 0.1, unit: 's' },
      { key: 'riderLength', label: 'Długość motocykla', min: 1, max: 5, step: 0.1, unit: 'j' },
      { key: 'riderWidth', label: 'Szerokość motocykla', min: 0.4, max: 2.5, step: 0.1, unit: 'j' },
    ],
  },
];

export interface TuningCallbacks {
  onChange: () => void;
  onReset: () => void;
  onClose: () => void;
}

function formatValue(display: number, field: NumericField): string {
  const decimals = field.step < 1 ? Math.min(3, Math.ceil(-Math.log10(field.step))) : 0;
  const num = display.toFixed(decimals);
  return field.unit ? `${num} ${field.unit}` : num;
}

function rawOf(cfg: RaceConfig, field: NumericField): number {
  return (cfg as unknown as Record<string, number>)[field.key]!;
}

function fieldHtml(field: NumericField, cfg: RaceConfig): string {
  const raw = rawOf(cfg, field);
  const display = field.toDisplay ? field.toDisplay(raw) : raw;
  return `
    <label class="tuning-field">
      <span class="tuning-field-label">
        <span>${field.label}</span>
        <span class="tuning-value" data-value-for="${field.key}">${formatValue(display, field)}</span>
      </span>
      <input type="range" data-key="${field.key}" min="${field.min}" max="${field.max}" step="${field.step}" value="${display}" />
    </label>`;
}

function wireField(container: HTMLElement, field: NumericField, cfg: RaceConfig, onChange: () => void): void {
  const input = container.querySelector<HTMLInputElement>(`input[data-key="${field.key}"]`);
  const valueEl = container.querySelector<HTMLElement>(`[data-value-for="${field.key}"]`);
  if (!input) return;

  const apply = (): void => {
    const display = parseFloat(input.value);
    const raw = field.fromDisplay ? field.fromDisplay(display) : display;
    (cfg as unknown as Record<string, number>)[field.key] = raw;
    if (valueEl) valueEl.textContent = formatValue(display, field);
  };

  // "input" daje natychmiastowy efekt w trakcie przeciągania (widać zmianę fizyki na
  // żywo, nawet w trakcie biegu); "change" dopiero persystuje i oddaje fokus, żeby
  // strzałki suwaka nie zostały przypadkiem przechwycone zamiast sterować zawodnikiem.
  input.addEventListener('input', apply);
  input.addEventListener('change', () => {
    onChange();
    input.blur();
  });
}

/** Panel suwaków do strojenia fizyki na żywo — mutuje przekazany `cfg` w miejscu. */
export function renderTuningPanel(container: HTMLElement, cfg: RaceConfig, callbacks: TuningCallbacks): void {
  const groupsHtml = TUNING_GROUPS.map(
    (group) => `
    <div class="tuning-group">
      <p class="group-label">${group.title}</p>
      ${group.fields.map((field) => fieldHtml(field, cfg)).join('')}
    </div>`,
  ).join('');

  container.innerHTML = `
    <div class="tuning-header">
      <h2>Ustawienia fizyki</h2>
      <button id="tuning-close" aria-label="Zamknij ustawienia fizyki">✕</button>
    </div>
    ${groupsHtml}
    <div class="tuning-group">
      <p class="group-label">Kolizje</p>
      <label class="tuning-checkbox">
        <input type="checkbox" id="tuning-collision-mode" ${cfg.collisionMode === 'solid' ? 'checked' : ''} />
        Zawodnicy zderzają się (odznacz = tryb duchów)
      </label>
    </div>
    <button id="tuning-reset" class="tuning-reset">Przywróć domyślne</button>`;

  container.querySelector('#tuning-close')?.addEventListener('click', callbacks.onClose);
  container.querySelector('#tuning-reset')?.addEventListener('click', callbacks.onReset);

  const collisionInput = container.querySelector<HTMLInputElement>('#tuning-collision-mode');
  collisionInput?.addEventListener('change', () => {
    cfg.collisionMode = collisionInput.checked ? 'solid' : 'ghost';
    callbacks.onChange();
  });

  for (const group of TUNING_GROUPS) {
    for (const field of group.fields) {
      wireField(container, field, cfg, callbacks.onChange);
    }
  }
}

export function clearTuningPanel(container: HTMLElement): void {
  container.innerHTML = '';
}
