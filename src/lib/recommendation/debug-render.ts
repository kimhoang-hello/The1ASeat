/**
 * Trình bày debugger §22 thành văn bản — cho CLI `npm run reco:debug` và cho
 * trang admin.
 *
 * Chỉ TRÌNH BÀY. Mọi con số đã có sẵn trong bản ghi §20 hoặc trong kết quả của
 * `debug.ts`; không một phép tính nào ở đây được phép đổi chúng. Nếu phải tính
 * gì mới để in ra thì phép tính đó thuộc về `debug.ts`, có test, và trang
 * admin dùng chung.
 *
 * Mười một mục đúng theo danh sách §22, đúng thứ tự dây chuyền — admin đọc từ
 * trên xuống là đọc theo đúng đường đi của khuyến nghị.
 *
 * KHÔNG BAO GIỜ NÉM. Engine nhận hồ sơ dở dang (§30), nên bản ghi cũng có thể
 * mang một hồ sơ thiếu nửa. Một debugger sập trên đúng hồ sơ kỳ quặc cần gỡ lỗi
 * là một debugger vô dụng đúng lúc cần nó nhất.
 */

import {
  compareCandidates,
  scoreBreakdown,
  type CandidateComparison,
  type ProductExplanation,
} from "./debug.ts";
import { candidateKey, STAGE_LABELS, type ChangeExplanation, type StageDiff } from "./run-diff.ts";
import type { RecommendationRunRecord } from "./runs.ts";
import type { Candidate, GoalTrace } from "./engine-types.ts";
import type { EstimatedAmount } from "./user-types.ts";

const INT = new Intl.NumberFormat("en-US");

function int(value: number | null | undefined): string {
  return value == null || !Number.isFinite(value) ? "—" : INT.format(Math.round(value));
}

function score(value: number | null | undefined): string {
  return value == null || !Number.isFinite(value) ? "—" : value.toFixed(4);
}

function signed(value: number): string {
  const text = Math.abs(value).toFixed(4);
  return value > 0 ? `+${text}` : value < 0 ? `−${text}` : ` ${text}`;
}

function pct(value: number | null | undefined): string {
  return value == null || !Number.isFinite(value) ? "—" : `${Math.round(value * 100)}%`;
}

function money(cents: number | null | undefined): string {
  return cents == null || !Number.isFinite(cents) ? "—" : `$${INT.format(Math.round(cents / 100))}`;
}

function range(amount: EstimatedAmount | null | undefined): string {
  if (amount == null) return "chưa khai";
  return amount.high == null ? `$${int(amount.low)}+` : `$${int(amount.low)}–${int(amount.high)}`;
}

function yesNo(value: boolean | null | undefined): string {
  return value == null ? "chưa hỏi" : value ? "có" : "không";
}

function pad(text: string, width: number): string {
  const length = [...text].length;
  return length >= width ? text : text + " ".repeat(width - length);
}

function heading(index: number | null, title: string): string {
  return `\n${index === null ? "" : `${index}. `}${title.toUpperCase()}\n${"─".repeat(72)}`;
}

function codes(list: readonly string[]): string {
  return list.length === 0 ? "—" : list.join(", ");
}

function goalLabel(goal: GoalTrace): string {
  const g = goal.goal.goal;
  if (g.type === "trip") {
    const trip = goal.goal.trip;
    return (
      `chuyến đi ${trip?.originRegion ?? g.originRegion ?? "?"} → ${g.destinationRegion} · ` +
      `hạng ${trip?.cabin ?? "chưa khai"} · ${trip?.passengers ?? "?"} người · ` +
      `${trip?.roundTrip == null ? "khứ hồi?" : trip.roundTrip ? "khứ hồi" : "một chiều"}`
    );
  }
  if (g.type === "earn_points") return `tích điểm${g.targetProgramId === null ? "" : ` (${g.targetProgramId})`}`;
  return g.type;
}

/* ------------------------------------------------------------------ *
 * Bảng điểm
 * ------------------------------------------------------------------ */

