# Bàn giao: Recommendation Engine — Phase 1 + 2

Trạng thái tính đến **08/09/2026**. Phase 1 xong; **Phase 2 xong**.
Đọc file này là đủ để làm tiếp, không cần lịch sử chat.

---

## 1. Mục tiêu

Dựng recommendation engine cho Ghế 1A theo spec tại
[`docs/recommendation-engine-v1.md`](docs/recommendation-engine-v1.md) (6 phase).
Bản gốc user gửi ở `~/Downloads/ghe1a-recommendation-engine-v1.md`; bản trong
repo là bản chép nguyên vẹn và là bản chuẩn từ đây.

Engine trả lời:

> Với tình huống và mục tiêu của người này, bước hợp lý tiếp theo là gì?

**Nó KHÔNG được mặc định rằng mở thẻ mới luôn là câu trả lời đúng.** `NO_NEW_CARD`
là một ứng viên trong mọi lượt chạy.

Nguyên tắc kiến trúc quan trọng nhất của spec: **engine phải tất định và giải
thích được**; LLM chỉ diễn đạt kết quả cuối, không bao giờ quyết định thứ hạng.

---

## 2. Tiến độ

| Phase | Nội dung | Trạng thái |
| --- | --- | --- |
| 1 | Lớp dữ liệu nền | ✅ **XONG** |
| 2 | Hồ sơ người dùng, danh mục thẻ, số dư điểm, goals | ✅ **XONG** |
| 3 | Engine (Portfolio Analyzer → Ranking) | ⛔ Chưa bắt đầu |
| 4 | Debugger + recommendation_runs | ⛔ Chưa bắt đầu |
| 5 | Frontend | ⛔ Chưa bắt đầu |
| 6 | LLM giải thích | ⛔ Chưa bắt đầu |

Phase 1 qua **31 commit** và **24 vòng review với Codex** (68 phát hiện, tất cả
đều đúng và đã vá).

**Kết luận sẵn sàng đã đưa ra: READY FOR PHASE 2 WITH KNOWN RISKS.** Lý do ở §7.

---

## 3. Quyết định quan trọng (đừng đảo ngược nếu chưa đọc lý do)

### 3.1 KHÔNG dùng Supabase/Postgres dù spec §2 đề xuất

User đã chọn phương án **TS/JSON trong repo** sau khi mình chỉ ra repo chưa từng
có database nào. Dữ liệu Phase 1 là dữ liệu **tham chiếu do biên tập viên duy
trì tay** (spec §23 cấm scrape ở V1), nên thứ nó cần là lịch sử đọc được và một
vòng review trước khi lên site — đúng thứ git cho sẵn.

`RecommendationDataSource` trong `source.ts` là **cửa duy nhất** engine đọc dữ
liệu sản phẩm; `UserDataSource` trong `user-source.ts` là cửa cho dữ liệu người
dùng. Dữ liệu người dùng rốt cuộc phải có DB thật, nhưng Phase 2 đã xong mà
chưa cần chọn — xem §8.1. Chọn chỗ lưu là việc phải xong **trước Phase 5**.

### 3.2 Nối với Contentful bằng `slug`

Contentful giữ copy tiếng Việt / ảnh / apply URL / badge rebate. Kho này giữ dữ
kiện có cấu trúc mà Contentful không có. `npm run audit:reco-data` so hai bên
mỗi lần chạy, **cả hai chiều**.

### 3.3 Khoá chính là `id`, KHÔNG phải `slug`

`Product.id` (`prd_<slug lúc seed>`) **bất biến, viết tay trong seed**. `slug`
là khoá tự nhiên và **đổi được** khi nhà phát hành đổi tên thẻ. Mọi file con quy
về `productIdFor(slug)` — hàm này **ném** khi slug không tồn tại.

⚠️ **Đừng bao giờ suy `id` từ `slug` trong code.** Việc chúng trông giống nhau
là tiện cho người đọc, không phải một bất biến.

