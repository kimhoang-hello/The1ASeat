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

- **Cả 3 workflow job đều gọi bằng `curl -sfS --retry 3 --retry-all-errors`,
  nên trả 500 KHÔNG đủ để một lỗi hiện ra.** curl chạy lại; nếu lượt sau trả
  200 thì job xanh và lỗi biến mất. Vì vậy mọi lỗi ghi dở phải còn *nhận ra
  được ở lượt chạy sau*, không chỉ đỏ đúng một lần. Đã cắn hai lần cùng kiểu:
  `updateEntry` ghi draft xong mới publish, nên publish hỏng để lại draft đã
  đổi trong khi CDA vẫn phục vụ bản cũ — và mọi truy vấn CMA sau đó (đọc
  draft) thấy "xong rồi" nên bỏ qua vĩnh viễn. `check-rebates` sửa bằng cách so
  với bản published; `expire-offers` nay cũng đối chiếu bản published
  (`liveExpiredSlugs`) và BÁO những thẻ site còn treo hạn cũ mà draft đã sạch
  hạn — báo chứ không tự sửa, vì hình dạng đó cũng đúng với một tác giả đang
  viết dở, và `updateEntry` publish cả entry.

## Quyết định có chủ ý — đừng báo là lỗi

- **`api/sync-videos` báo lỗi khi thấy entry video đã có nhưng chưa publish**,
  và cố ý không tự publish nó. Trạng thái đó sinh ra từ một lượt tạo được entry
  rồi publish hỏng — hoặc từ việc có người unpublish tay. Cả hai đều cần người
  nhìn, nên job đỏ cho tới khi ai đó publish hoặc xoá entry. Đỏ dai là có chủ
  ý, giống `check-rebates`: tự publish thì sẽ đẩy luôn bản nháp nằm trong entry
  đó lên site.
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
- **`/transfer-bonuses` VÀ khối transfer bonus trên trang chủ đều lọc bonus hết
  hạn ngay lúc render**, dù job `expire-offers` cũng gỡ chúng. Hai lớp là cố ý:
  job chạy ngày một lần, còn trang là lưới an toàn cho khoảng giữa. Trang chủ
  từng thiếu lớp này (`slice(0, 3)` trần) — mà danh sách sắp theo `expiresAt`
  tăng dần nên đúng ba ô trang chủ là ba bonus sắp chết hoặc đã chết. Sửa
  29/08/2026. Trang là ISR `revalidate = 60`, nên
  ngay sau nửa đêm Toronto một lượt truy cập vẫn có thể nhận HTML của ngày hôm
  trước — chấp nhận, đổi lấy việc trang vẫn tĩnh.
- **Trang chưa công bố dùng cờ trong `lib/feature-flags.ts`** — vẫn build và vào
  được bằng URL trực tiếp, nhưng ẩn khỏi menu, footer, sitemap, search, kèm
  `noindex` và dải báo nháp. Cờ được áp ở cả 7 chỗ; đã kiểm.

## Vòng review 29/08/2026 — đừng đề xuất lại

Codex rà toàn repo trên `4d293ab`; tám phát hiện, cả tám đã vá. Ghi lại để lần
sau không kết luận ngược:

- **`expire-offers` GIỮ `expiresAt` khi lỗi còn chạy lại được** (FinlyWealth
  hỏng, rewrite ném, thiếu `ANTHROPIC_API_KEY`) và trả 500. Xoá nó là xoá thứ
  duy nhất khiến lượt sau tìm lại được thẻ — truy vấn CMA lọc theo
  `expiresAt[lte]`. Lỗi cấu trúc (thẻ không có trang FinlyWealth) thì vẫn xoá:
  lượt sau cũng không làm gì hơn được. Đừng "dọn" nhánh này thành xoá hết.
- **`CardBadges` không in ngày hết hạn đã qua.** Đó là lưới an toàn đi kèm điều
  trên, không phải chỗ quên `formatDate`.
- **Cả `expire-offers` (nhánh thẻ) lẫn `check-rebates` chặn entry có thay đổi
  chưa publish** bằng `version > publishedVersion + 1`, vì `updateEntry` publish
  cả entry. Hai chỗ phải giống nhau; trước 29/08/2026 chỉ `check-rebates` có.
- **Phạm vi kiểm của `check-rebates` lấy `applyUrl` từ bản PUBLISHED**, không
  phải draft: đọc từ draft thì một tác giả sửa dở link là đủ để thẻ rơi khỏi
  vòng lặp trong im lặng. Kèm vòng đối chiếu báo thẻ published có link
  FinlyWealth mà không entry nào khớp slug.
- **Transfer bonus chỉ bị unpublish khi bản PUBLISHED đã hết hạn**, và lệnh
  DELETE mang `X-Contentful-Version`. Draft mang ngày cũ từng đủ để gỡ một
  bonus còn hạn khỏi site.
- **`api/revalidate` giành chỗ trong `broadcastClaims` trước khi gọi Kit.**
  `publishedCounter === 1` là thuộc tính của entry, không phải của lượt giao
  webhook, nên nó KHÔNG chống được hai lượt giao cùng một sự kiện. Claim nằm
  trong bộ nhớ tiến trình: thu hẹp cửa sổ, không đóng hẳn (restart là mất) —
  ghi rõ trong code, đừng báo lại như phát hiện mới.
- **`api/revalidate` trả 502 khi Kit trả 4xx** (`newPostNotified === false`), và
  CHỈ ở nhánh đó. 4xx là Kit từ chối chính request đó nên chắc chắn chưa có bản
  tin nào, claim đã được trả lại, xin webhook gọi lại là an toàn — còn
  `publishedCounter` thì không bao giờ về 1 nữa, publish lại cũng không cứu.
  **Kit 5xx thì KHÔNG**: nó có thể đã tạo broadcast rồi mới hỏng ở đường trả
  lời, nên giữ claim và trả 200 (`"notify_uncertain"`), cùng cách với
  `"notify_failed"` khi `fetch` ném. Đừng gộp `!res.ok` làm một.
- **Bản tin không lấy body từ draft đi trước bản published**, và không gửi khi
  entry đã bị unpublish giữa lúc publish và lúc webhook chạy. Thiếu body thì
  vẫn gửi tiêu đề + link, thà thế còn hơn phát tán bản nháp.
- **`job-auth` chỉ nhận `Authorization: Bearer`, và ba job route chỉ còn POST.**
  Đã kiểm ngày 29/08/2026: cả ba workflow gửi header, webhook `Refresh Ghế 1A
  site` trong Contentful cũng gửi header và URL không mang query. Đừng thêm lại
  `?secret=` hay handler GET "cho tiện gọi tay".

- **Header bảo mật đặt trong `headers()` của `next.config.ts`** (thêm
  29/08/2026, trước đó site chỉ có `upgrade-insecure-requests` của Hostinger):
  HSTS, `nosniff`, `Referrer-Policy`, `X-Frame-Options`, `Permissions-Policy`.
  HSTS CỐ Ý không có `includeSubDomains` và không có `preload` — cả hai rất khó
  rút lại, xem chú thích trong file. Đừng "hoàn thiện" bằng cách thêm chúng vào
  mà không hỏi. Cũng đừng thêm một `Content-Security-Policy` đầy đủ ở đây một
  cách tiện tay: app có script inline của Next và GTM, làm dở là gãy trang —
  đó là một việc riêng.

Chưa làm: chưa có `Content-Security-Policy` thật (mới chỉ có
`upgrade-insecure-requests` do Hostinger gắn).

## Vòng review 29/08/2026 (lần hai — tầng render) — đừng đề xuất lại

Lượt đầu soi route/job/lib; lượt này soi trang, component, dữ liệu tĩnh, hai
công cụ tính, search, SEO/schema và accessibility. Tám phát hiện, đã vá cả tám:

