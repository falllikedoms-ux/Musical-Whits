# Musical Whits

A musical guessing game show for 2 to 4 teams. One host runs it on a laptop or TV that everyone can see and hear. The full rules are in [docs/musical-guessing-game-show.md](docs/musical-guessing-game-show.md).

## Play it

**On your own computer:** download the code (green **Code** button → **Download ZIP**), then **extract** the ZIP (on Windows: right-click it → **Extract All**). Open the extracted folder and double-click `index.html`. Use Chrome, Edge, Firefox or Safari on a computer. Opening `index.html` from inside the ZIP, or on a phone, won't work.

**Online:** turn on GitHub Pages (Settings → Pages → "Deploy from a branch" → `main` and `/ (root)` → Save) and the game lives at
https://falllikedoms-ux.github.io/Musical-Whits/
GitHub Pages is free for public repositories. For a private repository it needs a paid GitHub plan.

## Hosting a game

1. Type your team names and press **Start the show**.
2. Press **Play** (or the space bar) to start a clip.
3. Teams buzz with their key: **Q**, **P**, **Z** or **M** (or by tapping their name on screen). The music pauses.
4. The team answers out loud. Press the matching scoring button. A wrong answer locks that team out of the track and the music carries on.
5. **Reveal answer** if nobody gets it, then **Next track**.
6. The small **+5 / −5** buttons fix any score at any time.

The game saves itself in the browser, so refreshing the page or closing the tab doesn't lose the scores. Choose **Resume game in progress** on the menu.

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

To use real songs, open **Edit questions and music** from the menu. For each track you can pick:

- **Audio file from my computer** (MP3, WAV, M4A...). The file stays in your browser on that computer; it's never uploaded anywhere.
- **Web link to an audio file** (a direct link ending in .mp3 or similar).
- **Built-in tune**.

You can also set where the clip starts, and for Lyric Gap where the music stops. **Download pack** saves your questions to a file as a backup.

Please don't commit copyrighted songs into this repository. Load them in the editor instead.

## How it's built

Plain HTML, CSS and JavaScript with no build step. `index.html` loads everything from `css/` and `js/`:

- `js/rounds.js`: the rounds, scoring, host lines and starter questions
- `js/tunes.js`: the built-in melodies and the synthesizer
- `js/audio.js`: clip playback (start, length, layering, reverse, slow)
- `js/storage.js`: saving in the browser
- `js/app.js`: the screens and game flow