### 3.4 Đổi một sự thật = THÊM một phiên bản

Mọi thực thể có hiệu lực theo thời gian nhận `from`/`to`/`verifiedAt` **trên
từng dòng seed**, và id sinh từ `from` của chính dòng đó:

```ts
["everything_else", 1,    { to: "2026-12-31" }],
["everything_else", 1.25, { from: "2027-01-01" }],
```

Phí thường niên, định giá điểm và quãng khả dụng đều ra khỏi `Product` vì lý do
này: để chúng là trường trên `Product` thì cách duy nhất giữ lịch sử là đóng cả
dòng sản phẩm và mở dòng mới với id mới — gãy mọi khoá ngoại cùng lúc.

### 3.5 Hai trục thời gian

- `effectiveFrom`/`effectiveTo` — sự thật này ĐÚNG từ khi nào tới khi nào
- `recordedAt` — bản ghi được ĐƯA VÀO kho ngày nào

`datasetAt(data, asOf, { knownAt })` cắt theo cả hai. Không có `knownAt` thì một
đính chính lùi ngày lọt vào bản dựng lại của quá khứ.

Offer còn có cặp thứ ba: `startDate`/`endDate` là ngày **nhà phát hành công bố**,
tách khỏi `recordedFrom`/`recordedTo` là ngày **bản ghi của mình**. Hai offer
trong seed đã dùng đến sự tách này.

### 3.6 Ngừng phát hành ≠ hết tồn tại

`product_availability` là **bảng nhiều quãng**, không phải một cặp trường — thẻ
ngừng rồi mở lại là chuyện có thật. Khi thẻ hết khả dụng:

- **Offer phải đóng** (không ai mở được nữa)
- **Tỷ lệ tích điểm, quyền lợi, phí thì KHÔNG** — người đang giữ vẫn kiếm điểm,
  vẫn hưởng quyền lợi, vẫn trả phí

Sản phẩm **không bị loại** khỏi `datasetAt` khi hết khả dụng. Gộp hai thứ này sẽ
làm Portfolio Analyzer ở Phase 3 quên mất thẻ đang nằm trong ví người dùng.

### 3.7 Ba luật không được phá

1. **Affiliate không bao giờ ảnh hưởng thứ hạng** (spec §16 Rule 7).
   `affiliateAvailable` không viết tay được — nó vắng khỏi `ProductSeed` và
   được `source.ts` tính bằng chính `isReferralUrl` quyết định `rel="sponsored"`.
2. **Điểm tín dụng không phải điều kiện cứng** (spec §3.10). Kiểu
   `EligibilityRuleType` không có nhánh nào cho nó.
3. **Không đếm trùng điểm chuyển được** (spec §7). Chỉ chương trình
   `transferable` mới sinh "số dư tiếp cận được".

### 3.8 Trống ≠ bằng không, và trống là DỮ LIỆU

`dataset.gaps` (`DataGap`, 6 `kind`) suy ra từ chính dữ liệu bởi `gaps.ts` —
không phải danh sách viết tay, không phải chuỗi cảnh báo phải parse. `datasetAt`
tính lại `gaps` cho từng thời điểm.

### 3.9 Nghi ngờ thì ĐỪNG gom họ thẻ

HỌ = các **hạng của cùng một thẻ**, nơi hạng cao là bản đắt hơn của hạng thấp
(CIBC® Aeroplan® Visa / Infinite / Infinite Privilege).

Amex® Green / Cobalt® / Gold Rewards cùng kiếm Membership Rewards® nhưng là **ba
sản phẩm độc lập** — gom lại sẽ khiến engine im lặng giấu đi hai trong ba. Bỏ
sót một họ chỉ làm engine khuyên hơi thừa; gom nhầm thì nó giấu mất lựa chọn đúng.

---

## 4. File đã sửa

### Module chính — `src/lib/recommendation/` (mới hoàn toàn)

