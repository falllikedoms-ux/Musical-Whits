// The host's music library: lots of songs added in one go, which the game can
// draw from at random instead of the hand-made tracks in the question pack.
// The files stay in this browser (IndexedDB), like every other audio file.
// The list of songs (title, artist, file id) goes in localStorage.

const LIBRARY_KEY = 'musicalWhits.library.v1';
const SETTINGS_KEY = 'musicalWhits.settings.v1';

let library = loadJSON(LIBRARY_KEY) || [];
let settings = { randomStart: false, useLibrary: false, ...(loadJSON(SETTINGS_KEY) || {}) };

function saveLibrary() { saveJSON(LIBRARY_KEY, library); }
function saveSettings() { saveJSON(SETTINGS_KEY, settings); }

// "03 - Queen - Bohemian Rhapsody.mp3" -> { artist: 'Queen', title: 'Bohemian Rhapsody' }
function guessFromFileName(name) {
  let base = name.replace(/\.[^.]+$/, '').replace(/_/g, ' ').trim();
  base = base.replace(/^\d{1,3}\s*[-.)]?\s+/, '');
  const parts = base.split(/\s+-\s+/);
  if (parts.length >= 2) return { artist: parts[0].trim(), title: parts.slice(1).join(' - ').trim() };
  return { artist: '', title: base };
}

// Reads the title and artist from an MP3's ID3 tag, when it has one.
async function readTags(file) {
  try {
    const head = new Uint8Array(await file.slice(0, 10).arrayBuffer());
    if (head[0] !== 0x49 || head[1] !== 0x44 || head[2] !== 0x33) return {};
    const ver = head[3];
    const syncsafe = (b, i) => ((b[i] & 0x7f) << 21) | ((b[i + 1] & 0x7f) << 14) | ((b[i + 2] & 0x7f) << 7) | (b[i + 3] & 0x7f);
    const size = syncsafe(head, 6);
    const buf = new Uint8Array(await file.slice(10, 10 + Math.min(size, 3e6)).arrayBuffer());
    let p = 0;
    if (head[5] & 0x40) p = ver === 4 ? syncsafe(buf, 0) : ((buf[0] << 24) | (buf[1] << 16) | (buf[2] << 8) | buf[3]) + 4;
    const idLen = ver === 2 ? 3 : 4;
    const headLen = ver === 2 ? 6 : 10;
    const wanted = ver === 2 ? { TT2: 'title', TP1: 'artist' } : { TIT2: 'title', TPE1: 'artist' };
    const out = {};
    while (p + headLen <= buf.length) {
      const id = String.fromCharCode(...buf.subarray(p, p + idLen));
      if (!/^[A-Z0-9]+$/.test(id)) break;
      const len = ver === 2 ? (buf[p + 3] << 16) | (buf[p + 4] << 8) | buf[p + 5]
        : ver === 4 ? syncsafe(buf, p + 4) : ((buf[p + 4] << 24) | (buf[p + 5] << 16) | (buf[p + 6] << 8) | buf[p + 7]);
      if (wanted[id]) out[wanted[id]] = tagText(buf.subarray(p + headLen, p + headLen + len));
      if (out.title && out.artist) break;
      p += headLen + len;
    }
    return out;
  } catch (e) {
    return {};
  }
}

function tagText(body) {
  const enc = body[0];
  let data = body.subarray(1);
  let label = ['windows-1252', 'utf-16', 'utf-16be', 'utf-8'][enc] || 'utf-8';
  if (enc === 1 && data[0] === 0xfe && data[1] === 0xff) { label = 'utf-16be'; data = data.subarray(2); }
  return new TextDecoder(label).decode(data).split('\0').find((s) => s.trim()) || '';
}

// Adds files to the library one at a time, reporting progress as it goes.
async function addToLibrary(files, onProgress) {
  const known = new Set(library.map((s) => s.fileName + '|' + s.size));
  const audio = [...files].filter((f) => /^audio\//.test(f.type) || /\.(mp3|m4a|aac|wav|ogg|oga|flac|opus|webm)$/i.test(f.name));
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  let added = 0;
  for (let k = 0; k < audio.length; k++) {
    const file = audio[k];
    if (onProgress) onProgress(k + 1, audio.length);
    if (known.has(file.name + '|' + file.size)) continue;
    const tags = await readTags(file);
    const guess = guessFromFileName(file.name);
    const fileId = 'lib' + Date.now() + Math.random().toString(36).slice(2, 7);
    try {
      await FileStore.put(fileId, file);
    } catch (e) {
      saveLibrary();
      throw new Error(`Only ${added} songs fit. This device is out of space for more.`);
    }
    library.push({ fileId, fileName: file.name, size: file.size, title: tags.title || guess.title, artist: tags.artist || guess.artist });
    known.add(file.name + '|' + file.size);
    added++;
    if (added % 10 === 0) saveLibrary();
  }
  saveLibrary();
  return { added, skipped: audio.length - added, ignored: files.length - audio.length };
}

function removeFromLibrary(idx) {
  const [song] = library.splice(idx, 1);
  if (song) FileStore.remove(song.fileId).catch(() => {});
  saveLibrary();
}

function clearLibrary() {
  library.forEach((s) => FileStore.remove(s.fileId).catch(() => {}));
  library = [];
  saveLibrary();
}

function shuffle(list) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

// Builds a fresh set of music rounds from the library, using each song at most once.
// Lyric Gap and Trivia need words typed in, so those still come from the question pack.
function libraryRounds() {
  const songs = shuffle(library.slice());
  const song = (s) => ({ title: s.title, artist: s.artist, audio: { kind: 'file', fileId: s.fileId, fileName: s.fileName }, start: 0 });
  const out = { r1: [], r2: [], r5: [], final: [] };
  if (songs.length) out.final.push({ category: 'Mystery track', ...song(songs.pop()) });
  const targets = { r1: 10, r2: 8, r5: 6 };
  const mashModes = ['layer', 'reverse', 'layer', 'slow', 'layer', 'reverse'];
  let progress = true;
  while (songs.length && progress) {
    progress = false;
    for (const rid of ['r1', 'r2', 'r5']) {
      if (out[rid].length >= targets[rid] || !songs.length) continue;
      if (rid === 'r5') {
        const mode = mashModes[out.r5.length];
        if (mode === 'layer' && songs.length >= 2) {
          const a = songs.pop();
          const b = songs.pop();
          out.r5.push({ mode, ...song(a), title2: b.title, artist2: b.artist, audio2: song(b).audio, length: 20 });
        } else {
          out.r5.push({ mode: mode === 'layer' ? 'reverse' : mode, ...song(songs.pop()), length: 20 });
        }
      } else {
        out[rid].push(song(songs.pop()));
      }
      progress = true;
    }
  }
  return out;
}
