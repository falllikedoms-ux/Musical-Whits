// Built-in placeholder tunes.
// Every melody here is a public-domain folk song, hymn or classical piece,
// played by a tiny synthesizer in the browser, so the game works with no audio files.
//
// Notation: NOTE+OCTAVE:BEATS, for example "C4:1" or "F#4:.5". "R:1" is a rest.
// "|" marks the end of a phrase (used by the Lyric Gap round to stop the music).

const TUNES = {
  twinkle: {
    name: 'Twinkle, Twinkle, Little Star', artist: 'Traditional', bpm: 110,
    notes: 'C4:1 C4:1 G4:1 G4:1 A4:1 A4:1 G4:2 | F4:1 F4:1 E4:1 E4:1 D4:1 D4:1 C4:2 | G4:1 G4:1 F4:1 F4:1 E4:1 E4:1 D4:2 | G4:1 G4:1 F4:1 F4:1 E4:1 E4:1 D4:2 |',
  },
  odeToJoy: {
    name: 'Ode to Joy', artist: 'Ludwig van Beethoven', bpm: 120,
    notes: 'E4:1 E4:1 F4:1 G4:1 G4:1 F4:1 E4:1 D4:1 C4:1 C4:1 D4:1 E4:1 E4:1.5 D4:.5 D4:2 | E4:1 E4:1 F4:1 G4:1 G4:1 F4:1 E4:1 D4:1 C4:1 C4:1 D4:1 E4:1 D4:1.5 C4:.5 C4:2 |',
  },
  maryLamb: {
    name: 'Mary Had a Little Lamb', artist: 'Traditional', bpm: 120,
    notes: 'E4:1 D4:1 C4:1 D4:1 E4:1 E4:1 E4:2 | D4:1 D4:1 D4:2 E4:1 G4:1 G4:2 | E4:1 D4:1 C4:1 D4:1 E4:1 E4:1 E4:1 E4:1 D4:1 D4:1 E4:1 D4:1 C4:4 |',
  },
  happyBirthday: {
    name: 'Happy Birthday to You', artist: 'Mildred and Patty Hill', bpm: 100,
    notes: 'G3:.75 G3:.25 A3:1 G3:1 C4:1 B3:2 | G3:.75 G3:.25 A3:1 G3:1 D4:1 C4:2 | G3:.75 G3:.25 G4:1 E4:1 C4:1 B3:1 A3:2 | F4:.75 F4:.25 E4:1 C4:1 D4:1 C4:2 |',
  },
  frereJacques: {
    name: 'Frère Jacques', artist: 'Traditional', bpm: 120,
    notes: 'C4:1 D4:1 E4:1 C4:1 C4:1 D4:1 E4:1 C4:1 | E4:1 F4:1 G4:2 E4:1 F4:1 G4:2 | G4:.5 A4:.5 G4:.5 F4:.5 E4:1 C4:1 G4:.5 A4:.5 G4:.5 F4:.5 E4:1 C4:1 | C4:1 G3:1 C4:2 C4:1 G3:1 C4:2 |',
  },
  jingleBells: {
    name: 'Jingle Bells', artist: 'James Lord Pierpont', bpm: 150,
    notes: 'E4:1 E4:1 E4:2 E4:1 E4:1 E4:2 E4:1 G4:1 C4:1.5 D4:.5 E4:4 | F4:1 F4:1 F4:1.5 F4:.5 F4:1 E4:1 E4:1 E4:.5 E4:.5 E4:1 D4:1 D4:1 E4:1 D4:2 G4:2 | E4:1 E4:1 E4:2 E4:1 E4:1 E4:2 E4:1 G4:1 C4:1.5 D4:.5 E4:4 | F4:1 F4:1 F4:1.5 F4:.5 F4:1 E4:1 E4:1 E4:.5 E4:.5 G4:1 G4:1 F4:1 D4:1 C4:4 |',
  },
  rowYourBoat: {
    name: 'Row, Row, Row Your Boat', artist: 'Traditional', bpm: 130,
    notes: 'C4:1.5 C4:1.5 C4:1 D4:.5 E4:1.5 | E4:1 D4:.5 E4:1 F4:.5 G4:3 | C5:.5 C5:.5 C5:.5 G4:.5 G4:.5 G4:.5 E4:.5 E4:.5 E4:.5 C4:.5 C4:.5 C4:.5 | G4:1 F4:.5 E4:1 D4:.5 C4:3 |',
  },
  furElise: {
    name: 'Für Elise', artist: 'Ludwig van Beethoven', bpm: 130,
    notes: 'E5:.5 D#5:.5 E5:.5 D#5:.5 E5:.5 B4:.5 D5:.5 C5:.5 A4:1.5 | C4:.5 E4:.5 A4:.5 B4:1.5 | E4:.5 G#4:.5 B4:.5 C5:1.5 | E4:.5 E5:.5 D#5:.5 E5:.5 D#5:.5 E5:.5 B4:.5 D5:.5 C5:.5 A4:1.5 | C4:.5 E4:.5 A4:.5 B4:1.5 | E4:.5 C5:.5 B4:.5 A4:2 |',
  },
  mountainKing: {
    name: 'In the Hall of the Mountain King', artist: 'Edvard Grieg', bpm: 150,
    notes: 'B3:.5 C#4:.5 D4:.5 E4:.5 F#4:.5 D4:.5 F#4:1 | F4:.5 C#4:.5 F4:1 E4:.5 C4:.5 E4:1 | B3:.5 C#4:.5 D4:.5 E4:.5 F#4:.5 D4:.5 F#4:.5 B4:.5 | A4:.5 F#4:.5 D4:.5 F#4:.5 A4:2 |',
  },
  greensleeves: {
    name: 'Greensleeves', artist: 'Traditional', bpm: 150,
    notes: 'A4:1 C5:2 D5:1 E5:1.5 F5:.5 E5:1 D5:2 B4:1 G4:1.5 A4:.5 B4:1 | C5:2 A4:1 A4:1.5 G#4:.5 A4:1 B4:2 G#4:1 E4:2 | A4:1 C5:2 D5:1 E5:1.5 F5:.5 E5:1 D5:2 B4:1 G4:1.5 A4:.5 B4:1 | C5:1.5 B4:.5 A4:1 G#4:1.5 F#4:.5 G#4:1 A4:3 |',
  },
  amazingGrace: {
    name: 'Amazing Grace', artist: 'John Newton (hymn)', bpm: 90,
    notes: 'G3:1 C4:2 E4:.5 C4:.5 E4:2 D4:1 C4:2 A3:1 G3:2 | G3:1 C4:2 E4:.5 C4:.5 E4:2 D4:1 G4:3 |',
  },
  auldLangSyne: {
    name: 'Auld Lang Syne', artist: 'Robert Burns (traditional)', bpm: 100,
    notes: 'G3:1 C4:1.5 C4:.5 C4:1 E4:1 D4:1.5 C4:.5 D4:1 E4:.5 D4:.5 | C4:1.5 C4:.5 E4:1 G4:1 A4:3 | A4:1 G4:1.5 E4:.5 E4:1 C4:1 D4:1.5 C4:.5 D4:1 E4:.5 D4:.5 | C4:1.5 A3:.5 A3:1 G3:1 C4:3 |',
  },
  ohSusanna: {
    name: 'Oh! Susanna', artist: 'Stephen Foster', bpm: 140,
    notes: 'C4:.5 D4:.5 E4:1 G4:1 G4:1.5 A4:.5 G4:1 E4:1 C4:1.5 D4:.5 E4:1 E4:1 D4:1 C4:1 D4:3 | C4:.5 D4:.5 E4:1 G4:1 G4:1.5 A4:.5 G4:1 E4:1 C4:1.5 D4:.5 E4:1 E4:1 D4:1 D4:1 C4:3 |',
  },
  londonBridge: {
    name: 'London Bridge Is Falling Down', artist: 'Traditional', bpm: 120,
    notes: 'G4:1.5 A4:.5 G4:1 F4:1 E4:1 F4:1 G4:2 | D4:1 E4:1 F4:2 E4:1 F4:1 G4:2 | G4:1.5 A4:.5 G4:1 F4:1 E4:1 F4:1 G4:2 | D4:2 G4:2 E4:1 C4:3 |',
  },
  saints: {
    name: 'When the Saints Go Marching In', artist: 'Traditional', bpm: 140,
    notes: 'C4:1 E4:1 F4:1 G4:4 | C4:1 E4:1 F4:1 G4:4 | C4:1 E4:1 F4:1 G4:2 E4:2 C4:2 E4:2 D4:4 | E4:1 E4:1 D4:1 C4:3 C4:1 E4:2 G4:2 G4:1 F4:3 | E4:1 F4:1 G4:2 E4:2 C4:2 D4:2 C4:4 |',
  },
  oldMacDonald: {
    name: 'Old MacDonald Had a Farm', artist: 'Traditional', bpm: 130,
    notes: 'C4:1 C4:1 C4:1 G3:1 A3:1 A3:1 G3:2 | E4:1 E4:1 D4:1 D4:1 C4:3 | G3:1 C4:1 C4:1 C4:1 G3:1 A3:1 A3:1 G3:2 | E4:1 E4:1 D4:1 D4:1 C4:3 |',
  },
  turkishMarch: {
    name: 'Rondo alla Turca (Turkish March)', artist: 'Wolfgang Amadeus Mozart', bpm: 120,
    notes: 'B4:.25 A4:.25 G#4:.25 A4:.25 C5:1 | D5:.25 C5:.25 B4:.25 C5:.25 E5:1 | F5:.25 E5:.25 D#5:.25 E5:.25 B5:.25 A5:.25 G#5:.25 A5:.25 B5:.25 A5:.25 G#5:.25 A5:.25 C6:2 |',
  },
  eineKleine: {
    name: 'Eine kleine Nachtmusik', artist: 'Wolfgang Amadeus Mozart', bpm: 130,
    notes: 'G4:1 R:.5 D4:.5 G4:1 R:.5 D4:.5 G4:.5 D4:.5 G4:.5 B4:.5 D5:2 | C5:1 R:.5 A4:.5 C5:1 R:.5 A4:.5 C5:.5 A4:.5 F#4:.5 A4:.5 D4:2 |',
  },
  scarborough: {
    name: 'Scarborough Fair', artist: 'Traditional', bpm: 130,
    notes: 'D4:2 D4:1 A4:2 A4:1 E4:1.5 F4:.5 E4:1 D4:3 | A4:1 C5:2 D5:1 C5:2 A4:1 B4:1 G4:1 A4:3 |',
  },
};

