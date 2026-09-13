/**
 * §22 Recommendation Debugger — phần TRẢ LỜI CÂU HỎI.
 *
 * Phép thử của Phase 4: có người nói "khuyến nghị này sai", admin phải tìm ra
 * NHANH vì sao engine đưa ra nó. Ba câu hỏi admin sẽ hỏi, ba hàm:
 *
 *   `explainProduct`   — thẻ X đi tới đâu trong dây chuyền, và dừng ở cửa nào.
 *                        Câu hỏi hay gặp nhất là "vì sao thẻ X KHÔNG hiện ra".
 *   `compareCandidates`— vì sao A đứng trên B: khoảng cách điểm tách thành từng
 *                        thành phần và từng luật, cộng lại ĐÚNG bằng khoảng cách.
 *   `scoreBreakdown`   — bảng §19 của một ứng viên, cộng lại ĐÚNG bằng điểm cuối.
 *
 * Mọi hàm đọc từ BẢN GHI §20, không chạy lại engine. Đó là cố ý: debugger giải
 * thích thứ engine ĐÃ làm, và một lời giải thích dựng bằng một lượt chạy thứ
 * hai sẽ giải thích lượt chạy thứ hai.
 *
 * KHÔNG có câu tiếng Việt cho người đọc ở đây — chỉ dữ liệu. `debug-render.ts`
 * trình bày; Phase 6 có thể trình bày khác trên cùng dữ liệu này.
 */

import { activeAt } from "./temporal.ts";
import { flexibilityReach, flexibilityScale, isOpenToEveryone } from "./portfolio.ts";
import { indexDataset } from "./indexes.ts";
import { candidateKey, type PipelineStage } from "./run-diff.ts";
import type { RecommendationRunRecord } from "./runs.ts";
import type { RuleUnknownCause } from "./eligibility.ts";
import { gateRuleIds } from "./legacy.ts";
import { validateDataset, type ValidationIssue } from "./validate.ts";
import { SPEC_WEIGHTS, WEIGHT_SOURCE } from "./spec-weights.ts";
import type { AwardStrategy, DataGap, PointsProgramId, RecommendationDataset, Temporal } from "./types.ts";
import type {
  AdjustmentLayer,
  Candidate,
  CandidateFactsSnapshot,
  EligibilityVerdict,
  ExcludedProduct,
  GoalTrace,
  ProvenanceRow,
  RankedCandidate,
} from "./engine-types.ts";

/* ------------------------------------------------------------------ *
 * Bảng điểm §19
 * ------------------------------------------------------------------ */

/** Tầng sinh ra một dòng của bảng điểm. `scoring` = thành phần §10. */
export type ScoreLayer = "scoring" | AdjustmentLayer | "clamp";

export interface ScoreLine {
  layer: ScoreLayer;
  /** Tên thành phần (§10) hoặc tên luật (§16/§17). */
  key: string;
  /** Tác động lên ĐIỂM CUỐI, cùng một đơn vị cho mọi dòng. */
  effect: number;
  weight: number | null;
  raw: number | null;
  note: string | null;
}

export interface ScoreBreakdown {
  candidate: string;
  lines: ScoreLine[];
  /**
   * Tổng trọng số của các thành phần CÓ MẶT — mẫu số của `assembleScore`.
   *
   * Bảng §10 cộng tới 100% nhưng 5% biên tập (§15) chưa có thành phần nào, nên
   * mẫu số là 0.95 và mỗi dòng là `w × raw ÷ 0.95`. Không in con số này ra thì
   * admin nhân `0.35 × 0.85 = 0.2975` rồi thấy bảng ghi `+0.3132`, và phép
   * chuẩn hoá thành một phép biến đổi không ai dựng lại được từ bảng.
   */
  totalWeight: number;
  baseScore: number;
  score: number;
}

/**
 * Bảng điểm của một ứng viên, mọi dòng cùng đơn vị "điểm cuối".
 *
 * `ScoreComponent.contribution` là `weight × raw` CHƯA chuẩn hoá — con số §10
 * viết — còn `baseScore` chia cho tổng trọng số thật (0.95, xem
 * `scoring/weights.ts`). Cộng thẳng `contribution` với `delta` của luật là
 * cộng hai đơn vị khác nhau, và bảng in ra không cộng lại ra điểm cuối. Ở đây
 * mọi dòng đều đã quy về điểm cuối, nên tổng các `effect` BẰNG `score`.
 *
 * Dòng `clamp` chỉ xuất hiện khi điểm bị kẹp về [0,1]. Không có nó thì một
 * thẻ nền 0.98 + thưởng 0.05 hiện ra cộng thành 1.03 trong khi điểm là 1 — và
 * bất biến "bảng cộng lại đúng" gãy đúng ở ca hiếm nhất.
 */