- **`isElevatedLive()` trong `lib/credit-card-state.ts` là chốt duy nhất quyết
  định một thẻ có đang chạy elevated offer hay không** — cờ `elevatedBonus`
  MỘT MÌNH thì không. Bản đang phục vụ có thể mang cờ bật + `expiresAt` đã qua
  (publish hỏng giữa chừng). Năm chỗ phải dùng chung nó: tab "Offers nổi bật",
  chia nổi bật/còn lại ở trang chủ, `CardBadges`, banner đầu trang,
  `creditCardPriority`. Đừng đọc thẳng `offer.elevatedBonus` ở tầng render nữa.
- **`hasLiveBonus()` trong `lib/bank-accounts.ts`** cũng vậy với welcome bonus
  của tài khoản ngân hàng: bonus nằm trong file TypeScript nên không job nào gỡ
  chúng khi hết hạn, phải có người sửa rồi deploy. Chip lọc, thứ tự sắp xếp,
  headline trên thẻ và trang riêng đều đi qua hàm này.
- **`parseNumber` của calculator chỉ bỏ những chữ trang trí đã liệt kê**
  (`$`, `CAD`, `điểm`, `points`, `miles`…), gặp chữ lạ thì trả `null`. Bản cũ
  lọc `[^0-9.]` nên `1e6` thành `16` và `$-3500` thành `+3500` — sai số nhưng
  in ra vẫn trông hoàn chỉnh. Đừng "đơn giản hoá" lại thành lọc theo lớp ký tự.
- **JSON-LD thẻ tín dụng KHÔNG có `availabilityEnds`.** `Offer` ở đó là việc
  mở thẻ, còn `expiresAt` chỉ là hạn welcome bonus; gán vào nhau là báo với
  crawler rằng thẻ ngừng nhận application. Đừng thêm lại.
- **`lastmod` của `/blog` và trang chủ lấy max `lastModified` toàn bộ bài**,
  không phải `posts[0]` (bài mới nhất theo `publishedAt`). Dùng
  `latestModified()`, so bằng `Date` — SO CHUỖI LÀ SAI: `sys.updatedAt` kết
  thúc bằng `Z` còn `publishedAt` mang offset `-04:00`, nên
  `2026-08-02T23:00-04:00` (xảy ra SAU) thua `2026-08-03T02:00Z` khi so chuỗi.
  Vòng phản biện thứ hai bắt được đúng lỗi này trong bản vá đầu tiên, vòng thứ
  ba bắt tiếp một ca nữa: ngày không đọc được phải bị BỎ QUA, vì `NaN > NaN` là
  false nên một ngày hỏng lọt vào làm mốc đầu tiên sẽ chặn mọi ngày hợp lệ sau
  nó. (`getCategories` ngay bên trên vẫn còn đúng cái bẫy `NaN` này ở phép so
  của nó — chưa sửa vì nó chỉ ảnh hưởng `lastmod` của một trang chuyên mục,
  nhưng biết là có.)
- **`SiteSearch` lấy `items` từ module cache lúc RENDER** (`fetched ?? cachedItems`),
  không phải chỉ ở giá trị khởi tạo `useState`. Bản cũ kẹt vĩnh viễn ở "đang
  tải" nếu người dùng đóng ô tìm kiếm trước khi `/api/search` trả về. `failed`
  được xoá khi có lượt tải thành công sau đó.
- **Tên chương trình trong bảng `/transfer-partners` là `<th scope="row">`**,
  không phải `<td>`.
- **Form newsletter và contact: kết quả gửi có `role="status"` và được đưa
  focus tới.** Cả form bị thay bằng một dòng chữ khi gửi xong, nên không có hai
  thứ đó thì người dùng screen reader mất focus và không biết đã gửi được chưa.

Kiểm chứng bản vá bằng dữ liệu dựng sẵn (script tạm, đã xoá): năm hình dạng của
`isElevatedLive`, và một Simplii giả với hạn lùi về quá khứ để xem nó rơi khỏi
chip lọc và tụt xuống cuối danh sách sắp theo bonus.

## Trang so sánh thẻ và khối "Đi tiếp từ đây" (29/08/2026)

- **`/credit-cards/so-sanh` là ROUTE TĨNH nằm cạnh `/credit-cards/[slug]`.** Next
  ưu tiên đoạn tĩnh, nên một thẻ mang slug `so-sanh` sẽ mất trang chi tiết trong
  im lặng. `assertNoSlugClash()` chạy lúc dựng trang so sánh để build đỏ ngay
  thay vì trông chờ ai nhớ — đừng gỡ nó đi vì "chuyện đó không xảy ra đâu".
- **Bảng so sánh dựng ở SERVER, ô chọn chỉ điều hướng.** Không lọc tại chỗ:
  URL luôn nói đúng thứ đang hiện (gửi được cho người khác), và trình duyệt
  không phải tải dữ liệu của cả 23 thẻ để hiện hai. `ComparePicker` đọc
  `window.location.search` ngay lúc bấm thay vì `useSearchParams()` — hook đó
  bắt phải bọc `<Suspense>` lúc prerender mà ở đây không cần gì tới nó.
- **Ô chọn GIỮ NGUYÊN các tham số khác trên URL**, vì `utm_*` của chiến dịch
  dẫn người đọc tới đây — cùng lý do `bank-account-finder` sửa
  `URLSearchParams` hiện có thay vì dựng URL mới.
- **Trần ba thẻ** (`MAX_COMPARE`): mỗi cột cần ~220px để đọc được tên thẻ và
  con số bonus, cột thứ tư đẩy bảng qua mức người ta còn chịu vuốt trên điện
  thoại. Đo tại chỗ: ba thẻ là bảng 790px trong khung cuộn 341px, trang không
  cuộn ngang.
- **Mọi tổ hợp `?cards=` canonical về `/credit-cards/so-sanh` trần**, và
  sitemap chỉ liệt kê trang trần. Liệt kê từng tổ hợp là tự nộp cho Google hàng
  trăm URL gần như trùng nội dung.
- **Khối "Đi tiếp từ đây" chỉ hiện đường nào THẬT SỰ có.** Công cụ suy ra từ
  `PROGRAMS` của award-charts (chương trình nào có bảng giá thì có link), cộng
  đúng hai hệ điểm mà `/transfer-partners` có cột (`amex-mr`, `avion` — đó là
  hình dạng của `TransferPartnerRow`, không phải lựa chọn biên tập). Thẻ
  WestJet® vì vậy chỉ thấy ô so sánh, không thấy công cụ nào — đúng ý đồ, đừng
  "sửa" thành trỏ đại tới Award Flight Finder.
- **Đường dẫn của trang so sánh được canh ở HAI chỗ, và cần cả hai.**
  `generateStaticParams` của `[slug]` chạy lúc `next build` → bắt thẻ đã có
  trong Contentful lúc deploy. Nhưng thẻ publish SAU đó thì webhook chỉ
  revalidate chứ không chạy lại hàm đó, nên `check-rebates` (chạy hằng ngày,
  đọc bản published) canh lượt thứ hai và đỏ dai cho tới khi có người đổi slug.
  KHÔNG đặt cửa canh trong chính trang so sánh: nó `await searchParams` nên là
  route động, thân nó không chạy lúc build và `throw` ở đó không bao giờ làm
  deploy đỏ. Hai vòng review liên tiếp mới ra được hình dạng này.
- **Trang so sánh phải có mặt trong `PAGES` của `api/search`.** Bốn công cụ kia
  đều có; thiếu nó thì gõ đúng tên cũng không ra gì.
- **Dòng "Thẻ tín dụng" trong menu mobile dùng `cardsRowActive`, không dùng
  `cardsActive`** — trang so sánh nằm trong tiền tố `/credit-cards/` nên không
  loại ra thì menu sáng hai dòng cùng lúc.
- **Bài viết liên quan chỉ so trên tiêu đề + mô tả ngắn + chuyên mục, KHÔNG so
  trên thân bài.** Thân bài nhắc tên ngân hàng khắp nơi, so ở đó thì mỗi thẻ
  TD® kéo về cùng một mớ bài không liên quan. Mình tên ngân hàng khớp thì chưa
  đủ để hiện ra (điểm 1); phải khớp tên thẻ (3) hoặc tên chương trình điểm (2).

