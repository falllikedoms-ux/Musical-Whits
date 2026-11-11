// Musical Wits: the game state and flow, the song library screen and the event handling.
// The game-show screens themselves are drawn in screens.js.

const TEAM_KEYS = ['Q', 'P', 'Z', 'M'];
const CHOICE_KEYS = ['A', 'B', 'C', 'D'];
const DEFAULT_TEAM_NAMES = ['Treble Makers', 'Bass Pros', 'Note-orious', ''];
const SETUP_KEY = 'musicalWhits.setup.v1';
const GAME_VERSION = 2;
// When everyone answers at once, how long after the clip's own length answers stay open.
const EXTRA_ANSWER_SECONDS = 7;

let game = loadJSON(GAME_KEY);
if (game && game.v !== GAME_VERSION) game = null; // a game saved by an older version
let screen = 'home';
let clip = null;
let answerTicker = null;
let libraryOpen = false;
let librarySearch = '';
const LIBRARY_ROWS_SHOWN = 60;
let setup = { count: 3, names: DEFAULT_TEAM_NAMES.slice(), punIdx: 0, punTarget: 0, ...(loadJSON(SETUP_KEY) || {}) };
function saveSetup() { saveJSON(SETUP_KEY, setup); }

const app = document.getElementById('app');

// ---------- helpers ----------

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function fmtTime(s) {
  return (Math.max(0, s) || 0).toFixed(1) + 's';
}

function signed(n) {
  return (n > 0 ? '+' : '') + n;
}

function saveGame() { saveJSON(GAME_KEY, game); }

function round() { return ROUNDS[game.r]; }
function roundItems(id) { return (game && game.items && game.items[id]) || []; }
function items() { return roundItems(round().id); }
function item() { return items()[game.i]; }
// The rounds this game actually has songs for, in order.
function activeRounds() { return ROUNDS.filter((r) => roundItems(r.id).length); }
// The rounds a new game would have with the current options.
function plannedRounds() { return ROUNDS.filter((r) => settings.titleBonus || !r.bonus); }
function itemKey() { return `${game.id}:${game.r}:${game.i}`; }
function answerWindowMs(r) { return (r.clipLength + EXTRA_ANSWER_SECONDS) * 1000; }

function stopClip() {
  if (clip) { clip.stop(); clip.onupdate = null; clip.onend = null; }
  clip = null;
}

function stopAnswerTicker() {
  clearInterval(answerTicker);
  answerTicker = null;
}

// In-page pop-ups (some places that host the game block the browser's own dialogs).
function ask(message, yesLabel, onYes) {
  const box = document.createElement('div');
  box.className = 'dialog-backdrop';
  box.innerHTML = `<div class="dialog" role="dialog" aria-modal="true"><div class="dialog-inner">
    <p>${esc(message)}</p>
    <div class="row end">
      <button class="btn btn-ghost" data-dialog="no">Cancel</button>
      <button class="btn btn-primary btn-small" data-dialog="yes">${esc(yesLabel)}</button>
    </div></div></div>`;
  box.addEventListener('click', (e) => {
    const b = e.target.closest('[data-dialog]');
    if (!b && e.target !== box) return;
    box.remove();
    if (b && b.dataset.dialog === 'yes') onYes();
  });
  document.body.appendChild(box);
  box.querySelector('[data-dialog=yes]').focus();
}

// A pop-up with a title and some text, closed with one button.
function showInfo(title, html) {
  const box = document.createElement('div');
  box.className = 'dialog-backdrop';
  box.innerHTML = `<div class="dialog" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="dialog-inner">
    <h2>${esc(title)}</h2>${html}
    <div class="row end"><button class="btn btn-primary btn-small" data-dialog="no">Close</button></div>
  </div></div>`;
  box.addEventListener('click', (e) => { if (e.target === box || e.target.closest('[data-dialog]')) box.remove(); });
  document.body.appendChild(box);
  box.querySelector('[data-dialog]').focus();
}