export function scoreBreakdown(candidate: Candidate): ScoreBreakdown {
  const totalWeight = candidate.components.reduce((sum, row) => sum + row.weight, 0);
  const lines: ScoreLine[] = candidate.components.map((row) => ({
    layer: "scoring",
    key: row.key,
    effect: totalWeight > 0 ? row.contribution / totalWeight : 0,
    weight: row.weight,
    raw: row.raw,
    note: row.note,
  }));
  // `assembleScore` kẹp điểm nền về [0,1] — trọng số âm không tồn tại nên
  // thực tế không xảy ra, nhưng nếu có thì phần bị kẹp phải hiện ra.
  const unclampedBase = lines.reduce((sum, row) => sum + row.effect, 0);
  if (Math.abs(unclampedBase - candidate.baseScore) > 1e-12) {
    lines.push({
      layer: "clamp",
      key: "base_clamp",
      effect: candidate.baseScore - unclampedBase,
      weight: null,
      raw: null,
      note: null,
    });
  }
  for (const row of candidate.adjustments) {
    lines.push({
      layer: row.layer,
      key: row.rule,
      effect: row.delta,
      weight: null,
      raw: null,
      note: row.reasonCode,
    });
  }
  const unclamped = candidate.baseScore + candidate.adjustments.reduce((sum, row) => sum + row.delta, 0);
  if (Math.abs(unclamped - candidate.score) > 1e-12) {
    lines.push({
      layer: "clamp",
      key: "final_clamp",
      effect: candidate.score - unclamped,
      weight: null,
      raw: null,
      note: null,
    });
  }
  return {
    candidate: candidateKey(candidate),
    lines,
    totalWeight,
    baseScore: candidate.baseScore,
    score: candidate.score,
  };
}

/* ------------------------------------------------------------------ *
 * Điều kiện "chưa biết" — vì đâu
 * ------------------------------------------------------------------ */

export interface EligibilityUnknownCause {
  /** Tầng sửa được nó — cùng từ vựng với `PipelineStage` của phép so lượt chạy. */
  source: "source_data" | "user_input" | "engine";
  detail: string;
}

const CAUSE_SOURCE: Record<RuleUnknownCause, EligibilityUnknownCause["source"]> = {
  rule_not_understood: "source_data",
  user_field_missing: "user_input",
  user_range_straddles: "user_input",
  not_modelled: "engine",
};

const CAUSE_TEXT: Record<RuleUnknownCause, string> = {
  rule_not_understood: "operator engine không đọc được",
  user_field_missing: "người dùng chưa khai",
  user_range_straddles: "khoảng người dùng khai bắc qua ngưỡng",
  not_modelled: "mô hình người dùng không có trường này",
};

/**
 * Vì sao phán quyết điều kiện là `unknown` — từng nguyên nhân gắn với tầng sửa
 * được nó. Chỉ những luật ĐÃ làm nhóm của chúng thành `unknown`
 * (`unknownRuleIds`), cộng chỗ trống của lớp dữ liệu (`gap:`): một luật chưa
 * biết nằm cạnh một luật khác trong nhóm HOẶC đã qua thì không quyết định gì.
 */
