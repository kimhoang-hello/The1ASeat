import { DeterministicWhy } from "@/components/recommender/result";
import type { RecommendationDataset } from "@/lib/recommendation";
import type { FactBasis } from "@/lib/recommender/explain-payload";
import { explanationPayload, vietnameseDate } from "@/lib/recommender/explain-payload";
import { explainPrimaryAction, explanationModelFromEnv } from "@/lib/recommender/explain-llm";
import type { ResultView } from "@/lib/recommender/present";
import { allowExplanationCall, explanationStore } from "@/lib/recommender/session";

/**
 * Lời giải thích Phase 6 cho hành động chính — hoặc đúng khối bảng tra Phase 5.
 *
 * Component này chỉ ĐỌC `ResultView`: nó không nhận hồ sơ, không nhận bản ghi,
 * nên không có gì trong tay để đổi khuyến nghị. Trang bọc nó trong `<Suspense>`
 * với fallback là `DeterministicWhy`, nên người đọc thấy kết quả đầy đủ ngay,
 * và câu của Claude (nếu qua được cửa kiểm) thay vào khi tới.
 */
export async function ExplainedWhy({
  view,
  dataset,
}: {
  view: ResultView;
  dataset: RecommendationDataset;
}) {
  const shown = await explainPrimaryAction(
    { runId: view.runId, goalIndex: 0, payload: explanationPayload(view) },
    {
      store: explanationStore(),
      model: explanationModelFromEnv(),
      names: {
        products: dataset.products.map((product) => product.name),
        programs: dataset.pointsPrograms.map((program) => program.name),
      },
      allowCall: () => allowExplanationCall(view.runId),
      now: () => new Date().toISOString(),
    },
  );
  if (shown === null) return <DeterministicWhy action={view.primary} />;

  return (
    <div className="mt-4">
      <ul className="space-y-2.5">
        {shown.sentences.map((sentence, index) => (
          <li key={index} className="text-base leading-relaxed text-foreground/90">
            {sentence.text}{" "}
            <span className={`ml-1 inline-block whitespace-nowrap rounded-full px-2 py-0.5 align-middle text-xs font-semibold ${BASIS_STYLE[sentence.basis]}`}>
              {BASIS_LABEL[sentence.basis]}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
        Đoạn trên do AI viết lại từ kết quả tính của mình — AI không chọn thẻ và không xếp thứ tự.{" "}
        <strong className="text-foreground">Dữ kiện</strong>: chép từ trang của ngân hàng
        {shown.dataVerifiedAt ? ` (kiểm ngày ${vietnameseDate(shown.dataVerifiedAt)})` : ""} hoặc từ chính điều bạn
        khai. <strong className="text-foreground">Ước lượng</strong>: số mình tự tính, đổi theo ngày
        bay và số dư thật. <strong className="text-foreground">Nhận định</strong>: đánh giá của Ghế 1A
        theo luật của công cụ.
      </p>
    </div>
  );
}

const BASIS_LABEL: Record<FactBasis, string> = {
  verified: "Dữ kiện",
  estimate: "Ước lượng",
  editorial: "Nhận định",
};

const BASIS_STYLE: Record<FactBasis, string> = {
  verified: "bg-emerald-50 text-emerald-800",
  estimate: "bg-amber-50 text-amber-900",
  editorial: "bg-muted text-muted-foreground",
};