// Adds songs to the library with a progress note, then says how it went.
async function addSongs(files) {
  const progress = document.createElement('div');
  progress.className = 'toast';
  progress.setAttribute('role', 'status');
  progress.textContent = 'Looking for songs...';
  document.body.appendChild(progress);
  try {
    const res = await addToLibrary(files, (k, n) => { progress.textContent = `Adding song ${k} of ${n}...`; });
    progress.remove();
    const extra = [res.skipped ? `${res.skipped} already in your library` : '', res.ignored ? `${res.ignored} not audio` : ''].filter(Boolean).join(', ');
    notify(res.added || res.skipped
      ? `Added ${res.added} song${res.added === 1 ? '' : 's'}.${extra ? ' Skipped ' + extra + '.' : ''}`
      : 'No songs found in that folder.');
  } catch (err) {
    progress.remove();
    notify(err.message);
  }
  libraryOpen = libraryOpen || library.length <= 30;
  render();
}

function notify(message) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.setAttribute('role', 'status');
  t.textContent = message;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 5000);
}

// ---------- scoring ----------

// Points land on the scoreboard, and float up from the team's name for a moment.
function addPoints(team, pts) {
  game.teams[team].score += pts;
  if (!pts) return;
  if (!game.flash || Date.now() - game.flash.at > 300) game.flash = { at: Date.now(), pts: {} };
  game.flash.pts[team] = (game.flash.pts[team] || 0) + pts;
}

// ---------- game flow ----------

function newGame() {
  stopClip();
  stopAnswerTicker();
  const demo = !library.length;
  const dealt = dealRounds(demo ? demoSongs() : librarySongs(), settings);
  if (!ROUNDS.some((r) => (dealt[r.id] || []).length)) {
    notify('None of your songs have an artist yet. Open Songs and type the artists in, or switch on the title bonus rounds.');
    return;
  }
  game = {
    v: GAME_VERSION,
    id: Date.now().toString(36),
    teams: setup.names.slice(0, setup.count).map((name, i) => ({ name: (name || '').trim() || 'Team ' + (i + 1), score: 0 })),
    demo,
    randomStart: settings.randomStart,
    items: dealt,
    r: 0, i: 0, phase: 'intro',
    roundStart: [],
    item: null,
    screenTeam: null,
    gold: { team: null, rounds: 0 },
  };
  skipEmptyRounds();
  game.roundStart = game.teams.map((t) => t.score);
  saveGame();
  screen = 'game';
  render();
}

function skipEmptyRounds() {
  while (game.r < ROUNDS.length && !roundItems(ROUNDS[game.r].id).length) game.r++;
  if (game.r >= ROUNDS.length) game.phase = 'end';
}

// Two ways to play a track:
//   'all'  - phones are connected, so every team answers at once on its own device
//   'buzz' - one shared screen: buzz in first, then pick the answer
function freshItemState() {
  const phones = window.Online ? Online.phoneCount() : 0;
  return { mode: phones ? 'all' : 'buzz', locked: [], buzzed: null, struck: [], answers: {}, startedAt: null, done: false, clipStart: null };
}

function startItem() {
  stopClip();
  stopAnswerTicker();
  game.item = freshItemState();
  saveGame();
  render();
  playClip();
  preloadNext();
}

// Gets the next song ready while this one plays, so there's no wait between tracks.
function preloadNext() {
  const next = items()[game.i + 1];
  if (next) setTimeout(() => loadSource(next.audio).catch(() => {}), 1500);
}

function startRound() {
  game.phase = 'item';
  game.i = 0;
  game.roundStart = game.teams.map((t) => t.score);
  startItem();
}

function nextItem() {
  if (game.i + 1 < items().length) {
    game.i++;
    startItem();
    return;
  }
  stopClip();
  stopAnswerTicker();
  game.item = null;
  game.phase = round().final ? 'end' : 'roundEnd';
  if (game.phase === 'roundEnd') updateGold();
  saveGame();
  render();
}