export function eligibilityUnknownCauses(
  verdict: EligibilityVerdict,
  /** Cửa MỞ THẺ (quyết định `status`) hay cửa WELCOME BONUS. */
  gate: "application" | "welcome_offer" = "application",
): EligibilityUnknownCause[] {
  const byId = new Map(verdict.rules.map((rule) => [rule.ruleId, rule]));
  const out: EligibilityUnknownCause[] = [];
  for (const id of gateRuleIds(verdict, gate).unknown) {
    if (id.startsWith("gap:")) {
      out.push({ source: "source_data", detail: "lớp dữ liệu nói chưa biết hết điều kiện của thẻ" });
      continue;
    }
    const rule = byId.get(id);
    if (rule?.unknownCause == null) continue;
    out.push({ source: CAUSE_SOURCE[rule.unknownCause], detail: `${rule.ruleType}: ${CAUSE_TEXT[rule.unknownCause]}` });
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * Dữ liệu của lượt chạy có qua được validator không
 * ------------------------------------------------------------------ */

/**
 * Lỗi/cảnh báo của validator trên ĐÚNG bộ dữ liệu lượt chạy đã đọc — lọc về
 * một sản phẩm nếu có `productId`.
 *
 * Validator đã có luật "thành phần offer không vượt headline", nhưng nó chỉ
 * chạy ở `audit:reco-data`: admin đọc một khuyến nghị sai vì bonus gõ thừa một
 * số 0 thấy "headline 15,000 · giá trị $2,700" và phải tự nhẩm tỷ giá mới nhận
 * ra (vòng rà "khuyến nghị này sai"). Nay nó hiện ngay chỗ admin đang nhìn.
 */
export function dataIssues(
  dataset: RecommendationDataset,
  asOf: string,
  productId: string | null = null,
): ValidationIssue[] {
  const issues = validateDataset(dataset, asOf);
  if (productId === null) return issues;
  // So ĐƯỜNG BIÊN: `prd_amex-aeroplan` là tiền tố của `prd_amex-aeroplan-reserve`.
  const pattern = new RegExp(`${productId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![a-z0-9-])`);
  return issues.filter((issue) => pattern.test(issue.message));
}

/* ------------------------------------------------------------------ *
 * Một dòng của bảng điểm đọc từ ĐÂU
 * ------------------------------------------------------------------ */

/** Nguồn một dòng đọc — cũng là người phải sửa nếu dòng đó sai. */
export type LineSource = "user_input" | "source_data" | "engine" | "editorial";

export interface SourcedLine extends ComparisonLine {
  sources: { source: LineSource; detail: string }[];
  /** Trọng số lệch bảng §10 — chỉ với dòng chấm điểm của bảng spec. */
  weightMismatch: { actual: number; expected: number; table: string } | null;
}

/**
 * Thành phần chấm điểm đọc dữ kiện nào. Viết tay — nhưng viết MỘT lần ở đây,
 * để admin không phải mở từng file `scoring/*.ts` mới biết `spend_fit` sai
 * thì sửa câu trả lời của người dùng hay sửa mốc chi của offer (vòng rà
 * "khuyến nghị này sai").
 */
const COMPONENT_SOURCES: Record<string, { source: LineSource; detail: string }[]> = {
  offer_quality: [{ source: "source_data", detail: "offer, thành phần offer, lịch sử offer" }],
  spend_fit: [
    { source: "user_input", detail: "sức dồn chi 3 tháng" },
    { source: "source_data", detail: "mốc chi của offer" },
  ],
  long_term_earn_fit: [
    { source: "user_input", detail: "hồ sơ chi tiêu" },
    { source: "source_data", detail: "tỷ lệ tích điểm, trần, định giá" },
  ],
  currency_fit: [
    { source: "engine", detail: "nhu cầu đồng tiền §9" },
    { source: "user_input", detail: "mục tiêu, số dư" },
  ],
  benefits_fit: [
    { source: "source_data", detail: "quyền lợi của thẻ" },
    { source: "user_input", detail: "thẻ đang giữ (quyền lợi trùng)" },
  ],
  travel_benefits: [
    { source: "source_data", detail: "quyền lợi của thẻ" },
    { source: "user_input", detail: "thẻ đang giữ (quyền lợi trùng)" },
  ],
  diversification: [
    { source: "engine", detail: "phân tích danh mục §7 + nhu cầu §9" },
    { source: "user_input", detail: "số dư" },
  ],
  new_currency_exposure: [
    { source: "engine", detail: "phân tích danh mục §7" },
    { source: "user_input", detail: "số dư" },
  ],
  transfer_flexibility: [{ source: "source_data", detail: "chặng chuyển điểm" }],
  flexibility_value: [{ source: "source_data", detail: "chặng chuyển điểm (tầm với)" }],
  trip_currency_utility: [{ source: "source_data", detail: "award strategy của chặng, chặng chuyển" }],
  points_gap_reduction: [
    { source: "source_data", detail: "award strategy, offer" },
    { source: "user_input", detail: "chuyến đi, số dư" },
  ],
  fee_drag: [
    { source: "source_data", detail: "phí thường niên" },
    { source: "user_input", detail: "hồ sơ chi tiêu" },
  ],
  points_already_sufficient: [
    { source: "user_input", detail: "số dư" },
    { source: "source_data", detail: "award strategy" },
  ],
  portfolio_already_covers: [
    { source: "user_input", detail: "thẻ đang giữ, chi tiêu" },
    { source: "source_data", detail: "tỷ lệ tích điểm / chặng" },
  ],
  no_reachable_candidate: [{ source: "engine", detail: "điều kiện + mốc chi của cả tập ứng viên" }],
  offer_climate_weak: [{ source: "source_data", detail: "lịch sử offer của cả tập" }],
};

/** Luật §16 đọc đầu vào nào. `S_`/`E_` là luật áp phán quyết §14 đã có. */
const RULE_SOURCES: Record<string, { source: LineSource; detail: string }[]> = {
  R1_points_already_sufficient: [{ source: "user_input", detail: "số dư" }],
  R2_keep_points_flexible: [{ source: "source_data", detail: "chặng chuyển điểm" }],
  R3_portfolio_concentration: [{ source: "user_input", detail: "số dư (tỷ trọng một hệ sinh thái)" }],
  R4_minimum_spend_pressure: [
    { source: "user_input", detail: "sức dồn chi 3 tháng" },
    { source: "source_data", detail: "mốc chi của offer" },
  ],
  R6_duplicate_benefits: [
    { source: "user_input", detail: "thẻ đang giữ" },
    { source: "source_data", detail: "quyền lợi của thẻ" },
  ],
};

const SUITABILITY_SOURCES: Record<string, { source: LineSource; detail: string }[]> = {
  ANNUAL_FEE_ABOVE_STATED_TOLERANCE: [
    { source: "user_input", detail: "ngưỡng phí người dùng khai" },
    { source: "source_data", detail: "phí thường niên" },
  ],
  ANNUAL_FEE_HIGH_TOLERANCE_UNKNOWN: [
    { source: "user_input", detail: "CHƯA khai ngưỡng phí" },
    { source: "source_data", detail: "phí thường niên (so trung vị)" },
  ],
  UPGRADE_WITHIN_HELD_FAMILY: [{ source: "user_input", detail: "thẻ đang giữ cùng họ" }],
};

/**
 * Gắn nguồn cho từng dòng của một phép so. `facts` là dữ kiện của ứng viên A
 * (người đang được hỏi "vì sao"); dòng điều kiện/phù hợp đọc nguyên nhân từ
 * CHÍNH phán quyết của nó, không đoán.
 */
export function sourceLines(
  comparison: CandidateComparison,
  facts: CandidateFactsSnapshot | null,
  goalType: string | null,
  candidate: Candidate | null,
): SourcedLine[] {
  const table = goalType !== null && goalType in SPEC_WEIGHTS ? (SPEC_WEIGHTS as Record<string, Record<string, number>>)[goalType] : null;
  return comparison.lines.map((line) => {
    let sources: SourcedLine["sources"] = [];
    if (line.layer === "scoring") {
      sources = COMPONENT_SOURCES[line.key] ?? [{ source: "engine", detail: "thành phần chấm điểm" }];
    } else if (line.layer === "eligibility") {
      sources = facts === null ? [] : eligibilityUnknownCauses(facts.eligibility).map(({ source, detail }) => ({ source, detail }));
      // Nhóm HOẶC ra `unknown` khi một vế chưa biết VÀ vế kia trượt — vế trượt
      // là nửa còn lại của câu trả lời: "thu nhập cá nhân khai $6,000 trượt
      // ngưỡng $60,000" là nơi một lỗi gõ lộ ra.
      if (facts !== null) {
        const unknownGroups = new Set(
          facts.eligibility.rules
            .filter((rule) => rule.outcome === "unknown" && rule.ruleGroup !== null && rule.scope === "application")
            .map((rule) => rule.ruleGroup),
        );
        for (const rule of facts.eligibility.rules) {
          if (rule.outcome === "fail" && rule.ruleGroup !== null && unknownGroups.has(rule.ruleGroup)) {
            sources.push({ source: "user_input", detail: `${rule.ruleType} ${rule.operator} ${JSON.stringify(rule.value)}: TRƯỢT với câu trả lời đã khai (vế còn lại của nhóm HOẶC)` });
          }
        }
      }
      if (sources.length === 0) sources = [{ source: "engine", detail: "luật áp phán quyết điều kiện" }];
    } else if (line.layer === "suitability") {
      sources = (facts?.suitability.reasonCodes ?? []).flatMap((code) => SUITABILITY_SOURCES[code] ?? []);
      if (sources.length === 0) sources = [{ source: "engine", detail: "hệ số phạt phù hợp" }];
    } else if (line.layer === "rules") {
      sources = [{ source: "engine", detail: `luật §16 ${line.key}` }, ...(RULE_SOURCES[line.key] ?? [])];
    } else if (line.layer === "editorial") {
      sources = [{ source: "editorial", detail: `luật biên tập ${line.key}` }];
    } else {
      sources = [{ source: "engine", detail: "kẹp điểm về [0, 1]" }];
    }
    const weight = candidate?.components.find((c) => c.key === line.key)?.weight;
    const expected = table?.[line.key];
    const weightMismatch =
      line.layer === "scoring" && table !== null && weight !== undefined && expected !== undefined && Math.abs(weight - expected) > 1e-12
        ? { actual: weight, expected, table: WEIGHT_SOURCE[goalType as keyof typeof WEIGHT_SOURCE] }
        : null;
    return { ...line, sources, weightMismatch };
  });
}

/* ------------------------------------------------------------------ *
 * A so với B
 * ------------------------------------------------------------------ */

export interface ComparisonLine {
  layer: ScoreLayer;
  key: string;
  effectA: number;
  effectB: number;
  /** `effectA − effectB`. Dương = dòng này kéo A lên trên B. */
  delta: number;
}

export interface CandidateComparison {
  a: string;
  b: string;
  /** `scoreA − scoreB`. BẰNG tổng `delta` của mọi dòng. */
  gap: number;
  lines: ComparisonLine[];
  /** Tổng `delta` theo tầng — "A thắng nhờ CHẤM ĐIỂM hay nhờ LUẬT". */
  byLayer: { layer: ScoreLayer; delta: number }[];
  /**
   * Những dòng một mình đã lớn hơn cả khoảng cách, cùng chiều với nó — gỡ bất
   * kỳ dòng nào trong số này ra là thứ tự đảo. Rỗng nghĩa là không có dòng
   * nào quyết định một mình: khoảng cách là tổng của nhiều thứ nhỏ.
   */
  decisive: ComparisonLine[];
}

/**
 * Vì sao A đứng trên (hoặc dưới) B.
 *
 * Hợp của hai bảng điểm theo `(tầng, khoá)`. Hai thẻ cùng một mục tiêu dùng
 * cùng bộ thành phần, nên các dòng thẳng hàng; `NO_NEW_CARD` dùng bảng khác,
 * và khi đó mỗi dòng chỉ có một bên — vẫn đúng, vẫn cộng lại ra khoảng cách,
 * vì mọi dòng đã quy về cùng đơn vị điểm cuối.
 */
export function compareCandidates(a: Candidate, b: Candidate): CandidateComparison {
  const left = scoreBreakdown(a);
  const right = scoreBreakdown(b);
  const merged = new Map<string, ComparisonLine>();
  const id = (line: ScoreLine) => `${line.layer}|${line.key}`;
  for (const line of left.lines) {
    merged.set(id(line), { layer: line.layer, key: line.key, effectA: line.effect, effectB: 0, delta: 0 });
  }
  for (const line of right.lines) {
    const row = merged.get(id(line)) ?? { layer: line.layer, key: line.key, effectA: 0, effectB: 0, delta: 0 };
    row.effectB = line.effect;
    merged.set(id(line), row);
  }
  const lines = [...merged.values()]
    .map((row) => ({ ...row, delta: row.effectA - row.effectB }))
    .sort((x, y) =>
      Math.abs(y.delta) !== Math.abs(x.delta)
        ? Math.abs(y.delta) - Math.abs(x.delta)
        : `${x.layer}|${x.key}` < `${y.layer}|${y.key}`
          ? -1
          : 1,
    );
  const gap = a.score - b.score;
  const layers = new Map<ScoreLayer, number>();
  for (const row of lines) layers.set(row.layer, (layers.get(row.layer) ?? 0) + row.delta);
  return {
    a: left.candidate,
    b: right.candidate,
    gap,
    lines,
    byLayer: [...layers]
      .map(([layer, delta]) => ({ layer, delta }))
      .sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta)),
    decisive: lines.filter(
      (row) => gap !== 0 && Math.sign(row.delta) === Math.sign(gap) && Math.abs(row.delta) > Math.abs(gap),
    ),
  };
}

