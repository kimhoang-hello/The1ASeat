/**
 * Dấu vân tay NỘI DUNG — một hàm, dùng chung cho bản chụp hành vi (§20 test)
 * và cho `recommendation_runs`.
 *
 * Trước Phase 4 phép băm này sống trong `engine.test.ts`. Kéo nó ra đây vì
 * lượt chạy lưu lại cần ĐÚNG phép đó: hai phép băm cho cùng một khái niệm
 * "bộ dữ liệu này có phải bộ kia không" là hai chỗ lệch được, và lệch ở đây
 * nghĩa là bản chụp test nói "dữ liệu không đổi" trong khi lượt chạy lưu lại
 * nói "đã đổi" về cùng một bộ.
 *
 * HAI QUYẾT ĐỊNH, cả hai vì cùng một lý do — dữ liệu sẽ tới từ database:
 *
 *  1. **Khoá được sắp.** `JSON.stringify` giữ thứ tự chèn khoá, mà thứ tự đó
 *     là chi tiết của nơi dựng object: seed TS viết `id` trước, một hàng
 *     Postgres có thể trả `effective_from` trước. Không sắp thì cùng một bộ dữ
 *     liệu cho hai dấu vân tay, và mọi lượt chạy trông như "dữ liệu đã đổi".
 *  2. **Mảng GIỮ thứ tự.** Ngược lại với khoá: thứ tự phần tử là thứ engine
 *     thật sự nhìn thấy. Engine hứa không phụ thuộc thứ tự, nhưng bản chụp phải
 *     ghi đúng thứ nó đã ăn, không phải thứ nó được hứa là không quan tâm.
 *
 * FNV-1a hai lượt với hai hạt giống khác nhau — 64 bit. Một lượt 32 bit là đủ
 * cho câu hỏi "có đổi không" của bản chụp test, nhưng `recommendation_runs`
 * dùng dấu vân tay làm KHOÁ lưu bộ dữ liệu, và va chạm ở đó là trả nhầm một bộ
 * dữ liệu khác cho một lần chạy lại — im lặng. Kho lưu còn so nguyên nội dung
 * khi khoá trùng (xem `run-store.ts`), nên va chạm, nếu có, là một lỗi nổ ra
 * chứ không phải một câu trả lời sai.
 */

/**
 * JSON với khoá object đã sắp, đệ quy.
 *
 * `undefined` bị bỏ như `JSON.stringify` vẫn làm — và đó chính là lý do
 * `runs.ts` cho engine chạy trên bản ĐÃ ĐI QUA hàm này: thứ được lưu và thứ
 * engine đã đọc phải là một.
 */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(value, (_key, raw: unknown) => {
    if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return raw;
    if (raw instanceof Map || raw instanceof Set) {
      // Không lặng lẽ thành `{}`. Một `Map` lọt tới đây là một trường đã quên
      // chuyển sang dạng lưu được (xem `trace.ts`), và dấu vân tay của nó sẽ
      // giống hệt dấu vân tay của MỌI `Map` khác.
      throw new TypeError("canonicalJson: Map/Set không đi qua JSON được — chuyển thành mảng trước");
    }
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(raw as Record<string, unknown>).sort()) {
      sorted[key] = (raw as Record<string, unknown>)[key];
    }
    return sorted;
  });
}

function fnv1a(text: string, seed: number): number {
  let hash = seed >>> 0;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}

/** Dấu vân tay của một chuỗi đã chuẩn hoá: `độ-dài-băm64`. */
export function fingerprintOf(canonical: string): string {
  const a = fnv1a(canonical, 0x811c9dc5).toString(16).padStart(8, "0");
  const b = fnv1a(canonical, 0x01000193 ^ 0x5bd1e995).toString(16).padStart(8, "0");
  return `${canonical.length}-${a}${b}`;
}

/** Dấu vân tay của một giá trị bất kỳ — xem `canonicalJson`. */
export function fingerprint(value: unknown): string {
  return fingerprintOf(canonicalJson(value));
}
