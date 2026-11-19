// DEAD SIGNAL - procedural WebAudio sound design (no audio files)
'use strict';
const SFX = (() => {
  let ctx = null, master, music, sfxBus, noiseBuf, humGain, humFilter, droneGain, staticGain, staticFilter, heartT = 0;
  let volume = 0.8;
  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = volume; master.connect(ctx.destination);
    // light reverb-ish feedback delay for the facility
    const dly = ctx.createDelay(1); dly.delayTime.value = 0.13; const fb = ctx.createGain(); fb.gain.value = 0.32; const dlp = ctx.createBiquadFilter(); dlp.type = 'lowpass'; dlp.frequency.value = 1800;
    sfxBus = ctx.createGain(); sfxBus.connect(master); sfxBus.connect(dly); dly.connect(dlp); dlp.connect(fb); fb.connect(dly); dlp.connect(master);
    music = ctx.createGain(); music.connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    // electrical hum (lights)
    humFilter = ctx.createBiquadFilter(); humFilter.type = 'lowpass'; humFilter.frequency.value = 380;
    humGain = ctx.createGain(); humGain.gain.value = 0.05; humFilter.connect(humGain); humGain.connect(music);
    [60, 120, 180.5].forEach((f, i) => { const o = ctx.createOscillator(); o.type = i ? 'sine' : 'sawtooth'; o.frequency.value = f; const g = ctx.createGain(); g.gain.value = [0.5, 0.3, 0.12][i]; o.connect(g); g.connect(humFilter); o.start(); });
    // dark drone with slow LFO
    droneGain = ctx.createGain(); droneGain.gain.value = 0.06; droneGain.connect(music);
    const dl = ctx.createBiquadFilter(); dl.type = 'lowpass'; dl.frequency.value = 240; dl.connect(droneGain);
    [36.7, 37.3, 55.2, 73.9].forEach(f => { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.connect(dl); o.start(); });
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07; const lg = ctx.createGain(); lg.gain.value = 120; lfo.connect(lg); lg.connect(dl.frequency); lfo.start();
    // radio static bed (gain driven while radio speaks)
    const sn = ctx.createBufferSource(); sn.buffer = noiseBuf; sn.loop = true;
    staticFilter = ctx.createBiquadFilter(); staticFilter.type = 'bandpass'; staticFilter.frequency.value = 2400; staticFilter.Q.value = 0.7;
    staticGain = ctx.createGain(); staticGain.gain.value = 0; sn.connect(staticFilter); staticFilter.connect(staticGain); staticGain.connect(master); sn.start();
  }
  const now = () => ctx.currentTime;
  function env(g, t, a, peak, dec) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec); }
  function noise(dur, type, freq, q, peak, dest, a = 0.003, t0 = 0) {
    if (!ctx) return; const t = now() + t0; const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.playbackRate.value = 0.7 + Math.random() * 0.6;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q || 1; const g = ctx.createGain(); env(g, t, a, peak, dur);
    s.connect(f); f.connect(g); g.connect(dest || sfxBus); s.start(t, Math.random()); s.stop(t + a + dur + 0.05); return f;
  }
  function tone(type, f0, f1, dur, peak, dest, t0 = 0, a = 0.005) {
    if (!ctx) return; const t = now() + t0; const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur); const g = ctx.createGain(); env(g, t, a, peak, dur);
    o.connect(g); g.connect(dest || sfxBus); o.start(t); o.stop(t + a + dur + 0.05); return o;
  }
  return {
    init, get ready() { return !!ctx; },
    setVolume(v) { volume = v; if (master) master.gain.value = v; },
    setLights(level) { if (!ctx) return; humGain.gain.setTargetAtTime(0.05 * level, now(), 0.05); },
    setTension(x) { if (!ctx) return; droneGain.gain.setTargetAtTime(0.05 + x * 0.12, now(), 0.4); },
    step(run) { noise(0.07, 'lowpass', run ? 520 : 380, 1, run ? 0.28 : 0.18); noise(0.03, 'highpass', 3000, 1, 0.03); },
    shot() { noise(0.25, 'lowpass', 2200, 0.8, 0.9); tone('square', 140, 40, 0.18, 0.5); noise(0.06, 'highpass', 4000, 1, 0.3); },
    empty() { tone('square', 1800, 1700, 0.02, 0.15); },
    reload() { tone('square', 900, 700, 0.03, 0.12, null, 0.1); tone('square', 600, 500, 0.04, 0.15, null, 0.7); tone('square', 1300, 1200, 0.03, 0.15, null, 1.1); },
    click() { tone('square', 2400, 2000, 0.02, 0.1); },
    pickup() { [660, 880, 1320].forEach((f, i) => tone('triangle', f, f, 0.15, 0.18, null, i * 0.07)); },
    key() { [392, 523, 659, 784].forEach((f, i) => tone('sine', f, f, 0.5, 0.2, null, i * 0.11)); noise(0.6, 'bandpass', 3000, 4, 0.05); },
    hurt() { noise(0.3, 'lowpass', 700, 1, 0.7); tone('sawtooth', 200, 60, 0.3, 0.3); },
    hit() { noise(0.12, 'bandpass', 900, 2, 0.4); },
    growl(vol = 0.3) { const f = noise(0.8, 'lowpass', 300, 6, vol, null, 0.1); if (f) f.frequency.exponentialRampToValueAtTime(120, now() + 0.8); tone('sawtooth', 70, 50, 0.8, vol * 0.4, null, 0, 0.1); },
    enemyDie() { noise(0.5, 'lowpass', 500, 2, 0.5); tone('sawtooth', 120, 30, 0.5, 0.3); },
    door() { const f = noise(1.2, 'lowpass', 200, 3, 0.4, null, 0.2); if (f) f.frequency.exponentialRampToValueAtTime(1200, now() + 1.2); tone('sine', 50, 45, 1.2, 0.3); },
    denied() { tone('square', 220, 220, 0.12, 0.15); tone('square', 165, 165, 0.2, 0.15, null, 0.15); },
    stinger() { // the Witness moved
      if (!ctx) return; [311, 329.6, 466, 622, 659].forEach((f, i) => tone('sawtooth', f, f * 0.97, 1.4, 0.06, null, 0, 0.02 + i * 0.01));
      noise(1.0, 'highpass', 5000, 1, 0.12, null, 0.01); tone('sine', 40, 30, 1.5, 0.6, null, 0, 0.01);
    },
    whisper() { noise(1.5, 'bandpass', 1800 + Math.random() * 1500, 8, 0.08, null, 0.4); },
    powerDown() { tone('sawtooth', 160, 18, 1.6, 0.5); noise(0.4, 'lowpass', 300, 1, 0.8, null, 0.002, 0.05); tone('sine', 55, 30, 2.5, 0.6, null, 0.05); },
    powerUp() { const o = tone('sawtooth', 30, 120, 1.4, 0.25, null, 0, 0.6); noise(0.08, 'bandpass', 2500, 2, 0.4, null, 0.002, 1.2); noise(0.05, 'bandpass', 2500, 2, 0.4, null, 0.002, 1.45); },
    flicker() { noise(0.05, 'bandpass', 3000 + Math.random() * 2000, 3, 0.12); },
    heartbeat(rate) { heartT -= 0; tone('sine', 60, 40, 0.15, 0.6); tone('sine', 55, 38, 0.15, 0.45, null, 0.22); },
    radioOn(on) { if (!ctx) return; staticGain.gain.setTargetAtTime(on ? 0.07 : 0, now(), on ? 0.02 : 0.2); },
    radioBurst() { noise(0.25, 'bandpass', 2000, 0.6, 0.35); tone('square', 1200, 1100, 0.04, 0.08); },
    // voice-like blips: a pulse source through two formant filters, one syllable per call
    syllable(pitch = 1, wrong = false) {
      if (!ctx) return; const t = now(); const dur = 0.06 + Math.random() * 0.08;
      const o = ctx.createOscillator(); o.type = 'sawtooth'; const base = (wrong ? 78 : 118) * pitch * (0.9 + Math.random() * 0.25);
      o.frequency.setValueAtTime(base, t); o.frequency.linearRampToValueAtTime(base * (0.85 + Math.random() * 0.3), t + dur);
      const vowels = [[730, 1090], [270, 2290], [300, 870], [530, 1840], [640, 1190]]; const v = vowels[(Math.random() * vowels.length) | 0];
      const g = ctx.createGain(); env(g, t, 0.01, wrong ? 0.22 : 0.16, dur);
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 350; // radio band
      v.forEach(fr => { const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = fr; f.Q.value = 6; o.connect(f); f.connect(hp); });
      const ws = ctx.createWaveShaper(); const c = new Float32Array(256); for (let i = 0; i < 256; i++) { const x = i / 128 - 1; c[i] = Math.tanh(x * 4); } ws.curve = c;
      hp.connect(ws); ws.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.05);
    },
    ending() { [130.8, 155.6, 196, 233].forEach((f, i) => tone('sine', f, f, 5, 0.12, null, i * 0.6, 1.5)); },
    _ctx: () => ctx,
  };
})();