export function renderScoreTable(candidate: Candidate): string {
  const table = scoreBreakdown(candidate);
  const lines = [`  ${pad(candidateKey(candidate), 40)} điểm cuối ${score(candidate.score)}`];
  for (const row of table.lines) {
    const detail =
      row.layer === "scoring"
        ? `w=${row.weight?.toFixed(2)} raw=${row.raw?.toFixed(3)}  ${row.note ?? ""}`
        : row.note ?? "";
    lines.push(`    ${pad(row.layer, 12)} ${pad(row.key, 30)} ${signed(row.effect)}  ${detail}`);
  }
  lines.push(`    ${pad("", 12)} ${pad("= điểm nền", 30)}  ${score(table.baseScore)}`);
  return lines.join("\n");
}

export function renderComparison(comparison: CandidateComparison, limit = 12): string {
  const lines = [
    `  ${comparison.a} − ${comparison.b} = ${signed(comparison.gap)}`,
    `  theo tầng: ${comparison.byLayer.map((row) => `${row.layer} ${signed(row.delta)}`).join(" · ")}`,
  ];
  for (const row of comparison.lines.slice(0, limit)) {
    if (row.delta === 0) continue;
    lines.push(
      `    ${pad(row.layer, 12)} ${pad(row.key, 30)} ${signed(row.delta)}   (${score(row.effectA)} vs ${score(row.effectB)})`,
    );
  }
  lines.push(
    comparison.decisive.length === 0
      ? "  không dòng nào một mình lớn hơn khoảng cách — khoảng cách là tổng của nhiều thứ nhỏ"
      : `  dòng QUYẾT ĐỊNH (gỡ một dòng là đảo thứ tự): ${comparison.decisive.map((row) => `${row.layer}/${row.key}`).join(", ")}`,
  );
  return lines.join("\n");
}

/* ------------------------------------------------------------------ *
 * Báo cáo một lượt chạy — 11 mục của §22
 * ------------------------------------------------------------------ */

export interface RunReportOptions {
  /** Mục tiêu nào khi lượt chạy có nhiều mục tiêu hoà nhau. Mặc định: tất cả. */
  goalIndex?: number;
  /** Số dòng bảng xếp hạng. Mặc định: tất cả. */
  rankingLimit?: number;
}

