// Procedural sound: one job, the aeroplane's voice, made from oscillators.
// No audio files: the engine is a detuned sawtooth pair through a low-pass,
// the wind is filtered noise that grows with speed, and events are short
// blips. Everything starts on the first user gesture.

export function createAudio() {
  let ctx = null;
  let engine = null;
  let engineGain = null;
  let wind = null;
  let windGain = null;
  let windFilter = null;
  let muted = false;
  let started = false;

  function start() {
    if (started) return;
    started = true;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch {
      return;
    }
    // Engine: two saws a few cents apart, low-passed, pitch follows throttle.
    engineGain = ctx.createGain();
    engineGain.gain.value = 0;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    filter.Q.value = 2;
    engine = [ctx.createOscillator(), ctx.createOscillator()];
    engine[0].type = 'sawtooth';
    engine[1].type = 'sawtooth';
    engine[0].frequency.value = 62;
    engine[1].frequency.value = 62.7;
    engine[0].connect(filter);
    engine[1].connect(filter);
    filter.connect(engineGain);
    engineGain.connect(ctx.destination);
    engine[0].start();
    engine[1].start();
    // Wind: looped noise through a band-pass that opens with speed.
    const len = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;
    wind = ctx.createBufferSource();
    wind.buffer = buffer;
    wind.loop = true;
    windFilter = ctx.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.value = 500;
    windFilter.Q.value = 0.6;
    windGain = ctx.createGain();
    windGain.gain.value = 0;
    wind.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(ctx.destination);
    wind.start();
  }

  function update(throttle, speed, airborne) {
    if (!ctx || muted) return;
    const t = ctx.currentTime;
    const rpm = 50 + throttle * 70 + speed * 0.25;
    engine[0].frequency.setTargetAtTime(rpm, t, 0.1);
    engine[1].frequency.setTargetAtTime(rpm * 1.011, t, 0.1);
    engineGain.gain.setTargetAtTime(airborne ? 0.05 + throttle * 0.075 : 0.03 + throttle * 0.04, t, 0.15);
    windFilter.frequency.setTargetAtTime(300 + speed * 9, t, 0.2);
    windGain.gain.setTargetAtTime(Math.min(0.16, speed * 0.0016), t, 0.2);
  }

  function blip(freq, dur, type, vol, when = 0) {
    if (!ctx || muted) return;
    const t = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  return {
    start,
    update,
    ring() {
      blip(880, 0.35, 'sine', 0.22);
      blip(1318, 0.4, 'sine', 0.16, 0.07);
    },
    land() {
      blip(180, 0.25, 'triangle', 0.25);
      blip(90, 0.4, 'sine', 0.2, 0.05);
    },
    crash() {
      blip(70, 0.7, 'sawtooth', 0.3);
      blip(45, 0.9, 'square', 0.18, 0.08);
    },
    click() {
      blip(660, 0.08, 'sine', 0.12);
    },
    toggleMute() {
      muted = !muted;
      if (ctx) {
        const t = ctx.currentTime;
        if (engineGain) engineGain.gain.setTargetAtTime(muted ? 0 : 0.05, t, 0.05);
        if (windGain) windGain.gain.setTargetAtTime(0, t, 0.05);
      }
      return muted;
    },
  };
}
