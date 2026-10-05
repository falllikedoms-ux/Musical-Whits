// Musical Whits: the screens, the game flow and the question editor.

const TEAM_KEYS = ['Q', 'P', 'Z', 'M'];
const DEFAULT_TEAM_NAMES = ['The Treble Makers', 'Bass Invaders', 'The Rolling Scones', 'Notes Alone'];
const MASHUP_MODES = { layer: 'Two songs layered', reverse: 'Played backwards', slow: 'Slowed down' };

let pack = loadJSON(PACK_KEY) || demoPack();
let game = loadJSON(GAME_KEY);
let screen = 'home';
let clip = null;
let triviaTimer = null;
let editorRound = 'r1';
let setup = { count: 3, names: DEFAULT_TEAM_NAMES.slice(), noNegative: false };

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
function items() { return pack[round().id] || []; }
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
function makeClip(roundId, it, stageSeconds) {
  const start = Number(it.start) || 0;
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
  box.innerHTML = `<div class="dialog" role="dialog" aria-modal="true">
    <p>${esc(message)}</p>
    <div class="row end">
      <button class="btn btn-ghost" data-dialog="no">Cancel</button>
      <button class="btn btn-primary" data-dialog="yes">${esc(yesLabel)}</button>
    </div></div>`;
  box.addEventListener('click', (e) => {
    const b = e.target.closest('[data-dialog]');
    if (!b && e.target !== box) return;
    box.remove();
    if (b && b.dataset.dialog === 'yes') onYes();
  });
  document.body.appendChild(box);
  box.querySelector('[data-dialog=yes]').focus();
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
    teams: setup.names.slice(0, setup.count).map((name, i) => ({ name: name.trim() || 'Team ' + (i + 1), score: 0 })),
    noNegative: setup.noNegative,
    r: 0, i: 0, phase: 'intro',
    roundStart: [],
    item: null,
  };
  skipEmptyRounds();
  game.roundStart = game.teams.map((t) => t.score);
  saveGame();
  screen = 'game';
  render();
}

function skipEmptyRounds() {
  while (game.r < ROUNDS.length && !(pack[ROUNDS[game.r].id] || []).length) game.r++;
  if (game.r >= ROUNDS.length) game.phase = 'end';
}

function freshItemState() {
  const r = round();
  if (r.type === 'trivia') return { timeLeft: r.seconds, revealed: false, marks: game.teams.map(() => false), done: false };
  if (r.type === 'final') return { step: 'wager', wagers: game.teams.map(() => 0), marks: game.teams.map(() => false), revealed: false };
  return { locked: [], buzzed: null, done: false, revealed: false, partial: false, stage: 0 };
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
  }
  saveGame();
  render();
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
  playBuzz(team);
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
  try {
    if (r.type === 'sprint') {
      stopClip();
      clip = makeClip(r.id, it, stageSeconds);
    } else if (!clip) {
      clip = makeClip(r.id, it);
    }
    clip.onupdate = updateProgress;
    clip.onend = () => { updatePlayButton(); };
    await clip.play();
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
  if (btn) btn.innerHTML = playing ? '⏸ Pause' : '▶ Play';
  const deck = document.getElementById('turntable');
  if (deck) deck.classList.toggle('playing', playing);
}

// The record player drawn next to the play controls; it spins while a clip plays.
function turntable() {
  const r = round();
  const label = r.id === 'final' ? 'Final' : 'Side ' + 'ABCDE'[game.r];
  return `
  <div id="turntable" class="turntable" aria-hidden="true">
    <div class="platter"><div class="record"><div class="record-label"><span>${label}</span></div></div></div>
    <div class="tonearm"></div>
  </div>`;
}

// ---------- rendering ----------

function render() {
  if (screen === 'editor') { app.innerHTML = renderEditor(); return; }
  if (screen === 'game' && game) { app.innerHTML = renderGame(); afterGameRender(); return; }
  app.innerHTML = renderHome();
}