export function renderRunReport(record: RecommendationRunRecord, options: RunReportOptions = {}): string {
  const out: string[] = [];
  const input = record.inputSnapshot;
  const state = input.state;
  const derived = record.derivedState;
  const output = record.outputSnapshot;

  out.push(`═══ LƯỢT CHẠY ${record.id} ═══`);
  out.push(
    `engine ${record.engineVersion} · luật biên tập ${record.ruleVersion} · asOf ${input.asOf} · ` +
      `knownAt ${input.knownAt ?? "—"} · lưu lúc ${record.createdAt}`,
  );
  out.push(
    `vân tay: dữ liệu ${input.datasetFingerprint} · lịch sử offer ${input.offerHistoryFingerprint} · ` +
      `người dùng ${input.stateFingerprint}`,
  );

  /* ---- Đầu vào ---------------------------------------------------- */
  out.push(heading(null, "Đầu vào (hồ sơ giả / hồ sơ thật)"));
  const profile = state?.profile;
  out.push(
    `  nước ${profile?.country ?? "?"} · thu nhập cá nhân ${range(profile?.annualPersonalIncome)}` +
      `${profile?.personalIncomeDeclined ? " (từ chối nói)" : ""} · hộ ${range(profile?.annualHouseholdIncome)}`,
  );
  out.push(
    `  ngưỡng phí ${profile?.annualFeeTolerancePerCard == null ? "chưa khai" : `$${int(profile.annualFeeTolerancePerCard)}`}` +
      ` · xét thẻ doanh nghiệp ${yesNo(profile?.businessCardsAllowed)} · có doanh nghiệp ${yesNo(profile?.hasBusiness)}` +
      ` · sinh viên ${yesNo(profile?.isStudent)}`,
  );
  out.push(
    `  chi tiêu/tháng ${range(state?.spend?.monthlyTotal)} · sức dồn 3 tháng ${range(state?.spend?.minimumSpendCapacity3m)}` +
      ` · hạng mục ${Object.keys(state?.spend?.byCategory ?? {}).length}`,
  );
  const cards = Array.isArray(state?.cards) ? state.cards : [];
  out.push(
    `  thẻ (${state?.declared?.cards ? "đã khai" : "CHƯA khai"}): ` +
      (cards.length === 0 ? "không có" : cards.map((card) => `${card?.productId}[${card?.status}]`).join(", ")),
  );
  const balances = Array.isArray(state?.balances) ? state.balances : [];
  out.push(
    `  số dư (${state?.declared?.balances ? "đã khai" : "CHƯA khai"}): ` +
      (balances.length === 0
        ? "không có"
        : balances.map((row) => `${row?.programId} ${row?.balance == null ? "?" : int(row.balance)}`).join(", ")),
  );

  const goals =
    options.goalIndex === undefined
      ? derived.goals.map((goal, index) => ({ goal, index }))
      : derived.goals
          .map((goal, index) => ({ goal, index }))
          .filter(({ index }) => index === options.goalIndex);

  /* ---- 1. Mục tiêu đã chuẩn hoá ----------------------------------- */
  out.push(heading(1, "Normalized goal — mục tiêu đã chuẩn hoá"));
  out.push(`  giải mục tiêu: ${output.goalResolution}${derived.goals.length > 1 ? ` (${derived.goals.length} mục tiêu hoà, chạy song song)` : ""}`);
  for (const { goal, index } of goals) {
    out.push(`  [${index}] ${goalLabel(goal)}`);
    const need = goal.goal.tripNeed;
    if (need !== null) {
      out.push(
        `      điểm cần (gộp, chỉ để trình bày): ${int(need.low)} / ${int(need.typical)} / ${int(need.high)}` +
          `${need.floorOnly ? " — CHỈ MỨC SÀN" : ""}`,
      );
      for (const row of need.byProgram) {
        out.push(`      ${pad(row.programId, 16)} ${int(row.low)} / ${int(row.typical)} / ${int(row.high)}`);
      }
      if (need.programs.length === 0) out.push("      chưa chương trình nào định giá được chặng này");
    }
    const cover = goal.tripCoverage;
    if (cover !== null) {
      out.push(
        `      phủ: ${
          cover.coverage !== null && !cover.coverageKnown
            ? `ƯỚC ${pct(cover.coverage)} (có số dư chưa biết — phần đã biết phủ ${pct(cover.coverageLowerBound)})`
            : pct(cover.coverage)
        } qua ${cover.bestProgram ?? "—"}${cover.coversTypical ? " · đã đủ ở giá điển hình" : ""} · tiếp cận được ${int(cover.accessible)}` +
          `${cover.accessibleIsLowerBound ? " (CẬN DƯỚI)" : ""}` +
          `${cover.unpricedHeldPrograms.length > 0 ? ` · chỉ biết giá sàn: ${cover.unpricedHeldPrograms.join(", ")}` : ""}`,
      );
    }
  }
  out.push(`  chỗ trống người dùng: ${codes([...new Set(output.userGaps.map((gap) => gap.kind))])}`);
  out.push(
    `  chỗ trống dữ liệu chạm tới: ${
      output.dataGaps.length === 0 ? "—" : output.dataGaps.map((gap) => `${gap.kind}:${gap.subjectId}`).join(", ")
    }`,
  );

  /* ---- 2. Danh mục ------------------------------------------------ */
  out.push(heading(2, "Portfolio analysis — phân tích danh mục §7"));
  const portfolio = derived.portfolio;
  out.push(
    `  số dư: ${
      portfolio.direct.length === 0
        ? "không có"
        : portfolio.direct
            .map(({ programId, knowledge }) =>
              `${programId} ${knowledge.kind === "known" ? int(knowledge.points) : knowledge.kind === "unknown" ? "CHƯA BIẾT" : "—"}`,
            )
            .join(", ")
    }`,
  );
  out.push(
    `  giá trị đã biết ${money(portfolio.knownValueCents)}${portfolio.hasUnknownBalance ? " (CẬN DƯỚI — có số dư chưa biết)" : ""}` +
      ` · linh hoạt ${pct(portfolio.flexibilityScore)}`,
  );
  out.push(
    `  tập trung: ${
      portfolio.concentration.length === 0
        ? "—"
        : portfolio.concentration.map((row) => `${row.ecosystem} ${pct(row.share)}`).join(", ")
    }`,
  );
  out.push(`  thẻ đang giữ: ${codes(portfolio.heldProductIds)} · kiếm: ${codes(portfolio.earnedPrograms)}`);

  for (const { goal, index } of goals) {
    const result = output.results[index];
    /* ---- 3. Nhu cầu ---------------------------------------------- */
    out.push(heading(3, `Derived needs — nhu cầu §9 [mục tiêu ${index}]`));
    out.push(
      `  mở thẻ mới ${goal.needs.action.newCard.toFixed(3)} · đa dạng hoá ${goal.needs.portfolio.diversification.toFixed(3)}` +
        ` · linh hoạt ${goal.needs.portfolio.flexibility.toFixed(3)}`,
    );
    out.push(
      `  đồng tiền cần nhất: ${goal.needs.currency
        .slice(0, 8)
        .map((row) => `${row.programId} ${row.need.toFixed(2)}`)
        .join(", ")}`,
    );

    /* ---- 4. Chiến lược ------------------------------------------- */
    out.push(heading(4, `Generated strategies — chiến lược §8 [mục tiêu ${index}]`));
    for (const row of result?.strategies ?? []) {
      out.push(`  ${pad(row.strategy, 24)} ${row.score.toFixed(3)}  ${codes(row.reasonCodes)}`);
    }
  }

  /* ---- 5. Thẻ bị loại ---------------------------------------------- */
  out.push(heading(5, "Excluded products — thẻ bị loại (không được chấm điểm)"));
  if (derived.excluded.length === 0) out.push("  không có");
  const ruleOf = new Map(
    derived.candidates.flatMap((row) => row.eligibility.rules.map((rule) => [rule.ruleId, rule] as const)),
  );
  for (const row of derived.excluded) {
    const failed = row.failedRuleIds
      .map((id) => ruleOf.get(id))
      .filter((rule) => rule !== undefined)
      .map((rule) => `${rule.ruleType} ${rule.operator} ${JSON.stringify(rule.value)}`);
    out.push(
      `  ${pad(row.productSlug, 42)} ${pad(row.stage, 12)} ${row.reason}${failed.length > 0 ? ` — ${failed.join("; ")}` : ""}`,
    );
  }

  /* ---- 6. Cảnh báo phù hợp ------------------------------------------ */
  out.push(heading(6, "Suitability warnings — phù hợp / điều kiện của ứng viên còn lại"));
  let anyWarning = false;
  for (const row of derived.candidates) {
    if (!row.selectable) continue;
    const s = row.suitability;
    const e = row.eligibility;
    const bits: string[] = [];
    if (s.penalty < 1) bits.push(`phạt ×${s.penalty.toFixed(2)}`);
    if (s.minSpendFit !== null && s.minSpendFit < 0.9) bits.push(`mốc chi vừa ${s.minSpendFit.toFixed(2)}`);
    if (e.status !== "eligible") bits.push(`điều kiện ${e.status}`);
    if (e.welcomeOfferBlocked) bits.push("bonus bị chặn");
    const warnings = [...s.warnings, ...e.warnings];
    if (bits.length === 0 && warnings.length === 0) continue;
    anyWarning = true;
    out.push(`  ${pad(row.productSlug, 42)} ${bits.join(" · ")}${warnings.length > 0 ? ` [${warnings.join(", ")}]` : ""}`);
  }
  if (!anyWarning) out.push("  không có");

  for (const { goal, index } of goals) {
    const result = output.results[index];
    const ranking = options.rankingLimit === undefined ? goal.ranking : goal.ranking.slice(0, options.rankingLimit);

    /* ---- 7. Ứng viên --------------------------------------------- */
    out.push(heading(7, `Candidate products — bảng xếp hạng đầy đủ [mục tiêu ${index}]`));
    out.push(`  ${pad("#", 4)}${pad("ứng viên", 42)}${pad("điểm", 8)}${pad("nền", 8)}${pad("Σ luật", 9)}hiển thị`);
    for (const row of ranking) {
      const c = row.candidate;
      const adj = c.adjustments.reduce((sum, a) => sum + a.delta, 0);
      out.push(
        `  ${pad(String(row.rank), 4)}${pad(candidateKey(c), 42)}${pad(score(c.score), 8)}${pad(score(c.baseScore), 8)}` +
          `${pad(signed(adj), 9)}${row.visibility}${row.hiddenBy === null ? "" : ` (nhường ${row.hiddenBy})`}`,
      );
    }

    /* ---- 8. Bảng điểm -------------------------------------------- */
    out.push(heading(8, `Score breakdown — bảng điểm §19 [mục tiêu ${index}]`));
    const winner = goal.ranking[0]?.candidate;
    if (winner !== undefined) out.push(renderScoreTable(winner));
    const noAction = goal.ranking.find((row) => row.candidate.kind === "no_new_card")?.candidate;
    if (noAction !== undefined && noAction !== winner) out.push(renderScoreTable(noAction));
    const runnerUp = goal.ranking[1]?.candidate;
    if (winner !== undefined && runnerUp !== undefined) {
      out.push("\n  vì sao người thắng đứng trên hạng nhì:");
      out.push(renderComparison(compareCandidates(winner, runnerUp), 8));
    }

    /* ---- 9. Luật ------------------------------------------------- */
    out.push(heading(9, `Editorial rule effects — luật §16 + biên tập §17 [mục tiêu ${index}]`));
    out.push(`  bộ luật biên tập version ${record.ruleVersion}${record.ruleVersion === "0" ? " (RỖNG — §15 chưa làm)" : ""}`);
    const byRule = new Map<string, { layer: string; total: number; who: string[] }>();
    for (const row of goal.ranking) {
      for (const a of row.candidate.adjustments) {
        const entry = byRule.get(a.rule) ?? { layer: a.layer, total: 0, who: [] };
        entry.total += a.delta;
        entry.who.push(`${candidateKey(row.candidate)} ${signed(a.delta)}`);
        byRule.set(a.rule, entry);
      }
    }
    if (byRule.size === 0) out.push("  không luật nào đổi điểm");
    for (const [rule, entry] of [...byRule].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
      out.push(`  ${pad(rule, 30)} ${pad(entry.layer, 12)} ${entry.who.length} ứng viên`);
      for (const who of entry.who.slice(0, 6)) out.push(`      ${who}`);
      if (entry.who.length > 6) out.push(`      … và ${entry.who.length - 6} ứng viên nữa`);
    }

    /* ---- 10. Khuyến nghị cuối ------------------------------------ */
    out.push(heading(10, `Final recommendation — khuyến nghị cuối [mục tiêu ${index}]`));
    if (result !== undefined) {
      out.push(`  chiến lược: ${result.strategy.strategy} (${result.strategy.score.toFixed(3)})`);
      out.push(`  hành động chính: ${candidateKey(result.primaryAction)} ${score(result.primaryAction.score)}`);
      out.push(`  thay thế: ${result.alternatives.map((c) => `${candidateKey(c)} ${score(c.score)}`).join(", ") || "—"}`);
      out.push(`  NO_NEW_CARD: ${score(result.noAction.score)}`);
      out.push(`  mã lý do: ${codes(result.reasonCodes)}`);
      out.push(`  cảnh báo: ${codes(result.warnings)}`);
      const n = result.numbers;
      out.push(
        `  số: cần ${int(n.tripNeedLow)}/${int(n.tripNeedTypical)}/${int(n.tripNeedHigh)} · có sẵn ${int(n.directPoints)}` +
          ` · tiếp cận ${int(n.accessiblePoints)}${n.accessiblePointsIsLowerBound ? " (cận dưới)" : ""} · thiếu ${int(n.pointsGapTypical)}`,
      );

      /* ---- 11. Độ tin cậy ---------------------------------------- */
      out.push(heading(11, `Confidence — độ tin cậy §29 [mục tiêu ${index}]`));
      const c = result.confidence;
      out.push(
        `  ${c.level.toUpperCase()} · đầy đủ ${c.dataCompleteness.toFixed(2)} · tươi ${c.dataFreshness.toFixed(2)}` +
          ` · cụ thể ${c.goalSpecificity.toFixed(2)} · tách bạch ${c.scoreSeparation.toFixed(2)}`,
      );
      const inputs = goal.confidenceInputs;
      out.push(
        `  hạng nhất ${score(inputs.topScore)} · hạng nhì ${score(inputs.secondScore)} · ${inputs.rivalCount} đối thủ` +
          ` · dữ kiện cũ nhất ${inputs.oldestVerifiedAt ?? "—"}`,
      );
      for (const note of c.notes) out.push(`  • ${note}`);
    }
  }
  out.push(
    `\n  câu hỏi tiếp theo §30: ${
      output.followUp === null ? "không có câu nào để hỏi" : `${output.followUp.gapKind} (${output.followUp.subject}) — ${output.followUp.reason}`
    }`,
  );
  // Những câu §30 đã ĐO — câu nào lấp vào đổi được người thắng. Đây là chỗ
  // trả lời "lỗi có nằm ở đầu vào không": chỗ trống nào đủ sức lật kết quả.
  const probes = derived.followUpProbes ?? [];
  if (probes.length === 0) {
    out.push("  (không câu hỏi nào đo được bằng câu trả lời thử)");
  } else {
    out.push("  đã đo (lấp thử từng chỗ trống, chạy lại engine):");
    for (const probe of [...probes].filter((row) => row.flips > 0).sort((a, b) => b.flips - a.flips)) {
      const flipped = probe.outcomes.filter((row) => row.flipsWinner);
      out.push(
        `    ${pad(`${probe.gapKind}:${probe.subject}`, 46)} ${probe.flips}/${probe.valid} đổi người thắng — ` +
          flipped.map((row) => `${row.label} → ${row.winner}`).join("; "),
      );
    }
    const rejected = probes.flatMap((row) =>
      row.outcomes.filter((o) => o.invalid).map((o) => `${row.gapKind}: ${o.label}`),
    );
    if (rejected.length > 0) {
      out.push(`    bỏ ${rejected.length} câu trả lời thử làm hồ sơ mâu thuẫn: ${rejected.slice(0, 6).join("; ")}`);
    }
    const inert = probes.filter((row) => row.flips === 0);
    if (inert.length > 0) {
      out.push(
        `    ${inert.length} chỗ trống khác KHÔNG đổi được người thắng: ` +
          [...new Set(inert.map((row) => row.gapKind))].join(", "),
      );
    }
  }
  return out.join("\n");
}


