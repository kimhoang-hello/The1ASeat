"use server";

import { notFound } from "next/navigation";
import {
  applyAssignments,
  compareCandidates,
  executeRun,
  explainChange,
  explainProduct,
  findRanked,
  loadOfferHistory,
  recoDebuggerEnabled,
  renderChangeExplanation,
  renderComparison,
  renderProductExplanation,
  renderRunReport,
  repoDataSource,
  validateUserState,
  type RecommendationDataset,
  type RecommendationRunRecord,
  type UserState,
} from "@/lib/recommendation";

export interface DebuggerRequest {
  /** `UserState` dạng JSON — hồ sơ giả của §22. */
  state: string;
  asOf: string;
  /** Dòng `đường.dẫn=giá-trị` cho phép thử "nếu như". */
  whatIf: string;
  /** Slug (hoặc `NO_NEW_CARD`) để hỏi "vì sao thẻ này". */
  why: string;
  /** Hai slug để so, cách nhau bởi dấu phẩy. */
  compare: string;
  goalIndex: number;
}

export interface DebuggerResponse {
  error: string | null;
  /** Vấn đề hồ sơ theo `validateUserState` — KHÔNG chặn: debugger phải chạy được trên hồ sơ hỏng. */
  inputIssues: string[];
  report: string;
  why: string | null;
  compare: string | null;
  whatIf: string | null;
  /** Ứng viên đã xếp hạng, để form gợi ý slug. */
  rankedKeys: string[];
  runId: string | null;
}

const EMPTY: DebuggerResponse = {
  error: null,
  inputIssues: [],
  report: "",
  why: null,
  compare: null,
  whatIf: null,
  rankedKeys: [],
  runId: null,
};

/** Chạy engine đúng như production: bộ dữ liệu của nguồn, lịch sử offer cắt ở ngày chạy. */
async function run(state: UserState, asOf: string): Promise<{ record: RecommendationRunRecord; dataset: RecommendationDataset }> {
  const data = await repoDataSource.getDataset({ asOf });
  const offerHistory = await loadOfferHistory(repoDataSource, data, asOf);
  const executed = executeRun(
    { state, data, asOf, offerHistory },
    { id: `run_debugger_${asOf.replaceAll("-", "")}`, createdAt: new Date().toISOString() },
  );
  return { record: executed.record, dataset: executed.dataset };
}

export async function runDebugger(request: DebuggerRequest): Promise<DebuggerResponse> {
  if (!recoDebuggerEnabled()) notFound();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(request.asOf)) return { ...EMPTY, error: `ngày chạy không hợp lệ: ${request.asOf}` };
  let state: UserState;
  try {
    state = JSON.parse(request.state) as UserState;
  } catch (error) {
    return { ...EMPTY, error: `JSON hồ sơ không đọc được: ${(error as Error).message}` };
  }
  if (state === null || typeof state !== "object" || Array.isArray(state)) {
    return { ...EMPTY, error: "hồ sơ phải là một object UserState" };
  }
  const base = await run(state, request.asOf);
  const inputIssues = validateUserState(state, base.dataset).map(
    (issue) => `${issue.level} · ${issue.entity}: ${issue.message}`,
  );
  const goalIndex = Number.isInteger(request.goalIndex) && request.goalIndex >= 0 ? request.goalIndex : 0;
  const response: DebuggerResponse = {
    ...EMPTY,
    inputIssues,
    report: renderRunReport(base.record),
    rankedKeys: (base.record.derivedState.goals[goalIndex]?.ranking ?? []).map((row) =>
      row.candidate.kind === "no_new_card" ? "NO_NEW_CARD" : (row.candidate.productSlug ?? "?"),
    ),
    runId: base.record.id,
  };

  const why = request.why.trim();
  if (why !== "") {
    response.why = renderProductExplanation(
      explainProduct(base.record, why, { goalIndex, dataset: base.dataset }),
    );
  }

  const pair = request.compare.split(",").map((part) => part.trim()).filter(Boolean);
  if (pair.length === 2) {
    const a = findRanked(base.record, pair[0], goalIndex);
    const b = findRanked(base.record, pair[1], goalIndex);
    response.compare =
      a === null || b === null
        ? `"${a === null ? pair[0] : pair[1]}" không nằm trong bảng xếp hạng — hỏi "vì sao" để xem nó dừng ở đâu`
        : renderComparison(compareCandidates(a, b), 40);
  }

  if (request.whatIf.trim() !== "") {
    const changed = structuredClone(state);
    const errors = applyAssignments(changed, request.whatIf);
    if (errors.length > 0) {
      response.whatIf = `Không áp được:\n${errors.join("\n")}`;
    } else {
      const after = await run(changed, request.asOf);
      response.whatIf = renderChangeExplanation(
        explainChange(base.record, after.record, { before: base.dataset, after: after.dataset }),
      );
    }
  }
  return response;
}