## Lịch sử offer (29/08/2026)

- **`data/offer-history.json` là nhật ký THAY ĐỔI, không phải bản chép hằng
  ngày.** `scripts/record-offer-history.mts` chỉ ghi thêm khi con số khác lần
  trước; hai lần đổi cùng một ngày thì ghi đè dòng của ngày đó, vì mốc của lịch
  sử này là NGÀY và hai dòng trùng ngày làm mọi phép "đổi lần gần nhất" ra hai
  kết quả.
- **Chiều dữ liệu đi NGƯỢC so với ba job kia.** Runner GitHub Actions không có
  token Contentful (chỉ có `EXPIRE_OFFERS_SECRET`), nên nó gọi
  `/api/offer-snapshot` để server đọc hộ rồi trả về. Lịch sử phải nằm trong
  repo: route chạy trên Hostinger không sửa được file nguồn, và ổ đĩa của nó
  dựng lại mỗi lần deploy. Đừng đề xuất "cho job tự ghi file".
- **`/api/offer-snapshot` đọc qua CDA, không phải CMA**, và trả 500 khi danh
  sách rỗng: rỗng gần như chắc chắn là Contentful lỗi, ghi nó vào lịch sử là
  đè một ngày trống lên dữ liệu thật.
- **`record-offer-history.mts` tự thử lại 3 lượt** (giãn 30s, timeout 60s mỗi
  lượt), trừ 401. Job chạy ngày một lần và là chỗ DUY NHẤT ghi lịch sử: một
  lượt hỏng thoáng qua mà con số kịp đổi lần nữa trước hôm sau là mất hẳn mức ở
  giữa, không dựng lại được. Cùng lý do ba workflow kia gọi bằng `curl --retry`.
- **Thẻ biến mất khỏi site KHÔNG bị xoá khỏi lịch sử** (có thể chỉ unpublish
  tạm; lịch sử đã xoá thì không dựng lại được).
- **`welcomeBonusPeak` im lặng nhiều hơn là nói.** Đòi ít nhất hai CON SỐ khác
  nhau — đếm theo số chứ không theo nhãn, vì "70,000 điểm" sửa thành "Tối đa
  70,000 điểm" là một dòng mới trong lịch sử nhưng vẫn đúng một mức, và đếm
  theo nhãn thì một lần biên tập câu chữ đủ để trang bắt đầu tuyên bố "cao nhất
  từng thấy" mà chưa từng thấy hai mức. Chỉ so những mốc CÙNG ĐƠN VỊ với mức
  hiện tại (% / $ / điểm) — thẻ
  cashback đổi từ "Hoàn tiền 15%" sang "$250" mà so thẳng 15 với 250 là một câu
  về tiền nói sai. Ngày đầu bật tính năng, mọi thẻ chỉ có một mức nên KHÔNG thẻ
  nào hiện dòng nào — đúng ý đồ, đừng "sửa" thành luôn hiện.
- **Câu "từ khi theo dõi" lấy ngày ghi nhận ĐẦU TIÊN CỦA THẺ ĐÓ**
  (`peak.trackedSince`), không lấy `since` của cả file: thẻ thêm vào tháng sau
  mà nói theo `since` là nói quá thời gian đã quan sát nó.

## Trang "Bắt đầu ở đây" (30/08/2026) — ĐÃ CÔNG BỐ

`/bat-dau`, sau cờ `START_HERE_PUBLISHED` trong `lib/feature-flags.ts`, hiện
`true` (bật cùng ngày, commit `fed904f`). **Trước khi sửa gì, hãy grep
`START_HERE_PUBLISHED` để đếm lại** — danh sách bề mặt đã đổi hai lần trong
một ngày và mục này đã lỗi thời hai lần theo. Tính tới cuối 30/08/2026 có
**mười** chỗ: dải "Chưa biết bắt đầu từ đâu?" trên trang chủ (`page.tsx` +
`hero.tsx` cho khoảng đệm), `sitemap.ts`, chỉ mục ô tìm kiếm
(`api/search/route.ts`), `robots: noindex` + dải báo nháp trên chính trang, nút
ở `about`, `contact`, `privacy`, `terms`, `credit-cards/so-sanh`, và CTA của
email chào mừng trong `api/subscribe/route.ts`.

**Mọi cửa vào PHẢI gate.** Cửa email là cửa duy nhất nằm ngoài site và là cửa
duy nhất không thu hồi được — link trên trang thì tắt cờ là biến mất, link đã
gửi vào hộp thư thì nằm đó mãi. Nó từng KHÔNG được gate (thêm ở `29db2b1`, vá
cùng ngày); tắt cờ lúc đó là mọi subscriber mới nhận email trỏ vào trang
`noindex` đang đeo dải "Trang nháp". Cờ tắt thì email quay về `/blog`, không bỏ
trống CTA.

KHÔNG có ở menu trên cùng và KHÔNG có ở footer — đó là quyết định chủ ý của tác
giả, không phải chỗ bị bỏ sót: hai chỗ điều hướng cố định kia dành cho mục
người ta quay lại nhiều lần, mà "Bắt đầu ở đây" theo định nghĩa là trang đọc
một lần. (Bản trước của mục này ghi cờ `false` và "6 chỗ, có menu + footer" —
sai cả hai; bản sau ghi "bốn bề mặt" — cũng sai trong vòng vài giờ. Đó là lý do
có câu "grep lại" ở trên.)

- **Đầu trang là NGÃ BA, không phải wizard.** Đã cân nhắc một luồng onboarding
  3 câu hỏi (mục tiêu / kinh nghiệm / bối cảnh) rồi bỏ sau một vòng phản biện
  product với Codex. Lý do bỏ KHÔNG phải "ít đầu ra nên cá nhân hoá giả" — lý
  do đó sai, ba câu hỏi vẫn hợp lệ nếu đổi một câu trả lời làm đổi đề xuất. Lý
  do thật: nó thêm hai bậc chuyển đổi trước khi trả được giá trị nào, trên một
  trang chưa có traffic để biện minh. Đừng dựng lại wizard khi chưa có số.
- **Ngã ba là BỐN Ô BẰNG NHAU.** Bản đầu chia hai tầng (chọn thẻ / bay về Việt
  Nam là nút lớn; chưa hiểu gì / mới sang Canada là link nhỏ) và đã bỏ: trên
  đúng trang tên "Bắt đầu ở đây", "tôi chưa hiểu gì" nhiều khả năng là nhu cầu
  phổ biến NHẤT, mà nó lại nhỏ nhất — ai đã biết mình muốn chọn thẻ thì bấm
  thẳng nav. Người mới định cư cũng là nhóm độc giả cốt lõi trong PRODUCT.md.
  Sâu hơn: thứ bậc mã hoá một phỏng đoán về nhu cầu nào phổ biến hơn, đúng câu
  hỏi mà `start_here_goal` được gắn để trả lời — trước khi có số, bằng nhau là
  mặc định trung thực. Có số rồi mới nâng cái thắng lên. Ô bằng nhau cũng cho
  cả bốn vùng chạm thật (đo được ≥100px trên 375px), đúng ràng buộc "độc giả
  lớn tuổi, mobile là mặt trận chính".
- **"Tôi đang chọn thẻ" dẫn về `/credit-cards`, KHÔNG phải trang so sánh** —
  người chưa biết chọn gì thì chưa có hai ứng viên để đặt cạnh nhau.
- **Khối newcomer nói thẳng site chưa có dữ liệu xếp thẻ theo khả năng được
  duyệt**, rồi chỉ hai chỗ có cơ sở: 2 tài khoản ngân hàng gắn tag `newcomer`
  và phần nền tảng. Thiếu dữ liệu KHÔNG đồng nghĩa không được dẫn họ đi đâu —
  nói rõ giới hạn rồi dẫn tới thứ mình có đủ cơ sở mới là trung thực.
