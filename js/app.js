// Musical Wits: the game state and flow, the question editor and the event handling.
// The game-show screens themselves are drawn in screens.js.

const TEAM_KEYS = ['Q', 'P', 'Z', 'M'];
const DEFAULT_TEAM_NAMES = ['Treble Makers', 'Bass Pros', 'Note-orious', ''];
const SETUP_KEY = 'musicalWhits.setup.v1';
const MASHUP_MODES = { layer: 'Two songs layered', reverse: 'Played backwards', slow: 'Slowed down' };
// Rounds where "random clip start" applies. Intro Sprint is about the intro, and
// Lyric Gap has to stop right before its line, so those keep their set start.
const RANDOM_START_ROUNDS = ['r1', 'r5', 'final'];

let pack = loadJSON(PACK_KEY) || demoPack();
let game = loadJSON(GAME_KEY);
let screen = 'home';
let clip = null;
let triviaTimer = null;
let editorRound = 'r1';
let libraryOpen = false;
let librarySearch = '';
const LIBRARY_ROWS_SHOWN = 60;
let setup = { count: 3, names: DEFAULT_TEAM_NAMES.slice(), noNegative: false, punIdx: 0, punTarget: 0, ...(loadJSON(SETUP_KEY) || {}) };
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

function savePack() { saveJSON(PACK_KEY, pack); }
function saveGame() { saveJSON(GAME_KEY, game); }

function round() { return ROUNDS[game.r]; }
// A game drawn from the music library carries its own tracks; otherwise they come from the pack.
function roundItems(id) { return (game && game.items && game.items[id]) || pack[id] || []; }
function items() { return roundItems(round().id); }
function item() { return items()[game.i]; }

function stopClip() {
  if (clip) { clip.stop(); clip.onupdate = null; clip.onend = null; }
  clip = null;
}

function stopTriviaTimer() {
  clearInterval(triviaTimer);
  triviaTimer = null;
}

// Builds the clip for a question, following each round's rules.
// startAt overrides the track's own start (a number, or 'random').
function makeClip(roundId, it, stageSeconds, startAt) {
  const start = startAt !== undefined ? startAt : Number(it.start) || 0;
  if (roundId === 'r2') return new Clip([it.audio], { start, length: stageSeconds });
  if (roundId === 'r3') {
    const stop = Number(it.stopAt);
    return new Clip([it.audio], { start, length: stop > start ? stop - start : 15 });
  }
  if (roundId === 'r5') {
    const len = Number(it.length) || 20;
    if (it.mode === 'layer') return new Clip([it.audio, it.audio2], { start, length: len });
    if (it.mode === 'reverse') return new Clip([it.audio], { start, length: len, reverse: true });
    return new Clip([it.audio], { start, length: len, rate: 0.65 });
  }
  const r = ROUNDS.find((x) => x.id === roundId);
  return new Clip([it.audio], { start, length: r.clipLength || 15 });
}

