# Ghế 1A — ghi chú cho agent review

Site tiếng Việt về thẻ tín dụng và điểm thưởng Canada. Next.js App Router +
Contentful. Nội dung là **tiền thật của người đọc**: sai một con số welcome
bonus hay số ngày promo là họ mất tiền.

File này dành cho agent đọc code ở đây (Codex chạy `codex exec` khởi động lạnh
mỗi lần, không nhớ gì giữa các phiên). Ghi lại để không phải tìm lại từ đầu, và
để không lặp lại những nhầm lẫn đã xảy ra.

## Không nhận xét về

- **Câu chữ tiếng Việt, giọng văn, thuật ngữ.** Có luật riêng: xưng "bạn"; giữ
  nguyên tiếng Anh các từ "transfer bonus", "welcome offer", "register"; dấu
  phẩy ngăn nghìn (110,000 chứ không phải 110.000); `$` trần nghĩa là CAD.
- **Tính đúng sai của số liệu thẻ** — chỉ đối chiếu được với trang ngân hàng,
  không phải việc của review code.
- **Thẩm mỹ, brand, thumbnail, kịch bản video.**
- **Chế độ sample** (`content/sample/*.json`, chạy khi chưa cấu hình
  Contentful): đó là đường dev, không phải production. Đừng chấm High cho lỗi
  chỉ xảy ra ở đó.

## Sự thật đã kiểm chứng — đừng đoán lại

- **Cả 23 thẻ đều là link có hoa hồng**: 21 qua `finlywealth.com`, 2 là link
  referral Amex cá nhân (`americanexpress.com/.../referral/...?ref=...`). Từng
  có đề xuất "gỡ `sponsored` khỏi link trỏ thẳng ngân hàng" — làm theo sẽ gỡ
  mất công bố của 2 link Amex thật. Kiểm host trước khi kết luận.
- **`updateEntry` publish CẢ ENTRY**, không publish riêng một trường
  (`lib/contentful-cma.ts`). Nên không bao giờ được đề xuất "tự publish lại cho
  hết stale": nó sẽ đẩy bản nháp tác giả đang viết dở lên site.
- **`listEntries` (CMA) trả bản DRAFT**, không phải bản đang phục vụ. Muốn biết
  người đọc đang thấy gì thì đọc qua CDA (`fetchContentfulCreditCardOffers`).
- **`lib/content` tự cache bằng `unstable_cache`** vì SDK Contentful dùng axios
  nên Next không cache được. Webhook `revalidateTag` phải truyền `{ expire: 0 }`
  — `"max"` chỉ cho stale-while-revalidate, đo được: 14–28ms (cache cũ) so với
  135ms (gọi lại thật).
- **CDN Hostinger giữ HTML tới một năm** nếu route không đặt `revalidate`. Đã
  cắn một lần: thêm 4 tài khoản BMO® mà trang vẫn hiện 6 cái.
- **`bank-account-finder` ghi URL bằng cách sửa `URLSearchParams` hiện có**, không
  dựng lại từ đầu — dựng lại sẽ xoá `utm_*` của chiến dịch dẫn người đọc tới đây,
  mỗi lần họ bấm một cái chip.
- **Thẻ mới không có rule trong `lib/card-points-programs.ts` sẽ mất filter chip
  trong im lặng.** Đây là đánh đổi có chủ ý (Contentful không có trường này),
  không phải lỗi cần báo lại mỗi lần.

- **Bảng Aeroplan có HAI cột không thay thế được cho nhau.** "All other
  partners" là giá cố định và KHÔNG có dòng Premium Economy; "Air Canada and/or
  Select Partners" (United, Emirates, Flydubai, Etihad, Canadian North, Calm
  Air, Bearskin, PAL) mới là cột dynamic có sàn `startingAt`. `bandRate` chỉ đọc
  sàn khi MỌI hãng trên hành trình nằm trong `pricing.startingAtCarriers`. EVA,
  ANA, Air China, Asiana không nằm trong đó, nên Premium Economy của họ là "—"
  chứ không phải "từ 60,000" — đừng "sửa" cái dấu gạch đó thành số.
- **Override trong `award-charts.ts` phải mang `rates` nếu `tone: "highlight"`.**
  Note khẳng định bảng công bố sai, nên thiếu `rates` là note nói một đằng giá
  hiện một nẻo (YYZ→TPE từng in "chỉ 50,000" ngay trên một quote 65,000).
  `audit:awards` giờ bắt ca này. Override cũng cần `hub` nếu lý do giảm giá gắn
  với một hãng cụ thể, không thì nó đắp giá sang cả chặng nối của hãng khác.