| File | Dòng | Vai trò |
| --- | ---: | --- |
| `types.ts` | 993 | 17 entity + luật về id + hai trục thời gian |
| `validate.ts` | 1162 | ~40 phép kiểm; ở database thì đây là FK + CHECK |
| `temporal.ts` | 162 | `activeAt`, `oneActiveAt`, `isAvailableAt`, `datasetAt` |
| `indexes.ts` | 138 | Map tra theo khoá ngoại (thay cho quét mảng) |
| `source.ts` | 149 | `RecommendationDataSource`, `getOfferHistory` |
| `spend.ts` | 100 | Phép cộng chi tiêu welcome offer (**xem §6.1**) |
| `offer-history.ts` | 170 | Cầu nối lịch sử offer, có đơn vị + censoring |
| `gaps.ts` | 104 | Suy ra `DataGap` từ dữ liệu |
| `index.ts` | 17 | Export công khai |
| `data/*.ts` | 3,426 | Seed: 11 file, một file một entity |
| `*.test.ts` | 1,702 | 91 test |

### File sẵn có bị sửa

- **`src/lib/card-points-programs.ts`** — `PROGRAM_RULES` nay **suy ra từ**
  `PointsProgram.contentPattern` thay vì là danh sách viết tay song song.
  Thêm chương trình mới nay chỉ sửa một chỗ.
- **`src/lib/offer-history.ts`** — export thêm `unitOf` và `OfferUnit`.
- **`scripts/audit-reco-data.mts`** (mới, 400+ dòng) — audit ba lớp.
- **`tsconfig.json`** — bật `allowImportingTsExtensions`; **bỏ `scripts` khỏi
  `exclude`** (xem §6.2).
- **`package.json`** — thêm `test:reco`, `audit:reco-data`.
- **`CLAUDE.md`** — thêm `audit:reco-data` vào danh sách audit khi đụng thẻ.
- **`src/lib/recommendation/README.md`** — tài liệu đầy đủ của module. **Đọc nó
  trước khi sửa bất cứ gì.**

---

## 5. Kết quả kiểm thử

Chạy ngày 08/09/2026, tất cả xanh:

```bash
npx tsc --noEmit        # sạch (đã bao gồm scripts/)
npm run lint            # sạch
npm run build           # Compiled successfully
npm run test:reco       # 91/91 pass
npm run test:game       # 43/43 pass (không liên quan, kiểm không hồi quy)
npm run audit:reco-data # 0 lỗi, 9 cảnh báo
```

### Quy mô dữ liệu hiện tại

34 sản phẩm (6 họ) · 34 mức phí · 34 quãng khả dụng · 16 định giá · 34 offer ·
73 component · 152 tỷ lệ tích điểm · 4 trần dùng chung · 136 quyền lợi ·
80 điều kiện · 9 chặng chuyển · 9 award strategy · 25 chỗ trống khai tường minh.

### Đo hiệu năng (bộ dữ liệu tổng hợp)

| Dòng | `validateDataset` | `datasetAt` | `indexDataset` |
| ---: | ---: | ---: | ---: |
| 547 | 6 ms | 0 ms | 0 ms |
| 16,552 | 66 ms | 1 ms | 0 ms |
| 65,936 | 245 ms | 1 ms | 0 ms |

**Tuyến tính.** Validator dành cho CI/audit, không phải mỗi request. Phase 3 đọc
qua `datasetAt` + `indexDataset` — cả hai ~1 ms ở 66k dòng.

### 9 cảnh báo hiện tại đều là chỗ trống CÓ CHỦ Ý

- 4 thẻ chưa có tỷ lệ `everything_else` (site chưa nêu): `scotiabank-gold-amex`,
  `amex-aeroplan-reserve`, `td-first-class-travel-visa-infinite`,
  `bmo-viporter-world-elite-mastercard`
- 3 offer chưa có component (site không nêu mốc chi): `scotiabank-gold-amex`,
  `amex-marriott-bonvoy`, `amex-marriott-bonvoy-business`