/* ------------------------------------------------------------------ *
 * Nguồn dữ liệu
 * ------------------------------------------------------------------ */

type SourcedLike = {
  id: string;
  verifiedAt?: string;
  recordedAt?: string;
  sourceUrl?: string | null;
  sourceKind?: string;
  confidence?: string;
};

function provenanceRow(table: ProvenanceRow["table"], record: SourcedLike): ProvenanceRow {
  return {
    table,
    id: record.id,
    verifiedAt: record.verifiedAt ?? null,
    recordedAt: record.recordedAt ?? null,
    sourceUrl: record.sourceUrl ?? null,
    sourceKind: record.sourceKind ?? null,
    confidence: record.confidence ?? null,
  };
}

/**
 * Các bản ghi nguồn engine đã đọc cho một ứng viên, suy từ BẢN CHỤP bộ dữ
 * liệu của chính lượt chạy.
 *
 * Offer lấy theo `activeOfferId` ĐÃ LƯU, không tra lại "offer nào đang chạy":
 * hai phép tra cho cùng một câu hỏi là hai chỗ lệch được. Phần còn lại là
 * `activeAt` ở `asOf` — cùng phép engine dùng, trên cùng bộ dữ liệu, nên ra
 * cùng các dòng.
 */
export function provenanceFor(
  facts: CandidateFactsSnapshot,
  dataset: RecommendationDataset,
  asOf: string,
  /**
   * Award strategy của CHẶNG đang hỏi — thuộc về mục tiêu, không thuộc về thẻ,
   * nhưng giá chuyến đi quyết định `points_gap_reduction` và
   * `trip_currency_utility` của MỌI thẻ. Lấy từ `GoalTrace.goal.tripNeed`,
   * đúng những dòng engine đã đọc.
   */
  awardStrategies: readonly AwardStrategy[] = [],
  /**
   * Chương trình người dùng ĐANG có số dư. Chặng chuyển đi từ chúng quyết
   * định điểm tiếp cận được của chuyến đi — tức khoảng cách mà mọi thẻ được
   * chấm là "lấp" — dù chúng không phải đồng tiền của thẻ nào (vòng Codex 4:
   * `amex-aeroplan` được chấm trên chặng MR → Aeroplan® của VÍ người dùng mà
   * bảng nguồn không ghi dòng đó).
   */
  walletPrograms: readonly string[] = [],
): ProvenanceRow[] {
  const rows: ProvenanceRow[] = [];
  const offer = dataset.offers.find((row) => row.id === facts.offer.activeOfferId);
  if (offer !== undefined) {
    rows.push(provenanceRow("offers", offer));
    // Thành phần offer không mang nguồn riêng: chúng là điều khoản CỦA offer
    // đó, nên nguồn của chúng chính là nguồn của offer.
    for (const componentId of facts.offer.componentIds) {
      rows.push(provenanceRow("offer_components", { ...offer, id: componentId }));
    }
  }
  const byProduct = <T extends Temporal & { productId: string }>(table: readonly T[]) =>
    activeAt(table.filter((row) => row.productId === facts.productId), asOf);
  for (const row of byProduct(dataset.productFees)) rows.push(provenanceRow("product_fees", row));
  const rates = byProduct(dataset.earningRates);
  for (const row of rates) rows.push(provenanceRow("earning_rates", row));
  // Trần tích điểm mà các tỷ lệ trỏ vào — `earnFitFor` đọc chúng qua `capId`,
  // nên một giá trị tích điểm sai có thể nằm ở trần chứ không ở tỷ lệ.
  const capIds = new Set(rates.map((row) => row.capId).filter((id) => id !== null) as string[]);
  for (const cap of activeAt(dataset.earningCaps, asOf)) {
    if (capIds.has(cap.id as string)) rows.push(provenanceRow("earning_caps", cap));
  }
  // Định giá điểm nhân vào CẢ giá trị tích điểm lẫn giá trị offer: chương
  // trình của tỷ lệ tích điểm và đồng tiền của welcome bonus.
  const programs = new Set<string>(facts.earn.programs as string[]);
  if (offer?.bonusCurrencyId != null) programs.add(offer.bonusCurrencyId as string);
  for (const valuation of activeAt(dataset.programValuations, asOf)) {
    if (programs.has(valuation.programId as string)) rows.push(provenanceRow("program_valuations", valuation));
  }
  // Chặng chuyển điểm đi từ đồng tiền của thẻ: chúng quyết định bonus quy về
  // chương trình đặt vé, tầm với linh hoạt, và phần "đổ vào hệ sinh thái"
  // của §16 Rule 3. Một tỷ lệ chuyển sai đổi thứ hạng mà không chạm dòng nào
  // của chính thẻ.
  // Chỉ chặng KHÔNG đòi hạng thành viên — CÙNG phép lọc (`isOpenToEveryone`)
  // mà mọi phép tính điểm của engine dùng (bonus quy đổi, tầm với, phủ chuyến
  // đi, tập trung danh mục) và mà độ tươi §29 dùng. Độ tươi của cả lượt chạy
  // truy riêng ở `ConfidenceInputs.oldestVerifiedRow`.
  // Cộng chương trình ĐẶT MẪU SỐ tầm với — xem `flexibilityScale` — nhưng CHỈ
  // khi một chương trình nguồn có đích mở: `flexibilityReach` thoát trước mẫu
  // số khi chính nó không chuyển đi đâu được. Thêm vô điều kiện thì một thẻ
  // cash back, ví không có đồng tiền chuyển được, được kể 15 chặng Avios® mà
  // điểm của nó không đọc dòng nào (vòng Codex 16).
  const ix = indexDataset(dataset);
  const own = new Set<string>([...programs, ...walletPrograms]);
  const readsScale = [...own].some((programId) => flexibilityReach(ix, programId as PointsProgramId, asOf) > 0);
  const sources = new Set<string>([
    ...own,
    ...(readsScale ? (flexibilityScale(ix, asOf).programs as string[]) : []),
  ]);
  for (const path of activeAt(dataset.transferPaths, asOf)) {
    if (isOpenToEveryone(path.requiresTier) && sources.has(path.sourceProgramId as string)) {
      rows.push(provenanceRow("transfer_paths", path));
    }
  }
  for (const strategy of awardStrategies) rows.push(provenanceRow("award_strategies", strategy));
  for (const row of byProduct(dataset.productBenefits)) rows.push(provenanceRow("product_benefits", row));
  for (const row of byProduct(dataset.eligibilityRules)) rows.push(provenanceRow("eligibility_rules", row));
  return rows.sort((a, b) =>
    a.table !== b.table ? (a.table < b.table ? -1 : 1) : a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
  );
}

