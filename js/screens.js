// The game-show screens, drawn in the "Midnight Lacquer" style from the design handoff:
// the jukebox home screen, contestant podiums, the applause sign and payout board,
// the 8-track and the answer keys, the Hit Parade scoreboard and the Platinum Record finale. Game state and scoring live in app.js.

const ICONS = {
  play: '<path d="M8 5v14l11-7z" fill="currentColor" stroke="none"/>',
  pause: '<path d="M7 5h4v14H7zM13 5h4v14h-4z" fill="currentColor" stroke="none"/>',
  restart: '<path d="M4 12a8 8 0 1 0 2.3-5.7"/><path d="M4 4v4h4"/>',
  coin: '<circle cx="12" cy="12" r="9"/><path d="M12 7v10"/><path d="M9 9.5h4.5a1.75 1.75 0 0 1 0 3.5h-3a1.75 1.75 0 0 0 0 3.5H15"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  skip: '<path d="M5 5l9 7-9 7z" fill="currentColor"/><path d="M18 5v14"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  team: '<circle cx="9" cy="8" r="3"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17" cy="9" r="2.5"/><path d="M15.5 14.2A5 5 0 0 1 21 19"/>',
  book: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 19V5"/>',
  note: '<path d="M9 18V6l10-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/>',
};

