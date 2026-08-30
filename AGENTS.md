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

## Trang "Bắt đầu ở đây" (30/08/2026) — đang là BẢN NHÁP

`/bat-dau`, sau cờ `START_HERE_PUBLISHED` trong `lib/feature-flags.ts`, hiện
`false`. Cờ được áp ở 6 chỗ: menu desktop, menu mobile, footer, sitemap, ô tìm
kiếm, và `robots: noindex` + dải báo nháp trên chính trang. Bật cờ là công bố,
không phải sửa chỗ nào khác.

- **Bài trong bước 1 sắp CŨ NHẤT TRƯỚC**, ngược với mọi chỗ khác trên site. Đây
  là lộ trình đọc chứ không phải dòng thời gian: bài viết sớm nhất là bài vỡ
  lòng và các bài sau xây trên nó. Đừng "sửa" thành mới nhất trước.
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