- 1 tỷ lệ chỉ có bản giới hạn merchant, chưa có bản nền
- 1 chương trình `transferable` chưa dựng chặng chuyển (Marriott Bonvoy®)

**Đừng "sửa" chúng bằng phỏng đoán.** Lấp bằng số bịa là đúng thứ lớp dữ liệu
này từ chối làm.

---

## 6. Ba bài học đắt nhất (đọc trước khi sửa gì)

### 6.1 Phép cộng chi tiêu welcome offer đã SAI BỐN LẦN

`spend.ts` — SUM, rồi MAX, rồi gom-theo-ngày-mở, rồi gom-liên-thông. Lần nào
cũng trông hiển nhiên đúng.

Lời giải đúng: bài này là LP đối ngẫu của bài phủ trên hệ khoảng; ma trận ràng
buộc của hệ khoảng hoàn toàn đơn modular, nên tối ưu đạt tại **tập cửa sổ đôi
một rời nhau có tổng lớn nhất** (max-weight independent set trên đồ thị khoảng),
giải bằng quy hoạch động theo ngày kết thúc.

**Mỗi lần sai giờ là một test trong `spend.test.ts`. Đừng "đơn giản hoá" lại.**

### 6.2 `scripts/` từng nằm ngoài tsconfig → một lỗi SỐNG mà không ai thấy

`audit-reco-data.mts` đọc `product.isActive` sau khi trường đó bị đổi tên.
`undefined` là falsy nên `!undefined` luôn đúng → **cả 31 phép so phí và rebate
với Contentful chết lặng**, trong khi audit vẫn in "✓ Không lỗi".

Nay `scripts/` **được kiểm kiểu**. Đừng đưa nó ra khỏi `include` lần nữa.

### 6.3 Refactor "bảo toàn hành vi" phải có phép so hành vi

Chuyển `PROGRAM_RULES` sang suy từ dữ liệu làm hỏng 3 regex vì escape thừa
(`\\s` thay vì `\s`) — và **2 trong 3 vẫn "chạy"** nhờ nhánh thay thế trong cùng
regex. Chỉ Scene+™ đổ hẳn. Nếu chỉ thử một ca cho mỗi chương trình thì hai lỗi
kia trôi thẳng lên production.

`programs.test.ts` nay kiểm **từng nhánh** và chặn escape thừa.

---

## 7. Rủi ro đã biết

### Rủi ro lớn nhất: interface chưa từng chạy với backend thứ hai

`RecommendationDataSource` đã có `getDataset({ asOf, knownAt })` và
`getOfferHistory(productId)`, nhưng **chưa từng được chạy với implementation nào
khác ngoài bản đọc file**. Đó là giả định lớn nhất chưa được kiểm chứng của cả
Phase 1.

**Phase 2 KHÔNG giải toả nó.** Phase 2 dựng một cửa thứ hai (`UserDataSource`)
với một bản cài đặt trong bộ nhớ, và bản đó chỉ thu hẹp rủi ro một phần: nó trả
về **bản sao** như một database thật, nhưng nó vẫn không phải database. Lần thử
thật sự lùi tới lúc chọn chỗ lưu, tức trước Phase 5.

### Rủi ro về chất lượng lưới an toàn

Ba lỗi nghiêm trọng nhất của Phase 1 đều **im lặng** — audit xanh, test xanh,
build xanh — và chỉ lộ ra khi có người soi từ góc khác. Lưới hiện tại bắt được
*dữ liệu* sai tốt hơn bắt *code kiểm tra* sai.

→ **Giữ thói quen cross-check với Codex.** Xem `~/.claude/.../memory/`,
`feedback-always-crosscheck-with-codex`.

### Compromise còn lại (đã cân nhắc, cố ý giữ)

