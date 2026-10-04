// Plays clips: one or more sources (built-in tune, uploaded file, or web link),
// from a start point, for a set length, optionally reversed or slowed down.

let audioCtx = null;
function getCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

const bufferCache = {};

// Returns { buffer } for anything we can decode, or { url } for a web link
// that the browser will only play through an <audio> element.
async function loadSource(src) {
  if (!src) throw new Error('No audio chosen for this track.');
  if (src.kind === 'tune') return { buffer: await renderTune(src.tune) };
  const key = src.kind + ':' + (src.fileId || src.url);
  if (bufferCache[key]) return bufferCache[key];
  let result;
  if (src.kind === 'file') {
    const blob = await FileStore.get(src.fileId);
    if (!blob) throw new Error('The audio file "' + (src.fileName || '') + '" is missing. Re-add it in Edit Questions.');
    result = { buffer: await getCtx().decodeAudioData(await blob.arrayBuffer()) };
  } else {
    try {
      const res = await fetch(src.url);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      result = { buffer: await getCtx().decodeAudioData(await res.arrayBuffer()) };
    } catch (e) {
      result = { url: src.url };
    }
  }
  bufferCache[key] = result;
  return result;
}

function reverseBuffer(buffer) {
  const ctx = getCtx();
  const out = ctx.createBuffer(buffer.numberOfChannels, buffer.length, buffer.sampleRate);
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    out.getChannelData(c).set(buffer.getChannelData(c).slice().reverse());
  }
  return out;
}

class Clip {
  // opts: { start (s), length (s or null), rate (1 = normal), reverse (bool) }
  constructor(sources, opts = {}) {
    this.sources = sources;
    this.start = opts.start || 0;
    this.length = opts.length || null;
    this.rate = opts.rate || 1;
    this.reverse = !!opts.reverse;
    this.pos = 0;
    this.playing = false;
    this.nodes = [];
    this.onupdate = null;
    this.onend = null;
    this.loaded = null;
  }

  async load() {
    if (!this.loaded) {
      this.loaded = Promise.all(this.sources.map(loadSource)).then((tracks) => {
        this.tracks = tracks.map((t) => (t.buffer && this.reverse ? { buffer: reverseBuffer(t.buffer) } : t));
        const natural = Math.max(...this.tracks.map((t) => (t.buffer ? (t.buffer.duration - this.start) / this.rate : 30)));
        this.duration = Math.max(0.1, this.length ? Math.min(this.length, natural) : natural);
      });
    }
    return this.loaded;
  }

  async play() {
    if (this.playing) return;
    await this.load();
    if (this.pos >= this.duration - 0.05) this.pos = 0;
    const ctx = getCtx();
    const mix = ctx.createGain();
    mix.gain.value = this.tracks.length > 1 ? 0.75 : 1;
    mix.connect(ctx.destination);
    const remaining = this.duration - this.pos;
    for (const t of this.tracks) {
      if (t.buffer) {
        const node = ctx.createBufferSource();
        node.buffer = t.buffer;
        node.playbackRate.value = this.rate;
        node.connect(mix);
        node.start(0, this.start + this.pos * this.rate, remaining * this.rate);
        this.nodes.push({ stop: () => { try { node.stop(); } catch (e) { /* already stopped */ } } });
      } else {
        const el = new Audio(t.url);
        el.playbackRate = this.rate;
        el.currentTime = this.start + this.pos * this.rate;
        el.play().catch((e) => console.warn('Could not play link', e));
        this.nodes.push({ stop: () => el.pause() });
      }
    }
    this.playing = true;
    this.startedAt = ctx.currentTime - this.pos;
    this.timer = setInterval(() => this.tick(), 50);
    this.tick();
  }

  tick() {
    if (!this.playing) return;
    this.pos = Math.min(this.duration, getCtx().currentTime - this.startedAt);
    if (this.onupdate) this.onupdate(this.pos, this.duration);
    if (this.pos >= this.duration) {
      this.halt();
      if (this.onend) this.onend();
    }
  }

  halt() {
    clearInterval(this.timer);
    this.nodes.forEach((n) => n.stop());
    this.nodes = [];
    this.playing = false;
  }

  pause() {
    if (!this.playing) return;
    this.pos = Math.min(this.duration, getCtx().currentTime - this.startedAt);
    this.halt();
    if (this.onupdate) this.onupdate(this.pos, this.duration);
  }

  stop() {
    this.halt();
    this.pos = 0;
    if (this.onupdate) this.onupdate(this.pos, this.duration || 0);
  }
}

// A short "buzz" sound, pitched differently for each team.
function playBuzz(teamIndex) {
  const ctx = getCtx();
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = 'square';
  const base = [330, 415, 494, 587][teamIndex % 4];
  osc.frequency.setValueAtTime(base, ctx.currentTime);
  osc.frequency.linearRampToValueAtTime(base * 1.5, ctx.currentTime + 0.12);
  g.gain.setValueAtTime(0.18, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
  osc.connect(g).connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.36);
}

function playJingle(good) {
  const ctx = getCtx();
  const notes = good ? [523, 659, 784] : [311, 233];
  notes.forEach((f, i) => {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    const t = ctx.currentTime + i * 0.11;
    osc.type = good ? 'triangle' : 'sawtooth';
    osc.frequency.value = f;
    g.gain.setValueAtTime(0.15, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    osc.connect(g).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.31);
  });
}
