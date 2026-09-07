/**
 * Wszystkie dźwięki są syntezowane w locie przez Web Audio API — bez plików
 * audio do pobrania czy osadzania. AudioContext wymaga gestu użytkownika,
 * więc `resume()` wywołujemy dopiero przy pierwszym kliknięciu w UI.
 */
export class SoundEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private engines = new Map<number, { osc: OscillatorNode; gain: GainNode; filter: BiquadFilterNode }>();
  private _muted = false;

  get muted(): boolean {
    return this._muted;
  }

  setMuted(muted: boolean): void {
    this._muted = muted;
    if (this.master) {
      this.master.gain.value = muted ? 0 : 0.5;
    }
  }

  /** Tworzy/wznawia AudioContext. Wywołuj z handlera kliknięcia. */
  resume(): void {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = this._muted ? 0 : 0.5;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
  }

  private now(): number {
    return this.ctx?.currentTime ?? 0;
  }

  beep(freq: number, duration: number, type: OscillatorType = 'sine', gainLevel = 0.35): void {
    if (!this.ctx || !this.master) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    const t = this.now();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(gainLevel, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(t);
    osc.stop(t + duration + 0.02);
  }

  countdownTick(): void {
    this.beep(440, 0.12, 'square', 0.25);
  }

  countdownGo(): void {
    this.beep(880, 0.28, 'square', 0.3);
  }

  crash(): void {
    if (!this.ctx || !this.master) return;
    const duration = 0.25;
    const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate * duration, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    }
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 900;
    const gain = this.ctx.createGain();
    gain.gain.value = 0.6;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    source.start(this.now());
  }

  finishJingle(): void {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, i) => {
      setTimeout(() => this.beep(freq, 0.22, 'triangle', 0.3), i * 110);
    });
  }

  /** Uruchamia ciągły dźwięk silnika dla jednego zawodnika (zwykle gracza-człowieka). */
  startEngine(riderId: number, pan = 0): void {
    if (!this.ctx || !this.master || this.engines.has(riderId)) return;
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    filter.type = 'lowpass';
    filter.frequency.value = 400;
    gain.gain.value = 0.06;
    osc.connect(filter);
    if ('createStereoPanner' in this.ctx) {
      const panner = this.ctx.createStereoPanner();
      panner.pan.value = pan;
      filter.connect(panner);
      panner.connect(gain);
    } else {
      filter.connect(gain);
    }
    gain.connect(this.master);
    osc.start();
    this.engines.set(riderId, { osc, gain, filter });
  }

  /** `speedRatio` 0..1 — im szybciej, tym wyższy i głośniejszy silnik. */
  updateEngine(riderId: number, speedRatio: number): void {
    const node = this.engines.get(riderId);
    if (!this.ctx || !node) return;
    const t = this.now();
    const freq = 70 + speedRatio * 180;
    node.osc.frequency.setTargetAtTime(freq, t, 0.05);
    node.gain.gain.setTargetAtTime(0.04 + speedRatio * 0.05, t, 0.08);
  }

  stopEngine(riderId: number): void {
    const node = this.engines.get(riderId);
    if (!node) return;
    node.osc.stop();
    this.engines.delete(riderId);
  }

  stopAllEngines(): void {
    for (const id of [...this.engines.keys()]) this.stopEngine(id);
  }
}

export const sound = new SoundEngine();