/* ------------------------------------------------------------------ *
 * Thẻ X đi tới đâu
 * ------------------------------------------------------------------ */

/**
 * Kết cục của một sản phẩm trong MỘT mục tiêu của lượt chạy.
 *
 * Mỗi kết cục gắn với đúng một tầng — tầng ĐÃ QUYẾT ĐỊNH số phận của nó. Đó là
 * câu trả lời cho "lỗi nằm ở đâu": một thẻ bị loại ở tầng điều kiện thì lỗi
 * (nếu có) nằm ở luật hoặc ở câu trả lời người dùng, không bao giờ nằm ở trọng
 * số — và admin không phải đọc bảng điểm để biết điều đó.
 */
export type ProductOutcome =
  | "not_in_dataset"
  | "excluded_universe"
  | "excluded_suitability"
  | "excluded_eligibility"
  /** Chọn được, nhưng lượt chạy KHÔNG xếp hạng gì — chưa có mục tiêu (§30). */
  | "not_ranked_no_goal"
  | "primary"
  | "alternative"
  /** `NO_NEW_CARD` không thắng: nó có chỗ RIÊNG, không nằm trong gợi ý thay thế. */
  | "no_action_slot"
  | "hidden_same_family"
  | "hidden_beyond_cutoff";

export const OUTCOME_STAGE: Record<ProductOutcome, PipelineStage> = {
  not_in_dataset: "source_data",
  excluded_universe: "normalization",
  excluded_suitability: "suitability",
  excluded_eligibility: "eligibility",
  not_ranked_no_goal: "normalization",
  primary: "ranking",
  alternative: "ranking",
  no_action_slot: "ranking",
  hidden_same_family: "ranking",
  hidden_beyond_cutoff: "ranking",
};