function answerText(roundId, it) {
  if (roundId === 'r3') return `<div class="answer-line">"${esc(it.next)}"</div><div class="answer-sub">${esc(it.title)} · ${esc(it.artist)}</div>`;
  if (roundId === 'r4') return `<div class="answer-line">${esc(it.answer)}</div>`;
  if (roundId === 'r5' && it.mode === 'layer') {
    return `<div class="answer-line">${esc(it.title)} <span class="dim">by ${esc(it.artist)}</span></div><div class="answer-line">${esc(it.title2)} <span class="dim">by ${esc(it.artist2)}</span></div>`;
  }
  return `<div class="answer-line">${esc(it.title)}</div><div class="answer-sub">${esc(it.artist)}</div>`;
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

function addPoints(team, pts) {
  if (game.noNegative && pts < 0) pts = 0;
  game.teams[team].score += pts;
  if (pts !== 0) flashScore(team, pts);
}

function flashScore(team, pts) {
  game.flash = { team, pts, at: Date.now() };
}

// ---------- game flow ----------

function newGame() {
  stopClip();
  game = {
    teams: setup.names.slice(0, setup.count).map((name, i) => ({ name: (name || '').trim() || 'Team ' + (i + 1), score: 0 })),
    noNegative: setup.noNegative,
    randomStart: settings.randomStart,
    items: settings.useLibrary && library.length ? libraryRounds() : null,
    r: 0, i: 0, phase: 'intro',
    roundStart: [],
    item: null,
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

function freshItemState() {
  const r = round();
  if (r.type === 'trivia') return { timeLeft: r.seconds, revealed: false, marks: game.teams.map(() => false), done: false };
  if (r.type === 'final') {
    return { step: 'wager', wagers: game.teams.map(() => 0), sealed: game.teams.map(() => false), cur: 0, draft: 0, marks: game.teams.map(() => false), revealed: false };
  }
  return { locked: [], buzzed: null, picking: false, done: false, revealed: false, partial: false, stage: 0 };
}

function startRound() {
  game.phase = 'item';
  game.i = 0;
  game.roundStart = game.teams.map((t) => t.score);
  game.item = freshItemState();
  saveGame();
  render();
}

function nextItem() {
  stopClip();
  stopTriviaTimer();
  if (game.i + 1 < items().length) {
    game.i++;
    game.item = freshItemState();
  } else {
    game.phase = round().type === 'final' ? 'end' : 'roundEnd';
    if (game.phase === 'roundEnd') updateGold();
  }
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
  stopTriviaTimer();
  game.r++;
  game.i = 0;
  skipEmptyRounds();
  if (game.phase !== 'end') game.phase = 'intro';
  game.item = null;
  saveGame();
  render();
}

function buzz(team) {
  if (screen !== 'game' || game.phase !== 'item') return;
  const r = round();
  const st = game.item;
  if (r.type === 'trivia' || r.type === 'final') return;
  if (!game.teams[team] || st.done || st.buzzed !== null || st.locked.includes(team)) return;
  st.buzzed = team;
  st.picking = false;
  playBuzz(team);
  if (navigator.vibrate) navigator.vibrate(80);
  if (clip) clip.pause();
  saveGame();
  render();
}

function judge(kind, points) {
  const st = game.item;
  const team = st.buzzed;
  if (team === null) return;
  addPoints(team, points);
  if (kind === 'correct') {
    st.done = true;
    st.revealed = true;
    st.buzzed = null;
    if (clip) clip.pause();
    playJingle(true);
  } else {
    st.locked.push(team);
    st.buzzed = null;
    if (kind === 'partial') st.partial = true;
    playJingle(kind === 'partial');
    if (clip && clip.pos < clip.duration - 0.05) clip.play();
  }
  saveGame();
  render();
}

function optionsFor(r, it, st) {
  if (r.type === 'sprint') {
    const pts = r.stagePoints[Math.max(0, st.stage - 1)];
    return [
      { label: 'Correct title', points: pts, kind: 'correct' },
      { label: 'Wrong', points: r.wrongPoints, kind: 'wrong' },
    ];
  }
  if (r.id === 'r5') {
    if (it.mode !== 'layer') return [{ label: 'Correct song', points: 15, kind: 'correct' }, { label: 'Wrong', points: 0, kind: 'wrong' }];
    if (st.partial) return r.options.filter((o) => o.label.startsWith('Steal') || o.kind === 'wrong');
    return r.options.filter((o) => !o.label.startsWith('Steal'));
  }
  return r.options;
}

async function playClip(stageSeconds) {
  const r = round();
  const it = item();
  const st = game.item;
  const random = game.randomStart && RANDOM_START_ROUNDS.includes(r.id);
  try {
    if (r.type === 'sprint') {
      stopClip();
      clip = makeClip(r.id, it, stageSeconds);
    } else if (!clip) {
      // Keep the same random spot if the clip is rebuilt (after a refresh, say).
      clip = makeClip(r.id, it, undefined, st.clipStart != null ? st.clipStart : random ? 'random' : undefined);
    }
    clip.onupdate = updateProgress;
    clip.onend = () => { updatePlayButton(); };
    await clip.play();
    if (random && st.clipStart == null) { st.clipStart = clip.start; saveGame(); }
    updatePlayButton();
  } catch (e) {
    clip = null;
    notify('Could not play this track: ' + e.message);
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
  const playing = !!(clip && clip.playing);
  const btn = document.getElementById('play-btn');
  if (btn) { btn.innerHTML = icon(playing ? 'pause' : 'play'); btn.setAttribute('aria-label', playing ? 'Pause' : 'Play'); }
  const deck = document.getElementById('cartridge');
  if (deck) deck.classList.toggle('playing', playing);
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
  if (game.flash) setTimeout(() => {
    document.querySelectorAll('.contestant .flash').forEach((el) => el.remove());
  }, 1500);
}

// ---------- trivia timer ----------

function toggleTriviaTimer() {
  if (triviaTimer) { stopTriviaTimer(); render(); return; }
  const st = game.item;
  if (st.timeLeft <= 0) st.timeLeft = round().seconds;
  triviaTimer = setInterval(() => {
    st.timeLeft--;
    const el = document.getElementById('trivia-timer');
    if (el) el.innerHTML = flaps('trivia', st.timeLeft, 2, 'xl');
    const wrap = document.getElementById('trivia-timer-wrap');
    if (wrap) wrap.classList.toggle('urgent', st.timeLeft <= 5);
    if (st.timeLeft <= 0) {
      stopTriviaTimer();
      playJingle(false);
      render();
    }
  }, 1000);
  render();
}

// ---------- editor ----------

function audioPicker(path, src) {
  src = src || { kind: 'tune', tune: 'twinkle' };
  const kinds = [['tune', 'Built-in tune'], ['file', 'Audio file from this device'], ['url', 'Web link to an audio file']];
  let detail = '';
  if (src.kind === 'tune') {
    detail = `<select data-path="${path}.tune">${Object.entries(TUNES).map(([id, t]) => `<option value="${id}" ${src.tune === id ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}</select>`;
  } else if (src.kind === 'file') {
    detail = `<span class="file-name">${src.fileName ? esc(src.fileName) : 'No file chosen yet'}</span>
      <label class="btn btn-secondary file-btn">${src.fileName ? 'Choose a different file' : 'Choose audio file'}
        <input class="file-input" type="file" accept="audio/*,.mp3,.m4a,.wav,.ogg,.aac" data-file-path="${path}">
      </label>
      <span class="hint">If no file picker opens, open this page in your phone's browser (Chrome or Safari) instead of inside another app, or use a web link.</span>`;
  } else {
    detail = `<input type="url" placeholder="https://example.com/song.mp3" value="${esc(src.url || '')}" data-path="${path}.url">`;
  }
  return `<div class="audio-picker">
    <select data-path="${path}.kind" data-rerender="1">${kinds.map(([k, l]) => `<option value="${k}" ${src.kind === k ? 'selected' : ''}>${l}</option>`).join('')}</select>
    ${detail}
  </div>`;
}

function field(label, path, value, type = 'text', extra = '') {
  return `<label class="field"><span>${label}</span><input type="${type}" value="${esc(value)}" data-path="${path}" ${type === 'number' ? 'step="0.1" min="0"' : ''} ${extra}></label>`;
}

function editorItem(rid, it, idx) {
  const p = rid + '.' + idx;
  let fields = '';
  if (rid === 'r4') {
    fields = field('Question', p + '.question', it.question) + field('Answer', p + '.answer', it.answer);
  } else {
    if (rid === 'final') fields += field('Category (announced before wagers)', p + '.category', it.category);
    if (rid === 'r5') {
      fields += `<label class="field"><span>Style</span><select data-path="${p}.mode" data-rerender="1">${Object.entries(MASHUP_MODES).map(([k, l]) => `<option value="${k}" ${it.mode === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>`;
    }
    fields += `<div class="field-row">${field(rid === 'r5' && it.mode === 'layer' ? 'Song 1 title' : 'Song title', p + '.title', it.title)}${field('Artist', p + '.artist', it.artist)}</div>`;
    fields += `<div class="field"><span>Music</span>${audioPicker(p + '.audio', it.audio)}</div>`;
    if (rid === 'r5' && it.mode === 'layer') {
      fields += `<div class="field-row">${field('Song 2 title', p + '.title2', it.title2)}${field('Artist', p + '.artist2', it.artist2)}</div>`;
      fields += `<div class="field"><span>Song 2 music</span>${audioPicker(p + '.audio2', it.audio2)}</div>`;
    }
    if (rid === 'r3') {
      fields += field('Lyric shown on screen (optional)', p + '.before', it.before);
      fields += field('Answer: the next line', p + '.next', it.next);
    }
    fields += `<div class="field-row">${field('Clip starts at (seconds)', p + '.start', it.start, 'number')}`;
    if (rid === 'r3') fields += field('Stop the music at (seconds)', p + '.stopAt', it.stopAt, 'number');
    if (rid === 'r5') fields += field('Clip length (seconds)', p + '.length', it.length || 20, 'number');
    fields += '</div>';
  }
  return `<div class="edit-item">
    <div class="edit-item-head">
      <b>${rid === 'r4' ? 'Question' : 'Track'} ${idx + 1}</b>
      <div class="row">
        ${rid !== 'r4' ? `<button class="btn btn-ghost btn-small" data-action="preview" data-idx="${idx}">▶ Preview</button>` : ''}
        <button class="btn btn-ghost btn-small" data-action="move" data-idx="${idx}" data-dir="-1" ${idx === 0 ? 'disabled' : ''}>↑</button>
        <button class="btn btn-ghost btn-small" data-action="move" data-idx="${idx}" data-dir="1">↓</button>
        <button class="btn btn-ghost btn-small danger" data-action="remove" data-idx="${idx}">Delete</button>
      </div>
    </div>
    ${fields}
  </div>`;
}

function renderEditor() {
  const r = ROUNDS.find((x) => x.id === editorRound);
  const list = pack[editorRound] || [];
  const tabs = ROUNDS.map((x) => `<button class="tab ${x.id === editorRound ? 'on' : ''}" data-action="editor-tab" data-round="${x.id}">${esc(x.name)} <span class="dim">(${(pack[x.id] || []).length})</span></button>`).join('');
  return `
  <main class="editor">
    ${topbar('Songs', { actions: '<button class="btn btn-primary btn-small" data-action="home">Done</button>' })}
    <div class="screen-title">Songs and questions</div>
    <p class="hint" style="margin:0">Changes save automatically in this browser. Audio files you add stay on this computer and are never uploaded. Recommended counts from the rules: 10, 8, 8, 10, 6 and 1. Leave a round empty to skip it.</p>
    ${renderLibrary()}
    <nav class="tabs">${tabs}</nav>
    <section class="card"><div class="card-body">
      <h2>${esc(r.name)}</h2>
      <ul class="rules small">${r.rules.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
      ${list.map((it, idx) => editorItem(editorRound, it, idx)).join('') || '<p class="dim">No tracks yet. This round will be skipped.</p>'}
      <button class="dashed-btn" data-action="add-item">+ Add ${editorRound === 'r4' ? 'question' : 'track'}</button>
    </div></section>
    <section class="card"><div class="card-body">
      <h2>Backup</h2>
      <p class="dim">Save your question pack to a file, or load one. (Audio files are not included; built-in tunes and web links are.)</p>
      <div class="row">
        <button class="btn btn-secondary" data-action="export">Download pack</button>
        <label class="btn btn-secondary file-btn">Load pack<input class="file-input" type="file" accept=".json,application/json" data-import></label>
        <button class="btn btn-ghost danger" data-action="reset-pack">Reset to starter pack</button>
      </div>
    </div></section>
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

function getPath(path) {
  return path.split('.').reduce((o, k) => (o == null ? o : o[k]), pack);
}

function setPath(path, value) {
  const keys = path.split('.');
  let o = pack;
  keys.slice(0, -1).forEach((k) => { if (o[k] == null) o[k] = {}; o = o[k]; });
  o[keys[keys.length - 1]] = value;
  savePack();
}

function newEditorItem(rid) {
  if (rid === 'r4') return { question: '', answer: '' };
  const base = { title: '', artist: '', audio: { kind: 'file' }, start: 0 };
  if (rid === 'r3') return { ...base, before: '', next: '', stopAt: 10 };
  if (rid === 'r5') return { ...base, mode: 'layer', title2: '', artist2: '', audio2: { kind: 'file' }, length: 20 };
  if (rid === 'final') return { ...base, category: '' };
  return base;
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

async function preview(idx) {
  if (previewClip && previewClip.playing) { previewClip.stop(); previewClip = null; return; }
  try {
    previewClip = makeClip(editorRound, pack[editorRound][idx], editorRound === 'r2' ? 5 : undefined);
    await previewClip.play();
  } catch (e) {
    notify('Could not play this track: ' + e.message);
  }
}

// Moves the tuning dial without redrawing the screen, so dragging stays smooth.
function setWagerDraft(v) {
  const st = game.item;
  const max = wagerMax(st.cur);
  st.draft = Math.max(0, Math.min(max, v));
  const d = dialParts(max, st.draft);
  const needle = document.getElementById('needle');
  const knob = document.getElementById('knob');
  const readout = document.getElementById('wager-readout');
  const range = document.querySelector('[data-wager-range]');
  if (needle) needle.style.left = d.needle;
  if (knob) knob.style.transform = d.knob;
  if (readout) readout.innerHTML = flaps('wager', st.draft, 3, '', 'amber');
  if (range && +range.value !== st.draft) range.value = st.draft;
}

// ---------- events ----------

app.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el || el.disabled) return;
  const a = el.dataset.action;
  const st = game && game.item;
  switch (a) {
    case 'open-teams': screen = 'teams'; render(); break;
    case 'howto': screen = 'howto'; render(); break;
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
    case 'big-buzz':
      if (st.buzzed !== null || st.done) break;
      st.picking = !st.picking;
      if (st.picking) { if (clip) clip.pause(); updatePlayButton(); playBuzz(0); }
      render();
      break;
    case 'new-game':
      if (game && game.phase !== 'end') ask('Start a new game? The game in progress will be lost.', 'Start new game', newGame);
      else newGame();
      break;
    case 'resume': screen = 'game'; render(); break;
    case 'open-editor': screen = 'editor'; render(); break;
    case 'home': stopClip(); stopTriviaTimer(); if (previewClip) previewClip.stop(); screen = 'home'; render(); window.scrollTo(0, 0); break;
    case 'play-again': game = null; saveGame(); screen = 'home'; render(); break;
    case 'skip-round':
      ask('Skip the rest of this round?', 'Skip round', () => {
        if (round().type === 'final') { game.phase = 'end'; stopClip(); saveGame(); render(); } else nextRound();
      });
      break;
    case 'start-round': startRound(); break;
    case 'next-round': nextRound(); break;
    case 'buzz': buzz(+el.dataset.team); break;
    case 'adjust': addPoints(+el.dataset.team, +el.dataset.pts); saveGame(); render(); break;
    case 'toggle-play': togglePlay(); break;
    case 'restart': restartClip(); break;
    case 'stage': {
      const k = +el.dataset.stage;
      st.stage = Math.max(st.stage, k + 1);
      saveGame();
      render();
      playClip(round().stages[k]);
      break;
    }
    case 'judge': judge(el.dataset.kind, +el.dataset.points); break;
    case 'reveal': st.revealed = true; if (round().type !== 'trivia' && round().type !== 'final') st.done = true; saveGame(); render(); break;
    case 'next-item': nextItem(); break;
    case 'trivia-timer': toggleTriviaTimer(); break;
    case 'mark': st.marks[+el.dataset.team] = !st.marks[+el.dataset.team]; saveGame(); render(); break;
    case 'trivia-next':
      if (!st.done) {
        st.done = true;
        st.marks.forEach((m, i) => { if (m) game.teams[i].score += round().points; });
        if (st.marks.some(Boolean)) playJingle(true);
      }
      nextItem();
      break;
    // final showdown wagers: one team at a time, kept secret
    case 'wager-tab': st.cur = +el.dataset.team; st.draft = 0; render(); break;
    case 'preset': {
      const max = wagerMax(st.cur);
      const v = +el.dataset.frac === 1 ? max : Math.round((max * +el.dataset.frac) / 5) * 5;
      setWagerDraft(Math.min(max, v));
      break;
    }
    case 'seal': {
      st.wagers[st.cur] = Math.max(0, Math.min(wagerMax(st.cur), Math.floor(st.draft) || 0));
      st.sealed[st.cur] = true;
      st.draft = 0;
      const next = st.sealed.findIndex((x) => !x);
      if (next >= 0) st.cur = next; else st.step = 'play';
      saveGame();
      render();
      break;
    }
    case 'unseal': st.sealed[st.cur] = false; st.draft = 0; saveGame(); render(); break;
    case 'seal-next': if (st.sealed.every(Boolean)) { st.step = 'play'; saveGame(); render(); } break;
    case 'apply-final':
      stopClip();
      game.roundStart = game.teams.map((t) => t.score);
      st.marks.forEach((m, i) => { game.teams[i].score += m ? st.wagers[i] : -st.wagers[i]; });
      playJingle(true);
      game.phase = 'end';
      saveGame();
      render();
      break;
    // editor
    case 'editor-tab': if (previewClip) previewClip.stop(); editorRound = el.dataset.round; render(); break;
    case 'add-item': (pack[editorRound] = pack[editorRound] || []).push(newEditorItem(editorRound)); savePack(); render(); break;
    case 'remove':
      ask('Delete this ' + (editorRound === 'r4' ? 'question' : 'track') + '?', 'Delete', () => { pack[editorRound].splice(+el.dataset.idx, 1); savePack(); render(); });
      break;
    case 'move': {
      const list = pack[editorRound];
      const i = +el.dataset.idx;
      const j = i + +el.dataset.dir;
      if (j < 0 || j >= list.length) return;
      [list[i], list[j]] = [list[j], list[i]];
      savePack();
      render();
      break;
    }
    case 'preview': preview(+el.dataset.idx); break;
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
    case 'export': {
      const blob = new Blob([JSON.stringify(pack, null, 2)], { type: 'application/json' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = 'musical-wits-pack.json';
      link.click();
      break;
    }
    case 'reset-pack':
      ask('Replace all your questions with the starter pack?', 'Replace', () => { pack = demoPack(); savePack(); render(); });
      break;
  }
});

app.addEventListener('input', (e) => {
  const t = e.target;
  if (t.dataset.setupName !== undefined) {
    if (/\n/.test(t.value)) { t.value = t.value.replace(/\n/g, ''); t.blur(); }
    setup.names[+t.dataset.setupName] = t.value; saveSetup();
  }
  if (t.dataset.wagerRange !== undefined) setWagerDraft(+t.value);
  if (t.dataset.libSearch !== undefined) {
    librarySearch = t.value;
    document.getElementById('lib-rows').innerHTML = renderLibraryRows();
  }
});

app.addEventListener('change', async (e) => {
  const t = e.target;
  if (t.dataset.action === 'no-negative') { setup.noNegative = t.checked; saveSetup(); return; }
  if (t.dataset.setting) { settings[t.dataset.setting] = t.checked; saveSettings(); return; }
  if (t.dataset.libField) { library[+t.dataset.lib][t.dataset.libField] = t.value.trim(); saveLibrary(); return; }
  if (t.dataset.libraryAdd !== undefined && t.files.length) {
    await addSongs(t.files);
    return;
  }
  if (t.dataset.path) {
    const val = t.type === 'number' ? (t.value === '' ? '' : +t.value) : t.value;
    setPath(t.dataset.path, val);
    if (t.dataset.path.endsWith('.kind')) {
      const base = t.dataset.path.slice(0, -5);
      const fresh = { kind: val };
      if (val === 'tune') fresh.tune = 'twinkle';
      setPath(base, fresh);
    }
    if (t.dataset.rerender) render();
    return;
  }
  if (t.dataset.filePath && t.files[0]) {
    const file = t.files[0];
    const id = 'f' + Date.now() + Math.random().toString(36).slice(2, 7);
    const old = getPath(t.dataset.filePath);
    await FileStore.put(id, file);
    if (old && old.fileId) FileStore.remove(old.fileId).catch(() => {});
    setPath(t.dataset.filePath, { kind: 'file', fileId: id, fileName: file.name });
    // Fill in the title from the file name if it is empty.
    const itemPath = t.dataset.filePath.replace(/\.audio2?$/, '');
    const titleKey = t.dataset.filePath.endsWith('audio2') ? 'title2' : 'title';
    if (!getPath(itemPath + '.' + titleKey)) setPath(itemPath + '.' + titleKey, file.name.replace(/\.[^.]+$/, ''));
    render();
    return;
  }
  if (t.dataset.import !== undefined && t.files[0]) {
    try {
      const data = JSON.parse(await t.files[0].text());
      if (!data || typeof data !== 'object' || !ROUNDS.some((r) => Array.isArray(data[r.id]))) throw new Error('not a Musical Wits pack');
      pack = data;
      savePack();
      render();
    } catch (err) {
      notify('Could not load that file: ' + err.message);
    }
  }
});

// Remember whether the song list is open across re-renders.
app.addEventListener('toggle', (e) => { if (e.target.classList.contains('lib-list')) libraryOpen = e.target.open; }, true);

document.addEventListener('keydown', (e) => {
  if (e.target.matches('input, select, textarea')) return;
  if (screen === 'player' && window.Online) {
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); Online.press(); }
    return;
  }
  if (screen !== 'game' || !game || game.phase !== 'item') return;
  const k = e.key.toUpperCase();
  const team = TEAM_KEYS.indexOf(k);
  if (team >= 0) { e.preventDefault(); buzz(team); return; }
  if (e.key === ' ') {
    const type = round().type;
    if (type === 'buzz' || (type === 'final' && game.item.step === 'play')) { e.preventDefault(); togglePlay(); }
  }
});

render();
