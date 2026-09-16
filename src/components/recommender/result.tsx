import Image from "next/image";
import Link from "next/link";
import { CheckCircle, Info, Warning } from "@phosphor-icons/react/ssr";

import { resetRecommendation } from "@/app/credit-cards/goi-y/actions";
import { ApplyButton } from "@/components/ui/apply-button";
import type { ActionView, AnsweredRow, ResultView } from "@/lib/recommender/present";
import { NO_CARD_SENTENCE } from "@/lib/recommender/copy";
import { formatPoints, formatPointsRange } from "@/lib/recommender/present";

/**
 * Trang kết quả, xếp theo đúng thứ tự người đọc cần:
 *
 *   1. LÀM GÌ TIẾP — một hành động, nói bằng một câu.
 *   2. Vì sao hợp với bạn, và những gì phải cân nhắc.
 *   3. Con số của chuyến đi (khi có mục tiêu chuyến đi).
 *   4. Lựa chọn khác, trong đó "chưa mở thẻ nào" luôn có mặt.
 *   5. Mình đang dựa trên những gì bạn nói — sửa được từng dòng.
 *   6. Cách tính, gập lại — cho người đã quen Miles & Points.
 *
 * Khối affiliate duy nhất là nút "Đăng ký ngay" của hành động chính, và ngay
 * dưới nó là câu nói thẳng rằng hoa hồng không đổi thứ tự gợi ý.
 */
export function Result({
  view,
  answered,
  children,
  why,
}: {
  view: ResultView;
  answered: AnsweredRow[];
  /** Thẻ câu hỏi tiếp theo — trang quyết định có hay không. */
  children?: React.ReactNode;
  /**
   * Khối "vì sao hợp với bạn" thay cho bản bảng tra — Phase 6 truyền lời giải
   * thích của Claude (bọc `<Suspense>`) vào đây. Vắng thì trang là trang Phase 5
   * nguyên vẹn: đó là đường chạy khi không có LLM.
   */
  why?: React.ReactNode;
}) {
  return (
    <div className="space-y-5">
      <PrimaryCard action={view.primary} confidence={view.confidence} warnings={view.warnings} why={why} />

      {view.trip && <TripNumbers trip={view.trip} />}

      {children}

      {(view.alternatives.length > 0 || view.noAction) && (
        <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
          <h2 className="font-display text-lg font-bold text-foreground">Lựa chọn khác</h2>
          <ul className="mt-3 space-y-3">
            {view.alternatives.map((action) => (
              <li key={action.slug ?? action.name}>
                <AlternativeRow action={action} />
              </li>
            ))}
            {view.noAction && (
              <li>
                <AlternativeRow action={view.noAction} />
              </li>
            )}
          </ul>
        </section>
      )}

      <AnsweredPanel rows={answered} />
      <HowItWorks view={view} />
    </div>
  );
}