/**
 * Loại thẻ bị loại khỏi tập ứng viên chỉ vì DỮ KIỆN NGƯỜI DÙNG, không vì dữ
 * liệu sản phẩm. Hai nhóm chỉ ra hai chỗ sửa khác nhau, và debugger phải nói
 * ra điều đó chứ không để admin tự suy.
 */
const USER_DRIVEN_UNIVERSE: ReadonlySet<string> = new Set(["already_held", "other_country"]);

export interface ProductExplanation {
  /** `slug` hoặc `NO_NEW_CARD`. */
  key: string;
  productId: string | null;
  productName: string | null;
  goalIndex: number;
  outcome: ProductOutcome;
  decidedAt: PipelineStage;
  /**
   * Dữ kiện nào chịu trách nhiệm cho kết cục — ĐẦU VÀO của người dùng, hay
   * DỮ LIỆU sản phẩm/luật, hay chính phép TÍNH của engine. Với thẻ bị loại vì
   * luật điều kiện thì đây là CẢ HAI (luật ở dữ liệu, câu trả lời ở người
   * dùng) — bảng `eligibility.rules` đặt chúng cạnh nhau để admin phân xử.
   */
  drivenBy: LineSource[];
  /** Loại mục tiêu — bảng trọng số §10 nào để đối chiếu. */
  goalType: string | null;
  /**
   * Những dòng GIẢI THÍCH khoảng cách với đối thủ (người thắng, hay hạng nhì
   * nếu đây là người thắng), mỗi dòng gắn nguồn nó đọc. Là tập nhỏ nhất các
   * dòng lớn nhất cùng chiều với khoảng cách mà cộng lại đã vượt nó — thứ
   * `drivenBy` của thẻ đã xếp hạng đọc ra. Bản trước gán mọi thẻ đã xếp hạng
   * cho "engine", nên một thẻ thua vì người dùng CHƯA khai thu nhập hộ được
   * báo là "quyết định ở tầng xếp hạng, do engine" (vòng rà "khuyến nghị này sai").
   */
  explainingLines: SourcedLine[];
  /** Mọi dòng của phép so, có nguồn và đối chiếu trọng số §10. */
  versusSourced: SourcedLine[];
  excluded: ExcludedProduct | null;
  facts: CandidateFactsSnapshot | null;
  ranked: RankedCandidate | null;
  /** Với thẻ không thắng: so với người thắng. Với người thắng: so với hạng nhì. */
  versus: CandidateComparison | null;
  /** So với `NO_NEW_CARD` — câu hỏi "có nên mở thẻ nào không" trước "thẻ nào". */
  versusNoAction: CandidateComparison | null;
  /** Chỗ trống của lớp dữ liệu chạm vào đúng sản phẩm này. */
  dataGaps: DataGap[];
  /** Validator trên bộ dữ liệu của lượt chạy, về sản phẩm này — `null` khi không có bộ dữ liệu. */
  dataIssues: ValidationIssue[] | null;
  provenance: ProvenanceRow[] | null;
}