| Chỗ | Ảnh hưởng Phase 3 |
| --- | --- |
| `EarningRate.restrictedTo` là chuỗi tự do | Dùng tỷ lệ nền; validator cưỡng chế mỗi hạng mục có đúng một dòng không giới hạn |
| Bảo hiểm còn trong `textValue` (tuổi, số ngày) | Chỉ so được có/không |
| Award strategy phủ 1/5 vùng của spec §33 | Có trong `gaps`; nói "chưa có dữ liệu" chứ không đoán |
| 11/34 thẻ chưa biết điều kiện riêng | Có trong `gaps` |
| `recordedAt` không dựng lại được việc **đóng** một dòng | Spec §20 `recommendation_runs.input_snapshot` mới là cơ chế thật |
| Thiếu quyền lợi không sinh cảnh báo | Chưa có phép kiểm phủ sóng cho `product_benefits` |
| 5 file seed sẽ tới ~6,000 dòng ở 101 thẻ | Điều hướng được (keyed theo slug) nhưng merge-conflict sẽ tăng |
| Ngày trong lịch sử offer là **ngày ghi nhận** | Recorder chạy ngày một lượt và không ghi gì khi thẻ unpublish tạm; sửa thuộc `record-offer-history.mts` |

### `editorial_rules` (spec §15) cố ý CHƯA làm

Spec §35 không xếp nó vào Phase 1. Thêm sau là **thêm một entity**, không phải
migrate cái nào — đó là phép thử đúng.

---

## 8. Phase 2 — đã xong

Mô hình trạng thái người dùng nằm ở `src/lib/recommendation/user-*.ts` +
`data/user-fixtures.ts`. Tài liệu đầy đủ trong mục "Phase 2" của
[`src/lib/recommendation/README.md`](src/lib/recommendation/README.md) —
**đọc nó trước khi sửa**.

### 8.1 Câu hỏi database: CỐ Ý chưa trả lời, và không chặn Phase 3

§8.1 của bản bàn giao trước hỏi "dùng database gì cho dữ liệu người dùng".
Câu trả lời của Phase 2: **chưa cần trả lời**. Việc Phase 2 thật sự phải làm
là MÔ HÌNH, và mô hình không đổi theo chỗ lưu.

`UserDataSource` (`user-source.ts`) chỉ có **đọc** — Phase 3 chỉ đọc, còn phần
ghi dính chặt vào transaction/migration/quyền truy cập của một backend cụ thể.
`inMemoryUserStore` trả về **bản sao**, vì database nào cũng trả bản sao.

**Câu hỏi này phải trả lời trước Phase 5** (frontend lưu hồ sơ thật). Không
trước đó.

### 8.2 Những gì mô hình cố ý giữ tách nhau

Mỗi gạch đầu dòng dưới đây là một chỗ mà gộp lại sẽ làm engine sai **âm thầm**:

- **Trống ≠ bằng không ở BA mức.** Trường (`0` là câu trả lời, `null` là chưa
  hỏi) · bộ sưu tập (`UserState.declared` tách "tôi chưa có thẻ nào" — Test A —
  khỏi "tôi bấm bỏ qua") · dòng (`balance: null` = có tài khoản, không nhớ số
  dư, khác cả "không có dòng" lẫn "0 điểm").
- **`closed` và `previously_held` CÙNG nghĩa TỪNG GIỮ.** Viết luật Amex®
  once-in-a-lifetime bằng `status === "previously_held"` sẽ để thẻ `closed`
  lọt qua, và hậu quả không phải một lỗi — là một khuyến nghị hứa khoản bonus
  ngân hàng sẽ từ chối. **Dùng `everHeld` / `everHeldProductIds`, đừng so
  `status` trực tiếp.**
- **Tiền là KHOẢNG**, nên `compareToThreshold` cho **ba** kết quả. Thu nhập
  "60–80K" so với thẻ đòi $80,000 là `straddles`, không phải "không đạt" —
  §14 tách eligibility khỏi suitability đúng vì thế.