function renderHome() {
  const teamInputs = setup.names.slice(0, setup.count).map((n, i) => `
    <div class="team-input team-${i}">
      <span class="key-badge">${TEAM_KEYS[i]}</span>
      <input type="text" maxlength="30" value="${esc(n)}" data-setup-name="${i}" aria-label="Team ${i + 1} name">
    </div>`).join('');
  const resume = game && game.phase !== 'end'
    ? `<button class="btn btn-secondary" data-action="resume">Resume game in progress</button>` : '';
  const counts = [2, 3, 4].map((c) => `<button class="chip ${setup.count === c ? 'on' : ''}" data-action="team-count" data-count="${c}">${c} teams</button>`).join('');
  return `
  <main class="home">
    <header class="hero">
      <div class="marquee-lights" aria-hidden="true"></div>
      <div class="logo" aria-hidden="true"></div>
      <h1>Musical Whits</h1>
      <p class="tagline">The show where your ears do the thinking.</p>
      <div class="hero-stripes" aria-hidden="true"><span></span><span></span><span></span></div>
    </header>
    <section class="card">
      <h2>Teams</h2>
      <div class="chips">${counts}</div>
      <div class="team-inputs">${teamInputs}</div>
      <p class="hint">Each team buzzes with its key on the keyboard (shown on the left), or by tapping its name on screen.</p>
      <label class="check"><input type="checkbox" data-action="no-negative" ${setup.noNegative ? 'checked' : ''}> Kids' edition: no negative points</label>
      <div class="row">
        <button class="btn btn-primary" data-action="new-game">Start the show</button>
        ${resume}
      </div>
    </section>
    <section class="card">
      <h2>Songs and questions</h2>
      <p>The game comes with placeholder tunes (public-domain melodies) so you can try it right away. Swap in your own songs from your computer or a web link.</p>
      <button class="btn btn-secondary" data-action="open-editor">Edit questions and music</button>
    </section>
    <details class="card howto">
      <summary><h2>How to host</h2></summary>
      <ol>
        <li>Put this screen where all the teams can see and hear it.</li>
        <li>Press <b>Play</b> (or the space bar) to start a clip.</li>
        <li>Teams buzz with their key: ${TEAM_KEYS.map((k, i) => `<b>${k}</b> for team ${i + 1}`).join(', ')}. The music pauses on a buzz.</li>
        <li>The team answers out loud and you press the matching scoring button. Wrong answers lock that team out and the music carries on.</li>
        <li>Use <b>Reveal answer</b> if nobody gets it, then <b>Next track</b>.</li>
        <li>The small <b>+ / −</b> buttons under each score let you fix a score at any time. Your ruling is final!</li>
      </ol>
      <p>Rounds: Name That Tune, Intro Sprint, Lyric Gap, Musical Trivia Lightning, Mashup Mayhem, then the Final Showdown wager.</p>
    </details>
  </main>`;
}

function renderScoreboard() {
  const st = game.item || {};
  const flash = game.flash && Date.now() - game.flash.at < 1500 ? game.flash : null;
  return `<div class="scoreboard">${game.teams.map((t, i) => {
    const cls = [
      'team', 'team-' + i,
      st.buzzed === i ? 'buzzed' : '',
      (st.locked || []).includes(i) ? 'locked' : '',
    ].join(' ');
    const fl = flash && flash.team === i ? `<span class="flash ${flash.pts > 0 ? 'up' : 'down'}">${signed(flash.pts)}</span>` : '';
    return `<div class="${cls}">
      <button class="team-buzz" data-action="buzz" data-team="${i}" aria-label="Buzz for ${esc(t.name)}">
        <span class="key-badge">${TEAM_KEYS[i]}</span>
        <span class="team-name">${esc(t.name)}</span>
        <span class="team-score">${t.score}</span>${fl}
        ${(st.locked || []).includes(i) ? '<span class="lock-tag">locked out</span>' : ''}
      </button>
      <div class="adjust">
        <button data-action="adjust" data-team="${i}" data-pts="-5" aria-label="Minus 5">−5</button>
        <button data-action="adjust" data-team="${i}" data-pts="5" aria-label="Plus 5">+5</button>
      </div>
    </div>`;
  }).join('')}</div>`;
}