// The Gold Record: a team that ends rounds at #1 on its own, round after round.
function updateGold() {
  const top = Math.max(...game.teams.map((t) => t.score));
  const leaders = game.teams.map((t, i) => i).filter((i) => game.teams[i].score === top);
  const g = game.gold || { team: null, rounds: 0 };
  if (leaders.length !== 1) game.gold = { team: null, rounds: 0 };
  else if (g.team === leaders[0]) game.gold = { team: g.team, rounds: g.rounds + 1 };
  else game.gold = { team: leaders[0], rounds: 1 };
}

function nextRound() {
  stopClip();
  stopAnswerTicker();
  game.r++;
  game.i = 0;
  skipEmptyRounds();
  if (game.phase !== 'end') game.phase = 'intro';
  game.item = null;
  saveGame();
  render();
}

function playing() { return screen === 'game' && game && game.phase === 'item' && game.item && !game.item.done; }

// One shared screen: the first team to buzz gets to answer.
function buzz(team) {
  if (!playing()) return;
  const st = game.item;
  if (st.mode !== 'buzz' || !game.teams[team] || st.buzzed !== null || st.locked.includes(team)) return;
  st.buzzed = team;
  playBuzz(team);
  if (navigator.vibrate) navigator.vibrate(80);
  if (clip) clip.pause();
  saveGame();
  render();
}

// A team tapped its name: buzz in, or (with phones) say "we're answering on this screen".
function tapTeam(team) {
  if (!playing() || !game.teams[team]) return;
  if (game.item.mode === 'buzz') { buzz(team); return; }
  if (game.item.answers[team]) return;
  game.screenTeam = game.screenTeam === team ? null : team;
  saveGame();
  render();
}

// A choice was tapped on the host's screen.
function tapChoice(c) {
  if (!playing()) return;
  const st = game.item;
  if (st.mode === 'buzz') { if (st.buzzed !== null) answer(st.buzzed, c); return; }
  if (game.screenTeam === null || !game.teams[game.screenTeam]) { notify('Tap your team first, then your answer.'); return; }
  answer(game.screenTeam, c);
}

// The game is the judge: a team's choice is checked against the song's own artist or title.
function answer(team, c) {
  if (!playing()) return;
  const st = game.item;
  const it = item();
  const r = round();
  if (!game.teams[team] || !Number.isInteger(c) || c < 0 || c >= it.choices.length) return;
  if (st.mode === 'all') {
    if (st.answers[team] || st.startedAt === null) return;
    st.answers[team] = { c, ms: Date.now() - st.startedAt };
    playBuzz(team);
    if (Object.keys(st.answers).length >= game.teams.length) { finishItem(); return; }
  } else {
    if (st.buzzed !== team || st.struck.includes(c)) return;
    if (c === it.correct) {
      st.answers[team] = { c, pts: r.points };
      finishItem();
      return;
    }
    st.answers[team] = { c, pts: 0 };
    st.struck.push(c);
    st.locked.push(team);
    st.buzzed = null;
    if (st.locked.length >= game.teams.length) { finishItem(); return; }
    playJingle(false);
    if (clip && clip.pos < clip.duration - 0.05) clip.play().then(updatePlayButton);
  }
  saveGame();
  render();
}

// Closes the track: scores every answer and shows who was right.
function finishItem() {
  if (!playing()) return;
  const st = game.item;
  const it = item();
  const r = round();
  st.done = true;
  st.buzzed = null;
  stopAnswerTicker();
  const total = answerWindowMs(r);
  let anyRight = false;
  Object.entries(st.answers).forEach(([team, a]) => {
    if (st.mode === 'all') {
      a.pts = a.c === it.correct ? r.points + Math.round(speedBonus(r) * Math.max(0, 1 - a.ms / total)) : 0;
    }
    if (a.pts) { anyRight = true; addPoints(+team, a.pts); }
  });
  playJingle(anyRight);
  // Let the song play on under the answer.
  if (clip && !clip.playing && clip.pos < clip.duration - 0.05) clip.play().then(updatePlayButton);
  saveGame();
  render();
}