function PrimaryCard({
  action,
  confidence,
  warnings,
  why,
}: {
  action: ActionView;
  confidence: ResultView["confidence"];
  /** Nằm TRONG thẻ này, ngay trên nút đăng ký — không phải một khối ở dưới. */
  warnings: string[];
  why?: React.ReactNode;
}) {
  const rest = action.reasons.filter((row) => row.tone !== "good");
  return (
    <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
      <p className="text-xs font-semibold uppercase tracking-wide text-primary">Bước tiếp theo</p>
      <h2 className="mt-1 font-display text-2xl font-extrabold text-foreground sm:text-3xl">
        {action.kind === "no_new_card" ? "Chưa cần mở thẻ mới" : action.name}
      </h2>

      <p className="mt-2 text-base leading-relaxed text-foreground/90">
        {action.kind === "no_new_card"
          ? NO_CARD_SENTENCE[action.noCardReason ?? "default"]
          : action.welcomeBonusBlocked
            ? "Mở thẻ này cho tỷ lệ tích điểm và quyền lợi của nó — welcome bonus thì bạn không nhận được nữa, vì đã từng giữ thẻ."
            : action.minSpendPer90Days === null
              ? "Mở thẻ này là bước đáng làm tiếp theo."
              : `Mở thẻ này, rồi chi khoảng $${action.minSpendPer90Days.toLocaleString("en-US")} trong 3 tháng đầu để nhận trọn welcome bonus.`}
      </p>

      {action.kind === "open_card" && (
        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start">
          {action.image && (
            <Image
              src={action.image}
              alt={action.name}
              width={160}
              height={101}
              className="h-auto w-40 shrink-0 rounded-md"
            />
          )}
          <dl className="grid flex-1 grid-cols-2 gap-3 text-sm">
            {action.welcomeBonus && !action.welcomeBonusBlocked && (
              <div>
                <dt className="text-muted-foreground">Welcome bonus</dt>
                <dd className="font-semibold text-foreground">{action.welcomeBonus}</dd>
              </div>
            )}
            {action.annualFee && (
              <div>
                <dt className="text-muted-foreground">Phí thường niên</dt>
                <dd className="font-semibold text-foreground">{action.annualFee}</dd>
              </div>
            )}
          </dl>
        </div>
      )}

      {why ?? <DeterministicWhy action={action} />}

      {rest.length > 0 && (
        <ul className="mt-3 space-y-2">
          {rest.map((row) => (
            <li key={row.text} className="flex gap-2 text-base leading-relaxed text-foreground/80">
              <Info size={20} weight="bold" className="mt-0.5 shrink-0 text-muted-foreground" />
              {row.text}
            </li>
          ))}
        </ul>
      )}

      {action.kind === "no_new_card" && (
        <ul className="mt-4 space-y-2 text-base leading-relaxed text-foreground/90">
          <li>
            <Link
              href="/award-flight-finder"
              className="font-semibold text-primary underline underline-offset-4"
            >
              Tra chặng bay
            </Link>{" "}
            xem số điểm bạn có đổi được gì.
          </li>
          <li>
            <Link
              href="/transfer-bonuses"
              className="font-semibold text-primary underline underline-offset-4"
            >
              Theo dõi transfer bonus
            </Link>{" "}
            — chuyển điểm đúng đợt khuyến mãi lợi hơn mở thêm thẻ.
          </li>
        </ul>
      )}

      {warnings.length > 0 && (
        <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3">
          <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-amber-900">
            <Warning size={18} weight="bold" />
            Đọc kỹ trước khi đăng ký
          </p>
          <ul className="mt-2 space-y-1.5">
            {warnings.map((warning) => (
              <li key={warning} className="text-base leading-relaxed text-amber-950">
                {warning}
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="mt-4 text-sm text-muted-foreground">
        Độ chắc chắn: <strong className="text-foreground">{confidence.label}</strong>.{" "}
        {confidence.sentence}
      </p>

      {action.kind === "open_card" && (
        <div className="mt-5 flex flex-wrap items-center gap-3">
          {action.apply && (
            <ApplyButton
              href={action.apply.url}
              affiliate={action.apply.affiliate}
              placement="recommender_primary"
              product={action.slug ?? "unknown"}
            />
          )}
          {action.slug && (
            <Link
              href={`/credit-cards/${action.slug}`}
              className="text-sm font-semibold text-primary underline underline-offset-4"
            >
              Đọc kỹ về thẻ này
            </Link>
          )}
        </div>
      )}

      {action.kind === "open_card" && action.apply?.affiliate && (
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
          Ghế 1A có thể nhận hoa hồng nếu bạn đăng ký qua link này. Hoa hồng không tham gia vào việc
          chấm điểm: thứ tự gợi ý y hệt khi mình tắt hết link affiliate.
        </p>
      )}
    </section>
  );
}

/**
 * "Vì sao hợp với bạn" bằng bảng tra — bản Phase 5, và là đường lui của Phase 6.
 *
 * Mọi nhánh hỏng của lời giải thích LLM (tắt, timeout, bị cửa kiểm từ chối,
 * không lưu được) đều dựng lại ĐÚNG khối này, nên trang không bao giờ thiếu phần
 * giải thích vì LLM.
 */
export function DeterministicWhy({ action }: { action: ActionView }) {
  const good = action.reasons.filter((row) => row.tone === "good");
  if (good.length > 0) {
    return (
      <ul className="mt-4 space-y-2">
        {good.map((row) => (
          <li key={row.text} className="flex gap-2 text-base leading-relaxed text-foreground/90">
            <CheckCircle size={20} weight="fill" className="mt-0.5 shrink-0 text-emerald-600" />
            {row.text}
          </li>
        ))}
      </ul>
    );
  }
  if (action.strengths.length > 0) {
    return (
      <p className="mt-4 text-base leading-relaxed text-foreground/90">
        Thẻ này lên đầu nhờ {action.strengths.join(" và ")} — không phải nhờ một đặc điểm nổi bật
        nào, mà nhờ tổng thể.
      </p>
    );
  }
  return null;
}

function AlternativeRow({ action }: { action: ActionView }) {
  // Thẻ thay thế nói chỗ nó KHÁC thẻ chính; "chưa mở thẻ nào" thì nói đúng
  // việc nó là gì — nó luôn có mặt, kể cả khi engine không kèm lý do nào.
  const lead =
    action.lead ??
    (action.kind === "no_new_card"
      ? "Giữ nguyên ví hiện tại và đợi thêm cũng là một lựa chọn."
      : // Không lấy welcome bonus làm câu giới thiệu cho thẻ người dùng KHÔNG
        // còn nhận được nó — đó đúng là câu quảng cáo sai đối tượng.
        action.welcomeBonus && !action.welcomeBonusBlocked
        ? `Welcome bonus ${action.welcomeBonus}${action.annualFee ? `, phí ${action.annualFee}` : ""}`
        : action.welcomeBonusBlocked
          ? "Bạn từng giữ thẻ này nên sẽ không có welcome bonus."
          : null);
  return (
    <div className="rounded-xl border border-border px-4 py-3">
      <p className="text-base font-semibold text-foreground">
        {action.kind === "no_new_card" ? "Chưa mở thẻ nào" : action.name}
      </p>
      {lead && <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{lead}</p>}
      {action.slug && (
        <Link
          href={`/credit-cards/${action.slug}`}
          className="mt-2 inline-block text-sm font-semibold text-primary underline underline-offset-4"
        >
          Xem thẻ
        </Link>
      )}
    </div>
  );
}

function TripNumbers({ trip }: { trip: NonNullable<ResultView["trip"]> }) {
  const need = formatPointsRange(trip.needLow, trip.needHigh);
  // Thiếu một thừa số (hạng ghế, số người, khứ hồi) thì cả ba ô đều là "chưa
  // tính được" — ba lần nói cùng một điều. Nói một lần, và nói phải làm gì.
  const nothingKnown = need === null && trip.accessible === null;
  return (
    <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
      <h2 className="font-display text-lg font-bold text-foreground">Chuyến bay của bạn</h2>
      <p className="mt-2 text-base leading-relaxed text-foreground/90">
        Bay {trip.destination}
        {trip.cabin ? `, ${trip.cabin.toLowerCase()}` : ""}
        {trip.passengers ? `, ${trip.passengers} người` : ""}
        {trip.roundTrip === null ? "" : trip.roundTrip ? ", khứ hồi" : ", một chiều"}.
      </p>
      {trip.routeNotPriced ? (
        <p className="mt-3 text-base leading-relaxed text-foreground/80">
          Chặng này chưa có trong award chart của site, nên mình chưa nói được nó tốn bao nhiêu
          điểm — trả lời thêm câu nào cũng không ra con số. Gợi ý thẻ bên trên vẫn dựa trên loại
          điểm bạn sẽ cần.
        </p>
      ) : nothingKnown ? (
        <p className="mt-3 text-base leading-relaxed text-foreground/80">
          Mình chưa tính được số điểm cần vì còn thiếu <MissingLinks trip={trip} />.
        </p>
      ) : (
      <dl className="mt-4 grid gap-3 sm:grid-cols-3">
        <div>
          <dt className="text-sm text-muted-foreground">Cần khoảng (ước lượng)</dt>
          <dd className="font-display text-lg font-bold text-foreground">
            {need === null ? "Chưa tính được" : `${need} điểm`}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">Bạn với tới được</dt>
          <dd className="font-display text-lg font-bold text-foreground">
            {trip.accessible === null ? "Chưa biết" : `${formatPoints(trip.accessible)} điểm`}
            {trip.accessibleIsLowerBound && (
              <span className="ml-1 text-sm font-normal text-muted-foreground">(ít nhất)</span>
            )}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">Còn thiếu</dt>
          <dd className="font-display text-lg font-bold text-foreground">
            {trip.gap === null ? "Chưa tính được" : `${formatPoints(trip.gap)} điểm`}
          </dd>
        </div>
      </dl>
      )}
      {!nothingKnown && trip.missing.length > 0 && !trip.routeNotPriced && (
        <p className="mt-3 text-sm text-muted-foreground">
          Con số sẽ sát hơn nếu bạn nói thêm <MissingLinks trip={trip} />.
        </p>
      )}
      {trip.coverage !== null && !trip.routeNotPriced && (
        <p className="mt-3 text-sm text-muted-foreground">
          Điểm hiện tại phủ khoảng {Math.round(trip.coverage * 100)}% chuyến này
          {trip.coverageIsEstimate ? " — con số này là ước lượng vì còn chỗ chưa biết." : "."}
        </p>
      )}
    </section>
  );
}

/** Những thừa số còn thiếu của chuyến đi, mỗi cái là một đường tới đúng câu hỏi đó. */
function MissingLinks({ trip }: { trip: NonNullable<ResultView["trip"]> }) {
  return (
    <>
      {trip.missing.map((row, index) => (
        <span key={row.questionKey}>
          {index > 0 && (index === trip.missing.length - 1 ? " và " : ", ")}
          <Link
            href={`/credit-cards/goi-y?sua=${encodeURIComponent(row.questionKey)}`}
            className="font-semibold text-primary underline underline-offset-4"
          >
            {row.label}
          </Link>
        </span>
      ))}
    </>
  );
}

function AnsweredPanel({ rows }: { rows: AnsweredRow[] }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
      <h2 className="font-display text-lg font-bold text-foreground">Mình đang dựa vào những gì</h2>
      <dl className="mt-3 divide-y divide-border">
        {rows.map((row) => (
          <div key={row.label} className="flex items-start justify-between gap-3 py-2.5">
            <div>
              <dt className="text-sm text-muted-foreground">{row.label}</dt>
              <dd className="text-base text-foreground">{row.value}</dd>
            </div>
            {row.questionKey && (
              <Link
                href={`/credit-cards/goi-y?sua=${encodeURIComponent(row.questionKey)}`}
                className="shrink-0 text-sm font-semibold text-primary underline underline-offset-4"
              >
                Sửa
              </Link>
            )}
          </div>
        ))}
      </dl>
      <form action={resetRecommendation} className="mt-4">
        <button
          type="submit"
          className="cursor-pointer text-sm font-semibold text-muted-foreground underline underline-offset-4 hover:text-primary"
        >
          Làm lại từ đầu
        </button>
      </form>
    </section>
  );
}

/**
 * Bảng điểm, gập lại.
 *
 * Người mới không cần nó để hành động; người chơi điểm lâu năm thì không tin
 * một gợi ý không nói ra cách tính. Gập lại phục vụ được cả hai mà không ai
 * phải đọc thứ mình không cần.
 */
function HowItWorks({ view }: { view: ResultView }) {
  return (
    <details className="rounded-2xl border border-border bg-card p-5 sm:p-6">
      <summary className="cursor-pointer font-display text-lg font-bold text-foreground">
        Cách mình tính ra kết quả này
      </summary>
      <p className="mt-3 text-base leading-relaxed text-foreground/80">
        Hướng đi mình chọn: <strong>{view.strategy}</strong>. Điểm số dưới đây chấm trên thang 0–1,
        mỗi dòng là một phần của công thức.
      </p>
      <table className="mt-4 w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-muted-foreground">
            <th className="py-2 font-medium">Thành phần</th>
            <th className="py-2 text-right font-medium">Trọng số</th>
            <th className="py-2 text-right font-medium">Điểm</th>
          </tr>
        </thead>
        <tbody>
          {view.primary.components.map((row) => (
            <tr key={row.label} className="border-b border-border/60">
              <td className="py-2 text-foreground">{row.label}</td>
              <td className="py-2 text-right text-muted-foreground">
                {Math.round(row.weight * 100)}%
              </td>
              <td className="py-2 text-right text-foreground">{row.raw.toFixed(2)}</td>
            </tr>
          ))}
          <tr>
            <td className="py-2 font-semibold text-foreground">Tổng</td>
            <td />
            <td className="py-2 text-right font-semibold text-foreground">
              {view.primary.score.toFixed(3)}
            </td>
          </tr>
        </tbody>
      </table>
      <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
        <strong className="text-foreground">Số nào là số chắc, số nào là ước lượng:</strong> welcome
        bonus, phí thường niên và mốc chi chép từ trang của ngân hàng
        {view.dataVerifiedAt ? ` (dòng cũ nhất mình dùng ở đây kiểm ngày ${view.dataVerifiedAt})` : ""};
        số điểm một chuyến bay cần là khoảng ước lượng theo award chart và đổi theo ngày bay; phần
        &ldquo;bạn với tới được&rdquo; phụ thuộc chính con số bạn khai.
      </p>
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
        Dữ liệu thẻ tính đến {view.asOf}. Mã tra cứu: <code>{view.runId}</code> — gửi mã này cho
        mình nếu bạn thấy kết quả sai, mình xem lại được đúng lượt tính của bạn.
      </p>
    </details>
  );
}