- **Chỗ đặt ở hero là MỘT NÚT VIỀN, đứng TRÊN form bản tin.** Không phải cụm
  bốn ô (hero bê bốn ô lên là hai lời kêu gọi ngang sức cạnh nhau, mobile thì
  cái sau ăn mất cái trước), và cũng không phải một dòng chữ — bản dòng chữ đo
  được vùng chạm 37px (dưới chuẩn 44px, mà PRODUCT.md ghi có độc giả lớn tuổi),
  chữ 14px nhỏ nhất hero, nằm ở 659px tức sát mép màn hình khi có thanh trình
  duyệt. Nút viền 343×56px ở 453px giải cả ba.
  Đứng TRÊN form là có chủ ý và có cái giá của nó: bản tin có BA cửa (form
  hero, nút trên header, khối CTA cuối trang) còn trang Bắt đầu chỉ có MỘT.
  Nút nền đặc vẫn hút mắt hơn nút viền nên bản tin giữ ưu thế thị giác dù đứng
  sau. Cái giá: người định đăng ký từ hero phải nhìn thấp hơn ~170px — theo dõi
  bằng GA4 chứ đừng đảo lại theo cảm giác.
  Nút nằm sau cùng cờ `START_HERE_PUBLISHED` với trang, nên bật cờ là mở cả
  trang lẫn cửa vào của nó cùng lúc.
- **KHÔNG bê cụm ngã ba này ra cuối bài.** Hero đã có một
  nhiệm vụ (đăng ký bản tin, một trong hai thước đo thành công); cuối bài thì
  đã biết ngữ cảnh nên CTA phải theo loại bài. Dùng chung component không có
  nghĩa dùng chung một quyết định UX.
- **Ba tầng đo, đừng bỏ tầng nào.** Ngã ba bắn `start_here_goal` kèm `goal`;
  mọi link trong bốn bước bắn `start_here_step` kèm `step` + `target`
  (`components/home/start-here-link.tsx`); `NewsletterForm` bắn
  `newsletter_subscribed` kèm `source` SAU khi `res.ok`. Không có số thì cả
  trang này lẫn câu hỏi "có cần wizard không" đều không kiểm chứng được. Quyết
  theo số phiên đủ lớn, không theo lịch.
- **`NewsletterForm` có prop `source` BẮT BUỘC, không mặc định.** Form đứng ở
  ba chỗ (`hero`, `page_cta`, `start_here`) và Kit chỉ đếm được tổng subscriber.
  Truyền tường minh, đừng suy từ `id` — `id` tồn tại để nối `<label for>`, đổi
  nó vì lý do accessibility mà làm gãy số đo là loại lỗi không ai nhận ra.
- **`ApplyButton` ĐÃ có event** kể từ vòng 30/08/2026 bên dưới (`ApplyLink`,
  `apply_clicked`). Mục này trước đây ghi "chưa có, việc còn nợ" — nợ đã trả,
  xem mục "Đo click affiliate" ở phần vòng review 30/08/2026.
- **Lộ trình bước 1 là DANH SÁCH SLUG VIẾT CỨNG** trong `lib/start-here.ts`
  (`FOUNDATION_SLUGS`), không còn lấy cả chuyên mục "Kiến thức" rồi đảo ngược.
  Cách cũ có hai lỗ: mọi bài Kiến thức đăng về sau tự động thành bước kế tiếp
  của lộ trình cho người mới kể cả khi là bài nâng cao, và không có trần; đổi
  tên chuyên mục trong Contentful là lộ trình rỗng mà không build nào đỏ.
  Thứ tự hiện tại GIỮ NGUYÊN thứ tự xuất bản cũ (cũ nhất trước) — tác giả chốt
  30/08/2026 rằng sắp lại là quyết định biên tập của chính ông ấy, không phải
  thứ suy ra từ tiêu đề. Đừng "sửa" thành mới nhất trước, và đừng tự sắp lại.
  Slug thiếu thì bị bỏ qua và `console.warn` trên server; lộ trình rỗng thì ẩn
  luôn lối "Tôi chưa hiểu Miles & Points là gì" ở ngã ba và Bước 1 đổi sang
  `step1BodyEmpty` (vẫn render, nếu không thì còn Bước 2, 3, 4 mà không có
  Bước 1).
- **Sáu bài trong lộ trình là BÀI VIẾT (`type: "post"`), không phải video** —
  nhãn "phút đọc" là đúng, đừng "sửa" thành badge Video. Ghi ra đây vì vòng rà
  30/08/2026 kết luận nhầm là video và suýt sửa hỏng. Hai phép kiểm đã dẫn tới
  kết luận sai, ĐỪNG DÙNG LẠI: grep `youtube` trong HTML (JSON-LD Organization
  của MỌI trang đều có `sameAs` youtube.com/@hoangleca) và grep `>Video<` (menu
  nav có mục "Video"). Cách kiểm đúng là hỏi thẳng Contentful Delivery API
  trường `fields.type`. Toàn site 30/08/2026: 36 blogPost = 25 video + 11 post,
  và cả 6 bài chuyên mục "Kiến thức" đều là post.
- **`PostNextSteps` cuối bài blog dẫn tới `/bat-dau`, nhưng CHỈ trên bài nằm
  trong lộ trình** (6 bài, xây từ `foundationPosts(posts)`). Ba luật, đừng nới:
  (1) **chỉ bài trong lộ trình** — câu "bài này nằm trong lộ trình cho người
  mới" là câu THẬT về đúng bài đang đọc; dán lên cả 30 bài thì thành banner
  chung chung, đúng thứ luật "thà không có link còn hơn link sai chỗ" của
  `card-next-steps.ts` sinh ra để chặn. Muốn mở phạm vi sau này thì phải viết
  một CTA khác, không tái dùng câu này. (2) **luôn đứng SAU đường tới thẻ** ở
  cả hai nhánh — click Apply là một trong hai thước đo thành công, cửa mới
  không được chắn trước nó. (3) **ở nhánh "Thẻ nhắc trong bài" nó tách thành
  khối riêng bên dưới**, vì một lộ trình đọc không phải một cái thẻ; hai heading
  khác nhau nên không lặp, và giữ heading chung "Đi tiếp từ đây" của `NextSteps`
  (8 trang dùng) thay vì đặt heading một-lần-dùng.
  **Số bài đọc từ lộ trình ĐANG RENDER, không phải `FOUNDATION_SLUGS.length`** —
  một bài bị unpublish thì `/bat-dau` hiện 5 còn link ở đây vẫn hứa 6, đúng loại
  câu cũ đi được mà cả trang Bắt đầu sinh ra để tránh. `FOUNDATION_SLUGS.length`
  giờ chỉ còn dùng cho `console.warn` ở `/bat-dau`.
- **Cạnh đã biết, CỐ Ý không sửa (30/08/2026):** nếu một bài có `publishedAt`
  hỏng nhưng `updatedAt` hợp lệ thì `lastModified()` trả về chuỗi hỏng, và
  `latestModified()` bỏ luôn bài đó thay vì dùng `updatedAt`. Codex nêu ở vòng
  gate; không sửa vì đó là code dùng chung, đổi nó là đổi `dateModified` trong
  JSON-LD của MỌI bài blog — bán kính lớn hơn cả việc đang làm — và `publishedAt`
  là field Date có validate trong Contentful nên gần như không thể hỏng. Nếu
  sau này thật sự gặp, sửa trong `lib/blog-categories.ts` chứ đừng vá riêng ở
  `start-here.ts`.
- **Mỗi mục trong lộ trình hiện `excerpt`**, không chỉ tiêu đề. Lý do cụ thể:
  bài "Know Your Minimum" có tiêu đề tiếng Anh không phụ đề, người mới sang
  Canada không đoán được "minimum" là minimum spend hay mức điểm tối thiểu để
  đổi. `excerptVi` của cả sáu bài đều do người viết nên nó là ngữ cảnh thật.