async function playClip() {
  const r = round();
  const it = item();
  const st = game.item;
  try {
    if (!clip) {
      // Keep the same random spot if the clip is rebuilt (after a refresh, say).
      const start = st.clipStart != null ? st.clipStart : game.randomStart ? 'random' : 0;
      clip = new Clip([it.audio], { start, length: r.clipLength });
    }
    const mine = clip;
    clip.onupdate = updateProgress;
    clip.onend = () => { updatePlayButton(); };
    await clip.play();
    if (clip !== mine) { mine.stop(); return; }
    if (st.clipStart == null) st.clipStart = clip.start;
    updatePlayButton();
  } catch (e) {
    clip = null;
    notify('Could not play this track: ' + e.message);
  }
  // The clock for answers starts with the music.
  if (game && game.item === st && st.startedAt === null && !st.done) {
    st.startedAt = Date.now();
    saveGame();
    render();
  }
}

function togglePlay() {
  if (clip && clip.playing) { clip.pause(); updatePlayButton(); } else playClip();
}

function restartClip() {
  if (clip) clip.stop();
  playClip();
}

function updateProgress(pos, dur) {
  const bar = document.getElementById('progress-fill');
  const time = document.getElementById('progress-time');
  if (bar) bar.style.width = (dur ? (pos / dur) * 100 : 0) + '%';
  if (time) time.textContent = fmtTime(pos) + ' / ' + fmtTime(dur);
}

function updatePlayButton() {
  const on = !!(clip && clip.playing);
  const btn = document.getElementById('play-btn');
  if (btn) { btn.innerHTML = icon(on ? 'pause' : 'play'); btn.setAttribute('aria-label', on ? 'Pause' : 'Play'); }
  const deck = document.getElementById('cartridge');
  if (deck) deck.classList.toggle('playing', on);
}

// The countdown while everyone answers at once.
function answerTimeLeft() {
  const st = game.item;
  if (!st || st.startedAt === null) return answerWindowMs(round());
  return Math.max(0, st.startedAt + answerWindowMs(round()) - Date.now());
}

function tickAnswers() {
  if (!playing() || game.item.mode !== 'all' || game.item.startedAt === null) { stopAnswerTicker(); return; }
  const left = answerTimeLeft();
  const bar = document.getElementById('answer-fill');
  if (bar) bar.style.width = (left / answerWindowMs(round())) * 100 + '%';
  const num = document.getElementById('answer-left');
  if (num) num.textContent = Math.ceil(left / 1000);
  if (left <= 0) finishItem();
}

// ---------- rendering ----------

function render() {
  if (screen === 'editor') app.innerHTML = renderEditor();
  else if (screen === 'player' && window.Online) app.innerHTML = Online.renderPlayer();
  else if (screen === 'teams') app.innerHTML = renderTeams();
  else if (screen === 'howto') app.innerHTML = renderHowTo();
  else if (screen === 'game' && game) { app.innerHTML = renderGame(); afterGameRender(); }
  else app.innerHTML = renderHome();
  if (window.Online) Online.afterRender();
}

function afterGameRender() {
  if (clip && game.phase === 'item') {
    clip.onupdate = updateProgress;
    updateProgress(clip.pos, clip.duration || 0);
    updatePlayButton();
  }
  if (playing() && game.item.mode === 'all' && game.item.startedAt !== null) {
    if (!answerTicker) answerTicker = setInterval(tickAnswers, 200);
    tickAnswers();
  }
  if (game.flash) setTimeout(() => {
    document.querySelectorAll('.contestant .flash').forEach((el) => el.remove());
  }, 1500);
}

// ---------- songs: the music library ----------

function renderEditor() {
  return `
  <main class="editor">
    ${topbar('Songs', { actions: '<button class="btn btn-primary btn-small" data-action="home">Done</button>' })}
    <div class="screen-title">Your songs</div>
    ${renderLibrary()}
  </main>`;
}