function renderGame() {
  let body = '';
  let title = '';
  if (game.phase === 'end') {
    body = renderEnd();
    title = 'Final results';
  } else {
    const r = round();
    title = r.name;
    if (game.phase === 'intro') body = renderIntro(r);
    else if (game.phase === 'roundEnd') body = renderRoundEnd(r);
    else if (r.type === 'trivia') body = renderTrivia(r);
    else if (r.type === 'final') body = renderFinal(r);
    else body = renderBuzzItem(r);
  }
  const roundNum = game.phase !== 'end' ? (round().id === 'final' ? 'Final' : 'Round ' + (game.r + 1)) : '';
  return `
  <div class="game">
    <header class="topbar">
      <div class="brand"><span class="logo small" aria-hidden="true"></span> Musical Whits</div>
      <div class="round-label">${roundNum ? `<span class="dim">${roundNum}</span> ` : ''}${esc(title)}</div>
      <div class="top-actions">
        ${game.phase !== 'end' ? '<button class="btn btn-ghost" data-action="skip-round">Skip round</button>' : ''}
        <button class="btn btn-ghost" data-action="home">Menu</button>
      </div>
    </header>
    ${renderScoreboard()}
    <main class="stage">${body}</main>
  </div>`;
}

function renderIntro(r) {
  const n = items().length;
  const line = game.r === 0 || ROUNDS.slice(0, game.r).every((x) => !(pack[x.id] || []).length)
    ? HOST_LINES.opening : r.type === 'final' ? HOST_LINES.final : null;
  const noun = r.type === 'trivia' ? 'questions' : r.type === 'final' ? 'track' : 'tracks';
  return `
  <section class="panel intro">
    <div class="eyebrow">${r.id === 'final' ? 'The Final Showdown' : 'Round ' + (game.r + 1)}</div>
    <h2 class="big-title">${esc(r.name)}</h2>
    <ul class="rules">${r.rules.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
    <p class="dim">${n} ${noun}</p>
    ${line ? `<blockquote class="host-line"><span class="dim">Host says:</span> “${esc(line)}”</blockquote>` : ''}
    <button class="btn btn-primary btn-big" data-action="start-round">Start ${esc(r.name)}</button>
  </section>`;
}

function renderPlayer() {
  return `
  <div class="player">
    ${turntable()}
    <button id="play-btn" class="btn btn-primary btn-big" data-action="toggle-play">▶ Play</button>
    <button class="btn btn-secondary" data-action="restart">⟲ From the top</button>
    <div class="progress"><div id="progress-fill" class="progress-fill"></div></div>
    <div id="progress-time" class="progress-time dim">0.0s</div>
  </div>`;
}

function renderSprintPlayer(r, st) {
  return `
  <div class="player sprint">
    ${turntable()}
    ${r.stages.map((s, k) => `
      <button class="btn ${st.stage > k ? 'btn-secondary' : 'btn-primary'} btn-big" data-action="stage" data-stage="${k}" ${k > st.stage ? 'disabled' : ''}>
        ▶ ${s} sec <span class="stage-pts">${r.stagePoints[k]} pts</span>
      </button>`).join('')}
    <div class="progress"><div id="progress-fill" class="progress-fill"></div></div>
    <div id="progress-time" class="progress-time dim">0.0s</div>
  </div>`;
}