const SEMITONES = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

function parseTune(tune) {
  const notes = [];
  const phraseEnds = [];
  const beat = 60 / tune.bpm;
  let t = 0;
  for (const tok of tune.notes.trim().split(/\s+/)) {
    if (tok === '|') { phraseEnds.push(t); continue; }
    const [pitch, beats] = tok.split(':');
    const dur = parseFloat(beats) * beat;
    if (pitch !== 'R') {
      const m = pitch.match(/^([A-G])([#b]?)(\d)$/);
      let midi = 12 * (parseInt(m[3], 10) + 1) + SEMITONES[m[1]];
      if (m[2] === '#') midi += 1;
      if (m[2] === 'b') midi -= 1;
      notes.push({ t, dur, freq: 440 * Math.pow(2, (midi - 69) / 12) });
    }
    t += dur;
  }
  return { notes, phraseEnds, length: t };
}

// Seconds from the start of a tune to the end of its Nth phrase (1-based).
function tunePhraseEnd(tuneId, phrase) {
  const p = parseTune(TUNES[tuneId]);
  return p.phraseEnds[phrase - 1] ?? p.length;
}

const tuneCache = {};

// Renders a tune into an AudioBuffer (cached), so it plays like any audio file.
function renderTune(tuneId) {
  if (tuneCache[tuneId]) return tuneCache[tuneId];
  const { notes, length } = parseTune(TUNES[tuneId]);
  const rate = 44100;
  const ctx = new OfflineAudioContext(1, Math.ceil((length + 0.5) * rate), rate);
  const master = ctx.createGain();
  master.gain.value = 0.35;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 3500;
  master.connect(filter).connect(ctx.destination);
  for (const n of notes) {
    const end = n.t + Math.max(0.08, n.dur - 0.04);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, n.t);
    env.gain.linearRampToValueAtTime(1, n.t + 0.015);
    env.gain.exponentialRampToValueAtTime(0.55, n.t + 0.2);
    env.gain.setValueAtTime(0.55, end - 0.03);
    env.gain.linearRampToValueAtTime(0, end);
    env.connect(master);
    const voices = [['triangle', 1, 1], ['sine', 2, 0.25], ['square', 1, 0.05]];
    for (const [type, mult, vol] of voices) {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = type;
      osc.frequency.value = n.freq * mult;
      g.gain.value = vol;
      osc.connect(g).connect(env);
      osc.start(n.t);
      osc.stop(end + 0.01);
    }
  }
  tuneCache[tuneId] = ctx.startRendering();
  return tuneCache[tuneId];
}