- **Mọi con số trên trang tính lúc render** từ dữ liệu thật (số bài Kiến thức,
  số thẻ, số thẻ đang chạy elevated offer qua `isElevatedLive`, số chương trình
  trong `PROGRAMS`). Không có câu nào có thể cũ đi mà không ai biết — đừng thay
  bằng số viết cứng.
- **Trong dropdown thẻ, "So sánh thẻ" nằm TRÊN đường kẻ** (`groupLinks`) vì nó
  là một cách nhìn khác của cùng danh sách thẻ; "Ngân hàng" và "So sánh tài
  khoản" nằm DƯỚI (`extraLinks`) vì đó là khu vực khác của site. Menu mobile là
  danh sách phẳng nên hai nhóm nối làm một, giữ đúng thứ tự đó.

## Hai trang so sánh dùng chung gì (30/08/2026)

`lib/compare.ts` giữ đúng phần thật sự giống nhau: trần ba cột, `pickBySlugs`,
`compareHref`, `assertNoSlugClash`. Đường dẫn, tên tham số và bảng thì mỗi bên
một module (`card-compare.ts` / `bank-compare.ts`) — gộp nốt chúng vào chỗ
chung chỉ tạo ra một hàm nhận năm tham số để tránh viết hai dòng.

- **`ComparePicker` (ở `components/ui/`) nhận `labels.slots` là MẢNG CHUỖI, không
  phải hàm.** Nó là Client Component, mà RSC không cho truyền function qua ranh
  giới server→client: `tsc` và `next build` đều xanh, chỉ runtime mới nổ 500.
  Đã vấp đúng một lần khi tách component này ra dùng chung.
- **`/bank-accounts/so-sanh` chỉ cần cửa canh slug lúc build**, khác
  `/credit-cards/so-sanh`. Tài khoản nằm trong `lib/bank-accounts.ts` chứ không
  trong Contentful, nên không có đường nào thêm một tài khoản vào site mà không
  đi qua `next build` — không cần lượt canh hằng ngày như bên thẻ.
- **Trang so sánh tài khoản dùng chung cờ `BANK_ACCOUNTS_PUBLISHED`** với mục
  Ngân hàng. Hai thứ này không được lệch: một trang so sánh index được trong khi
  trang nó trỏ tới thì không là chuyện vô lý với cả Google lẫn người đọc.

## Vòng review 30/08/2026 (toàn repo, 7 vòng Codex) — đừng đề xuất lại

Vòng này khác các vòng trước ở chỗ Codex được dùng để BÁC BỎ chính bản vá của
Claude, và nó bắt được 3/9 bản vá HỎNG ở vòng đầu, 3 lỗ nữa ở vòng sau. Không
có mấy vòng đó thì cả sáu đã được push.

**Đo click affiliate — `ApplyLink` (`components/ui/apply-link.tsx`).** Món nợ
mà mục "`ApplyButton` vẫn CHƯA có event" ở trên nói tới, nay đã trả.
- **`placement` và `product` là BẮT BUỘC ở cả `ApplyButton` lẫn `CardImage`**,
  cùng luật với `source` của `NewsletterForm`. `CardImage` dùng
  **discriminated union**, không phải hai prop optional có mặc định
  `"unknown"`: prop optional cộng mặc định thì chỗ gọi mới quên truyền vẫn
  build xanh và chỉ có số liệu âm thầm sai. Có `applyUrl` là buộc có hai prop
  kia; không có `applyUrl` thì cấm truyền chúng.
- **Vùng ảnh thẻ là ĐƯỜNG CLICK THỨ HAI** và phải đo bằng
  `${placement}_image`. Bốn chỗ dùng `CardImage` với `applyUrl` đều thế.
- **`onAuxClick` là bắt buộc, không phải chi tiết thừa.** Bấm nút giữa mở tab
  mới phát `auxclick` chứ KHÔNG phát `click`: link vẫn mở, hoa hồng vẫn tính,
  số đo mất. Chỉ nhận `button === 1` — chuột phải cũng là `auxclick` nhưng mở
  menu ngữ cảnh thì chưa ai đi đâu cả.
- **Thân bài blog là đường ra affiliate THỨ BA**, và là đường không có
  component React nào để treo `onClick`: HTML dựng ở server rồi chèn bằng
  `dangerouslySetInnerHTML`. `components/blog/affiliate-click-tracker.tsx` là
  một component RENDER RA `null`, tìm phần tử qua `data-affiliate-scope` rồi uỷ
  quyền sự kiện trên đó — nhờ vậy thân bài vẫn nằm trọn trong Server Component.
  Nhận diện bằng **`a[rel~='sponsored']`**, KHÔNG bằng một danh sách host chép
  lại: `relForUrl` trong `lib/affiliate-links.ts` là chốt duy nhất, bản sao thứ
  hai sẽ lệch vào ngày thêm đối tác mới. Kiểm tại nguồn 30/08/2026: cả **5**
  link trong thân bài của 36 bài đều có hoa hồng (FinlyWealth ×3, Chexy,
  Neobanc) — doanh thu thật, không phải ca lý thuyết.
  **ĐỪNG viết lại lý do thành "để khỏi gửi HTML hai lần" — đã đo và SAI:** trang
  blog dựng sẵn chứa chuỗi thân bài đúng hai lần dù đi đường nào, vì RSC payload
  phải mô tả cả prop `dangerouslySetInnerHTML` của Server Component. Cái được là
  ranh giới client nhỏ hơn, không phải ít byte hơn.
- Chưa làm: `placement`/`product` phải được đăng ký thành **event-scoped custom
  dimension** trong GA4 Console thì báo cáo mới tách/gộp được. Việc đó nằm
  ngoài repo.

**`api/revalidate`: `"fetch_failed"` trả 502, KHÔNG phải 200.** Cùng nhánh với
`false` và vì cùng lý do — lượt gọi CMA nằm trước `claimBroadcast` và trước mọi
lời gọi Kit, nên chắc chắn chưa gửi gì và chưa giành chỗ; nó lại là lỗi thoáng
qua (CMA 429/503) nên gọi lại là qua được. Trả 200 ở đây là bài viết đó mất
bản tin VĨNH VIỄN: Contentful không gọi lại, còn `publishedCounter` sang lần
publish sau đã là 2. Đúng một lần CMA nấc là một bài ra đời im lặng.

**`api/subscribe` có HAI xô rate-limit.** Xô theo IP như cũ, cộng
`subscribe:email:<email hạ chữ thường>` 2 lần/giờ, đặt SAU khi validate email
(khoá bằng chuỗi chưa kiểm là cho người gọi tự sinh khoá bơm phình cái Map).
Xô thứ hai là **giới hạn thiệt hại cho MỘT nạn nhân** — dội bom một hộp thư từ
nhiều IP — và nó KHÔNG chặn list-bombing. Đừng ghi ở đâu là đã chống spam.
`sendWelcomeEmail` nay bọc try/catch: "best effort" phải đúng cho cả lượt
`fetch` NÉM, không chỉ lượt trả `!ok`.

**`clientIp()` trong `lib/rate-limit.ts` VẪN lấy phần tử ĐẦU của
`X-Forwarded-For`, và đây là việc CÒN TREO, không phải việc đã xong.** Nếu
proxy Hostinger nối thêm thay vì ghi đè thì phần tử đầu do client tự đặt được,
tức xoay header là vượt xô IP. Đã cân nhắc đổi sang phần tử CUỐI và **bác**:
ca `người đọc → proxy công ty → Hostinger` cho ra `XFF: IP-người-đọc,
IP-proxy-công-ty`, nên "cuối" chỉ thấy proxy và gộp cả CGNAT/VPN vào một xô —
request thứ sáu của một người hợp lệ nhận 429. Cả hai lựa chọn đều có giá, và
**không quyết được nếu chưa biết Hostinger làm gì**. Cách biết: xem raw header
ở origin, hoặc hỏi Hostinger. (Có một phép thử gửi POST body hỏng tới
`/api/contact` kèm XFF giả — route rate-limit TRƯỚC khi parse nên chỉ trả 400
rồi 429, không gọi Resend — nhưng nó là POST vào production, phải hỏi tác giả
trước.)