/* ------------------------------------------------------------------ *
 * Thẻ X đi tới đâu
 * ------------------------------------------------------------------ */

const OUTCOME_TEXT: Record<ProductExplanation["outcome"], string> = {
  not_in_dataset: "KHÔNG có trong bộ dữ liệu của lượt chạy này",
  excluded_universe: "bị loại TRƯỚC khi chấm điểm (tập ứng viên)",
  excluded_suitability: "bị loại vì PHÙ HỢP — người dùng đã nói không",
  excluded_eligibility: "bị loại vì ĐIỀU KIỆN — ngân hàng sẽ từ chối",
  not_ranked_no_goal: "chọn được, nhưng KHÔNG được xếp hạng — lượt chạy chưa có mục tiêu nào",
  primary: "là HÀNH ĐỘNG CHÍNH",
  alternative: "là GỢI Ý THAY THẾ",
  no_action_slot: "không thắng — nằm ở chỗ RIÊNG của NO_NEW_CARD, không phải gợi ý thay thế",
  hidden_same_family: "được chấm điểm nhưng BỊ ẨN — một hạng cùng họ đã hiện ra",
  hidden_beyond_cutoff: "được chấm điểm nhưng BỊ ẨN — nằm dưới vạch cắt số gợi ý",
};

const UNIVERSE_TEXT: Record<string, string> = {
  not_credit_card: "không phải thẻ tín dụng",
  other_country: "khác nước của người dùng",
  not_available: "không nhận đơn mới ở ngày chạy (product_availability)",
  already_held: "người dùng ĐANG GIỮ thẻ này (§16 Rule 5)",
};

