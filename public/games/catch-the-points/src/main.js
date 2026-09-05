import { CONFIG, ITEMS, PROGRAMS } from "./config.js";
import { Game, rankFor } from "./game.js";
import { Sound } from "./audio.js";
import { icon } from "./icons.js";
import { renderBreakdown } from "./results.js";
import { createProfile } from "./profile.js";
import { parseChallenge } from './challenge.js';
import { buildRecommendationStats } from './recommendations.js';
import { setupRecommendation } from './recommendation-view.js';
import { earnedAchievements, renderAchievements } from './achievements.js';
import { createAnalytics } from './analytics.js';

const $ = (id) => document.getElementById(id);
const dom = Object.fromEntries(
  [
    "stage",
    "game-shell",
    "start-screen",
    "result-screen",
    "playfield",
    "hud",
    "score",
    "time",
    "time-progress",
    "player",
    "items",
    "feedback",
    "event-banner",
    "multiplier-badge",
    "move-hint",
    "round-label",
  ].map((id) => [id, $(id)]),
);
const sound = new Sound();
const profile = createProfile();
$('start-best').textContent = `KỶ LỤC: ${profile.best.toLocaleString()}`;
// Trong iframe thì query `?challenge=` nằm trên URL của TRANG chứ không phải
// của game; `embed.js` chép nó sang đây. Chạy độc lập thì `location.search`
// vẫn là chỗ đúng.
const challengeTarget = parseChallenge(window.GHE1A_EMBED_SEARCH || location.search);
const game = new Game({ emit: onGameEvent, challengeTarget });
const track = createAnalytics();
const renderRecommendation = setupRecommendation(track);
let hasPlayed = false;
if (challengeTarget !== null) {
  $('challenge-intro').hidden = false;
  $('challenge-target').textContent = challengeTarget.toLocaleString();
  $('start-label').textContent = 'Bắt đầu thách đấu';
  $('hud-target').hidden = false;
  $('hud-target').textContent = `MỤC TIÊU: ${challengeTarget.toLocaleString()}`;
  dom.hud.classList.add('has-challenge');
}
const nodes = new Map();
const keys = new Set();
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
let frame = 0;
let lastTime = 0;
let bannerUntil = 0;
let bannerPriority = 0;
let pointerId = null;
let pointerStart = 0;
let suitcaseStart = 0;

/**
 * Kéo màn hình về đầu game khi bắt đầu lượt mới và khi hiện kết quả.
 *
 * Trong iframe thì `window.scrollTo` vô nghĩa: trang cha tự chỉnh chiều cao
 * khung theo nội dung nên document của game không bao giờ cuộn được, mà thứ
 * cần cuộn lại chính là trang cha. Nhờ nó làm hộ.
 */