function renderBuzzItem(r) {
  const it = item();
  const st = game.item;
  const n = items().length;
  let clue = '';
  if (r.id === 'r3' && it.before) clue = `<p class="clue">${esc(it.before)}</p><p class="dim">What comes next?</p>`;
  if (r.id === 'r5') clue = `<p class="clue">${esc(MASHUP_MODES[it.mode] || '')}</p><p class="dim">${it.mode === 'layer' ? 'Name both songs.' : 'Name the song.'}</p>`;

  let buzzArea;
  if (st.buzzed !== null) {
    const team = game.teams[st.buzzed];
    buzzArea = `
      <div class="buzz-alert team-${st.buzzed}">
        <div class="buzz-who">${esc(team.name)} buzzed!</div>
        <div class="judge">${optionsFor(r, it, st).map((o) => `
          <button class="btn ${o.kind === 'wrong' ? 'btn-wrong' : 'btn-right'}" data-action="judge" data-kind="${o.kind}" data-points="${o.points}">
            ${esc(o.label)} <span class="pts">${signed(o.points)}</span>
          </button>`).join('')}</div>
      </div>`;
  } else if (st.done) {
    buzzArea = `<div class="buzz-status done">Track scored!</div>`;
  } else {
    const open = game.teams.map((t, i) => i).filter((i) => !st.locked.includes(i));
    buzzArea = open.length
      ? `<div class="buzz-status">Buzzers open: ${open.map((i) => `<span class="key-badge team-${i}">${TEAM_KEYS[i]}</span>`).join(' ')}${st.partial ? ' <b>Steal is on!</b>' : ''}</div>`
      : `<div class="buzz-status">Everyone is locked out. Reveal the answer.</div>`;
  }

  return `
  <section class="panel item">
    <div class="eyebrow"><span class="selection">${'ABCDE'[game.r]}${game.i + 1}</span> Track ${game.i + 1} of ${n}</div>
    ${clue}
    ${r.type === 'sprint' ? renderSprintPlayer(r, st) : renderPlayer()}
    ${buzzArea}
    <div class="answer ${st.revealed ? 'shown' : ''}">
      ${st.revealed ? answerText(r.id, it) : '<button class="btn btn-ghost" data-action="reveal">Reveal answer</button>'}
    </div>
    <div class="row end">
      <button class="btn btn-primary" data-action="next-item">${game.i + 1 < n ? 'Next track →' : 'Finish round →'}</button>
    </div>
  </section>`;
}

function renderTrivia(r) {
  const it = item();
  const st = game.item;
  const n = items().length;
  return `
  <section class="panel item">
    <div class="eyebrow">Question ${game.i + 1} of ${n}</div>
    <h2 class="question">${esc(it.question)}</h2>
    <div class="timer ${st.timeLeft <= 5 ? 'urgent' : ''}" id="trivia-timer">${st.timeLeft}</div>
    <div class="row center">
      <button class="btn btn-secondary" data-action="trivia-timer">${triviaTimer ? 'Pause timer' : st.timeLeft < r.seconds ? 'Resume timer' : 'Start 15-second timer'}</button>
    </div>
    <div class="answer ${st.revealed ? 'shown' : ''}">
      ${st.revealed ? answerText('r4', it) : '<button class="btn btn-ghost" data-action="reveal">Reveal answer</button>'}
    </div>
    ${st.revealed ? `
      <p class="dim center">Tap every team that got it right (+${r.points} each):</p>
      <div class="marks">${game.teams.map((t, i) => `
        <button class="mark team-${i} ${st.marks[i] ? 'on' : ''}" data-action="mark" data-team="${i}" ${st.done ? 'disabled' : ''}>${st.marks[i] ? '✓ ' : ''}${esc(t.name)}</button>`).join('')}</div>` : ''}
    <div class="row end">
      <button class="btn btn-primary" data-action="trivia-next" ${st.revealed ? '' : 'disabled'}>${game.i + 1 < n ? 'Award points & next →' : 'Award points & finish round →'}</button>
    </div>
  </section>`;
}

