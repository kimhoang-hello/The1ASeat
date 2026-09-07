/**
 * Ba phép tính rút ra từ các thành phần của một welcome offer.
 *
 * Tách khỏi `data/offers.ts` vì đây là chỗ dễ sai nhất trong cả Phase 1 và là
 * chỗ sai ra tiền: mọi con số ở đây đều là câu trả lời cho "mình có với tới
 * được offer này không". Hàm thuần, không phụ thuộc bộ dữ liệu, nên
 * `spend.test.ts` kiểm được từng ca biên mà không cần dựng cả kho.
 *
 * Đã sai ba lần ở đúng chỗ này trước khi ra được bản dưới đây — SUM, rồi MAX,
 * rồi gom-liên-thông. Mỗi lần đều "trông hiển nhiên đúng". Vì vậy mỗi ca đã
 * sai đều còn lại dưới dạng một test.
 */

/** Một mốc chi tiêu: phải chi `needed` đô trong khoảng ngày `[from, to)`,
 *  đếm từ ngày mở thẻ. */
export interface SpendWindow {
  from: number;
  to: number;
  needed: number;
}

/**
 * Tổng chi nhỏ nhất thoả mãn MỌI mốc.
 *
 * Một đồng chi ở thời điểm t được tính cho MỌI cửa sổ chứa t — đó là toàn bộ
 * độ khó. Ba cách "hiển nhiên" đều sai, mỗi cách hại người đọc một kiểu:
 *
 *   SUM  cộng cả những cửa sổ dùng chung tiền, bịa thêm yêu cầu rồi loại oan
 *        thẻ khỏi tay người vừa đủ sức. (TD® VIP: ra $36,000 thay vì $24,000.)
 *   MAX  bỏ hẳn những cửa sổ rời nhau, hứa bonus rẻ hơn thật. (Amex® Reserve:
 *        ra $7,500 thay vì $10,000, tức nói phần kỷ niệm là miễn phí.)
 *   Gom liên thông — ba cửa sổ chồng nhau theo dây chuyền [0,10) [9,20)
 *        [19,30) bị gộp làm một rồi giữ đúng một mốc: ra $100 trong khi cửa sổ
 *        đầu và cuối RỜI nhau nên phải $200.
 *
 * Lời giải đúng: bài này là LP đối ngẫu của một bài phủ trên hệ khoảng, và ma
 * trận ràng buộc của hệ khoảng hoàn toàn đơn modular — nên tối ưu đạt tại một
 * tập cửa sổ ĐÔI MỘT RỜI NHAU có tổng lớn nhất, giải bằng quy hoạch động theo
 * ngày kết thúc.
 *
 * Đọc không cần lý thuyết: một tập rời nhau thì không đồng nào đếm được cho
 * hai mốc trong tập, nên tổng của chúng là mức sàn thật; còn mọi mốc ngoài tập
 * đều giao với một mốc trong tập nên đã được phủ sẵn.
 */
export function totalSpend(windows: SpendWindow[]): number | null {
  if (windows.length === 0) return null;
  // Sắp theo NGÀY KẾT THÚC — điều kiện để quy hoạch động dưới đây đúng.
  const sorted = [...windows].sort((a, b) => a.to - b.to);

  const best: number[] = new Array(sorted.length).fill(0);
  for (let i = 0; i < sorted.length; i += 1) {
    // Cửa sổ muộn nhất còn RỜI HẲN với cửa sổ i.
    let previous = 0;
    for (let j = i - 1; j >= 0; j -= 1) {
      if (sorted[j].to <= sorted[i].from) {
        previous = best[j];
        break;
      }
    }
    best[i] = Math.max(sorted[i].needed + previous, i > 0 ? best[i - 1] : 0);
  }
  const total = best[sorted.length - 1];
  return total > 0 ? total : null;
}

/**
 * Mức chi cần thiết QUY VỀ MỘT CỬA SỔ 90 NGÀY — con số đem so với sức chi 3
 * tháng người dùng khai (spec §13).
 *
 * Lấy mốc NẶNG NHẤT sau khi quy đổi, không phải mốc có số tiền lớn nhất:
 * $40,000 trải 365 ngày (~$9,900/quý) nhẹ hơn $7,500 dồn trong 90 ngày.
 *
 * GIẢ ĐỊNH: chi tiêu rải đều trong cửa sổ. Đúng với mọi mốc trong bộ dữ liệu
 * hiện tại. Sai nếu có ngày một mốc đòi dồn vào cuối kỳ — chưa gặp.
 */
export function spendPerNinetyDays(windows: SpendWindow[]): number | null {
  let worst = 0;
  for (const window of windows) {
    const days = window.to - window.from;
    if (days <= 0) continue;
    const rate = (window.needed / days) * 90;
    if (rate > worst) worst = rate;
  }
  return worst > 0 ? Math.round(worst) : null;
}

/**
 * Bao nhiêu tháng kể từ ngày mở thẻ tới lúc lấy được HẾT bonus.
 *
 * Tính tới ngày cuối cùng còn phải chi, tức đã bao gồm độ trễ. Chỉ nhìn độ dài
 * cửa sổ thì Amex® Aeroplan®* Reserve — $7,500 trong 90 ngày rồi $2,500 ở
 * tháng thứ 13 — hiện ra "3 tháng", trong khi người đọc phải giữ thẻ qua mốc
 * kỷ niệm mới lấy hết. Đó là câu về việc họ có bị buộc trả annual fee năm thứ
 * hai hay không.
 */
export function longestWindowMonths(windows: { to: number }[]): number | null {
  if (windows.length === 0) return null;
  const end = Math.max(...windows.map((w) => w.to));
  return Math.round((end / 365) * 12);
}