function icon(name) {
  return `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;
}

const BANDS = ['#F0567A', '#F59E42', '#3E9E98'];
const PUN_NAMES = [
  'Hall & Notes', 'Bach Street Boys', 'The Rolling Tones', 'Treble Makers', 'Bass Pros', 'Note-orious',
  'Pitch Slapped', 'Fleetwood Snacks', 'Duran Duran Duran', 'Sharp Dressed Band', 'Les Mis-Fits', 'Quiz Khalifa',
];

// Split-flap number tiles. Digits that changed since the last time this board
// was drawn get the flip animation.
const shownFlaps = {};
function flaps(key, value, len, size = '', tone = '') {
  let s;
  if (typeof value === 'number') {
    s = value < 0 ? '-' + String(Math.abs(value)).padStart(len - 1, '0') : String(value).padStart(len, '0');
  } else {
    s = String(value).padStart(len, ' ');
  }
  const prev = key ? shownFlaps[key] : undefined;
  if (key) shownFlaps[key] = s;
  const tiles = s.split('').map((c, i) => {
    const flip = prev !== undefined && prev[i] !== c ? ' flip' : '';
    return `<span class="flap ${tone}${flip}" aria-hidden="true">${c === ' ' ? '&nbsp;' : esc(c)}</span>`;
  }).join('');
  return `<span class="flaps ${size}" role="img" aria-label="${esc(String(value).trim())}">${tiles}</span>`;
}

function bulbs(n) {
  return `<div class="bulbs" aria-hidden="true">${'<span class="bulb"></span>'.repeat(n)}</div>`;
}

function topbar(chip, opts = {}) {
  return `<header class="topbar">
    <div class="brand">Musical Wits</div>
    ${opts.extra || ''}
    ${chip ? `<span class="chip ${opts.pink ? 'pink' : ''}">${esc(chip)}</span>` : ''}
    ${opts.actions ? `<div class="top-actions">${opts.actions}</div>` : ''}
  </header>`;
}

function glassPanel(inner, cls = '') {
  return `<div class="glass-frame"><div class="glass ${cls}">${inner}</div></div>`;
}

function dome(kicker, title, blurb, tag = 'h2') {
  return `<div class="dome-chrome"><div class="dome-tube"><div class="dome">
    ${kicker ? `<div class="label">${esc(kicker)}</div>` : ''}
    <${tag} class="neon">${title}</${tag}>
    ${blurb ? `<p>${esc(blurb)}</p>` : ''}
  </div></div></div>`;
}

function roundNumber(r) { return activeRounds().indexOf(r) + 1; }

// ---------- home: the jukebox ----------

function renderHome() {
  const resume = game && game.phase !== 'end'
    ? '<button class="btn btn-secondary" data-action="resume">Resume the show</button>' : '';
  const rounds = plannedRounds();
  const cards = rounds.map((r, i) => `
    <button class="song-card" style="--band:${BANDS[i % 3]}" data-action="round-info" data-round="${r.id}">
      <span class="code">${r.code}</span><span class="name">${esc(r.name)}</span>
    </button>`).join('');
  const n = library.length;
  const status = n
    ? `<span class="dot on"></span><span>Playing from your music: <b>${n} song${n === 1 ? '' : 's'}</b></span>`
    : '<span class="dot"></span><span>No songs added yet, so the game plays its demo tunes. Tap here to add your music.</span>';
  return `
  <main class="home">
    <div class="cabinet">
      ${dome('', 'Musical<br>Wits', '', 'h1').replace('</h1>', '</h1><div class="tagline">Name that artist</div>')}
      <div class="chrome-rule thick" aria-hidden="true"></div>
      ${glassPanel(`
        <div class="glass-head"><div class="title-sm">Tonight's selections</div><span class="label">${rounds.length} rounds</span></div>
        <div class="selections">${cards}</div>
        <button class="lib-status" data-action="open-editor">${status}</button>`)}
      <div class="grille">
        <div class="grille-bars" aria-hidden="true">${'<span></span>'.repeat(6)}</div>
        <button class="btn btn-neon coin-btn" data-action="open-teams">${icon('coin')} Drop a coin</button>
        ${resume}
      </div>
      <div class="home-actions">
        <button class="btn" data-action="open-teams">${icon('team')} Teams</button>
        <button class="btn" data-action="howto">${icon('book')} How to play</button>
        <button class="btn" data-action="open-editor">${icon('note')} Songs</button>
      </div>
    </div>
    ${window.Online ? Online.homeCard() : ''}
  </main>`;
}

function showRoundInfo(id) {
  const r = ROUNDS.find((x) => x.id === id);
  showInfo(`${r.code} · ${r.name}`, `<p>${esc(r.blurb)}</p><ul class="rules">${r.rules.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`);
}

// ---------- teams: contestant podiums ----------

function renderTeams() {
  const podiums = setup.names.slice(0, setup.count).map((n, i) => `
    <div class="podium team-${i}">
      ${setup.count > 2 ? `<button class="remove" data-action="remove-team" data-team="${i}" aria-label="Remove team ${i + 1}">×</button>` : ''}
      ${bulbs(5)}
      <label>TEAM ${i + 1}
        <textarea rows="2" maxlength="24" placeholder="Team ${i + 1}" data-setup-name="${i}" aria-label="Team ${i + 1} name" enterkeyhint="done">${esc(n)}</textarea>
      </label>
      <div class="podium-stand">
        <div class="stripes" aria-hidden="true"><span></span><span></span><span></span></div>
        <div class="num" aria-hidden="true">${i + 1}</div>
        ${flaps(null, 0, 3)}
      </div>
      <div class="key">KEY ${TEAM_KEYS[i]}</div>
    </div>`).join('');
  const k = setup.punIdx;
  const pun = (d) => PUN_NAMES[(k + d + PUN_NAMES.length) % PUN_NAMES.length];
  const lib = library.length;
  return `
  <main class="screen">
    ${topbar('Step 1', { actions: `<button class="icon-btn" data-action="home" aria-label="Back to the jukebox">${icon('back')}</button>` })}
    <div>
      <div class="screen-title">Meet the contestants</div>
      <div class="chrome-rule" style="margin-top:6px" aria-hidden="true"></div>
    </div>
    <div class="podiums">${podiums}</div>
    ${glassPanel(`
      <div style="flex:1;display:flex;flex-direction:column;gap:8px;min-width:0">
        <div class="label amber glow">Pun-O-Matic</div>
        <div class="reel" id="reel" aria-live="polite"><span>${esc(pun(-1))}</span><span class="cur">${esc(pun(0))}</span><span>${esc(pun(1))}</span></div>
      </div>
      <button class="lever" id="lever" data-action="pun" aria-label="Pull the lever for a pun team name">
        <span class="knob"></span><span class="shaft"></span><span class="base"></span>
      </button>`, 'punomatic')}
    ${setup.count < 4 ? `<button class="dashed-btn" data-action="add-team">+ Add Team ${setup.count + 1}</button>` : ''}
    <div class="glass-frame"><details class="glass options" open>
      <summary>Game options</summary>
      <label class="check"><input type="checkbox" data-setting="titleBonus" ${settings.titleBonus ? 'checked' : ''}> Add bonus rounds for naming the song title</label>
      <label class="check"><input type="checkbox" data-setting="randomStart" ${settings.randomStart ? 'checked' : ''}> Start each clip at a random point in the song</label>
      <label class="check select">Songs in each main round
        <select data-setting="perRound">${[5, 8, 10, 15].map((v) => `<option value="${v}" ${settings.perRound === v ? 'selected' : ''}>${v}</option>`).join('')}</select>
      </label>
      <p class="hint check-hint">${lib ? `Songs come from your music library (${lib} song${lib === 1 ? '' : 's'}).` : 'No songs added yet, so this game uses the demo tunes. Add your music under <b>Songs</b> on the jukebox.'}</p>
    </details></div>
    <div class="bottom">
      <button class="btn btn-primary btn-wide" data-action="new-game">Start the show</button>
    </div>
  </main>`;
}

// Pulls the Pun-O-Matic lever: the reel spins, then the pun lands in the next empty team name.
let punSpinning = false;
function pullLever() {
  if (punSpinning) return;
  punSpinning = true;
  const reel = document.getElementById('reel');
  const lever = document.getElementById('lever');
  if (lever) lever.classList.add('pulled');
  if (reel) reel.classList.add('spinning');
  const steps = 6 + Math.floor(Math.random() * PUN_NAMES.length);
  let n = 0;
  const tick = () => {
    setup.punIdx = (setup.punIdx + 1) % PUN_NAMES.length;
    if (reel) {
      const s = reel.querySelectorAll('span');
      [-1, 0, 1].forEach((d, j) => { s[j].textContent = PUN_NAMES[(setup.punIdx + d + PUN_NAMES.length) % PUN_NAMES.length]; });
    }
    if (++n < steps) { setTimeout(tick, reducedMotion() ? 0 : 40 + n * 4); return; }
    const names = setup.names.slice(0, setup.count);
    let target = names.findIndex((x) => !x.trim());
    if (target < 0) { target = setup.punTarget % setup.count; setup.punTarget++; }
    setup.names[target] = PUN_NAMES[setup.punIdx];
    saveSetup();
    punSpinning = false;
    render();
  };
  tick();
}

function reducedMotion() {
  return window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// ---------- how to play ----------

function renderHowTo() {
  const cards = plannedRounds().map((r, i) => `
    <div class="paper-card rule-card" style="border-top:6px solid ${BANDS[i % 3]}">
      <div class="code">${r.code}</div><div class="title">${esc(r.name)}</div>
      <ul class="rules">${r.rules.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
    </div>`).join('');
  return `
  <main class="screen">
    ${topbar('How to play', { actions: `<button class="icon-btn" data-action="home" aria-label="Back to the jukebox">${icon('back')}</button>` })}
    ${dome('', 'How to<br>play', 'Hear a song, name the artist. The game checks every answer itself, so everyone plays.')}
    <div class="paper-card rule-card" style="border-top:6px solid var(--amber)">
      <div class="code">Playing on phones</div><div class="title">Everyone answers at once</div>
      <ul class="rules">
        <li>Open a room on the jukebox screen and have each player join on their own phone and pick a team.</li>
        <li>When the music starts, four choices appear on every phone. Tap yours before the timer runs out.</li>
        <li>A right answer scores the round's points, plus a bonus for answering fast.</li>
        <li>Playing on the main screen too? Tap your team there, then tap your answer.</li>
      </ul>
    </div>
    <div class="paper-card rule-card" style="border-top:6px solid var(--pink)">
      <div class="code">Playing on one screen</div><div class="title">Buzz, then pick</div>
      <ul class="rules">
        <li>Know it? Tap your team's name to buzz (or press ${TEAM_KEYS.map((key, i) => `${key} for team ${i + 1}`).join(', ')}). The music stops.</li>
        <li>Pick the answer from the four choices. Right scores the points.</li>
        <li>Wrong and your team is out for that track, that choice is crossed off, and the music carries on for the others.</li>
      </ul>
    </div>
    ${cards}
    <div class="bottom"><button class="btn btn-primary btn-wide" data-action="home">Back to the jukebox</button></div>
  </main>`;
}

// ---------- the show ----------

function gameTopbar(chip, pink) {
  const actions = `
    ${game.phase !== 'end' ? `<button class="icon-btn" data-action="skip-round" aria-label="Skip round" title="Skip round">${icon('skip')}</button>` : ''}
    <button class="icon-btn" data-action="home" aria-label="Menu" title="Menu">${icon('menu')}</button>`;
  return topbar(chip, { pink, actions }) + '<div id="online-count" class="online-count"></div>';
}

function renderGame() {
  if (game.phase === 'end') return renderEnd();
  const r = round();
  if (game.phase === 'intro') return renderIntro(r);
  if (game.phase === 'roundEnd') return renderRoundEnd(r);
  return renderItem(r);
}

// Round intro: the applause sign, the dome and the payout board.
let lastApplause = null;
function renderIntro(r) {
  const n = items().length;
  const rounds = activeRounds();
  const first = rounds[0] === r;
  const line = first ? HOST_LINES.opening : r.final ? HOST_LINES.final : null;
  const phones = window.Online && Online.phoneCount() > 0;
  const payout = [['RIGHT', '+' + r.points]];
  if (phones) payout.push(['FAST', '+' + speedBonus(r)]);
  const rows = payout.map(([label, value]) => `
    <div class="payout-row">
      ${flaps(null, label, 6, '', 'mid')}
      ${flaps(null, value, Math.max(3, value.length), '', 'amber')}
    </div>`).join('');
  const key = game.id + ':' + game.r;
  if (lastApplause !== key) { lastApplause = key; setTimeout(() => playApplause(), 50); }
  const how = phones
    ? 'Everyone answers on their own phone. Quick answers score extra.'
    : 'Tap your team to buzz in, then pick the answer.';
  return `
  <main class="screen ${r.final ? 'final-stage' : ''}">
    ${gameTopbar(r.final ? 'Finale' : `Round ${roundNumber(r)} of ${rounds.length}`, r.final)}
    <div class="applause-frame"><div class="applause">${bulbs(9)}<div class="applause-word">APPLAUSE</div>${bulbs(9)}</div></div>
    ${dome(r.final ? 'The finale' : r.bonus ? 'Bonus round' : `Round ${roundNumber(r)}`, esc(r.name), r.blurb)}
    ${glassPanel(`
      <div class="glass-head"><span class="label amber">The payout</span><span class="label">${n} song${n === 1 ? '' : 's'}</span></div>
      ${rows}
      <p class="payout-how">${how}</p>`)}
    ${line ? `<p class="host-line">“${esc(line)}”</p>` : ''}
    ${game.demo && first ? '<p class="status-line">Playing the demo tunes. Add your own music under Songs.</p>' : ''}
    <div class="bottom"><button class="btn btn-primary btn-wide" data-action="start-round">Cue the music</button></div>
  </main>`;
}

// The 8-track cartridge: label, spinning reels, and either stage lamps (Intro Sprint)
// or play controls.
function cartridge(kicker, name, side, controls) {
  return `
  <div class="cartridge ${clip && clip.playing ? 'playing' : ''}" id="cartridge">
    <div class="cart-label">
      <div class="stripes" aria-hidden="true"><span></span><span></span><span></span></div>
      <div class="body">
        <div><div class="kicker">${esc(kicker)}</div><div class="name">${esc(name)}</div></div>
        <div class="side">${side}</div>
      </div>
    </div>
    <div class="deck">
      <div class="tape-window" aria-hidden="true"><span class="reel-spool"></span><span class="reel-spool"></span></div>
      ${controls}
    </div>
    <div class="progress"><div id="progress-fill" class="progress-fill"></div></div>
    <div id="progress-time" class="progress-time">0.0s</div>
  </div>`;
}

function transport() {
  return `<div class="transport">
    <button id="play-btn" class="icon-btn play" data-action="toggle-play" aria-label="Play">${icon('play')}</button>
    <button class="icon-btn" data-action="restart" aria-label="Play from the top">${icon('restart')}</button>
  </div>`;
}

// The four answer keys, lettered like a jukebox's selection buttons. Shared with the phone screen.
//   o.attr     - the data attribute a tap is reported on
//   o.correct  - index of the right answer, once it is revealed
//   o.picked   - index this team picked;  o.struck - choices already ruled out
let keysShown = null;
function choiceKeys(choices, o = {}) {
  // The keys slide in once per song, not every time the screen redraws.
  const fresh = o.id !== keysShown;
  keysShown = o.id;
  return `<div class="choices ${fresh ? 'fresh' : ''}">${choices.map((text, c) => {
    const struck = (o.struck || []).includes(c);
    const cls = [
      o.correct === c ? 'correct' : '',
      o.picked === c ? 'picked' : '',
      struck || (o.correct != null && o.correct !== c) ? 'out' : '',
    ].join(' ');
    return `<button class="choice ${cls}" ${o.attr}="choice" data-choice="${c}" ${o.disabled || struck ? 'disabled' : ''}>
      <span class="key" aria-hidden="true">${CHOICE_KEYS[c]}</span><span class="txt">${esc(text)}</span>
    </button>`;
  }).join('')}</div>`;
}

function contestantButton(i, st) {
  const t = game.teams[i];
  const a = st.answers[i];
  const locked = st.locked.includes(i);
  const answering = st.buzzed === i;
  const onScreen = st.mode === 'all' && game.screenTeam === i && !st.done && !a;
  let note;
  let disabled;
  if (st.done) {
    note = a ? (a.pts ? `RIGHT ${signed(a.pts)}` : 'WRONG') : 'NO ANSWER';
    disabled = true;
  } else if (st.mode === 'all') {
    note = a ? 'LOCKED IN' : onScreen ? 'ANSWERING HERE' : window.Online && Online.teamHasPhone(i) ? 'ON PHONE' : 'TAP TO ANSWER';
    disabled = !!a;
  } else {
    note = locked ? 'OUT' : answering ? 'ANSWERING' : `BUZZ · ${TEAM_KEYS[i]}`;
    disabled = locked || (st.buzzed !== null && !answering);
  }
  const f = game.flash && Date.now() - game.flash.at < 1500 ? game.flash.pts[i] : 0;
  const flash = f ? `<span class="flash ${f < 0 ? 'down' : ''}">${signed(f)}</span>` : '';
  const cls = [
    locked && !st.done ? 'locked' : '', answering || onScreen ? 'answering' : '',
    st.done ? (a && a.pts ? 'right' : 'missed') : a && st.mode === 'all' ? 'in' : '',
  ].join(' ');
  return `<button class="contestant team-${i} ${cls}" data-action="team" data-team="${i}" ${disabled ? 'disabled' : ''} aria-label="${esc(t.name)}, ${note.toLowerCase()}">
    ${esc(t.name)}<span class="score">${t.score} pts</span><span class="note">${note}</span>${flash}
  </button>`;
}

function adjustPanel() {
  return `<details class="adjust-panel">
    <summary>Fix a score</summary>
    ${game.teams.map((t, i) => `<div class="adjust-row team-${i}">
      <span class="team-name">${esc(t.name)}</span>
      <button data-action="adjust" data-team="${i}" data-pts="-5" aria-label="Minus 5 for ${esc(t.name)}">−5</button>
      <button data-action="adjust" data-team="${i}" data-pts="5" aria-label="Plus 5 for ${esc(t.name)}">+5</button>
    </div>`).join('')}
  </details>`;
}

const ASK_LINES = { artist: 'Who\'s the artist?', title: 'What\'s the song called?' };

function renderItem(r) {
  const it = item();
  const st = game.item;
  const n = items().length;
  const all = st.mode === 'all';
  const started = st.startedAt !== null;
  const answered = Object.keys(st.answers).length;

  let prompt;
  if (st.done) prompt = '';
  else if (all) {
    prompt = !started ? 'Get ready...'
      : game.screenTeam !== null && !st.answers[game.screenTeam] ? `${esc(game.teams[game.screenTeam].name)}, tap your answer`
        : 'Answer on your phone. Playing on this screen? Tap your team.';
  } else {
    prompt = st.buzzed !== null ? `${esc(game.teams[st.buzzed].name)}, pick your answer`
      : st.struck.length ? 'Not that one. Anyone else? Tap your team to buzz.'
        : 'Know it? Tap your team to buzz.';
  }

  const timer = all && !st.done ? `
    <div class="answer-timer" role="timer" aria-label="Time left to answer">
      <div class="track"><div class="fill" id="answer-fill" style="width:${(answerTimeLeft() / answerWindowMs(r)) * 100}%"></div></div>
      <span class="num"><span id="answer-left">${Math.ceil(answerTimeLeft() / 1000)}</span>s</span>
      <span class="count">${answered} of ${game.teams.length} in</span>
    </div>` : '';

  const showKeys = st.done || (all ? started : st.buzzed !== null || st.struck.length > 0);
  const keys = showKeys ? choiceKeys(it.choices, {
    id: itemKey() + st.done,
    attr: 'data-action',
    correct: st.done ? it.correct : null,
    struck: st.struck,
    disabled: st.done || (!all && st.buzzed === null),
  }) : '';

  const reveal = st.done ? `
    <div class="answer">
      <div class="label">${it.ask === 'artist' ? 'The artist' : 'The song'}</div>
      <div class="answer-line">${esc(it.ask === 'artist' ? it.artist : it.title)}</div>
      <div class="answer-sub">${it.ask === 'artist' ? `“${esc(it.title)}”` : it.artist ? `by ${esc(it.artist)}` : ''}</div>
    </div>` : '';

  const bottom = st.done
    ? `<button class="btn btn-primary btn-wide" data-action="next-item">${game.i + 1 < n ? 'Next song' : r.final ? 'Crown the champions' : 'Finish the round'}</button>`
    : `<div class="row split" style="margin-top:0">
        <button class="btn btn-ghost" data-action="reveal">${all && answered ? 'Lock answers now' : 'Reveal answer'}</button>
        <button class="btn btn-ghost" data-action="next-item">${game.i + 1 < n ? 'Skip song' : 'Skip to the end'}</button>
      </div>`;

  return `
  <main class="screen ${r.final ? 'final-stage' : ''}">
    ${gameTopbar(`Song ${game.i + 1} / ${n}`, r.final)}
    ${cartridge(`${r.code} · ${r.bonus ? 'Bonus round' : r.final ? 'Finale' : 'Round ' + roundNumber(r)}`, r.name, `Worth<br><b>${r.points}</b>`, transport())}
    <div class="ask ${st.done ? 'done' : ''}">
      <h2 class="neon">${ASK_LINES[it.ask]}</h2>
      ${prompt ? `<p aria-live="polite">${prompt}</p>` : ''}
    </div>
    ${timer}
    ${reveal}
    ${keys}
    <div class="contestants ${!all && !st.done ? 'buzzers' : ''}">${game.teams.map((t, i) => contestantButton(i, st)).join('')}</div>
    <div class="bottom">${bottom}${adjustPanel()}</div>
  </main>`;
}

// ---------- scoreboard: the Hit Parade ----------

function ranks(scores) {
  return scores.map((s) => 1 + scores.filter((x) => x > s).length);
}

const ARROWS = { up: 'M6 1 L11 9 L1 9 Z', down: 'M6 11 L11 3 L1 3 Z', same: 'M1 5 H11 V7 H1 Z' };

function hitParade(withMoves) {
  const now = game.teams.map((t) => t.score);
  const before = game.roundStart && game.roundStart.length === now.length ? game.roundStart : now;
  const rk = ranks(now);
  const prev = ranks(before);
  const order = game.teams.map((t, i) => i).sort((a, b) => now[b] - now[a] || a - b);
  return order.map((i) => {
    const t = game.teams[i];
    const delta = now[i] - before[i];
    let move = '';
    if (withMoves) {
      const dir = rk[i] < prev[i] ? 'up' : rk[i] > prev[i] ? 'down' : 'same';
      const text = dir === 'up' ? `Up ${prev[i] - rk[i]}` : dir === 'down' ? `Down ${rk[i] - prev[i]}` : `Holding at #${rk[i]}`;
      const color = dir === 'up' ? '#2E7D74' : dir === 'down' ? '#B8324F' : '#4A4060';
      move = `<div class="move">
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="${ARROWS[dir]}" fill="${color}"/></svg>
        <span>${text}</span><span class="delta-chip ${delta < 0 ? 'down' : ''}">${signed(delta) || '+0'}</span></div>`;
    }
    return `<div class="chart-row team-${i} ${rk[i] === 1 ? 'leader' : ''}">
      <div class="rank">${rk[i]}</div>
      <div class="who"><div class="team-name">${esc(t.name)}</div>${move}</div>
      ${flaps('score-' + i, t.score, 3, 'lg')}
    </div>`;
  }).join('');
}

