# Chessmaster Openings

A web app for learning chess openings. Pick a side (White or Black), choose an
opening and a variation, and watch the line play out on the board. Every opening
comes with a summary and the key idea behind each variation.

**Quiz mode** trains what happens when your opponent leaves the book. A line is
played until the opponent deviates with a different (often inferior) move, and
you have to find the best reply on the board. [Stockfish](https://stockfishchess.org)
picks realistic deviations and judges your answer.

**Play mode** is a game against Stockfish at a strength you choose (1320 to
3190 Elo). The engine plays the selected opening's book moves, picking a random
variation unless you choose one, so you can practise every variant. If you
leave the book, it tells you which book moves were available; once the book
runs out, the engine plays on its own.

Built with TypeScript and [Vite](https://vite.dev), tested with
[Vitest](https://vitest.dev).

## Getting started

Requires Node 24 (see `.nvmrc`).

```bash
nvm use
npm install
npm run dev
```

Then open http://localhost:8765.

## Scripts

| Command             | What it does                                   |
| ------------------- | ---------------------------------------------- |
| `npm run dev`       | Start the dev server with hot reload           |
| `npm test`          | Run the test suite once                        |
| `npm run test:watch`| Run tests in watch mode                        |
| `npm run typecheck` | Type-check with `tsc`                          |
| `npm run build`     | Type-check and build to `dist/`                |
| `npm run preview`   | Serve the production build locally             |

## Controls

| Key            | Action               |
| -------------- | -------------------- |
| `←` / `→`      | Previous / next move |
| `Home` / `End` | Start / end of line  |
| `Space`        | Play / pause         |
| `F`            | Flip the board       |

In quiz mode, click or drag a piece to answer. `H` shows a hint and `N` starts
the next quiz.

Selections are stored in the URL hash (e.g. `#black/sicilian/2`,
`#quiz/white/italian` or `#play/black/french/0`), so you can bookmark or share them.

## How quizzes work

1. Pick a random opening (or the one you chose), a variation, and a point in it
   where the opponent is to move, after both sides' first moves.
2. Score every legal opponent move with Stockfish and choose one that no book
   line in the library plays. Mistakes are favoured over equal alternatives;
   gross blunders are rare.
3. Analyse the resulting position for your best replies. Your move counts as
   correct if it is the engine's choice or loses no more than a small margin
   (30 to 100 centipawns, depending on how big the advantage already is).

After you answer, the engine's continuation plays out on the board. Every line
in the feedback has a **▶ Play** button that replays it from the start, and you
can click any move in a line to jump to that position. The feedback explains the
rating in plain language: what the grade means, how much advantage (in pawns
and in material) your move gave away, and the evaluation before and after.
"How answers are rated" lists the full scale.

Your score is kept in the browser's local storage. Only your first attempt at
each quiz counts.

## How play mode works

- The engine's book is the chosen opening's variations (or just one of them),
  indexed by position so transpositions count. At each branch the engine picks
  a book move in proportion to the variations that play it.
- Your book moves are shown in blue in the move list. "Show book moves" draws
  arrows for the book moves available to you.
- Outside the book, Stockfish plays with `UCI_LimitStrength` at the selected
  Elo, the range the engine is calibrated for. A separate engine instance is
  used, so games are never slowed by quiz preparation.
- Games end on checkmate, stalemate, threefold repetition, the fifty-move rule,
  insufficient material, or resignation. Your win/draw/loss record and the
  chosen strength are kept in local storage.

## Project layout

- `src/chess.ts`: rules engine: legal moves, SAN/UCI/FEN, replaying book lines
- `src/openings.ts`: the opening repertoire (add openings and variations here)
- `src/board.ts`: board rendering, move animation, and click/drag input
- `src/learn.ts`: learn mode (playback of book lines)
- `src/engine.ts`: async wrapper around Stockfish's UCI protocol
- `src/quiz.ts`: quiz generation and grading (UI-independent, tested against the real engine)
- `src/quiz-view.ts`: quiz mode UI and score tracking
- `src/line-player.ts`: plays engine lines move by move on the board
- `src/play.ts`: play mode logic: opening book, book move choice, results (UI-independent)
- `src/play-view.ts`: play mode UI: game flow, take-back, resign, record
- `src/main.ts`: header and URL routing between the two modes
- `scripts/copy-engine.mjs`: copies the Stockfish WASM build to `public/engine` (runs before `dev`/`build`)
- `src/styles.css`: styles, including dark mode
- `tests/`: rules engine (including perft), opening data, and quiz tests

## Adding an opening

Add an entry to `OPENINGS` in `src/openings.ts`. `side` is the colour the learner
plays (`'w'` or `'b'`), and `moves` is a space-separated list of SAN moves from
the starting position. Openings are grouped in the sidebar by White's first move (1.e4, 1.d4, …);
set `gambit: true` to list one under "Gambits" instead. `npm test` replays every line and fails on any illegal
move or a missing/extra `+` check marker.

## Licence note

Quiz mode uses [Stockfish.js](https://github.com/nmrugg/stockfish.js) (the lite
single-threaded WASM build), which is licensed under the GPLv3. If you
distribute this app, the GPL's terms apply. The licence text is copied to
`public/engine/COPYING.txt` alongside the engine.