function renderFinal(r) {
  const it = item();
  const st = game.item;
  if (st.step === 'wager') {
    return `
    <section class="panel item">
      <div class="eyebrow">Category</div>
      <h2 class="big-title">${esc(it.category || 'Mystery')}</h2>
      <p>Each team secretly writes down a wager: any amount from 0 up to its current score. Then type them in here.</p>
      <div class="wagers">${game.teams.map((t, i) => `
        <label class="wager team-${i}"><span>${esc(t.name)} <span class="dim">(max ${Math.max(0, t.score)})</span></span>
          <input type="number" min="0" max="${Math.max(0, t.score)}" step="1" value="${st.wagers[i]}" data-wager="${i}">
        </label>`).join('')}</div>
      <div class="row end"><button class="btn btn-primary" data-action="lock-wagers">Lock in wagers →</button></div>
    </section>`;
  }
  return `
  <section class="panel item">
    <div class="eyebrow">Category: ${esc(it.category || 'Mystery')}</div>
    <p>One 10-second clip. Every team writes down the song title <b>and</b> the artist.</p>
    ${renderPlayer()}
    <div class="answer ${st.revealed ? 'shown' : ''}">
      ${st.revealed ? answerText('final', it) : '<button class="btn btn-ghost" data-action="reveal">Reveal answer</button>'}
    </div>
    ${st.revealed ? `
      <p class="dim center">Tap every team that got <b>both</b> the title and the artist right:</p>
      <div class="marks">${game.teams.map((t, i) => `
        <button class="mark team-${i} ${st.marks[i] ? 'on' : ''}" data-action="mark" data-team="${i}">${st.marks[i] ? '✓ ' : ''}${esc(t.name)} <span class="dim">(wager ${st.wagers[i]})</span></button>`).join('')}</div>
      <div class="row end"><button class="btn btn-primary" data-action="apply-final">Apply wagers & crown the champions →</button></div>` : ''}
  </section>`;
}

function standingsTable(showDelta) {
  const rows = game.teams.map((t, i) => ({ ...t, i, delta: t.score - (game.roundStart[i] || 0) }))
    .sort((a, b) => b.score - a.score);
  return `<ol class="standings">${rows.map((t) => `
    <li class="team-${t.i}"><span class="team-name">${esc(t.name)}</span>
      ${showDelta ? `<span class="dim delta">${signed(t.delta)} this round</span>` : ''}
      <span class="team-score">${t.score}</span></li>`).join('')}</ol>`;
}

function renderRoundEnd(r) {
  let nextIdx = game.r + 1;
  while (nextIdx < ROUNDS.length && !(pack[ROUNDS[nextIdx].id] || []).length) nextIdx++;
  const next = ROUNDS[nextIdx];
  return `
  <section class="panel intro">
    <div class="eyebrow">End of ${esc(r.name)}</div>
    <h2 class="big-title">Scoreboard</h2>
    ${standingsTable(true)}
    <blockquote class="host-line"><span class="dim">Host:</span> ${esc(HOST_LINES.between)}</blockquote>
    <button class="btn btn-primary btn-big" data-action="next-round">${next ? 'Next up: ' + esc(next.name) + ' →' : 'See final results →'}</button>
  </section>`;
}

function renderEnd() {
  const top = Math.max(...game.teams.map((t) => t.score));
  const winners = game.teams.filter((t) => t.score === top).map((t) => t.name);
  return `
  <section class="panel intro end-screen">
    <div class="confetti" aria-hidden="true">${'♪♫♬♩'.repeat(6).split('').map((c, i) => `<span style="left:${(i * 37) % 100}%;animation-delay:${(i % 8) * 0.35}s">${c}</span>`).join('')}</div>
    <div class="eyebrow">${winners.length > 1 ? 'It\'s a tie!' : 'Your champions'}</div>
    <h2 class="big-title">🏆 ${winners.map(esc).join(' & ')}</h2>
    ${standingsTable(false)}
    <blockquote class="host-line">“${esc(HOST_LINES.closing)}”</blockquote>
    <div class="row center">
      <button class="btn btn-primary" data-action="play-again">Play again</button>
      <button class="btn btn-secondary" data-action="home">Back to menu</button>
    </div>
  </section>`;
}

