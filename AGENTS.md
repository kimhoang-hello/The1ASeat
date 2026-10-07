# Ghế 1A — ghi chú cho agent review

Site tiếng Việt về thẻ tín dụng và điểm thưởng Canada. Next.js App Router +
Contentful. Nội dung là **tiền thật của người đọc**: sai một con số welcome
bonus hay số ngày promo là họ mất tiền.

File này dành cho agent đọc code ở đây (Codex chạy `codex exec` khởi động lạnh
mỗi lần, không nhớ gì giữa các phiên). Ghi lại để không phải tìm lại từ đầu, và
để không lặp lại những nhầm lẫn đã xảy ra.

## Không nhận xét về

- **Câu chữ tiếng Việt, giọng văn, thuật ngữ.** Có luật riêng: xưng "bạn"; giữ
  nguyên tiếng Anh các từ "transfer bonus", "welcome offer"; riêng "register"
  thì dịch thành "đăng ký" (chốt 30/08/2026, xem `src/lib/rewrite-offer.ts`); dấu
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

- **Job chạy lại khi hỏng, nên trả 500 / đỏ một lần KHÔNG đủ để một lỗi hiện
  ra.** `expire-offers` và `sync-videos` gọi route bằng `curl` qua
  `call-site-endpoint` (5 lượt, theo HTTP status). `check-rebates` từ
  09/09/2026 chạy trong runner và thử lại tối đa 3 lượt, nhưng CHỈ với lỗi
  mang cờ `retryable` — xem `isTransient()` trong `lib/job-retry.ts`.
  Lượt sau trả sạch thì job xanh và lỗi biến mất. Vì vậy mọi lỗi ghi dở phải còn *nhận ra
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
  (publish hỏng giữa chừng). Năm chỗ phải dùng chung nó: tab "Elevated offers",
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
  revalidate chứ không chạy lại hàm đó, nên `check-rebates` (chạy hai lượt mỗi
  ngày, đọc bản published) canh lượt thứ hai và đỏ dai cho tới khi có người đổi
  slug.
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
  `newsletter_subscribed` kèm `newsletter_source` (KHÔNG phải `source`, xem mục 20/09) SAU khi `res.ok`. Không có số thì cả
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

## Vòng kiểm toàn diện 02/09/2026 — đừng đề xuất lại

Mọi gate xanh trước khi bắt đầu (lint, tsc, build, 4 audit, `npm audit` 0 lỗ
hổng), nên vòng này soi những chỗ gate KHÔNG với tới. Ba phát hiện, đã vá cả
ba; hai cái đầu do vòng phản biện của Codex bác lại bản vá đầu tiên mới ra được
hình dạng cuối.

- **`listEntries` (CMA) dùng CON TRỎ MỜ, không dùng `skip`.** Phía CDA đã bỏ
  `skip` từ lâu vì entry rơi khỏi tập kết quả giữa hai lượt lấy làm những entry
  sau dồn lên và vài cái bị nhảy qua — nhưng phía CMA vẫn còn `skip` đúng cái
  hình dạng đó. Ở đây hậu quả nặng hơn: entry bị nhảy qua là một offer hết hạn
  không được gỡ hoặc một thẻ không được đối chiếu rebate, mà job vẫn trả 200.
  Đã đo trên chính space này với `limit=2` và đúng filter
  `fields.expiresAt[lte]` của `expire-offers`: `pages.next` khoá sẵn filter ban
  đầu trong token nên trang 2 không mất filter, và tập kết quả trùng khít với
  `skip`. Chế độ cursor KHÔNG trả `total` — điều kiện dừng là `pages.next` vắng
  mặt, đừng thay lại bằng phép đếm. Chưa loại nội dung nào chạm 100 entry
  (25 thẻ / 38 bài / 4 bonus), nên đây là vá trước khi cháy.

- **Mọi lượt gọi CMA đi qua `cmaInit`, kể cả lượt nằm ngoài `contentful-cma.ts`.**
  `unpublish` trong `expire-offers` gọi `fetch` trần và đã bị bỏ sót ở bản vá
  đầu — vòng phản biện bắt được. Bỏ sót đúng một lượt là đủ để job treo tới lúc
  `curl --max-time 300` cắt, mà `--retry 3 --retry-all-errors` nghĩa là 15 phút
  không xử lý được gì. Cùng lý do `fetchPage` trong `lib/finlywealth.ts` có
  `AbortSignal.timeout`: `check-rebates` duyệt thẻ TUẦN TỰ, nên một trang mở
  kết nối rồi im giữ luôn cả vòng lặp và mọi thẻ sau nó không được kiểm.
  Timeout ném `DOMException` tên `TimeoutError` — vẫn là `Error`, nên các nhánh
  `catch` sẵn có xử lý đúng, và `expire-offers` vẫn GIỮ `expiresAt` vì timeout
  rơi vào nhánh `retryable`.

