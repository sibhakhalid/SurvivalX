/**
 * Fully synthesized arcade sound effects (WebAudio).
 * No audio assets — everything is generated at runtime.
 */
export class SFX {
  private ac: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  muted = false;

  /** Must be called from a user gesture before sounds play. */
  ensure() {
    if (!this.ac) {
      try {
        const AC =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext })
            .webkitAudioContext;
        if (!AC) return;
        this.ac = new AC();
        this.master = this.ac.createGain();
        this.master.gain.value = this.muted ? 0 : 0.5;
        this.master.connect(this.ac.destination);
        const len = Math.floor(this.ac.sampleRate * 0.5);
        this.noiseBuf = this.ac.createBuffer(1, len, this.ac.sampleRate);
        const d = this.noiseBuf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      } catch {
        this.ac = null;
      }
    }
    if (this.ac && this.ac.state === "suspended") void this.ac.resume();
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.master && this.ac) {
      this.master.gain.setTargetAtTime(m ? 0 : 0.5, this.ac.currentTime, 0.01);
    }
  }

  private tone(opts: {
    f0: number;
    f1?: number;
    dur: number;
    type?: OscillatorType;
    vol?: number;
    delay?: number;
  }) {
    if (!this.ac || !this.master || this.muted) return;
    try {
      const t0 = this.ac.currentTime + (opts.delay ?? 0);
      const o = this.ac.createOscillator();
      o.type = opts.type ?? "square";
      o.frequency.setValueAtTime(Math.max(1, opts.f0), t0);
      if (opts.f1) {
        o.frequency.exponentialRampToValueAtTime(Math.max(1, opts.f1), t0 + opts.dur);
      }
      const g = this.ac.createGain();
      g.gain.setValueAtTime(opts.vol ?? 0.15, t0);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + opts.dur);
      o.connect(g);
      g.connect(this.master);
      o.start(t0);
      o.stop(t0 + opts.dur + 0.03);
    } catch {
      /* never break gameplay for audio */
    }
  }

  private noise(
    dur: number,
    vol: number,
    freq: number,
    delay = 0,
    type: BiquadFilterType = "lowpass",
  ) {
    if (!this.ac || !this.master || !this.noiseBuf || this.muted) return;
    try {
      const t0 = this.ac.currentTime + delay;
      const src = this.ac.createBufferSource();
      src.buffer = this.noiseBuf;
      const f = this.ac.createBiquadFilter();
      f.type = type;
      f.frequency.value = freq;
      const g = this.ac.createGain();
      g.gain.setValueAtTime(vol, t0);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      src.connect(f);
      f.connect(g);
      g.connect(this.master);
      src.start(t0);
      src.stop(t0 + dur + 0.03);
    } catch {
      /* ignore */
    }
  }

  pistol() {
    this.tone({ f0: 560, f1: 130, dur: 0.09, vol: 0.2 });
    this.noise(0.07, 0.22, 2600);
  }
  smg() {
    this.tone({ f0: 780, f1: 230, dur: 0.05, vol: 0.12 });
    this.noise(0.04, 0.12, 3400);
  }
  shotgun() {
    this.noise(0.24, 0.5, 850);
    this.tone({ f0: 150, f1: 42, dur: 0.2, type: "triangle", vol: 0.4 });
  }
  hit() {
    this.tone({ f0: 330, f1: 190, dur: 0.045, type: "sawtooth", vol: 0.07 });
  }
  kill() {
    this.tone({ f0: 460, f1: 70, dur: 0.18, vol: 0.16 });
    this.noise(0.12, 0.14, 1800);
  }
  coin() {
    this.tone({ f0: 940, dur: 0.06, type: "sine", vol: 0.14 });
    this.tone({ f0: 1400, dur: 0.12, type: "sine", vol: 0.14, delay: 0.06 });
  }
  ammo() {
    this.tone({ f0: 240, dur: 0.05, type: "triangle", vol: 0.16 });
    this.tone({ f0: 370, dur: 0.07, type: "triangle", vol: 0.14, delay: 0.06 });
  }
  dry() {
    this.tone({ f0: 190, dur: 0.03, vol: 0.08 });
    this.tone({ f0: 140, dur: 0.03, vol: 0.08, delay: 0.045 });
  }
  reloadStart() {
    this.tone({ f0: 500, dur: 0.04, vol: 0.1 });
    this.tone({ f0: 690, dur: 0.05, vol: 0.1, delay: 0.12 });
  }
  reloadEnd() {
    this.tone({ f0: 620, dur: 0.04, vol: 0.12 });
    this.tone({ f0: 930, dur: 0.06, vol: 0.12, delay: 0.07 });
  }
  switchWeapon() {
    this.tone({ f0: 340, f1: 540, dur: 0.06, type: "triangle", vol: 0.12 });
  }
  wave() {
    [392, 523, 659, 784].forEach((f, i) =>
      this.tone({ f0: f, dur: 0.14, vol: 0.1, delay: i * 0.09 }),
    );
  }
  waveClear() {
    [523, 659, 784, 1046].forEach((f, i) =>
      this.tone({ f0: f, dur: 0.16, type: "triangle", vol: 0.12, delay: i * 0.08 }),
    );
  }
  hurt() {
    this.tone({ f0: 170, f1: 55, dur: 0.25, type: "sawtooth", vol: 0.3 });
    this.noise(0.16, 0.2, 600);
  }
  gameOver() {
    [330, 262, 196, 131].forEach((f, i) =>
      this.tone({ f0: f, dur: 0.3, type: "triangle", vol: 0.16, delay: i * 0.18 }),
    );
  }
  spawn() {
    this.tone({ f0: 200, f1: 350, dur: 0.08, type: "sine", vol: 0.045 });
  }
  click() {
    this.tone({ f0: 700, f1: 500, dur: 0.05, type: "triangle", vol: 0.1 });
  }
}
