"use client";

import { useState, useTransition } from "react";
import { runDebugger, type DebuggerResponse } from "./actions";

interface Props {
  fixtures: { id: string; json: string }[];
  defaultAsOf: string;
}

const field = "mt-1 w-full rounded-md border border-foreground/20 bg-background px-3 py-2 font-mono text-xs";

/**
 * Chỉ là vỏ: mọi phép tính và mọi chữ in ra đến từ `debug.ts` /
 * `debug-render.ts` qua server action — cùng mã với `npm run reco:debug`, nên
 * trang và CLI không bao giờ giải thích cùng một lượt chạy theo hai cách.
 */
export function DebuggerForm({ fixtures, defaultAsOf }: Props) {
  const [state, setState] = useState(fixtures[0]?.json ?? "{}");
  const [asOf, setAsOf] = useState(defaultAsOf);
  const [why, setWhy] = useState("");
  const [compare, setCompare] = useState("");
  const [whatIf, setWhatIf] = useState("");
  const [goalIndex, setGoalIndex] = useState(0);
  const [result, setResult] = useState<DebuggerResponse | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = () =>
    startTransition(async () => {
      setResult(await runDebugger({ state, asOf, why, compare, whatIf, goalIndex }));
    });

  return (
    <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
      <form
        className="space-y-4 text-sm"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <label className="block">
          Nhân vật mẫu
          <select
            className={field}
            onChange={(event) => {
              const picked = fixtures.find((row) => row.id === event.target.value);
              if (picked !== undefined) setState(picked.json);
            }}
          >
            {fixtures.map((row) => (
              <option key={row.id} value={row.id}>
                {row.id}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          Hồ sơ giả (UserState JSON)
          <textarea className={`${field} h-72`} value={state} onChange={(e) => setState(e.target.value)} spellCheck={false} />
        </label>
        <label className="block">
          Ngày chạy (asOf)
          <input className={field} value={asOf} onChange={(e) => setAsOf(e.target.value)} />
        </label>
        <label className="block">
          Mục tiêu số (khi nhiều mục tiêu hoà)
          <input
            className={field}
            type="number"
            min={0}
            value={goalIndex}
            onChange={(e) => setGoalIndex(Number(e.target.value))}
          />
        </label>
        <label className="block">
          Vì sao thẻ này? (slug hoặc NO_NEW_CARD)
          <input className={field} value={why} onChange={(e) => setWhy(e.target.value)} list="ranked-keys" />
        </label>
        <label className="block">
          So hai ứng viên (slugA, slugB)
          <input className={field} value={compare} onChange={(e) => setCompare(e.target.value)} />
        </label>
        <label className="block">
          Nếu như… (mỗi dòng một <code>đường.dẫn=giá-trị</code>)
          <textarea
            className={`${field} h-24`}
            value={whatIf}
            onChange={(e) => setWhatIf(e.target.value)}
            placeholder={'profile.annualFeeTolerancePerCard=0\nspend.byCategory.grocery={"low":900,"high":900}'}
            spellCheck={false}
          />
        </label>
        <datalist id="ranked-keys">
          {(result?.rankedKeys ?? []).map((key) => (
            <option key={key} value={key} />
          ))}
        </datalist>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-foreground px-4 py-2 font-medium text-background disabled:opacity-50"
        >
          {pending ? "Đang chạy…" : "Chạy engine"}
        </button>
      </form>

      <div className="min-w-0 space-y-6">
        {result === null ? (
          <p className="text-sm text-foreground/60">Chọn một nhân vật hoặc dán hồ sơ, rồi chạy.</p>
        ) : result.error !== null ? (
          <p className="text-sm text-red-700">{result.error}</p>
        ) : (
          <>
            {result.inputIssues.length > 0 && (
              <Block title={`Hồ sơ có ${result.inputIssues.length} vấn đề (engine vẫn chạy)`} text={result.inputIssues.join("\n")} />
            )}
            {result.why !== null && <Block title="Vì sao thẻ này" text={result.why} />}
            {result.compare !== null && <Block title="So hai ứng viên" text={result.compare} />}
            {result.whatIf !== null && <Block title="Nếu như" text={result.whatIf} />}
            <Block title="Lượt chạy — 11 mục của §22" text={result.report} />
          </>
        )}
      </div>
    </div>
  );
}

function Block({ title, text }: { title: string; text: string }) {
  return (
    <div>
      <h2 className="text-sm font-semibold">{title}</h2>
      <pre className="mt-2 max-h-[70vh] overflow-auto rounded-md border border-foreground/10 bg-foreground/[0.03] p-4 text-xs leading-relaxed">
        {text}
      </pre>
    </div>
  );
}
