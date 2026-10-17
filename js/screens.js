// The game-show screens, drawn in the "Midnight Lacquer" style from the design handoff:
// the jukebox home screen, contestant podiums, the applause sign and payout board,
// the 8-track and buzzer, the Hit Parade scoreboard, the tuning-dial wager and the
// Platinum Record finale. Game state and scoring live in app.js.

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

function roundNumber(r) { return ROUNDS.indexOf(r) + 1; }

// ---------- home: the jukebox ----------

function renderHome() {
  const resume = game && game.phase !== 'end'
    ? '<button class="btn btn-secondary" data-action="resume">Resume the show</button>' : '';
  const cards = ROUNDS.map((r, i) => `
    <button class="song-card" style="--band:${BANDS[i % 3]}" data-action="round-info" data-round="${r.id}">
      <span class="code">${r.code}</span><span class="name">${esc(r.name)}</span>
    </button>`).join('');
  return `
  <main class="home">
    <div class="cabinet">
      ${dome('', 'Musical<br>Wits', '', 'h1').replace('</h1>', '</h1><div class="tagline">Your ears do the thinking</div>')}
      <div class="chrome-rule thick" aria-hidden="true"></div>
      ${glassPanel(`
        <div class="glass-head"><div class="title-sm">Tonight's selections</div><span class="label">${ROUNDS.length} rounds</span></div>
        <div class="selections">${cards}</div>`)}
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
      <div class="key">BUZZ KEY ${TEAM_KEYS[i]}</div>
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
    <div class="glass-frame"><details class="glass options">
      <summary>Game options</summary>
      <label class="check"><input type="checkbox" data-action="no-negative" ${setup.noNegative ? 'checked' : ''}> Kids' edition: no negative points</label>
      <label class="check"><input type="checkbox" data-setting="randomStart" ${settings.randomStart ? 'checked' : ''}> Start each clip at a random point in the song</label>
      <p class="hint check-hint">For Name That Tune, Mashup Mayhem and the Final. Intro Sprint and Lyric Gap keep their set start.</p>
      <label class="check"><input type="checkbox" data-setting="useLibrary" ${settings.useLibrary && lib ? 'checked' : ''} ${lib ? '' : 'disabled'}> Pick songs at random from my music library${lib ? ` (${lib} song${lib === 1 ? '' : 's'})` : ''}</label>
      ${lib ? '' : '<p class="hint check-hint">Add your songs under <b>Songs</b> on the jukebox first.</p>'}
    </details></div>
    <div class="bottom">
      <button class="btn btn-primary btn-wide" data-action="new-game">Start Round 1</button>
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
  const cards = ROUNDS.map((r, i) => `
    <div class="paper-card rule-card" style="border-top:6px solid ${BANDS[i % 3]}">
      <div class="code">${r.code}</div><div class="title">${esc(r.name)}</div>
      <ul class="rules">${r.rules.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
    </div>`).join('');
  return `
  <main class="screen">
    ${topbar('How to play', { actions: `<button class="icon-btn" data-action="home" aria-label="Back to the jukebox">${icon('back')}</button>` })}
    ${dome('', 'How to<br>play', 'One host, 2 to 4 teams, five rounds and a Final Showdown.')}
    <div class="paper-card rule-card" style="border-top:6px solid var(--amber)">
      <div class="code">House rules</div><div class="title">Buzz before you answer</div>
      <ul class="rules">
        <li>One answer per buzz. A wrong answer locks that team out of the track, and the music carries on.</li>
        <li>Teams buzz with a key (${TEAM_KEYS.map((key, i) => `${key} for team ${i + 1}`).join(', ')}), by tapping their name, or from their own phone.</li>
        <li>The host may accept a close-enough answer. The host's ruling is final.</li>
        <li>Highest score after the Final Showdown wins.</li>
      </ul>
    </div>
    ${cards}
    <div class="bottom"><button class="btn btn-primary btn-wide" data-action="home">Back to the jukebox</button></div>
  </main>`;
}

// ---------- the show ----------

function gameTopbar(chip, pink) {
  const actions = `
    <span id="online-count" class="online-count"></span>
    ${game.phase !== 'end' ? `<button class="icon-btn" data-action="skip-round" aria-label="Skip round" title="Skip round">${icon('skip')}</button>` : ''}
    <button class="icon-btn" data-action="home" aria-label="Menu" title="Menu">${icon('menu')}</button>`;
  return topbar(chip, { pink, actions });
}

function renderGame() {
  if (game.phase === 'end') return renderEnd();
  const r = round();
  if (game.phase === 'intro') return renderIntro(r);
  if (game.phase === 'roundEnd') return renderRoundEnd(r);
  if (r.type === 'trivia') return renderTrivia(r);
  if (r.type === 'final') return renderFinal(r);
  return renderBuzzItem(r);
}

// Round intro: the applause sign, the dome and the payout board.
let lastApplause = null;
function renderIntro(r) {
  const n = items().length;
  const first = ROUNDS.slice(0, game.r).every((x) => !roundItems(x.id).length);
  const line = first ? HOST_LINES.opening : r.type === 'final' ? HOST_LINES.final : null;
  const noun = r.type === 'trivia' ? 'question' : 'track';
  const payout = r.payout.filter(([, v]) => !(game.noNegative && v.startsWith('-')));
  const rows = payout.map(([label, value]) => `
    <div class="payout-row">
      ${flaps(null, label, 6, '', 'mid')}
      ${flaps(null, value, Math.max(3, value.length), '', value.startsWith('-') || value === 'LOSE' ? 'pink' : 'amber')}
    </div>`).join('');
  const key = game.r + ':' + (game.roundStart || []).join(',');
  if (lastApplause !== key) { lastApplause = key; setTimeout(() => playApplause(), 50); }
  const isFinal = r.type === 'final';
  return `
  <main class="screen ${isFinal ? 'final-stage' : ''}">
    ${gameTopbar(isFinal ? 'Finale' : `Round ${roundNumber(r)} of ${ROUNDS.length - 1}`, isFinal)}
    <div class="applause-frame"><div class="applause">${bulbs(9)}<div class="applause-word">APPLAUSE</div>${bulbs(9)}</div></div>
    ${dome(isFinal ? 'The finale' : `Round ${roundNumber(r)}`, esc(r.name), r.blurb)}
    ${glassPanel(`
      <div class="glass-head"><span class="label amber">The payout</span><span class="label">${n} ${noun}${n === 1 ? '' : 's'}</span></div>
      ${rows}`)}
    ${line ? `<p class="host-line"><b>HOST SAYS</b>“${esc(line)}”</p>` : ''}
    <div class="bottom"><button class="btn btn-primary btn-wide" data-action="start-round">${isFinal ? 'Open the envelope' : 'Cue the music'}</button></div>
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

function stageLamps(r, st) {
  return `<div class="lamps" role="group" aria-label="Clip stage">${r.stages.map((s, k) => {
    const cls = st.stage === k + 1 ? 'live' : st.stage > k + 1 ? 'done' : 'next';
    return `<button class="lamp-btn ${cls}" data-action="stage" data-stage="${k}" ${k > st.stage || st.done ? 'disabled' : ''} aria-label="Play ${s} second${s === 1 ? '' : 's'}">
      <span class="lamp"></span><span class="txt">${s} SEC</span></button>`;
  }).join('')}</div>`;
}

function contestantButton(i, st, opts = {}) {
  const t = game.teams[i];
  const locked = (st.locked || []).includes(i);
  const answering = st.buzzed === i;
  const note = opts.note || (locked ? 'LOCKED OUT' : answering ? 'ANSWERING' : `READY · ${TEAM_KEYS[i]}`);
  const flash = game.flash && game.flash.team === i && Date.now() - game.flash.at < 1500
    ? `<span class="flash ${game.flash.pts < 0 ? 'down' : ''}">${signed(game.flash.pts)}</span>` : '';
  const disabled = opts.disabled !== undefined ? opts.disabled : locked || st.done || (st.buzzed !== null && st.buzzed !== undefined && !answering);
  const cls = [opts.on ? 'on' : '', locked ? 'locked' : '', answering ? 'answering' : ''].join(' ');
  return `<button class="contestant team-${i} ${cls}" data-action="${opts.action || 'buzz'}" data-team="${i}" ${disabled ? 'disabled' : ''} aria-label="${esc(t.name)}, ${note.toLowerCase()}">
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

function renderBuzzItem(r) {
  const it = item();
  const st = game.item;
  const n = items().length;
  const sprint = r.type === 'sprint';
  let clue = '';
  if (r.id === 'r3' && it.before) clue = `<div class="clue"><div class="label">Finish the line</div><div class="line">“${esc(it.before)}”</div></div>`;
  if (r.id === 'r5') clue = `<div class="clue"><div class="label">${esc(MASHUP_MODES[it.mode] || 'Mashup')}</div><div class="line">${it.mode === 'layer' ? 'Name both songs' : 'Name the song'}</div></div>`;

  const opts = optionsFor(r, it, st);
  const best = Math.max(...opts.map((o) => o.points));
  const worth = sprint
    ? `<div class="worth"><span class="label">Worth right now</span><span class="pts">${signed(r.stagePoints[Math.max(0, st.stage - 1)])}</span></div>`
    : `<div class="worth"><span class="label">${st.partial ? 'Steal is on' : 'Worth up to'}</span><span class="pts">${signed(best)}</span></div>`;

  const picking = st.buzzed === null && st.picking;
  const buzzedOn = st.buzzed !== null || picking;
  const prompt = st.buzzed !== null ? 'Answering now' : picking ? 'Who buzzed first?' : 'Contestants';
  const open = game.teams.map((t, i) => i).filter((i) => !st.locked.includes(i));

  let host;
  if (st.buzzed !== null) {
    host = `<div class="judge">${opts.map((o) => {
      const pts = game.noNegative && o.points < 0 ? 0 : o.points;
      return `<button class="btn ${o.kind === 'wrong' ? 'btn-wrong' : 'btn-right'}" data-action="judge" data-kind="${o.kind}" data-points="${o.points}">${esc(o.label)} <span class="pts">${signed(pts)}</span></button>`;
    }).join('')}</div>`;
  } else if (st.revealed) {
    host = `<div class="answer">${answerText(r.id, it)}</div>
      <button class="btn btn-primary btn-wide" data-action="next-item">${game.i + 1 < n ? 'Next track' : 'Finish the round'}</button>`;
  } else {
    const status = !open.length ? '<p class="status-line">Everyone is locked out. Reveal the answer.</p>' : '';
    host = `${status}<div class="row split" style="margin-top:0">
      <button class="btn btn-ghost" data-action="reveal">Reveal answer</button>
      <button class="btn btn-ghost" data-action="next-item">${game.i + 1 < n ? 'Skip track' : 'Finish round'}</button>
    </div>`;
  }

  return `
  <main class="screen">
    ${gameTopbar(`Track ${game.i + 1} / ${n}`)}
    ${cartridge(`Stereo 8 · Round ${roundNumber(r)}`, r.name, `${r.code.replace(/\d/, '')}${game.i + 1}<br>Mystery Track`, sprint ? stageLamps(r, st) : transport())}
    ${clue}
    ${st.done ? '' : worth}
    <div class="buzzer-ring"><button class="buzzer ${buzzedOn ? 'on' : ''}" data-action="big-buzz" ${st.done || !open.length ? 'disabled' : ''} aria-label="Buzz">${buzzedOn ? 'BUZZED!' : 'BUZZ'}</button></div>
    <div>
      <div class="label" style="margin-bottom:8px">${prompt}</div>
      <div class="contestants">${game.teams.map((t, i) => contestantButton(i, st)).join('')}</div>
    </div>
    <div class="bottom">${host}${adjustPanel()}</div>
  </main>`;
}

// ---------- trivia ----------

function renderTrivia(r) {
  const it = item();
  const st = game.item;
  const n = items().length;
  const marks = game.teams.map((t, i) => contestantButton(i, st, {
    action: 'mark', on: st.marks[i], disabled: st.done,
    note: st.marks[i] ? `RIGHT +${r.points}` : 'TAP IF RIGHT',
  })).join('');
  return `
  <main class="screen">
    ${gameTopbar(`Question ${game.i + 1} / ${n}`)}
    <div class="paper-card question-card" style="border-top:6px solid var(--teal, #3E9E98)">
      <div class="code">${r.code} · ${esc(r.name)}</div>
      <div class="title">${esc(it.question)}</div>
    </div>
    <div class="timer-wrap ${st.timeLeft <= 5 ? 'urgent' : ''}" id="trivia-timer-wrap">
      <span class="label">Seconds left</span>
      <span id="trivia-timer">${flaps('trivia', st.timeLeft, 2, 'xl')}</span>
    </div>
    <div class="row center" style="margin-top:0">
      <button class="btn btn-secondary" data-action="trivia-timer">${triviaTimer ? 'Pause timer' : st.timeLeft < r.seconds ? 'Resume timer' : `Start the ${r.seconds}-second timer`}</button>
    </div>
    ${st.revealed
      ? `<div class="answer">${answerText('r4', it)}</div>
         <div class="label">Tap every team that got it right</div>
         <div class="marks">${marks}</div>`
      : '<button class="btn btn-ghost" data-action="reveal">Reveal answer</button>'}
    <div class="bottom">
      <button class="btn btn-primary btn-wide" data-action="trivia-next" ${st.revealed ? '' : 'disabled'}>${game.i + 1 < n ? 'Award points, next' : 'Award points, finish'}</button>
      ${adjustPanel()}
    </div>
  </main>`;
}

// ---------- final showdown ----------

function envelope(category) {
  return `<div class="envelope">
    <svg class="flap-svg" aria-hidden="true" viewBox="0 0 350 44" preserveAspectRatio="none"><path d="M0 0 L175 40 L350 0" fill="#EDE3CC" stroke="#D6C9AA" stroke-width="1.5"/></svg>
    <div class="seal" aria-hidden="true">MW</div>
    <div class="code">TONIGHT'S CATEGORY</div>
    <div class="title">${esc(category || 'Mystery')}</div>
  </div>`;
}

function wagerMax(i) { return Math.max(0, game.teams[i].score); }

function dialParts(max, w) {
  const frac = max ? w / max : 0;
  return {
    needle: `calc(12px + (100% - 24px) * ${frac.toFixed(3)})`,
    knob: `rotate(${(-135 + frac * 270).toFixed(0)}deg)`,
  };
}

function renderFinal(r) {
  const it = item();
  const st = game.item;
  const header = `
    ${gameTopbar('Finale', true)}
    <div style="text-align:center">
      <h2 class="neon" style="font-size:38px;line-height:1.05;margin:0">Final Showdown</h2>
      <p style="margin:2px 0 0;font-size:13px;color:var(--paper-warm)">One song. One wager. Bet wisely.</p>
    </div>
    ${envelope(it.category)}`;

  if (st.step === 'wager') {
    const cur = st.cur;
    const t = game.teams[cur];
    const max = wagerMax(cur);
    const w = Math.min(st.draft, max);
    const tabs = game.teams.map((x, i) => `
      <button class="wager-tab ${i === cur ? 'on' : ''} ${st.sealed[i] ? 'sealed' : ''}" role="tab" aria-selected="${i === cur}" data-action="wager-tab" data-team="${i}">
        ${esc(x.name)}<span class="s">${st.sealed[i] ? 'SEALED' : x.score + ' pts'}</span>
      </button>`).join('');
    const sealedCount = st.sealed.filter(Boolean).length;
    let body;
    if (st.sealed[cur]) {
      body = `<div class="sealed-note">${esc(t.name)}'s wager is sealed.</div>
        <button class="btn btn-ghost" data-action="unseal">Change ${esc(t.name)}'s wager</button>`;
    } else {
      const snap = (v) => Math.round(v / 5) * 5;
      const d = dialParts(max, w);
      body = `
      ${glassPanel(`
        <div class="dial" aria-hidden="true">
          <div class="ticks">${'<span></span>'.repeat(21)}</div>
          <div class="scale">${[0, snap(max * 0.25), snap(max * 0.5), snap(max * 0.75), max].map((v) => `<span>${v}</span>`).join('')}</div>
          <div class="needle" id="needle" style="left:${d.needle}"></div>
        </div>
        <div class="tuner">
          <div class="knob-outer" aria-hidden="true"><div class="knob-inner" id="knob" style="transform:${d.knob}"></div></div>
          <label>TUNE YOUR WAGER
            <input type="range" min="0" max="${max}" step="${max % 5 ? 1 : 5}" value="${w}" data-wager-range ${max ? '' : 'disabled'}>
          </label>
          <span id="wager-readout" aria-live="polite">${flaps('wager', w, 3, '', 'amber')}</span>
        </div>`, 'dark')}
      <div class="presets">
        <button class="btn" data-action="preset" data-frac="0.1">Play it safe</button>
        <button class="btn" data-action="preset" data-frac="0.5">Half</button>
        <button class="btn" data-action="preset" data-frac="1">All in</button>
      </div>
      <p style="margin:0;text-align:center;font-size:13px;color:var(--paper-warm)">${max ? `Pass the phone to ${esc(t.name)}. No peeking, other teams.` : `${esc(t.name)} has no points to wager, so they play for pride.`}</p>`;
    }
    return `
    <main class="screen final-stage">
      ${header}
      <div class="tabs-row" role="tablist" aria-label="Team wagering">${tabs}</div>
      ${body}
      <div class="bottom">
        ${st.sealed[cur]
          ? `<button class="btn btn-primary btn-wide" data-action="seal-next" ${sealedCount === st.sealed.length ? '' : 'disabled'}>Play the final track</button>`
          : '<button class="btn btn-primary btn-wide" data-action="seal">Seal the envelope</button>'}
        <p class="status-line">${sealedCount} of ${st.sealed.length} wagers sealed</p>
      </div>
    </main>`;
  }

  const marks = game.teams.map((t, i) => contestantButton(i, {}, {
    action: 'mark', on: st.marks[i], disabled: false,
    note: `WAGER ${st.wagers[i]} · ${st.marks[i] ? 'RIGHT' : 'TAP IF RIGHT'}`,
  })).join('');
  return `
  <main class="screen final-stage">
    ${header}
    ${cartridge('Stereo 8 · Finale', 'The Final Track', 'B3<br>10 seconds', transport())}
    <p class="status-line">Every team writes down the title and the artist.</p>
    ${st.revealed
      ? `<div class="answer">${answerText('final', it)}</div>
         <div class="label">Tap every team that got both right</div>
         <div class="marks">${marks}</div>`
      : '<button class="btn btn-ghost" data-action="reveal">Reveal answer</button>'}
    <div class="bottom">
      ${st.revealed ? '<button class="btn btn-primary btn-wide" data-action="apply-final">Crown the champions</button>' : ''}
    </div>
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
  let nextIdx = game.r + 1;
  while (nextIdx < ROUNDS.length && !roundItems(ROUNDS[nextIdx].id).length) nextIdx++;
  const next = ROUNDS[nextIdx];
  const nextLabel = !next ? 'See the final results' : next.type === 'final' ? 'On to the Final Showdown' : `On to Round ${roundNumber(next)}`;
  return `
  <main class="screen">
    ${gameTopbar(r.type === 'final' ? 'After the final' : `After round ${roundNumber(r)}`)}
    <div style="display:flex;flex-direction:column;align-items:center;gap:2px;text-align:center">
      <div class="label" style="letter-spacing:.3em">This week's</div>
      <h2 class="neon" style="font-size:46px;line-height:1.05;margin:0">Hit Parade</h2>
      <div class="chrome-rule" style="width:100%;margin-top:8px" aria-hidden="true"></div>
    </div>
    <div style="display:flex;flex-direction:column;gap:10px">${hitParade(true)}</div>
    ${goldBadge()}
    ${glassPanel(next
      ? `<div class="label amber">Coming up next</div><div class="title-md">${next.type === 'final' ? 'The Final Showdown' : `Round ${roundNumber(next)} · ${esc(next.name)}`}</div><div style="font-size:13px;color:var(--paper-warm)">${esc(next.blurb)}</div>`
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
