// WebAudio 合成音效：引擎、漂移胎噪、氮气、碰撞、倒计时
export class Sfx {
  constructor() { this.ctx = null; this.muted = false; }
  init() {
    if (this.ctx) return;
    const C = this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.master = C.createGain(); this.master.gain.value = .5; this.master.connect(C.destination);
    // 引擎
    this.engGain = C.createGain(); this.engGain.gain.value = 0;
    const lp = C.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
    this.o1 = C.createOscillator(); this.o1.type = 'sawtooth';
    this.o2 = C.createOscillator(); this.o2.type = 'square';
    const g2 = C.createGain(); g2.gain.value = .35;
    this.o1.connect(lp); this.o2.connect(g2).connect(lp); lp.connect(this.engGain).connect(this.master);
    this.o1.start(); this.o2.start();
    // 噪声
    const buf = C.createBuffer(1, C.sampleRate * 2, C.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.noise = buf;
    const n = C.createBufferSource(); n.buffer = buf; n.loop = true;
    const bp = C.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2400; bp.Q.value = 6;
    this.skidGain = C.createGain(); this.skidGain.gain.value = 0;
    n.connect(bp).connect(this.skidGain).connect(this.master); n.start();
    const n2 = C.createBufferSource(); n2.buffer = buf; n2.loop = true;
    const lp2 = C.createBiquadFilter(); lp2.type = 'lowpass'; lp2.frequency.value = 700;
    this.boostGain = C.createGain(); this.boostGain.gain.value = 0;
    n2.connect(lp2).connect(this.boostGain).connect(this.master); n2.start();
  }
  engine(speedRatio, throttle, drifting, boosting) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, f = 55 + speedRatio * 170 + (throttle ? 15 : 0);
    this.o1.frequency.setTargetAtTime(f, t, .05); this.o2.frequency.setTargetAtTime(f * .5, t, .05);
    this.engGain.gain.setTargetAtTime(.1 + speedRatio * .12, t, .1);
    this.skidGain.gain.setTargetAtTime(drifting ? .18 : 0, t, .05);
    this.boostGain.gain.setTargetAtTime(boosting ? .35 : 0, t, .08);
  }
  beep(freq = 660, dur = .18, type = 'square', vol = .3) {
    if (!this.ctx) return;
    const C = this.ctx, o = C.createOscillator(), g = C.createGain();
    o.type = type; o.frequency.value = freq; g.gain.value = vol;
    g.gain.exponentialRampToValueAtTime(.001, C.currentTime + dur);
    o.connect(g).connect(this.master); o.start(); o.stop(C.currentTime + dur);
  }
  whoosh(vol = .6, dur = .7) {
    if (!this.ctx) return;
    const C = this.ctx, s = C.createBufferSource(), f = C.createBiquadFilter(), g = C.createGain();
    s.buffer = this.noise; f.type = 'bandpass'; f.Q.value = 1.2;
    f.frequency.setValueAtTime(300, C.currentTime); f.frequency.exponentialRampToValueAtTime(3500, C.currentTime + dur * .6);
    g.gain.setValueAtTime(vol, C.currentTime); g.gain.exponentialRampToValueAtTime(.001, C.currentTime + dur);
    s.connect(f).connect(g).connect(this.master); s.start(); s.stop(C.currentTime + dur);
  }
  hit(vol = .5) {
    if (!this.ctx) return;
    const C = this.ctx, s = C.createBufferSource(), f = C.createBiquadFilter(), g = C.createGain();
    s.buffer = this.noise; f.type = 'lowpass'; f.frequency.value = 400;
    g.gain.setValueAtTime(vol, C.currentTime); g.gain.exponentialRampToValueAtTime(.001, C.currentTime + .3);
    s.connect(f).connect(g).connect(this.master); s.start(); s.stop(C.currentTime + .3);
    this.beep(90, .2, 'sine', vol * .6);
  }
  toggleMute() { this.muted = !this.muted; if (this.master) this.master.gain.value = this.muted ? 0 : .5; return this.muted; }
}