/** Tìm theo slug, id, hoặc `NO_NEW_CARD`. */
function matches(key: string, row: { productId: string | null; productSlug: string | null }): boolean {
  return row.productSlug === key || row.productId === key;
}

function gapTouches(gap: DataGap, productId: string): boolean {
  // Cùng phép so ĐƯỜNG BIÊN với `relevantDataGaps` ở `normalize.ts`: so
  // `includes` trần thì chỗ trống của `prd_amex-aeroplan` dính sang
  // `prd_amex-aeroplan-reserve`.
  return (
    gap.subjectId === productId ||
    gap.subjectId.startsWith(`${productId}_`) ||
    gap.subjectId.includes(`_${productId}_`)
  );
}

/**
 * Thẻ X đi tới đâu trong dây chuyền của MỘT mục tiêu.
 *
 * `dataset` là tuỳ chọn: có nó (bản chụp của chính lượt chạy) thì trả lời
 * được thêm hai câu — thẻ có tồn tại trong bộ dữ liệu không, và engine đã đọc
 * những bản ghi nguồn nào cho nó.
 */
export function explainProduct(
  record: RecommendationRunRecord,
  ref: string,
  options: { goalIndex?: number; dataset?: RecommendationDataset } = {},
): ProductExplanation {
  const goalIndex = options.goalIndex ?? 0;
  const derived = record.derivedState;
  assertGoalIndex(record, goalIndex);
  const goal: GoalTrace | undefined = derived.goals[goalIndex];
  const ranking = goal?.ranking ?? [];
  const winner = ranking[0]?.candidate ?? null;
  const noAction = ranking.find((row) => row.candidate.kind === "no_new_card")?.candidate ?? null;

  const ranked =
    ref === "NO_NEW_CARD"
      ? (ranking.find((row) => row.candidate.kind === "no_new_card") ?? null)
      : (ranking.find((row) => matches(ref, row.candidate)) ?? null);
  const facts = derived.candidates.find((row) => matches(ref, row)) ?? null;
  const excluded = derived.excluded.find((row) => matches(ref, row)) ?? null;
  const product =
    options.dataset?.products.find((row) => row.slug === ref || row.id === ref) ?? null;

  const productId = ranked?.candidate.productId ?? facts?.productId ?? excluded?.productId ?? product?.id ?? null;
  const dataGaps =
    productId === null
      ? []
      : // Chỗ trống engine ĐÃ tính cho mục tiêu này — không phải `dataset.gaps`
        // thô: bộ thô gồm cả những chỗ trống normalize đã loại vì không phép
        // tính nào của mục tiêu đọc chúng, và in chúng ra là giải thích một
        // lượt chạy khác (vòng Codex 10).
        (goal?.dataGaps ?? record.outputSnapshot.dataGaps).filter((gap) => gapTouches(gap, productId));

  let outcome: ProductOutcome;
  let drivenBy: ProductExplanation["drivenBy"];
  if (ranked !== null) {
    outcome = ranked.visibility === "no_action" ? "no_action_slot" : ranked.visibility;
    drivenBy = ["engine"];
  } else if (excluded?.stage === "universe") {
    outcome = "excluded_universe";
    drivenBy = USER_DRIVEN_UNIVERSE.has(excluded.reason) ? ["user_input"] : ["source_data"];
  } else if (excluded?.stage === "suitability") {
    outcome = "excluded_suitability";
    // Phù hợp là câu trả lời CỦA NGƯỜI DÙNG (§14) — "không xét thẻ doanh
    // nghiệp", không phải một phép đo.
    drivenBy = ["user_input"];
  } else if (excluded?.stage === "eligibility") {
    outcome = "excluded_eligibility";
    drivenBy = ["source_data", "user_input"];
  } else if (facts !== null || (ref === "NO_NEW_CARD" && goal === undefined)) {
    // Thẻ CÓ trong tập ứng viên và qua mọi cửa, mà không có bảng xếp hạng nào
    // để đứng: lượt chạy chưa giải được mục tiêu. Gán nó cho "dữ liệu nguồn"
    // như một thẻ không tồn tại là chỉ admin đi tìm lỗi ở sai hẳn một tầng.
    outcome = "not_ranked_no_goal";
    drivenBy = ["user_input"];
  } else {
    outcome = "not_in_dataset";
    drivenBy = ["source_data"];
  }

  const candidate = ranked?.candidate ?? null;
  const runnerUp = ranking[1]?.candidate ?? null;
  const versus =
    candidate === null
      ? null
      : candidate === winner
        ? runnerUp === null
          ? null
          : compareCandidates(candidate, runnerUp)
        : winner === null
          ? null
          : compareCandidates(candidate, winner);
  const versusNoAction =
    candidate === null || noAction === null || candidate === noAction
      ? null
      : compareCandidates(candidate, noAction);

  const goalType = goal?.goalType ?? null;
  const versusSourced = versus === null ? [] : sourceLines(versus, facts, goalType, candidate);
  const explainingLines: SourcedLine[] = [];
  if (versus !== null && versus.gap !== 0) {
    const direction = Math.sign(versus.gap);
    let covered = 0;
    for (const line of [...versusSourced].filter((row) => Math.sign(row.delta) === direction).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))) {
      explainingLines.push(line);
      covered += Math.abs(line.delta);
      if (covered >= Math.abs(versus.gap)) break;
    }
  }
  if (ranked !== null && explainingLines.length > 0) {
    drivenBy = [...new Set(explainingLines.flatMap((line) => line.sources.map((row) => row.source)))];
  }

  return {
    key: ref,
    productId,
    productName: ranked?.candidate.productName ?? facts?.productName ?? excluded?.productName ?? product?.name ?? null,
    goalIndex,
    outcome,
    decidedAt: OUTCOME_STAGE[outcome],
    drivenBy,
    goalType,
    explainingLines,
    versusSourced,
    excluded,
    facts,
    ranked,
    versus,
    versusNoAction,
    dataGaps,
    dataIssues: options.dataset === undefined || productId === null ? null : dataIssues(options.dataset, record.inputSnapshot.asOf, productId),
    provenance:
      facts === null || options.dataset === undefined
        ? null
        : provenanceFor(
            facts,
            options.dataset,
            record.inputSnapshot.asOf,
            goal?.goal.tripNeed?.strategies ?? [],
            derived.portfolio.direct.map((row) => row.programId as string),
          ),
  };
}