export function renderProductExplanation(explanation: ProductExplanation): string {
  const out: string[] = [];
  out.push(`═══ ${explanation.key}${explanation.productName ? ` — ${explanation.productName}` : ""} ═══`);
  out.push(`kết cục: ${OUTCOME_TEXT[explanation.outcome]}`);
  out.push(`quyết định ở tầng: ${STAGE_LABELS[explanation.decidedAt]}`);
  out.push(`do: ${explanation.drivenBy.join(" + ")}`);

  if (explanation.excluded !== null) {
    const e = explanation.excluded;
    out.push(heading(null, "Cửa đã chặn"));
    out.push(`  ${e.stage}: ${e.stage === "universe" ? (UNIVERSE_TEXT[e.reason] ?? e.reason) : e.reason}`);
  }

  const facts = explanation.facts;
  if (facts !== null) {
    out.push(heading(null, "Điều kiện §14 — từng luật"));
    out.push(`  phán quyết: ${facts.eligibility.status}${facts.eligibility.welcomeOfferBlocked ? " · welcome bonus BỊ CHẶN" : ""}`);
    if (facts.eligibility.rules.length === 0) out.push("  không có luật nào đang hiệu lực");
    for (const rule of facts.eligibility.rules) {
      out.push(
        `  ${pad(rule.outcome.toUpperCase(), 8)} ${pad(rule.severity, 8)} ${pad(rule.scope, 14)} ` +
          `${rule.ruleType} ${rule.operator} ${JSON.stringify(rule.value)}${rule.ruleGroup ? ` [nhóm HOẶC ${rule.ruleGroup}]` : ""}  (${rule.ruleId})`,
      );
    }
    const gapIds = facts.eligibility.unknownRuleIds.filter((id) => id.startsWith("gap:"));
    if (gapIds.length > 0) out.push(`  lớp dữ liệu nói CHƯA BIẾT hết điều kiện: ${gapIds.join(", ")}`);

    out.push(heading(null, "Phù hợp §14"));
    const s = facts.suitability;
    out.push(
      `  ${s.excluded ? `LOẠI (${s.excludedReason})` : `hệ số phạt ×${s.penalty.toFixed(3)}`} · phí năm đầu $${int(s.firstYearFee)}` +
        ` · phí năm sau $${int(s.ongoingFee)} · mốc chi vừa ${s.minSpendFit === null ? "chưa biết" : s.minSpendFit.toFixed(2)}`,
    );
    out.push(`  mã: ${codes(s.reasonCodes)} · cảnh báo: ${codes(s.warnings)}`);

    out.push(heading(null, "Dữ kiện ứng viên"));
    const o = facts.offer;
    out.push(
      `  offer ${o.activeOfferId ?? "không có"} · headline ${int(o.headlineBonus)} · giá trị đầy đủ ${money(o.fullValueCents)}` +
        ` · dùng được ${money(o.usableValueCents)} · mốc/90 ngày $${int(o.fullRequiredPerNinetyDays)}` +
        ` · percentile ${o.historicalPercentile ?? "—"} (${o.historyPoints} điểm lịch sử)${o.termsUnknown ? " · ĐIỀU KHOẢN CHƯA BIẾT" : ""}`,
    );
    out.push(
      `  tích điểm/năm ${money(facts.earn.annualValueCents)}${facts.earn.fromStatedCategories ? "" : " (trên chi tiêu CHƯA phân bổ)"}` +
        ` · quyền lợi thêm ${facts.benefits.incrementalCount}/${facts.benefits.totalCount} (${money(facts.benefits.incrementalCashCents)})` +
        `${facts.benefits.duplicatedKeys.length > 0 ? ` · TRÙNG: ${facts.benefits.duplicatedKeys.join(", ")}` : ""}`,
    );
  }

  if (explanation.ranked !== null) {
    const r = explanation.ranked;
    out.push(heading(null, "Xếp hạng"));
    out.push(`  hạng ${r.rank} · ${r.visibility}${r.hiddenBy === null ? "" : ` — nhường chỗ cho ${r.hiddenBy}`}`);
    out.push(renderScoreTable(r.candidate));
  }
  if (explanation.versus !== null) {
    out.push(heading(null, explanation.outcome === "primary" ? "So với hạng nhì" : "So với người thắng"));
    out.push(renderComparison(explanation.versus));
  }
  if (explanation.versusNoAction !== null) {
    out.push(heading(null, "So với NO_NEW_CARD"));
    out.push(renderComparison(explanation.versusNoAction, 8));
  }
  if (explanation.dataGaps.length > 0) {
    out.push(heading(null, "Chỗ trống dữ liệu của thẻ này"));
    for (const gap of explanation.dataGaps) out.push(`  ${gap.kind}: ${gap.subjectId} — ${gap.reason ?? ""}`);
  }
  if (explanation.provenance !== null) {
    out.push(heading(null, "Bản ghi nguồn engine đã đọc"));
    for (const row of explanation.provenance) {
      out.push(
        `  ${pad(row.table, 18)} ${pad(row.id, 48)} kiểm ${row.verifiedAt ?? "—"} · ${row.sourceKind ?? "—"} · ${row.sourceUrl ?? "không có URL"}`,
      );
    }
  }
  return out.join("\n");
}