**`lib/content/contentful.ts` lọc scheme của link rich text (`isSafeHref`).**
Ô nhập link của Contentful nhận chuỗi tự do, mà thân bài đi qua
`dangerouslySetInnerHTML`. Scheme lạ thì render CHỮ TRẦN, không phải `<a>`.
**`//host/path` bị TỪ CHỐI dù nó bắt đầu bằng `/`** — nó là link ra ngoài mượn
scheme của trang, và `relForUrl` (chỉ khớp `^https?://`) sẽ trả `null`, nên
một link referral viết kiểu đó ra site mà không có `sponsored`. Kiểm tại nguồn:
cả 5 link đang có đều `https:`, bản vá không làm mất link nào.

**`api/sync-videos`: `sys.id` của Contentful tối đa 64 ký tự.** `post-` + slug
cắt ở 80 ra 85 — một video tiêu đề dài là 422 và job đỏ cho video đó mãi mãi
(bài dài nhất đang có là `post-…` 62 ký tự, chỗ trống còn 2). Slug nay cắt ở
`64 - "post-".length`. `uniqueSlug()` hỏi trước rồi gắn `videoId` khi trùng, và
**phải hỏi CẢ id dự phòng nó sắp trả về**, không chỉ id gốc. Vòng lọc trùng ở
trên so theo `videoUrl` nên nó không thấy entry nào KHÔNG có trường đó — tức là
mọi bài viết chữ; một video trùng tên với một bài viết là đủ để 409 mãi.

**`lib/subscriber-email.ts` escape `title` và `preheader`.** Hai chỗ đó nhận
chữ THƯỜNG (từ `titleVi`/`excerptVi`); `bodyHtml` thì ngược lại, nơi gọi đã tự
dựng thẻ nên KHÔNG đụng tới. Một dấu `<` hay `&` hợp lệ trong câu tiếng Việt
là đủ làm hỏng markup của email — mà email gửi rồi thì không sửa lại được.

**`lib/bank-compare-path.ts` là module KHÔNG ĐƯỢC import gì.** `SiteHeader` là
Client Component trong layout gốc nên có mặt trên mọi trang; nó chỉ cần một
chuỗi, nhưng `bank-compare.ts` import `BANK_ACCOUNTS`, nên `/about`,
`/terms`, `/calculator` đều tải **~19 KB gzip** dữ liệu tài khoản ngân hàng.
Đo lại sau khi tách: chunk đó biến mất khỏi `/about`. Thêm một import vào file
kia là mở lại đúng đường rò, và **sẽ không đỏ ở đâu cả**.

**`priority` của `next/image` đã DEPRECATED ở Next 16 — dùng `preload`.**
Truyền cả hai là ném lỗi. Đã đổi ở 4 chỗ.
**`sizes` phải tả bề rộng ẢNH ĐƯỢC VẼ, không phải bề rộng tối đa của khung.**
Ảnh cover bài blog khai `"672px"` trần trong khi khung là `max-w-2xl px-4
sm:px-6 lg:px-8`, nên máy 375px ở DPR 2 đi lấy biến thể cho 1344px. Bốn mốc
hiện tại là bốn khoảng padding thật (`px-4` <640, `px-6` ≥640, khung chạm trần
672px ở đúng 672px màn hình, `px-8` ≥1024) — đừng rút gọn thành một con số.

**`sitemap.ts`: trang thẻ có `lastmod` từ `sys.updatedAt`.** Trước đây 23 trang
đổi nội dung thường xuyên nhất site lại là 23 trang duy nhất không nói được với
crawler rằng chúng vừa đổi. Kiểm trước khi tin: `updatedAt` trải trên 4 ngày,
revision 1–23 — là ngày thật, không phải job nào chạm mỗi ngày. Ngày không đọc
được thì trả `undefined`, **không phải "bây giờ"**: khai một `lastmod` bịa còn
tệ hơn không khai. **29 trang tài khoản ngân hàng vẫn KHÔNG có `lastmod`** —
dữ liệu nằm trong file TS nên không có ngày nào để lấy; việc còn treo.

**`site-search.tsx` kiểm `res.ok` trước `.json()`.** `fetch` chỉ reject khi
mạng hỏng; 500 vẫn resolve, nên `data.items` là `undefined`, `cachedItems`
được gán `undefined`, ô tìm kiếm đứng mãi ở "đang tải" mà nhánh `.catch` không
bao giờ chạy. Thêm một `<p role="status" aria-live="polite" class="sr-only">`
báo số kết quả — cùng luật với kết quả gửi form. Câu đó **trễ 400ms sau khi
ngừng gõ**; danh sách hiển thị vẫn lọc tức thì. Không trễ thì mỗi phím gõ là
một lượt đọc và người dùng nghe "1 kết quả, 4 kết quả, 12 kết quả…" chồng lên
nhau thay vì nghe câu trả lời.

**`points-calculator`: `Number.isFinite` phải kiểm ở HAI chỗ.** `p > 0` chưa
đủ — `p` nhỏ dưới ngưỡng biểu diễn làm phép chia tràn thành `Infinity`. Nhưng
chốt sau phép chia cũng chưa đủ: `1e308` là HỮU HẠN và qua được nó, rồi
`formatCents` nhân 100 mới thành `Infinity`. Chốt thứ hai nằm trong
`formatCents` (chỗ cuối cùng con số còn là số), và nó trả `null` — nơi gọi phải
đổi ra dòng "không tính được", vì ghép chuỗi thẳng in ra "null¢" mà `tsc` không
bắt (template literal nhận cả `null`).

**Trần số khoá trong `lib/rate-limit.ts` (`MAX_WINDOWS`), và khi đầy thì dùng
XÔ CHUNG — KHÔNG đuổi khoá nào.** Quét định kỳ chỉ dọn khoá ĐÃ hết hạn, mà khoá
do người gọi tự sinh (IP trong `X-Forwarded-For`, địa chỉ email khác nhau) thì
còn hạn suốt cửa sổ một giờ. Chạm trần thì khoá MỚI rơi vào `OVERFLOW_KEY` với
ngân sách riêng; khoá ĐÃ CÓ vẫn đi đường bình thường.

**Đã thử ĐUỔI khoá (FIFO) và BỎ — nó tệ hơn cả bản không có trần.** Đừng dựng
lại. Với một botnet có 10,001 IP THẬT (không cần giả header), chúng bơm cho Map
đầy rồi quay vòng đúng những IP vừa bị đuổi: mỗi lần bị đuổi là một cửa sổ mới,
tức là mình tự reset giới hạn hộ chúng. Bản không trần giữ nguyên xô đó và chặn
tới hết giờ. Mọi chính sách đuổi đều có tính chất này — ngẫu nhiên chỉ làm nó
khó đoán hơn. (Lập luận "ai tạo được khoá tuỳ ý thì đã vượt được giới hạn rồi,
đuổi không làm tệ hơn" ĐÚNG cho ca XFF giả được, nhưng SAI cho ca botnet IP
thật. Đã tranh luận hai vòng mới ra.)
Bản FIFO đầu tiên còn `sort` cả 10,000 phần tử mỗi lần chèn khi đầy — đo được
~2.5ms/request, tức tự dựng một đường DoS mới ngay trong lớp chống lạm dụng.
Cách hiện tại không đuổi, không sắp, không quét gì thêm.

**Cái giá của xô chung, nói thẳng:** trong lúc bị bơm, một người đọc THẬT vừa
tới cũng rơi vào xô chung và có thể bị chặn. Chấp nhận, vì hai lựa chọn kia
tệ hơn: không trần thì bộ nhớ tăng tới OOM mà tiến trình này phục vụ CẢ SITE
(mất form đăng ký còn hơn mất mọi trang), còn đuổi khoá thì như trên.

