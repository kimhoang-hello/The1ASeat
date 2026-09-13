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
import { isOpenToEveryone } from "./portfolio.ts";
import { candidateKey, type PipelineStage } from "./run-diff.ts";
import type { RecommendationRunRecord } from "./runs.ts";
import type { AwardStrategy, DataGap, RecommendationDataset, Temporal } from "./types.ts";
import type {
  AdjustmentLayer,
  Candidate,
  CandidateFactsSnapshot,
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
  return { candidate: candidateKey(candidate), lines, baseScore: candidate.baseScore, score: candidate.score };
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
  const sources = new Set<string>([...programs, ...walletPrograms]);
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
  excluded_suitability: "eligibility_suitability",
  excluded_eligibility: "eligibility_suitability",
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
  drivenBy: ("user_input" | "source_data" | "engine")[];
  excluded: ExcludedProduct | null;
  facts: CandidateFactsSnapshot | null;
  ranked: RankedCandidate | null;
  /** Với thẻ không thắng: so với người thắng. Với người thắng: so với hạng nhì. */
  versus: CandidateComparison | null;
  /** So với `NO_NEW_CARD` — câu hỏi "có nên mở thẻ nào không" trước "thẻ nào". */
  versusNoAction: CandidateComparison | null;
  /** Chỗ trống của lớp dữ liệu chạm vào đúng sản phẩm này. */
  dataGaps: DataGap[];
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
      : (options.dataset?.gaps ?? record.outputSnapshot.dataGaps).filter((gap) => gapTouches(gap, productId));

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

  return {
    key: ref,
    productId,
    productName: ranked?.candidate.productName ?? facts?.productName ?? excluded?.productName ?? product?.name ?? null,
    goalIndex,
    outcome,
    decidedAt: OUTCOME_STAGE[outcome],
    drivenBy,
    excluded,
    facts,
    ranked,
    versus,
    versusNoAction,
    dataGaps,
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
 * Một ứng viên trong bảng xếp hạng của một mục tiêu, theo slug, id hoặc
 * `NO_NEW_CARD`. `null` khi nó không được xếp hạng — `explainProduct` nói vì sao.
 */
export function findRanked(
  record: RecommendationRunRecord,
  ref: string,
  goalIndex = 0,
): Candidate | null {
  const ranking = record.derivedState.goals[goalIndex]?.ranking ?? [];
  const row =
    ref === "NO_NEW_CARD"
      ? ranking.find((r) => r.candidate.kind === "no_new_card")
      : ranking.find((r) => matches(ref, r.candidate));
  return row?.candidate ?? null;
}