function goldBadge() {
  const g = game.gold;
  if (!g || g.team === null || g.rounds < 2 || !game.teams[g.team]) return '';
  return `<div class="gold-badge">
    <svg width="44" height="44" viewBox="0 0 44 44" role="img" aria-label="Gold record">
      <circle cx="22" cy="22" r="21" fill="#D9A23B"/><circle cx="22" cy="22" r="17" fill="none" stroke="#F5D27A"/>
      <circle cx="22" cy="22" r="13" fill="none" stroke="#B8862A"/><circle cx="22" cy="22" r="8" fill="#F0567A"/>
      <circle cx="22" cy="22" r="2" fill="#0F1430"/><path d="M9 13 A15 15 0 0 1 20 7" stroke="#FFF3C4" stroke-width="2" fill="none" stroke-linecap="round"/>
    </svg>
    <div><div class="t">${esc(game.teams[g.team].name)} went gold</div><div class="s">#1 for ${g.rounds} rounds running</div></div>
  </div>`;
}

function renderRoundEnd(r) {
  const rounds = activeRounds();
  const next = rounds[rounds.indexOf(r) + 1];
  const nextLabel = !next ? 'See the final results' : next.final ? 'On to the Encore' : next.bonus ? 'On to the bonus round' : `On to Round ${roundNumber(next)}`;
  return `
  <main class="screen">
    ${gameTopbar(`After round ${roundNumber(r)}`)}
    <div style="display:flex;flex-direction:column;align-items:center;gap:2px;text-align:center">
      <div class="label" style="letter-spacing:.3em">This week's</div>
      <h2 class="neon" style="font-size:46px;line-height:1.05;margin:0">Hit Parade</h2>
      <div class="chrome-rule" style="width:100%;margin-top:8px" aria-hidden="true"></div>
    </div>
    <div style="display:flex;flex-direction:column;gap:10px">${hitParade(true)}</div>
    ${goldBadge()}
    ${glassPanel(next
      ? `<div class="label amber">Coming up next</div><div class="title-md">${esc(next.name)}</div><div style="font-size:13px;color:var(--paper-warm)">${esc(next.blurb)}</div>`
      : '<div class="label amber">Coming up next</div><div class="title-md">The final results</div>')}
    <div class="bottom"><button class="btn btn-primary btn-wide" data-action="next-round">${nextLabel}</button></div>
  </main>`;
}