**Khoá xô email là BĂM, không phải địa chỉ (`emailKey`).** Map sống trong bộ nhớ
cả tiếng; thứ xô cần chỉ là "hai lần gửi này có cùng đích không", và một chuỗi
băm trả lời y hệt mà không giữ lại dữ liệu cá nhân. Muối ngẫu nhiên mỗi lần khởi
động, cố ý — nó không cần bền (restart là mất cả Map), và muối ngẫu nhiên thì
không dò ngược được bằng cách băm thử một danh sách.
Muối chỉ chặn dò ngược khi lộ chuỗi băm mà KHÔNG lộ muối (log, dump một phần);
ai đọc được cả bộ nhớ tiến trình thì đọc được luôn `EMAIL_SALT`. Và đừng ghi
rằng băm rồi là "hết dữ liệu cá nhân" — chuỗi băm vẫn là định danh giả danh ổn
định suốt vòng đời tiến trình.
`emailKey` HẠ CHỮ THƯỜNG TOÀN BỘ, kể cả local-part. RFC 5321 nói local-part CÓ
THỂ phân biệt hoa/thường, nên đây là ĐÁNH ĐỔI chứ không phải một sự thật —
đừng "sửa" thành chỉ hạ chữ thường phần domain: làm thế là đổi hoa/thường một
chữ cái đã vượt được xô, đúng thứ nó sinh ra để chặn. Cái giá là trên một máy
chủ thư hiếm hoi thật sự phân biệt hoa/thường, hai hộp thư dùng chung một xô và
người thứ hai nhận 429 kèm `Retry-After`.

**Vùng chạm (PRODUCT.md: độc giả lớn tuổi, mobile là mặt trận chính).** Nút
menu mobile 40→44px (header cao 64px nên nới thẳng được). Link "xem chi tiết"
trong hai bảng so sánh 20→40px: trên bảng cuộn ngang, đó là đường DUY NHẤT sang
trang chi tiết mà không đi thẳng ra affiliate, hụt tay là bấm nhầm nút Apply
ngay trên nó.

**Trong dải offer, vùng chạm nới bằng `::before`, KHÔNG bằng `h-11 w-11`.** Dải
cao `min-h-12` + `py-2`, nên một nút 44px THẬT đẩy chiều cao tối thiểu trên
điện thoại từ 48px lên 60px — sửa một lỗi chạm bằng cách chiếm thêm một phần tư
màn hình đầu. Pseudo-element nằm ngoài luồng bố cục: vùng chạm 44px, dải không
cao thêm pixel nào. Nút "Xem offer" nới CHỈ THEO CHIỀU DỌC (`inset-x-0`, không
phải `w-11`) để không chồm sang nút đóng bên cạnh.
Từng lập luận "pill 28px không cần nới vì cụm bên trái đã là target lớn" —
**SAI, đã bị bác**: cụm đó chỉ cao 32px (ảnh `h-8`), và một target khác cùng
đích không làm cái pill này bấm trúng hơn.

**`lib/finlywealth.ts`: so host chính xác, không `endsWith` trần.**
`endsWith("finlywealth.com")` nhận cả `notfinlywealth.com` — đúng cái bẫy
`isReferralUrl` đã vá. Host lạ lọt qua là `check-rebates` báo một con số rebate
sai, mà rebate là tiền hiện cho người đọc.

**`audit:trademarks` báo nhầm tên KIỂU TypeScript.** Nó học được cụm "Element"
từ khách sạn Element® của Marriott®, và nó không phân biệt được
`event.target as Element` với chữ hiện trên trang (nó chỉ tha `//` comment).
Lookbehind của nó chặn khi có chữ cái đứng ngay trước, nên `HTMLElement` đi
lọt. Gặp lại ca này thì đổi tên kiểu, đừng nới luật của audit.

## Vòng debug toàn diện 31/08/2026 — đừng đề xuất lại

Nền: `lint`, `tsc`, `build`, cả ba audit, crawl 114 route, 139 link nội bộ, 930
URL `/_next/image`, console 16 trang, tràn ngang ở 375/768/1280 — **tất cả đều
xanh, và site vẫn có 6 lỗi thật**. Đừng coi bộ kiểm đó là bằng chứng sạch.

**`String.replace` với chuỗi thay thế chứa `$` — đã cắn.** Trong
`check-bank-rebates.mts`, `source.replace(re, \`$1rebate: "${live}",\`)` với
`live = "$100"` được đọc là: nhóm 1, chữ `rebate: "`, rồi `$10` (không có nhóm
10 nên lùi về) → NHÓM 1 MỘT LẦN NỮA, rồi `00`. File thành TypeScript hỏng và
workflow commit nó vào main. `$100` là số đang chạy của KOHO Everything Plan.
**Luật:** ở mọi chỗ ghép con số tiền vào `replace`, dùng DẠNG HÀM.

**Regex không được dùng làm ranh giới object trong `bank-accounts.ts`.** Bản
`[\s\S]*?` trần đi xuyên qua `},` và sửa tài khoản kế tiếp; bản có rào
`(?:(?!\n  \},)[\s\S])*?` chạy đúng nhưng chết ngay khi ai đó đổi thụt lề. Cách
đang dùng là cắt chuỗi bằng `indexOf` với ranh giới là `slug: "` của tài khoản
sau — kiểm 31/08/2026: cả 29 lần xuất hiện của `slug: "` đều là đầu một khối,
không có trong comment hay chuỗi lồng.

**FinlyWealth trả 200 kèm `<title>` RỖNG một cách ngẫu nhiên.** Đo được: 1
trong 7 lượt gọi liên tiếp `koho-everything-plan`. Vì vậy `fetchRebate` NÉM ở
mọi thứ không nhận ra được, và chỉ trả tín hiệu xoá khi tiêu đề đúng là "Not
Found". Đừng gộp "không đọc được" với "rebate đã gỡ".

**Bước commit của một job tự push dùng `if: ${{ !cancelled() }}`, KHÔNG phải
`always()`.** `always()` chạy cả khi workflow bị huỷ tay, nên một lượt cancel
giữa chừng vẫn đẩy được commit lên main. Và đừng gộp nó trở lại làm điều kiện
mặc định: một trang FinlyWealth chập chờn không được phép vứt những con số đã
sửa đúng của 28 tài khoản kia.

**Bonus tài khoản ngân hàng: gate ở meta/JSON-LD, KHÔNG gate ở khối điều
kiện.** `bankAccountDescription` phải qua `hasLiveBonus` — nó nói với người
CHƯA mở, qua snippet Google. Nhưng khối "Điều kiện nhận bonus" trên trang thì
KHÔNG được giấu: người mở Simplii trước 30/09 còn 120 ngày để thiết lập direct
deposit, người mở BMO® trước 02/11 còn phải hoàn thành các bước tới 31/12. Đã
thử giấu và đã revert 31/08/2026.

**`relForUrl` phải trim.** `isSafeHref` trim rồi mới duyệt scheme, nên link
Contentful có khoảng trắng đầu lọt qua đó rồi trượt `^https?://` ở
`relForUrl` — ra site không có `sponsored`, không `target="_blank"`, và
`AffiliateClickTracker` không đếm. Trình duyệt vẫn cắt khoảng trắng nên người
đọc không thấy gì bất thường.

**Codex sai ở đâu (đừng nghe lại):** nó báo `block.includes("/shorts/")` trong
`sync-videos` không nhận ra Shorts vì payload Atom "chỉ dùng `watch?v=`". Tải
feed thật của @HoangLeCA ngày 31/08/2026: **3/15 entry có
`href="https://www.youtube.com/shorts/…"`**. Guard chạy đúng, giữ nguyên.

## Ngân sách thời gian và phân trang (31/08/2026, đợt hai)

