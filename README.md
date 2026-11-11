# Musical Wits

A guess-the-artist music game show for 2 to 4 teams. A clip of a song plays and everyone picks the artist from four choices. The game checks every answer itself against the song's own artist and title, so nobody has to judge and the host plays too. Play on one shared screen, or with everyone answering on their own phone.

The original, longer show (with lyric, trivia and mashup rounds) is described in [docs/musical-guessing-game-show.md](docs/musical-guessing-game-show.md) and kept on the `backup/2026-11-11-before-artist-game` branch.

## Play it

**On your own computer:** download the code (green **Code** button → **Download ZIP**), then **extract** the ZIP (on Windows: right-click it → **Extract All**). Open the extracted folder and double-click `index.html`. Use Chrome, Edge, Firefox or Safari on a computer. Opening `index.html` from inside the ZIP, or on a phone, won't work.

**Online:** turn on GitHub Pages (Settings → Pages → "Deploy from a branch" → `main` and `/ (root)` → Save) and the game lives at
https://falllikedoms-ux.github.io/Musical-Whits/
GitHub Pages is free for public repositories. For a private repository it needs a paid GitHub plan.

**On a phone or tablet:** downloaded files can't run there, so use an online copy: GitHub Pages above, or the hosted link from the project chat.

## Install it as an app

**Android:** every change to `main` builds an Android app. Open the [**Android app** release](https://github.com/falllikedoms-ux/Musical-Whits/releases/tag/android-latest) on your phone, download **MusicalWits.apk**, and open it. Android asks once to allow installs from your browser; say yes. Updating works the same way: download the newest APK and open it.

**iPhone (no App Store needed):** open the game's web address in **Safari**, tap **Share** → **Add to Home Screen**. It gets its own icon, opens full screen, and works offline after the first visit. This needs the game on a public https address, such as GitHub Pages above. A real iPhone app file would need a Mac with Xcode, and without a paid Apple developer account it stops opening after 7 days.

Playing with phones works in the installed apps too (see below).

## Playing on one screen

1. Tap **Songs** and add your music (or skip this and try the built-in demo tunes).
2. Press **Drop a coin**, type your team names (or pull the Pun-O-Matic lever for a silly one) and press **Start the show**.
3. Each song starts by itself. Know the artist? Tap your team's name to buzz (or press **Q**, **P**, **Z** or **M**). The music pauses.
4. Pick the answer from the four choices (or press **1** to **4**). Right scores the points. Wrong and your team is out for that song, that choice is crossed off, and the music carries on for the others.
5. **Reveal answer** if nobody gets it, then **Next song**.
6. The small **+5 / −5** buttons under **Fix a score** fix any score at any time.

The game saves itself in the browser, so refreshing the page or closing the tab doesn't lose the scores. Tap **Resume the show** on the jukebox.

## Playing with phones

Every player answers on their own phone or computer, Android or iPhone. When the music starts, the four choices appear on every phone with a countdown. Each team's first answer counts, right answers score the round's points, and quick answers earn a speed bonus on top. The host's screen plays the music and keeps score. To play from the host's screen as well, tap your team there during a song, then tap your answer.

**From the GitHub Pages address or the Android app:**

1. On the host's screen, tap **Host: open a room** on the jukebox. A 4-letter room code appears.
2. Each player opens https://falllikedoms-ux.github.io/Musical-Whits/ (or the Android app), types the code under **Play with phones** and taps **Join a room**. Or send them the link the host's screen shows, which joins straight away.
3. Players pick their team. Start the show on the host's screen and the choices appear on every phone.
4. Playing far apart? Start a video call and share your sound so everyone hears the music.

Everyone needs internet. Phones connect straight to the host's screen; PeerJS's free public server only introduces them. Keep the host's screen open: if it refreshes, the same room comes back and phones reconnect by themselves.

**In the claude.ai copy:** share the game from the page's **Share** menu. Players open it, tap **Join as a player** and pick their team. They need to be signed in to claude.ai.

## Rounds

| Round | How it plays |
|---|---|
| Name the Artist | 15-second clips. Right +10. |
| Title Bonus | Bonus round: name the song title. Right +15. |
| Quick Fire | 5-second clips. Name the artist. Right +20. |
| Double Title Bonus | Bonus round with 8-second clips: name the song title. Right +25. |
| The Encore | The last few songs, 10-second clips. Name the artist. Right +40. |

With phones, a fast answer adds up to half the round's points again. Under **Game options** on the Teams screen you can switch the title bonus rounds off, choose how many songs each round has, and choose whether clips start at a random point in the song.

## Your own songs

With no songs added, the game plays public-domain melodies (Für Elise, Jingle Bells and friends) on a small synthesizer, so you can try it straight away.

Tap **Songs** on the jukebox to add your music:

- **Add a whole folder** takes every song in the folder you pick, including all the album folders inside it. Other files (cover pictures and so on) are skipped. This works in Chrome on a computer and in the Android app.
- **+ Add songs** takes as many songs as you select. On a phone, open an album, press and hold one song, then choose **Select all** from the menu.

The artist and title of each song are the answers the game checks. They come from the tags inside each MP3, or from a file name like `Artist - Title.mp3`. **Search and check songs** finds songs by title, artist or album, lets you fix any names that look wrong, and can remove everything that matches a search. Songs with no artist are only used in the title bonus rounds. The wrong choices for each song come from the other artists and titles in your library, so the more artists you add, the better the game.

Every new game picks songs at random, with no song played twice in a game. The songs are copied into the browser on that device and are never uploaded.

Please don't commit copyrighted songs into this repository. Add them on the Songs screen instead.

## How it's built

Plain HTML, CSS and JavaScript with no build step. `index.html` loads everything from `css/` and `js/`:

- `js/rounds.js`: the rounds, the four choices for each song and how a game is dealt
- `js/tunes.js`: the built-in melodies and the synthesizer
- `js/audio.js`: clip playback
- `js/storage.js`: saving in the browser
- `js/library.js`: the music library
- `js/app.js`: the game flow, answer checking and the Songs screen
