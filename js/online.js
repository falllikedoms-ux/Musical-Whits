// Online play: everyone's phone becomes an answer pad, so every player can play.
// In the hosted copy on claude.ai the page can reach everyone who has it open (the "room").
// Everywhere else (GitHub Pages, the Android app) the host opens a room with a 4-letter code
// and phones join it with that code; see peer-room.js.
//
// How it talks:
// - The host's screen sends the game state (teams, scores, the four choices, the time left,
//   and after each song who was right) on the "state" topic. In the claude.ai copy only the
//   artifact's owner and editors may send on it.
// - Each phone keeps its chosen team and its latest answer ({ q: which song, c: which choice })
//   in its presence. The host's screen checks the answer and scores it.

window.Online = (() => {
  const TEAM_KEY = 'musicalWhits.myTeam';
  let room = null;
  let canHost = false;
  let hostState = null;
  let hostHeardAt = 0;
  let myPick = null; // { q, c }: this phone's answer to the current song
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
      if (myTeam !== null) room.presence({ team: myTeam }).catch(() => {});
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
      room = await PeerRoom.join(code, (status) => {
        linkStatus = status;
        // Each time the link comes up, tell the host about the songs this phone is sharing.
        if (status === 'connected') setTimeout(sendSongs, 300);
        if (screen === 'player') render();
      });
      listen();
      if (myTeam !== null) room.presence({ team: myTeam });
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
    Object.keys(pool).forEach((k) => delete pool[k]);
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
      if (screen === 'player') render();
    });
    if (mode === 'code' && room.sendTo) listenForSongs();
    if (mode === 'code' && room.send) room.on('clip-req', (msg) => answerClipRequest((msg && msg.data) || {}));
    room.onPeers((change) => {
      if (change.joined.length) lastSent = '';
      if ((change.left || []).length) change.left.forEach((p) => forgetPhone(p.peer));
      if (isHosting()) {
        change.joined.forEach(onPlayerUpdate);
        change.updated.forEach(onPlayerUpdate);
        // The round's intro explains how to answer, which depends on whether phones are in.
        if (game.phase === 'intro') render();
      }
      updateCount();
    });
    clearInterval(keepalive);
    keepalive = setInterval(() => sendState(true), 3000);
  }

  // ---------- the shared pool of songs ----------
  // A player's phone can share its songs. Only the artist and title are listed on the host's
  // screen. When one of those songs is played, the host asks that phone for a short clip, which
  // arrives as raw sound, plays once and is never saved.

  const SHARE_KEY = 'musicalWhits.share';
  const CLIP_RATE = 22050;
  const pool = {}; // phone id -> [{ id, title, artist }]
  const waiting = {}; // clip request id -> { resolve, reject, peer, timer }
  let sharing = loadJSON(SHARE_KEY) === true;
  let requests = 0;

  function canPool() { return mode === 'code' && !!room && canHost; }

  function poolInfo() {
    const lists = Object.values(pool);
    return { songs: lists.reduce((n, l) => n + l.length, 0), phones: lists.filter((l) => l.length).length };
  }

  function poolSongs() {
    if (!canPool()) return [];
    return Object.entries(pool).flatMap(([peer, list]) => list.map((s) => ({ title: s.title, artist: s.artist, audio: { kind: 'remote', peer, songId: s.id } })));
  }

  function ownerLabel(peer) {
    const p = room && room.peers ? room.peers().find((x) => x.peer === peer) : null;
    const team = p ? game && game.teams[Number(p.presence.team)] : null;
    return team ? `${team.name}'s phone` : 'a phone in the room';
  }

  function updatePoolNote() {
    const el = document.getElementById('pool-note');
    if (el) el.innerHTML = poolNoteHtml();
  }

  function listenForSongs() {
    room.on('songs', (msg) => {
      const raw = msg && msg.data && Array.isArray(msg.data.songs) ? msg.data.songs : [];
      const list = raw.slice(0, 5000)
        .filter((x) => x && x.id != null && (x.title || x.artist))
        .map((x) => ({ id: String(x.id).slice(0, 60), title: String(x.title || '').slice(0, 120), artist: String(x.artist || '').slice(0, 120) }));
      if (list.length) pool[msg.from] = list; else delete pool[msg.from];
      updatePoolNote();
    });
    room.on('clip', (msg) => {
      const d = (msg && msg.data) || {};
      const w = waiting[d.id];
      if (!w || w.peer !== msg.from) return;
      clearTimeout(w.timer);
      delete waiting[d.id];
      if (!d.ok || !d.pcm) { w.reject(new Error(d.error || 'The phone could not read that song.')); return; }
      const raw = d.pcm instanceof ArrayBuffer ? d.pcm : d.pcm.buffer.slice(d.pcm.byteOffset, d.pcm.byteOffset + d.pcm.byteLength);
      const rate = Number(d.rate);
      w.resolve({ rate: rate >= 8000 && rate <= 48000 ? rate : CLIP_RATE, pcm: new Int16Array(raw, 0, Math.floor(raw.byteLength / 2)) });
    });
  }

  function forgetPhone(peer) {
    delete pool[peer];
    Object.entries(waiting).forEach(([id, w]) => {
      if (w.peer !== peer) return;
      clearTimeout(w.timer);
      delete waiting[id];
      w.reject(new Error('The phone that has this song left the room.'));
    });
    updatePoolNote();
  }

  // Host: ask a phone for a clip of one of its songs.
  function fetchClip(src) {
    return new Promise((resolve, reject) => {
      if (!canPool() || !pool[src.peer]) { reject(new Error('The phone that has this song is not connected.')); return; }
      const id = Date.now().toString(36) + (++requests);
      const timer = setTimeout(() => { delete waiting[id]; reject(new Error('The phone took too long to send the clip.')); }, 25000);
      waiting[id] = { resolve, reject, peer: src.peer, timer };
      if (!room.sendTo(src.peer, 'clip-req', { id, songId: src.songId, length: src.length, random: !!src.random })) {
        clearTimeout(timer);
        delete waiting[id];
        reject(new Error('The phone that has this song is not connected.'));
      }
    });
  }

  // Phone: tell the host which songs this phone shares (an empty list when sharing is off).
  function sendSongs() {
    if (mode !== 'code' || canHost || !room || !room.send) return;
    const songs = sharing ? library.slice(0, 5000).map((s) => ({ id: s.fileId, title: s.title, artist: s.artist })) : [];
    room.send('songs', { songs });
  }

  function setSharing(on) {
    sharing = on;
    saveJSON(SHARE_KEY, on);
    sendSongs();
    render();
  }

  // Phone: cut a clip out of a song and send it, as mono sound at a low sample rate to keep it small.
  async function answerClipRequest(req) {
    const reply = (d) => room.send('clip', { id: req.id, ...d });
    try {
      if (!sharing) throw new Error('Sharing is switched off on that phone.');
      const song = library.find((s) => s.fileId === req.songId);
      if (!song) throw new Error('That phone no longer has the song.');
      const { buffer } = await loadSource({ kind: 'file', fileId: song.fileId, fileName: song.fileName });
      if (!buffer) throw new Error('That phone could not read the song.');
      const length = Math.min(30, Math.max(1, Number(req.length) || 15));
      const slack = buffer.duration - length;
      const start = req.random && slack > 0 ? +(Math.random() * slack).toFixed(1) : 0;
      const pcm = clipToPcm(buffer, start, length);
      reply({ ok: true, rate: CLIP_RATE, pcm: pcm.buffer, start });
    } catch (e) {
      reply({ ok: false, error: e.message });
    }
  }

  function clipToPcm(buffer, start, length) {
    const sr = buffer.sampleRate;
    const from = Math.floor(start * sr);
    const to = Math.min(buffer.length, Math.floor((start + length) * sr));
    const ratio = sr / CLIP_RATE;
    const n = Math.max(0, Math.floor((to - from) / ratio));
    const out = new Int16Array(n);
    const chans = [];
    for (let c = 0; c < buffer.numberOfChannels; c++) chans.push(buffer.getChannelData(c));
    for (let i = 0; i < n; i++) {
      const a = from + Math.floor(i * ratio);
      const b = Math.max(a + 1, from + Math.floor((i + 1) * ratio));
      let sum = 0;
      let count = 0;
      for (let k = a; k < b && k < to; k++) for (const ch of chans) { sum += ch[k]; count++; }
      out[i] = Math.max(-1, Math.min(1, count ? sum / count : 0)) * 32767;
    }
    return out;
  }

  function shareCard() {
    if (mode !== 'code' || !room || !room.send) return '';
    const n = library.length;
    if (!n) {
      return '<p class="hint" style="text-align:center">Want your own songs in the game? Add some under <b>Songs</b> (Menu, then Songs), then rejoin and tap <b>Share my songs</b>.</p>';
    }
    return `<div class="share-card">
      <button class="btn ${sharing ? 'btn-primary btn-small' : 'btn-secondary'}" data-online="share">${sharing ? `Sharing ${n} song${n === 1 ? '' : 's'} · tap to stop` : `Share my ${n} song${n === 1 ? '' : 's'}`}</button>
      <p class="hint">Only a short clip is sent when one of your songs plays, and nothing is saved. Keep this page open during the show.</p>
    </div>`;
  }

  function isHosting() {
    return room && canHost && screen === 'game' && game;
  }

  // ---------- host side ----------

  function onPlayerUpdate(p) {
    if (p.sameTab || game.phase !== 'item' || !game.item) return;
    const team = Number(p.presence.team);
    const c = Number(p.presence.c);
    if (p.presence.q !== itemKey() || game.item.mode !== 'all') return;
    if (Number.isInteger(team) && team >= 0 && team < game.teams.length && Number.isInteger(c)) answer(team, c);
  }

  function currentState() {
    if (!game) return null;
    const r = game.phase === 'end' ? null : round();
    const st = game.phase === 'item' ? game.item : null;
    const it = st ? item() : null;
    const open = !!(st && st.mode === 'all' && st.startedAt !== null && !st.done);
    const picks = {};
    const pts = {};
    if (st) Object.entries(st.answers).forEach(([team, a]) => { picks[team] = a.c; if (st.done) pts[team] = a.pts || 0; });
    return {
      teams: game.teams.map((t) => ({ name: t.name, score: t.score })),
      round: r ? r.name : 'Final results',
      track: st ? `Song ${game.i + 1} of ${items().length}` : '',
      phase: game.phase,
      key: st ? itemKey() : null,
      mode: st ? st.mode : null,
      ask: it ? it.ask : null,
      points: r ? r.points : 0,
      open,
      done: !!(st && st.done),
      choices: st && (open || st.done) ? it.choices : null,
      total: r ? answerWindowMs(r) : 0,
      picks,
      correct: st && st.done ? it.correct : null,
      answer: st && st.done ? { title: it.title, artist: it.artist } : null,
      pts,
    };
  }

  function sendState(keepalive) {
    if (!isHosting()) return;
    const state = currentState();
    const json = JSON.stringify(state);
    if (json === lastSent && (!keepalive || Date.now() - lastSentAt < 2500)) return;
    lastSent = json;
    lastSentAt = Date.now();
    // The time left changes constantly, so it rides along without counting as a change.
    state.left = state.open ? answerTimeLeft() : 0;
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

  function phoneCount() {
    return room && canHost ? Object.values(phonesByTeam()).reduce((a, b) => a + b, 0) : 0;
  }

  function teamHasPhone(i) {
    return !!(room && canHost && phonesByTeam()[i]);
  }

  function updateCount() {
    const el = document.getElementById('online-count');
    if (!el || !room) return;
    const n = phoneCount();
    const phones = n ? `${n} phone${n === 1 ? '' : 's'}` : '';
    el.textContent = mode === 'code' && canHost ? `Room ${roomCode}${phones ? ' · ' + phones : ''}` : phones;
  }

  // ---------- player side ----------

  function chooseTeam(i) {
    myTeam = i;
    saveJSON(TEAM_KEY, i);
    room.presence({ team: i }).catch(() => {});
    render();
  }

  function teamPick() {
    const s = hostState;
    if (!s || myTeam === null) return undefined;
    if (s.picks && s.picks[myTeam] !== undefined) return s.picks[myTeam];
    return myPick && myPick.q === s.key ? myPick.c : undefined;
  }

  // Tapping one of the four choices: sent once, and it can't be changed.
  function pick(c) {
    const s = hostState;
    if (screen !== 'player' || !room || myTeam === null || !s || !s.open || !s.choices || c >= s.choices.length) return;
    if (teamPick() !== undefined) return;
    myPick = { q: s.key, c };
    room.presence({ team: myTeam, q: s.key, c }).catch(() => {});
    if (navigator.vibrate) navigator.vibrate(60);
    render();
  }

  function timeLeft() {
    return hostState && hostState.open ? Math.max(0, (hostState.left || 0) - (Date.now() - hostHeardAt)) : 0;
  }

  function standings(s) {
    return `<ol class="standings mini">${s.teams.map((t, i) => `<li class="team-${i} ${i === myTeam ? 'me' : ''}"><span class="team-name">${esc(t.name)}</span><span class="team-score">${t.score}</span></li>`).join('')}</ol>`;
  }

  function renderPlayer() {
    const s = hostState;
    const head = topbar(mode === 'code' && roomCode ? `Room ${roomCode}` : 'Player', { actions: '<button class="btn btn-small" data-online="leave">Menu</button>' });
    const quiet = s && Date.now() - hostHeardAt > 10000;
    if (!s || quiet) {
      const waits = {
        connecting: `Connecting to room ${roomCode}...`,
        connected: `You're in room ${roomCode}! The game appears here as soon as the host starts the show.`,
        reconnecting: `Lost the connection to room ${roomCode}. Trying again...`,
        'no-room': `Can't find room ${roomCode} yet. Check the code with the host. Still trying...`,
      };
      const msg = mode === 'code'
        ? (waits[linkStatus] || linkStatus || 'Connected! The game appears here as soon as the host starts the show.')
        : 'Keep this page open. The game appears here as soon as the host starts the show.';
      return `<main class="screen">${head}
        ${dome('Player', 'Waiting', msg)}
        ${shareCard()}
      </main>`;
    }
    if (myTeam === null || !s.teams[myTeam]) {
      return `<main class="screen">${head}
        <div class="screen-title">Pick your team</div>
        <div class="chrome-rule" aria-hidden="true"></div>
        <div class="team-pick">${s.teams.map((t, i) => `
          <button class="btn pick team-${i}" data-online="team" data-team="${i}">${esc(t.name)}</button>`).join('')}</div>
        ${shareCard()}
      </main>`;
    }
    const team = s.teams[myTeam];
    const mine = teamPick();
    const ask = s.ask === 'title' ? 'What\'s the song called?' : 'Who\'s the artist?';
    let body;
    if (s.phase === 'end') {
      const top = Math.max(...s.teams.map((t) => t.score));
      body = `<div class="verdict ${team.score === top ? 'right' : ''}"><div class="big">${team.score === top ? 'You win!' : 'That\'s the show'}</div><p>Thanks for playing.</p></div>`;
    } else if (s.phase !== 'item') {
      body = `<div class="verdict"><div class="big">Get ready</div><p>${s.phase === 'intro' ? `${esc(s.round)} is about to start.` : 'Scores are in. Next round coming up.'}</p></div>`;
    } else if (s.mode !== 'all') {
      body = '<div class="verdict"><div class="big">Watch the big screen</div><p>This song is being answered on the host\'s screen. Your phone joins in from the next song.</p></div>';
    } else if (s.done) {
      const got = s.pts && s.pts[myTeam];
      body = `
        <div class="verdict ${got ? 'right' : 'wrong'}">
          <div class="big">${got ? '+' + got : mine === undefined ? 'No answer' : 'Not this time'}</div>
          <p>${s.answer.artist ? `<b>${esc(s.answer.artist)}</b> · ` : ''}“${esc(s.answer.title)}”</p>
        </div>
        ${choiceKeys(s.choices, { id: s.key + 'done', attr: 'data-online', correct: s.correct, picked: mine, disabled: true })}`;
    } else if (s.open) {
      const total = s.total || 1;
      body = `
        <h2 class="neon ask-phone">${ask}</h2>
        <div class="answer-timer" role="timer" aria-label="Time left to answer">
          <div class="track"><div class="fill" id="player-fill" style="width:${(timeLeft() / total) * 100}%"></div></div>
          <span class="num"><span id="player-left">${Math.ceil(timeLeft() / 1000)}</span>s</span>
        </div>
        ${choiceKeys(s.choices, { id: s.key, attr: 'data-online', picked: mine, disabled: mine !== undefined })}
        <p class="buzz-state">${mine !== undefined ? 'Locked in! Waiting for the others...' : `Worth ${s.points} points. Faster is better.`}</p>`;
    } else {
      body = '<div class="verdict"><div class="big">Listen up</div><p>Your choices appear when the music starts.</p></div>';
    }
    return `<main class="screen player team-${myTeam}">${head}
      <div class="label" style="text-align:center">${esc(s.round)}${s.track ? ' · ' + esc(s.track) : ''}</div>
      <h2 class="player-team">${esc(team.name)}</h2>
      ${body}
      ${standings(s)}
      ${shareCard()}
      <div class="bottom"><button class="btn btn-ghost" data-online="switch">Change team</button></div>
    </main>`;
  }

  // Keeps the phone's countdown moving between messages from the host.
  setInterval(() => {
    if (screen !== 'player' || !hostState || !hostState.open) return;
    const bar = document.getElementById('player-fill');
    const num = document.getElementById('player-left');
    if (bar) bar.style.width = (timeLeft() / (hostState.total || 1)) * 100 + '%';
    if (num) num.textContent = Math.ceil(timeLeft() / 1000);
  }, 200);

  // ---------- home screen ----------

  function homeCard() {
    if (mode === 'code') return codeCard();
    if (!room) return '';
    return `<section class="card online-card"><div class="card-body">
      <h2>Play together online</h2>
      <p>Every player can answer on their own phone. Share this game from the page's <b>Share</b> menu with each player, then have them open it and tap <b>Join as a player</b>. Start the show from this screen, which plays the music. To play from this screen too, tap your team during a song.</p>
      <button class="btn btn-secondary" data-online="join">Join as a player</button>
    </div></section>`;
  }

  function codeCard() {
    if (room && canHost) {
      return `<section class="card online-card"><div class="card-body">
        <h2>Room ${esc(roomCode)} is open</h2>
        <div class="room-code" aria-label="Room code">${flaps('room-code', roomCode, 4, 'lg', 'amber')}</div>
        <p>Players open <b>${esc(joinLink().replace(/\?.*/, ''))}</b> on any phone or computer, tap <b>Join a room</b> and type <b>${esc(roomCode)}</b>. Or send them this link: <a href="${esc(joinLink())}">${esc(joinLink())}</a></p>
        <p class="hint">Keep this screen open while you play: it plays the music and keeps score. Everyone needs internet.</p>
        <button class="btn btn-ghost" data-online="close">Close the room</button>
      </div></section>`;
    }
    const busy = linkStatus === 'opening';
    return `<section class="card online-card"><div class="card-body">
      <h2>Play with phones</h2>
      <p>Every player answers on their own phone or computer, Android or iPhone. The game checks the answers, so the host plays too.</p>
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
    else if (a === 'choice') pick(+el.dataset.choice);
    else if (a === 'share') setSharing(!sharing);
  });

  // Keep the "waiting" message honest if the host goes quiet.
  setInterval(() => { if (screen === 'player' && room) render(); }, 5000);
  app.addEventListener('keydown', (e) => {
    if (e.target.id === 'room-code-input' && e.key === 'Enter') { e.preventDefault(); app.querySelector('[data-online="join-code"]').click(); }
  });

  setTimeout(start); // after window.Online exists, since start() re-renders
  return { renderPlayer, homeCard, afterRender, pick, phoneCount, teamHasPhone, canPool, poolInfo, poolSongs, ownerLabel, fetchClip };
})();