// ---------- the finale: Platinum Record ----------

function renderEnd() {
  const top = Math.max(...game.teams.map((t) => t.score));
  const winners = game.teams.filter((t) => t.score === top).map((t) => t.name);
  const colors = ['#F0567A', '#F59E42', '#3E9E98', '#FFB36B', '#FFF6E5'];
  const confetti = Array.from({ length: 28 }, (_, i) =>
    `<span style="left:${(i * 37) % 100}%;background:${colors[i % colors.length]};animation-delay:${((i % 9) * 0.4).toFixed(1)}s;animation-duration:${(3 + (i % 4) * 0.5).toFixed(1)}s"></span>`).join('');
  return `
  <main class="screen">
    <div class="confetti" aria-hidden="true">${confetti}</div>
    ${gameTopbar('Final results')}
    <div class="platinum">
      ${bulbs(11)}
      <svg class="disc" viewBox="0 0 150 150" role="img" aria-label="Platinum record">
        <defs><radialGradient id="plat" cx="40%" cy="35%"><stop offset="0" stop-color="#FFFFFF"/><stop offset=".5" stop-color="#C9CCD0"/><stop offset="1" stop-color="#7D8288"/></radialGradient></defs>
        <circle cx="75" cy="75" r="74" fill="url(#plat)"/>
        <circle cx="75" cy="75" r="62" fill="none" stroke="#EDEEEF" stroke-width="1"/>
        <circle cx="75" cy="75" r="52" fill="none" stroke="#A4A9AE" stroke-width="1"/>
        <circle cx="75" cy="75" r="42" fill="none" stroke="#EDEEEF" stroke-width="1"/>
        <circle cx="75" cy="75" r="26" fill="#F0567A"/>
        <circle cx="75" cy="75" r="4" fill="#0F1430"/>
        <path d="M30 45 A52 52 0 0 1 70 22" stroke="#FFFFFF" stroke-width="4" fill="none" stroke-linecap="round" opacity=".8"/>
      </svg>
      <div class="label amber glow">${winners.length > 1 ? "It's a tie! Certified platinum" : 'Certified platinum'}</div>
      <h2 class="neon">Platinum Record</h2>
      <div class="winner">${winners.map(esc).join(' & ')}</div>
      ${bulbs(11)}
    </div>
    <div style="display:flex;flex-direction:column;gap:10px">${hitParade(false)}</div>
    <p class="host-line">“${esc(HOST_LINES.closing)}”</p>
    <div class="bottom">
      <button class="btn btn-primary btn-wide" data-action="play-again">Play again</button>
      <button class="btn btn-secondary" data-action="home">Back to the jukebox</button>
    </div>
  </main>`;
}