- **Thu nhập cá nhân và hộ gia đình là HAI trường.** Điều kiện của ngân hàng
  Canada nối bằng HOẶC, và vế hộ gia đình sinh ra để nhận người có thu nhập cá
  nhân DƯỚI ngưỡng — một trường duy nhất làm vế đó vô dụng. `isStudent` cùng
  lý do, cho `student_status_required`. Cả hai mặc định `null` và chỉ hỏi khi
  chúng quyết định điều gì đó (§30).
- **`lastClosed` có BA trạng thái**, và chuyển sang `unknown` khi chỉ một quãng
  giữ thẻ thiếu ngày đóng. Trả về ngày đã biết ở đó là trình bày một ngày cũ
  như thể nó là lần đóng gần nhất.
- **`personalIncomeDeclined` / `householdIncomeDeclined` tách "tôi không muốn
  nói" khỏi "chưa hỏi"** — và là HAI cờ, vì hộ gia đình chỉ đáng hỏi sau khi
  biết thu nhập cá nhân không đủ. Một cờ chung thì "khai câu đầu, từ chối câu
  sau" hoặc bị từ chối, hoặc bị hỏi lại mãi.
- **Validator kiểm cả kiểu lúc chạy, và kiểm trường CÓ MẶT.** TypeScript vắng
  mặt lúc chạy: `status` gõ sai, `"false"` thay cho `false`, hay một trường mới
  vắng ở dòng cũ đều đi qua sạch nếu không kiểm. `undefined` là ca tệ nhất — nó
  trượt qua mọi phép so `=== null` nên dữ liệu THIẾU trông như dữ liệu ĐẦY ĐỦ.
  Hai lớp chặn: `requirePresent`, và mọi phép so `null` ở cả validator lẫn
  `user-gaps.ts` dùng `== null`.
- **`primaryGoal` trả về `none` / `resolved` / `ambiguous`.** Nhiều mục tiêu
  cùng mức ưu tiên thì để `GoalId` quyết định là để một chuỗi sinh lúc lưu
  chọn hàm chấm điểm nào chạy.
- **`minimumSpendCapacity3m` KHÔNG suy từ `monthlyTotal`** (spec gọi nó
  "especially important"), và **số người bay KHÔNG mặc định là 1** — mặc định
  1 chia nhỏ số điểm cần cho một gia đình rồi để `NO_NEW_CARD` thắng nhờ một
  giả định. Ngược lại `originRegion` thì suy từ `profile.country`, vì nó đã
  nằm sẵn trong hồ sơ. Ranh giới là "đã biết ở chỗ khác", không phải "đoán
  được".

### 8.3 Không có chỗ nào nhét được dữ liệu nhạy cảm

Spec §4.4 cấm lưu số tài khoản loyalty. Cưỡng chế bằng cấu trúc: **cả mô hình
không có một trường chuỗi tự do nào** (mã sân bay ràng buộc `^[A-Z]{3}$`).
Không tên, không email, không ngày sinh; thu nhập là khoảng. Hai test chốt
việc này, và một test thứ ba chặn mô hình mã hoá kết quả — thêm
`preferredProductId` vào hồ sơ sẽ làm nó đỏ.

### 8.4 Kết quả kiểm thử Phase 2

```bash
npx tsc --noEmit        # sạch
npm run lint            # sạch
npm run build           # Compiled successfully
npm run test:reco       # 146/146 pass (91 của Phase 1 + 55 mới)
npm run test:game       # 43/43 pass
npm run audit:reco-data # 0 lỗi, 9 cảnh báo (y như trước, đều là chỗ trống có chủ ý)
```

### 8.5 Đã biết trước, để Phase 3 khỏi ngạc nhiên

