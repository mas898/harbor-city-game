// All sound is synthesized with WebAudio: effects from oscillators and
// filtered noise, plus a slow procedural music loop. Nothing is loaded
// from a file. Audio starts on the first user gesture; until then every
// call is a safe no-op.

const CHORDS = [
  [220.0, 261.63, 329.63], // A minor
  [174.61, 220.0, 261.63], // F
  [196.0, 246.94, 293.66], // G
  [164.81, 220.0, 261.63], // E-ish colour
];

export class AudioSys {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.muted = false;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.musicTimer = null;
    this.chordIndex = 0;
    this.started = false;
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === "suspended") this.ctx.resume();
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.5;
      this.master.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.16;
      this.musicGain.connect(this.master);
      this.started = true;
      this.startMusic();
      return true;
    } catch (err) {
      return false;
    }
  }

  setMuted(m) {
    this.muted = m;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(m ? 0 : 0.5, this.ctx.currentTime, 0.05);
    }
  }

  tone(freq, dur, type, vol, slideTo) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type || "sine";
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  noise(dur, vol, filterFreq, type) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filt = this.ctx.createBiquadFilter();
    filt.type = type || "lowpass";
    filt.frequency.value = filterFreq || 1200;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(filt);
    filt.connect(g);
    g.connect(this.master);
    src.start(t);
  }

  shoot() { this.noise(0.14, 0.5, 2600, "highpass"); this.tone(160, 0.1, "square", 0.18, 60); }
  punch() { this.noise(0.08, 0.4, 500); this.tone(90, 0.08, "sine", 0.3, 50); }
  hit() { this.tone(220, 0.09, "triangle", 0.25, 120); }
  crash() { this.noise(0.3, 0.55, 700); this.tone(70, 0.25, "sawtooth", 0.25, 35); }
  reload() { this.tone(700, 0.06, "square", 0.08); setTimeout(() => this.tone(950, 0.06, "square", 0.08), 260); }
  pickup() { this.tone(660, 0.09, "sine", 0.22); setTimeout(() => this.tone(990, 0.12, "sine", 0.22), 80); }
  cash() {
    this.tone(880, 0.09, "triangle", 0.2);
    setTimeout(() => this.tone(1174.66, 0.09, "triangle", 0.2), 90);
    setTimeout(() => this.tone(1567.98, 0.16, "triangle", 0.2), 180);
  }
  missionDone() {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((n, i) => setTimeout(() => this.tone(n, 0.22, "triangle", 0.22), i * 110));
  }
  busted() { this.tone(392, 0.3, "sawtooth", 0.16, 196); setTimeout(() => this.tone(311, 0.4, "sawtooth", 0.16, 155), 300); }
  horn() { this.tone(370, 0.28, "square", 0.1); this.tone(466, 0.28, "square", 0.08); }
  click() { this.tone(520, 0.05, "sine", 0.14); }
  door() { this.noise(0.07, 0.3, 900); }
  step() { this.noise(0.04, 0.05, 400); }

  setEngine(speedFrac, driving) {
    if (!this.ctx) return;
    if (!driving || speedFrac < 0.03) {
      if (this.engineGain) this.engineGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
      return;
    }
    if (!this.engineOsc) {
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = "sawtooth";
      const filt = this.ctx.createBiquadFilter();
      filt.type = "lowpass";
      filt.frequency.value = 420;
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0;
      this.engineOsc.connect(filt);
      filt.connect(this.engineGain);
      this.engineGain.connect(this.master);
      this.engineOsc.start();
    }
    this.engineOsc.frequency.setTargetAtTime(55 + speedFrac * 130, this.ctx.currentTime, 0.08);
    this.engineGain.gain.setTargetAtTime(0.05 + speedFrac * 0.05, this.ctx.currentTime, 0.08);
  }

  setSiren(on) {
    if (!this.ctx) return;
    if (!on) {
      if (this.sirenGain) this.sirenGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.2);
      return;
    }
    if (!this.sirenOsc) {
      this.sirenOsc = this.ctx.createOscillator();
      this.sirenOsc.type = "triangle";
      this.sirenOsc.frequency.value = 700;
      const lfo = this.ctx.createOscillator();
      lfo.frequency.value = 0.7;
      const lfoGain = this.ctx.createGain();
      lfoGain.gain.value = 220;
      lfo.connect(lfoGain);
      lfoGain.connect(this.sirenOsc.frequency);
      this.sirenGain = this.ctx.createGain();
      this.sirenGain.gain.value = 0;
      this.sirenOsc.connect(this.sirenGain);
      this.sirenGain.connect(this.master);
      this.sirenOsc.start();
      lfo.start();
    }
    this.sirenGain.gain.setTargetAtTime(0.05, this.ctx.currentTime, 0.3);
  }

  startMusic() {
    if (this.musicTimer || !this.ctx) return;
    const playChord = () => {
      if (!this.ctx) return;
      const chord = CHORDS[this.chordIndex % CHORDS.length];
      this.chordIndex += 1;
      const t = this.ctx.currentTime;
      chord.forEach((f, i) => {
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = "triangle";
        osc.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.12, t + 0.4 + i * 0.12);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 3.4);
        osc.connect(g);
        g.connect(this.musicGain);
        osc.start(t);
        osc.stop(t + 3.6);
      });
      // Soft bass pulse on the root.
      const bass = this.ctx.createOscillator();
      const bg = this.ctx.createGain();
      bass.type = "sine";
      bass.frequency.value = chord[0] / 2;
      bg.gain.setValueAtTime(0.0001, t);
      bg.gain.exponentialRampToValueAtTime(0.14, t + 0.2);
      bg.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
      bass.connect(bg);
      bg.connect(this.musicGain);
      bass.start(t);
      bass.stop(t + 1.8);
    };
    playChord();
    this.musicTimer = setInterval(playChord, 3600);
  }
}
