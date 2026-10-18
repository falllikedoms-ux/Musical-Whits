// Online play: everyone's phone becomes a buzzer.
// In the hosted copy on claude.ai the page can reach everyone who has it open (the "room").
// Everywhere else (GitHub Pages, the Android app) the host opens a room with a 4-letter code
// and phones join it with that code; see peer-room.js.
//
// How it talks:
// - The host's screen sends the game state (teams, scores, whether buzzers are open)
//   on the "state" topic. Only the artifact's owner and editors may send on it.
// - Each phone keeps its chosen team and a buzz counter in its presence. When the
//   counter goes up, the host's screen calls buzz() for that team, in the order the
//   buzzes arrive.

window.Online = (() => {
  const TEAM_KEY = 'musicalWhits.myTeam';
  let room = null;
  let canHost = false;
  let hostState = null;
  let hostHeardAt = 0;
  let pressed = false;
  let pressedAt = 0;
  let buzzCount = 0;
  const seenBuzz = {};
  let lastSent = '';
  let lastSentAt = 0;
  let myTeam = loadJSON(TEAM_KEY);
  // 'claude' in the claude.ai copy, otherwise 'code' (room codes) once PeerRoom is loaded.
  let mode = null;
  let roomCode = null;
  let linkStatus = '';
  let keepalive = null;
  const HOST_CODE_KEY = 'musicalWhits.roomCode';
  const PUBLIC_URL = 'https://falllikedoms-ux.github.io/Musical-Whits/';

  async function start() {
    if (window.claude && typeof window.claude.use === 'function') {
      room = await window.claude.use('room').catch(() => null);
      if (!room) return;
      mode = 'claude';
      const user = await window.claude.use('user').catch(() => null);
      canHost = user ? await user.canEdit().catch(() => false) : false;
      listen();
      // A player who can't edit the game opens straight onto their buzzer.
      if (!canHost && screen === 'home') screen = 'player';
      if (myTeam !== null) room.presence({ team: myTeam, buzz: 0 }).catch(() => {});
      render();
      return;
    }
    if (!window.PeerRoom) return;
    mode = 'code';
    const code = PeerRoom.cleanCode(new URLSearchParams(location.search).get('room'));
    if (code.length === 4) joinRoom(code);
    else if (loadJSON(HOST_CODE_KEY)) openRoom(loadJSON(HOST_CODE_KEY));
    render();
  }

  // Room codes: the host's screen opens a room...
  async function openRoom(code) {
    linkStatus = 'opening';
    render();
    try {
      room = await PeerRoom.host(code || PeerRoom.newCode());
      roomCode = room.code;
      saveJSON(HOST_CODE_KEY, roomCode);
      canHost = true;
      linkStatus = '';
      listen();
    } catch (err) {
      room = null;
      linkStatus = 'Could not open a room: ' + (err.message || err.type || 'no internet') + '. Try again in a moment.';
    }
    render();
  }

  // ...and each phone joins it with the code.
  async function joinRoom(code) {
    roomCode = code;
    canHost = false;
    screen = 'player';
    linkStatus = 'connecting';
    render();
    try {
      room = await PeerRoom.join(code, (status) => { linkStatus = status; if (screen === 'player') render(); });
      listen();
      if (myTeam !== null) room.presence({ team: myTeam, buzz: buzzCount });
    } catch (err) {
      room = null;
      linkStatus = 'Could not connect: ' + (err.message || err.type || 'no internet') + '. Check your internet and try again.';
    }
    render();
  }

  function closeRoom() {
    if (room && room.close) room.close();
    room = null;
    roomCode = null;
    hostState = null;
    canHost = false;
    linkStatus = '';
    clearInterval(keepalive);
    saveJSON(HOST_CODE_KEY, null);
    if (screen === 'player') screen = 'home';
    render();
  }

  function joinLink() {
    const here = /^https?:$/.test(location.protocol) && !/^(localhost|127\.)/.test(location.hostname)
      ? location.origin + location.pathname : PUBLIC_URL;
    return `${here}?room=${roomCode}`;
  }

  function listen() {
    room.on('state', (msg) => {
      if (msg.sameTab || !msg.data || typeof msg.data !== 'object') return;
      hostState = msg.data;
      hostHeardAt = Date.now();
      // A buzz the host never took (it was too late, or got lost) frees the button again.
      if (hostState.buzzed !== null || !hostState.open || Date.now() - pressedAt > 2500) pressed = false;
      if (screen === 'player') render();
    });
    room.onPeers((change) => {
      if (change.joined.length) lastSent = '';
      if (isHosting()) {
        change.joined.forEach((p) => { seenBuzz[p.peer] = Number(p.presence.buzz) || 0; });
        change.updated.forEach(onPlayerUpdate);
      }
      updateCount();
    });
    clearInterval(keepalive);
    keepalive = setInterval(() => sendState(true), 3000);
  }

  function isHosting() {
    return room && canHost && screen === 'game' && game;
  }

  // ---------- host side ----------

  function onPlayerUpdate(p) {
    if (p.sameTab) return;
    const count = Number(p.presence.buzz) || 0;
    const before = seenBuzz[p.peer] || 0;
    seenBuzz[p.peer] = count;
    const team = Number(p.presence.team);
    if (count > before && Number.isInteger(team) && team >= 0 && team < game.teams.length) buzz(team);
  }

  function currentState() {
    if (!game) return null;
    const r = game.phase === 'end' ? null : round();
    const st = game.item || {};
    const buzzRound = r && (r.type === 'buzz' || r.type === 'sprint');
    return {
      teams: game.teams.map((t) => ({ name: t.name, score: t.score })),
      round: r ? r.name : 'Final results',
      track: game.phase === 'item' && r ? `${r.type === 'trivia' ? 'Question' : 'Track'} ${game.i + 1} of ${items().length}` : '',
      phase: game.phase,
      buzzRound: !!buzzRound,
      open: !!(buzzRound && game.phase === 'item' && !st.done && st.buzzed === null),
      buzzed: st.buzzed === undefined ? null : st.buzzed,
      locked: st.locked || [],
    };
  }

  function sendState(keepalive) {
    if (!isHosting()) return;
    const state = currentState();
    const json = JSON.stringify(state);
    if (json === lastSent && (!keepalive || Date.now() - lastSentAt < 2500)) return;
    lastSent = json;
    lastSentAt = Date.now();
    room.emit('state', state).catch(() => {});
  }

  function phonesByTeam() {
    const counts = {};
    room.peers().forEach((p) => {
      if (p.sameTab) return;
      const t = Number(p.presence.team);
      if (Number.isInteger(t)) counts[t] = (counts[t] || 0) + 1;
    });
    return counts;
  }

  function updateCount() {
    const el = document.getElementById('online-count');
    if (!el || !room) return;
    const n = Object.values(phonesByTeam()).reduce((a, b) => a + b, 0);
    const phones = n ? `${n} phone${n === 1 ? '' : 's'} connected` : '';
    el.textContent = mode === 'code' && canHost ? `Room ${roomCode}${phones ? ' · ' + phones : ''}` : phones;
  }

  // ---------- player side ----------

  function chooseTeam(i) {
    myTeam = i;
    saveJSON(TEAM_KEY, i);
    room.presence({ team: i, buzz: buzzCount }).catch(() => {});
    render();
  }

  function press() {
    if (!room || myTeam === null || !hostState || !hostState.open) return;
    if ((hostState.locked || []).includes(myTeam) || pressed) return;
    pressed = true;
    pressedAt = Date.now();
    buzzCount++;
    room.presence({ team: myTeam, buzz: buzzCount }).catch(() => {});
    if (navigator.vibrate) navigator.vibrate(120);
    render();
  }

  function playerStatus() {
    const s = hostState;
    if (!s || Date.now() - hostHeardAt > 10000) return { text: 'Waiting for the host to start the show...', ready: false };
    if (s.phase !== 'item') return { text: s.phase === 'end' ? 'The show is over. Thanks for playing!' : 'Get ready for the next round.', ready: false };
    if (!s.buzzRound) return { text: 'No buzzing this round. Watch the host.', ready: false };
    if (s.buzzed !== null && s.buzzed !== undefined) {
      const who = s.teams[s.buzzed] ? s.teams[s.buzzed].name : 'A team';
      return { text: s.buzzed === myTeam ? 'You buzzed first! Answer now.' : `${who} buzzed first.`, ready: false, mine: s.buzzed === myTeam };
    }
    if ((s.locked || []).includes(myTeam)) return { text: "You're locked out of this track.", ready: false };
    if (pressed) return { text: 'Buzzed! Waiting for the host...', ready: false, mine: true };
    if (s.open) return { text: 'Buzzers are open!', ready: true };
    return { text: 'Wait for the next track.', ready: false };
  }

  function renderPlayer() {
    const s = hostState;
    const head = topbar(mode === 'code' && roomCode ? `Room ${roomCode}` : 'Player', { actions: '<button class="btn btn-small" data-online="leave">Menu</button>' });
    if (!s) {
      const waits = {
        connecting: `Connecting to room ${roomCode}...`,
        connected: `You're in room ${roomCode}! Your buzzer appears here as soon as the host starts the show.`,
        reconnecting: `Lost the connection to room ${roomCode}. Trying again...`,
        'no-room': `Can't find room ${roomCode} yet. Check the code with the host. Still trying...`,
      };
      const msg = mode === 'code'
        ? (waits[linkStatus] || linkStatus || 'Connected! Your buzzer appears here as soon as the host starts the show.')
        : 'Keep this page open. Your buzzer appears here as soon as the host starts the show.';
      return `<main class="screen">${head}
        ${dome('Player buzzer', 'Waiting', msg)}
      </main>`;
    }
    if (myTeam === null || !s.teams[myTeam]) {
      return `<main class="screen">${head}
        <div class="screen-title">Pick your team</div>
        <div class="chrome-rule" aria-hidden="true"></div>
        <div class="team-pick">${s.teams.map((t, i) => `
          <button class="btn pick team-${i}" data-online="team" data-team="${i}">${esc(t.name)}</button>`).join('')}</div>
      </main>`;
    }
    const st = playerStatus();
    const team = s.teams[myTeam];
    const scores = s.teams.map((t, i) => `<li class="team-${i} ${i === myTeam ? 'me' : ''}"><span class="team-name">${esc(t.name)}</span><span class="team-score">${t.score}</span></li>`).join('');
    return `<main class="screen team-${myTeam}">${head}
      <div class="label" style="text-align:center">${esc(s.round)}${s.track ? ' · ' + esc(s.track) : ''}</div>
      <h2 class="player-team">${esc(team.name)}</h2>
      <button class="big-buzzer ${st.ready ? 'ready' : ''} ${st.mine ? 'mine' : ''}" data-online="buzz" ${st.ready ? '' : 'disabled'} aria-label="Buzz">${st.mine ? 'BUZZED!' : 'BUZZ'}</button>
      <p class="buzz-state">${esc(st.text)}</p>
      <p class="hint" style="text-align:center">Tap the buzzer, or press the space bar on a computer.</p>
      <ol class="standings mini">${scores}</ol>
      <div class="bottom"><button class="btn btn-ghost" data-online="switch">Change team</button></div>
    </main>`;
  }

  // ---------- home screen ----------

  function homeCard() {
    if (mode === 'code') return codeCard();
    if (!room) return '';
    return `<section class="card online-card"><div class="card-body">
      <h2>Play together online</h2>
      <p>Players far away can use their own phone as a buzzer. Share this game from the page's <b>Share</b> menu with each player, then have them open it and tap <b>Join as a player</b>. Run the show from this screen as usual, and share your sound on a video call so everyone can hear the music.</p>
      <button class="btn btn-secondary" data-online="join">Join as a player</button>
    </div></section>`;
  }

  function codeCard() {
    if (room && canHost) {
      return `<section class="card online-card"><div class="card-body">
        <h2>Room ${esc(roomCode)} is open</h2>
        <div class="room-code" aria-label="Room code">${flaps('room-code', roomCode, 4, 'lg', 'amber')}</div>
        <p>Players open <b>${esc(joinLink().replace(/\?.*/, ''))}</b> on any phone or computer, tap <b>Join a room</b> and type <b>${esc(roomCode)}</b>. Or send them this link: <a href="${esc(joinLink())}">${esc(joinLink())}</a></p>
        <p class="hint">Keep this screen open while you play. Everyone needs internet.</p>
        <button class="btn btn-ghost" data-online="close">Close the room</button>
      </div></section>`;
    }
    const busy = linkStatus === 'opening';
    return `<section class="card online-card"><div class="card-body">
      <h2>Play with phones</h2>
      <p>Every player can buzz from their own phone or computer, Android or iPhone, wherever they are.</p>
      <button class="btn btn-secondary" data-online="open" ${busy ? 'disabled' : ''}>${busy ? 'Opening a room...' : 'Host: open a room'}</button>
      <p class="hint" style="margin-top:12px">Players: type the 4-letter code from the host's screen.</p>
      <div class="row join-row">
        <input type="text" class="room-input" id="room-code-input" maxlength="4" placeholder="CODE" autocapitalize="characters" autocomplete="off" aria-label="Room code">
        <button class="btn btn-secondary" data-online="join-code">Join a room</button>
      </div>
      ${linkStatus && !busy ? `<p class="hint">${esc(linkStatus)}</p>` : ''}
    </div></section>`;
  }

  function afterRender() {
    if (!room) return;
    updateCount();
    sendState(false);
  }

  app.addEventListener('click', (e) => {
    const el = e.target.closest('[data-online]');
    if (!el || el.disabled) return;
    const a = el.dataset.online;
    if (a === 'open') { openRoom(); return; }
    if (a === 'close') { closeRoom(); return; }
    if (a === 'join-code') {
      const code = PeerRoom.cleanCode(document.getElementById('room-code-input').value);
      if (code.length === 4) joinRoom(code); else notify('Type the 4-letter room code from the host\'s screen.');
      return;
    }
    if (a === 'leave' && mode === 'code' && !canHost) { closeRoom(); return; }
    if (!room) return;
    if (a === 'join') { screen = 'player'; render(); }
    else if (a === 'leave') { screen = 'home'; render(); }
    else if (a === 'team') chooseTeam(+el.dataset.team);
    else if (a === 'switch') { myTeam = null; saveJSON(TEAM_KEY, null); room.presence({ team: null }).catch(() => {}); render(); }
    else if (a === 'buzz') press();
  });

  // Keep the "waiting" message honest if the host goes quiet.
  setInterval(() => { if (screen === 'player' && room) render(); }, 5000);
  app.addEventListener('keydown', (e) => {
    if (e.target.id === 'room-code-input' && e.key === 'Enter') { e.preventDefault(); app.querySelector('[data-online="join-code"]').click(); }
  });

  setTimeout(start); // after window.Online exists, since start() re-renders
  return { renderPlayer, homeCard, afterRender, press };
})();