// The song list under the search box. Big libraries only show the first matches,
// so the page stays quick on a phone.
function renderLibraryRows() {
  const matches = searchLibrary(librarySearch);
  const rows = matches.slice(0, LIBRARY_ROWS_SHOWN).map((i) => {
    const s = library[i];
    return `
    <div class="lib-row">
      <input type="text" value="${esc(s.title)}" data-lib="${i}" data-lib-field="title" aria-label="Title">
      <input type="text" value="${esc(s.artist)}" data-lib="${i}" data-lib-field="artist" placeholder="Artist" aria-label="Artist">
      <button class="btn btn-ghost btn-small" data-action="lib-preview" data-idx="${i}" aria-label="Play a bit of ${esc(s.title)}">${icon('play')}</button>
      <button class="btn btn-ghost btn-small danger" data-action="lib-remove" data-idx="${i}" aria-label="Remove ${esc(s.title)}">×</button>
      ${s.album ? `<span class="lib-album">Album: ${esc(s.album)}</span>` : ''}
    </div>`;
  }).join('');
  const count = librarySearch.trim()
    ? `${matches.length} match${matches.length === 1 ? '' : 'es'}`
    : `${library.length} song${library.length === 1 ? '' : 's'}`;
  const more = matches.length > LIBRARY_ROWS_SHOWN ? `<p class="hint">Showing the first ${LIBRARY_ROWS_SHOWN}. Search to find the rest.</p>` : '';
  const removeMatches = librarySearch.trim() && matches.length
    ? `<button class="btn btn-ghost btn-small danger" data-action="lib-remove-matches">Remove these ${matches.length}</button>` : '';
  return `<div class="row lib-count"><span class="dim">${count}</span>${removeMatches}</div>${rows || '<p class="dim">No songs match.</p>'}${more}`;
}

function renderLibrary() {
  const n = library.length;
  const accept = 'audio/*,.mp3,.m4a,.wav,.ogg,.aac,.flac';
  return `
    <section class="card library"><div class="card-body">
      <h2>My music library <span class="dim">(${n} song${n === 1 ? '' : 's'})</span></h2>
      <p>Add as many songs as you like at once. Then tick <b>Pick songs at random from my music library</b> under <b>Game options</b> on the Teams screen, and every new game draws Name That Tune, Intro Sprint, Mashup Mayhem and the Final from here, with no song played twice in a game. Lyric Gap and Trivia still use the questions below.</p>
      <div class="row">
        <label class="btn btn-primary file-btn">+ Add songs<input class="file-input" type="file" multiple accept="${accept}" data-library-add></label>
        ${nativeFolderPicker()
          ? '<button class="btn btn-secondary" data-action="native-folder">Add a whole folder</button>'
          : '<label class="btn btn-secondary file-btn">Add a whole folder<input class="file-input" type="file" webkitdirectory multiple data-library-add></label>'}
        ${n ? '<button class="btn btn-ghost danger" data-action="clear-library">Remove all</button>' : ''}
      </div>
      <p class="hint"><b>Add a whole folder</b> takes every song in the folder you pick, including all the album folders inside it. If your phone only lets you pick single files here, use the Musical Wits Android app, which can pick whole folders, or use <b>+ Add songs</b>: open an album, press and hold one song, then pick <b>Select all</b> from the menu. Songs are copied into this browser on this device, so they use some of its storage. They are never uploaded.</p>
      ${n ? `<details class="lib-list" ${libraryOpen ? 'open' : ''}><summary>Search and check songs (${n})</summary>
        <input type="search" class="lib-search" placeholder="Search by song, artist or album" value="${esc(librarySearch)}" data-lib-search aria-label="Search your library">
        <p class="hint">Names come from each file's tags or its file name. Fix any that look wrong; they're the answers on screen.</p>
        <div id="lib-rows">${renderLibraryRows()}</div></details>` : ''}
    </div></section>`;
}