function scrollToTop() {
  if (window.parent !== window) {
    try {
      window.parent.postMessage({ source: "ghe1a-game", type: "scroll-to-top" }, location.origin);
    } catch {
      /* Khác origin thì thôi, không ảnh hưởng lượt chơi. */
    }
    return;
  }
  window.scrollTo(0, 0);
}
function banner(title, detail, danger = false, duration = 2.6, priority = 1) {
  if (game.elapsed < bannerUntil && priority < bannerPriority) return;
  dom["event-banner"].hidden = false;
  dom["event-banner"].classList.toggle("danger", danger);
  dom["event-banner"].querySelector("strong").textContent = title;
  dom["event-banner"].querySelector("span").textContent = detail;
  bannerUntil = game.elapsed + duration;
  bannerPriority = priority;
}
function animateHit(good) {
  dom.player.classList.remove("caught", "hurt");
  // Reset only this tiny animation node, never the full playfield.
  void dom.player.offsetWidth;
  dom.player.classList.add(good ? "caught" : "hurt");
  if (!good && !reducedMotion) {
    dom.playfield.classList.remove("screen-hit");
    void dom.playfield.offsetWidth;
    dom.playfield.classList.add("screen-hit");
  }
}
function onGameEvent(event) {
  if (event.kind === "catch") {
    const feedback = document.createElement("div");
    feedback.className = `floating-score${event.good ? "" : " bad"}`;
    feedback.style.left = `${Math.max(60, Math.min(game.width - 60, event.x))}px`;
    feedback.style.top = `${event.y - 8}px`;
    if (["welcome", "transfer", "golden"].includes(event.type)) {
      const label = document.createElement("small");
      label.textContent = `${ITEMS[event.type].name}!`;
      feedback.append(label);
    }
    feedback.append(
      `${event.amount >= 0 ? "+" : "−"}${Math.abs(event.amount).toLocaleString()}`,
    );
    feedback.addEventListener("animationend", () => feedback.remove(), {
      once: true,
    });
    dom.feedback.append(feedback);
    animateHit(event.good);
    if (event.type === 'golden') {
      feedback.classList.add('golden-feedback');
      feedback.style.left = `${Math.max(125, Math.min(game.width - 125, event.x))}px`;
    }
    sound.play(
      event.good
        ? event.type
        : event.type === "devaluation"
          ? "devaluation"
          : "bad",
    );
    if (event.message)
      banner(ITEMS[event.type].name, event.message, !event.good, 1.7, event.type === 'golden' ? 2 : 0);
  } else if (event.kind === "chaos") {
    dom["game-shell"].classList.add("is-chaos");
    banner(event.title, event.detail, false, 2.6, 2);
    sound.play("chaos");
  } else if (event.kind === "event") {
    const bad = event.type === "devaluation";
    banner(event.title, event.detail, bad, 2.6, 1);
    sound.play(bad ? "devaluation" : "event");
    if (bad) animateHit(false);
  } else if (event.kind === "end") finish();
  else if (event.kind === "combo") {
    if (event.count === 10) {
      banner('🔥 COMBO ×5', 'Rõ là biết mình đang làm gì.', false, 1.8, 1);
      sound.play('combo');
    }
  } else if (event.kind === "countdown") {
    dom.time.classList.remove('countdown-punch');
    void dom.time.offsetWidth;
    dom.time.classList.add('countdown-punch');
    sound.play('tick');
  } else if (['partner', 'award', 'award-end', 'challenge-beaten'].includes(event.kind)) {
    banner(event.title, event.detail, false, 2.4, 1);
    sound.play('event');
  } else if (event.kind === 'near-miss') {
    const note = document.createElement('div');
    note.className = 'floating-score near-miss';
    note.textContent = 'SÁT NÚT';
    note.style.left = `${Math.max(55, Math.min(game.width - 55, event.x))}px`;
    note.style.top = `${event.y - 15}px`;
    note.addEventListener('animationend', () => note.remove(), {once:true});
    dom.feedback.append(note);
  }
}