- **`expiresAt` được đọc là NGÀY CUỐI CÙNG còn hiệu lực**, so bằng
  `hasExpired()` trong `lib/format-date.ts` theo ngày giờ Toronto — không so mốc
  thời gian. Dữ liệu đang lẫn hai kiểu lưu (`00:00` đầu ngày ở 14/15 entry,
  `23:59` cuối ngày ở 1 entry); so theo ngày làm cả hai hành xử đúng như dòng
  chữ người đọc nhìn thấy. Đừng đổi lại thành `[lte]=now`.

## Quyết định có chủ ý — đừng báo là lỗi

- **`api/check-rebates` trả 500 khi có bất kỳ thẻ nào lỗi**, kể cả một thẻ hỏng
  vĩnh viễn làm job đỏ mãi. Cố ý: im lặng chính là lỗi gốc, và số rebate là tiền
  hiện cho người đọc. Đừng đề xuất ngưỡng để giấu lại.
- **`api/revalidate` kiểm tra purge CDN TRƯỚC khi gọi Kit**, trả 502 và bỏ qua
  broadcast nếu purge hỏng. Cố ý: `maybeNotifyNewPost` chỉ chống trùng bằng
  `publishedCounter === 1`, mà số đó không đổi khi webhook được gọi lại — nên
  bất cứ đường retry nào sau khi đã gửi đều gửi bản tin lần hai tới toàn bộ
  subscriber. Bản tin gửi trùng không rút lại được; CDN bẩn thì tự hết hạn.
- **Phân trang dùng `getEntriesWithCursor` (con trỏ mờ của Contentful).** Đừng
  đề xuất quay lại `skip`, cũng đừng đề xuất con trỏ tự chế theo `sys.createdAt`
  — đã thử cả hai và cả hai đều mất entry trong im lặng: `skip` lệch khi có
  entry bị unpublish giữa hai lượt lấy, còn `sys.createdAt[lte]` thì kẹt cứng
  khi 100 entry trùng mốc thời gian. Con trỏ mờ cũng cho phép trả `order` về
  cho Contentful, nên không phải sắp lại thứ tự trong JS.
- **`/transfer-bonuses` lọc bonus hết hạn ngay lúc render**, dù job
  `expire-offers` cũng gỡ chúng. Hai lớp là cố ý: job chạy ngày một lần, còn
  trang là lưới an toàn cho khoảng giữa. Trang là ISR `revalidate = 60`, nên
  ngay sau nửa đêm Toronto một lượt truy cập vẫn có thể nhận HTML của ngày hôm
  trước — chấp nhận, đổi lấy việc trang vẫn tĩnh.
- **Trang chưa công bố dùng cờ trong `lib/feature-flags.ts`** — vẫn build và vào
  được bằng URL trực tiếp, nhưng ẩn khỏi menu, footer, sitemap, search, kèm
  `noindex` và dải báo nháp. Cờ được áp ở cả 7 chỗ; đã kiểm.

## Chạy gì trước khi kết luận

```
npm run lint
npx tsc --noEmit
npm run build
npm run audit:trademarks    # thiếu ®/™
npm run audit:rebates       # số rebate lệch FinlyWealth
npm run audit:awards        # bảng award
```

Bốn cái audit này bắt sẵn nhiều lớp lỗi lặp lại. Đừng báo lại thứ chúng đã bắt
được.

## Đâu là chỗ đáng soi nhất

Xếp theo hậu quả khi sai, không theo độ khó của code:

1. `api/revalidate` — gửi newsletter tới subscriber thật, không thu hồi được.
2. `api/expire-offers` — tự gỡ offer khỏi site.
3. `api/check-rebates`, `api/sync-videos`, `lib/contentful-cma` — ghi vào
   Contentful, tức làm bẩn nguồn dữ liệu chứ không chỉ hỏng một trang.
4. `lib/affiliate-links`, `lib/finlywealth` — đây là doanh thu; link hỏng không
   làm gãy build.
5. `lib/content/*` — cache và revalidate.
6. `lib/job-auth`, `lib/rate-limit` — lớp bảo vệ duy nhất của route công khai.