function renderLibrary() {
  const n = library.length;
  const accept = 'audio/*,.mp3,.m4a,.wav,.ogg,.aac,.flac';
  const noArtist = library.filter((s) => !s.artist).length;
  const artists = new Set(library.filter((s) => s.artist).map((s) => s.artist.trim().toLowerCase())).size;
  let health = '';
  if (n) {
    health = `<p class="lib-health">${artists} different artist${artists === 1 ? '' : 's'}.`
      + (noArtist ? ` <b>${noArtist} song${noArtist === 1 ? ' has' : 's have'} no artist</b>, so ${noArtist === 1 ? 'it' : 'they'} can only be used in title bonus rounds. Type the artist in below to fix that.` : '')
      + (artists < 4 ? ' The game is more fun with at least 4 different artists; until then it fills the choices with famous names.' : '') + '</p>';
  }
  return `
    <section class="card library"><div class="card-body">
      <h2>My music library <span class="dim">(${n} song${n === 1 ? '' : 's'})</span></h2>
      <p>Add your music and every new game picks songs from it at random, with no song played twice in a game. The game reads each song's <b>artist</b> and <b>title</b> from the file, and those are the answers it checks, so nobody has to judge.</p>
      <div class="row">
        <label class="btn btn-primary file-btn">+ Add songs<input class="file-input" type="file" multiple accept="${accept}" data-library-add></label>
        ${nativeFolderPicker()
          ? '<button class="btn btn-secondary" data-action="native-folder">Add a whole folder</button>'
          : '<label class="btn btn-secondary file-btn">Add a whole folder<input class="file-input" type="file" webkitdirectory multiple data-library-add></label>'}
        ${n ? '<button class="btn btn-ghost danger" data-action="clear-library">Remove all</button>' : ''}
      </div>
      ${health}
      <p class="hint">Names come from the tags inside each file, or from a file name like <b>Artist - Title.mp3</b>. <b>Add a whole folder</b> takes every song in the folder you pick, including the album folders inside it. If your phone only lets you pick single files here, use the Musical Wits Android app, or use <b>+ Add songs</b>: open an album, press and hold one song, then pick <b>Select all</b>. Songs are copied into this browser on this device and are never uploaded.</p>
      ${n ? `<details class="lib-list" ${libraryOpen ? 'open' : ''}><summary>Search and check songs (${n})</summary>
        <input type="search" class="lib-search" placeholder="Search by song, artist or album" value="${esc(librarySearch)}" data-lib-search aria-label="Search your library">
        <p class="hint">Fix any names that look wrong. They are the answers the game checks.</p>
        <div id="lib-rows">${renderLibraryRows()}</div></details>` : '<p class="hint">No songs yet? The game plays its built-in demo tunes until you add some.</p>'}
    </div></section>`;
}

let previewClip = null;
async function previewLibrary(idx) {
  if (previewClip && previewClip.playing) { previewClip.stop(); previewClip = null; return; }
  const s = library[idx];
  try {
    previewClip = new Clip([{ kind: 'file', fileId: s.fileId, fileName: s.fileName }], { start: 'random', length: 10 });
    await previewClip.play();
  } catch (e) {
    notify('Could not play this song: ' + e.message);
  }
}

// ---------- events ----------

