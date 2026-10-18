// Room codes for phone buzzers anywhere: the GitHub Pages copy, a downloaded copy
// or the Android app. Phones connect straight to the host's screen over WebRTC.
// PeerJS's free public server only introduces them; no game data goes through it.
//
// Both sides return an object shaped like the claude.ai room that online.js uses:
// on(topic, fn), emit(topic, data), presence(patch), onPeers(fn), peers().

window.PeerRoom = (() => {
  const PREFIX = 'musicalwits-room-';
  const LETTERS = 'ABCDEFGHJKMNPQRSTUVWXYZ';
  let loading = null;

  function loadLibrary() {
    if (window.Peer) return Promise.resolve();
    if (!loading) {
      loading = new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = 'js/vendor/peerjs.min.js';
        s.onload = resolve;
        s.onerror = () => { loading = null; reject(new Error('Could not load the buzzer connection. Check your internet.')); };
        document.head.appendChild(s);
      });
    }
    return loading;
  }

  // Tests point this at a local server; normally PeerJS's own free server is used.
  const options = () => window.MW_PEER_OPTIONS || {};

  function newCode() {
    let code = '';
    for (let i = 0; i < 4; i++) code += LETTERS[Math.floor(Math.random() * LETTERS.length)];
    return code;
  }

  function cleanCode(text) {
    return String(text || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4);
  }

  function openPeer(id) {
    return new Promise((resolve, reject) => {
      const peer = id ? new window.Peer(id, options()) : new window.Peer(options());
      const fail = (err) => { peer.destroy(); reject(err); };
      peer.once('open', () => { peer.off('error', fail); resolve(peer); });
      peer.once('error', fail);
    });
  }

  function emitter() {
    const listeners = {};
    return {
      on(topic, fn) { (listeners[topic] = listeners[topic] || []).push(fn); return () => {}; },
      fire(topic, msg) { (listeners[topic] || []).forEach((fn) => fn(msg)); },
    };
  }

  function merge(target, patch) {
    for (const [k, v] of Object.entries(patch || {})) {
      if (v === null) delete target[k]; else target[k] = v;
    }
    return target;
  }

  // The host's screen: owns the room code and hears every phone.
  async function host(code) {
    await loadLibrary();
    let peer;
    for (let attempt = 0; ; attempt++) {
      try {
        peer = await openPeer(PREFIX + code);
        break;
      } catch (err) {
        // The code is still held (often by this screen before a refresh): wait, then pick a new one.
        if (err.type !== 'unavailable-id' || attempt >= 3) throw err;
        if (attempt === 2) code = newCode();
        await new Promise((r) => setTimeout(r, 2500));
      }
    }
    const phones = new Map();
    const peerFns = [];
    const view = (id) => ({ peer: id, presence: { ...phones.get(id).presence }, sameTab: false });
    const list = () => [...phones.keys()].filter((id) => phones.get(id).joined).map(view);
    const tell = (change) => peerFns.forEach((fn) => fn({ peers: list(), joined: [], left: [], updated: [], ...change }));

    peer.on('connection', (conn) => {
      conn.on('data', (msg) => {
        if (!msg || msg.type !== 'presence') return;
        let phone = phones.get(conn.peer);
        if (!phone) { phone = { conn, presence: {}, joined: false }; phones.set(conn.peer, phone); }
        phone.conn = conn;
        merge(phone.presence, msg.patch);
        // A phone counts as joined once its first presence arrives, so old buzzes aren't replayed.
        if (!phone.joined) { phone.joined = true; tell({ joined: [view(conn.peer)] }); }
        else tell({ updated: [view(conn.peer)] });
      });
      conn.on('close', () => {
        const phone = phones.get(conn.peer);
        if (phone && phone.conn === conn) { phones.delete(conn.peer); tell({ left: [{ peer: conn.peer }] }); }
      });
    });
    // Losing the introduction server doesn't drop phones already connected; just reconnect to it.
    peer.on('disconnected', () => { if (!peer.destroyed) peer.reconnect(); });
    peer.on('error', () => {});

    return {
      code,
      on: emitter().on,
      async emit(topic, data) {
        for (const { conn } of phones.values()) if (conn.open) conn.send({ type: 'emit', topic, data });
      },
      async presence() {},
      onPeers(fn) { peerFns.push(fn); return () => {}; },
      peers: list,
      close() { peer.destroy(); },
    };
  }

  // A player's phone: connects to the host and keeps trying if the link drops.
  async function join(code, onStatus) {
    await loadLibrary();
    const peer = await openPeer(null);
    const events = emitter();
    const mine = {};
    let conn = null;
    let retry = null;
    let closed = false;

    function again() {
      if (closed || retry) return;
      retry = setTimeout(() => { retry = null; connect(); }, 3000);
    }
    function connect() {
      if (closed) return;
      if (peer.disconnected) peer.reconnect();
      const c = peer.connect(PREFIX + code, { reliable: true });
      conn = c;
      c.on('open', () => { onStatus('connected'); c.send({ type: 'presence', patch: mine }); });
      c.on('data', (msg) => { if (msg && msg.type === 'emit') events.fire(msg.topic, { topic: msg.topic, data: msg.data, sameTab: false }); });
      c.on('close', () => { if (conn === c) { onStatus('reconnecting'); again(); } });
    }
    peer.on('error', (err) => {
      if (closed) return;
      onStatus(err.type === 'peer-unavailable' ? 'no-room' : 'reconnecting');
      again();
    });
    peer.on('disconnected', () => { if (!closed) again(); });
    onStatus('connecting');
    connect();

    return {
      code,
      on: events.on,
      async emit() {},
      async presence(patch) {
        merge(mine, patch);
        if (conn && conn.open) conn.send({ type: 'presence', patch });
      },
      onPeers() { return () => {}; },
      peers: () => [],
      close() { closed = true; clearTimeout(retry); peer.destroy(); },
    };
  }

  return { host, join, newCode, cleanCode };
})();