- **`isSafeHref` xác nhận link nội bộ BẰNG CÁCH GIẢI URL, không bằng ký tự đầu.**
  Chuẩn WHATWG coi `\` ngang hàng `/` ở vị trí này, nên `/\finlywealth.com/r/x`
  qua được cửa `^[/#?]` cũ rồi đi thẳng ra ngoài — `relForUrl` chỉ khớp
  `^https?://` nên trả `null`, tức link referral ra site không `sponsored`,
  không `target="_blank"`, tracker không đếm. Bản vá đầu là regex
  `^[/\\]{2}`; vòng phản biện chỉ ra nó chỉ bịt thêm một ký tự và lần sau chuẩn
  thêm ký tự tương đương là hở tiếp. Bản cuối giải trên gốc `.invalid`
  (TLD dành riêng, RFC 2606) rồi đòi host không đổi — mọi hình dạng lén đổi
  host đều lộ, không cần biết viết bằng ký tự nào. `/\ghe1a.com/noi-bo` bị coi
  là NGOÀI và biến thành chữ trần: đúng ý đồ, nó chỉ nội bộ do trùng host, và
  mất một cái link thì thấy ngay còn giữ lại thì hỏng thầm lặng.

### Đã kiểm và KHÔNG phải lỗi (đừng báo lại)

- **2 thẻ CIBC® trỏ thẳng `cibc.com`, không qua FinlyWealth** — không phải chỗ
  quên gắn affiliate. Sitemap FinlyWealth có 58 trang `/rebates/credit-cards/`
  và KHÔNG có trang nào cho Aventura®, Aeroplan®, Avion® hay Wealthsimple; 11
  thẻ đang trỏ `/credit-cards/rewards-calculator/` cũng vì lý do đó. Chúng nhận
  `PLAIN_REL` (không `sponsored`) là đúng — công bố quan hệ trả tiền không tồn
  tại cũng là một kiểu nói dối. Click vẫn đo được: `ApplyLink` bắn
  `apply_clicked` bất kể `rel`; chỉ `AffiliateClickTracker` (link trong thân
  bài) mới lọc theo `rel~="sponsored"`.
- **`sync-videos` chỉ thấy 15 video gần nhất của RSS.** Job ngừng chạy đủ lâu
  để kênh đăng quá 15 video thì những cái cũ hơn không bao giờ được tạo entry,
  và lượt sau vẫn xanh. Biết là có; kênh đăng vài video một tháng còn job chạy
  6 tiếng một lượt, nên chưa đáng dựng đường lấy bù.
- **Ngày 01/09/2026 ba job trả 500 suốt ~12 tiếng** (sync-videos 03:31 và 11:04
  UTC, expire-offers 08:03, check-rebates 08:44) rồi tự khỏi ở lượt deploy kế
  tiếp. KHÔNG phải hang: 500 trả về trong ~0.5s. `/api/offer-snapshot` (đọc
  CDA) chạy tốt lúc 09:04 giữa cửa sổ đó, nên site không sập — chỉ ba route đi
  qua CMA hỏng. Token CMA hiện đọc được bình thường, không entry nào lệch
  draft. Nếu tái diễn: so nhánh CDA với nhánh CMA trước, đừng đoán site sập.

## Lượt audit định kỳ 02/09/2026 (chạy tay lần đầu) — đừng đề xuất lại

- **`qs` bị ghim `6.16.0` trong `overrides`.** Nó vào qua `contentful` →
  `contentful-sdk-core`; bản `6.15.3` nằm trong dải dính hai advisory. Sáng
  cùng ngày `npm audit` còn sạch, chiều đã đỏ — nên đừng ngạc nhiên khi một
  lượt audit đỏ mà code không đổi gì. Ghim bằng `overrides` chứ không nâng
  `contentful`, cùng cách đã làm với `postcss`/`sharp`/`nanoid`.

- **`entryExists` trong `sync-videos` dùng `fetchWithRetry`, hai lượt PUT thì
  KHÔNG.** Khác biệt là đọc với ghi, không phải quên. GET không ghi gì nên chạy
  lại vô hại, và một cái 429/503 thoáng qua mà làm đỏ cả job là lãng phí đúng
  ba lượt thử đã có sẵn. Hai lượt PUT tạo/publish chỉ chạy một lượt và chỉ được
  thêm `AbortSignal`: publish mang `X-Contentful-Version`, nên chạy lại sau một
  lượt publish thành công mà hỏng ở đường trả lời sẽ nhận 409 — job đỏ và cần
  người nhìn, đúng ý. Đừng "thống nhất" ba chỗ này thành một.

- **`applyUrl` được gác NGAY LÚC MAP ENTRY (`safeApplyUrl`), trả `undefined`.**
  Ô nhập Contentful là chuỗi tự do và giá trị này đi thẳng vào `href` nút Apply
  cùng JSON-LD, không qua cửa nào — khác link thân bài vốn đã có `isSafeHref`.
  `audit:health` cũng bắt ca này nhưng là hậu kiểm: entry publish lúc 10 giờ
  sáng vẫn sống trên site tới lượt audit sau.
  **TUYỆT ĐỐI KHÔNG trả chuỗi rỗng.** Bản vá đầu làm thế và vòng phản biện bác:
  `href=""` giải ra chính URL trang đang đứng, nên với `target="_blank"` người
  đọc bấm Apply là mở lại đúng trang đó ở tab mới, `apply_clicked` vẫn bắn (số
  đo doanh thu đếm một cú bấm không có thật), và JSON-LD in `"url": ""`. Đó là
  hỏng thầm lặng — đúng thứ cửa này sinh ra để chặn. `undefined` bắt trình biên
  dịch chỉ ra đủ 5 chỗ render, và cả 5 nay đều không vẽ nút khi thiếu link.
  Kiểu `CreditCardOffer.applyUrl` vì vậy là OPTIONAL; đừng ép lại thành `string`.
- **`applyOverlay()` trong `card-image.tsx` tồn tại vì JSX, không vì thẩm mỹ.**
  Union `ApplyOverlay` bắt "có link thì bắt buộc có `placement` + `product`",
  nhưng viết `{...(url ? {…} : {})}` thẳng trong JSX thì TypeScript làm phẳng
  thành ba prop optional rời nhau và không còn khớp nhánh nào. Helper khai báo
  kiểu trả về là chính union đó nên chỗ gọi khỏi ép kiểu. Đừng thay lại bằng
  spread có điều kiện, cũng đừng nới union thành ba prop optional.

- **`plusDays` trong `audit:health` cộng trên NGÀY TORONTO, neo giữa trưa UTC.**
  Bản đầu cộng vào `new Date()`, mà sau 20:00 giờ Toronto thì UTC đã sang hôm
  sau — cửa sổ "sắp hết hạn trong 7 ngày" âm thầm rộng thành 8. Audit chạy 9
  giờ sáng nên chưa dính, nhưng một cái audit nói sai về ngày thì hỏng đúng thứ
  nó đo. Neo giữa trưa để phép cộng không rơi trúng mốc đổi giờ.

### Việc còn nợ: `request.json()` trong `api/revalidate` không có hạn giờ

Đây là lượt chờ DUY NHẤT trong route không chịu ngân sách 25s. Chuỗi mất bản
tin: bài `post` publish lần đầu → purge CDN xong → body webhook tới chậm nên
route kẹt ở `request.json()` → Contentful bỏ cuộc vì hết giờ → Kit chưa từng
được gọi → `publishedCounter` đã qua 1 vĩnh viễn nên publish lại cũng không
cứu. Trả 502 ở nhánh đó AN TOÀN — tới điểm ấy chưa giành `broadcastClaims`,
chưa gọi Kit lần nào, nên webhook gọi lại không thể sinh bản tin thứ hai
(purge chạy lần hai là idempotent).

**Đã thử vá bằng `Promise.race` và ĐÃ GỠ RA.** `Promise.race` không huỷ lượt
đọc thua cuộc: body vẫn tiếp tục được buffer, vẫn giữ kết nối, và một lượt
`JSON.parse` lớn chặn event loop có thể làm timer chưa kịp chạy. Đổi một lỗi
hiếm lấy một đường rò tài nguyên trên chính route gửi email thật là lỗ vốn.

Hình dạng đúng: đọc `request.body` bằng reader có trần byte và trần thời gian,
**gọi `reader.cancel()` khi hết giờ**, phân biệt `payload_timeout` với
`no_payload` rồi trả 502. Hoặc rẻ hơn: cấu hình transformation ở chính
Contentful để webhook chỉ gửi những field route dùng (`sys.id`, content type,
`type`, `categoryVi`, `titleVi`, `excerptVi`, `slug`), lúc đó body nhỏ tới mức
câu hỏi biến mất. Chưa chốt `PAYLOAD_MS` bao nhiêu là an toàn vì chưa đo body
thật. Việc này cần một phiên riêng, không làm kèm.

## Vòng review phiên 04/09/2026 — đừng đề xuất lại

Codex rà lại 3 commit của phiên trước (`3109820`, `e1b1f21`, `c39b07c`) trên
HEAD đã có thêm 6 commit của phiên khác. Nó xác nhận phần lớn đứng vững —
cursor CMA, 5 bề mặt render `applyUrl`, ngữ nghĩa retry của `sync-videos`, biên
ngày của `audit:health` — và tìm ra hai chỗ còn hở. Cả hai đã vá.

- **`safeHref` trả CHUỖI, không trả `boolean`** (`lib/content/contentful.ts`).
  Đây là lần thứ BA cùng một lớp lỗi ở đúng chỗ này: khoảng trắng đầu chuỗi,
  rồi `/\host`, giờ tới ký tự điều khiển. Bản cũ lọc ký tự điều khiển để duyệt
  scheme rồi in chuỗi THÔ ra `href`, nên `"http\ns://finlywealth.com/r/x"` qua
  được cửa, mà `relForUrl` (khớp `^https?://` trên chuỗi thô) trả `null` — link
  referral ra site không `sponsored`, không `target="_blank"`,
  `AffiliateClickTracker` không đếm, còn trình duyệt vẫn cắt ký tự điều khiển
  và đi thẳng tới FinlyWealth. Đo được ba hình dạng: `\n`, `\t`, `\r` chèn giữa
  scheme.
  Vì lặp ba lần nên cửa không còn trả lời "có/không" nữa — nó trả về ĐÚNG chuỗi
  phải in, và `href` lẫn `relForUrl` dùng lại chính chuỗi đó. Đừng đổi ngược về
  `boolean`, và đừng dùng lại biến `uri` thô sau khi đã gọi nó.
  Lưu ý khi tự viết phép kiểm: `mailto:`/`tel:` KHÔNG cần `rel` — chúng mở ứng
  dụng khác chứ không phải trang web ra ngoài. Một bài kiểm chỉ so
  "có bắt đầu bằng https://ghe1a.com không" sẽ báo nhầm chúng là rò.

- **`scripts/audit-rebate-prose.mts` là đường CMA cuối cùng còn dùng `skip` và
  chưa có hạn giờ.** Vòng trước đã vá `lib/contentful-cma.ts` nhưng script này
  mang plumbing riêng nên lọt. Nó có `--fix` GHI THẲNG vào Contentful, nên một
  thẻ bị nhảy qua là con số rebate sai nằm lại trên site mà lượt chạy nào cũng
  báo sạch. Nay dùng con trỏ mờ và `AbortSignal` cho cả lượt đọc lẫn hai lượt
  ghi. Đã đối chiếu: vẫn ra đúng 25 thẻ như bản `skip`.

## Vòng kiểm toàn diện 05/09/2026 — đừng đề xuất lại

Mọi gate xanh trước khi bắt đầu. Codex rà 6 nhóm file rủi ro cao nhất, ra 7
phát hiện; 3 phát hiện High đã vá, vòng phản biện thứ hai xác nhận cả ba ĐÚNG
và không hồi quy. 4 phát hiện Medium còn lại CHƯA vá — ghi ở đây để lần sau
không tìm lại từ đầu.

**Đã vá:**

- **Newsletter chèn thẳng `uri` từ rich text, không qua `safeHref`**
  (`lib/subscriber-email.ts`). Thân bài trên web đã được hardened ba lần
  (`javascript:`, khoảng trắng đầu, `/\host`, ký tự điều khiển — xem các mục
  29/08 và 04/09 ở trên), nhưng `renderPostBodyForEmail` là một
  `documentToHtmlString` RIÊNG, không đi qua cùng cửa — chỉ escape HTML entity.
  Một link `javascript:…` trong thân bài sẽ được gửi nguyên vẹn tới toàn bộ
  subscriber qua Kit, không rút lại được. Vá bằng cách **export `safeHref`**
  từ `lib/content/contentful.ts` và dùng lại chính nó (cùng chuỗi cho `href`
  lẫn `relForUrl`, đúng nguyên tắc "ba cách đọc không được lệch nhau" đã ghi
  ở trên) thay vì viết một bản kiểm riêng ở `subscriber-email.ts`.

- **`expire-offers`: vòng thẻ tín dụng thiếu cửa chặn "chưa từng publish"**
  mà vòng transfer bonus NGAY BÊN DƯỚI trong cùng file đã có
  (`if (!bonus.sys.publishedVersion) continue;`). Một thẻ ở dạng draft chưa
  từng publish, mang `expiresAt` trong quá khứ (ví dụ tác giả nhân bản một
  thẻ cũ làm mẫu rồi chưa kịp sửa hạn), lọt qua truy vấn CMA và bị
  `updateEntry` PUT đè `headlineVi`/`keyBenefitsVi`/`editorsTakeVi`/`rebateVi`
  — không publish (vì `updateEntry` tự biết không publish entry chưa từng
  publish), nhưng vẫn phá nội dung tác giả đang viết dở. Vá bằng cách thêm
  đúng cửa chặn mà vòng bonus đã có, đặt trước cửa "draft ahead" hiện tại.

- **`revalidate`: `res.text()` đọc TRƯỚC khi rẽ nhánh theo `res.status`**
  khi Kit trả `!res.ok`. Nếu đọc body ném (kết nối đứt sau khi header 4xx đã
  về), toàn bộ hàm ném, rơi vào `catch` ngoài cùng thành `"notify_failed"` —
  bị xử lý như ca KHÔNG CHẮC CHẮN (giữ claim, trả 200, Contentful không gọi
  lại), trong khi 4xx đúng ra là CHẮC CHẮN CHƯA GỬI (nên phải trả claim, cho
  retry). Vá bằng cách đọc `res.status` ra biến trước, bọc riêng `res.text()`
  trong try/catch để lỗi đọc body không đổi nhánh rẽ.

**Chưa vá — biết là có, để dành vòng sau (không phải hôm nay bịa ra):**

- `sync-videos` so trùng video bằng SO CHUỖI URL thô
  (`route.ts` quanh dòng dedup) — `https://youtu.be/x` và
  `https://www.youtube.com/watch?v=x` cùng một video nhưng khác chuỗi, nên có
  thể publish trùng nếu slug sinh ra khác nhau.
- `sync-videos` coi feed 200 nhưng rỗng/hỏng cấu trúc là "không có video mới"
  (`checked: 0`) chứ không phải lỗi — một feed RSS đổi schema sẽ làm mọi video
  mới bị bỏ qua vĩnh viễn mà job luôn xanh.
- `relForUrl` đòi đúng `^https?://` (hai gạch chéo), nên link đã qua được
  `safeHref` nhưng viết dạng `https:\host/...` (gạch chéo ngược, trình duyệt
  vẫn giải đúng ra host thật) mất `sponsored` và không được `AffiliateClickTracker`
  đếm — cùng lớp lỗi normalization đã vá ba lần ở `safeHref`, nhưng lần này
  nằm ở phía `relForUrl`.
- URL transfer bonus trong Contentful là Short text, ra thẳng `href` không
  qua `isSafeHref`/`safeHref` nào — thiếu scheme (`aircanada.com/promo` thay vì
  `https://aircanada.com/promo`) sẽ thành link nội bộ 404 trên `ghe1a.com`, và
  `audit:health` hiện chỉ kiểm `applyUrl` của thẻ chứ không kiểm trường này.

**Hostinger đỏ dai lặp lại (không phải lỗi code, đã xảy ra nhiều lần):**
sáng 05/09/2026, `expire-offers`/`check-rebates`/`offer-snapshot` nhận 403 kèm
trang thách thức bot "Checking your browser…" của Hostinger, và một lượt
`sync-videos` mất kết nối cổng 443 gần 25 phút — cả hai tự khỏi ở lượt chạy
kế tiếp, site healthy ngay sau đó (200 mọi trang, header bảo mật đủ). Cùng
hình dạng đã ghi ở mục "Đã kiểm và KHÔNG phải lỗi" ngày 02/09 (500 suốt
12 tiếng) — đây là lần thứ ba, tần suất khoảng 1-3 ngày một lần. Không có gì
để vá phía code; các job đã tự retry và tự nhận ra được ở lượt sau.

## Phiên 05/09/2026 (lần hai) — ba việc mới, đừng đề xuất lại

**1. `/credit-cards` có "Sắp xếp theo".** Trang tài khoản ngân hàng có từ đầu,
trang thẻ thì không — cùng câu hỏi mà hai bộ điều khiển khác nhau. Nay cùng
hình dạng: nhãn + một ô chọn, đặt dưới hai hàng lọc.

- **KHÔNG có "Welcome bonus cao nhất", và đó là quyết định có chủ ý.** Bonus
  tài khoản ngân hàng đều là đô la nên so được; bonus thẻ thì không — tồn kho
  đang có "110,000 điểm Bonvoy®", "25,000 miles MileagePlus®", "Cashback 15%
  (tối đa $300)", "Đến $600 giá trị". Xếp 110,000 Bonvoy® trên 100,000
  Aeroplan® là nói cái trước lớn hơn, trong khi giá trị thật ngược lại. Muốn có
  tiêu chí này thì phải quy đổi qua bảng định giá — một quyết định nội dung,
  không phải một phép sắp xếp.
- **`moneyAtStart` đọc số đô ĐẦU chuỗi `annualFee`, cố ý không dùng
  `splitAnnualFee`.** Hàm kia nhận dạng hẹp để quyết định có tách phần ghi chú
  hay không, nên năm thẻ dạng `"$139/năm — miễn năm đầu (thẻ phụ: $50/năm)"`
  rơi ra ngoài và sẽ mất số. Neo `^` là bắt buộc: quét cả câu thì thẻ $139 bị
  xếp như thẻ $50 của thẻ phụ.
- `creditCardsPath` nhận thêm `sort`, nên tab và chip điểm thưởng giữ được thứ
  tự đang chọn; `?sort=rác` rơi về mặc định. `sortOffers` luôn trả BẢN SAO, kể
  cả nhánh `featured` — cùng hợp đồng với `sortAccounts`.

**2. Ô tìm kiếm biết `/bay-ve-viet-nam` và biết chuyên mục blog.** Gõ "bay về
Việt Nam" trước đây trả **0 kết quả** dù trang tổng và cả 12 trang chặng đã
công bố và đã nằm trong sitemap — không mục nào trong chỉ mục chứa đủ bốn chữ
đó, kể cả Award Flight Finder. Cùng lỗ hổng đã vá cho 29 trang tài khoản ngân
hàng hồi trước.

- Mã sân bay lấy thẳng từ `route.origin.code`; alias thành phố
  (`Saigon`, `Hanoi`, `Danang`, `TPHCM`) nằm trong `CITY_LABELS` vì
  `slugifyVi("Hà Nội")` ra `ha-noi`, mà "hanoi" viết liền không nằm trong chuỗi
  đó. Đừng "dọn" chúng đi.
- Chuyên mục blog mang `meta` = "Chuyên mục": vừa hiện dưới tiêu đề vừa được
  đem đi khớp, nên gõ "chuyên mục khách sạn" ra đúng trang lưu trữ.

**3. Bài viết về ưu đãi có hạn nói trạng thái NGAY ĐẦU BÀI.** Bài transfer
bonus Marriott Bonvoy® hết hạn 03/09/2026 vẫn nguyên như hôm đăng: không chữ
nào nói ưu đãi đã đóng, không đường nào sang thứ đang chạy.

- Ngày nằm ở `lib/post-offer-status.ts` (bảng viết tay theo slug) vì content
  model `blogPost` KHÔNG có trường ngày hết hạn. Đã thử thêm trường qua CMA
  ngày 05/09/2026 và bị chặn ở tầng quyền; nếu sau này thêm được thì
  `postOfferStatus` đọc trường đó trước và bảng này rỗng dần.
- Bảng viết tay thì mục — nên `audit:health` mục 9 đòi mọi bài **trông như bài
  ưu đãi có hạn** phải có tên trong đúng MỘT trong hai bảng
  (`POST_OFFER_DEADLINES` hoặc `POSTS_WITHOUT_DEADLINE` kèm lý do). Quên là job
  đỏ, chứ không phải trang lặng lẽ sai. Đã kiểm cả hai nhánh.
- **Dấu hiệu nhận bài ưu đãi là HAI, không phải một.** Chuyên mục "Deals" là
  quy ước của site, nhưng chỉ soi nó thì bài News/Tips nói về ưu đãi có hạn vẫn
  lọt — Codex bắt đúng chỗ này trong vòng bắt nó bác bản vá của mình. Dấu hiệu
  thứ hai đọc thân bài: một ngày viết đủ dạng dd/mm/yyyy. Đo trên 38 bài đang
  phục vụ: đúng 1 bài dính, và đó chính là bài Marriott Bonvoy® — nên dấu hiệu
  này im chứ không ồn. Đừng thu hẹp lại còn mỗi chuyên mục Deals.
- Ngày gõ hỏng thì `postOfferStatus` ẩn nhãn và audit đỏ, chứ không in
  "còn hiệu lực đến hết 2026-99-99" — `hasExpired` trả `false` cho chuỗi không
  khớp, nên nhãn sai sẽ đứng ngay đầu bài. Cửa canh dùng CHÍNH hàm mà trang
  dùng (`isOfferDeadline`), không phải một regex chép lại.
- **Nút "đi tiếp" của nhãn hết hạn rẽ theo dữ liệu thật.** Transfer bonus có
  lúc không còn cái nào (05/09/2026: đúng 0 cái đang chạy), mà câu "Xem
  Transfer Bonus đang chạy" thì hứa là có — người vừa đọc một ưu đãi đã đóng
  bấm tiếp vào một trang rỗng là đóng hai lần liên tiếp. Hết bonus thì nút dẫn
  thẳng sang `/transfer-partners`, dùng CHÍNH phép lọc `hasExpired` mà trang
  `/transfer-bonuses` dùng. Đừng đổi ngược về một href cố định.

## Trang "Các thẻ tốt nhất" (07/09/2026) — ĐÃ CÔNG BỐ

Năm URL dưới `/credit-cards/tot-nhat`: một trang tổng và bốn mục (`offers`,
`travel`, `aeroplan`, `nguoi-moi`). Nội dung do tác giả viết, dữ liệu thẻ đọc
sống từ Contentful.

**Vì sao nằm trong repo chứ không nằm trong Contentful.** Mỗi mục là một đoạn
viết tay *nói về những thẻ khác*, tức nó phụ thuộc vào entry của mười thẻ. Đặt
trong Contentful thì mối nối đó không tồn tại: đổi slug một thẻ, unpublish nó,
hay hạ welcome bonus xuống đều không làm gì đỏ cả. Trong repo thì
`assertBestCardPicksExist()` chạy lúc `next build` nên slug hỏng làm deploy đỏ,
còn `audit:best-cards` đối chiếu từng con số trong đoạn văn với chính entry mà
nó đang nói tới. Cùng cách chia vai như `award-routes.ts`.

**Ba luật khi sửa `src/lib/best-cards.ts`:**

1. **Không gõ tên thẻ vào tiêu đề mục.** `pickHeading()` lấy tên từ Contentful,
   và ở mục `bonusInHeading` thì lấy cả con số welcome bonus. `headingVi` chỉ
   ghi đè phần TÊN khi hai thẻ ghép lại quá dài, không bao giờ ghi đè con số.
2. **Không gõ ngày.** Dùng `{expiresAt}`, `resolveProse()` thay nó bằng ngày
   thật lúc render — và nếu thẻ không còn ngày hết hạn thì nó bỏ cả mệnh đề
   chứa token, không phải chỉ token (bỏ mỗi token để lại "offer kết thúc ngày
   ." trên trang). Ngày là thứ DUY NHẤT `audit:best-cards` không quét được.
3. **Con số thì gõ được, nhưng phải khớp Contentful.** Xem `audit:best-cards`
   ở mục dưới. Số không có trong Contentful phải khai `otherFiguresVi` kèm lý
   do; hiện có ba khai báo, cả ba là giá trị tự quy đổi (Free Night Award
   35,000 điểm Bonvoy®, 35,000 điểm Scene+™ × 1 cent, và một con số 70,000 dùng
   làm ví dụ Aeroplan® trên trang của thẻ TD®).

**Một chỗ đã sửa lời để audit kiểm được.** Câu gốc viết "annual fee năm đầu
bằng $0", mà Contentful viết điều đó bằng chữ ("$139/năm — miễn năm đầu") nên
phép so chuỗi không bắc cầu được. Đổi thành "annual fee năm đầu được miễn" —
cùng nghĩa, và nay nói theo đúng cách Contentful nói. Khai `otherFiguresVi`
cũng xong việc nhưng đó là một lần im lặng vĩnh viễn trên một câu về phí.

**Đoạn công bố affiliate không viết vào prose.** `OfferDisclosure` đã in đúng
câu đó ở cuối mỗi trang, lấy từ `common.disclosure` — cùng câu với footer và
với `/credit-cards`. Bản thảo của tác giả có đoạn này ở cuối từng mục; nó bị
lược đi vì component đã lo, không phải vì bỏ sót.

**Cửa vào.** Menu "Thẻ tín dụng" (trên So sánh và Ngân hàng), một dải trên đầu
`/credit-cards`, khối "Đi tiếp từ đây" của từng trang thẻ có mặt trong mục
(`categoriesFeaturing`), sitemap và ô tìm kiếm (cả bốn mục, không chỉ trang
tổng). `audit:links` ngày dựng: 143/143 trang có đường vào.

**Header viết href thẳng, không import `BEST_CARDS_BASE`.** `site-header.tsx`
là Client Component; import file đó kéo cả bốn đoạn văn vào bundle của MỌI
trang chỉ để lấy một chuỗi. Cùng lý do đã ghi cho `bay-ve-viet-nam`.

## Vòng Codex cho "Các thẻ tốt nhất" (07/09/2026) — đừng đề xuất lại

Bảy chỗ đã sửa theo Codex, hai chỗ cố ý không sửa.

**Lỗi nặng nhất Codex bắt được, mình đã bỏ sót:** trang không hiện trong menu
DESKTOP. Link được thêm vào `cardExtraLinks`, nhưng `TypeDropdown` của desktop
nhận `groupLinks`/`extraLinks` chứ không nhận biến đó — chỉ menu mobile dùng
nó. Cửa vào chính của cả tính năng mất trên máy tính để bàn, mà `build`,
`lint`, `tsc` và cả `audit:links` đều xanh (audit chỉ hỏi "có ai trỏ vào
không", và dải trên `/credit-cards` đã trả lời có).

Đã sửa, kèm theo:

- `NavLink.matchPrefix` + `isNavLinkActive()`: dòng menu mặc định so ĐÚNG
  đường dẫn (thứ giữ cho "Thẻ tín dụng" không sáng cạnh "Ngân hàng"), riêng
  mục này so cả trang con. Trước đó, đứng trên một trang mục thì menu mở ra mà
  không dòng nào sáng — dòng cha bị `cardsRowActive` tắt, dòng con so đúng nên
  trượt. So bằng `${href}/` chứ không `startsWith` trần: thẻ slug
  `tot-nhat-khac` sẽ bị nhận nhầm là trang con.
- `resolveProse` bỏ CẢ CÂU chứa `{expiresAt}`, không cắt mệnh đề bằng regex.
  Regex cũ dừng ở dấu phẩy, mà dấu phẩy còn là dấu phân cách hàng nghìn: câu
  "offer 110,000 điểm kết thúc ngày {expiresAt}." bị cắt từ trong "110,000" và
  để lại "offer 110." trên trang. Đổi lại là một luật cho người viết — câu chứa
  token phải đứng riêng.
- `resolveProse` còn kiểm `hasExpired()`, không chỉ kiểm ngày có tồn tại.
  `expire-offers` cố ý giữ `expiresAt` khi lượt viết lại copy hỏng, nên một
  ngày chết vẫn nằm trong dữ liệu; `CardBadges` giấu nó từ lâu, và nếu đoạn văn
  ngay bên dưới vẫn in "offer kết thúc ngày 31/08/2026" thì hai chỗ trên cùng
  một màn hình nói hai điều khác nhau.
- `pickOffers` trả TẤT CẢ hoặc KHÔNG GÌ CẢ. Bỏ qua thẻ thiếu sẽ vẽ ra một mục
  nói "cả hai thẻ" nhưng chỉ hiện một. Trang tổng cũng đếm thẻ dựng được thật,
  không đếm cấu hình, để hai chỗ nói cùng một con số.
- JSON-LD liệt kê MỌI thẻ trang vẽ ra và dùng `creditCardJsonLd()`. Đếm theo
  mục thì trang `offers` khai 5 item cho 7 thẻ.
- `lastmod` của năm URL lấy ngày mới nhất trong SỐ THẺ CHÍNH MỤC ĐÓ nhắc tới,
  không phải ngày thẻ mới nhất của cả site.
- Lượt canh slug `tot-nhat` thêm vào `/api/check-rebates`, cạnh lượt canh
  `so-sanh` đã có — cùng cửa hậu: thẻ publish SAU khi deploy xong thì
  `generateStaticParams` không chạy lại.
- `audit:best-cards` nay chỉ là vỏ; phép so nằm trong `bestCardsProseDrift()`,
  và `/api/check-rebates` gọi nó hai lượt mỗi ngày. Đây là câu trả lời cho
  "audit chạy tay thì phải có người nhớ mà chạy": runner của Actions không có
  token Contentful, còn server thì có.
- `OfferFacts` thay cho `as CreditCardOffer` trong script — ép kiểu một object
  thiếu nửa số field là tự tắt TypeScript đúng chỗ nó đang canh giúp.

**Codex sai một chỗ, đừng áp lại.** Nó đề nghị mọi con số trong đoạn văn của
một pick ghép phải khớp MỌI thẻ (`every`). Áp vào thì ba câu viết chuẩn nhất
báo đỏ, vì chính chúng đem hai thẻ ra SO với nhau: "bản Gold chỉ đòi thu nhập
hộ gia đình $15,000, trong khi bản Infinite yêu cầu $60,000" — hai con số đó,
theo định nghĩa, mỗi con thuộc về một thẻ. Cái Codex thật sự chỉ đúng là câu
"cả hai thẻ này đều…", và nó nay được canh riêng bằng `sharedFiguresVi`: người
viết khai con số nào là lời hứa về cả hai, audit đòi con số đó có mặt ở mọi thẻ
trong pick. Mặc định vẫn là "một thẻ khớp là đủ".

**Hai chỗ cố ý không sửa:**

1. **Audit bỏ qua số nhỏ, tỷ lệ và multiplier** (`6 lượt lounge`, `30% transfer
   bonus`, `1.25X`, `180 ngày`). Bắt chúng thì mỗi đoạn văn đẻ ra mươi khai báo
   `otherFiguresVi` cho những thứ không đổi, và một audit đòi khai báo cho hằng
   số thì người ta khai bừa cho xong — lúc đó nó không còn canh được cả ba thứ
   THẬT SỰ đổi hằng tuần (welcome bonus, annual fee, rebate), vốn đều mang dạng
   `$X` hoặc `X,XXX`.
2. **`offerHaystack` gộp mọi field của một thẻ.** Về lý thuyết, annual fee đổi
   thành `$150` mà một dòng key benefit còn chữ `$120` thì câu "annual fee $120"
   vẫn xanh. Muốn chặn phải gán từng con số vào từng field, tức bắt người viết
   khai "con số này nói về annual fee" — đắt hơn nhiều so với xác suất trùng
   ngẫu nhiên đó. Ghi lại đây làm giới hạn đã biết.

## Khối thẻ trong thân bài viết (07/09/2026)

Bài viết nhắc tới một thẻ có trên site thì ngay dưới đoạn đó hiện khối thẻ —
cùng component `CardSpotlight` với bốn trang "Các thẻ tốt nhất". Không ai đặt
tay: `cardMentionsInPost` nhận ra tên thẻ trong thân bài LÚC RENDER, nên bài cũ
cũng có, và mọi con số luôn là số của hôm nay chứ không phải số ngày đăng bài.

**`bodyBlocks` là thứ làm việc này khả thi.** Thân bài từ Contentful là rich
text, render ra một chuỗi HTML rồi bơm bằng `dangerouslySetInnerHTML` — không
chèn được React vào giữa. Nay `lib/content` render TỪNG khối cấp cao nhất
thành một chuỗi riêng (`BlogPost.bodyBlocks`), còn `body` là các khối đó nối
lại. Đã đo trên cả 40 bài, 390 khối: nối lại KHÔNG lệch một byte so với cách
render cả tài liệu. Cắt chuỗi HTML đã render bằng regex là cách kia, và nó vỡ
ngay khi `</p>` nằm lồng trong blockquote hay list.

**Bảng bí danh chỉ nhận tên CHỈ CANADA MỚI CÓ.** Luật này sinh ra từ một false
positive đo được: bí danh `"amex gold"` khớp câu "Nếu có US credit card thì
options khá nhiều như Amex Gold, Chase Sapphire Preferred…" và dựng khối
American Express® Gold Rewards Card của Canada kèm nút Apply affiliate Canada —
CTA cho đúng sản phẩm mà câu văn không nói tới. Nên Amex® Gold, Amex® Platinum,
Amex® Green và các thẻ Marriott Bonvoy® KHÔNG có bí danh ngắn; chúng chỉ khớp
khi bài viết trọn tên. Bỏ sót một khối thì không ai thiệt, gắn nhầm thẻ thì có.

**Độ phủ thật, đo ngày 07/09/2026: 6/40 bài, 9 khối.** Con số nhỏ là đúng —
phần lớn bài viết nói về chương trình điểm chứ không về một tấm thẻ. Chạy
`npm run audit:card-mentions` để xem lại bất cứ lúc nào; nó cũng in ra thẻ nào
chưa có bí danh (19/34) và đỏ khi bí danh trỏ tới thẻ không còn tồn tại.

**Công bố affiliate in NGAY TRONG BÀI** khi bài có khối thẻ. Trước đây bài viết
chỉ dựa vào footer, và như vậy là đủ khi link affiliate trong bài là chữ do tác
giả viết. Khối thẻ đổi điều đó — nó là một CTA to đúng bằng cái trên trang thẻ,
và mọi bề mặt khác có nút Apply đều in `OfferDisclosure` cạnh nút.

**Một chỗ đã sửa vì `Map` nuốt dữ liệu:** bản đầu dựng
`new Map(mentions.map(m => [m.afterBlock, m.card]))`, nên một đoạn nhắc hai thẻ
liền nhau có hai mention cùng `afterBlock` và thẻ sau đè thẻ trước. Đo được
trên nội dung thật: 2 trong 10 khối biến mất, ở hai bài khác nhau. Nay mỗi chỗ
chèn giữ một MẢNG thẻ.

## Vòng Codex bác bỏ bản vá (07/09/2026) — đừng đề xuất lại

Vòng hai: bắt Codex bác chính bản vá nó vừa yêu cầu. Kết quả 2 ĐÚNG, 6 "bản vá
hỏng"; bốn cái sửa, hai cái không.

- **Đã sửa — `resolveProse` không tách câu bằng regex nữa.** `split(/(?<=\.)\s+/)`
  vỡ với viết tắt: "Áp dụng tại TP. Hồ Chí Minh, offer kết thúc {expiresAt}."
  tách ngay sau "TP." nên chỉ nửa sau bị bỏ, để lại một câu cụt. Nay cắt tại
  dấu chấm cuối cùng trước token, và `assertExpiryTokenIsLast()` (chạy lúc
  build) ép token phải nằm ở câu CUỐI đoạn — phép cắt không còn phải hiểu câu
  là gì.
- **Đã sửa — trang mục không còn thẻ nào thì `notFound()`.** Trước đó vẫn render
  đoạn mở đầu và đoạn kết, mà đoạn kết gọi tên và nhắc con số của chính những
  thẻ vừa bị loại.
- **Đã sửa — `sharedFiguresVi` so với `volatileHaystack`** (welcome bonus,
  annual fee, rebate) chứ không so với cả entry. Con số cũ còn sót trong
  headline của thẻ vừa bị hạ đủ giữ audit xanh, tức trượt đúng ca sinh ra nó.
- **Đã sửa — `containsFigure` lùi qua khoảng trắng.** "$ 70,000" có dấu cách
  nên con số trần "70,000" vẫn khớp vào một con số tiền, phá bất biến đã ghi.
- **Không sửa — `/bank-accounts/[slug]` không sáng dòng nào trong menu mobile.**
  Có thật, nhưng CÓ TỪ TRƯỚC và không phải hệ quả của bản vá này. Thêm
  `matchPrefix` cho dòng Ngân hàng KHÔNG phải một dòng sửa: `/bank-accounts` khi
  đó cũng sáng trên `/bank-accounts/so-sanh`, mà trang đó đã có dòng riêng —
  thành hai dòng sáng cùng lúc, đúng cái lỗi phép so đúng đang chặn.
- **Không sửa — `headingWords` nối tên hai thẻ rồi so.** Thẻ thứ hai đổi
  Visa → Mastercard mà thẻ đầu vẫn có "Visa" thì heading cũ lọt. Muốn bắt thì
  phải biết từ nào thuộc thẻ nào, mà tiêu đề cố ý viết tắt ("CIBC® Aventura®
  Visa Infinite* / Gold Visa*" bỏ chữ "Card"). Phép kiểm vẫn bắt được ca chính
  — chữ trong tiêu đề không có trong tên thẻ NÀO. Ghi lại làm giới hạn đã biết.

## Mục Thẻ Mỹ `/us-credit-cards` (21/09/2026) — CÔNG BỐ BẢN BETA 30/09/2026

Cờ `US_CARDS_PUBLISHED` bật 30/09/2026 theo yêu cầu tác giả, giữ nhãn Beta. Link
ref (29/09): Chase® cá nhân chỉ phủ Sapphire Preferred®/Reserve®, Chase® doanh
nghiệp phủ bốn thẻ Ink + Sapphire Reserve for Business℠, Capital One® phủ
Venture X/Venture — thẻ khác giữ link công khai (`sourceUrl` giữ trang sản phẩm
khi `applyUrl` là link ref). Các đoạn bên dưới viết lúc cờ còn tắt.

**Thêm 01/10/2026: bốn thẻ IHG® + thẻ Aeroplan® của Chase®** (41 thẻ, 38 đang hiện).
Chase® đổi cả dòng thẻ IHG® đúng ngày này: thêm Premier Select ($350 USD), Traveler
đổi tên thành "IHG® One Rewards Credit Card", Premier Business thành "IHG® One
Rewards Business Credit Card" (slug cũ redirect 308 trong `next.config.ts`).
Offer ra mắt chỉ có trên trang `/a1/ihg/*` (trang sản phẩm cũ còn số cũ vài giờ đầu)
nên `applyUrl` trỏ về đó; cả bốn ghi "Apply by 11/18/2026" → elevated, hạn chung
`IHG_LAUNCH_OFFER_ENDS`. Ảnh thẻ mới chỉ có 254–500px. Thẻ Aeroplan® ghi "OUR BEST
OFFER EVER" (gạch mức thường 60,000) mà không có ngày → tác giả xác nhận là
elevated, dùng `offerEndUnannounced` như Capital One® Venture — mỗi lượt rà phải mở
lại trang, mất chữ gạch/"best offer" thì tắt tay. Cùng ngày tác giả xác nhận Sapphire Reserve® for Business cũng elevated ("OUR BEST OFFER RETURNS", gạch 150,000 → 200,000, không ngày) → cùng cách. Rà Amex® cùng ngày: Business Green ghi "Special Welcome Offer, previously 15,000, now 25,000", không ngày (điều khoản cũng không) → cùng cách; bonus hai nấc nên `welcomeBonus`
ghi nấc đầu (75,000 ↔ $4,000 USD) kèm "(tổng tới 115,000)". Hai câu "nhất" đã sửa:
Amex Platinum (nấc hai thẻ Aeroplan® đòi $20,000 USD) và Sapphire Reserve® for
Business (Premier Select cũng 200,000 điểm).

**Canh offer thẻ Mỹ (30/09/2026).** Hai tầng, vì chỉ Chase® và Bilt in offer vào
HTML mà `fetch` đọc được — American Express®, Capital One®, Bank of America®,
Citi® dựng số bằng JavaScript (đo 30/09):
- `npm run audit:us-offers` (`scripts/check-us-offers.mts`), chạy hằng ngày bởi
  `check-us-offers.yml`. CHỈ BÁO, không sửa, không push. Đỏ khi: offer đã qua
  `expiresAt`; con số trên site không còn trên trang Chase®/Bilt (bonus phải đi
  liền "spend $X" đúng mức chi — con số trần còn xuất hiện ở thẻ quảng cáo
  chéo); hoặc `verifiedOn` cũ hơn 21 ngày. Job đỏ ở đây là tín hiệu có chủ ý.
- Task cục bộ `ghe-1a-canh-offer-the-my` (T2 + T5, 9:23) mở trang ngân hàng bằng
  browser, sửa `us-credit-cards.ts`, đặt lại `verifiedOn`, commit + push. Đây là
  bên duy nhất SỬA số liệu thẻ Mỹ. Task không chạy (app đóng) quá 21 ngày thì
  job hằng ngày tự đỏ vì quá hạn đối chiếu.

**Rà sau công bố (30/09/2026).** Mở lại trang ngân hàng của cả 33 thẻ đang
hiện: 32 thẻ khớp bonus + mức chi + annual fee (`verifiedOn` = `REVERIFIED`),
Citi Strata Premier® vẫn không đọc được số. Ba link ref còn phủ đúng nhóm thẻ —
trang ref Chase® doanh nghiệp chỉ hiện 2 thẻ ở khung hẹp, phải mở ≥1440px mới
thấy đủ 5. Đã sửa:
- **Câu so sánh tuyệt đối trôi khi thêm thẻ.** Viết lúc mục có 9 thẻ ("cao nhất
  trong ba thẻ Chase®", "mức chi cao nhất trong các thẻ ở đây", "thẻ doanh
  nghiệp rẻ nhất hệ Membership Rewards®", "annual fee thấp nhất nhóm hãng bay")
  rồi sai dần khi lên 36. Thêm/ẩn thẻ thì grep "nhất" trong `US_CARD_DATA` và
  đối chiếu lại với các thẻ đang hiện — không audit nào bắt loại này.
- Atmos™ Business: trang doanh nghiệp của Bank of America® GHI "No international
  transaction fees" → `NO_FTF`; chỉ Ascent còn `BOA_FTF_UNKNOWN`.
- JSON-LD `CreditCard.image` của thẻ Mỹ là đường dẫn tương đối (`/images/…`) →
  nay tuyệt đối. Meta description trang chi tiết dùng `creditCardMetaDescription`
  như thẻ Canada (trước đó 24/33 trang dưới 110 ký tự).

Làm tiếp cùng ngày theo yêu cầu tác giả:
- **Link nội bộ.** 33 trang chi tiết từng chỉ có MỘT đường vào (trang tổng). Nay
  mỗi trang có hai khối anh em lấy theo vòng (`usCardSiblings`: cùng loại điểm,
  cùng nhóm lọc) — test `test:us-cards` đòi mỗi thẻ ≥2 trang thẻ khác trỏ vào.
  Trang tổng thêm cửa từ bốn bài hướng dẫn (`PostNextSteps`, thay link chung về
  thẻ Canada), cuối `/credit-cards` và cạnh "xem tất cả" ở trang chủ. KHÔNG thêm
  vào `/bat-dau`: lộ trình người mới, còn thẻ Mỹ đòi US credit history.
  `ringAfter` chuyển sang `src/lib/ring.ts` để file dữ liệu vẫn import trần được.
- **Ảnh Atmos™** thay bằng ảnh gốc 3000–3840px trên alaskaair.com (cắt thẻ ra
  khỏi ảnh nền, bo góc bằng sharp) → 960px. **Ảnh Chase® vẫn 289px**: trang
  Chase® (kể cả rendition gốc trong DAM và trang ref) chỉ có cỡ đó; marriott.com
  có ảnh 1920px nhưng là THIẾT KẾ KHÁC với trang Chase® — đừng dùng.
- **SỰ CỐ 30/09 tối: cả 33 trang thẻ Mỹ 404.** `dynamicParams = false` + ISR:
  sau `revalidatePath("/", "layout")` (webhook Contentful, mọi lần publish)
  Next 16.3 dựng lại các trang đó thành 404 và CACHE bản 404 (`x-nextjs-cache:
  HIT`) tới lần deploy sau; trang danh sách vẫn sống. Đã bỏ cờ, thẻ ẩn/slug lạ
  vẫn 404 nhờ `notFound()`. Đừng đặt lại `dynamicParams = false` trên trang có
  `revalidate`. Tái hiện cục bộ: route tạm gọi `revalidatePath("/", "layout")`
  rồi gọi lại trang (KHÔNG gọi `/api/revalidate` thật — nó purge CDN và có thể
  gửi email). `audit:links` trên production bắt được lỗi này (link hỏng).
- **Mục Elevated** dùng `UsCardElevated` (ảnh nhỏ, tên, bonus, hạn): mọi thẻ ở
  đó còn hiện lại ở danh sách đầy đủ. 375px: danh sách bắt đầu ở 3,438px thay
  vì 7,507px.

Mục riêng cho người Canada muốn mở thẻ US. Cờ `US_CARDS_PUBLISHED` (bật từ 30/09/2026; khi tắt: trang
vào được bằng URL, `noindex`, dải báo nháp; bật cờ là hiện "🇺🇸 Thẻ Mỹ" trên menu
(desktop + mobile), vào sitemap và ô tìm kiếm).

- **Dữ liệu nằm trong repo** (`src/lib/us-credit-cards.ts`), không ở Contentful.
  Thẻ Mỹ mang đúng kiểu `CreditCardOffer` (`country: "US"`) + khối `us`, nên dùng
  lại nguyên `CardImage`/`CardBadges`/`OfferStats`/`EditorsTake`/`ApplyButton`,
  nhưng KHÔNG BAO GIỜ đi qua `getCreditCardOffers()` — trang Canada, so sánh,
  gợi ý, best-cards, sitemap thẻ Canada không phải học cách lọc chúng ra.
- **Số liệu:** 36 thẻ, tất cả đối chiếu trực tiếp với trang ngân hàng
  (`verifiedOn`): 9 thẻ 21/09, 7 thẻ 23/09, phần còn lại 24/09/2026 theo yêu
  cầu "thêm tất cả thẻ theo hệ điểm" — Chase® (UR + Bonvoy + Hyatt),
  American Express® (MR + Bonvoy + Hilton, ĐÃ BỎ các thẻ Delta), Bank of
  America® (chỉ Atmos™ Rewards, đã bỏ Premium Rewards®). Ảnh thẻ chính thức
  cho cả 36. Offer Mỹ đổi thường xuyên; từ 30/09/2026 có job canh (xem "Canh
  offer thẻ Mỹ" ở trên), trước đó phải rà tay. Hai thẻ Marriott Bonvoy® Bevy®/Brilliant®
  của American Express® hết offer nâng 30/09/2026, rà lại 01/10/2026 (85,000 /
  100,000 điểm, không còn elevated). Credit ăn uống của Brilliant® dùng được ở
  nhà hàng toàn cầu — câu cũ "chỉ ở Mỹ" là sai.
- **Citi® CHƯA LÀM ĐƯỢC.** Trang Citi® không render số welcome bonus, mức chi
  tiêu và annual fee cho browser này — chỉ ra "Earn $ cash back bonus after
  spending $ in the first months". Đúng một ngoại lệ là Citi Strata Premier®
  (đọc được 21/09). Đã thử: chờ 15 giây, mở mục "Important Pricing &
  Information", đọc trang view-all. Không bịa số từ nguồn cấp hai — cần số thì
  hỏi user mở trang bằng browser của họ.
- **Phí ngoại tệ không mặc định là 0:** Ink Business Unlimited® có 3% (đọc từ
  bảng Pricing & Terms của Chase®, không phải trang sản phẩm). Mỗi thẻ mới phải
  mở trang `sites.chase.com/.../pricingandterms` hoặc bảng phí của hãng mà kiểm.
- **Thẻ còn `needsVerification: true`** (nếu sau này thêm thẻ mẫu) tự bị bỏ khi
  bật cờ (trang chi tiết `dynamicParams = false` → 404).
- **"🔥 Elevated Offers"** lấy thẻ `elevatedBonus` + chưa qua `expiresAt`
  (`isElevatedLive`, cùng luật thẻ Canada), không còn cờ `featured`. Chỉ bật
  elevated khi trang ngân hàng tự ghi offer có thời hạn. Có ngày thì đặt
  `expiresAt`; ngân hàng ghi "Limited-Time" mà không công bố ngày (Capital One®)
  thì đặt `offerEndUnannounced: true` thay vào — thẻ đó KHÔNG tự rời mục, mỗi
  lượt rà phải mở lại trang ngân hàng, hết chữ "Limited-Time" thì tắt tay (test
  `test:us-cards` bắt thẻ elevated thiếu cả hai, hoặc có cả hai). Rà 24/09/2026:
  7 thẻ — ba thẻ Marriott Bonvoy® và ba thẻ Hilton® của American Express®, cộng
  thẻ Hilton Honors không annual fee; 27/09/2026 thêm Capital One® Venture
  ($300 USD credit khách sạn, user xác nhận là elevated). Không thẻ nào elevated
  thì cả mục ẩn.
- **Tiền:** "$95 USD", không phải "$95" (`$` trần = CAD). Số tiền là SỐ trong dữ
  liệu, chuỗi dựng bằng `formatUsd`; `npm run test:us-cards` bắt mọi `$X` viết tay
  thiếu ` USD`.
- **Bài hướng dẫn:** `US_CARDS_GUIDE_SLUGS` = thứ tự ĐỌC (24/09/2026: 4 lý do →
  apply → mở Chase® bank account → thanh toán). Đích của mọi nút "Xem hướng dẫn"
  là `US_CARDS_BEGINNER_SLUG` (bài apply) — TÁCH khỏi thứ tự đọc từ 24/09/2026,
  vì chữ quanh các nút nói về ITIN và thẻ US đầu tiên; lấy `guides[0]` thì chỉ
  cần đổi thứ tự đọc là nút trỏ nhầm bài. Khối "🇨🇦 Mới Chơi Thẻ Mỹ?" liệt kê cả
  danh sách bằng `StepLink`, tiêu đề và mô tả đọc thẳng từ Contentful; bài chưa
  publish tự rơi khỏi danh sách, hết bài thì cả khối ẩn.
- **Thứ tự khối (đo 22/09/2026):** khối "🇨🇦 Mới Chơi Thẻ Mỹ?" đứng TRƯỚC
  "Tất Cả Thẻ Mỹ". Đặt sau danh sách thì trên màn 375px nó bắt đầu ở 7,771px
  của trang cao 9,059px — 86%, khoảng 9.5 màn; thủ phạm là danh sách 9 thẻ dài
  5,800px. Nay ở 1,955px. Không đưa lên đầu trang: dải một dòng dưới hero đã
  nói cùng một chuyện và trỏ cùng một bài.
- **Nhãn Beta (22/09/2026):** giống công cụ Gợi ý thẻ — dải full-bleed trên
  `PageHeader` (`UsCardsBetaNotice`, hai câu: nháp / đã công bố), nhãn cạnh
  eyebrow của `PageHeader`, và nhãn trong menu. Nhãn ở nav desktop chỉ hiện từ
  `xl` và `hidden` phải nằm ở SPAN BỌC: `BetaBadge` tự mang `inline-block`, hai
  utility cùng `display` thì thứ tự trong file CSS quyết định chứ không phải
  thứ tự trong chuỗi class — truyền thẳng `hidden` vào `className` thì nhãn vẫn
  hiện ở 1024px và hàng nav gãy chữ hai dòng.
- **Menu 1024px:** sáu mục cách 28px không vừa — chữ gãy hai dòng. Khi cờ bật,
  nav dùng `gap-3` dưới `xl`. Cờ tắt thì class giữ nguyên `gap-7`.
- **Lỗi cũ lộ ra:** `CardImage` truyền `absolute` vào `MediaPlaceholder` vốn tự
  mang `relative` → ô giữ chỗ co còn 40px. Không thẻ Canada nào thiếu ảnh nên nó
  nằm im tới hôm nay; đã sửa bằng lớp bọc `absolute inset-0`.
- **Trademark:** tên tự đánh ® trên thẻ Mỹ dạy `audit:trademarks` thương hiệu mới
  và làm lộ chỗ viết trần trong nội dung Canada ("Priority Pass™" → 11 chỗ,
  "SkyTeam®" → 5 chỗ). Viết trần như nội dung Canada đang viết; "Capital One®
  Venture X Card" cũng rút gọn vì "Rewards" là cụm báo nhầm có sẵn (12 chỗ tồn
  đọng trước khi làm mục này).

## Chạy gì trước khi kết luận

```
npm run lint
npx tsc --noEmit
npm run build
npm run audit:trademarks    # thiếu ®/™
npm run audit:rebates       # số rebate lệch FinlyWealth (tài khoản ngân hàng)
npm run audit:rebate-prose  # badge rebate lệch số viết tay trong editor's take
npm run audit:best-cards    # số viết tay ở 4 trang "Các thẻ tốt nhất" lệch Contentful
npm run audit:card-mentions # độ phủ khối thẻ trong thân bài + bí danh mồ côi
npm run audit:awards        # bảng award
npm run audit:health        # nội dung ĐANG PHỤC VỤ: offer chết còn treo, thẻ mất chip, sắp hết hạn
npm run audit:links         # mạng link nội bộ: trang nào không ai trỏ vào (crawl site đang chạy)
```

Sáu cái audit này bắt sẵn nhiều lớp lỗi lặp lại. Đừng báo lại thứ chúng đã bắt
được.

**`audit:links` là cái duy nhất nhìn 113 trang CÙNG MỘT LÚC.** Mọi audit khác,
và cả báo cáo SEO hằng tuần, soi từng trang một — mã trạng thái, canonical,
tiêu đề, dữ liệu có cấu trúc — nên không cái nào thấy được thứ chỉ hiện ra khi
đặt cả site cạnh nhau: trang nào chỉ có đúng một đường dẫn vào. Đo ngày
03/09/2026, trước khi các trang bắt đầu trỏ sang anh em của mình, 37 trang ở
tình trạng đó, gồm cả bốn thẻ Aeroplan® và toàn bộ 29 trang tài khoản ngân
hàng — mỗi trang chỉ được đúng trang danh sách của mục nó trỏ vào. Nó crawl
site ĐANG CHẠY (mặc định `ghe1a.com`; truyền `-- http://localhost:3000` để soi
bản chưa deploy), nên chạy được cả khi không có credential Contentful.

Exit 1 chỉ khi có trang KHÔNG ai trỏ vào. Trang chỉ có một đường vào thì in ra
mà không làm đỏ — cùng luật với `audit:health`.

**`audit:health` soi trục khác hẳn bốn cái kia.** Bốn cái trên mỗi cái kiểm một
thuộc tính hẹp của nội dung (ký hiệu ®/™, bảng giá, con số rebate). `audit:health`
hỏi "hôm nay người đọc đang thấy gì": offer nào đã hết hạn mà job chưa gỡ, thẻ
nào vừa thêm mà rơi khỏi mọi filter chip, bonus nào sắp chết, entry nào có draft
lệch nên đang lặng lẽ rơi khỏi mọi job. Nó đọc qua CDA (bản đang phục vụ) chứ
không phải CMA, nên một tác giả đang viết dở không làm nó đỏ. Sắp hết hạn và
thiếu mô tả SEO chỉ in ra chứ KHÔNG exit 1 — đó là việc biên tập, và một job đỏ
dai vì lý do đó thì chẳng mấy chốc không ai đọc nữa.

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

## Vòng kiểm toàn diện 06/09/2026 — đừng đề xuất lại

Mọi gate xanh trước khi bắt đầu. Codex rà theo thứ tự hậu quả (revalidate >
expire-offers > check-rebates/sync-videos/contentful-cma > ...), ra 4 phát
hiện; 3 đã vá qua HAI vòng phản biện (vòng đầu bắt bản vá của 2/3 cái HỎNG,
vòng hai xác nhận bản sửa lại đã đóng đúng lỗ hổng). Cái thứ tư cố ý KHÔNG vá.

**Đã vá — `expire-offers`: `rebateVi` và phần chữ rewrite phải cùng một khối
try, không tách rời.** Trước đây `changes.rebateVi = offer.rebate` chạy NGAY
sau khi đọc FinlyWealth, tức TRƯỚC `rewriteOfferCopy`. Nếu rewrite ném (timeout,
bị `assertFiguresAreSourced` từ chối, …), `catch` vẫn đi tới `updateEntry` với
`changes` mang `rebateVi` MỚI nhưng `headlineVi`/`keyBenefitsVi`/`editorsTakeVi`
CŨ — publish thẳng một thẻ có badge một số, HOT TIP một số khác, đúng lỗi mà
`audit:rebate-prose` sinh ra để bắt, nhưng tự tay đưa lên site trước khi audit
kịp chạy. Cùng nguyên tắc `check-rebates` đã áp dụng (gộp `rebateProsePatch`
với `rebateVi` trong một `updateEntry`) — `expire-offers` thiếu nó vì đường ghi
`rebateVi` với đường ghi phần chữ nằm cách nhau bởi một `await` có thể ném ở
giữa. Vá bằng cách gán `changes.rebateVi` NGAY SAU khi `rewriteOfferCopy` trả
về, cùng khối với `Object.assign(changes, copy)` — rewrite ném thì `changes`
không đổi gì cả.

**Đã vá — `sync-videos`: `total` phải là số nguyên KHÔNG ÂM thật sự đọc được từ
response, không phải `data.total ?? 0`.** Bản vá VÒNG ĐẦU (thêm cửa
`Array.isArray(data.items) && data.items.length === total`) bị Codex bác vì
BẢN VÁ HỎNG: một response hỏng thiếu hẳn field `total` (ví dụ `{"items":[]}`)
bị `?? 0` mặc định thành 0, khớp khít với `items.length === 0`, lọt qua cửa vừa
thêm mà không hề hấn gì. Sửa lại: kiểm `typeof data.total !== "number" ||
!Number.isInteger(data.total) || data.total < 0` và ném TRƯỚC khi gán `total`,
để một response thật sự "không có video nào" (`total: 0` là SỐ có thật) vẫn qua
được, chỉ chặn ca field bị thiếu/kiểu sai. Vòng phản biện thứ hai của Codex về
điểm này bị treo (xem mục ngay dưới) nên KHÔNG có xác nhận bằng lời — chỉ tự
kiểm bằng cách đọc lại logic: `typeof undefined !== "number"` đúng, nên response
thiếu `total` giờ ném thay vì lọt qua.

**Đã vá — `catch-the-points/leaderboard.js`: `confirmLanded()` sau khi ghi thất
bại, nhưng CHỈ với 502, không phải mọi 5xx.** Bản vá VÒNG ĐẦU dùng `res.status
>= 500` cũng bị Codex bác: `503 ("unverifiable")` ở `api/game-record` xảy ra ở
`readGameRecord()` — TRƯỚC khi có bất kỳ lượt ghi nào — nên xác nhận ở nhánh đó
là vô nghĩa, và nếu đúng lúc ấy có người khác vừa lập TRÙNG điểm số thì
`confirmLanded` so điểm sẽ báo NHẦM là lượt của mình đã thành công. Chỉ `502
("write_failed")` — sinh ra từ `createGameRecord` (create + publish, hai lượt
gọi Contentful nối tiếp) ném — mới là ca ghi có thể đã thành công dù response
mất, đáng xác nhận. Giới hạn VỐN ĐÃ CÓ (không phải hồi quy mới): `confirmLanded`
gọi `refresh()` làm mất token cũ, và một lượt đọc CDA ngay sau publish có thể
vẫn dính cache — cùng rủi ro với nhánh `catch` (network exception) đã tồn tại
từ trước, chấp nhận vì đây là mini-game, không phải tiền.

**Codex bị TREO cả hai lần chạy vòng phản biện thứ hai (`codex exec`, ~1h40 và
~50 phút, CPU time gần như 0 suốt thời gian đó) — không phải lỗi logic, là lỗi
môi trường/tiến trình.** Cả hai lần đều phải `TaskStop` tay. Hai bản vá cuối
(sync-videos, leaderboard) vì vậy KHÔNG có xác nhận bằng lời của Codex ở vòng
hai — chỉ tự kiểm bằng cách đọc lại code (xem hai mục trên). Nếu gặp lại
`codex exec` treo kiểu này: kiểm `ps -o pid,etime,time -p <pid>`, CPU time gần
như đứng yên trong khi ELAPSED tăng đều là dấu hiệu treo, không phải đang suy
luận lâu.

**Cố ý KHÔNG vá — `api/revalidate`: `request.json()` ném vì body không hợp lệ
bị coi như "manual test ping" (`hasPayload = false` → 200), dù về lý thuyết một
publish event THẬT có thể tới với body bị hỏng giữa đường (khác hẳn lỗi TIMEOUT
đã ghi ở mục "Việc còn nợ" phía trên — đây là body ĐỌC XONG nhưng không parse
được, không phải đọc mãi không xong).** Không vá vì hai lý do: (1) khả năng xảy
ra thấp trong cấu hình HIỆN TẠI — chưa cấu hình "transformation" ở Contentful
(xem mục "Việc còn nợ"), nên với một publish event thật, body luôn là JSON hợp
lệ do chính Contentful sinh ra; kịch bản duy nhất còn lại là mạng đứt giữa
chừng, và trường hợp đó nhiều khả năng làm `request.json()` ném lỗi STREAM chứ
không trả về một chuỗi "đọc xong nhưng sai cú pháp" — chưa kiểm chứng được
hành vi thật của Node/undici trong ca này; (2) route này đã được ghi rõ là
"cần một phiên riêng, không làm kèm" cho đúng loại vấn đề liền kề (đọc body
không có hạn giờ) — vá thêm một nhánh khác của cùng đoạn code trong một audit
định kỳ, không đo được body thật, rủi ro cao hơn lợi ích với một ca chưa chắc
xảy ra được. Nếu muốn đóng hẳn: phân biệt "body rỗng thật" (Content-Length 0 —
ping tay) với "body có nội dung nhưng không parse được" (bất thường, an toàn để
xin retry vì `claimBroadcast` chưa chạy tới) bằng cách đọc `request.text()`
trước rồi mới `JSON.parse`, thay vì để `request.json()` gộp cả hai ca làm một.

## Viết `seoDescriptionVi` cho 28 bài đang phục vụ (06/09/2026)

`audit:health` từng nhắc 28/38 bài thiếu `seoDescriptionVi` (2 bài viết + 26
video), 1 video thiếu cả `seoTitleVi` — đây là việc biên tập nên chỉ IN RA,
không exit 1. Đã viết và publish qua CMA cho toàn bộ 28 bài, sau khi người
dùng duyệt mẫu 3 bài đầu (2 post + 1 video) để chốt giọng văn.

- **Bài viết (`type: post`) dựa vào `titleVi`/`excerptVi`/`bodyVi` thật.** Hai
  bài này có nội dung đầy đủ nên mô tả bám sát nội dung, không phải chỉ diễn
  lại tiêu đề.
- **Video (`type: video`) CHƯA có transcript/phụ đề trong hệ thống** — `bodyVi`
  của chúng chỉ là placeholder do `sync-videos` tự sinh ("Video mới từ Ghế 1A:
  …"), không phải nội dung thật (xem project note "Phụ đề cháy trong video
  kênh" — OCR phụ đề vẫn là việc chưa làm). Nên mô tả SEO của cả 26 video CHỈ
  dựa vào `titleVi`/`seoTitleVi` có sẵn — dịch/diễn lại hook của tiêu đề tiếng
  Anh sang tiếng Việt, KHÔNG bịa chi tiết phòng ốc, giá phòng, hay đánh giá
  dịch vụ không có trong dữ liệu. Cùng nguyên tắc "chỉ dùng số liệu có trong dữ
  liệu được cung cấp" mà `assertFiguresAreSourced` áp cho `rewriteOfferCopy`.
- **Bài về ưu đãi đã hết hạn viết theo giọng phân tích, không giọng "đang diễn
  ra".** Bài Marriott Bonvoy transfer bonus 30% (hết hạn 03/09/2026, đã qua lúc
  viết mô tả 06/09/2026) được viết tập trung vào phần phân tích "có nên
  chuyển hay không" — phần này vẫn đúng bất kể ưu đãi còn sống hay không — thay
  vì mô tả kiểu khẳng định ưu đãi đang chạy, để không hứa hẹn sai với người tìm
  thấy bài qua Google sau khi ưu đãi đã đóng.
- **Contentful giới hạn `seoDescriptionVi` tối đa 170 ký tự** (validation
  `size`, đo bằng độ dài chuỗi JS chứ không phải byte UTF-8). Một bài (Park
  Hyatt Kyoto) bị từ chối 422 ở lần ghi đầu vì 221 ký tự — rút ngắn còn 125 ký
  tự mới qua. Viết mô tả SEO hàng loạt sau này nên kiểm độ dài trước khi gọi
  CMA, đừng đợi 422 rồi mới sửa từng bài.
- **Script viết là tạm thời, không nằm trong repo** (chạy một lần từ
  scratchpad, dùng lại `cmaClient`/`listEntries`/`updateEntry`/`field` của
  `lib/contentful-cma.ts`). Có kiểm cửa draft-ahead (`version > publishedVersion
  + 1`) trước khi ghi từng bài, cùng luật với `expire-offers`/`check-rebates` —
  không có bài nào bị chặn ở lượt này (cả 28 đều publish sạch, không có draft
  dở dang).

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

## Vòng kiểm toàn diện 09/09/2026 — đừng đề xuất lại

Mọi gate xanh trước khi bắt đầu. `audit:trademarks` báo 171 chỗ — rà tay từng
nhóm thì hoá ra phần lớn là MỘT lỗi của chính script, không phải 171 lỗi nội
dung.

**Lỗi script: cụm thương hiệu học sai khi bị NGẮT DÒNG.** Script học cụm bằng
cách lùi về trước qua các từ viết hoa liền nhau, nhưng nó xử lý từng DÒNG
riêng — nếu một thương hiệu hai từ bị wrap qua dòng khác (`"...miễn hành lý
Air\n// Canada®..."`), script chỉ thấy nửa sau nằm một mình trên dòng có dấu
®, và học nhầm "Canada" hay "Rewards" là thương hiệu độc lập. Hai cụm đó sau
đó khớp vào MỌI chỗ viết "Canada" hay "Rewards" bình thường trên site, tạo ra
143/171 phát hiện giả (Canada 116 chỗ, Rewards 27 chỗ). Đã vá tại nguồn — reflow
3 comment trong `engine.test.ts` (dòng ~581, ~2231) và `strategies.ts` (dòng
~68) để "Air Canada®" và "Membership Rewards®"/"TD Rewards®" không còn nằm vắt
qua ranh dòng — không sửa script, vì nội dung comment vốn đã đúng, chỉ là chỗ
xuống dòng vô tình rơi giữa cụm.

Cùng lỗi làm lộ một chỗ NGẮT DÒNG THẬT trong dữ liệu (không phải comment):
`award-strategies.ts` viết `"...American " + "Airlines® được định giá..."` —
"American Airlines®" đúng nhưng bị xẻ đôi bởi phép nối chuỗi, nên script học
nhầm "Airlines" là thương hiệu riêng. Đã nối lại chuỗi ở điểm ngắt khác, giữ
nguyên văn bản render ra.

**Nếu gặp lại một thương hiệu học sai theo kiểu "từ đơn lẽ ra phải ghép":**
tìm dòng nào có ký hiệu ®/™ đứng một mình đầu dòng trong file `.ts`/`.tsx`
(comment hoặc chuỗi nối `+`) — gần như chắc chắn là chỗ vắt dòng, không phải
171 lỗi nội dung thật. `grep -rnB1 -E "^\s*(//|\*)? *TÊN®" --include="*.ts"
src/` tìm được ngay.

**Sau khi lọc hết nhiễu, còn 24 chỗ THẬT:** BMO® VIPorter® thiếu ® trên
"Porter" (3 chỗ Contentful + 1 chỗ `product-benefits.ts`), Amex® Platinum và
Amex® Business Platinum thiếu ™ trên "Global Lounge Collection" (2 chỗ
Contentful), TD First Class Travel® thiếu ® trên "TD Rewards" (5 chỗ
Contentful qua CMA + 4 chỗ `best-cards.ts` + `points-programs.ts`/`offers.ts`/
`programs.test.ts`), và `award-strategies.ts` viết nhầm "Qatar®" thay vì
"Qatar Airways®" (mọi chỗ khác trên site đều dùng "Qatar Airways®" cho lần
nhắc đầu). Tất cả đã sửa và publish; `test:reco` chạy lại xanh (272/272) sau
khi cập nhật `engine.snapshot.json` bằng `UPDATE_ENGINE_SNAPSHOT=1` — đổi
`name` trong `points-programs.ts`/`offers.ts` đổi dấu vân tay dữ liệu chứ
không đổi hành vi, đúng cơ chế §20 đã thiết kế.

**Quan trọng: `program.name` trong `points-programs.ts` RENDER THẲNG ra
`/calculator`, `/award-flight-finder`, `/transfer-partners`, dropdown thẻ và
`post-next-steps`** (`program.name` xuất hiện trực tiếp trong JSX ở nhiều
component) — đây KHÔNG phải dữ liệu nội bộ của engine như phần lớn
`src/lib/recommendation/data/*`. "Avios" và "TD Rewards" thiếu ® ở đây là lỗi
thật đang hiện sống trên site, không phải nhiễu của script. Khi audit
trademark tương lai bắt trúng field `name` này, kiểm ngay — đừng xếp chung với
nhiễu dòng-vắt.

**Hai chỗ CỐ Ý không sửa, đừng đề xuất lại:**
- `sourceUrl: RBC_SOURCE` trong `transfer-paths.ts` (4 chỗ) — đây là TÊN BIẾN
  JS, không phải chữ hiển thị. Không thể thêm ® vào một identifier (`RBC®_SOURCE`
  không phải cú pháp hợp lệ). Script khớp nhầm chuỗi con "RBC" bên trong tên
  biến; đây là biến thể khác của lỗi "Element" kiểu TypeScript đã ghi ở mục
  cũ, áp cho biến thay vì kiểu.
- `lifecycle.test.ts:630`: `assert.ok(check("Only: Avion Elite"), ...)` — chuỗi
  này CỐ Ý không có ® vì bài test đang kiểm chính logic nhận diện có bắt được
  "Avion Elite" đứng sát dấu hai chấm hay không, bất kể có ký hiệu thương hiệu
  hay không. Thêm ® vào sẽ đổi đúng thứ đang được kiểm.

## Đo đạc GA4 (06/09/2026) — đừng đề xuất lại

- **Link nội bộ KHÔNG BAO GIỜ gắn `utm_*`.** `recommendationURL` trong
  `public/games/catch-the-points/src/recommendations.js` từng gắn
  `utm_source=catch-the-points&utm_medium=game` lên CTA hậu game, dù hàm đó chỉ
  cho phép đích đến là ghe1a.com. Đã bỏ. UTM là để đánh dấu người đi từ site
  KHÁC về; trên link nội bộ nó bẩn attribution ở cấp event, và nếu URL đó mở
  đầu một phiên mới thì phiên ấy mang nguồn `catch-the-points / game` thay cho
  nguồn thật — `game` lại không khớp channel mặc định nào nên rơi vào
  Unassigned. Đường đi game → thẻ đo bằng `post_game_recommendation_clicked`
  kèm `recommendation_category` và `recommendation_id`, không bằng UTM.
  Lưu ý ngược lại: `target="_blank"` KHÔNG tự mở phiên GA4 mới (tab mới dùng
  chung cookie), đừng lập luận theo hướng đó.
- **`tracking_id` là tên tham số DÀNH RIÊNG của gtag — đừng bao giờ dùng.**
  Đây là nguyên nhân THẬT khiến `post_game_recommendation_shown` /
  `_clicked` bằng 0 trong GA4 suốt tuần 30/08–05/09 (khoảng 120 lần lẽ ra phải
  có). Gặp `tracking_id` trong tham số event, gtag lấy giá trị đó làm
  measurement ID: hit bay tới `tid=balance_beginner_guide` thay vì
  `tid=G-5EJS75L7SK`. `game_completed` vẫn về đủ vì nó không mang tham số này.
  Đã đổi sang `recommendation_id`. Kiểm chứng bằng cách đọc thẳng request
  `google-analytics.com/g/collect` trong trình duyệt, KHÔNG phải bằng cách suy
  luận từ code — cả Claude lẫn Codex đều đoán sai nguyên nhân (đổ cho object
  lồng và cho processing delay) cho tới khi nhìn URL thật.
  Test nay chặn cả họ tên dành riêng: `tracking_id`, `send_to`,
  `page_location`, `user_id`, `client_id`.
- **Tham số event GA4 phải là giá trị đơn.** `recommendationTracking` từng gửi
  `primary_gameplay_signal: {name, value}` — object lồng. Đã tách thành
  `primary_gameplay_signal_name` + `primary_gameplay_signal_value`. Boolean thì
  hợp lệ (`carrying_balance` gửi `true`), chỉ đừng đăng ký field ấy làm custom
  **metric** vì metric cần số.
- **Test schema phải khoá được schema.** `assert.deepEqual(payload,
  recommendationTracking(...))` là tautology — lấy chính hàm đang kiểm làm giá
  trị kỳ vọng, nên quay về object lồng vẫn xanh. Codex bắt được chỗ này. Nay có
  assert trực tiếp tên field, giá trị, và `assert.notEqual(typeof value,
  'object')` cho mọi field; đã xác minh bằng cách cố ý gửi lại object lồng →
  test đỏ 1/43.
- **Custom dimension đã đăng ký (06/09/2026):** `Product`→`product`,
  `Placement`→`placement`, `Newsletter source`→`source`, đều scope Event. GA4
  KHÔNG tính ngược, nên dữ liệu chỉ có từ 06/09 trở đi. `apply_clicked` bắn từ
  HAI chỗ: `ui/apply-link.tsx` và `blog/affiliate-click-tracker.tsx`
  (`placement: "post_body"`).

## `check-rebates` bỏ đường vòng qua ghe1a.com (09/09/2026) — đừng đề xuất lại

**Triệu chứng:** job đỏ đều, 3/9 lượt gần nhất. 04/09 và 05/09 nhận HTTP 403 ở
cả 5 lượt; 08/09 và 09/09 nặng hơn — `curl (28) Failed to connect to ghe1a.com
port 443 after 268s`, không bắt được cả TCP, 5 lượt, ~25 phút runner cho một
job không chạy nổi dòng nào. Hai ngày liền mỗi ngày mất đúng MỘT trong hai
lượt, tức lịch hai lượt trên giấy thành một lượt trên thực tế.

**Không phải site sập:** gọi `https://ghe1a.com/` từ máy nhà cùng lúc đó trả
200 trong 0.4 giây. Cũng không phải User-Agent: bản vá 04/09 (đổi UA, bỏ `-f`)
đã ở đúng chỗ khi lượt 05/09 vẫn 403. Chặn theo IP của runner GitHub, ở edge
Hostinger (`server: hcdn`), và nó leo thang từ trả-mã-lỗi sang nuốt-gói-tin.

**Cách sửa:** phép so chuyển từ `app/api/check-rebates/route.ts` sang
`src/lib/check-rebates.ts` (`runCheckRebates`), gọi từ hai phía:

- `scripts/check-rebates.mts` → `npm run job:check-rebates`, chạy trong runner.
  Đây là đường theo lịch. Không còn `curl`, không còn WAF chen vào.
- Route vẫn còn, nay là vỏ mỏng: auth + gọi + map status. Đường gọi tay.

**Cái giá, và cách đã trả:** runner nay giữ `CONTENTFUL_MANAGEMENT_TOKEN` —
token DUY NHẤT có quyền ghi vào Contentful. Repo này PUBLIC và
`workflow_dispatch` nhận `ref` là branch/tag bất kỳ, nên **secret cấp repo là
không đủ**: ai có quyền write chỉ cần đẩy một branch sửa
`scripts/check-rebates.mts` rồi dispatch vào chính branch đó, và mã tuỳ ý chạy
với token ghi. (Codex bắt đúng chỗ này ở vòng 2; lập luận "repo chỉ có một
collaborator" của mình KHÔNG đủ để đóng finding, vì collaborator không phải
toàn bộ bề mặt quyền.)

Cách đã chọn: ba secret Contentful nằm trong **environment
`contentful-write`**, có deployment branch policy chỉ cho `main`. Dispatch từ
branch lạ không đọc được secret nào — GitHub chặn cả job trước khi runner nhận
secret. Giữ được `workflow_dispatch` trên `main`, thứ cần để kiểm chính đường
chạy trong runner (gọi route chỉ kiểm được đường trên server).

**Nó KHÔNG ngăn được người có quyền write, và đừng ghi là có.** `main` hiện
KHÔNG có branch protection, nên ai write được là push thẳng vào `main` được —
một bước, không cần vòng vo. Codex ở vòng 3 còn chỉ ra một đường vòng dài hơn
(dispatch `check-bank-rebates`/`offer-history` trên branch lạ, dùng
`contents: write` của chúng đẩy mã lên `main`, rồi dispatch `check-rebates`);
đường đó CÓ THẬT nhưng không thêm quyền gì so với việc push thẳng, nên bỏ
`workflow_dispatch` khỏi hai job kia không đóng được gì mà mất hai nút chạy
tay. **Đã cân nhắc và bác — đừng đề xuất lại.**

Cái environment policy thật sự mua được: đóng đường chạy mã với token ghi mà
KHÔNG để lại dấu trong lịch sử `main`. Muốn thật sự chặn người có quyền write
thì thứ cần là branch protection cho `main`, không phải sửa thêm workflow.

Bề mặt đã kiểm 09/09/2026: repo PUBLIC, 1 collaborator, 0 deploy key, 0
webhook, `GITHUB_TOKEN` mặc định chỉ đọc, `main` KHÔNG được bảo vệ, workflow
này không có trigger `pull_request`. **GitHub Apps chưa kiểm kê được** (token
hiện tại không liệt kê được) — cài app có quyền `Actions: write` thì xem lại.

**Vòng thử lại KHÔNG mất, nhưng đổi ngữ nghĩa** (Codex bắt được ở vòng review;
bản vá đầu của mình thật sự làm rơi nó). Action cũ `curl --retry 5` thử lại
theo HTTP STATUS, mà 500 gộp mọi loại hỏng vào một mã: một trang FinlyWealth
timeout và một con số viết tay gõ nhầm đọc giống hệt nhau, nên curl chạy lại
cả hai — loại thứ hai không bao giờ khỏi, mỗi lượt thừa là 10 lần đọc
FinlyWealth đổ đi. Nay lỗi mang cờ `retryable`, gắn theo HÌNH DẠNG lỗi
(`isTransient()` trong `lib/job-retry.ts`, có test ở `job-retry.test.ts`,
`npm run test:jobs`): 4xx trừ 408/429 và "FinlyWealth đổi markup" là vĩnh
viễn, còn lại mặc định chạy lại — đoán sai theo hướng chạy thừa chỉ tốn một
lượt đọc, đoán sai theo hướng bỏ qua thì mất cả lượt kiểm. Script thử tối đa 3
lượt và CHỈ khi có lỗi loại đó (hoặc lượt chạy ném thẳng).

`updated` được GỘP qua mọi lượt chứ không lấy ảnh chụp lượt cuối — cũng là
Codex bắt: lượt 1 sửa thẻ A rồi thẻ B rớt mạng, lượt 2 đọc lại bản published
nên A thành `unchanged`, và log sẽ im lặng về một lần GHI đã xảy ra thật. `finlywealth.ts` và `contentful-cma.ts` cũng đã sửa
comment: hạn giờ `AbortSignal` trong hai file đó nay là lớp cắt NGẮN NHẤT còn
lại cho job này, vì không còn `curl --max-time 300` bọc ngoài. (Không phải
"duy nhất" — mặc định của undici và hạn 360 phút của Actions vẫn ở đó, nhưng
chúng tính bằng phút tới hàng giờ.)

**Ba job kia vẫn đi qua ghe1a.com** — `expire-offers`, `sync-videos`,
`offer-history` — và vẫn dính đúng rủi ro này. Chưa chuyển vì chúng cần thứ
khác từ server chứ không chỉ token Contentful (`offer-history` gọi
`/api/offer-snapshot`, và nó là job DUY NHẤT ghi lịch sử: một lượt trượt mà số
kịp đổi hai lần thì mức ở giữa mất vĩnh viễn). Nếu chúng bắt đầu đỏ theo cùng
kiểu thì đây là bản mẫu để chuyển.

**Câu chữ đã sai sau lần này** — "runner của Actions không có token Contentful,
chỉ server có" nằm rải trong `src/lib/best-cards.ts`, `CLAUDE.md`,
`CONTENTFUL.md` và đã sửa. Các mục AGENTS.md có ghi ngày thì giữ nguyên: đúng ở
thời điểm viết.

## Kiểm toàn diện định kỳ 12/09/2026

Mọi gate xanh (lint, tsc, build, 8 audit, 3 test suite, `npm audit` 0 lỗ hổng)
trước khi Codex rà. Hai phát hiện; một đã vá và được vòng phản biện xác nhận
ĐÚNG, một xác nhận THẬT nhưng cố ý CHƯA vá.

**Đã vá — `safeApplyUrl` (`lib/content/contentful.ts`) và cửa kiểm tương ứng
trong `audit-content-health.mts` đòi `^https?://` bằng KÝ TỰ, không chỉ đòi
`new URL(raw).protocol` chạy được.** `new URL()` KHÔNG có base tự thêm `//`
cho scheme đặc biệt: `https:finlywealth.com/x` và `https:/finlywealth.com/x`
đều được nó hiểu là https hợp lệ và gật đầu cho qua. Nhưng trình duyệt phân
tích CHÍNH chuỗi đó làm `href` với BASE là trang thẻ đang đứng (vì thiếu `//`
nên bị coi là tham chiếu tương đối), ra một URL NỘI BỘ 404
(`https://ghe1a.com/credit-cards/finlywealth.com/x`) — nút Apply mở trang lỗi
nhưng `apply_clicked` vẫn bắn, và `check-rebates`/`finlyWealthRebateUrl` vẫn
coi đây là link FinlyWealth thật. Cùng lớp lỗi "một chuỗi đọc được nhiều cách
khác nhau" đã vá ba lần ở `safeHref`/`relForUrl` (xem các mục 29/08, 04/09,
05/09 ở trên), nhưng lần này ở một hàm khác, chưa được hardening theo cùng
cách. Đã kiểm cả 34 `applyUrl` đang có trên Contentful đều khớp
`^https?://` sẵn — vá không làm rớt link nào. Vòng phản biện Codex xác nhận
ĐÚNG, không tìm thêm được dạng ambiguous nào lọt qua (đã thử `HTTPS://`,
khoảng trắng, ký tự điều khiển chen giữa scheme và host).

**Chưa vá — `sync-videos` có thể tự publish một video TRÙNG khi entry đã
publish nhưng đang có draft đổi/xoá `videoUrl` chưa publish.**
[`fetchVideoUrlsByState`](src/app/api/sync-videos/route.ts:283) đọc
`item.fields.videoUrl` từ CMA — LUÔN LÀ GIÁ TRỊ DRAFT — rồi ở dòng ~359 chỉ
dùng `item.sys.publishedVersion` (có publish TỪNG LẦN NÀO chưa) để quyết định
bỏ URL đó vào `published` hay `unpublished`. Nếu một entry ĐANG publish với
URL X, mà tác giả lưu draft đổi videoUrl thành Y (hoặc xoá) nhưng CHƯA publish
lại, thì `published` sẽ chứa Y chứ không phải X — X biến mất khỏi cả hai Set.
Lượt sync kế tiếp gặp X trong feed YouTube, không thấy nó ở đâu trong
`published`/`unpublished`, nên đi tạo VÀ PUBLISH một entry thứ hai cho đúng
video đó. Job trả 200; slug entry mới khác slug cũ (sinh từ tiêu đề, có thể
trùng hệt hoặc lệch một hậu tố `videoId`) nên `audit:health` mục 6 (trùng
slug) không bắt được ca này.

Cố ý CHƯA vá trong lượt này: bản sửa đúng cần đọc thêm CDA (bản đang phục vụ)
để biết videoUrl THẬT SỰ đang publish là gì, độc lập với draft hiện tại —
không chỉ đổi điều kiện lọc trong hàm hiện có, vì CMA vốn dĩ không mang giá trị
đã publish tách biệt khỏi draft. Đây là một thay đổi rộng hơn (thêm một lượt
gọi mạng, viết lại logic gộp hai nguồn) và không có test hiện có cho
`sync-videos/route.ts` để tự tin không hồi quy — đúng loại việc AGENTS.md đã
nhiều lần ghi "cần một phiên riêng, không làm kèm" (xem mục "Việc còn nợ" của
`api/revalidate` phía trên). Rủi ro thực tế thấp: video là nội dung do chính
`sync-videos` tự tạo, tác giả hiếm khi sửa tay trường `videoUrl` của một entry
đã publish. Xác nhận ĐÚNG qua hai vòng Codex độc lập (vòng rà lỗi mới, và vòng
phản biện bản vá `safeApplyUrl` — được yêu cầu xác nhận lại riêng).

**Phát hiện ngoài code — `check-rebates.yml` (thẻ tín dụng) đỏ 100% từ
10/09/2026, không phải lỗi code.** Environment `contentful-write` trên GitHub
(tạo 09/09/2026 để cách ly ba secret Contentful khỏi secret cấp repo — xem mục
09/09/2026 ở trên) được tạo ĐÚNG với branch policy, nhưng BA SECRET
(`CONTENTFUL_SPACE_ID`, `CONTENTFUL_ACCESS_TOKEN`, `CONTENTFUL_MANAGEMENT_TOKEN`)
CHƯA TỪNG được thêm VÀO chính environment đó — `gh secret list --env
contentful-write` trả rỗng, trong khi `gh secret list` (cấp repo) chỉ thấy
`EXPIRE_OFFERS_SECRET`/`SYNC_VIDEOS_SECRET`. Workflow chạy đúng (checkout,
`npm ci`, vào tới bước gọi script) nhưng cả ba biến môi trường đều RỖNG, nên
`scripts/check-rebates.mts` thoát ngay ở dòng kiểm biến môi trường đầu tiên.
Đã xảy ra ở MỌI lượt chạy theo lịch từ 10/09/2026 13:04 UTC tới 15/09/2026
22:59 UTC (mọi lượt liên tiếp trong khoảng đó) — tức audit rebate thẻ tín dụng
VÀ `bestCardsProseDrift()` (cũng chạy trong route này) không thực sự chạy qua
CI suốt ~5 ngày rưỡi, dù chạy tay bằng `.env.local` vẫn cho kết quả sạch.

**Đã sửa 15/09/2026.** Lúc phát hiện, mình (Claude) không tự set secret vì đó
là thay đổi cấu hình bảo mật GitHub; đã báo lại và hỏi trước. Bạn xác nhận cho
làm luôn (`gh` CLI đã đăng nhập sẵn với quyền `repo`, không cần đăng nhập
thêm) — đã set cả ba secret vào environment `contentful-write` bằng `gh secret
set --env`, giá trị đọc từ `.env.local`, không in ra terminal/log. Chạy tay
`gh workflow run check-rebates.yml` xác nhận job xanh trở lại (26s, kiểm 10
thẻ, không lệch số nào). **Bài học cho lần dựng environment tiếp theo:** tạo
environment với branch policy KHÔNG tự động có nghĩa là secret đã ở trong đó —
đây là hai bước riêng, và bước sau (thêm secret) đã bị bỏ sót hôm 09/09/2026
lúc dựng. Sau khi tạo một environment mới, luôn `gh secret list --env <tên>`
để xác nhận secret thực sự nằm trong đó trước khi coi là xong.

## Đo đạc GA4 (13/09/2026) — đừng đề xuất lại

- **`apply_clicked` có thể bị ĐẾM ĐÔI khi một khối `CardSpotlight` (thẻ nhắc
  trong thân bài blog) được bấm — phát hiện 13/09/2026, ĐÃ VÁ cùng ngày.**
  `AffiliateClickTracker` (`components/blog/affiliate-click-tracker.tsx`) gắn
  listener capture-phase lên `data-affiliate-scope="post-body"`, khớp mọi
  `a[rel~='sponsored']` bên trong — kể cả anchor của `ApplyButton`/`CardImage`
  thuộc `CardSpotlight` mà `post-body.tsx` chèn giữa đoạn văn. Một click vào
  nút Apply hoặc ảnh của khối thẻ đó vì vậy bắn HAI event `apply_clicked`:
  một từ `ApplyLink` (`product=card.slug`), một từ tracker
  (`product=post.slug`, vì tracker gán `product` = slug BÀI VIẾT chứa link,
  không phải slug thẻ). Comment cũ trong `post-body.tsx` ("Nút Apply trong
  khối thẻ tự bắn event riêng của nó, nên không bị đếm hai lần") mô tả Ý ĐỊNH
  đúng nhưng KHÔNG có cơ chế nào ép nó thành sự thật.
  **Cách vá:** CHÍNH `CardSpotlight` (không phải nơi gọi nó) nay tự đánh dấu
  root của mình bằng `data-affiliate-self-tracked`; `AffiliateClickTracker`
  kiểm `anchor.closest("[data-affiliate-self-tracked]")` và BỎ QUA nếu khớp —
  biến đúng cái ý định cũ thành một điều kiện thật thay vì một câu comment
  suông. Đặt marker ở component thay vì ở `post-body.tsx` (Codex gợi ý,
  13/09/2026) để chỗ dùng còn lại của `CardSpotlight`
  (`BestCardPickSection`/`best-card-pick.tsx`, hiện KHÔNG nằm trong vùng
  `AffiliateClickTracker` nào) tự động an toàn nếu sau này bị đặt vào trong
  một `data-affiliate-scope` — không cần ai nhớ khai báo lại marker ở nơi
  gọi.
  `CardImage` tự thêm hậu tố `_image` vào placement nó nhận (`card-image.tsx`),
  nên đường ảnh mang `placement="post_body_image"`, khác đường nút
  (`"post_body"`) — cả hai đường đều nằm trong vùng `data-affiliate-self-tracked`
  nên cả hai đều được loại trừ đúng. **Cách kiểm lại nếu nghi ngờ tái phát ở
  tuần nào đó:** so tổng event `placement=post_body` với tổng các dòng
  "Product" dạng slug-bài-viết (phải BẰNG NHAU — dư ra tức là đếm đôi đang xảy
  ra lại) và xem có dòng `placement=post_body_image` nào lẫn slug-bài-viết
  không (không nên có). Chưa có test tự động cho cơ chế này — repo không có
  hạ tầng test DOM/component (chỉ `node --test` cho logic thuần), nên xác
  minh dựa vào lint/tsc/build xanh và đọc lại code, không phải test đỏ→xanh.
- **`window.gtag()` gọi trực tiếp trên site thật là cách rẻ để kiểm một tham
  số event có phải tên dành riêng của gtag hay không** (cùng lớp bug với vụ
  `tracking_id` 06/09), không cần đợi ai đó thực sự bấm. Đã dùng để loại trừ
  giả thuyết "`source` (tham số của `newsletter_subscribed`) là tên dành
  riêng" — không phải, `g/collect` trả đúng `tid`. Nhớ dùng giá trị nhận
  dạng được (ví dụ `verify_..._YYYYMMDD`) và trừ nó ra khỏi tổng của báo cáo
  tuần chứa ngày gửi.
- **Bảng phiên GA4 vẫn có thể cộng ra nhiều hơn tổng ở tuần MỚI, dù tuần
  TRƯỚC đó đã settle sạch (0 lệch).** Tuần 06–12/09/2026: 312 tổng nhưng cộng
  các dòng kênh/nguồn ra 329 (thừa 17, ~5.4%) — nhẹ hơn tuần 30/08–05/09 lúc
  đọc tươi (thừa 47/323, ~14.5%) nhưng cùng một loại lỗi. Đây KHÔNG phải lỗi
  đã đóng vĩnh viễn ở lần trước — mỗi tuần mới lại phải kiểm lại từ đầu.
- **`get_page_text` không giữ được hướng mũi tên tăng/giảm của Home report —
  phải zoom màn hình gốc để đọc, đừng suy đoán dấu từ ngữ cảnh.** Đã tự đọc
  nhầm Sessions/Views là tăng (dựa vào số dương "5.7%"/"4.5%" không kèm dấu
  trong text) trong khi thực tế cả hai đều giảm (mũi tên đỏ) — chỉ phát hiện
  ra khi Codex tính chéo `312/331` ra số âm và mình đi zoom lại ảnh gốc để
  xác nhận màu mũi tên.

## Kiểm toàn diện định kỳ 16/09/2026 — đừng đề xuất lại

Mọi gate xanh (lint, tsc, build, 10 audit, 3 test suite, `npm audit` 0 lỗ
hổng) trước khi Codex rà. `node_modules` thiếu `mysql2` sau merge Phase 5 làm
`tsc` đỏ giả — `npm install` là đủ, không phải lỗi code.

**`audit:trademarks` báo giả 26 chỗ vì một comment bị ngắt dòng** — "Asia" cuối
dòng, "Miles®)" đầu dòng sau trong `src/lib/recommendation/engine.ts`, script
học nhầm "Miles" đứng một mình là thương hiệu (cùng lớp lỗi đã ghi 09/09/2026).
Đã nối lại dòng, và tiện tay thêm ® vào hai chuỗi test còn thiếu
(`job-retry.test.ts`, `acceptance.test.ts`) — cả hai chỉ là chuỗi mô tả, không
ảnh hưởng logic đang kiểm.

**Codex rà theo thứ tự hậu quả, tìm 3 lỗi thật — cả ba đã vá, một cái cần vá
lại sau khi chính Codex bác bản vá đầu:**

- **`sync-videos`: `uniqueSlug` giả định SAI rằng mọi entry blogPost mang
  `sys.id` theo quy ước `post-<slug>` của chính job này.** Kiểm tại nguồn
  16/09/2026 qua CMA thật: **23/43 bài (53%) không khớp** — phần lớn là bài
  viết tay qua Contentful UI, `sys.id` do Contentful tự sinh hoặc trùng slug
  LÚC TẠO rồi sau đó tác giả đổi slug (mà `sys.id` không đổi được nên hai
  chuỗi lệch dần). Với 23 bài đó, `entries/post-<slug>` luôn trả 404 dù slug
  đã có người dùng — `uniqueSlug` tưởng còn trống, job đi tạo entry mới, bị
  Contentful chặn ở bước ghi vì `slug` là "Short text (unique)" (xem
  CONTENTFUL.md), và job đỏ vì lý do người trực không đoán được từ thông báo
  cũ. Đã đo trực tiếp bằng CMA thật trước và sau khi vá (slug
  `asia-miles-transfer-bonus-15-rbc-avion`, `sys.id` trùng hệt slug không có
  tiền tố `post-`): bản cũ trả `entryExists("post-...")===false` (SAI), bản vá
  `slugTaken(...)===true` (ĐÚNG). Sửa bằng cách hỏi thẳng
  `fields.slug=<slug>` qua CMA thay vì suy từ `sys.id` — bắt đúng MỌI entry
  đang giữ giá trị đó, kể cả những entry job này từng tạo (chúng luôn tự đặt
  `fields.slug` khớp phần slug trong `sys.id`, nên vẫn được bắt như cũ, không
  hồi quy ca gốc).
  **Vòng Codex bác bản vá bắt được một lỗi fail-open thật trong bản vá đầu:**
  `slugTaken` ban đầu viết `Array.isArray(data.items) && data.items.length >
  0` — một response CMA méo (200 nhưng thiếu hẳn `items`) làm biểu thức đó ra
  `false`, tức "chưa ai dùng slug này", mở khoá cho đúng lỗi vừa vá. Sửa: tách
  riêng, ném lỗi khi `!Array.isArray(data.items)` (fail closed), chỉ trả
  `false`/`true` khi response đúng hình dạng — cùng nguyên tắc
  `fetchVideoUrlsByState` đã áp cho `total`.
  **Khe hở CÒN LẠI, cố ý CHƯA vá (Codex chỉ ra, đã cân nhắc):** `slugTaken`
  đọc qua CMA (bản DRAFT), không phải CDA (bản đang phục vụ). Nếu một bài
  đang publish với slug X mà draft CHƯA publish đã đổi field đó sang Y,
  `slugTaken(X)` sẽ trả `false` sai. Không nguy hiểm hơn tình trạng TRƯỚC lượt
  vá này: bước GHI vẫn bị chính "Short text (unique)" của Contentful chặn (nó
  xét MỌI entry bất kể trạng thái publish), nên hậu quả tệ nhất vẫn là job đỏ
  cần người nhìn, không phải tạo entry trùng âm thầm. Đóng hẳn cần thêm một
  lượt đọc CDA và gộp hai nguồn — rộng hơn phạm vi lượt vá này, để dành nếu
  thực sự gặp lại.

- **`game-record.ts`: `roundTokenAgeMs` cho token dư hậu tố vẫn qua được chữ
  ký hợp lệ, vô hiệu hạn mức 3 lượt/token.** `[payload, mac] =
  token.split(".")` chỉ lấy hai phần tử ĐẦU của mảng — token dạng
  `"<payload>.<mac>.<rác>"` vẫn tách ra đúng `payload`/`mac` gốc (phần rác bị
  destructuring bỏ qua) nên `timingSafeEqual` vẫn khớp. Nhưng
  `game-record/route.ts` dùng CẢ CHUỖI (kể cả phần rác) làm khoá Map của
  `overTokenLimit`, nên mỗi hậu tố khác nhau mở một ngân sách 3 lượt ghi MỚI
  trên cùng một token thật — vô hiệu lớp được chính comment trong file gọi là
  "lớp làm việc thật" (lớp IP 60/giờ vẫn còn, nhưng đó chỉ là lưới an toàn rộng
  tay). Đã kiểm chứng độc lập bằng script tách rời logic ký/so token (không
  qua path alias `@/lib`): bản cũ cho `<token>.rac` vẫn ra tuổi token hợp lệ,
  bản vá (đòi `token.split(".").length === 2`) trả `null` đúng. Payload và MAC
  hợp lệ không bao giờ chứa dấu chấm nên token chuẩn không bị từ chối oan.
  Vòng Codex bác bản vá xác nhận ĐÚNG, không tìm thêm được vấn đề.

- **Ba route công khai (`game-record`, `contact`, `subscribe`) gọi
  `request.json()` mà không có trần kích thước body nào.** Route Handler của
  Next (khác `bodyParser.sizeLimit` của Pages Router cũ) không tự đặt trần.
  Với `game-record`, việc này nghiêm trọng hơn hẳn hai route kia vì
  parse xảy ra TRƯỚC cả hai lớp rate limit của chính route đó (thứ tự đó là
  CỐ Ý — xem comment tại chỗ — nhưng không ai tính tới việc parse tốn tài
  nguyên bất kể thứ tự). Đã thêm `bodyTooLarge()` trong `lib/rate-limit.ts`
  (kiểm header `Content-Length` trước khi parse) và áp vào cả ba route, mức
  trần theo đúng hình dạng payload từng route (4KB/2KB/32KB).
  **Đây CHỈ là fast-path cho client trung thực, KHÔNG phải giới hạn chống DoS
  triệt để — Codex bác đúng chỗ này.** `bodyTooLarge` chỉ tin `Content-Length`
  do client tự khai; một client dùng chunked encoding, bỏ hẳn header đó, hoặc
  khai thấp hơn thực tế vẫn đi thẳng vào `request.json()` với một body lớn.
  Đóng triệt để cần một reader tự đếm byte thực đọc được (không tin header) và
  `reader.cancel()` khi vượt trần — cùng loại việc đã ghi là "cần một phiên
  riêng" cho `api/revalidate` (mục "Việc còn nợ" phía trên). Không mở rộng
  trong lượt vá này vì đây là ba route khác, cần thiết kế + kiểm chứng riêng,
  không phải một dòng sửa kèm theo.
  **`api/revalidate` CŨNG thiếu trần này** (đã có `jobAuthResponse` chặn
  trước, nên không phải bề mặt ẩn danh — nhưng vẫn là endpoint public-facing
  đọc POST JSON không trần byte/thời gian). Chưa vá, gộp chung vào việc "đọc
  body không có hạn giờ" đã ghi ở mục "Việc còn nợ" phía trên — cùng route,
  cùng phiên sửa sau này.

Ba bản vá đã qua lại một vòng Codex bác bỏ (2 BẢN VÁ HỎNG ban đầu, 1 ĐÚNG),
vòng đó bắt được lỗi fail-open thật trong `slugTaken` (đã sửa) và xác nhận
giới hạn thật của `bodyTooLarge` (đã ghi rõ, không mở rộng). `lint`, `tsc`,
`build`, `test:jobs`, `test:game` đều xanh sau bản vá cuối.

## Kiểm toàn diện định kỳ 19/09/2026 — đừng đề xuất lại

Mọi gate xanh trước khi bắt đầu (lint, tsc, build, 10 audit, 3 test suite,
`npm audit` 0 lỗ hổng). Codex rà theo thứ tự hậu quả, ra 3 phát hiện. Một cái
đã vá (và vòng phản biện bắt bản vá đầu HỎNG, phải vá lại), một cái vá theo
hướng KHÁC với đề xuất của Codex, một cái cố ý không vá.

**Đã vá — `rebateAmountInTitle` (`lib/finlywealth.ts`): bộ đọc rebate lấy con
số `$` ĐẦU TIÊN trong `<title>`, không đòi tiêu đề chỉ có đúng một con số.**
Cả HAI đường đọc rebate chép chung một dòng regex
(`\$([\d,]+)\s+.*Rebate from FinlyWealth`): thẻ tín dụng ở `finlywealth.ts`,
tài khoản ngân hàng ở `scripts/check-bank-rebates.mts`. Cả hai đều tự GHI con
số đọc được lên site — `check-rebates` sửa `rebateVi` cộng câu HOT TIP rồi
publish, script kia sửa thẳng `bank-accounts.ts` rồi commit vào `main`. Nên một
tiêu đề hai con số (`"$700 in welcome value plus $200 … Rebate from
FinlyWealth"`) được đọc thành `$700` và site hứa dư $500 với người đọc, không
gate nào đỏ. `"$2,00 …"` cũng qua. Đây đúng lớp lỗi mà chính file này đã vá một
lần (`endsWith("finlywealth.com")` nhận cả `notfinlywealth.com`) và đúng
nguyên tắc fail-closed mà `check-bank-rebates.mts` tự ghi ra cho mình
("không biết là gì thì không được coi là dữ liệu") — chỉ là dòng đọc SỐ chưa
theo nguyên tắc đó.

Đo tại nguồn trước khi sửa: lấy `<title>` thật của cả **39 trang đang dùng**
(10 thẻ từ `applyUrl` trên CDA + 29 tài khoản từ `bank-accounts.ts`). Tất cả
đều là dạng `"$NNN <tên sản phẩm> Rebate from FinlyWealth"` — đúng một con số,
0 trang có hai. Tức đây là vá TRƯỚC KHI CHÁY, không phải chữa một con số đang
sai. Bản vá cho 0/39 lệch so với bản cũ.

**Vòng Codex bác bản vá bắt được BA lỗ mới trong bản vá đầu tiên** — bản đầu bỏ
ràng buộc vị trí, chỉ đếm số `$` trong cả tiêu đề rồi soi. Ba ca nó mở ra:
- `"Rebate from FinlyWealth | Annual fee $120"` → `$120`. Con số đứng SAU cụm
  nhận diện là một con số KHÁC (hậu tố SEO), bản cũ từ chối đúng. Nay chỉ xét
  phần đứng TRƯỚC cụm.
- `"$75abc …"` → `$75`. Bản cũ từ chối (nó đòi khoảng trắng ngay sau chữ số).
  Nay lấy TRỌN cụm tới khoảng trắng rồi mới soi, đuôi lạ là trượt.
- `"$2 000 …"` → `$2`, hụt 998 đô. Cách ngăn nghìn kiểu Pháp; cả bản cũ lẫn bản
  vá đầu đều đọc sai. Nay từ chối khi ngay sau con số là khoảng trắng rồi chữ
  số.

Bất biến nay khoá bằng `src/lib/finlywealth.test.ts` (14 ca, chạy trong
`npm run test:jobs`), không chỉ bằng chú thích — đây là đường ghi tiền lên site
và nó đã hỏng theo hai kiểu khác nhau trong cùng một phiên.

**Đã vá nhưng KHÁC hướng Codex đề xuất — `api/revalidate`:
`newPostNotified === "not-configured"` nay trả 502 thay vì 200.** Thiếu
`KIT_V4_API_KEY` (hoặc token/space CMA) đúng lúc một bài `post` publish lần đầu
là mất bản tin VĨNH VIỄN — `publishedCounter` sang lần publish sau đã là 2 —
trong im lặng tuyệt đối: không dòng log, webhook trong Contentful vẫn xanh.
Lý do cũ ("gọi lại bao nhiêu lần cũng không làm biến ra một token") ĐÚNG cho
lượt purge CDN nhưng SAI ở đây, vì hai chỗ có hậu quả khác hẳn: CDN bẩn tự hết
hạn, bản tin mất thì không. Lập luận quyết định là tính NHẤT QUÁN nội tại:
chính file này đã trả 502 cho Kit 401/422 — cũng là lỗi mà gọi lại không tự
chữa được — với đúng lý do "để lỗi hiện ra trong Contentful". 502 an toàn tuyệt
đối vì cửa kiểm cấu hình nằm TRƯỚC `claimBroadcast` và trước mọi lời gọi Kit.
`"missing_fields"` KHÔNG đi cùng nhánh và đừng gộp vào: lượt giao lại mang đúng
payload cũ nên nó không bao giờ khác đi.
Mình đã bác lập luận này một lần ("env của tiến trình Node chạy dài không thể
tạm thiếu rồi có lại") — nó đúng nhưng không liên quan: vấn đề không phải retry
có chữa được không, mà là lỗi có HIỆN RA hay không.

**Cố ý KHÔNG vá — `updateEntry` PUT chỉ gửi `{ fields }` nên xoá `metadata`
(tag + taxonomy concept) của entry.** Codex đúng về cơ chế: Contentful PUT thay
thế chứ không merge. Nhưng đã đo qua CMA thật ngày 19/09/2026: **cả 81 entry**
(34 `creditCardOffer` + 43 `blogPost` + 4 `transferBonus`) đều có
`{"tags":[],"concepts":[]}`. Sửa đường ghi nguy hiểm nhất repo cho một ca chưa
tồn tại là thêm rủi ro mà không mua được gì hôm nay.
**Điều kiện kích hoạt, để lần sau khỏi đo lại:** ngày nào bắt đầu gắn tag hoặc
taxonomy concept cho entry trong Contentful thì PHẢI sửa `updateEntry` trước
(cho `metadata` của entry vào body PUT) — nếu không, lượt `check-rebates` hay
`expire-offers` kế tiếp sẽ xoá sạch chúng rồi publish, và job vẫn xanh.

**`npm run lint` in 305 warning không phải của repo này.** Một worktree của
phiên Claude Code khác nằm NGAY TRONG repo
(`.claude/worktrees/friendly-engelbart-790a91/`, 588MB), chỉ bị loại khỏi git
bằng `.git/info/exclude` CỤC BỘ nên `git status` sạch và không ai thấy. eslint
thì thấy: nó lint một bản checkout đầy đủ thứ hai của chính repo này. `src/`
thật sự sạch 0 warning. Đã thêm `.claude/worktrees/**` vào `globalIgnores`,
cùng lý do đã ghi sẵn cho `.claude/skills/**`.

**Job và deploy:** 2/20 lượt gần nhất đỏ, cả hai là `sync-videos` và cả hai
KHÔNG phải lỗi code. 18/09 20:23 UTC: `curl (28) Failed to connect to
ghe1a.com port 443` cả 5 lượt — đúng hình dạng Hostinger đã ghi ở các mục
02/09, 05/09, 09/09. 19/09 03:05 UTC: **YouTube trả 404 cho chính feed Atom**
ở cả 5 lượt trong 2,5 phút; gọi lại feed đó từ máy nhà lúc kiểm (8/8 lượt) đều
200 và trả đủ 15 entry, và lượt job 10:17 cùng ngày xanh. Tức YouTube chặn/nấc
theo IP trong một cửa sổ ngắn, không phải channel ID sai. Nếu gặp lại: kiểm
feed từ máy khác TRƯỚC khi nghi `YOUTUBE_CHANNEL_ID`.

**Bổ sung 24/09/2026 (lượt kiểm kế tiếp commit phần trên — nó nằm chưa commit
từ 19/09 vì phiên cũ dừng giữa lúc chờ vòng Codex bác bản vá).** Vòng bác bản
vá chạy lại: `rebateAmountInTitle`, eslint ignore, `test:jobs` đều ĐÚNG. Riêng
nhánh 502 cho `"not-configured"`, Codex chấm BẢN VÁ HỎNG vì thiếu token/space
CMA thì `maybeNotifyNewPost` trả `"not-configured"` TRƯỚC khi kiểm
`publishedCounter` — nên mọi lần publish LẠI một bài Kiến thức/Tips cũng 502,
không riêng lần đầu. Cơ chế đúng, nhưng **cố ý giữ, đừng đề xuất lại**: thiếu
CMA là cấu hình hỏng (chính `check-rebates` và `expire-offers` cũng chết theo),
nên webhook đỏ ở mọi bài thuộc diện gửi bản tin là đúng tín hiệu cần có; lượt
giao lại chỉ purge CDN thêm lần nữa, không thể gửi bản tin vì cửa kiểm nằm
trước Kit. Không có CMA thì cũng không có cách nào biết đó có phải lần publish
đầu hay không — tách nhánh chỉ để webhook "xanh giả" là đi ngược mục đích.
Lượt `sync-videos` đỏ 24/09 03:06 UTC lại là **YouTube 404 cho feed Atom** ở cả
5 lượt, lượt 11:05 cùng ngày xanh — lần thứ hai đúng khung ~03:05 UTC (lần đầu
19/09). Nếu còn lặp đúng giờ này thì là YouTube, không phải code.

## Đo đạc GA4 (20/09/2026) — đừng đề xuất lại

- **Tham số event `source` LỌT VÀO Session source/medium của GA4.** Bằng chứng có
  đối chứng: event thử `source=verify_hero_param_20260913` sinh dòng
  `verify_hero_param_20260913 / (not set)` trong bảng nguồn; dòng `hero / (not set)`
  (2 phiên/tuần) là do `NewsletterForm` gửi `source: "hero"`. Phép thử 13/09 chỉ
  kiểm `tid` (đúng là không bị ghi đè) nên bỏ sót. Đã đổi sang `newsletter_source`
  (`newsletter-form.tsx`). Cơ chế vì sao một số event mở ra phiên riêng: CHƯA RÕ —
  đừng viết "đẻ phiên". GA4 Admin cần đăng ký custom dimension `newsletter_source`
  (dimension cũ `source` ngừng nhận dữ liệu). Cả `medium`/`campaign`/`term`/`content`
  cũng nên coi là tên nguy hiểm.
- **Quy tắc kiểm đếm đôi `CardSpotlight` ở mục 13/09 nay SAI một nửa.** Sau bản vá
  `730a859`, click khối thẻ hợp lệ mang `placement=post_body` + slug THẺ, nên tổng
  `post_body` lớn hơn tổng dòng Product dạng slug-bài là BÌNH THƯỜNG. Kiểm bằng cách
  khác: trên một trang blog, một click khối thẻ chỉ được ra MỘT event (slug thẻ),
  không kèm event mang slug bài. Tuần 13–19/09: N=1, đạt.
- **Trang `/credit-cards/goi-y` có thể bắn `page_view` mỗi bước.** Server Action →
  `redirect(PATH)` → Next `replaceState`; Enhanced measurement của stream
  `Ghế 1A` đang bật "Page changes based on browser history events". 550 view / 9.3
  view-mỗi-người của tuần 13–19/09 rất có thể là view theo bước. Chưa xác nhận bằng
  DebugView. Đừng dùng số view của trang này làm độ phổ biến; engagement time thì
  không bị nhân đôi bởi page_view.
- **Báo cáo *Queries* của GA4-Search Console KHÔNG phải tổng.** Nó chỉ thấy query
  không bị Google ẩn (tuần 13–19/09: 16 click / 47 impression, trong khi tổng thật
  ở báo cáo *Google organic search traffic* (`r=search-traffic`) là 27 / 110).
  Không suy "click phi thương hiệu" từ Queries; dùng landing `/` làm chỉ báo brand.
- **`catch-the-points / game` = 2 GA user quay lại** (0 người mới), 31–39 phiên/tuần,
  không phải luồng người chơi; chưa biết vì sao họ giữ nguồn đó dù UTM đã gỡ.
- **Ngày cuối của cửa sổ (19/09) chưa settle** và chứa cả phần thừa của bảng nguồn.
  Luôn đọc thêm cửa sổ bỏ ngày cuối; "cộng khớp" không đồng nghĩa "đã settle".
- **Đọc GA4 bằng URL:** `apply_clicked` theo Product = `seldim` gồm
  `["unifiedScreenClass","customDimensionsGroup2Slot01"]` (Slot02 = Placement,
  Slot03 = Newsletter source) trên `all-pages-and-screens`, kèm `_r..dataFilters` là
  `[{"type":1,"fieldName":"eventName","evaluationType":1,"expressionList":
  ["apply_clicked"],"complement":false,"isCaseSensitive":true,"expression":""}]`.
  Slot chỉ chạy khi đi CẶP với một dimension chuẩn. Lọc theo nguồn: `fieldName`
  `sessionSourceMedium`. Báo cáo tổng Search Console: `r=search-traffic&collectionId=search-console`.

## Đo đạc GA4 (27/09/2026) — đừng đề xuất lại

- **Phần thừa của bảng nguồn ở ngày cuối tự biến mất khi đọc lại.** Tuần 13–19/09:
  đọc 20/09 thì 19/09 có `(not set)` 46, `(data not available)` 30, Cross-network
  30, các dòng cộng dư 40; đọc lại 27/09 thì các dòng đó không còn (363 vs 364).
  Tuần 20–26/09 lặp lại y hệt ở 26/09 (thừa 9). Không biết GA4 dồn các phiên đó vào
  đâu — chỉ biết bảng hết lạ. Luật giữ nguyên: không trích số ngày cuối.
- **`/calculator` từ `google / organic` từ 21/09 = gần như chắc là tự động, KHÔNG
  phải click Google Search** (điều tra 27/09). Chữ ký: ~2 phiên/ngày rải cả giờ khuya
  (04h, 06h), mỗi phiên 1 user MỚI (`first_visit` mỗi lần), 100% Safari + `iOS 26.6`
  đúng bản đó (người thật cùng tuần rải 26.6/26.6.1/26.6.2) + `393x852` + English,
  `pageReferrer` = `https://www.google.com/`, chỉ `session_start`/`first_visit`/
  `page_view`, không `user_engagement`, 0s, không đi trang nào khác. Trước 21/09 trang
  này chưa từng có phiên Google (tháng 8: 10 phiên direct/Facebook). Bằng chứng quyết
  định: GSC cho `/calculator` **2 impression trong 01/07–26/09, 0 click** — mà bảng
  theo trang của GSC GỒM cả query ẩn danh (các dòng trang cộng đúng bằng tổng 101
  tuần 20–26/09), nên 12 click Search không thể thiếu dấu. Thành phố lẻ (Arnprior,
  Hearst, Mattawa) khớp IP kiểu iCloud Private Relay/nhà mạng, nên KHÔNG đủ để nói
  datacenter. Chưa thấy UA/IP thật — muốn chốt thì đọc access log Hostinger ở đúng
  giờ (`dateHour` trong GA4, múi giờ property). Báo cáo tuần: trừ khỏi Google organic
  và new users; lọc theo bộ ba `/calculator` + `iOS 26.6` + referrer google.com.
- **Game KHÔNG thể bắn event khi mở file trực tiếp** — `embed.js` dừng nếu không ở
  iframe, và chỉ `catch-the-points-frame.tsx` (trang cha) chuyển event sang GA4. Tắt
  cờ trang game là số event game về 0 bất kể file còn hở hay không; đừng đọc số 0
  thành "không ai chơi".
- **Đừng ghép hai phép so khác mẫu thành một khoảng** (Codex bắt 27/09: +58% 6 ngày
  chưa lọc với +17% 7 ngày lọc một phía).
- **`newsletter_subscribed` không phải "subscriber mới"** — bắn sau HTTP thành công,
  người đã có trong Kit cũng tính.
- **Custom dimension đăng ký 27/09:** `newsletter_source` ("Newsletter form"),
  `goal`, `question`. Dimension `source` cũ vẫn còn, ngừng nhận dữ liệu từ 20/09.
- **Đọc GA4 bằng URL, thêm:** phụ thẻ landing = `seldim` `["landingPagePlusQueryString",
  "sessionSourceMedium"]` trên `r=landing-page`; lọc bằng ô tìm kiếm thì thêm
  `_r.explorerCard..filterTerm=<chuỗi>` và `seldim` `["landingPageMinusQueryString",
  "browser"|"city"|"operatingSystemWithVersion"]`. `dataFilters` với
  `fieldName: landingPagePlusQueryString` KHÔNG chạy (báo cáo trắng).

## Luật welcome bonus theo cửa sổ thời gian (21/09/2026) — đừng đề xuất lại

Chi tiết: `src/lib/recommendation/README.md`, mục "Luật welcome bonus theo cửa sổ
thời gian". Điều khoản đọc thẳng trên trang ngân hàng ngày 21/09/2026.

- **Aeroplan® là once-in-a-lifetime THEO LOẠI THẺ, xuyên ngân hàng — user chốt.**
  `previous_cardholder_same_category` trả `fail`, không phải `unknown`. Đừng đề
  xuất hạ về "chưa chắc" vì câu "may not be issued" trong footnote TD®/CIBC®.
- **Ba `anchor` là ba cách đọc điều khoản khác nhau, không gộp.** TD® Aeroplan® đếm
  ngày MỞ; TD® Cash Back đếm mở HOẶC đóng; Scotia Momentum® và National Bank đếm
  việc GIỮ (đang giữ là trượt).
- **CIBC® Aventura®, Scotiabank® Scene+™, TD Rewards KHÔNG có luật thời gian —
  user chốt 21/09/2026** dù footnote ghi 12/24 tháng: thực tế vẫn nhận bonus. Đừng
  đề xuất thêm lại từ footnote.
- **Phạm vi chỉ gồm thẻ có trong kho** (Scotiabank® "mọi thẻ cá nhân" = bốn thẻ
  trên site, chỉ Momentum® còn luật; TD® Aeroplan® Business không đếm được). Giới hạn chung của việc khai
  thẻ; cố ý không biến mọi offer thành "chưa chắc" để bù.
- Nhân viên Scotiabank®,
  chủ thẻ chính/phụ của NBC, 10,000 điểm năm của Passport — cố ý chưa mô hình hoá.
- **Câu hỏi đóng thẻ hỏi THÁNG, ghi ngày muộn nhất** (`closedDateFromAnswer`).
  Đừng quay lại hỏi năm: năm ghi thành 30/06 từng làm một lần đóng tháng 12 lọt
  khỏi cửa sổ 24 tháng. Câu trả lời năm đã lưu (15–21/09) xoá bằng
  `npx tsx scripts/reco-migrate-closed-year.mts --confirm` một lần sau deploy.
- **Bonus `unknown` không được in như chắc chắn**: `welcomeBonusUncertain` trên
  `ActionView`, câu chữ ở `openCardSentence`/`alternativeBonusLead` (present.ts),
  dữ kiện `bonus_uncertain` bắt buộc đi kèm `bonus` ở Phase 6.

## Kiểm toàn diện 25/09/2026 — đừng đề xuất lại

Gate xanh trước khi sửa: lint, tsc, build, 10 audit (trừ `audit:rebates`, xem
dưới), 5 test suite, `npm audit` 0 lỗ hổng, 152 URL sitemap đều 200, `www` 308
về apex, đủ 5 header bảo mật. 13 trang chính ở 375px: không trang nào cuộn
ngang được. `/bay-ve-viet-nam` có `scrollWidth` 382 nhưng `scrollTo(200,0)`
vẫn ra `scrollX` 0 — con số đó đến từ bảng trong khung `overflow-x-auto`,
KHÔNG phải tràn trang.

**Đã vá — link "mở tài khoản" của KOHO Essential Plan trỏ vào trang chết.**
Trang `/rebates/bank-accounts/koho-essential-plan` của FinlyWealth trả tiêu đề
"Not Found" (curl 3/3, trình duyệt thật cũng vậy). Đổi `affiliateUrl` sang
`/banking/savings-accounts/koho-essential-plan` (còn sống, cùng promo code
FW10C26 và cùng 10% cashback tối đa $100 — đúng dạng KOHO Everything đã dùng từ
đầu), bỏ `rebate: "$100"` và câu "…điều kiện để nhận rebate của FinlyWealth".

**Lỗ hổng gốc, đã vá — `check-bank-rebates.mts` biến link chết thành im
lặng.** Nhánh `gone` chỉ xoá dòng `rebate:` rồi thoát 0 ở `--fix`: job xanh,
commit "đã sửa 1 con số", và từ lượt sau tài khoản không còn `rebate` nên
không nhánh nào nhắc tới nó nữa — nút apply rơi vào trang lỗi vô thời hạn.
Nay mọi tài khoản dùng link `/rebates/` mà trang `gone` vào `deadLinks` và làm
exit 1 ở MỌI lượt (không phụ thuộc còn `rebate` hay không) cho tới khi người
đổi link. Bước commit của workflow chạy theo `!cancelled()` nên con số vẫn
được xoá và đẩy lên như cũ, chỉ khác là job đỏ. Đã kiểm cả ba trạng thái: dữ
liệu cũ (exit 1), đã xoá rebate mà link còn chết + `--fix` (vẫn exit 1), đã
đổi link (exit 0). Codex chấm ĐÚNG. Bên thẻ tín dụng không có lỗ này:
`rebateFromTitle` ném khi tiêu đề không có số, nên `check-rebates` đỏ.

**Đã đổi — lịch `sync-videos` từ `0 */6` sang `17 1,7,13,19`.** Phân loại mọi
lượt đỏ từ `gh run view --log-failed`: 08/09–25/09 có 14 lần "youtube feed
failed: 404", TẤT CẢ ở lượt cron 00:00 UTC (nổ thật 02:54–03:31 UTC do hàng đợi
GitHub), 0 lần ở ba lượt kia; lượt kế tiếp lần nào cũng xanh. Nguyên nhân gốc
CHƯA BIẾT — đây là thử giả thuyết khung giờ, không phải chữa tận gốc. Cách
đọc kết quả: nếu 404 đi theo sang lượt 01:17 (nổ thật khoảng 04–05 UTC) thì giả
thuyết sai, lúc đó mới cân nhắc đổi cách xử lý 404 của feed trong route.

**Job `expire-offers` đỏ 25/09 13:05 UTC**: `curl (28) Failed to connect to
ghe1a.com port 443` cả 5 lượt, ~25 phút — đúng hình dạng Hostinger đã ghi ở các
mục trước. `audit:health` xác nhận không có offer hết hạn nào còn treo.

**Codex chỉ ra, đã kiểm và KHÔNG vá:**
- *`getAuthor` rơi về `content/sample/author.json` khi CDA trả 0 author* —
  đúng cơ chế, nhưng file "mẫu" đó chính là bio thật của Hoàng, nên người đọc
  không thấy hồ sơ giả nào. Không phải lỗi.
- *Xô chung của `rateLimit` làm giới hạn 2 lượt/email của `subscribe` thành
  100 lượt chung* khi Map đã đủ 9,999 khoá trong một giờ. Đúng cơ chế, chỉ xảy
  ra lúc site đang bị bơm bởi ~10,000 khoá khác nhau (site ~130 khách/tuần).
  Rủi ro đã biết, cùng đánh đổi đã ghi ở chú thích `OVERFLOW_KEY`; giữ per-email
  trong lúc tràn đòi lưu thêm khoá, tức đúng thứ cái trần sinh ra để chặn.

**Chờ người dùng quyết — engine gợi ý KHÔNG tính rebate FinlyWealth.**
`annualFeeRebate` có trong seed (Tangerine® 120, v.v.) và `audit:reco-data`
đối chiếu nó với Contentful, nhưng không chỗ nào trong
`src/lib/recommendation/` đọc trường này: `offer-quality.ts` chỉ cộng component
welcome offer. Codex đo: đổi rebate Tangerine® 120 → 0 thì giá trị offer và
phí năm đầu y nguyên. Tính vào là đổi thứ hạng, tức quyết định sản phẩm, không
phải sửa lỗi — chưa làm. Trong lúc chờ, đừng báo lại như lỗi mới.

## Audit trang Gợi ý thẻ 25/09/2026 — đừng đề xuất lại

Chạy cả luồng trên bản build local với MariaDB 11.8 (Docker/colima, cổng 3307,
`DATABASE_URL` trong `.env.local` của worktree) — không bấm form trên production.
Engine 4.30.0, prompt giải thích 6.6.0.

**Đã vá:**
- **Thẻ bị chặn welcome bonus đứng hạng nhất.** `spend_fit` của thẻ không có
  mốc chi (bonus bị chặn, hoặc không có offer) là 1.0 kể cả khi CHƯA biết sức
  dồn, trong khi thẻ có bonus nhận 0.5 — chênh 0.105, gần bằng phần
  `offer_quality` thẻ đó mất. Người giữ Amex Cobalt®, đã đóng TD® Aeroplan® Visa
  Infinite* được khuyên mở American Express® Aeroplan®* Card (không bonus) trên
  RBC® Avion® 70,000 điểm, kèm câu "mạnh nhất ở phần mức spend vừa sức bạn".
  Nay chưa biết sức dồn thì mọi thẻ cùng 0.5; biết rồi thì thẻ không mốc vẫn 1.0.
  Đây là ca `u_sparse` mà HANDOFF §9 từng ghi "sát nút vì đúng điểm này" — luật
  Aeroplan® once-in-a-lifetime (21/09) làm nó cắn người thật thường xuyên.
- **Khối chuyến bay trộn hai chương trình.** "Cần" là khoảng GỘP (min/max qua
  mọi chương trình) còn "còn thiếu" và "phủ" đo trên chương trình phủ tốt nhất:
  "cần 280,000 – 476,000 · gom được 60,000 · còn thiếu 350,000" (280k là
  AAdvantage®, 350k là Aeroplan®). Nay đã khai số dư thì "cần" lấy khoảng của
  chính chương trình đó, kèm câu nêu tên chương trình. Chưa khai số dư thì vẫn
  là khoảng gộp.
- **"Không thiếu" ngay trên "phủ khoảng 98%"**: khoảng thiếu đo ở giá điển
  hình, phần phủ ở mức cao nhất. Nay nói rõ cả hai mức.
- **Hai tab / nút Back trên câu danh sách** (thẻ, chương trình điểm): form gửi
  CẢ danh sách dựng từ bản cũ nên xoá im lặng thẻ vừa tick ở tab kia. Form mang
  `v` = version hồ sơ; lệch thì mở lại form trên bản mới kèm câu `staleList`.
  URL chuyển hướng dùng `publicQuestionKey` (không lộ id phiên).
- **Lỗi database khi đọc lượt chạy** hiện "Hồ sơ cũ không chạy lại được" + nút
  xoá cookie → nay `isStorageError` đưa về "Công cụ đang tạm nghỉ".
- Nấc "Dưới $X" của chi tiêu/sức dồn lưu [0, X−1] (trước là [0, X], chạm đúng
  mốc chi nên bị đọc là "sát" thay vì "dưới mốc"). Dải cũ đã lưu in "Tới $X".
- Câu nói quá: `portfolio_covers` chỉ nói khi phép so ĐO ĐƯỢC (raw ≥ 0.75, không
  phải 0.5 trung tính); độ chắc chắn cao nói về gợi ý thẻ, không về mọi con số;
  dòng transfer bonus bỏ "lợi hơn mở thêm thẻ"; khối cảnh báo của "chưa mở thẻ"
  là "Lưu ý", không phải "Đọc kỹ trước khi đăng ký"; không khen "mức spend vừa
  sức bạn" cho thẻ bị chặn bonus.
- a11y: checkbox thẻ có tên thẻ, ô số/tháng nối với câu hỏi, "Sửa: <dòng>",
  câu lỗi `role="alert"`.

**Codex nêu, đã kiểm và KHÔNG vá (Codex đồng ý ở vòng bác):**
- Form "Bắt đầu" ở tab cũ tạo phiên mới — bắt đầu = hồ sơ mới là thiết kế; đổi
  mục tiêu vốn chỉ đi qua "Làm lại từ đầu".
- Hồ sơ `goals: []` rơi về màn hình bắt đầu — không đường nào tạo ra hồ sơ đó.
- `runForDisplay` chạy lại bản cũ khi tab kia vừa lưu; race cookie "bỏ qua"
  giữa hai tab — hẹp, tự lành ở lần tải sau.
- `EXPLANATION_MODEL = "claude-opus-5"` là model ID hợp lệ (đã tra skill
  claude-api); request không gửi tham số nào Opus 5 từ chối.

## Kiểm toàn diện 26/09/2026 — đừng đề xuất lại

Gate xanh: lint, tsc, build, 8 audit (`trademarks`, `awards`, `rebate-prose`,
`rebates`, `health`, `reco-data`, `best-cards`, `card-mentions`), 5 test suite,
`npm audit` 0 lỗ hổng, 8 URL chính 200, `www` 308 về apex, đủ 5 header bảo mật.
`audit:health`: không có gì cần người nhìn, cả phần "Nhắc" cũng trống.

**`npm run build` đỏ giả: "Can't resolve '@vercel/turbopack-next/internal/font/google/font'
… next/font/google queries have exactly one entry".** Do cache `.next` cũ hỏng
(CI xanh trên cùng commit, mạng tới Google Fonts vẫn 200). Dời `.next` đi rồi
build lại là xanh. Gặp lại lỗi này thì làm vậy trước khi nghi code.

**Giả thuyết khung giờ của `sync-videos` (mục 25/09) SAI.** Lượt `17 1` nổ
06:10 UTC 26/09 vẫn "youtube feed failed: 404" cả 5 lượt; lượt 12:15 xanh. Tức
404 bám theo lượt ĐẦU NGÀY (UTC), không theo giờ đồng hồ. Nguyên nhân gốc vẫn
chưa biết. Bước thử kế tiếp đã làm: route gọi feed playlist Uploads
(`playlist_id=UU` + phần sau `UC`) khi feed kênh trả 404. Đo 26/09: sau khi parse,
hai feed giống hệt (15 entry, cùng videoId, cùng 4 Shorts, cùng ngày đăng).
Vòng Codex bác bản vá chấm bản đầu HỎNG: feed 200 rỗng/sai cấu trúc được đọc
thành `checked: 0` → xanh giả. Nay feed 200 phải có ≥1 `<entry>` và MỌI entry
mang `<yt:channelId>` của đúng kênh, `<yt:videoId>` và `<published>` (vòng bác
thứ hai bắt entry chỉ có channelId vẫn lọt), không thì ném (áp cả hai feed; lưu ý thẻ
`yt:channelId` ở đầu feed kênh bị YouTube cắt mất `UC`, nên chỉ kiểm trong entry).
Mã khác 404 vẫn ném ngay, cả hai 404 thì job đỏ như cũ.
**Cách đọc kết quả:** body thành công nay có `feedSource`. Lượt đầu ngày mà ra
`"uploads-playlist"` là fallback đang làm việc; nếu lượt đó ra
"channel: 404, uploads-playlist: 404" thì YouTube chặn cả dịch vụ feed lúc đó,
bước sau là cân nhắc bỏ qua đúng một lượt 404 thay vì thêm nguồn.

**Đã vá — `coverageStatement` làm tròn phần phủ lên 100% khi vẫn còn thiếu.**
139,999/140,000 điểm in "phủ khoảng 100%" ngay cạnh "còn thiếu 1 điểm". Nay
trần 99% (ở nhánh đó phần phủ luôn < 1). Trang và lời giải thích Phase 6 đều đi
qua hàm này, không có chỗ in phần trăm phủ nào khác. Codex chấm ĐÚNG.

## Kiểm bảo mật toàn diện 26/09/2026 — đừng đề xuất lại

Gate: lint, tsc, build, `test:reco`/`recommender`/`jobs`/`game`, `npm audit` 0
lỗ hổng (cả dev), lịch sử git không có secret nào (quét mẫu khoá Anthropic,
Contentful CFPAT, Resend, GitHub, AWS, Google, private key). Repo **công khai**,
`default_workflow_permissions` của repo là `read`.

**Đã vá:**
- **Game đã gỡ vẫn 200 trên production.** Hostinger phục vụ thẳng `public/` từ
  ổ đĩa, KHÔNG qua Next — response của `/games/catch-the-points/index.html`
  không mang header nào của Next (không `x-nextjs-*`, không header bảo mật),
  nên `src/proxy.ts` chưa bao giờ chạy với các file đó. Nay file game ở
  `games/catch-the-points/web/`, phục vụ bằng route handler dựng tĩnh
  (`generateStaticParams` + `dynamicParams = false`): cờ tắt thì không dựng gì,
  mọi đường là 404 — không phụ thuộc Hostinger làm gì với `public/`. **Hệ quả
  chung: đừng dựa vào `proxy.ts`/middleware để chặn bất cứ thứ gì nằm trong
  `public/`**, và file trong `public/` không có header bảo mật của
  `next.config.ts`. `proxy.ts` đã xoá — nó còn làm Next buffer MỌI body POST
  (tới 10MB, `proxyClientMaxBodySize`) trước khi route kịp từ chối.
- **Trần body chỉ tin `Content-Length`** (việc còn nợ ghi ở mục 16/09 và mục
  "Việc còn nợ" của `api/revalidate`). `readJsonBody` trong `lib/rate-limit.ts`
  đếm byte thật từ stream, `reader.cancel()` khi vượt trần hoặc hết giờ, và gắn
  `catch` rỗng cho lượt `read()` đang treo (rejection không ai bắt = Node dừng
  cả site). Áp ở contact/subscribe/game-record/revalidate. Revalidate đọc trong
  phần còn lại của ngân sách 25s, trần 8 MB (entry lớn nhất đo được ~30 KB,
  nhưng riêng một trường Rich Text đã được tới 1 MB); hết giờ →
  `"payload_timeout"`, vượt trần → `"payload_too_large"`, cả hai 502 — an toàn
  vì nằm trước `claimBroadcast` và trước Kit. **Vượt trần KHÔNG được đọc thành
  `"no_payload"`**: đó là 200, bài ra đời không bản tin mà webhook vẫn xanh
  (Codex bắt ở vòng review, bản đầu làm đúng như vậy). Đã thử: chunked 200 KB → 413, `Content-Length` khai gian →
  413, body treo → timeout đúng hạn, kết nối đứt → `invalid`.
- **Trần chung toàn site** cho `contact` (30/giờ) và `subscribe` (60/giờ), đếm
  SAU khi body hợp lệ và sau trần theo IP/email. Bản đầu của contact đếm ở
  đầu route — Codex tái hiện: 30 POST `{}` từ 30 IP là khoá form cả site một
  giờ. Trần chung đặt trước bước validate là tự dựng đường DoS. Câu hỏi `X-Forwarded-For` (mục 30/08) vẫn chưa có đáp
  án từ Hostinger, nhưng nó thôi quyết định thiệt hại tối đa: xoay header giờ
  chỉ vượt được xô IP, không vượt được trần chung.
- **CSP thật**, định nghĩa ở `lib/content-security-policy.ts`. **Edge Hostinger
  GHI ĐÈ header `Content-Security-Policy` của app** bằng bản
  `upgrade-insecure-requests` của nó (kiểm ngay sau deploy, trên trang tĩnh,
  động lẫn 404) — nên bản có hiệu lực trên production là thẻ
  `<meta http-equiv>` trong `app/layout.tsx`; header chỉ còn tác dụng ở local.
  Bản meta không mang `frame-ancestors` (meta không hỗ trợ), chiều đó do
  `X-Frame-Options` lo — header ấy Hostinger để nguyên. Đừng "dọn" thẻ meta vì
  tưởng trùng với header. Trang lỗi Next tự dựng ngoài root layout (`_global-error`, 404 dựng sẵn của
  route đang tắt cờ) không có meta — chấp nhận: không nội dung nào từ người
  dùng hay Contentful đi vào đó (Codex P3, đã cân). `'unsafe-inline'` cho script là cố ý
  (nonce = mọi trang thành động). Iframe bình luận Cusdis là `srcdoc` nên THỪA
  KẾ CSP của trang — cusdis.com phải có trong script/style/connect. Đã soát
  console 7 loại trang: không vi phạm nào; script từ host lạ bị chặn đúng.
- `poweredByHeader: false`. Muốn biết bản đang chạy có phải app Next không thì
  nhìn `x-nextjs-cache`/`etag`/`content-security-policy` đầy đủ, không còn
  `x-powered-by`.
- `permissions` tối thiểu khai tường minh ở 4 workflow còn thiếu.
- Tên database/user MySQL và host Remote MySQL gỡ khỏi `HANDOFF.md` và README
  module (repo công khai). Vẫn còn trong lịch sử git — không phải bí mật (thiếu
  mật khẩu, Remote MySQL lọc theo IP), nên không viết lại lịch sử.
- `video-embed`: so host đúng tên (`includes("youtube.com")` nhận cả host lạ),
  ID YouTube đúng 11 ký tự, Vimeo id là số. Kiểm 27/27 video đang có vẫn nhúng.
- Tiêu đề thư của form liên hệ bỏ CR/LF.

**Đã kiểm và KHÔNG phải lỗi:** debugger admin (`recoDebuggerEnabled`: chỉ dev
hoặc `RECO_DEBUGGER=1`, `applyAssignment` chặn `__proto__`); Server Action
trang gợi ý (cookie httpOnly/secure/lax, id 128 bit, `?loi=` chỉ nhận mã lỗi đã
biết); JSON-LD escape `<`; `safeHref` cho thân bài; escape HTML email; feed XML
escape; `/.env`, `/.git/*` trên production 403; job route chỉ nhận Bearer so
constant-time; `finlywealth` chỉ fetch đúng host.

**Ngoài phạm vi bảo mật, phát hiện khi soát CSP:** khung bình luận Cusdis hỏng
SẴN trên production (trước bản vá này): `cusdis.com/js/iframe.umd.js` bị chặn
CORS (không có `Access-Control-Allow-Origin`), khung `srcdoc` trống.

## Kiểm toàn diện 27/09/2026 — đừng đề xuất lại

Gate xanh: lint, tsc, build, 8 audit, 4 test suite, `npm audit` 0 lỗ hổng, 8
URL chính 200, `www` 308 về apex, đủ 5 header bảo mật, CSP meta có mặt trên
trang chủ. `audit:health`: không có gì cần người nhìn, phần "Nhắc" trống.
Job: `sync-videos` đỏ 26/09 17:13 UTC là `curl (28)` tới ghe1a.com cả 5 lượt —
Hostinger, không phải code.

**404 của feed YouTube là dịch vụ feed của YouTube sập, không phải kênh này.**
Lúc 04:08 và 04:19 UTC 27/09/2026, gọi từ máy nhà: feed kênh, feed playlist
`UU…` VÀ feed của một kênh đối chứng không liên quan (Google for Developers,
`UC_x5XG1OV2P6uZZ5FSM9Ttw`) đều 404. Tức fallback uploads-playlist (mục 26/09)
KHÔNG cứu được ca này — hai feed cùng một dịch vụ, sập cùng lúc. Đừng thêm
nguồn feed thứ ba cùng họ `feeds/videos.xml`, và đừng nghi channel ID hay IP
runner nữa. Job đỏ một lượt đầu ngày là giá chấp nhận được (lượt sau luôn
xanh, video không mất vì feed giữ 15 entry).

**Đã vá — cửa kiểm hình dạng feed quên `title`.** `parseFeed` bỏ qua entry
thiếu hoặc rỗng `<title>`, nhưng cửa kiểm chỉ đòi channelId/videoId/published,
nên feed 200 mà entry thiếu tiêu đề ra `checked` hụt và job xanh giả (Codex).
Regex `<title>[^<]+</title>` không khớp nhầm `<media:title>` (đã thử tổng hợp:
đủ → ok; rỗng, thiếu, chỉ còn `media:title` → hỏng). Vòng Codex bác bản vá chấm
ĐÚNG, không thấy hồi quy (entity, emoji, ký tự đặc biệt trong tiêu đề vẫn qua).

## Audit trang Gợi ý thẻ 27/09/2026 — đừng đề xuất lại

Chạy cả luồng trên bản build local + MariaDB 11.8 (colima, cổng 3307) cho cả
chín mục tiêu, 375px, hai tab — không bấm form trên production. Engine 4.31.0,
lời giải thích 6.7.0. Codex: review từng commit, một vòng bác bản vá (3 "ĐÚNG
NHƯNG BẢN VÁ HỎNG", đã vá), vòng chốt "CÒN CHẶN PUSH: KHÔNG".

**Đã làm:**
- **11 thẻ mang `eligibility_unknown`** — gồm Amex® Green/Gold/Cobalt®, ba thẻ
  được gợi ý nhiều nhất — nên MỌI kết quả có chúng kèm "chưa kiểm được hết
  điều kiện của ngân hàng" và −0.05. Đọc trên trang ngân hàng 27/09: Amex®
  Canada ghi mục Eligibility TRỌN VẸN (cư trú + hồ sơ tín dụng + đủ tuổi,
  không thu nhập) → `minimum_personal_income` 0 đã kiểm; Scotiabank® Gold Amex
  $12,000 cá nhân (một vế); Passport™ VI "$60,000 - $80,000" → cận dưới như
  Momentum® đã có; CIBC® Aeroplan® VI $60K/$100K; Neo United® và Wealthsimple®
  VI+ $80K/$150K. Tài khoản chequing Wealthsimple® là `banking_relationship_required`
  **soft** (mở được lúc đăng ký — `hard` sẽ mãi `unknown`) và hiện thành dòng
  lưu ý trên trang (`prerequisites`), vì engine bỏ qua luật soft.
- **Bảng giá CANADA_US → EUROPE.** Aeroplan®: PDF "Flight Reward Chart" bản
  2026-08, trang "North America – Atlantic" (band RIÊNG 0–4,000/4,001–6,000/
  6,001–8,000/8,001+). Band tính từ toạ độ 8 thành phố × 17 sân bay: 52 cặp
  band 1, 83 cặp band 2, nối chuyến lên band 3 → thấp/điển hình/cao = band
  1/2/3, như chặng Nhật. AAdvantage®: bảng trên aa.com (widget nằm trong
  shadow DOM — đọc `adc-content-table`), Europe 22,500 off-peak/30,000/40,000/
  57,500. KHÔNG có Asia Miles® (Cathay không bay chặng này; bảng đối tác không
  công bố). Bảng Pacific trong PDF 2026-08 khớp nguyên số đang dùng.
- **Chặng nội địa là chỗ trống IM LẶNG** — `gaps.ts` bỏ qua đích CANADA_US nên
  mục tiêu "bay trong Canada / Mỹ" không có bảng giá mà §29 không trừ độ tin
  cậy. Engine 4.31.0 khai nó; `audit:reco-data` cũng đếm.
- **Khối chuyến bay in điểm giữa [0, 1] thành "phủ khoảng 50%"** khi khai có
  tài khoản mà chưa nói số dư, cạnh "gom được 0 điểm (ít nhất)". Nay: phần
  phủ ước lượng chỉ nói phần ĐÃ BIẾT của chương trình đang hiển thị ("số điểm
  đã biết của bạn phủ khoảng X%"), câu đuôi theo nguồn chỗ chưa chắc (số dư /
  giá sàn), "Bạn gom được" là "Chưa biết" khi cận dưới bằng 0, và có link khai
  số dư — chỉ cho chương trình định giá được chặng hoặc nguồn chuyển sang nó.
- **Phễu GA4:** `recommender_started {goal}`, `recommender_answered {question}`,
  `recommender_skipped {question}`, `recommender_reset` — listener `submit` ở
  document đọc `data-reco-event`, form vẫn chạy không cần JS.
- Ngõ vào: cuối trang thẻ, trang so sánh (cả nhánh chưa chọn thẻ), từng mục
  Các thẻ tốt nhất. Ô tìm kiếm đã có từ trước.
- `issuers.ts`: link chính thức Wealthsimple® `/en-ca/product/card` là 404.

**Cố ý KHÔNG làm (Codex nêu hoặc tự thấy):**
- **Không dựng bảng giá nội địa.** Bảng hãng chỉ có Aeroplan® (toàn giá động
  trên Air Canada®/United® — cột đối tác cố định gần như không áp trong nội
  địa) và AAdvantage®; cách đổi vé nội địa phổ biến là bảng điểm cố định Avion®
  /Aventura® và WestJet dollars, mô hình chưa có. Dựng riêng Aeroplan® làm gợi
  ý lệch. Chờ quyết định sản phẩm (HANDOFF §0).
- **Không gửi câu trả lời lên GA4**, kể cả "chưa có thẻ nào" (`answer_none` đã
  gỡ ở vòng bác bản vá) — chỉ loại câu hỏi và mục tiêu.
- **Phần phủ ước lượng không nói "ít nhất".** Mẫu số là cận trên của KHOẢNG MÔ
  HÌNH (band 3 châu Âu), không phải trần của mọi hành trình — "ít nhất 83%" với
  50,000 điểm sai ở band 8,001+ (66%).
- Scotiabank® Passport™/Momentum® dùng cận dưới $60K của khoảng "$60,000 -
  $80,000": cận trên loại oan người mà ngân hàng tự nói vẫn xét. Vế tài sản
  (AUM) chưa mô hình hoá, như Tangerine.
- Test "vùng chưa định giá" và "thẻ chưa biết điều kiện" đọc kho ở ngày TRƯỚC
  27/09 hoặc gỡ bảng giá khỏi bản sao — đừng viết lại để bám vùng đang trống.


## Kiểm bảo mật toàn diện 28/09/2026 — đừng đề xuất lại

Gate xanh: lint, tsc, build, 5 test suite (597 test), `npm audit` 0 lỗ hổng,
không secret nào trong các commit từ 26/09. Production (chỉ GET): `/.env`,
`/.git/config`, `/.htaccess` 403; file nguồn/`AGENTS.md`/`.next` 404;
`/admin/reco-debugger` 404; job route không Bearer 401; đủ 5 header bảo mật.
Codex: một vòng audit độc lập + một vòng bác bản vá (cả 4 ĐÚNG, "CÒN CHẶN PUSH:
KHÔNG", "CÒN LỖ HỔNG KHAI THÁC ĐƯỢC SAU BẢN VÁ: KHÔNG").

**Đã vá:**
- **POST công khai treo body vô hạn (Medium, Codex).** contact/subscribe/
  game-record gọi `readJsonBody` không có hạn giờ: gửi nửa body rồi giữ kết
  nối là giữ request ở `reader.read()` mãi, trước cả trần chung (trần chung
  đếm sau khi body hợp lệ). Nay `timeoutMs` BẮT BUỘC trong chữ ký — không thể
  quên lần nữa — `PUBLIC_BODY_TIMEOUT_MS = 10_000`, hết giờ trả 408 (form
  contact/newsletter và game đều coi là lỗi, không báo thành công nhầm).
- **`url` của transfer bonus đi thẳng vào `href`** mà không qua `safeHref`
  (React 19 chặn `javascript:` nhưng không chặn `data:` hay các hình dạng đổi
  host). Nay qua `safeBonusUrl`; không qua thì trỏ về `/transfer-bonuses`.
- `skipQuestion` không ghi khoá mà `skippedQuestions` không đọc lại được.
- `appleboy/ssh-action` pin theo SHA (action bên thứ ba cầm khoá SSH).

**Đã cân và KHÔNG làm:** pin `actions/checkout`/`setup-node` theo SHA (action
chính chủ GitHub, repo không có Dependabot để cập nhật SHA); cookie bỏ-qua có
thể vượt 4 KB nếu CHÍNH người dùng tự gửi 64 khoá dài — chỉ tự hại mình.

## Kiểm SEO toàn diện 29/09/2026 — đừng đề xuất lại

Crawl 154 URL sitemap trên bản build cục bộ: 0 lỗi status, 0 title/description
trùng, canonical tự trỏ đúng (mọi biến thể `?type=`/`?points=`/`?cards=`/`?utm_`
về trang trần), 1 h1/trang, không nhảy cấp heading, 0 ảnh thiếu alt, JSON-LD
parse sạch và đủ field bắt buộc (BlogPosting, VideoObject lồng trong `video`,
BreadcrumbList, CreditCard, BankAccount, ItemList). 404 có `noindex`, thẻ Mỹ
`noindex, nofollow` đúng cờ. Search Console: sitemap Success 153 URL, 108 index,
5 không index đều là ca đã biết (xem mục GSC trong memory), Breadcrumbs 0 lỗi.

- **LCP 4–5 s của Lighthouse mặc định là ẢO khi LCP là chữ (h1).** Lantern
  (throttling mô phỏng) dồn cả JS vào "render delay"; chạy lại
  `--throttling-method=devtools` thì LCP = FCP ≈ 1.7 s. Đừng tối ưu theo con số
  đó; đo bằng devtools throttling trước khi kết luận.
- **Đã vá — ảnh LCP của `/blog` và trang chuyên mục bị `loading="lazy"`.** Thẻ
  đầu của lưới nay `preload` (`PostCard` → `VideoThumbnail`). `/blog` mobile LCP
  2.9 → 2.1 s (devtools), desktop 1.1 s, chuyên mục 0.8 s; desktop cũng chọn
  đúng thẻ đầu làm LCP nên preload một ảnh là đủ.
- **Cố ý KHÔNG bật AVIF** (`images.formats`): encode chậm gấp nhiều lần WebP
  ở lượt đầu, mà cache `/_next/image` mất sau mỗi deploy — site deploy hằng
  ngày vì các job cron, nên khách đầu tiên sau mỗi deploy trả giá.
- Vấn đề còn lại nằm ở NỘI DUNG, không ở code: query tìm ra site 28 ngày qua
  toàn tiếng Anh tên sản phẩm (`amex green card`, `bmo premium chequing
  account`, `how to get us credit card in canada`) ở vị trí 20–90; 36 trang
  video dưới 300 chữ tiếng Việt (xem SEO.md mục 2.3).

## Kiểm toàn diện 30/09/2026 — đừng đề xuất lại

Gate xanh sau khi sửa: lint, tsc, build, 8 audit, 6 test suite, `npm audit` 0 lỗ
hổng, 8 URL chính 200, `www` 308 về apex, đủ 5 header bảo mật. Codex rà theo
thứ tự hậu quả + diff `55bdd6b..HEAD`: không lỗi mới.

**Đã vá — trang `/credit-cards/tot-nhat/offers` in 110,000 điểm Bonvoy® suốt
hai ngày sau khi offer hạ còn 70,000.** Tác giả sửa hai thẻ Marriott Bonvoy®
trong Contentful ngày 28/09 (cá nhân 70,000, doanh nghiệp 80,000, hết elevated);
đoạn văn viết tay trong `best-cards.ts` nằm nguyên. `check-rebates` đỏ 4 lượt
liền từ 28/09 16:57 UTC — cửa canh `bestCardsProseDrift` làm đúng việc, chỉ là
không ai nhìn. **Đổi welcome bonus của thẻ nào có mặt trong `best-cards.ts` thì
chạy `audit:best-cards` ngay**, đừng đợi job đỏ.

- Câu kết của mục offers KHÔNG còn con số Bonvoy®. Bản vá đầu ghi "70,000 điểm
  Bonvoy®", Codex bác: trùng đúng con số của RBC® Avion® trong cùng câu, mà
  audit đoạn kết chỉ đòi số khớp MỘT thẻ bất kỳ của mục — lần sau Bonvoy® đổi
  mà quên đoạn kết thì vẫn xanh. Bỏ số là hết chỗ để lệch.
  Giới hạn còn lại, không vá: chừng nào Bonvoy® còn đứng ở 70,000 thì chữ "RBC®
  Avion® 70,000 điểm" trong đoạn kết được chính entry Bonvoy® che. Pick Avion®
  vẫn có `sharedFiguresVi` canh riêng nên Avion® đổi thì job vẫn đỏ.
- Thẻ này còn xứng đứng trong mục "offer tốt nhất" ở mức thường 70,000 hay
  không là quyết định biên tập — đã báo tác giả, không tự gỡ.

**Đã vá — engine gợi ý coi hai thẻ Bonvoy® là KHÔNG có welcome bonus.** Hai
seed 110,000 đóng ở `endDate` 22/09 và không có bản nối tiếp; `audit:reco-data`
chỉ cảnh báo (`⚠︎ chưa có offer nào`). Thêm hai seed mới (`startDate`
28/09 — ngày Contentful đổi, Amex® không ghi ngày), mốc chi chép từ
`editorsTakeVi`. Snapshot engine không đổi vì nó cố định ở 08/09.

**`audit:rebates`: Neo™ Savings $75 → $50, KOHO Extra $100 → $75** (FinlyWealth
hạ sau lượt job 23:57 UTC 29/09). `$100` trong `bonusLabelVi` của KOHO Extra là
cashback của KOHO, không phải rebate — đừng sửa theo.

**`audit:trademarks` báo giả 37 chỗ "Business℠"** — học từ một comment trong
`us-credit-cards.ts` ("Sapphire Reserve for Business℠": chữ "for" viết thường
cắt cụm, nên script chỉ học "Business"). Đã viết lại comment. Cùng lớp lỗi với
các ca ngắt dòng 09/09 và 16/09: thấy một TỪ ĐƠN phổ thông bị đòi ký hiệu thì
tìm chỗ script học nó, đừng sửa 37 chỗ.

**Job đỏ, không phải lỗi code:** `sync-videos` 30/09 06:46 UTC "channel: 404,
uploads-playlist: 404" (lượt đầu ngày UTC, đúng mục 27/09); `sync-videos` 29/09
06:58 UTC HTTP 403 cả 5 lượt (Hostinger chặn runner). `check-rebates` 29/09
23:50 UTC còn kèm một timeout FinlyWealth cho `scotiabank-scene-plus-visa-students`
cả 3 lượt — trang đó gọi lại hôm nay 3/3 lượt 200 trong <2.5s.

## Kiểm toàn diện 01/10/2026 — đừng đề xuất lại

Gate xanh: lint, tsc, 5 test suite, 10 audit, mọi job GitHub trong ngày. 73 trang
thẻ (35 Canada + 38 Mỹ) 200, JSON-LD parse sạch, không ảnh hỏng, không tràn ngang
ở 375px. Welcome bonus 35 thẻ Canada đối chiếu trang ngân hàng / FinlyWealth: 32 khớp.

**Đã sửa (Contentful, theo yêu cầu tác giả):**
- **Ba thẻ Amex® doanh nghiệp chạy offer nâng mà site ghi mức thường.** Business
  Platinum 150,000 (100,000 khi chi $15,000/3 tháng + 50,000 khi quẹt ở tháng
  15–17), Aeroplan® Business Reserve 120,000 (80,000 khi chi $10,500/3 tháng +
  40,000 khi chi $3,500 ở tháng 13), Business Gold 90,000 (60,000 khi chi
  $7,500/3 tháng + 30,000 khi chi $30,000/năm). Kiểm bằng ĐÚNG đường Apply của
  site (FinlyWealth `/go/creditCards/<slug>` → CJ → amex.ca `?CPID=`), xem
  memory "Amex CA offer gate theo kênh". Amex® không ghi ngày kết thúc nên
  `elevatedBonus: true` mà không có `expiresAt` (như TD First Class Travel® và
  CIBC® Aventura®) — mỗi lượt rà phải mở lại, mất nhãn "ELEVATED OFFER" thì tắt tay.
  Seed engine: bản mới `startDate` 01/10, bản cũ `endDate` 30/09.
- **Phí ba thẻ Amex® Aeroplan® tăng từ 12/01/2027** (Aeroplan® $120 → $150,
  Reserve và Business Reserve $599 → $799, thẻ phụ cũng tăng). Tác giả chốt: GIỮ
  phí hiện tại làm con số chính, ghi phí mới vào phần ngoặc của `annualFeeVi`
  ("…; từ 12/01/2027: $799/năm, …") — `splitAnnualFee` đưa nó xuống dòng ghi chú
  nhỏ, còn `feeIn` của audit vẫn đọc số đầu chuỗi. `product_fees` có dòng thứ hai
  `from: "2027-01-12"`. Sau ngày đó phải sửa tay `annualFeeVi` (đưa phí mới lên đầu).
- Scotiabank® Gold American Express®: `keyBenefitsVi` nay nêu mốc chi (30,000 khi
  chi $2,000/3 tháng + 20,000 khi chi $7,500/năm). Seed engine: bản ghi MỚI
  `recordedFrom` 01/10, bản `incomplete` cũ đóng `recordedTo` 30/09 — lấp mốc chi
  vào bản cũ là viết lại lịch sử (`knownAt` trước 01/10 sẽ thấy chúng; Codex bắt).
  Cảnh báo `incomplete` của bản cũ còn hiện trong audit, như hai bản Bonvoy® đã đóng.
  Test `điều khoản offer CHƯA BIẾT` ghim vào offer Bonvoy® cá nhân đã đóng thay vì
  "offer chưa rõ đầu tiên" — cách cũ trôi theo dữ liệu sống và nhảy sang thẻ
  doanh nghiệp (bị loại trước bước xét điều khoản).
- `audit:reco-data` thôi coi `expiresAt` trên thẻ không elevated là "ngày sót":
  `expire-offers` XOÁ ngày đó khi hạ thẻ. Passport™ và Scene+™ Students mang
  01/11/2026 là hạn thật của offer thường (scotiabank.com: tài khoản mở tới
  01/11/2026); seed Passport™ có bản ghi mới mang `endDate` từ 01/10 (cùng lý do
  với Gold, Codex bắt ở vòng bác bản vá).
- Meta description thẻ: headline 90–100 ký tự không còn chỗ cho câu đuôi 71 ký
  tự nên dừng ở 95–98 ký tự (6 trang) — thêm `cardTailShort`.

## Kiểm toàn diện trang thẻ tín dụng 02/10/2026 — đừng đề xuất lại

Gate xanh: lint, tsc, 7 audit, test reco/jobs/card-tags. 35 link Apply tới đúng
trang đích (FinlyWealth `/r/` là trang chuyển hướng JS, tiêu đề chung — đọc
tiêu đề của chính đường dẫn `url=` mới biết trang đích còn sống), chip lọc cộng
đủ 35, sắp xếp đúng, số trên trang live khớp CDA 35/35.

**Đã sửa (Contentful) — offer nâng 01/10 của ba thẻ Amex® doanh nghiệp hết sau MỘT
ngày.** Đường Apply của site và trang công khai amex.ca đều về mức thường:
Business Platinum 120,000, Aeroplan® Business Reserve 90,000, Business Gold
70,000. Khôi phục chữ từ snapshot Contentful ngay trước 01/10 (giữ ghi chú phí
2027), tắt `elevatedBonus`. Bản cũ của Business Gold có câu lộ tên field
`elevatedBonus` cho người đọc — đã bỏ, không chép nguyên văn. Seed engine: bản
nâng đóng `endDate` 01/10, bản thường mới từ 02/10. TD® Aeroplan® Visa Infinite:
headline "giá trị đến $1,790" → $1,550 (TD đổi con số marketing).

**Đã vá — `expire-offers` hạ offer mà ô số lớn giữ welcome bonus cũ vĩnh viễn**
(Codex tìm, đã kiểm). `rewriteOfferCopy` chỉ viết lại headline/keyBenefits/
editorsTake, còn `welcomeBonusVi` (con số của `OfferStats`) nằm nguyên, và job
xoá `expiresAt` nên không lượt nào quay lại. Nay `welcomeBonusVi` nằm trong bản
viết lại (rỗng = thẻ hết bonus → gỡ field), và nhãn mới giống hệt nhãn của offer
vừa hết thì ném (giữ `expiresAt`, job đỏ). Vòng Codex bác bản vá đầu: cửa "số
trong nhãn phải có trong headline" vừa chặn oan ("$300" ở nhãn, headline chỉ nói
mức chi) vừa để lọt (headline nhắc "mức cũ 110,000 đã hết" là cấp phép cho nhãn
110,000) — đã bỏ, đừng đề xuất lại.

**Ba phát hiện phụ của Codex, đã kiểm:**
- *KHÔNG vá — meta/thân trang chi tiết lệch do đọc danh sách thẻ 3 lần.* Trong
  `unstable_cache` (node_modules/next/.../unstable-cache.js), entry còn (kể cả
  stale) thì các lời gọi cùng request dùng chung `pendingRevalidates`: fresh 0
  lượt tải, stale 1 lượt. Chỉ ngay sau webhook `expire: 0` mới 3 lượt song
  song; lệch chỉ khi CDA trả hai phiên bản trong ~100ms đó, chưa từng thấy ở dữ
  liệu thật, và trễ lan truyền CDA sau publish vẫn còn dù có gộp.
- *ĐÃ VÁ — `getPosts()` lỗi làm sập trang thẻ.* Mình từng cho là ISR giữ trang
  cũ; Codex bác đúng: `expire: 0` của webhook làm hết hạn cả HTML trang thẻ
  (file-system-cache trả `null` cho tag đã expired), nên không có bản cũ để lui
  về. Nay `getPosts().catch(() => [])` + `console.error` trên trang chi tiết.
- *ĐÃ VÁ — `offer-history` đọc "2 đêm miễn phí" thành 2 điểm.* `unitOf` chỉ trả
  "points" khi nhãn nói điểm/miles; còn lại "other" và `welcomeBonusPeak` im
  lặng. 36/36 nhãn lịch sử giữ đơn vị cũ; engine loại mốc "other" khỏi percentile.

## Kiểm tối ưu điện thoại 03/10/2026 — đừng đề xuất lại

Cách đo, dùng lại được: bản build cục bộ (`next start`), quét MỌI URL trong
sitemap (199 trang) bằng iframe cùng nguồn đặt đúng bề ngang (375×812, rồi
320×568 — iPhone bật Display Zoom, thường gặp ở độc giả lớn tuổi), trong một
tab giả lập cảm ứng (`pointer: coarse`). Mỗi trang đo: phần tử thò khỏi màn
hình, vùng chạm < 44px, chữ < 12px, ô nhập < 16px, chiều cao khối dính.
Lighthouse mobile (devtools throttling) trên 6 trang chính: hiệu năng 97–99,
a11y 100, JS ~205 KB — **hiệu năng code không phải chỗ nghẽn trên điện thoại**;
lệch FCP của PSI live là chuyện edge Hostinger (xem mục Đo PageSpeed).

**Đã vá:**
- **Menu mobile cao hơn màn hình thì phần cuối không bao giờ tới được.** Panel
  nằm trong khối `sticky`; mở nhóm "Thẻ tín dụng" ở 375×812 là khối cao 929px,
  nút "Đăng ký bản tin" đứng yên ở 904px dù cuộn tới đâu. Chữa bằng CSS:
  `StickyChrome` là cột flex `max-h-dvh` (lui về `max-h-screen`), header
  `min-h-0`, thanh nav `shrink-0`, panel `min-h-0 overflow-y-auto`. Bản đầu đo
  `innerHeight − top` bằng JS lúc mở menu — bỏ, vì dải offer xoay thẻ mỗi 30s
  và đổi chiều cao (48–82px) ngay cả khi menu đang mở, số đo cũ là sai.
  Danh sách kết quả tìm kiếm cùng bệnh (`60vh` cũ tính theo màn hình khi thanh
  Safari đã ẩn) nhưng panel đó `absolute` nên không ăn theo trần của cột flex:
  nó đo bằng JS, nghe `resize` + `ResizeObserver` trên khối dính.
- **Ô nhập 14px làm iPhone phóng to cả trang khi chạm** — mọi ô nhập/ô chọn
  `text-sm` (bản tin cuối trang và trang Bắt đầu, sắp xếp thẻ/tài khoản, so
  sánh, liên hệ, máy tính điểm, Award Flight Finder). Thêm `pointer-coarse:text-base`; desktop vẫn 14px. Theo
  `pointer` chứ không theo bề ngang vì iPhone xoay ngang rộng hơn 640px.
- **Ở 320px cả trang kéo ngang được** (`/transfer-partners` 204px, 13 trang
  `/bay-ve-viet-nam` 62–97px). Thủ phạm là `sr-only` (position: absolute) trong
  ô bảng: khung `overflow-x-auto` không định vị nên không cắt được chúng. Thêm
  `relative` vào cả 5 khung — hai bảng so sánh thẻ/tài khoản cùng cấu trúc nên
  vá luôn (chưa đo ở bản cũ; bản mới đã kiểm 320px với 2–3 thẻ). Mục kiểm
  25/09 ghi "`scrollWidth` 382 mà `scrollTo` vẫn ra 0" — đúng ở 375px, nhưng ở
  320px trang trượt thật; hỏi `scrollX` sau `scrollTo` ở bề ngang hẹp nhất.
- **Vùng chạm:** nút tìm kiếm 40→44px (cạnh nút menu 44px); link footer cao 44px
  (`py-2.5`, `gap-y` về 0); `summary` "Quyền lợi chính"/"Điều kiện nhận bonus"
  nới bằng `::before` 12px mỗi phía (bố cục không đổi một pixel); link
  "đánh giá/xem chi tiết" cạnh nút Apply cao 44px THẬT (`py-3`); link chuyên
  mục trên H1 bài viết nới 8px (nhiều hơn là chạm vào tiêu đề cũng sang trang
  chuyên mục); chip lọc `pointer-coarse:py-2` (30→38px).
  **Đừng nới cả hai thứ kề nhau bằng `::before`.** Bản đầu làm thế với
  `summary` và link đánh giá; ở 320px hàng nút gãy dòng, link nằm ngay dưới
  `pt-4` và hai vùng nới chồng nhau 8px — Codex bấm thử, đáy vùng "Quyền lợi
  chính" dẫn sang trang thẻ. Một bên nới ảo, bên kia cao thật là đủ tách.
- **Chữ dữ liệu 10–11px lên 12px** (tên hãng · số miles, đơn vị điểm, ghi chú
  trong Award Flight Finder và bảng chặng). `text-[11px]` chỉ còn cho badge
  viết hoa trên nền màu. Luật ghi ở DESIGN-SYSTEM.md 4.2 và 5.4. Hệ quả phải
  canh: chữ to ra làm cột phải của dòng hành trình (Award Flight Finder) rộng
  ra và bóp cột hành trình còn 37px ở 320px ("AAdvantage® miles" một dòng) —
  cột phải nay `max-w-[5.5rem]` dưới `sm`, cột hành trình hẹp nhất 60px.
- **KHÔNG vá — ô nhập 12px ở `/admin/reco-debugger`** (Codex nêu, không chặn):
  trang không công khai, đóng trên production, chữ nhỏ là chủ ý cho bảng dữ
  liệu dày.
- **Dải link có CTA bên phải** (3 ở `/credit-cards`, 1 ở `/us-credit-cards`)
  xuống dòng dưới `sm`: ở 375px CTA giành gần nửa bề ngang, tiêu đề gãy 3 dòng.
- **Mọi đích `#anchor` nằm khuất dưới khối dính trên điện thoại** — mục lục bài
  viết (tiêu đề mục khuất 19px ở 375px, cả dòng khi dải offer dài), `/#newsletter`
  từ nút "Đăng ký bản tin" (nhãn form bị che), mục lục "Các thẻ tốt nhất", trang
  Bắt đầu, `#tat-ca-the-my`. Năm cái `scroll-mt-24/28/36` riêng lẻ đặt từ hồi
  chỉ thanh nav dính. Nay một utility `scroll-mt-chrome` trong `globals.css`
  (11rem dưới `sm`, 9rem từ `sm`) — khối dính đổi chiều cao thì sửa ở đó. Cả
  `<main id="main">` cũng mang nó để link "Bỏ qua" không cuộn eyebrow/H1 vào
  dưới khối dính. Đo lại 15 ca (5 đích × 320/375/1280): đích luôn dưới khối dính.

**Hai quyết định sản phẩm — tác giả chọn 03/10/2026, đã làm:**
- **Khối dính trượt lên khi cuộn xuống, dưới `lg`** (`sticky-chrome.tsx`). Nó
  cao 114–147px trên điện thoại (23–27% màn 320×568). Tác giả chọn cách này
  thay vì bỏ dính dải offer (giữ được cả hai). Hiện lại khi cuộn lên ≥12px, ở
  đầu trang, khi menu/ô tìm kiếm mở (`aria-expanded`), khi focus bàn phím vào
  khối. Từ `lg` đứng yên. **Cạm bẫy đã cắn ngay bản đầu:** dải offer xoay thẻ
  mỗi 30s và đổi chiều cao ±16px; khối nằm trong luồng ở đầu trang nên trình
  duyệt tự bù vị trí cuộn (scroll anchoring) — `scrollY` 700 → 683.5 không ai
  chạm — và bộ đếm tưởng người đọc cuộn lên, kéo khối đang ẩn xuống giữa lúc
  đọc. Nay lượt cuộn trùng lúc khối đổi chiều cao bị bỏ qua. Trạng thái ẩn gắn
  với đường dẫn (`hiddenOn === pathname`) để sang trang là tự hiện, không cần
  effect đặt lại state.
- **Nút Apply sớm dưới `xl` ở trang chi tiết thẻ** (Canada `card_detail_top`, Mỹ
  `us_card_detail_top`), ngay dưới khối bonus + phí (Mỹ: dưới dòng điều kiện
  chi), kèm dòng công bố hoa hồng như nút cột trái. Trước đó nút duy nhất trên
  điện thoại ở ~2,500px; nay ~810px. Placement riêng để GA4 tách được click mới
  với click bị chia lại từ nút dưới thân bài. Tác giả chọn cách này thay vì
  thanh Apply dính đáy màn hình.

**Biết, chưa sửa:** ở đầu trang (khối chưa ẩn), mỗi lần dải offer xoay sang
thẻ có tên dài/ngắn hơn là toàn bộ nội dung nhích ±16px. Có từ khi dải offer ra
đời; muốn hết thì phải giữ chiều cao dải cố định trên điện thoại (= chiều cao
của tên dài nhất), tức dải cao thêm với đa số thẻ.

## Kiểm desktop 03/10/2026 — đừng đề xuất lại

Cách đo: Chrome headless (`puppeteer-core` cài ở thư mục tạm, trỏ vào Chrome
của máy) quét 199 trang ở 1280×720 và 1920×1080, DPR 2: tràn ngang, chữ thò khỏi
khung, khung cuộn ngang còn cuộn, độ dài dòng, ảnh hỏng, nút thiếu con trỏ tay,
phần tử dính bị che hoặc thò đáy, chữ < 11px, nav gãy dòng, lỗi console. Không
dùng Browser pane cho việc dài: pane bị đóng là mất sạch kết quả trong `window`.
Lighthouse desktop 6 trang chính: hiệu năng 93–100, a11y/BP/SEO 100. Thứ tự Tab
và viền focus (vòng mặc định của hệ điều hành) đạt.

**Đã vá:**
- **Phần tử dính trong thân trang nằm khuất dưới khối dính** — cột ảnh thẻ
  (Canada, Mỹ), mục lục bài viết, mục lục "Các thẻ tốt nhất" dính ở `top-24`
  (96px) từ hồi chỉ thanh nav dính; khối dính desktop nay 113px (137px ở
  1920px). Utility `top-chrome` (9rem) trong `globals.css`.
- **...và thò đáy ra ngoài ở cửa sổ thấp** (Codex đo 1366×400/500, 1920×450):
  hai mục lục cao tối đa `100vh − 10rem` rồi tự cuộn; cột ảnh thẻ chỉ dính khi
  cửa sổ cao ≥34rem (`@custom-variant tall`; 34 chứ không 32 vì `rem` trong media query luôn tính 16px, ở 2400px gốc 18px thì 32rem hụt 9px), thấp hơn thì cuộn theo trang —
  cột đó có nút Apply, cuộn bên trong một cột ảnh thì kỳ.
- **Dropdown nav desktop thò khỏi mép dưới** ở cửa sổ 1366×600 ("Thẻ tín dụng"
  xuống 654px): `max-h-[calc(100vh-7.5rem)] overflow-y-auto`. Mọi khung tự cuộn
  có `scroll-py-2` (và đệm đáy) để viền focus của dòng sát mép không bị cắt.
- **CLS 0.161 ở `/award-flight-finder`** (ngưỡng tốt 0.1): công cụ đọc
  `useSearchParams` nên chỉ dựng ở client, fallback là ô xám 256px. Nay fallback
  là chính công cụ ở chặng mặc định, dựng sẵn ở server — cùng mẫu với
  `bank-account-finder`. CLS đo lại: 0; HTML server có số award thật cho crawler.
- **Đoạn ghi chú 12px dài 103–133 ký tự/dòng** (disclaimer `/bank-accounts`,
  `/bank-accounts/so-sanh`, `/award-flight-finder`, `/bay-ve-viet-nam`, ghi chú
  trong thẻ tài khoản, lời dặn "Hành trình mẫu…"): `max-w-prose`.
- Ô tìm kiếm không có dấu focus nào ngoài con trỏ → `focus-within:ring-2` ở khung.
  Nhãn "Elevated offer" của dải offer 10px → 11px (không còn chữ 10px nào).

**Đã kiểm, KHÔNG phải lỗi:** ảnh thẻ ở dải offer tải `w=384` cho ô 56px — trình
duyệt dùng lại biến thể lớn đã có trong cache từ lưới thẻ cùng trang (cache
sạch thì tải đúng `w=128`); ảnh cover
blog ở 1920px tải 1920px cho ô 1088px@2x — giới hạn ở ảnh gốc Contentful.

## Audit UX/UI 03/10/2026 — đợt 0: sửa lỗi — đừng đề xuất lại

Báo cáo audit: https://claude.ai/artifact/FJZFFQu9PT6J5y6rPtguLi (tác giả chọn làm cả
lộ trình, font Be Vietnam Pro, gỡ bình luận, menu sáu mục).

- **Dải offer (layout gốc) và trang bài blog bắt lỗi dữ liệu PHỤ.** `lib/content`
  không bắt lỗi, webhook xoá cache bằng `expire: 0`, nên Contentful nấc đúng lúc
  trang dựng lại là lỗi đi lên layout — mọi URL cùng hỏng. Banner lỗi thì ẩn + log;
  trang bài: thẻ/bonus lỗi thì rơi về `[]` (khối thẻ không hiện, nút đi tiếp của
  nhãn ưu đãi rẽ sang `/transfer-partners`), `getPosts()` vẫn để lỗi đi lên. Bắt ở
  nơi gọi, KHÔNG bắt trong hàm cache — không thì mảng rỗng bị cache như dữ liệu thật.
- **Cusdis đã gỡ hẳn** (component, CSP, DEPLOY/CONTENTFUL, `/privacy`).
  `iframe.umd.js` trả 521 từ trước 26/09. `/privacy` vẫn nhắc bình luận CŨ nằm ở
  Cusdis và quyền yêu cầu xoá — đừng xoá câu đó chừng nào dữ liệu cũ còn ở đó.
- **Nhãn thời lượng đi qua `lib/post-duration.ts`.** Video: "phút xem"; bài viết:
  "phút đọc"; không biết thì không in số. `sync-videos` ghi `minutesRead: 0` (trường
  bắt buộc, không validation) thay cho số cứng 10; entry cũ nhận ra bằng excerpt mẫu
  VÀ đúng số 10 (tác giả điền thời lượng khác thì nhãn hiện). **Bẫy Codex bắt:**
  `lib/content/contentful.ts` chạy `keepBrandTogether()` lên title, excerpt,
  bodyBlocks/body (bài viết), headline, editorsTake, keyBenefits (thẻ) và bio (tác
  giả), nên "Ghế 1A" trong các trường
  đó chứa khoảng trắng không ngắt dòng (U+00A0). So chuỗi với chúng phải đổi U+00A0
  về khoảng trắng thường trước, không thì phép so trượt trong im lặng. Các trường
  khác (category, author, SEO…) không qua hàm đó.
- `OfferStats`: ô phí `ml-auto` để vẫn nằm bên phải khi bị đẩy xuống dòng.
- Ô tìm kiếm: chưa có chỉ mục thì "Đang tải", không phải "không có kết quả".
- `ComparePicker`: `useTransition` + khoá ô khi đang điều hướng — `selected` là prop
  của server, chọn ô thứ hai giữa chừng là dựng URL từ danh sách cũ.
- Menu mobile: `cardsRowActive` trừ cả `RECOMMENDER_PATH`.
- Form bản tin: 429 báo số phút chờ theo `Retry-After`, 400 báo email sai định dạng.
- Bài `everything-about-asia-miles` vào `POSTS_WITHOUT_DEADLINE` (01/03/2026 là mốc
  lịch sử).

## Audit UX/UI 03/10/2026 — đợt 1: hệ thị giác — đừng đề xuất lại

Tác giả chọn: làm cả lộ trình, font Be Vietnam Pro. Luật đầy đủ ở DESIGN-SYSTEM.md
(1, 3.2, 4.1–4.3, 10.4–10.6, 12).

- **Một font Be Vietnam Pro, bốn file tĩnh 400/500/600/700** (67 KB, tự host, cắt
  latin + vietnamese). `--font-heading` trỏ về `--font-body`. 800 KHÔNG có file —
  `font-extrabold` hiện bằng 700, đừng thêm file 800 lại. Mũi tên → không có trong
  font (cũng không có trong bộ cũ). Ảnh OG dùng cùng họ font, subset theo đúng chữ
  trên ảnh — đổi tagline/tên site là phải cắt lại `assets/og-*.woff`.
- **Ba token trạng thái** `success` / `warning` / `destructive` (+ `-soft`), mỗi
  màu MỘT nghĩa: có lợi/chắc chắn — cần chú ý — bất lợi/lỗi. Chip TÊN nguồn điểm và ô
  tỷ lệ `/transfer-partners` trung tính (`bg-secondary`). Không còn emerald/amber của
  Tailwind hay hex thô; ngoại lệ duy nhất `text-red-300` trên nền navy.
- **Viết hoa đầu câu** cho mọi tiêu đề tiếng Việt (messages/vi.json); tên công cụ
  và thương hiệu giữ nguyên. Tiêu đề đậm 700, không `tracking-tight`; giãn dòng
  `text-2xl`→`text-6xl` đặt ở `@theme` (1.3→1.18) cho dấu tiếng Việt.
- **Không eyebrow.** `PageHeader` mất prop `eyebrow` và dải nền beige; trang sâu
  truyền `breadcrumbs` (bậc phía trên, khớp `breadcrumbJsonLd`). Trang chi tiết
  (thẻ, tài khoản, thẻ Mỹ, bài viết) mở đầu bằng `<Breadcrumbs>` thay cho "← Xem
  tất cả…". Bài viết: "Blog › <chuyên mục>" thay cả link quay lại lẫn nhãn chuyên
  mục trên H1; H1 bài 30→36→44px.
- **Một nền, một bề mặt.** Không dải nền kem/beige xen kẽ ở trang chủ; dải "Bắt
  đầu ở đây" thành một thẻ trắng có viền (vẫn là thứ dễ nhận ra nhất dưới hero).
  Trong ô thẻ: `EditorsTake` không còn hộp kem (nhãn "Ghế 1A đánh giá" + đoạn văn),
  `OfferStats` dùng hai đường kẻ mảnh thay hộp, ảnh thẻ không còn ô nền kem.
  `HotTip` GIỮ nền xanh nhạt + nhãn đậm (đường nhận tiền rebate phải nổi nhất), chỉ
  bỏ viền trái dày.
- Cố ý KHÔNG làm ở đợt này: gom bo góc về ba cấp (Codex: lựa chọn làm gọn, không
  phải lỗi), emoji cờ trên menu (tác giả chưa chốt).

## Audit UX/UI 03/10/2026 — đợt 2: bố cục — đừng đề xuất lại

Luật thành phần ở DESIGN-SYSTEM.md 10.7, 10.11, 10.12. Đo ở 375px (bản build local):
trang chủ 7,936 → 7,282px dù thêm hai khối; `/credit-cards` 26,634 → 15,039px, thẻ
đầu tiên từ 1,464 → 585px; `/bank-accounts` 20,905 → 12,589px.

- **Menu sáu mục**: Trang chủ · Thẻ & Ngân hàng · Thẻ Mỹ · Bay về Việt Nam · Công cụ ·
  Blog. Dropdown không còn link trạng thái lọc (`?type=` của thẻ và blog); "Giới
  thiệu" rời thanh menu (footer + khối tác giả trang chủ vẫn dẫn tới). **Bẫy:** Be
  Vietnam Pro (đợt 1) rộng hơn Inter — ở 1024px hàng nav 16px cần 1,041px, bốn mục
  và nút bản tin gãy hai dòng, mà không lệnh nào báo. Nay 15px dưới `xl` + lề 24px +
  `whitespace-nowrap`: 970px. Đổi nhãn menu là đo lại ở 1024px.
- **Dải offer giữ chỗ** bằng thẻ dài nhất: mọi offer chồng trong một ô grid
  (`col-start-1 row-start-1`), offer không active `invisible` + `aria-hidden` +
  `inert` + `tabIndex=-1`; chỉ offer active mới tải ảnh. Hết nhích trang khi xoay.
- **Mục lục bài dưới `xl`**: `PostTocMobile` (`<details>` đóng sẵn) ở đầu bài; link
  cao 44px thật vì xếp sát nhau (Codex bắt: `py-2.5` chỉ ra 39px).
- **Hero**: tiêu đề "Miles & Points cho người Việt" + link chữ sang 12 trang chặng.
  Phụ đề GIỮ câu của tác giả ("Học cách tối ưu… hạng thương gia và hạng nhất với chi
  phí hạng phổ thông") — tác giả yêu cầu ngay sau đợt 2, khi câu định vị viết mẫu của
  bản audit đã lên production. Câu chữ trong mẫu đề xuất là minh hoạ, không phải copy
  để ship. CỐ Ý không có con số ở hero: một số điểm phải đi kèm chương trình, nguồn
  chuyển điểm, phụ phí.
- **Trang chủ**: Hero → Bắt đầu → 4 offer → Bay về Việt Nam → Bài viết → Transfer
  bonus → Tác giả → Bản tin. Khối chặng chọn theo SLUG (`FEATURED_SLUGS`), số tính từ
  `cheapestByCabin()` lúc render, mỗi số kèm tên loại điểm. Khối tác giả kèm 3 bài
  mới nhất của chuyên mục "Đánh giá"/"Khách sạn" (chữ cứng — đổi tên chuyên mục ở
  Contentful thì khối im lặng biến mất), không số đếm.
- **`CardRow` dùng chung** cho `/credit-cards`, `/us-credit-cards`, trang chủ. Bỏ
  "Quyền lợi chính" khỏi danh sách (đầy đủ ở trang thẻ). Ghi chú phí KHÔNG cắt; rebate
  đứng sau ghi chú phí. Placement GA4 giữ nguyên (`card_list`, `us_card_list`,
  `home_offers`, `+_image` cho ảnh). Thẻ Mỹ: tên ngân hàng + dòng "Điều kiện", không
  headline, link "Xem chi tiết".
- **`/credit-cards`**: hai dải quảng bá thành MỘT dải (câu hỏi + hai link, thứ tự
  cũ); tab + chip điểm + sắp xếp sau `FilterPanel` (mọi bề ngang từ 05/10) (số = bộ lọc khác mặc
  định, tính cả sắp xếp; panel giữ trạng thái mở qua điều hướng chip); dòng "35 thẻ".
  Link chip/tab vẫn bỏ `utm_*` như trước — có từ trước đợt này, chưa sửa.
- **`/bank-accounts`**: mẫu dòng riêng — bỏ danh sách quyền lợi, giữ con số chính +
  monthly fee, ghi chú khuyến mãi lãi suất, cách miễn phí, điều kiện bonus, HOT TIP;
  rebate về góc phải hàng nhãn. Hộp số liệu nền kem trong ô tài khoản đã bỏ.
- Chuỗi chết đã dọn khỏi `messages/vi.json`: mọi `eyebrow`/`pageEyebrow` trừ dải offer
  và trang 404, năm mục menu lọc cũ, mô tả hai dải quảng bá. `/about` hết eyebrow.
  Kiểm khoá dùng bằng cách tìm chuỗi `"key"` trong `src/` + `scripts/` —
  `audit-award-charts.mts` có danh sách khoá cho phép, bỏ khoá ở đó cùng lúc.
- `PostThumbnail` tách khỏi `PostCard` (chọn ảnh cover / YouTube / placeholder một
  chỗ); `alt=""` khi tiêu đề nằm ngay cạnh trong cùng link.

## Audit UX/UI 03/10/2026 — đợt 3: Thông tin nhanh — đừng đề xuất lại

Khối "Thông tin nhanh" (Tích điểm/Hoàn tiền, Điều kiện mở thẻ, Phòng chờ, Bảo hiểm)
trên trang thẻ Canada, TRƯỚC nhận định, và cùng bốn hàng đó trong bảng so sánh. Dữ
liệu: `src/lib/card-facts.ts` đọc bộ seed của engine (bản ghi còn hiệu lực ngày
Toronto). Luật thành phần: DESIGN-SYSTEM.md 10.13.

- **Không có dòng chuyển điểm, cố ý.** Chặng chuyển lưu theo CHƯƠNG TRÌNH; Cobalt chỉ
  chuyển sang Aeroplan®/Avios® trong khi bảng Membership Rewards® chung có tám đích —
  in danh sách chung là hứa chặng thẻ đó không có.
- **Thiếu dữ liệu → "Chưa kiểm", không suy đoán.** Không có tỷ lệ nền → "Mọi chi tiêu
  khác: chưa kiểm"; tỷ lệ có trần mà trần không dùng được → "trần: chưa kiểm" (MỌI
  nhánh qua `withCap`: nhóm thường, nhóm merchant, tỷ lệ nền); phòng
  chờ `numericValue: null` không thuộc loại "không giới hạn" → "(số lượt miễn phí chưa
  kiểm)", KHÔNG viết "trả phí mỗi lượt". `stale`/`editorial` bị bỏ; dòng có nguồn
  `estimated` (kể cả trần) in "(ước tính)" — gắn ở MỘT chỗ (`markEstimated`).
- **Hạn mức `trip-cancellation` là hạn mức HUỶ** → "Huỷ chuyến tới $X"; không số thì
  "Huỷ/gián đoạn chuyến" (Codex bắt: TD® Aeroplan® Privilege huỷ $2,500, gián đoạn
  $5,000). Dữ liệu không lưu phạm vi địa lý của tỷ lệ ("5x ăn uống tại Canada" của
  thẻ Amex®) → câu dặn dưới khối và dưới bảng so sánh.
- **`audit:reco-data` canh mọi dòng:** dòng có nguồn `ghe1a` (seed từ nội dung site)
  phải có mọi con số trong nội dung Contentful của chính thẻ; tỷ lệ phải có CÙNG DẠNG
  ("5x", "X6", "2 điểm/$1", "3%", "1 điểm/$1.50") kể cả MẪU SỐ của chính vế đó —
  so số trần thì "Hoàn 3%"→"2%" lọt nhờ "3 tháng đầu", và mẫu số tìm quá rộng thì
  "2 điểm cho siêu thị, 1 điểm/$1.50" gán $1.50 cho vế đầu (ba vòng Codex, vòng
  bác bản vá bắt hai lỗi cuối). Dòng chỉ có nguồn `issuer`/`third_party` (thu nhập tối thiểu đọc thẳng từ
  trang ngân hàng 27/09/2026) không đòi có trong Contentful; quá 180 ngày thì cảnh báo
  kiểm lại. Lần chạy đầu bắt 7 chỗ: 5 là thu nhập nguồn issuer (đúng là không có
  trong Contentful), 2 là "$2M" chưa được đọc thành 2,000,000.
- `restrictedTo` của National Bank® viết lại cho người đọc ("mức cao nhất, tuỳ bậc chi
  tiêu và gói ngân hàng") vì nay nó hiện ra; `engine.snapshot.json` chỉ đổi dấu vân
  tay dữ liệu, mọi `run` giữ nguyên. Test: `npm run test:card-facts` (dựng fixture qua
  `cardFactsFrom` cho ca trần `stale`/hết hiệu lực và nguồn `estimated`).
- Bảng so sánh lặp tên thẻ đầu ô ở hàng dài (tích điểm, bảo hiểm, quyền lợi, nhận
  định): hàng tên đầu bảng trôi khỏi màn hình và không làm dính được trong khung cuộn
  ngang.

## Trang Refundable Hotel Trick (04/10/2026) — đừng đề xuất lại

`/refundable-hotel-trick`, menu Công cụ. Nội dung bốn workflow (Amex® Travel Credit,
CIBC® Aventura®, Scotiabank® Scene+™, TD Rewards®) nằm ở
`src/lib/refundable-hotel-trick.ts`; chuỗi giao diện ở khoá `rht` của `vi.json`.

- **Nguồn là spec tác giả viết ngày 04/10/2026; câu chữ các bước là nguyên văn**,
  kể cả tiêu đề bước bằng tiếng Anh ("Go to Amex® Travel"). Đừng dịch, đừng "làm rõ".
  Ngoại lệ do tác giả chốt cùng ngày: "Choose Fully Refundable" KHÔNG là bước riêng —
  nó gộp vào bước 1 (Amex®, Scene+™) vì là điều kiện bắt buộc, như CIBC®/TD® vốn viết.
  Spec CẤM thêm: thời gian xử lý, welcome bonus hiện tại, điều kiện Product Switch,
  hạn điểm, cách tính annual fee, điều kiện welcome bonus sau Product Switch. Khối
  thẻ cuối mỗi workflow chỉ in tên + loại thẻ (không welcome bonus, không phí) vì
  luật đó.
- **Tỷ lệ khai MỘT lần** (`centsPerPoint`). Ví dụ "50,000 points = $500", nhãn "1
  point = 1¢", cột Value và calculator tính ra từ đó qua `lib/cash-out.ts` — tính
  bằng CENT, làm tròn XUỐNG (lẻ nửa cent ở TD® thì nói thiếu, không hứa dư).
- **Thẻ chọn chương trình là link neo, không phải tab.** Cả bốn hướng dẫn nằm sẵn
  trong HTML: đọc được không cần JS, crawler thấy hết, nút Back về lại chỗ chọn.
- **Khối thẻ lọc theo issuer VÀ hệ điểm** (`cardIssuer` + `rhtCards`). Tangerine®
  Rewards World Elite® Mastercard® tích Scene+™ nhưng KHÔNG nằm trong khối Scene+™ —
  workflow đi qua Scotiabank® App. Amex® lọc theo quyền lợi "travel credit".
- **`lib/cash-out.ts` tách khỏi file dữ liệu** để calculator (Client Component)
  không kéo nội dung bốn workflow và `card-points-programs` vào bundle trình duyệt.
  `parseNumber` chuyển nguyên văn từ `points-calculator.tsx` sang
  `lib/parse-number.ts` — hai calculator đọc số theo cùng một luật.
- **Contentful lỗi thì rơi về `[]`** (bắt ở nơi gọi, như trang bài viết): bốn workflow
  và calculator là dữ liệu tĩnh, chỉ khối thẻ và link bài Points 101 biến mất.
- **Sơ đồ chung BOOK → REDEEM → WAIT → CANCEL → REFUND là yêu cầu nguyên văn của
  tác giả**, nên không thêm Product Switch vào đó; dòng chú thích ngay dưới nói TD®
  bắt buộc Product Switch trước khi cancel (Codex bắt: sơ đồ đọc như checklist).
- Bảng So sánh nhanh dựng HAI lần từ cùng mảng: thẻ dưới `sm`, bảng từ `sm`; bản ẩn
  là `display: none` nên screen reader đọc một bản.
- Lưới thẻ chọn: 1 cột dưới 22.5rem — cụm "PRODUCT SWITCH" (~115px, `nowrap`) không
  vừa thẻ hai cột ở 320px (Codex bắt). Đo 320/360/375/768/1024/1280: không tràn.
- Mục lục dính bên phải từ `xl` dùng lại `PostToc` của trang bài viết; dưới `xl` thẻ
  chọn chương trình làm việc đó.
- **Thân trang CANH GIỮA** (cột 48rem; từ `xl` khung 68rem gồm cả mục lục), giống
  `/transfer-partners` và `/calculator` — tác giả chốt 04/10/2026 sau khi bản đầu
  để sát trái theo DESIGN-SYSTEM 5.1.2. Đừng kéo lại sát trái.

## Lấp "Chưa kiểm" của Thông tin nhanh 04/10/2026 — đừng đề xuất lại

Tác giả bảo kiểm và làm luôn dữ liệu cho mọi ô "Chưa kiểm". Đọc trang chính chủ của
35 thẻ (Amex® CA mở từng ô "coverage" mới ra chữ; BMO® lấy số bảo hiểm từ PDF tóm
tắt bảo hiểm) ngày 04/10/2026. Kết quả: 0 ô "Chưa kiểm".

- **Dòng nguồn ngân hàng** (`source` trong `product-benefits.ts`/`earning-rates.ts`,
  `sourceKind: "issuer"`, `from: 2026-10-04`). Dòng SỬA thì đóng bản cũ
  `to: 2026-10-03`, thêm bản mới — không sửa tại chỗ. Trang không nêu hạn mức thì
  `numericValue: null`, không đoán.
- **Hai loại bảo hiểm mới**: `flight-delay-insurance`, `baggage-insurance`. Không có
  chúng thì Amex® Aeroplan®*/Marriott Bonvoy® chỉ còn "Thuê xe" — đúng mà thiếu
  tới mức sai. Đã kiểm hai loại này cho cả 35 thẻ, không chỉ thẻ "Chưa kiểm".
- **"Không có"** nằm ở `src/lib/card-facts-none.ts` (engine không cần biết "không có";
  trang cần tách "đã kiểm, không có" với "chưa kiểm"). Áp từ `recordedAt`.
  `audit:reco-data` báo lỗi khi một dòng ở đó chọi với dữ kiện.
- **Lượt phòng chờ `numericValue: 0`** = đã kiểm là không có lượt miễn phí (thẻ hội
  viên Priority Pass/DragonPass, mỗi lượt trả phí): Scotiabank® Gold (chỉ GIẢM GIÁ
  thẻ hội viên), Amex® Aeroplan®* Reserve và Business Reserve, WestJet RBC®, BMO®
  VIPorter® (US$32/lượt). `null` vẫn nghĩa là chưa kiểm số lượt.
- **Sửa sai dữ liệu cũ** (seed VÀ `keyBenefitsVi` trên Contentful, cùng ngày — hai entry
  sạch, không bản nháp): Wealthsimple® Visa Infinite + y tế du lịch $1M (site từng ghi
  $2M — là của bản Privilege). BMO® VIPorter® 2x là xăng/đi lại/khách sạn, không phải
  "du lịch" (`travel`). Scotiabank® Gold đủ hạng mục: 5x siêu thị khác và giao đồ ăn,
  3x xăng/đi lại/rideshare/streaming, 1x. Codex bắt chỗ VIPorter®: seed sửa mà chữ trên
  trang chưa sửa là bảng và đoạn văn nói hai điều — audit không thấy vì dòng nguồn
  ngân hàng chỉ được canh bằng ngày.
- **ENGINE 4.32.0**: `benefit-fit` chỉ cộng phần "tiền" cho quyền lợi `category:
  "credit"`. Trước đó hạn mức bảo hiểm ("y tế tới $5,000,000") cộng như tiền, chiếm
  trọn thang và travel credit $200 của thẻ khác về gần 0 — thêm dữ liệu bảo hiểm sẽ
  khuếch đại lỗi đó. Snapshot ghi lại; vài nhân vật mẫu đổi thẻ chính.
- `audit:trademarks` học thương hiệu cả từ chuỗi trong code: tên hàm `RBC(`/`CIBC(` và
  "Priority Pass™" trong comment làm nó báo 27 chỗ. Hàm URL viết thường
  (`rbcUrl`…). Từ 04/10/2026 nội dung site và chuỗi hiển thị trong code đều viết "Priority Pass™"; comment vẫn viết trần.

## Audit UX/UI lần hai 04/10/2026 — đợt 4: sửa theo kết quả — đừng đề xuất lại

Audit lại toàn site sau đợt 0–3 (199 URL × 320/375/1024/1280 bằng Chrome headless, chặn
GA và mọi request không phải GET; Codex soát độc lập rồi phản biện). Kỹ thuật sạch:
0 tràn ngang, 0 lỗi tương phản, 0 heading nhảy cóc, 1 H1/trang, 0 lỗi console, CLS ≈ 0
có throttle, detector anti-pattern 0. Tác giả bảo "làm hết" 12 đề xuất + hai việc chờ
quyết. Luật mới ghi ở DESIGN-SYSTEM.md (4.3, 5.4, 9, 10.3, 10.11, 10.13).

- **Focus không được rơi về `body`.** `ComparePicker` khoá ô bằng `disabled` lúc điều
  hướng → trình duyệt thả focus (đo: chọn xong ô 1, `activeElement` = BODY); nay trả
  focus về ô vừa chọn khi xong, trừ khi người đọc đã tự chuyển focus. Esc đóng dropdown
  nav trả focus về `summary`, đóng menu mobile trả về nút Menu (Codex bắt).
- **Menu so ĐƯỜNG DẪN, không so `?type=`**: bỏ `TypeLinks`/`useSearchParams`/`Suspense`
  của header — còn một dòng "Thẻ tín dụng" thì phép so query chỉ làm dòng đó tắt ở tab
  Elevated/Khác.
- **Calculator RHT in kênh của tỷ lệ** ("Rate qua Expedia® For TD: …") — 0.5¢ của TD®
  chỉ đúng qua kênh đó (Codex bắt; dữ liệu `rateChannel` đã có, props bỏ mất).
- **"Ghế 1A đánh giá" là H2** cùng kiểu "Thông tin nhanh"/"Quyền lợi chính" (trang thẻ
  Canada + Mỹ). Trước đó là chữ navy thường: nhảy theo heading bỏ qua phần nhận định.
- **Tên sản phẩm trong tên link**: `ApplyButton name` + `CardRow` nối tên thẻ bằng
  `sr-only`; hàng Apply hai bảng so sánh có tên hiển thị (hàng tên đầu bảng đã trôi
  khỏi màn hình). Badge tìm kiếm `/60` → `/70` (4.41 → 6.08:1). `PostCard` ảnh `alt=""`.
- **Vùng chạm 44px chỉ cho thứ đứng cạnh thứ bấm được khác** (DESIGN-SYSTEM 5.4): link
  đầu khối trang chủ (cặp "Xem tất cả thẻ" / "Thẻ Mỹ" từng cao 20px), link chi tiết dưới
  nút Apply trong bảng so sánh, nút bản tin trong menu mobile. Codex phản biện: KHÔNG
  gỡ link "Về trang chủ" cuối trang chi tiết (đường về cuối một trang dài, Breadcrumbs ở
  đầu không thay được) và không nới mọi link đứng riêng.
- **`/blog` trên điện thoại**: `PostCard listOnMobile` (dòng ngang dưới `sm`) ở `/blog`,
  trang chuyên mục, "Bài viết liên quan" — 22,967 → 9,977px ở 375px. Carousel trang chủ
  giữ thẻ dọc.
- **`CardSpotlight` = `CardRow showHeadline={false}`** (Các thẻ tốt nhất: tên `h3`; giữa
  thân bài: `p`). `data-affiliate-self-tracked` chuyển lên root `CardRow` — Codex: thay
  thẳng mà quên cờ đó là `AffiliateClickTracker` đếm click hai lần. `OfferStats` nay chỉ
  còn ở đầu trang thẻ (Canada, Mỹ).
- **Câu giải thích "Chưa kiểm" chỉ in khi có** (`hasUnchecked`: dòng rỗng hoặc ý mang cờ
  `unchecked`); câu phạm vi Canada luôn in. Bảng so sánh: thẻ engine không biết cũng tính.
- **Hết lệch hệ thị giác còn sót**: panel nền kem cấp section (ngã ba `/bat-dau`, khối
  "Mới chơi thẻ Mỹ?"), hộp kem lồng trong "Góc nhìn từ Canada" (nay hàng kẻ trên, nhãn
  `text-warning`) và Points Calculator (nay `border-t` như calculator RHT); nhãn viết hoa
  ngoài danh sách 4.3 → chữ thường `text-sm`. Nhãn của công cụ Gợi ý thẻ KHÔNG đổi — bản
  local báo "Công cụ đang tạm nghỉ" vì không tới được DB, không kiểm được bằng mắt.
- **Hai việc tác giả để mình quyết, đã làm**: (1) link sang trang sản phẩm thống nhất
  "Xem chi tiết" — đã là chữ ở thẻ Mỹ, hai bảng so sánh, dải offer; thay "Ghế 1A đánh giá
  →" (danh sách thẻ Canada, trang chủ), "Chi tiết →" (tài khoản), "Xem chi tiết thẻ →"
  (khối thẻ). Tác giả thử giữ "Ghế 1A đánh giá" cho thẻ Canada (8a40f6e) rồi chốt lại
  "Xem chi tiết" cho đồng bộ ngay trong ngày — đừng đề xuất tách lại hai chữ. Muốn đổi chữ
  thì sửa `offers.viewDetails`, `bankAccounts.details`, `usCards.viewDetails`,
  `compare.viewCard`, `bankCompare.viewAccount`. (2) Emoji cờ →
  `Flag` SVG (Chrome/Edge trên Windows hiện 🇺🇸 thành "US"); `messages/vi.json` không còn
  emoji cờ. Hàng nav 1024px đo lại: một hàng, nút bản tin không gãy.

**Đã kiểm, KHÔNG phải lỗi:** bảng so sánh cuộn ngang trên điện thoại (cột nhãn dính — thiết
kế 29/08); ba nhãn Beta ở Thẻ Mỹ (chốt 22/09); ô navy trống trong carousel bài viết ở ảnh
chụp toàn trang (ảnh lazy chưa kịp tải — đo lại: cả bốn ảnh tải); "Quyền lợi chính" lặp
một phần "Thông tin nhanh" (Codex: chưa đủ cơ sở gập lại; nội dung là của tác giả).

## Capital One® Quicksilver (05/10/2026) — đừng đề xuất lại

Hai thẻ Canada mới ra mắt 05/10/2026: Quicksilver World Elite® và World Mastercard®.
`applyUrl` là trang PUBLIC của capitalone.ca theo yêu cầu tác giả (không affiliate,
nên `PLAIN_REL` là đúng). Ảnh thẻ lấy bản 472×298 không có nhãn "NEW" (bản hero
914px có nhãn in sẵn).

- **Offer = match toàn bộ cashback 365 ngày đầu, không trần, không mốc chi.** Seed
  `kind: "cash"`, `components: []`: giá trị phụ thuộc chi tiêu, như phần "đến $600"
  của TD® Cash Back. Hệ quả đã biết: §11 chấm ~0.4 với bonus $0 (đánh giá THẤP).
  Sửa đúng cần loại thành phần mới — chưa làm cho riêng hai thẻ.
- **Không seed luật loại trừ welcome bonus.** Footnote chỉ ghi "exclusively for new
  cardholders"; Codex bác cả luật trọn đời cho chính thẻ. Chờ tác giả hỏi thực tế.
- Họ `capital-one-quicksilver` (tier 1 World, tier 2 World Elite) dù cùng phí $0,
  cùng tỷ lệ — như họ Wealthsimple®.
- `card-facts.test`/`card-tags.test` kiểm thẻ thêm SAU `AS_OF` ở ngày nó vào kho
  (`asOfFor`): trước ngày đó thẻ đúng là chưa có bảng/tag.
- **Phát hiện kèm:** TD® Cash Back Visa Infinite* có trần $15,000 chi tiêu/năm RIÊNG
  cho từng nhóm (siêu thị; xăng & sạc; phương tiện công cộng; hoá đơn định kỳ &
  streaming) theo footnote td.com 05/10/2026. Đã sửa cùng ngày: seed cũ (bốn nhóm
  đầu chung MỘT trần $450) đóng `to` 04/10, bản mới bốn trần `spend` 15,000 từ
  05/10 (xăng + sạc chung một trần, hoá đơn + streaming chung một); Contentful
  `keyBenefitsVi`/`editorsTakeVi` (và bản En ẩn) viết lại. Năm đầu, trần mỗi nhóm
  còn bị trừ phần chi của 3 tháng welcome (footnote 2) — engine không mô hình hoá.

## Transfer Partners thẻ Mỹ (06/10/2026) — đừng đề xuất lại

`/transfer-partners` có hai mục neo: `#canada` (bảng Amex® CA / RBC® cũ, không đổi
dữ liệu) và `#my` (bảng mới: 6 hệ điểm Mỹ × 36 chương trình, dữ liệu ở
`src/lib/us-transfer-partners.ts`, bảng ở `components/transfer-partners/us-transfer-table.tsx`).
Tác giả giao danh sách theo cheat sheet của Daily Drop, kèm luật: **chỉ thêm chương
trình có ít nhất một ngân hàng chuyển được** — `npm run test:us-transfer` canh luật đó.

- **File riêng, không thêm cột vào `TRANSFER_PARTNERS`.** Bảng Canada được Award
  Flight Finder, trang chặng, engine gợi ý (`transfer-paths.ts`) và hai audit đọc như
  điểm Canada; thêm cột Mỹ là engine khuyên người Canada chuyển điểm Chase® họ không có.
- **Đối chiếu nguồn chính chủ 06/10/2026, khớp Daily Drop:** Amex® (công cụ
  `global.americanexpress.com/rewards/transfer`, chân trang "United States", 20 đối
  tác), Chase® (trang quyền lợi Sapphire Preferred®: 14 đối tác, Hyatt 4:3), Capital
  One® (trang transfer partners, 22), Citi® (`thankyou.com/partnerProgramsListing.htm`,
  mở từng ô mới ra tỷ lệ theo loại thẻ, 20). Bilt: danh sách sau đăng nhập — đối chiếu
  qua AwardWallet. Wells Fargo®: trang sản phẩm không liệt kê — JetBlue/Cathay theo
  thông cáo newsroom.wf.com. Số đối tác từng hệ khoá trong test; ngân hàng đổi thì sửa
  cả dữ liệu lẫn test.
- **Thời gian chuyển chỉ lấy từ Daily Drop**, ô "Not enough data" để trống. Không lấp
  bằng "48 hours" của American Express®: đó là mức tối đa, đặt cạnh "Instant" là hai
  thước đo trong một cột. Không dùng dấu "~" (ở cỡ chữ ô nó trông như dấu trừ).
- **Alaska + Hawaiian = một hàng Atmos™ Rewards** (Daily Drop để hai hàng). Bilt → Accor
  viết "1,500 : 1,000", không "1,000 : 667" (số tròn không có thật).
- **Hyatt:** ô Chase® hiện 1,000 : 750 (Sapphire Preferred®/Ink Business Preferred® từ
  01/10/2026) kèm dòng "Sapphire Reserve®: 1,000 : 1,000". Ô Bilt có `change` → tự lật
  sang 1,000 : 750 ngày 01/01/2027 (`legOn` + `todayInSiteZone`, trang ISR 60s).
- **Logo vuông `/images/logos/programs/*.png` (128px) cho MỌI hàng, cả bảng Canada.**
  Logo chữ cũ co về 22px không đọc được; một chương trình một logo trên cả trang. Award
  Flight Finder vẫn dùng bản chữ trong `/images/logos/partners/` ở khổ rộng của nó.
  Nguồn: icon chính chủ (favicon/apple-touch-icon), cắt từ logo trên công cụ Amex®/Citi®
  hoặc SVG Wikimedia Commons (đuôi EVA, trái tim Southwest, linh dương Qatar, chữ LHW).
- **Bố cục:** chữ của mục Mỹ cùng cột 56rem với mục Canada, riêng bảng nới `max-w-6xl`
  như một hình rộng — kéo cả mục ra thì tiêu đề "Mỹ" lệch mép trái so với "Canada".
- **Hàng tên cột dính từ `xl`:** khung đổi sang `overflow-clip` (không `hidden` — nó
  tạo khung cuộn và nuốt `sticky`), đỉnh là `--chrome-h` do `StickyChrome` đo bằng
  `ResizeObserver`. `top-chrome` (9rem) để hở khe 31px ở 1280px, các hàng lộ qua đó.
- **Trang thẻ Mỹ** có hệ điểm là cột của bảng (MR, UR, Capital One® Miles, ThankYou®,
  Bilt) thì có khối link sang `/transfer-partners#my`; thẻ Bonvoy®/Hilton®/IHG®/Atmos™
  không — như `pointsToolFor` của thẻ Canada.
- **Bẫy `audit:trademarks`:** nó lùi tối đa 4 từ viết hoa trước ® để học cụm, và "®, "
  không chặn được bước lùi — "Citi Strata Premier®, Citi Strata Elite®" dạy nó cụm
  "Premier Citi Strata Elite" rồi báo "Citi" trần. Viết xen một chữ thường ("… và …").
  "Etihad® Guest" dạy nó chữ "Etihad" và làm lộ một chỗ viết trần sẵn có ở
  `awardCharts` (đã thêm ®).
- **Bảng Canada dùng chung mảnh với bảng Mỹ (06/10/2026)** — `table-parts.tsx`: nhóm
  Hãng bay / Khách sạn (`TransferPartnerRow.kind`), số đối tác dưới tên cột, cùng ô
  tỷ lệ, hàng tên cột dính từ `xl`. `TransferLeg` tách `note` (hạng thẻ RBC®) khỏi
  `time`. Amex® CA "~30 phút" → "Tối đa 30 phút" (trang ghi "up to 30 minutes").
- **RBC® CÓ công bố thời gian chuyển:** điều khoản Avion Rewards ghi "up to 4 weeks" —
  ghi chú cũ "RBC không công bố" là sai. Trang travel của Avion Rewards: Elite chuyển
  được cả bốn hãng, Premium chỉ WestJet, Select không hãng nào. Engine vẫn để
  `requiresTier: null` cho chặng WestJet (mọi thẻ RBC® trên site là Elite; đặt hạng
  là `isOpenToEveryone` gạt chặng duy nhất còn mở và Avion® thành "không linh hoạt").
