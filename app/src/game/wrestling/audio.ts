let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let sfx: GainNode | null = null;
let muted = false;

export function unlockWrestlingAudio() {
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!ctx) {
    ctx = new AC({ latencyHint: "interactive" });
    master = ctx.createGain();
    sfx = ctx.createGain();
    sfx.connect(master);
    master.connect(ctx.destination);
    master.gain.value = 0.7;
    sfx.gain.value = 0.85;
  }
  if (ctx.state === "suspended") void ctx.resume();
}

export function setWrestlingMuted(v: boolean) {
  muted = v;
  if (master && ctx) master.gain.setTargetAtTime(v ? 0 : 0.7, ctx.currentTime, 0.03);
}

export function isWrestlingMuted() {
  return muted;
}

function beep(freq: number, dur: number, type: OscillatorType, gain = 0.12, slide = 0) {
  if (!ctx || !sfx || muted) return;
  const t0 = ctx.currentTime;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t0 + dur);
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g);
  g.connect(sfx);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

function noiseBurst(dur: number, gain = 0.08, hp = 400) {
  if (!ctx || !sfx || muted) return;
  const n = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
  const data = n.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = n;
  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = hp;
  const g = ctx.createGain();
  const t0 = ctx.currentTime;
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(filter);
  filter.connect(g);
  g.connect(sfx);
  src.start(t0);
  src.stop(t0 + dur + 0.02);
}

export function playCue(kind: string, intensity = 0.6) {
  unlockWrestlingAudio();
  const i = Math.max(0.2, Math.min(1, intensity));
  switch (kind) {
    case "bell":
      beep(880, 0.18, "sine", 0.16);
      beep(660, 0.22, "sine", 0.1);
      break;
    case "smash":
    case "move":
      noiseBurst(0.12, 0.1 * i, 220);
      beep(90 + i * 40, 0.14, "square", 0.08 * i, -40);
      break;
    case "super":
    case "finisher":
      beep(140, 0.28, "sawtooth", 0.12, -80);
      noiseBurst(0.22, 0.14, 180);
      beep(420, 0.18, "triangle", 0.06);
      break;
    case "kickout":
      beep(200, 0.1, "square", 0.1);
      beep(320, 0.12, "square", 0.08);
      break;
    case "pin":
      beep(520, 0.08, "sine", 0.1);
      setTimeout(() => beep(520, 0.08, "sine", 0.1), 220);
      setTimeout(() => beep(780, 0.25, "sine", 0.14), 460);
      break;
    case "crowd":
    case "entrance":
      noiseBurst(0.4, 0.05, 900);
      break;
    case "ko":
    case "celebrate":
      beep(330, 0.2, "triangle", 0.1);
      beep(494, 0.28, "triangle", 0.08);
      noiseBurst(0.35, 0.08, 700);
      break;
    case "reversal":
      beep(240, 0.1, "square", 0.09, 80);
      break;
    default:
      break;
  }
}