function itemNode(item) {
  const def =
    item.type === "normal" ? PROGRAMS[item.program] : ITEMS[item.type];
  const good = ITEMS[item.type].good;
  const node = document.createElement("div");
  node.className = `falling-item ${good ? (item.type === "normal" ? "" : "special") : "bad"}${item.type === "balance" ? " fatal" : ""}`;
  node.classList.toggle('golden', item.type === 'golden');
  node.style.setProperty("--item-color", def.color || "#9b4c3c");
  node.style.setProperty("--item-bg", def.background || "#f6e5dc");
  node.setAttribute("aria-label", def.name);
  if (def.asset) {
    const img = document.createElement("img");
    img.src = def.asset;
    img.alt = "";
    img.className = `program-logo logo-${def.id}`;
    node.append(img);
  } else if (def.icon) {
    node.append(icon(def.icon));
  } else {
    const mark = document.createElement("b");
    mark.textContent = def.mark;
    node.append(mark);
  }
  const label = document.createElement("span");
  label.textContent = def.name;
  node.append(label);
  dom.items.append(node);
  return node;
}
function render() {
  dom.score.textContent = game.score.toLocaleString();
  dom.time.textContent = Math.ceil(game.remaining);
  $('combo-badge').hidden = game.comboMultiplier === 1;
  $('combo-badge').textContent = `🔥 ×${game.comboMultiplier} COMBO`;
  $('hud-best').textContent = `KỶ LỤC: ${profile.best.toLocaleString()}`;
  dom["time-progress"].style.transform =
    `scaleX(${game.remaining / CONFIG.duration})`;
  dom["round-label"].textContent = game.chaos
    ? "CHẾ ĐỘ HỖN LOẠN · NHÂN ĐÔI ĐIỂM"
    : "HỨNG. NÉ. LẶP LẠI.";
  dom.player.style.transform = `translate3d(${game.x - CONFIG.player.width / 2}px,${game.playerY}px,0) rotate(${reducedMotion ? 0 : game.tilt}deg)`;
  const alive = new Set();
  for (const item of game.items) {
    alive.add(item.id);
    if (!nodes.has(item.id)) nodes.set(item.id, itemNode(item));
    nodes.get(item.id).style.transform =
      `translate3d(${item.x - CONFIG.item.width / 2}px,${item.y}px,0) rotate(${item.rotation}deg)`;
    nodes.get(item.id).classList.toggle('boosted', item.type === 'normal' && game.partner?.program === item.program);
  }
  for (const [id, node] of nodes)
    if (!alive.has(id)) {
      node.remove();
      nodes.delete(id);
    }
  if (game.elapsed >= bannerUntil) dom["event-banner"].hidden = true;
  dom["multiplier-badge"].hidden = game.multiplier === 1;
  dom["multiplier-badge"].textContent =
    `${game.multiplier}× ĐIỂM THƯỜNG · ${Math.max(0, Math.ceil(game.multiplierUntil - game.elapsed))}s`;
  dom["move-hint"].hidden = game.elapsed > 5;
  dom.playfield.classList.toggle('award-window', game.awardActive);
  $('partner-badge').hidden = !game.partner;
  if (game.partner) $('partner-badge').textContent = `${PROGRAMS[game.partner.program].name} 2× · ${Math.ceil(game.partner.until - game.elapsed)}s`;
  $('award-badge').hidden = !game.awardActive;
  if (game.awardActive) $('award-badge').textContent = `CHỖ VÉ AWARD · ${Math.ceil(game.awardUntil - game.elapsed)}s`;
}
function loop(time) {
  if (!game.running) return;
  // Pause when hidden. Substeps preserve collisions even after a delayed frame.
  const dt = Math.min((time - lastTime) / 1000, 1);
  lastTime = time;
  const direction =
    Number(keys.has("ArrowRight") || keys.has("d")) -
    Number(keys.has("ArrowLeft") || keys.has("a"));
  let remaining = dt;
  while (remaining > 0 && game.running) {
    const step = Math.min(remaining, 1 / 60);
    game.update(step, direction);
    remaining -= step;
  }
  if (!game.running) return;
  render();
  frame = requestAnimationFrame(loop);
}
function clearPointer() {
  if (pointerId !== null && dom.playfield.hasPointerCapture(pointerId))
    dom.playfield.releasePointerCapture(pointerId);
  pointerId = null;
}
function start() {
  if (hasPlayed) track('play_again');
  hasPlayed = true;
  track('game_started', {challenge:challengeTarget !== null});
  if (challengeTarget !== null) track('challenge_started', {target:challengeTarget});
  document.querySelector('.breakdown-details').open = false;
  cancelAnimationFrame(frame);
  keys.clear();
  clearPointer();
  sound.unlock();
  dom["start-screen"].hidden = true;
  dom["result-screen"].hidden = true;
  dom.playfield.hidden = false;
  dom.hud.hidden = false;
  dom["game-shell"].classList.add("is-playing");
  dom["game-shell"].classList.remove("is-chaos");
  dom.playfield.classList.remove("screen-hit");
  dom.player.classList.remove("caught", "hurt");
  dom.items.replaceChildren();
  dom.feedback.replaceChildren();
  nodes.clear();
  dom["event-banner"].hidden = true;
  bannerUntil = 0;
  bannerPriority = 0;
  game.resize(dom.playfield.clientWidth, dom.playfield.clientHeight);
  game.start();
  render();
  scrollToTop();
  dom.playfield.focus({ preventScroll: true });
  lastTime = performance.now();
  frame = requestAnimationFrame(loop);
}
function finish() {
  cancelAnimationFrame(frame);
  keys.clear();
  clearPointer();
  sound.play("end");
  dom.items.replaceChildren();
  dom.feedback.replaceChildren();
  nodes.clear();
  dom["event-banner"].hidden = true;
  dom["multiplier-badge"].hidden = true;
  dom.playfield.hidden = true;
  dom.hud.hidden = true;
  dom["game-shell"].classList.remove("is-playing", "is-chaos");
  const fatal = game.reason === "balance";
  const baseResult = { score: game.score, rank: rankFor(game.score), stats: {...game.stats}, reason: game.reason };
  const record = profile.record(game.score, earnedAchievements(baseResult));
  $('new-best').hidden = !record.newBest;
  renderAchievements(record.unlocked);
  track(fatal ? 'game_over_balance' : 'game_completed', {score:game.score,rank:baseResult.rank,elapsed:Math.round(game.elapsed),longestCombo:game.stats.longestCombo});
  track('rank_achieved', {rank:baseResult.rank,score:game.score});
  if(record.newBest) { track('personal_best', {score:game.score}); sound.play('record'); }
  if(challengeTarget !== null) track('challenge_completed', {target:challengeTarget,score:game.score,won:!fatal && game.score>challengeTarget});
  renderRecommendation(buildRecommendationStats(game, profile.best));
  $('challenge-result').hidden = challengeTarget === null;
  if (challengeTarget !== null) $('challenge-result').textContent = game.reason === 'time' && game.score > challengeTarget ? '🔥 BẠN ĐÃ VƯỢT QUA THỬ THÁCH!' : 'SUÝT NỮA RỒI · Thử thêm một lần?';
  dom["result-screen"].hidden = false;
  dom["result-screen"].classList.toggle("is-fatal", fatal);
  $("result-title").textContent = fatal ? "KẾT THÚC LƯỢT CHƠI" : "HẾT GIỜ!";
  $("result-flight").textContent = fatal
    ? "CHUYẾN BAY BỊ HỦY"
    : "CHUYẾN BAY HOÀN TẤT";
  $("fatal-message").hidden = !fatal;
  $("result-score").textContent = game.score.toLocaleString();
  $("rank").textContent = rankFor(game.score);
  for (const [key, value] of Object.entries(game.stats))
    if ($(`stat-${key}`)) $(`stat-${key}`).textContent = value;
  renderBreakdown(game.programStats, game.bonusStats);
  scrollToTop();
  $("result-title").focus({ preventScroll: true });
}