/**
 * `null` khi `goalIndex` hợp lệ cho lượt chạy này, ngược lại là lời báo lỗi.
 *
 * MỘT phép kiểm cho mọi cửa vào debugger (explain, compare, báo cáo, CLI,
 * trang admin): mục tiêu KHÔNG TỒN TẠI khác với lượt chạy KHÔNG CÓ mục tiêu,
 * và mỗi cửa từng tự đoán — hỏi mục tiêu số 99 thì cửa này nói "chưa có mục
 * tiêu nào", cửa kia nói "thẻ không nằm trong bảng" (vòng Codex 8 và 9).
 * Lượt chạy không có mục tiêu chỉ nhận số 0: câu trả lời cho nó là
 * `not_ranked_no_goal`, không phải một lỗi.
 */
export function goalIndexError(record: RecommendationRunRecord, goalIndex: number): string | null {
  const count = record.derivedState.goals.length;
  const max = Math.max(0, count - 1);
  if (!Number.isInteger(goalIndex) || goalIndex < 0 || goalIndex > max) {
    return `mục tiêu số ${goalIndex} không có: lượt chạy có ${count} mục tiêu`;
  }
  return null;
}

function assertGoalIndex(record: RecommendationRunRecord, goalIndex: number): void {
  const error = goalIndexError(record, goalIndex);
  if (error !== null) throw new RangeError(error);
}

/**
 * Một ứng viên trong bảng xếp hạng của một mục tiêu, theo slug, id hoặc
 * `NO_NEW_CARD`. `null` khi nó không được xếp hạng — `explainProduct` nói vì
 * sao. Mục tiêu không tồn tại là LỖI, không phải "không có trong bảng".
 */
export function findRanked(
  record: RecommendationRunRecord,
  ref: string,
  goalIndex = 0,
): Candidate | null {
  assertGoalIndex(record, goalIndex);
  const ranking = record.derivedState.goals[goalIndex]?.ranking ?? [];
  const row =
    ref === "NO_NEW_CARD"
      ? ranking.find((r) => r.candidate.kind === "no_new_card")
      : ranking.find((r) => matches(ref, r.candidate));
  return row?.candidate ?? null;
}