/* ------------------------------------------------------------------ *
 * Hai lượt chạy
 * ------------------------------------------------------------------ */

export function renderStageDiffs(diffs: readonly StageDiff[], entriesPerStage = 6): string {
  const out: string[] = [];
  for (const row of diffs) {
    out.push(`  ${row.changed ? "≠" : "="} ${pad(row.label, 58)} ${row.changed ? `${row.count} chỗ khác` : ""}`);
    for (const entry of row.changed ? row.entries.slice(0, entriesPerStage) : []) {
      out.push(`      ${entry.path}: ${JSON.stringify(entry.before) ?? "∅"} → ${JSON.stringify(entry.after) ?? "∅"}`);
    }
  }
  return out.join("\n");
}

export function renderChangeExplanation(change: ChangeExplanation): string {
  const out: string[] = [];
  out.push(`═══ VÌ SAO HAI LƯỢT CHẠY KHÁC NHAU ═══`);
  out.push(`người thắng: ${change.winner.before} → ${change.winner.after}`);
  out.push(
    `engine ${change.engineVersion.before} → ${change.engineVersion.after} · luật ${change.ruleVersion.before} → ${change.ruleVersion.after}`,
  );
  out.push(heading(null, "Đầu vào nào đã đổi"));
  out.push(`  người dùng: ${change.userInput.length === 0 ? "không đổi" : `${change.userInput.length} chỗ`}`);
  for (const entry of change.userInput.slice(0, 10)) {
    out.push(`      ${entry.path}: ${JSON.stringify(entry.before) ?? "∅"} → ${JSON.stringify(entry.after) ?? "∅"}`);
  }
  out.push(`  dữ liệu nguồn: ${change.sourceData.length === 0 ? "không đổi" : change.sourceData.map((e) => e.path).join(", ")}`);
  for (const table of change.datasetChanges ?? []) {
    out.push(
      `      ${table.table}: +${table.added.length} −${table.removed.length} ~${table.changed.length}` +
        `${table.changed.length > 0 ? ` (${table.changed.slice(0, 4).map((row) => `${row.id}: ${row.fields.slice(0, 3).join(",")}`).join("; ")})` : ""}`,
    );
  }
  out.push(`  lịch sử offer: ${change.offerHistoryChanged.length === 0 ? "không đổi" : change.offerHistoryChanged.join(", ")}`);
  if (change.engineEffect !== null) {
    out.push(heading(null, "Tác động của riêng ENGINE (lượt cũ chạy lại bằng engine hôm nay)"));
    out.push(renderStageDiffs(change.engineEffect, 3));
  }
  if (change.swaps !== null) {
    out.push(heading(null, "Đổi TỪNG yếu tố một trên nền lượt cũ"));
    for (const swap of change.swaps) {
      out.push(
        `  ${pad(swap.factor, 16)} ${swap.differs ? `một mình → người thắng ${swap.winnerAlone}` : "không đổi"}` +
          `${swap.firstDivergence === null ? "" : ` · lan từ tầng ${swap.firstDivergence}`}`,
      );
    }
  }
  out.push(heading(null, "Theo từng tầng"));
  out.push(renderStageDiffs(change.stages));
  return out.join("\n");
}