app.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el || el.disabled) return;
  const a = el.dataset.action;
  switch (a) {
    case 'open-teams': screen = 'teams'; render(); window.scrollTo(0, 0); break;
    case 'howto': screen = 'howto'; render(); window.scrollTo(0, 0); break;
    case 'round-info': showRoundInfo(el.dataset.round); break;
    case 'pun': pullLever(); break;
    case 'add-team': if (setup.count < 4) { setup.count++; saveSetup(); render(); } break;
    case 'remove-team': {
      const i = +el.dataset.team;
      setup.names.splice(i, 1);
      setup.names.push('');
      setup.count = Math.max(2, setup.count - 1);
      saveSetup();
      render();
      break;
    }
    case 'new-game':
      if (game && game.phase !== 'end') ask('Start a new game? The game in progress will be lost.', 'Start new game', newGame);
      else newGame();
      break;
    case 'resume': screen = 'game'; render(); break;
    case 'open-editor': screen = 'editor'; render(); window.scrollTo(0, 0); break;
    case 'home': stopClip(); stopAnswerTicker(); if (previewClip) previewClip.stop(); screen = 'home'; render(); window.scrollTo(0, 0); break;
    case 'play-again': game = null; saveGame(); screen = 'teams'; render(); break;
    case 'skip-round':
      ask('Skip the rest of this round?', 'Skip round', () => {
        if (round().final) { game.phase = 'end'; game.item = null; stopClip(); stopAnswerTicker(); saveGame(); render(); } else nextRound();
      });
      break;
    case 'start-round': startRound(); break;
    case 'next-round': nextRound(); break;
    case 'team': tapTeam(+el.dataset.team); break;
    case 'choice': tapChoice(+el.dataset.choice); break;
    case 'adjust': addPoints(+el.dataset.team, +el.dataset.pts); saveGame(); render(); break;
    case 'toggle-play': togglePlay(); break;
    case 'restart': restartClip(); break;
    case 'reveal': finishItem(); break;
    case 'next-item': nextItem(); break;
    case 'lib-preview': previewLibrary(+el.dataset.idx); break;
    case 'lib-remove': {
      const s = library[+el.dataset.idx];
      ask(`Remove "${s.title}" from your library?`, 'Remove', () => { removeFromLibrary(+el.dataset.idx); render(); });
      break;
    }
    case 'lib-remove-matches': {
      const matches = searchLibrary(librarySearch);
      ask(`Remove the ${matches.length} songs matching "${librarySearch.trim()}" from your library?`, 'Remove', () => { removeManyFromLibrary(matches); librarySearch = ''; render(); });
      break;
    }
    case 'native-folder': {
      const picker = nativeFolderPicker();
      picker.pick()
        .then((files) => (files.length ? addSongs(files).finally(picker.cleanup) : null))
        .catch((err) => notify('Could not open that folder: ' + err.message));
      break;
    }
    case 'clear-library':
      ask(`Remove all ${library.length} songs from your library? The files on your device itself are not touched.`, 'Remove all', () => { clearLibrary(); render(); });
      break;
  }
});

app.addEventListener('input', (e) => {
  const t = e.target;
  if (t.dataset.setupName !== undefined) {
    if (/\n/.test(t.value)) { t.value = t.value.replace(/\n/g, ''); t.blur(); }
    setup.names[+t.dataset.setupName] = t.value; saveSetup();
  }
  if (t.dataset.libSearch !== undefined) {
    librarySearch = t.value;
    document.getElementById('lib-rows').innerHTML = renderLibraryRows();
  }
});

app.addEventListener('change', async (e) => {
  const t = e.target;
  if (t.dataset.setting) {
    settings[t.dataset.setting] = t.type === 'checkbox' ? t.checked : +t.value;
    saveSettings();
    return;
  }
  if (t.dataset.libField) { library[+t.dataset.lib][t.dataset.libField] = t.value.trim(); saveLibrary(); return; }
  if (t.dataset.libraryAdd !== undefined && t.files.length) await addSongs(t.files);
});

// Remember whether the song list is open across re-renders.
app.addEventListener('toggle', (e) => { if (e.target.classList.contains('lib-list')) libraryOpen = e.target.open; }, true);

document.addEventListener('keydown', (e) => {
  if (e.target.matches('input, select, textarea')) return;
  const k = e.key.toUpperCase();
  const choice = '1234'.includes(e.key) && e.key ? +e.key - 1 : CHOICE_KEYS.indexOf(k);
  if (screen === 'player' && window.Online) {
    if (choice >= 0) { e.preventDefault(); Online.pick(choice); }
    return;
  }
  if (screen !== 'game' || !game || game.phase !== 'item') return;
  const team = TEAM_KEYS.indexOf(k);
  if (team >= 0) { e.preventDefault(); tapTeam(team); return; }
  if (choice >= 0) { e.preventDefault(); tapChoice(choice); return; }
  if (e.key === ' ') { e.preventDefault(); togglePlay(); }
});

render();
