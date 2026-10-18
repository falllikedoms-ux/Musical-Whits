# Musical Wits

A musical guessing game show for 2 to 4 teams. One host runs it on a laptop or TV that everyone can see and hear. The full rules are in [docs/musical-guessing-game-show.md](docs/musical-guessing-game-show.md).

## Play it

**On your own computer:** download the code (green **Code** button → **Download ZIP**), then **extract** the ZIP (on Windows: right-click it → **Extract All**). Open the extracted folder and double-click `index.html`. Use Chrome, Edge, Firefox or Safari on a computer. Opening `index.html` from inside the ZIP, or on a phone, won't work.

**Online:** turn on GitHub Pages (Settings → Pages → "Deploy from a branch" → `main` and `/ (root)` → Save) and the game lives at
https://falllikedoms-ux.github.io/Musical-Whits/
GitHub Pages is free for public repositories. For a private repository it needs a paid GitHub plan.

**On a phone or tablet:** downloaded files can't run there, so use an online copy: GitHub Pages above, or the hosted link from the project chat. Teams buzz by tapping their names.

## Install it as an app

**Android:** every change to `main` builds an Android app. Open the [**Android app** release](https://github.com/falllikedoms-ux/Musical-Whits/releases/tag/android-latest) on your phone, download **MusicalWits.apk**, and open it. Android asks once to allow installs from your browser; say yes. Updating works the same way: download the newest APK and open it.

**iPhone (no App Store needed):** open the game's web address in **Safari**, tap **Share** → **Add to Home Screen**. It gets its own icon, opens full screen, and works offline after the first visit. This needs the game on a public https address, such as GitHub Pages above. A real iPhone app file would need a Mac with Xcode, and without a paid Apple developer account it stops opening after 7 days.

Phone buzzers work in the installed apps too (see below).

## Hosting a game

1. Press **Drop a coin**, type your team names (or pull the Pun-O-Matic lever for a silly one) and press **Start Round 1**.
2. Press **Play** (or the space bar) to start a clip.
3. Teams buzz with their key: **Q**, **P**, **Z** or **M** (or by tapping their name on screen). The music pauses.
4. The team answers out loud. Press the matching scoring button. A wrong answer locks that team out of the track and the music carries on.
5. **Reveal answer** if nobody gets it, then **Next track**.
6. The small **+5 / −5** buttons fix any score at any time.

The game saves itself in the browser, so refreshing the page or closing the tab doesn't lose the scores. Tap **Resume the show** on the jukebox.

## Phone buzzers

Every player can buzz from their own phone or computer, Android or iPhone, wherever they are.

**From the GitHub Pages address or the Android app:**

1. On the host's screen, tap **Host: open a room** on the jukebox. A 4-letter room code appears.
2. Each player opens https://falllikedoms-ux.github.io/Musical-Whits/ (or the Android app), types the code under **Play with phones** and taps **Join a room**. Or send them the link the host's screen shows, which joins straight away.
3. Players pick their team. When a clip plays they tap the big **BUZZ** button. The first buzz wins, and the host's screen shows which team buzzed.
4. Playing far apart? Start a video call and share your sound so everyone hears the music.

Everyone needs internet. Phones connect straight to the host's screen; PeerJS's free public server only introduces them. Keep the host's screen open: if it refreshes, the same room comes back and phones reconnect by themselves.

**In the claude.ai copy:** share the game from the page's **Share** menu. Players open it, tap **Join as a player** and pick their team. They need to be signed in to claude.ai.

## Rounds

| Round | How it plays |
|---|---|
| 1. Name That Tune | 15-second clip. Title +10, title and artist +15. |
| 2. Intro Sprint | Play 1, then 3, then 5 seconds. +30 / +20 / +10, wrong −5. |
| 3. Lyric Gap | Music stops before a line. Exact +20, mostly right +10. |
| 4. Trivia Lightning | 15-second timer, teams write answers, +10 each. |
| 5. Mashup Mayhem | Two songs layered, or one backwards or slowed. Both +40, one +15, steal +15. |
| Final Showdown | Teams wager, one 10-second clip, win or lose the wager. |

## Your own songs

The game ships with placeholder tunes: public-domain melodies (Für Elise, Jingle Bells, Twinkle Twinkle and friends) played by a small synthesizer, so it works straight away.

To use real songs, tap **Songs** on the jukebox. For each track you can pick:

- **Audio file from my computer** (MP3, WAV, M4A...). The file stays in your browser on that computer; it's never uploaded anywhere.
- **Web link to an audio file** (a direct link ending in .mp3 or similar).
- **Built-in tune**.

You can also set where the clip starts, and for Lyric Gap where the music stops.

### Your whole music library

Under **My music library** in the editor:

- **Add a whole folder** takes every song in the folder you pick, including all the album folders inside it. Other files (cover pictures and so on) are skipped. This works in Chrome on a computer; on a phone it depends on the phone's file picker.
- **+ Add songs** takes as many songs as you select. On a phone, open an album, press and hold one song, then choose **Select all** from the menu.

Titles, artists and albums come from each MP3's tags, or from the file and folder names (`Artist - Title.mp3`). **Search and check songs** finds songs by title, artist or album, lets you fix any names that look wrong, and can remove everything that matches a search. The songs are copied into the browser on that device and are never uploaded.

On the menu, tick **Pick songs at random from my music library** and each new game draws Name That Tune, Intro Sprint, Mashup Mayhem and the Final from the library at random, with no song played twice in a game. Lyric Gap and Trivia still come from your questions, since they need words typed in.

### Random clip start

Tick **Start each clip at a random point in the song** on the menu to start clips somewhere random instead of at the set start. It applies to Name That Tune, Mashup Mayhem and the Final; Intro Sprint and Lyric Gap keep their set start. **Download pack** saves your questions to a file as a backup.

Please don't commit copyrighted songs into this repository. Load them in the editor instead.

## How it's built

Plain HTML, CSS and JavaScript with no build step. `index.html` loads everything from `css/` and `js/`:

- `js/rounds.js`: the rounds, scoring, host lines and starter questions
- `js/tunes.js`: the built-in melodies and the synthesizer
- `js/audio.js`: clip playback (start, length, layering, reverse, slow)
- `js/storage.js`: saving in the browser
- `js/library.js`: the music library and random game building
- `js/app.js`: the screens and game flow
