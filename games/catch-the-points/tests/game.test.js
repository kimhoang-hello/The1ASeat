import test from "node:test";
import assert from "node:assert/strict";
import { Game, rankFor, weightedPick } from "../../../public/games/catch-the-points/src/game.js";
import { CONFIG, PROGRAMS } from "../../../public/games/catch-the-points/src/config.js";

function round() {
  const game = new Game({ random: () => 0.4 });
  game.start();
  return game;
}
const catchType = (game, type) => game.catch({ type, x: 100 });

test("good catches and penalties never make score negative", () => {
  const game = round();
  catchType(game, "normal");
  assert.equal(game.score, 100);
  catchType(game, "interest");
  assert.equal(game.score, 0);
  assert.equal(game.stats.points, 1);
  assert.equal(game.stats.interest, 1);
});
test("multipliers stack on normal points only, including chaos", () => {
  const game = round();
  game.chaos = true;
  game.triggerEvent("transfer");
  catchType(game, "normal");
  assert.equal(game.score, 260);
  catchType(game, "welcome");
  assert.equal(game.score, 760);
  catchType(game, "transfer");
  assert.equal(game.score, 1060);
  catchType(game, "fee");
  assert.equal(game.score, 860);
});
test("devaluations use current score and count survivals", () => {
  const game = round();
  game.score = 1000;
  catchType(game, "devaluation");
  assert.equal(game.score, 800);
  game.triggerEvent("devaluation");
  assert.equal(game.score, 680);
  assert.equal(game.stats.devaluations, 2);
});
test("events cannot overlap and expire after five seconds", () => {
  const game = round();
  game.triggerEvent("category");
  game.triggerEvent("transfer");
  assert.equal(game.multiplier, 5);
  game.update(5.01);
  assert.equal(game.multiplier, 1);
});
test("fatal balance immediately ends the round; later updates and catches do nothing", () => {
  const game = round();
  game.score = 800;
  catchType(game, "balance");
  assert.equal(game.reason, "balance");
  assert.equal(game.running, false);
  const elapsed = game.elapsed;
  game.update(5);
  catchType(game, "normal");
  assert.equal(game.elapsed, elapsed);
  assert.equal(game.score, 800);
  assert.deepEqual(game.items, []);
});
test("round finishes exactly at 45 seconds", () => {
  const game = round();
  game.update(44.99);
  assert.equal(game.running, true);
  game.update(0.02);
  assert.equal(game.remaining, 0);
  assert.equal(game.reason, "time");
});
test("restart resets all transient state", () => {
  const game = round();
  game.update(36);
  game.score = 9000;
  catchType(game, "interest");
  game.triggerEvent("category");
  game.end("balance");
  game.start();
  assert.equal(game.elapsed, 0);
  assert.equal(game.remaining, 45);
  assert.equal(game.score, 0);
  assert.equal(game.multiplier, 1);
  assert.equal(game.multiplierUntil, 0);
  assert.equal(game.chaos, false);
  assert.equal(game.stage.at, 0);
  assert.equal(game.reason, null);
  assert.equal(game.items.length, 0);
  assert.ok(Object.values(game.stats).every(value => value === 0));
  assert.ok(game.eventAt >= 14);
});
test("collision catches an intersecting falling item and misses a distant one", () => {
  const game = round();
  game.spawnIn = 99;
  game.items = [
    { id: 1, type: "normal", x: game.x, y: game.playerY - 45, speed: 100 },
    { id: 2, type: "interest", x: 40, y: game.playerY - 45, speed: 100 },
  ];
  game.update(0.1);
  assert.equal(game.score, 100);
  assert.equal(game.items.length, 1);
});
test("movement stays within bounds and resizing preserves relative positions", () => {
  const game = round();
  game.move(-100);
  game.update(0.1);
  assert.ok(game.x >= CONFIG.player.width / 2);
  game.move(9999);
  game.update(0.1);
  assert.ok(game.x <= game.width - CONFIG.player.width / 2);
  game.resize(320, 500);
  assert.ok(game.target <= 320 - CONFIG.player.width / 2);
});
test("rank boundaries and weighted spawn selections", () => {
  assert.equal(rankFor(2999), "Người mới Miles & Points");
  assert.equal(rankFor(3000), "Thợ săn Welcome Bonus");
  assert.equal(rankFor(6000), "Dân bay vé award");
  assert.equal(rankFor(9000), "Mọt điểm thưởng");
  assert.equal(rankFor(12000), "GHẾ 1A");
  assert.equal(
    weightedPick({ normal: 90, balance: 10 }, () => 0.899),
    "normal",
  );
  assert.equal(
    weightedPick({ normal: 90, balance: 10 }, () => 0.95),
    "balance",
  );
});

test("program breakdown records catches and actual boosted earnings separately from penalties", () => {
  const game = round();
  const catchProgram = (id) =>
    game.catch({
      type: "normal",
      program: PROGRAMS.findIndex((p) => p.id === id),
      x: 100,
    });
  catchProgram("aeroplan");
  catchProgram("bonvoy");
  game.chaos = true;
  game.triggerEvent("transfer");
  catchProgram("aeroplan");
  catchProgram("avios");
  catchProgram("flying-blue");
  catchType(game, "welcome");
  catchType(game, "transfer");
  assert.deepEqual(game.programStats.aeroplan, { catches: 2, points: 620 });
  assert.deepEqual(game.programStats.bonvoy, { catches: 1, points: 100 });
  assert.deepEqual(game.programStats.avios, { catches: 1, points: 520 });
  assert.deepEqual(game.programStats["flying-blue"], {
    catches: 1,
    points: 520,
  });
  assert.deepEqual(game.bonusStats.welcome, { catches: 1, points: 500 });
  assert.deepEqual(game.bonusStats.transfer, { catches: 1, points: 300 });
  assert.equal(game.stats.points, 7);
  const earned = Object.values({
    ...game.programStats,
    ...game.bonusStats,
  }).reduce((sum, tally) => sum + tally.points, 0);
  assert.equal(earned, game.score);
  catchType(game, "interest");
  catchType(game, "devaluation");
  assert.deepEqual(game.programStats.aeroplan, { catches: 2, points: 620 });
  assert.ok(game.score < earned);
  game.start();
  for (const tally of Object.values({
    ...game.programStats,
    ...game.bonusStats,
  }))
    assert.deepEqual(tally, { catches: 0, points: 0 });
});
