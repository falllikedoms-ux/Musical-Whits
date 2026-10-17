// Online play: everyone's phone becomes a buzzer.
// This only works in the hosted copy of the game on claude.ai, where the page can reach
// everyone who has it open at the same moment (the "room"). Opened as a plain file it
// does nothing and the game plays exactly as before.
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

  async function start() {
    if (!window.claude || typeof window.claude.use !== 'function') return;
    room = await window.claude.use('room').catch(() => null);
    if (!room) return;
    const user = await window.claude.use('user').catch(() => null);
    canHost = user ? await user.canEdit().catch(() => false) : false;

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
    setInterval(() => sendState(true), 3000);
    // A player who can't edit the game opens straight onto their buzzer.
    if (!canHost && screen === 'home') screen = 'player';
    if (myTeam !== null) room.presence({ team: myTeam, buzz: 0 }).catch(() => {});
    render();
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
    el.textContent = n ? `📱 ${n} phone${n === 1 ? '' : 's'} connected` : '';
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
    const head = topbar('Player', { actions: '<button class="btn btn-small" data-online="leave">Menu</button>' });
    if (!s) {
      return `<main class="screen">${head}
        ${dome('Player buzzer', 'Waiting', 'Keep this page open. Your buzzer appears here as soon as the host starts the show.')}
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
    if (!room) return '';
    return `<section class="card online-card"><div class="card-body">
      <h2>Play together online</h2>
      <p>Players far away can use their own phone as a buzzer. Share this game from the page's <b>Share</b> menu with each player, then have them open it and tap <b>Join as a player</b>. Run the show from this screen as usual, and share your sound on a video call so everyone can hear the music.</p>
      <button class="btn btn-secondary" data-online="join">Join as a player</button>
    </div></section>`;
  }

  function afterRender() {
    if (!room) return;
    updateCount();
    sendState(false);
  }

  app.addEventListener('click', (e) => {
    const el = e.target.closest('[data-online]');
    if (!el || el.disabled || !room) return;
    const a = el.dataset.online;
    if (a === 'join') { screen = 'player'; render(); }
    else if (a === 'leave') { screen = 'home'; render(); }
    else if (a === 'team') chooseTeam(+el.dataset.team);
    else if (a === 'switch') { myTeam = null; saveJSON(TEAM_KEY, null); room.presence({ team: null }).catch(() => {}); render(); }
    else if (a === 'buzz') press();
  });

  // Keep the "waiting" message honest if the host goes quiet.
  setInterval(() => { if (screen === 'player' && room) render(); }, 5000);

  start();
  return { renderPlayer, homeCard, afterRender, press };
})();
