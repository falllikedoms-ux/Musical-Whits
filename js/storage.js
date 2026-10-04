// Saving things in this browser.
// The question pack and the game in progress go in localStorage.
// Audio files the host adds go in IndexedDB (they are too big for localStorage).
// Nothing ever leaves the host's computer.

const PACK_KEY = 'musicalWhits.pack.v1';
const GAME_KEY = 'musicalWhits.game.v1';

function loadJSON(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function saveJSON(key, value) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn('Could not save', key, e);
  }
}

const FileStore = {
  db: null,
  open() {
    if (this.db) return this.db;
    this.db = new Promise((resolve, reject) => {
      const req = indexedDB.open('musicalWhits', 1);
      req.onupgradeneeded = () => req.result.createObjectStore('files');
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return this.db;
  },
  async run(mode, fn) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('files', mode);
      const req = fn(tx.objectStore('files'));
      tx.oncomplete = () => resolve(req && req.result);
      tx.onerror = () => reject(tx.error);
    });
  },
  put(id, blob) { return this.run('readwrite', (s) => s.put(blob, id)); },
  get(id) { return this.run('readonly', (s) => s.get(id)); },
  remove(id) { return this.run('readwrite', (s) => s.delete(id)); },
};
