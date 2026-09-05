import { CONFIG, ITEMS, PROGRAMS } from "./config.js";
import { safeScore } from "./profile.js";
import { catchMessage } from "./personality.js";

export const rankFor = (score) =>
  [...CONFIG.ranks].reverse().find((rank) => safeScore(score) >= rank.min).name;
export function weightedPick(weights, random = Math.random) {
  let roll =
    random() * Object.values(weights).reduce((sum, value) => sum + value, 0);
  for (const [key, weight] of Object.entries(weights)) {
    roll -= weight;
    if (roll < 0) return key;
  }
  return Object.keys(weights).at(-1);
}

export class Game {
  constructor({
    width = 480,
    height = 580,
    random = Math.random,
    emit = () => {},
    challengeTarget = null,
  } = {}) {
    Object.assign(this, { width, height, random, emit });
    this.challengeTarget = challengeTarget === null ? null : safeScore(challengeTarget);
    this.reset();
  }
  between([low, high]) {
    return low + this.random() * (high - low);
  }
  reset() {
    this.running = false;
    this.elapsed = 0;
    this.score = 0;
    this.items = [];
    this.nextId = 0;
    this.spawnIn = 0.15;
    this.eventAt = this.between(CONFIG.events.firstAt);
    this.multiplier = 1;
    this.multiplierUntil = 0;
    this.eventName = "";
    this.chaos = false;
    this.reason = null;
    this.x = this.width / 2;
    this.target = this.x;
    this.tilt = 0;
    this.combo = 0;
    this.lastFatalAt = -Infinity;
    this.lastCountdown = CONFIG.duration;
    this.partner = null;
    this.awardAt = this.random() < CONFIG.award.chance ? this.between(CONFIG.award.startsAt) : Infinity;
    this.awardUntil = 0;
    this.awardUsed = false;
    this.awardWasActive = false;
    this.nearMissAt = 0;
    this.challengeBeaten = false;
    this.stats = {
      points: 0,
      welcome: 0,
      bad: 0,
      devaluations: 0,
      interest: 0,
      longestCombo: 0,
      golden: 0,
      fees: 0,
      dynamic: 0,
      awardCatches: 0,
      partners: 0,
    };
    this.damage = { dynamic:0, fee:0, interest:0, devaluation:0 };
    this.earnings = { total:0, award:0, partner:0 };
    this.programStats = Object.fromEntries(
      PROGRAMS.map(({ id }) => [id, { catches: 0, points: 0 }]),
    );
    this.bonusStats = {
      welcome: { catches: 0, points: 0 },
      transfer: { catches: 0, points: 0 },
      golden: { catches: 0, points: 0 },
    };
  }
  start() {
    this.reset();
    this.running = true;
  }
  get stage() {
    return [...CONFIG.stages]
      .reverse()
      .find((stage) => this.elapsed >= stage.at);
  }
  get remaining() {
    return Math.max(0, CONFIG.duration - this.elapsed);
  }
  get playerY() {
    return this.height - CONFIG.player.bottom - CONFIG.player.height;
  }
  get comboMultiplier() {
    return [...CONFIG.combos].reverse().find(tier => this.combo >= tier.catches)?.multiplier ?? 1;
  }
  get performanceScale() {
    if (this.elapsed < CONFIG.adaptive.startsAt) return 0;
    return Math.min(1, Math.max(0,
      (this.score / Math.max(1, this.elapsed) / CONFIG.adaptive.scorePerSecond - 1),
      (this.combo - CONFIG.adaptive.comboThreshold) / 15,
    ));
  }
  get spawnWeights() {
    return Object.fromEntries(Object.entries(this.stage.weights).map(([type, weight]) =>
      [type, weight * (!ITEMS[type].good ? 1 + this.performanceScale * (CONFIG.adaptive.maxDanger - 1) : 1) *
        (this.awardActive ? ITEMS[type].good ? CONFIG.award.goodWeight : CONFIG.award.badWeight : 1)]));
  }
  get awardActive() { return this.elapsed < this.awardUntil; }
  normalMultiplier(program) {
    const partnerMultiplier = this.partner && this.partner.program === program && this.elapsed < this.partner.until ? CONFIG.partner.multiplier : 1;
    return Math.min(CONFIG.maxMultiplier, this.comboMultiplier * (this.chaos ? CONFIG.chaosMultiplier : 1) * Math.max(this.multiplier, partnerMultiplier));
  }
  advanceCombo() {
    this.combo++;
    this.stats.longestCombo = Math.max(this.stats.longestCombo, this.combo);
    if (CONFIG.combos.some(tier => tier.catches === this.combo)) this.emit({kind: 'combo', count: this.combo, multiplier: this.comboMultiplier});
  }
  startAward() {
    if (!this.running || this.awardUsed) return;
    this.awardUsed = true;
    this.awardWasActive = true;
    this.awardUntil = this.elapsed + CONFIG.award.duration;
    this.emit({ kind: 'award', title: '🔥 CÓ CHỖ VÉ AWARD!', detail: 'ĐẶT NGAY · 5 giây để săn điểm' });
  }
  boostPartner() {
    const program = Math.floor(this.random() * PROGRAMS.length);
    this.partner = { program, until: this.elapsed + CONFIG.partner.duration };
    this.stats.partners++;
    this.emit({ kind: 'partner', title: `${PROGRAMS[program].name.toUpperCase()} TĂNG TỐC!`, detail: '2× điểm · Xuất hiện nhiều hơn trong 5 giây' });
  }
  move(x) {
    if (!Number.isFinite(x)) return;
    this.target = Math.max(
      CONFIG.player.width / 2 + 4,
      Math.min(this.width - CONFIG.player.width / 2 - 4, x),
    );
  }
  resize(width, height) {
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return;
    const ratio = width / this.width;
    this.x *= ratio;
    this.target *= ratio;
    this.items.forEach((item) => {
      item.x *= ratio;
      item.y *= height / this.height;
    });
    this.width = width;
    this.height = height;
    this.move(this.target);
  }
  spawn() {
    const type = weightedPick(this.spawnWeights, this.random);
    if (type === "balance" && this.elapsed - this.lastFatalAt < CONFIG.fairness.fatalGap) return;
    const margin = CONFIG.item.width / 2 + 6;
    const x = margin + this.random() * (this.width - margin * 2);
    // A little clear space between successive drops keeps narrow screens readable.
    if (
      this.items.some(
        (item) =>
          item.y < CONFIG.item.height + 12 &&
          Math.abs(item.x - x) < CONFIG.item.width + 10,
      )
    )
      return;
    const item = {
      id: this.nextId++,
      type,
      program: this.partner && this.random() < CONFIG.partner.spawnShare ? this.partner.program : Math.floor(this.random() * PROGRAMS.length),
      x,
      y: -CONFIG.item.height,
      speed: this.stage.speed * (0.9 + this.random() * 0.2) * (1 + this.performanceScale * (CONFIG.adaptive.maxSpeed - 1)) * (ITEMS[type].speed ?? 1),
      rotation: (this.random() - 0.5) * 12,
    };
    if (!ITEMS[type].good && !this.hasEscapeLane(item)) return;
    if (type === "balance") this.lastFatalAt = this.elapsed;
    this.items.push(item);
  }
  hasEscapeLane(candidate) {
    const arrival = (this.playerY - candidate.y - CONFIG.item.height) / candidate.speed;
    const half = (CONFIG.player.width + CONFIG.item.width) / 2 - 10;
    const threats = [...this.items.filter(item => !ITEMS[item.type].good &&
      Math.abs((this.playerY - item.y - CONFIG.item.height) / item.speed - arrival) < CONFIG.fairness.arrivalWindow), candidate];
    const intervals = threats.map(item => [item.x - half, item.x + half]).sort((a,b) => a[0] - b[0]);
    let edge = CONFIG.player.width / 2 + 4;
    const right = this.width - edge;
    for (const [start, end] of intervals) {
      if (Math.min(start, right) - edge >= CONFIG.fairness.safeGap) return true;
      edge = Math.max(edge, end);
    }
    return right - edge >= CONFIG.fairness.safeGap;
  }
  triggerEvent(type = weightedPick(CONFIG.events.weights, this.random)) {
    if (!this.running || this.multiplier !== 1) return;
    this.score = safeScore(this.score);
    if (type === "devaluation") {
      this.combo = 0;
      const loss = Math.round(this.score * CONFIG.events.devaluation);
      const before = this.score;
      this.score = safeScore(this.score - loss);
      this.damage.devaluation += before - this.score;
      this.stats.devaluations++;
      this.emit({
        kind: "event",
        type,
        title: "DEVALUATION BẤT NGỜ!",
        detail: `−${loss.toLocaleString()} điểm · Đáng lẽ nên diversify points.`,
      });
    } else {
      this.multiplier =
        type === "category"
          ? CONFIG.events.categoryMultiplier
          : CONFIG.events.transferMultiplier;
      this.multiplierUntil = this.elapsed + CONFIG.events.duration;
      this.eventName =
        type === "category" ? "NHÂN 5 ĐIỂM!" : "TRANSFER BONUS 30%!";
      this.emit({
        kind: "event",
        type,
        title: this.eventName,
        detail: "Điểm thường được nhân trong 5 giây",
      });
    }
  }
  catch(item) {
    if (!this.running) return;
    const def = ITEMS[item.type];
    if (!def) return;
    this.score = safeScore(this.score);
    if (!def.good) this.combo = 0;
    if (def.powerup) {
      this.advanceCombo();
      this.boostPartner();
      return;
    }
    if (def.fatal) {
      this.stats.bad++;
      this.end("balance");
      return;
    }
    let amount;
    if (def.good) {
      this.advanceCombo();
      amount = Math.round(
        def.value *
          (item.type === "normal"
            ? this.normalMultiplier(item.program)
            : 1),
      );
      this.stats.points++;
      const tally =
        item.type === "normal"
          ? this.programStats[PROGRAMS[item.program ?? 0].id]
          : this.bonusStats[item.type];
      tally.catches++;
      tally.points += amount;
      if (item.type === "welcome") this.stats.welcome++;
      if (item.type === "golden") this.stats.golden++;
      if (this.awardActive) this.stats.awardCatches++;
    } else {
      amount = def.penalty ? -Math.round(this.score * def.penalty) : def.value;
      this.stats.bad++;
      if (item.type === "devaluation") this.stats.devaluations++;
      if (item.type === "interest") this.stats.interest++;
      if (item.type === "fee") this.stats.fees++;
      if (item.type === "dynamic") this.stats.dynamic++;
    }
    const before = this.score;
    this.score = safeScore(this.score + amount);
    if (def.good) {
      const earned = this.score - before;
      this.earnings.total += earned;
      if (this.awardActive) this.earnings.award += earned;
      if (item.type === "normal" && this.partner && this.partner.program === item.program && this.elapsed < this.partner.until) this.earnings.partner += earned;
    } else this.damage[item.type] += before - this.score;
    if (this.challengeTarget !== null && !this.challengeBeaten && this.score > this.challengeTarget) {
      this.challengeBeaten = true;
      this.emit({ kind: 'challenge-beaten', title: '🔥 VƯỢT ĐIỂM RỒI!', detail: 'Giữ vững phong độ đến hết trận.' });
    }
    this.emit({
      kind: "catch",
      type: item.type,
      amount,
      good: !!def.good,
      message: catchMessage(item.type, this.random),
      x: item.x,
      y: this.playerY,
    });
  }
  update(dt, direction = 0) {
    if (!this.running || !Number.isFinite(dt) || dt <= 0) return;
    this.elapsed = Math.min(CONFIG.duration, this.elapsed + dt);
    if (this.remaining <= 0) {
      this.end("time");
      return;
    }
    if (this.partner && this.elapsed >= this.partner.until) this.partner = null;
    if (this.elapsed >= this.awardAt && !this.awardUsed) this.startAward();
    if (this.awardWasActive && !this.awardActive) {
      this.awardWasActive = false;
      this.emit({ kind: 'award-end', title: 'HẾT CHỖ VÉ AWARD.', detail: 'Chờ đợt mở chỗ sau.' });
    }
    if (this.elapsed >= CONFIG.stages.at(-1).at && !this.chaos) {
      this.chaos = true;
      this.emit({
        kind: "chaos",
        title: "CHẾ ĐỘ HỖN LOẠN",
        detail: "NHÂN ĐÔI ĐIỂM · 10 GIÂY CUỐI",
      });
    }
    const countdown = Math.ceil(this.remaining);
    if (countdown <= 3 && countdown !== this.lastCountdown) this.emit({kind: "countdown", value: countdown});
    this.lastCountdown = countdown;
    if (this.elapsed >= this.multiplierUntil) {
      this.multiplier = 1;
      this.eventName = "";
    }
    if (this.elapsed >= this.eventAt && this.multiplier === 1) {
      this.triggerEvent();
      this.eventAt = this.elapsed + this.between(CONFIG.events.interval);
    }
    if (direction)
      this.move(this.target + direction * CONFIG.player.speed * dt);
    const oldX = this.x;
    this.x +=
      (this.target - this.x) * (1 - Math.exp(-CONFIG.player.smoothing * dt));
    this.tilt = Math.max(-12, Math.min(12, (this.x - oldX) * 1.5));
    this.spawnIn -= dt;
    if (this.spawnIn <= 0) {
      this.spawn();
      this.spawnIn = this.stage.interval;
    }
    for (const item of this.items) {
      const oldY = item.y;
      item.y += item.speed * dt;
      const hitsX =
        Math.abs(item.x - this.x) <
        (CONFIG.player.width + CONFIG.item.width) / 2 - 10;
      const hitsY =
        oldY < this.playerY + CONFIG.player.height &&
        item.y + CONFIG.item.height >= this.playerY + 12;
      if (hitsX && hitsY) {
        item.caught = true;
        this.catch(item);
        if (!this.running) return;
      }
      if (!item.caught && !item.nearMiss && ['interest', 'devaluation', 'balance'].includes(item.type) &&
          oldY < this.playerY + CONFIG.player.height && item.y >= this.playerY + CONFIG.player.height) {
        item.nearMiss = true;
        const distance = Math.abs(item.x - this.x) - ((CONFIG.player.width + CONFIG.item.width) / 2 - 10);
        if (distance >= 0 && distance <= CONFIG.nearMiss.distance && this.elapsed >= this.nearMissAt && this.random() < CONFIG.nearMiss.chance) {
          this.nearMissAt = this.elapsed + CONFIG.nearMiss.cooldown;
          this.emit({ kind: 'near-miss', x: this.x, y: this.playerY });
        }
      }
    }
    this.items = this.items.filter(
      (item) => !item.caught && item.y < this.height + CONFIG.item.height,
    );
  }
  end(reason) {
    this.running = false;
    this.reason = reason;
    this.items = [];
    this.multiplier = 1;
    this.eventName = "";
    this.partner = null;
    this.awardUntil = 0;
    this.emit({ kind: "end", reason });
  }
}