$("start").addEventListener("click", start);
$("restart").addEventListener("click", start);
$("sound").addEventListener("click", () => {
  sound.enabled = !sound.enabled;
  if (sound.enabled) sound.unlock();
  $("sound").setAttribute("aria-pressed", String(sound.enabled));
  $("sound").setAttribute(
    "aria-label",
    sound.enabled ? "Tắt âm thanh" : "Bật âm thanh",
  );
  $("sound-label").textContent = `ÂM THANH ${sound.enabled ? "BẬT" : "TẮT"}`;
});
window.addEventListener("keydown", (event) => {
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  if (
    !game.running ||
    !["ArrowLeft", "ArrowRight", "a", "d"].includes(key) ||
    event.metaKey ||
    event.ctrlKey ||
    event.altKey
  )
    return;
  event.preventDefault();
  if (!event.repeat && !keys.has(key)) {
    const direction = key === "ArrowRight" || key === "d" ? 1 : -1;
    game.move(game.target + direction * 20);
  }
  keys.add(key);
});
window.addEventListener("keyup", (event) =>
  keys.delete(event.key.length === 1 ? event.key.toLowerCase() : event.key),
);
window.addEventListener("blur", () => {
  keys.clear();
  clearPointer();
});
dom.playfield.addEventListener("pointerdown", (event) => {
  if (
    !game.running ||
    pointerId !== null ||
    !event.isPrimary ||
    event.button !== 0
  )
    return;
  pointerId = event.pointerId;
  pointerStart = event.clientX;
  suitcaseStart = game.x;
  dom.playfield.setPointerCapture(pointerId);
  event.preventDefault();
  sound.unlock();
});
dom.playfield.addEventListener("pointermove", (event) => {
  if (event.pointerId === pointerId && game.running)
    game.move(suitcaseStart + event.clientX - pointerStart);
});
for (const name of ["pointerup", "pointercancel", "lostpointercapture"])
  dom.playfield.addEventListener(name, (event) => {
    if (event.pointerId === pointerId) pointerId = null;
  });
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    cancelAnimationFrame(frame);
    keys.clear();
    clearPointer();
  } else if (game.running) {
    lastTime = performance.now();
    frame = requestAnimationFrame(loop);
  }
});
new ResizeObserver(() => {
  if (game.running)
    game.resize(dom.playfield.clientWidth, dom.playfield.clientHeight);
}).observe(dom.stage);