**`api/revalidate` có HẠN CỨNG 25 giây cho cả route** (`WEBHOOK_BUDGET_MS`),
mỗi `fetch` nhận phần nhỏ hơn giữa hạn riêng và phần còn lại. Contentful bỏ
cuộc ở 30 giây và **không gọi lại webhook bị timeout** — khác 5xx (thử lại hai
lần), nên đường "quá giờ" là đường mất bản tin vĩnh viễn. Đừng gỡ hạn này, và
đừng cộng các timeout con lại thay cho hạn chung.

**`res.json()` phải nằm TRONG cùng `try` với `fetch`.** `await fetch` chỉ
resolve khi headers về; body đọc sau. Một entry `bodyVi` dài có thể abort ngay
tại `res.json()`, và nếu chỗ đó nằm ngoài `try` thì exception thành
`"notify_failed"` → 200 → Contentful không gọi lại → bài mất bản tin. Trong
khi `claimBroadcast` còn chưa chạy, tức lượt đó thừa an toàn để xin gọi lại.

**Không phân trang bằng `skip` ở `sync-videos` nữa.** Đã thử một cửa kiểm đếm
số (`seen !== total` thì ném) và **nó không đủ**: đếm không kiểm được danh
tính — xoá `A1` rồi thêm `B` giữa hai trang thì tổng vẫn khớp trong khi `A101`
chưa từng được đọc. Đếm phần tử phân biệt cũng thế. Giờ là MỘT lượt gọi
`limit=100`, và `total > 100` thì ném kèm hướng dẫn chuyển sang con trỏ mờ.

**Draft video theo `sys.id`, KHÔNG theo `videoUrl`.** `videoUrl` là trường tuỳ
chọn, nên một entry `type: video` chưa publish và chưa điền link là hợp lệ —
lọc theo URL thì đúng những entry đó biến mất khỏi báo cáo. Và khi có draft
thiếu URL thì job **bỏ hẳn vòng tạo entry** ở lượt đó: không đối chiếu được
với feed nên `uniqueSlug` sẽ lùi sang id có `videoId` và publish một bài
TRÙNG — báo lỗi sau đó không cứu được, vì thứ tự thực thi mới là thứ quyết
định, không phải thứ tự trong báo cáo.

## Nội dung LLM, thumbnail, rebate mồ côi (01/09/2026)

**`rewriteOfferCopy` có cửa kiểm con số, đừng gỡ.** `expire-offers` publish
thẳng kết quả, không có người xem giữa hai bước — nên "ba trường không rỗng"
là không đủ. `assertFiguresAreSourced` bắt mọi số tiền `$` và mọi số ≥1000
trong bản viết phải khớp TRỌN VẸN một con số có thật trong `offerDetails` /
`annualFee` / `rebate` / `name`, cộng ba cửa riêng cho câu HOT TIP. Ném thì
thẻ vẫn rời tab elevated nhưng GIỮ `expiresAt` để lượt sau thử lại.

Bốn cái bẫy đã vấp khi dựng cửa này, đừng dựng lại:
- so bằng CHUỖI chữ số (`replace(/\D/g,"")`) làm `$1.25` bằng `$125`, và làm
  `$1,000.00` khác `$1,000` — nhận nhầm một chiều, từ chối oan chiều kia. So
  bằng GIÁ TRỊ SỐ.
- so bằng một chuỗi nguồn GHÉP rồi `.includes()` — "50,000 … $3,000" thành
  "500003000" nên số bịa "5000" khớp vắt qua ranh giới. So theo TẬP.
- `if (hotTip && …)` — câu "HOT TIP - … $150" không đọc ra số nên phép so biến
  mất, mà $150 lại là annual fee có thật. Có rebate thì BẮT BUỘC đọc ra được
  số rồi mới so.
- lookahead chặn phần dư phải là `(?!\d|[,.]\d)`, không phải `(?![\d,]|\.\d)`.
  Bản sau chặn cả dấu phẩy CÂU VĂN, nên "Earn US$1,000, when…" biến mất khỏi
  cả tập nguồn lẫn tập kiểm — hỏng cả hai chiều cùng lúc.

Cửa này CỐ Ý không bắt: số viết bằng chữ, `70K`, `200 CAD`, `%`, `x`. Mỗi lần
từ chối oan là một thẻ đỏ dai với copy đúng, nên nó là lưới bắt BỊA THÔ chứ
không phải bằng chứng mọi số đều đúng.

**Thumbnail YouTube: `maxresdefault` ở mọi nơi, `hqdefault` CHỈ làm đường lùi
`onError` trên thẻ bài.** Đã thử hạ OG/JSON-LD/RSS xuống `hqdefault` cho chắc
và ĐÃ ĐẢO LẠI: đó là 1280×720 → 480×360 cho mọi lượt chia sẻ của mọi video, để
phòng một ca đang xảy ra ở 0/15 video. Video thật sự thiếu `maxres` thì lối
thoát đã có sẵn — `coverPhoto` được ưu tiên ở cả bốn bề mặt.

**`check-rebates` báo thẻ có `rebateVi` mà `applyUrl` không trỏ `/rebates/`.**
Trạng thái đó trước đây rơi vào hai khe hở cùng lúc (vòng chính `continue`,
vòng đối chiếu cũng `continue`), nên trang in "+$200 REBATE" cho một đường
không còn trả đồng nào.

**`api/revalidate` KHÔNG tự gửi bù bản tin đã mất.** Chỉ phát hiện
(`publishedCounter > 1` + `firstPublishedAt` trong 30 phút + chưa giữ claim)
rồi log kèm slug. Mọi cách nới điều kiện gửi đều đổi một lỗi hồi lại được
(vào Kit gửi tay) lấy một lỗi không hồi lại được (gửi trùng toàn bộ
subscriber), vì chốt chống trùng duy nhất nằm trong bộ nhớ tiến trình và
không sống qua restart. Sửa thật cần một chỗ lưu bền.

## Chạy gì trước khi kết luận

```
npm run lint
npx tsc --noEmit
npm run build
npm run audit:trademarks    # thiếu ®/™
npm run audit:rebates       # số rebate lệch FinlyWealth (tài khoản ngân hàng)
npm run audit:rebate-prose  # badge rebate lệch số viết tay trong editor's take
npm run audit:awards        # bảng award
```

Bốn cái audit này bắt sẵn nhiều lớp lỗi lặp lại. Đừng báo lại thứ chúng đã bắt
được.

**`audit:rebate-prose` là bắt buộc mỗi khi đụng vào thẻ tín dụng**, kể cả khi
chỉ thêm một thẻ mới. Con số rebate nằm ở HAI chỗ trên cùng một entry — field
`rebateVi` (badge trên ảnh thẻ) và câu "HOT TIP: … nhận thêm $140 rebate."
viết tay trong `editorsTakeVi` — và tới 01/09/2026 mới có thứ canh chỗ thứ
hai. Rà tay hôm đó: 3 trong 10 thẻ có rebate đang lệch, tệ nhất là Scotiabank®
Scene+™ Visa for Students hiện badge $50 trong khi editor's take hứa $125.
Đây là tiền hứa với người đọc, và không lượt `lint`/`build` nào thấy được.

Thêm `-- --fix` để sửa thẳng vào Contentful. Script cố ý KHÔNG tự sửa hai ca:
thẻ không có `rebateVi` (không biết sửa thành số nào — nhiều khả năng link
apply vừa đổi sang thẳng ngân hàng mà câu HOT TIP nằm lại) và entry đang có
bản nháp chưa publish. Cả hai đều để lại exit 1 vì cần người nhìn.

**Chạy `audit:trademarks` SAU khi sửa xong, không phải trước.** Ngày 30/08/2026
nó bắt được hai chỗ thiếu ® nằm trong một comment JSX mới viết, ở lượt chạy sau
khi commit — vì lượt chạy trước đó diễn ra trước khi comment kia tồn tại. Nó
không phân biệt được comment JSX (`{/* … */}`) với chữ hiện trên trang, nên
trong comment JSX cũng phải viết `Amex®`, `RBC®` như mọi chỗ khác.

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