- **Test C/D của spec §32 là chuyến Nhật, mà Phase 1 chưa dựng award strategy
  cho JAPAN** — chỉ `CANADA_US → SEA_VIETNAM` có dữ liệu. Đây KHÔNG phải lỗi
  Phase 2: chỗ trống được khai đúng (`award_route_uncovered`) và có test chốt
  rằng nó được nói ra chứ không im lặng. Nhưng muốn chạy Test C/D thật thì
  phải bổ sung award strategy cho JAPAN trước.
- `UserDataSource` vẫn **chưa từng chạy với một database thật**. Rủi ro lớn
  nhất của Phase 1 (§7) chưa được giải toả; `inMemoryUserStore` chỉ thu hẹp
  nó một phần bằng việc trả bản sao.
- `banking_relationship_required` là một `EligibilityRuleType` của Phase 1
  **chưa có dòng nào trong seed**, nên hồ sơ người dùng cũng chưa có trường
  tương ứng. Thêm luật đó vào một thẻ nào đó thì phải thêm trường cùng lúc,
  nếu không nó sẽ không đánh giá được.
- Mô hình **không có** khái niệm thẻ phụ / authorized user. Người giữ thẻ phụ
  hưởng quyền lợi nhưng thường không mất quyền welcome bonus — hiện chưa biểu
  diễn được. Ngoài phạm vi V1 nhưng sẽ va vào ở V2.

---

## 9. Việc còn lại — bắt đầu Phase 3

Spec §35 Phase 3. Xây theo `normalize.ts` → `portfolio.ts` → `strategies.ts` →
`needs.ts` → `eligibility.ts` / `suitability.ts` → `scoring/*` → `rules.ts` →
`rank.ts` (spec §26 nói thẳng: đừng gộp thành một `recommendation.ts` khổng lồ).

Bốn luật không được phá, giờ là năm:

1. Affiliate không bao giờ ảnh hưởng thứ hạng (§16 Rule 7).
2. Điểm tín dụng không phải điều kiện cứng (§3.10).
3. Không đếm trùng điểm chuyển được (§7).
4. `NO_NEW_CARD` là ứng viên trong **mọi** lượt chạy (§16 Rule 8).
5. Mô hình người dùng không mã hoá thẻ nào nên được khuyên — nếu Phase 3 thấy
   thiếu một trường, thêm một **ràng buộc** hoặc một **dữ kiện**, đừng thêm
   một sở thích về sản phẩm.

### Việc dọn dẹp có thể làm bất cứ lúc nào

- Award strategy cho JAPAN, EUROPE, EAST_ASIA (xem §8.5)
- Phép kiểm phủ sóng cho `product_benefits`
- `record-offer-history.mts` ghi dòng "không thấy thẻ này" khi thẻ vắng khỏi
  snapshot (xem §7)
- Cấu trúc hoá bảo hiểm trong `textValue` nếu Phase 3 cần chấm điểm bảo hiểm
- `editorial_rules` (spec §15) — thêm một entity, không migrate cái nào

### Quy ước của repo cần biết

- **Tự commit và push lên `origin main`** sau khi build/lint xanh — user đã cho
  phép sẵn cho repo này, không cần hỏi lại.
- **Trả lời user bằng tiếng Việt**, gọi user là "bạn", tự xưng là "mình".
- Comment trong code: repo trộn Việt/Anh; module này chủ yếu tiếng Việt, giải
  thích **vì sao** chứ không phải **làm gì**.
- Đụng vào thẻ tín dụng thì chạy `audit:trademarks`, `audit:rebate-prose`,
  `audit:reco-data`.
- Cross-check với Codex sau mỗi thay đổi:
  ```bash
  cd "/Users/hoangle/Developer/Claude Code/ghe-1a" && codex exec review --commit HEAD -m gpt-5.6-sol -c model_reasoning_effort="high" < /dev/null 2>&1 | tail -40
  ```
- ⚠️ **Đừng dùng `git checkout -- <file>` để hoàn tác thử nghiệm** khi file đó
  còn thay đổi chưa commit — đã mất việc hai lần trong Phase 1. Dùng bản sao.
