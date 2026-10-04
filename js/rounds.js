// The rounds and scoring from docs/musical-guessing-game-show.md.

const ROUNDS = [
  {
    id: 'r1', name: 'Name That Tune', type: 'buzz', clipLength: 15,
    rules: [
      'Listen to the clip (up to 15 seconds) and buzz to name the song.',
      'Correct title: +10. Correct artist as well: +5 bonus.',
      'No penalty for wrong answers in the warm-up, but you are locked out of that track.',
    ],
    options: [
      { label: 'Title + artist', points: 15, kind: 'correct' },
      { label: 'Title only', points: 10, kind: 'correct' },
      { label: 'Wrong', points: 0, kind: 'wrong' },
    ],
  },
  {
    id: 'r2', name: 'Intro Sprint', type: 'sprint', stages: [1, 3, 5], stagePoints: [30, 20, 10], wrongPoints: -5,
    rules: [
      'The host plays the intro in stages: 1 second, then 3 seconds, then 5 seconds.',
      'Correct title after 1 second: +30. After 3 seconds: +20. After 5 seconds: +10.',
      'Wrong answer: -5, and you are locked out of that track.',
    ],
  },
  {
    id: 'r3', name: 'Lyric Gap', type: 'buzz',
    rules: [
      'The music stops right before a lyric. Buzz and sing or say the next line.',
      'Exact next line: +20. Mostly right (gist plus key words): +10.',
      'Wrong: 0, and you are locked out of that track.',
    ],
    options: [
      { label: 'Exact line', points: 20, kind: 'correct' },
      { label: 'Mostly right', points: 10, kind: 'correct' },
      { label: 'Wrong', points: 0, kind: 'wrong' },
    ],
  },
  {
    id: 'r4', name: 'Musical Trivia Lightning', type: 'trivia', seconds: 15, points: 10,
    rules: [
      'Rapid-fire questions, no audio and no buzzing.',
      'Every team writes its answer down within 15 seconds.',
      '+10 for every correct answer.',
    ],
  },
  {
    id: 'r5', name: 'Mashup Mayhem', type: 'buzz',
    rules: [
      'Two songs layered together, or one song played backwards or slowed down.',
      'Both songs correct: +40. One song correct: +15.',
      'Steal: if a team gets only one, the other teams can buzz to name the second for +15.',
    ],
    options: [
      { label: 'Both songs', points: 40, kind: 'correct' },
      { label: 'One song (others may steal)', points: 15, kind: 'partial' },
      { label: 'Steal (second song)', points: 15, kind: 'correct' },
      { label: 'Wrong', points: 0, kind: 'wrong' },
    ],
  },
  {
    id: 'final', name: 'Final Showdown', type: 'final', clipLength: 10,
    rules: [
      'Each team secretly wagers any part of its current score.',
      'One 10-second clip. Write down the song title AND the artist.',
      'Both correct: win the wager. Anything wrong: lose the wager.',
    ],
  },
];

const HOST_LINES = {
  opening: 'Welcome to Musical Whits, the show where your ears do the thinking! Tonight, our teams will battle through five rounds of tunes, lyrics, and trivia. Fingers on buzzers... let\'s play!',
  between: 'Read the scoreboard aloud, then tease the next round with its name and one rule.',
  final: 'It all comes down to this. One song. One wager. Bet wisely.',
  closing: 'Congratulations to our champions! Thanks for playing Musical Whits!',
};

function tune(id) { return { kind: 'tune', tune: id }; }

// The starter pack: placeholder tunes so the game works straight away.
// Hosts replace these with their own songs in "Edit questions".
function demoPack() {
  const song = (id, extra = {}) => ({ title: TUNES[id].name, artist: TUNES[id].artist, audio: tune(id), start: 0, ...extra });
  const lyric = (id, phrases, before, next) => song(id, { stopAt: +tunePhraseEnd(id, phrases).toFixed(2), before, next });
  return {
    r1: ['odeToJoy', 'furElise', 'mountainKing', 'turkishMarch', 'greensleeves'].map((id) => song(id)),
    r2: ['happyBirthday', 'jingleBells', 'oldMacDonald', 'frereJacques', 'ohSusanna'].map((id) => song(id)),
    r3: [
      lyric('twinkle', 1, 'Twinkle, twinkle, little star...', 'How I wonder what you are'),
      lyric('amazingGrace', 1, 'Amazing grace, how sweet the sound...', 'That saved a wretch like me'),
      lyric('auldLangSyne', 2, 'Should auld acquaintance be forgot...', 'And never brought to mind'),
      lyric('londonBridge', 1, 'London Bridge is falling down...', 'Falling down, falling down'),
      lyric('saints', 3, 'Oh when the saints go marching in...', 'Oh Lord, I want to be in that number'),
      lyric('maryLamb', 2, 'Mary had a little lamb, little lamb, little lamb...', 'Mary had a little lamb, its fleece was white as snow'),
    ],
    r4: [
      { question: 'Which band released the album Abbey Road?', answer: 'The Beatles' },
      { question: 'What instrument has 88 keys?', answer: 'The piano' },
      { question: 'Which artist is known as the "Queen of Pop"?', answer: 'Madonna' },
      { question: 'Bohemian Rhapsody was released in which decade?', answer: 'The 1970s (1975)' },
      { question: 'What do you call a group of eight musicians?', answer: 'An octet' },
      { question: 'How many strings does a standard guitar have?', answer: 'Six' },
      { question: 'Which composer kept writing music after losing his hearing, including the Ninth Symphony?', answer: 'Ludwig van Beethoven' },
      { question: 'What does "forte" mean in sheet music?', answer: 'Loud' },
      { question: 'What is the best-selling album of all time?', answer: 'Thriller by Michael Jackson' },
      { question: 'How many lines are on a musical staff?', answer: 'Five' },
    ],
    r5: [
      { mode: 'layer', title: TUNES.rowYourBoat.name, artist: 'Traditional', audio: tune('rowYourBoat'), title2: TUNES.scarborough.name, artist2: 'Traditional', audio2: tune('scarborough'), start: 0 },
      { mode: 'layer', title: TUNES.maryLamb.name, artist: 'Traditional', audio: tune('maryLamb'), title2: TUNES.odeToJoy.name, artist2: 'Beethoven', audio2: tune('odeToJoy'), start: 0 },
      { mode: 'reverse', title: TUNES.twinkle.name, artist: 'Traditional', audio: tune('twinkle'), start: 0 },
      { mode: 'slow', title: TUNES.jingleBells.name, artist: TUNES.jingleBells.artist, audio: tune('jingleBells'), start: 0 },
    ],
    final: [
      { category: 'Classical Hits', ...song('eineKleine') },
    ],
  };
}