function afterGameRender() {
  if (clip && game.phase === 'item') {
    clip.onupdate = updateProgress;
    updateProgress(clip.pos, clip.duration || 0);
    updatePlayButton();
  }
  if (game.flash) setTimeout(() => {
    document.querySelectorAll('.flash').forEach((el) => el.remove());
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
    if (el) { el.textContent = st.timeLeft; el.classList.toggle('urgent', st.timeLeft <= 5); }
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
  const kinds = [['tune', 'Built-in tune'], ['file', 'Audio file from my computer'], ['url', 'Web link to an audio file']];
  let detail = '';
  if (src.kind === 'tune') {
    detail = `<select data-path="${path}.tune">${Object.entries(TUNES).map(([id, t]) => `<option value="${id}" ${src.tune === id ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}</select>`;
  } else if (src.kind === 'file') {
    detail = `<span class="file-name">${src.fileName ? '🎵 ' + esc(src.fileName) : 'No file yet'}</span>
      <input type="file" accept="audio/*" data-file-path="${path}">`;
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
    <header class="topbar">
      <div class="brand"><span class="logo small" aria-hidden="true"></span> Edit questions and music</div>
      <div class="top-actions"><button class="btn btn-primary" data-action="home">Done</button></div>
    </header>
    <p class="hint">Changes save automatically in this browser. Audio files you add stay on this computer and are never uploaded. Recommended counts from the rules: 10, 8, 8, 10, 6 and 1. Leave a round empty to skip it.</p>
    <nav class="tabs">${tabs}</nav>
    <section class="card">
      <h2>${esc(r.name)}</h2>
      <ul class="rules small">${r.rules.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
      ${list.map((it, idx) => editorItem(editorRound, it, idx)).join('') || '<p class="dim">No tracks yet. This round will be skipped.</p>'}
      <button class="btn btn-secondary" data-action="add-item">+ Add ${editorRound === 'r4' ? 'question' : 'track'}</button>
    </section>
    <section class="card">
      <h2>Backup</h2>
      <p class="dim">Save your question pack to a file, or load one. (Audio files are not included; built-in tunes and web links are.)</p>
      <div class="row">
        <button class="btn btn-secondary" data-action="export">Download pack</button>
        <label class="btn btn-secondary">Load pack<input type="file" accept=".json,application/json" data-import hidden></label>
        <button class="btn btn-ghost danger" data-action="reset-pack">Reset to starter pack</button>
      </div>
    </section>
  </main>`;
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
async function preview(idx) {
  if (previewClip && previewClip.playing) { previewClip.stop(); previewClip = null; return; }
  try {
    previewClip = makeClip(editorRound, pack[editorRound][idx], editorRound === 'r2' ? 5 : undefined);
    await previewClip.play();
  } catch (e) {
    notify('Could not play this track: ' + e.message);
  }
}

// ---------- events ----------

app.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el || el.disabled) return;
  const a = el.dataset.action;
  const st = game && game.item;
  switch (a) {
    case 'team-count': setup.count = +el.dataset.count; render(); break;
    case 'new-game':
      if (game && game.phase !== 'end') ask('Start a new game? The game in progress will be lost.', 'Start new game', newGame);
      else newGame();
      break;
    case 'resume': screen = 'game'; render(); break;
    case 'open-editor': screen = 'editor'; render(); break;
    case 'home': stopClip(); stopTriviaTimer(); if (previewClip) previewClip.stop(); screen = 'home'; render(); break;
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
    case 'lock-wagers':
      document.querySelectorAll('[data-wager]').forEach((inp) => {
        const i = +inp.dataset.wager;
        st.wagers[i] = Math.max(0, Math.min(Math.max(0, game.teams[i].score), Math.floor(+inp.value || 0)));
      });
      st.step = 'play';
      saveGame();
      render();
      break;
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
    case 'export': {
      const blob = new Blob([JSON.stringify(pack, null, 2)], { type: 'application/json' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = 'musical-whits-pack.json';
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
  if (t.dataset.setupName !== undefined) setup.names[+t.dataset.setupName] = t.value;
});

app.addEventListener('change', async (e) => {
  const t = e.target;
  if (t.dataset.action === 'no-negative') { setup.noNegative = t.checked; return; }
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
      if (!data || typeof data !== 'object' || !ROUNDS.some((r) => Array.isArray(data[r.id]))) throw new Error('not a Musical Whits pack');
      pack = data;
      savePack();
      render();
    } catch (err) {
      notify('Could not load that file: ' + err.message);
    }
  }
});

document.addEventListener('keydown', (e) => {
  if (e.target.matches('input, select, textarea')) return;
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
