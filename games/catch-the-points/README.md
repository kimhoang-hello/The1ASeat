# Catch the Points · Ghế 1A

A small, mobile-first arcade game. Vanilla HTML, CSS and JavaScript; no framework, game engine, backend, installation step or runtime third-party requests.

## Run

Requires Node.js 22 or newer for the included development server.

```sh
npm run dev
```

Open http://localhost:5173. Use `PORT=8080 npm run dev` for another port. For static hosting, upload `index.html`, `src/`, and `assets/` to the site root. The Node server is only a local preview server.

## Play

Press **Bắt đầu chơi**. Drag anywhere inside the playfield, or use ← / → and A / D. Collect points and bonuses, avoid penalties, and never catch **CARRYING A BALANCE**. Each round lasts 45 active seconds; switching tabs pauses the game. **Chơi lại** resets the entire round without reloading. Sound starts only after interaction and can be muted.

The last 10 seconds double normal points. Random 1.3× and 5× events affect normal points only and never overlap; they stack with Chaos Mode. Welcome and Transfer Bonus items stay at +500 and +300. Scores cannot fall below zero. Percentage penalties use the score at impact, rounded to the nearest integer.

## Tune and replace assets

- `src/config.js`: duration, dimensions, keyboard speed, stage timing, falling speed, spawn interval and weights, point values, event timing, multipliers, and ranks.
- `PROGRAMS` in that file: stable program IDs, names, colors, and local logo URLs. Seven programs include Flying Blue; asset provenance is in `assets/programs/SOURCES.md`.
- `src/game.js`: independent game state, collision detection, scoring, events and reset.
- `src/main.js`: DOM rendering and input. Only one animation loop runs.
- `src/results.js`: results table with catches and earned points for each program, plus separate welcome and transfer bonuses. Earnings include multipliers and remain unchanged by later penalties; they represent collected points, not the final net score.
- `src/icons.js` and `assets/icons.svg`: consistent SVG interface and item icons.
- `src/audio.js`: quiet Web Audio tones, with graceful fallback when unavailable.
- `src/style.css`: responsive layout and brand tokens.

Spawn weights are relative. The first stage favors regular points; bonuses and the highest difficulty arrive later. A spacing check keeps consecutive drops from immediately overlapping. Statistics are independent of score: points caught counts all positive catches; devaluations survived includes caught devaluations and surprise events.

## Ghế 1A visual identity

Matched to https://ghe1a.com on 5 September 2026:

- Primary navy `#0F2A4A`, cream `#FAF6EC`, text `#1A1613`, secondary text `#6B6259`.
- Plus Jakarta Sans for headings; Inter for body copy; bold headings and pill-shaped primary actions.
- The actual Ghế 1A logo from the site's `/images/logo.png` is included locally. The carry-on illustration is original SVG artwork recolored to the brand navy.
- Instructions, primary controls, result labels and personalized insights are Vietnamese. The game title, program names, ranks and in-game Miles & Points terminology retain English names.
- Fonts are bundled locally, including Vietnamese glyphs, with their SIL Open Font License files in `assets/fonts/`.

## Verification

```sh
npm test
npm run check
```

The automated suite covers scores, penalties, multiplier stacking and expiry, percentage devaluations, fatal balance, the 45-second timer, clean restart, collision/miss behavior, movement bounds, resize, rank thresholds and weighted selection. Browser checks cover the start screen, dragging, a full timed round, the result screen, restart, sound toggle and mobile overflow. Safari/iPhone hardware testing remains a separate manual check.

## V2 and V2.1

V2 adds capped combos, mild adaptive difficulty, Golden Welcome Bonus, rotating Transfer Partner boosts, rare Award Availability windows, local personal bests and six persistent achievements. Challenge links accept `?challenge=14280`; the result requires surviving the round and strictly exceeding the target. Sharing, friend-challenge and score-image controls were removed at the user's request; the unused share utilities are not imported by the running app.

V2.1 adds one deterministic insight after the result stats and before Play Again. It observes actual score losses and earnings without changing gameplay. `src/recommendation-config.js` contains all thresholds, copy and content destinations; see `docs/V2.1-RECOMMENDATIONS.md` for the selection rules and analytics contract.
