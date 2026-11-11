// The rounds of the show. Every track is one question with four choices, and the
// game checks the answer itself against the song's own artist and title.
//   ask: 'artist' (who performs it) or 'title' (what the song is called)
//   bonus: a title round, which can be switched off under Game options
//   share: how big a slice of the songs this round gets, next to the others

const ROUNDS = [
  {
    id: 'a1', name: 'Name the Artist', ask: 'artist', clipLength: 15, points: 10, code: 'A1', share: 1,
    blurb: 'A 15-second clip. Who is that singing?',
    rules: [
      'A 15-second clip plays. Pick the artist from four choices.',
      'Right answer: +10. With phones, answering fast adds up to +5 more.',
      'A wrong answer scores nothing, so have a guess.',
    ],
  },
  {
    id: 't1', name: 'Title Bonus', ask: 'title', bonus: true, clipLength: 15, points: 15, code: 'A2', share: 0.6,
    blurb: 'Bonus round. This time, name the song.',
    rules: [
      'A bonus round: pick the song title from four choices.',
      'Right answer: +15. With phones, answering fast adds up to +7 more.',
    ],
  },
  {
    id: 'a2', name: 'Quick Fire', ask: 'artist', clipLength: 5, points: 20, code: 'B1', share: 1,
    blurb: 'Only 5 seconds of music. Name the artist, quick.',
    rules: [
      'Just 5 seconds of each song. Pick the artist.',
      'Right answer: +20. With phones, answering fast adds up to +10 more.',
    ],
  },
  {
    id: 't2', name: 'Double Title Bonus', ask: 'title', bonus: true, clipLength: 8, points: 25, code: 'B2', share: 0.6,
    blurb: 'Bonus round. Shorter clips, bigger points. Name the song.',
    rules: [
      'A bonus round with 8-second clips: pick the song title.',
      'Right answer: +25. With phones, answering fast adds up to +12 more.',
    ],
  },
  {
    id: 'final', name: 'The Encore', ask: 'artist', final: true, clipLength: 10, points: 40, code: 'B3', share: 0.4,
    blurb: 'The last few songs are worth the most. Anyone can still win.',
    rules: [
      'The last few songs, with 10-second clips. Pick the artist.',
      'Right answer: +40. With phones, answering fast adds up to +20 more.',
      'Highest score after the Encore wins.',
    ],
  },
];

const HOST_LINES = {
  opening: 'Welcome to Musical Wits, the show where your ears do the thinking! Listen close, pick the artist, and may the best ears win.',
  final: 'It all comes down to the Encore. Big points on every song.',
  closing: 'Congratulations to our champions! Thanks for playing Musical Wits!',
};

// The most a fast answer adds on top of a round's points when everyone plays on phones.
function speedBonus(r) { return Math.floor(r.points / 2); }

// Used to fill out the four choices when the library has too few different artists or titles.
const SPARE_ARTISTS = [
  'The Beatles', 'Queen', 'Madonna', 'Prince', 'ABBA', 'Elvis Presley', 'Stevie Wonder', 'Fleetwood Mac',
  'Whitney Houston', 'David Bowie', 'Aretha Franklin', 'The Rolling Stones', 'Dolly Parton', 'Bob Marley',
  'Elton John', 'Tina Turner', 'Michael Jackson', 'Nirvana', 'Bee Gees', 'Johnny Cash',
];
const SPARE_TITLES = [
  'Midnight Train', 'Dancing in the Rain', 'Summer Nights', 'Heart of Gold', 'One More Time', 'Blue Skies',
  'Take Me Home', 'Fire and Ice', 'Good Vibrations', 'Stand by Me', 'Yesterday', 'River Deep',
];

// With no songs added yet the game plays these built-in tunes, so it works straight away.
function demoSongs() {
  return Object.keys(TUNES).map((id) => ({ title: TUNES[id].name, artist: TUNES[id].artist === 'Traditional' ? '' : TUNES[id].artist, audio: { kind: 'tune', tune: id } }));
}

function sameText(a, b) { return String(a).trim().toLowerCase() === String(b).trim().toLowerCase(); }

function shuffle(list) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

// Four choices for one song: the right answer plus three wrong ones taken from the other songs.
function makeChoices(song, ask, pool) {
  const right = song[ask];
  const wrong = [];
  const add = (text) => {
    if (wrong.length < 3 && text && !sameText(text, right) && !wrong.some((w) => sameText(w, text))) wrong.push(text);
  };
  // For titles, one other song by the same artist makes it a fairer test.
  if (ask === 'title') shuffle(pool.filter((s) => s !== song && sameText(s.artist, song.artist))).slice(0, 1).forEach((s) => add(s.title));
  shuffle(pool.slice()).forEach((s) => add(s[ask]));
  shuffle((ask === 'artist' ? SPARE_ARTISTS : SPARE_TITLES).slice()).forEach(add);
  const choices = shuffle([right, ...wrong]);
  return { choices, correct: choices.indexOf(right) };
}

// Deals a fresh show from the songs: each song is used once at most.
// Songs with no artist can only go in the title rounds.
function dealRounds(songs, opts) {
  const rounds = ROUNDS.filter((r) => opts.titleBonus || !r.bonus);
  const per = opts.perRound || 8;
  const target = {};
  const out = {};
  rounds.forEach((r) => { target[r.id] = Math.max(1, Math.round(per * r.share)); out[r.id] = []; });
  const deck = shuffle(songs.filter((s) => s.title || s.artist));
  const withArtist = deck.filter((s) => s.artist);
  const titleOnly = deck.filter((s) => !s.artist && s.title);
  const take = (r) => {
    const from = r.ask === 'title' && titleOnly.length ? titleOnly : withArtist;
    const song = from.pop();
    if (!song || (r.ask === 'title' && !song.title)) return false;
    out[r.id].push({ title: song.title, artist: song.artist, audio: song.audio, ask: r.ask, ...makeChoices(song, r.ask, deck) });
    return true;
  };
  // Go round the table so a small library still gives every round something.
  let dealt = true;
  while (dealt) {
    dealt = false;
    for (const r of rounds) {
      if (out[r.id].length < target[r.id] && take(r)) dealt = true;
    }
  }
  return out;
}
