# Bàn giao: Recommendation Engine — bắt đầu Phase 3

Trạng thái **08/09/2026**. Phase 1 (lớp dữ liệu) và Phase 2 (trạng thái người
dùng) đã xong và đã lên `origin/main`. Đọc file này là đủ để làm tiếp Phase 3,
không cần lịch sử chat.

Spec đầy đủ: [`docs/recommendation-engine-v1.md`](docs/recommendation-engine-v1.md).
Mọi tham chiếu "§n" ở đây trỏ vào nó.
Tài liệu module: [`src/lib/recommendation/README.md`](src/lib/recommendation/README.md)
— **đọc trước khi sửa bất cứ gì trong module.**

---

## 1. Engine trả lời câu gì

> Với tình huống và mục tiêu của người này, bước hợp lý tiếp theo là gì?

**Nó KHÔNG được mặc định rằng mở thẻ mới luôn là câu trả lời đúng.**
`NO_NEW_CARD` là một ứng viên trong MỌI lượt chạy (§16 Rule 8).

Nguyên tắc kiến trúc quan trọng nhất: **engine phải tất định và giải thích
được.** LLM chỉ diễn đạt kết quả cuối ở Phase 6, không bao giờ quyết định thứ
hạng.

| Phase | Nội dung | Trạng thái |
| --- | --- | --- |
| 1 | Lớp dữ liệu nền | ✅ XONG |
| 2 | Hồ sơ người dùng, thẻ, số dư, goals | ✅ XONG |
| 3 | **Engine (Portfolio Analyzer → Ranking)** | ⬅️ **BẮT ĐẦU Ở ĐÂY** |
| 4 | Debugger + `recommendation_runs` | ⛔ |
| 5 | Frontend | ⛔ |
| 6 | LLM giải thích | ⛔ |

Phase 1 qua 31 commit và 24 vòng review Codex (68 phát hiện). Phase 2 qua 12
commit và 11 vòng (19 phát hiện). Tất cả đều đúng và đã vá.

---

## 2. Phase 3 phải xây gì

Spec §26 nói thẳng: **đừng gộp thành một `recommendation.ts` khổng lồ.** Cấu
trúc đề xuất, trong `src/lib/recommendation/`:

```
normalize.ts     goal normalizer — chuẩn hoá UserState + Goal thành đầu vào engine
portfolio.ts     §7  Portfolio Analyzer: direct / accessible / concentration / flexibility
strategies.ts    §8  Strategy Generator: sinh HÀNH ĐỘNG trước khi nghĩ tới thẻ
needs.ts         §9  Needs Engine: currency_needs / benefit_needs / portfolio_needs / action_need
eligibility.ts   §14 lọc theo điều kiện CỨNG
suitability.ts   §14 phù hợp ≠ đủ điều kiện — phí, thẻ doanh nghiệp, mốc chi
scoring/
  next-card.ts   §10.1
  trip.ts        §10.2
  diversify.ts   §10.3
  earning.ts
rules.ts         §16 tám luật bắt buộc (+ §15 editorial_rules, chưa làm)
rank.ts          §18 xếp hạng + NO_NEW_CARD
confidence.ts    §29 high/medium/low từ độ đầy đủ, độ tươi, độ cụ thể, khoảng cách điểm
explain.ts       §19 reason codes
```

Thứ tự xây: `normalize` → `portfolio` → `strategies` → `needs` → `eligibility`
/ `suitability` → `scoring/*` → `rules` → `rank` → `confidence` → `explain`.

### Tiêu chí nghiệm thu Phase 3 (§35)

- Cùng đầu vào + cùng version = **cùng đầu ra**.
- **LLM không tham gia.**
- **Affiliate không ảnh hưởng thứ hạng.**
- **`NO_NEW_CARD` thắng được.**
- **Không đếm trùng điểm chuyển được.**
- Mỗi loại mục tiêu dùng hàm chấm điểm **khác nhau**.

---

## 3. Đọc dữ liệu qua đâu

Import từ `@/lib/recommendation` (file `index.ts`). Đừng import thẳng file con.

### Dữ liệu sản phẩm

```ts
const data = await repoDataSource.getDataset({ asOf: "2026-09-08" });
const ix = indexDataset(data);
```

`getDataset({ asOf, knownAt })` cắt theo **hai trục thời gian** — `asOf` là "sự
thật này đúng lúc nào", `knownAt` là "bản ghi đã có trong kho lúc nào". Phase 4
dựng lại một lượt chạy cũ phải truyền CẢ HAI.

`indexDataset(data)` trả về các `Map` tra theo khoá ngoại — **dùng nó thay cho
`.filter()` trong vòng lặp ứng viên.** Ở database thì đây là index, và hình
dạng dữ liệu quyết định hình dạng code:

| Map | Dùng để |
| --- | --- |
| `productById` / `productBySlug` | tra sản phẩm (slug chỉ để nối Contentful) |
| `productsByFamily` | các hạng của một họ, **đã sắp thấp → cao** |
| `offersByProduct` / `componentsByOffer` | offer đang chạy và mốc chi của nó |
| `ratesByProduct` | tỷ lệ tích điểm |
| `benefitsByProduct` | quyền lợi, kèm `provider` |
| `feesByProduct` / `availabilityByProduct` | phí và quãng còn nhận đơn |
| `valuationsByProgram` | định giá điểm, **có phiên bản** |

`isAvailableAt(ix.availabilityByProduct.get(id), day)` = hôm đó thẻ có mở không.
`dataset.gaps` = chỗ Phase 1 không biết, máy đọc được (6 `kind`).

### Trạng thái người dùng

```ts
const state = await store.getUserState(userId);   // UserDataSource
```

**Đừng đọc thẳng trường.** Dùng các hàm này — chúng tồn tại vì viết tay ở chỗ
gọi thì sai âm thầm:

| Hàm | Vì sao đừng tự viết |
| --- | --- |
| `holdsNow` / `heldProductIds` | — |
| `everHeld` / `everHeldProductIds` | `closed` VÀ `previously_held` đều là TỪNG GIỮ |
| `lastClosed` → `never_closed \| closed \| unknown` | một quãng thiếu ngày làm cả câu trả lời thành chưa biết |
| `spendFor` | vắng mặt = chưa biết, KHÔNG phải 0 |
| `unallocatedMonthly` | phần chưa phân bổ ≠ 0 rải đều |
| `balanceRowFor` | dòng tồn tại với `balance: null` = có tài khoản, chưa biết số |
| `primaryGoal` → `none \| resolved \| ambiguous` | nhiều mục tiêu hoà nhau thì KHÔNG được chọn bừa |
| `resolveTripGoal` | điền vùng khởi hành từ `profile.country` |
| `compareToThreshold` → `at_or_above \| below \| straddles` | khoảng so ngưỡng cho BA kết quả |
| `userGaps` | mọi chỗ chưa biết, thứ tự cố định |

### Lịch sử offer

`repoDataSource.getOfferHistory(productId)` → `OfferHistoryPoint[]`, primitive
cho §12 (percentile lịch sử). Ba cái bẫy đã ghi trong README: **chỉ so hai điểm
CÙNG ĐƠN VỊ**; `until: null` nghĩa là *chưa quan sát thấy kết thúc*, không phải
"đang chạy"; và **mọi ngày là NGÀY GHI NHẬN**, không phải ngày nhà phát hành
công bố.

### Phép cộng chi tiêu welcome offer

`totalSpend`, `spendPerNinetyDays`, `longestWindowMonths` trong `spend.ts`.
**Đã sai bốn lần** trước khi ra lời giải đúng — xem §7 bên dưới.

---

## 4. Năm luật không được phá

1. **Affiliate không bao giờ ảnh hưởng thứ hạng** (§16 Rule 7).
   `Product.affiliateAvailable` được TÍNH từ chính `isReferralUrl` quyết định
   `rel="sponsored"` trên trang thẻ, nên nó không viết tay được.
2. **Điểm tín dụng không phải điều kiện cứng** (§3.10). `EligibilityRuleType`
   không có nhánh nào cho nó, và đừng thêm.
3. **Không đếm trùng điểm chuyển được** (§7). 100K MR không đồng thời là 100K
   Aeroplan + 100K Avios + 100K Flying Blue. Tách `direct` khỏi `accessible`,
   và một đồng điểm chỉ tiêu được MỘT lần dù nó với tới năm chương trình.
4. **`NO_NEW_CARD` là ứng viên trong mọi lượt chạy** (§16 Rule 8).
5. **Mô hình người dùng không mã hoá thẻ nào nên được khuyên.** Thấy thiếu một
   trường thì thêm một RÀNG BUỘC hoặc một DỮ KIỆN, đừng thêm một sở thích về
   sản phẩm. Có test chặn: thêm `preferredProductId` vào hồ sơ là test đỏ.

---

## 5. Sáu phép tính dễ sai

### 5.1 Số điểm một chuyến đi cần có BA thừa số

```
điểm cần = AwardStrategy.points × passengers × (roundTrip ? 2 : 1)
```

`AwardStrategy.pointsLow/Typical/High` là **một chiều, một người**. Thiếu thừa
số nào cũng sai im lặng, và cả hai đều sai về hướng nguy hiểm — chia nhỏ số
điểm cần rồi để `NO_NEW_CARD` thắng nhờ một giả định.

`passengers` và `roundTrip` đều `null` được. **Đừng mặc định** — có chỗ trống
riêng cho từng cái để §30 đi hỏi.

Và `pricingModel: "dynamic_floor"` thì CHỈ `pointsLow` có nghĩa; hai số kia bắt
buộc `null`. Đừng trình bày mức sàn như một cái giá.

### 5.2 Trống ≠ bằng không, ở BA mức

| Mức | Ví dụ |
| --- | --- |
| Trường | `grocery: 0` = đã hỏi, không chi. Vắng mặt = chưa hỏi. |
| Bộ sưu tập | `cards: []` + `declared.cards: true` = "tôi chưa có thẻ nào". `declared.cards: false` = chưa hỏi. |
| Dòng | `balance: null` = có tài khoản, không nhớ số dư. Không có dòng = không có tài khoản. |

Và `personalIncomeDeclined` = "tôi không muốn nói" ≠ "chưa hỏi": chỉ một trong
hai còn đi hỏi lại được.

### 5.3 Tiền là KHOẢNG

`EstimatedAmount { low, high }`, `high: null` = khoảng mở ("150K+").
`typicalAmount` của khoảng mở trả về `low` — **đừng tự bịa ra một trần** rồi lấy
chính con số bịa để kết luận người ta đủ điều kiện.

`compareToThreshold` cho BA kết quả. Thu nhập "60–80K" so với thẻ đòi $80,000
là `straddles`, KHÔNG phải "không đạt" — trả về `false` ở đó là loại oan đúng
những người mà khoảng đó bao trùm.

### 5.4 Sức dồn chi tiêu KHÔNG suy từ tổng tháng

`minimumSpendCapacity3m` là con số §13 so với `Offer.spendPerNinetyDays`. Hai
nhân vật mẫu chênh nhau **7 lần** về tỷ lệ dồn được ($3k/$7.5k so với
$2k/$36k), nên mọi hệ số suy đều sai nặng ở ít nhất một trong hai. Chưa biết
thì nói là chưa biết.

§13 cũng nói: mốc chi **không phải pass/fail**. Thẻ đòi $10,000 với người dồn
được $6,000 vẫn là ứng viên, chỉ bị phạt nặng kèm cảnh báo.

### 5.5 Quyền lợi trùng nhau phải CÙNG `provider`

"Miễn hành lý" của Air Canada® và của United® là hai thứ khác nhau. Chỉ
`duplicatesAcrossCards` một mình sẽ triệt tiêu giá trị thẻ United® chỉ vì người
dùng đã có thẻ Aeroplan®.

### 5.6 Phí thường niên: so với phí THỰC TRẢ năm đầu

`annualFeeTolerancePerCard` là ngưỡng của người dùng; `Offer.annualFeeFirstYear`
là phí thực trả năm đầu khi offer miễn phí. Thẻ $699 miễn năm đầu không phải
thứ người đặt ngưỡng $200 muốn bị giấu đi. §14 gọi đây là **phù hợp**, không
phải **đủ điều kiện** — nên phạt điểm, đừng loại.

---

## 6. Bộ test bắt buộc (§32) — chạy được cái nào ngay

Mười ca A–J. Phase 2 đã dựng sẵn nhân vật cho từng ca trong
[`data/user-fixtures.ts`](src/lib/recommendation/data/user-fixtures.ts) — 13
nhân vật, mỗi nhân vật có chú thích nói nó tồn tại để thử điều gì.

| Test | Nhân vật | Chạy được ngay? |
| --- | --- | --- |
| A — người mới | `beginnerNoCards` | ✅ |
| B — dồn hết vào Aeroplan® | `aeroplanHeavy` | ✅ |
| C — Nhật, đủ điểm | `japanTripFunded` | ⚠️ **cần award strategy cho JAPAN** |
| D — Nhật, thiếu điểm | `japanTripShortfall` | ⚠️ như trên |
| E — mốc chi ngoài tầm | `lowSpendCapacity`, `highSpendLowCapacity` | ✅ |
| F — affiliate lớn | bất kỳ (đổi phía sản phẩm) | ✅ |
| G — quyền lợi trùng | `duplicateBagBenefit` | ✅ |
| H — đã đủ điểm linh hoạt | `flexiblePointsSufficient` | ✅ |
| I — offer đổi | bất kỳ (đổi phía sản phẩm) | ✅ |
| J — thiếu dữ liệu | `nearlyEmpty`, `vagueEarner` | ✅ |

**Test C và D bị chặn bởi dữ liệu, không phải bởi code.** Phase 1 mới dựng
award strategy cho `CANADA_US → SEA_VIETNAM`; JAPAN, EUROPE, EAST_ASIA còn
trống và được khai đúng là `award_route_uncovered`. Muốn chạy C/D thật thì bổ
sung `data/award-strategies.ts` trước — **đừng lấp bằng số phỏng đoán**, đó
đúng là thứ lớp dữ liệu này từ chối làm.

Nhân vật khác không thuộc §32 nhưng có ích: `advancedCollector` (6 thẻ, 5 loại
điểm, mục tiêu `diversify`), `studentStarter` (nhánh ĐỦ điều kiện của
`student_status_required`, và từ chối nói thu nhập), `beginnerUndeclared` (mảng
rỗng vì chưa hỏi, không phải vì không có).

---

## 7. Ba bài học đắt nhất của Phase 1

### 7.1 Phép cộng chi tiêu welcome offer đã SAI BỐN LẦN

`spend.ts` — SUM, rồi MAX, rồi gom-theo-ngày-mở, rồi gom-liên-thông. Lần nào
cũng trông hiển nhiên đúng.

Lời giải đúng: đây là LP đối ngẫu của bài phủ trên hệ khoảng; ma trận ràng buộc
của hệ khoảng hoàn toàn đơn modular, nên tối ưu đạt tại **tập cửa sổ đôi một
rời nhau có tổng lớn nhất** (max-weight independent set trên đồ thị khoảng),
giải bằng quy hoạch động theo ngày kết thúc.

**Mỗi lần sai giờ là một test trong `spend.test.ts`. Đừng "đơn giản hoá" lại.**

### 7.2 `scripts/` từng nằm ngoài tsconfig → một lỗi SỐNG mà không ai thấy

`audit-reco-data.mts` đọc `product.isActive` sau khi trường đó bị đổi tên.
`undefined` là falsy nên `!undefined` luôn đúng → cả 31 phép so phí và rebate
với Contentful chết lặng, trong khi audit vẫn in "✓ Không lỗi".

Nay `scripts/` **được kiểm kiểu**. Đừng đưa nó ra khỏi `include` lần nữa.

### 7.3 Refactor "bảo toàn hành vi" phải có phép so hành vi

Chuyển `PROGRAM_RULES` sang suy từ dữ liệu làm hỏng 3 regex vì escape thừa — và
**2 trong 3 vẫn "chạy"** nhờ nhánh thay thế trong cùng regex. Chỉ Scene+™ đổ
hẳn. Thử một ca mỗi chương trình thì hai lỗi kia trôi thẳng lên production.

---

## 8. Bài học lớn nhất của Phase 2: BẢN VÁ ĐẺ RA LỖI TIẾP THEO

Tám vòng Codex liên tiếp, mỗi vòng bắt lỗi trong **bản vá của vòng trước**, chứ
không phải trong code gốc:

```
requirePresent báo lỗi rồi chạy tiếp    → vẫn nổ ở dòng sau
đổi hàng loạt sang == null              → ngăn được exception, nhưng trường
                                          BẮT BUỘC thiếu hẳn vẫn trượt qua
checkKeys chỉ kiểm dòng                 → bỏ sót vật chứa
?? [] cho vật chứa                      → cards: null đọc thành "không có thẻ",
                                          declared: false thì NÉM
```

Chuỗi chỉ **dừng** khi sửa nguyên nhân gốc thay vì triệu chứng: `asArray` và
validator kiểm cùng một khái niệm bằng hai dòng viết riêng, và chúng lệch
(`typeof [] === "object"`). Gộp thành MỘT hàm `isObject` đóng cả lớp lỗi.

> **Hai phép kiểm cùng một khái niệm thì phải là một hàm.**

Ba công cụ chống lớp lỗi này, đã nằm trong code — **dùng lại chúng ở Phase 3**:

- **Helper test trả kiểu union.** `gapKinds` trả `UserDataGap["kind"][]`, nên
  đổi tên một `kind` mà quên sửa test là LỖI BIÊN DỊCH, không phải một phép so
  luôn-sai chạy xanh mãi mãi. Đã bắt được lỗi thật hai lần.
- **`AssertAllKeys<T, KEYS>`.** Thêm một trường vào `UserProfile` mà quên phép
  kiểm hiện diện là lỗi biên dịch **nêu đích danh** trường bỏ sót.
- **Kiểm ngược mọi bản vá quan trọng: gỡ nó ra, test phải ĐỎ.** Đã làm thật với
  3 lệnh `sort`, 2 phép so `== null`, phép kiểm hiện diện của goal, và
  `!Array.isArray`. Test xanh mà không bảo vệ gì là thứ vòng review thường bỏ
  qua nhất.

Và: **chỗ trống không chặn điều gì thì đừng khai ra.** Một `UserDataGap` chỉ
được tồn tại nếu có dữ liệu hoặc quy tắc chấm điểm THẬT SỰ đọc nó — nếu không
nó chiếm suất câu hỏi của §30 và trừ độ tin cậy §29 vô cớ. Có test khoá từng
`kind` với lý do tồn tại; thêm `kind` mới mà không biện minh được là test đỏ.

---

## 9. Rủi ro và giới hạn đã biết

### Chưa chọn database, và điều đó CÓ CHỦ Ý

Dữ liệu người dùng rốt cuộc phải có DB thật. Phase 2 cố ý không quyết định thay:
việc của nó là MÔ HÌNH, và mô hình không đổi theo chỗ lưu. `UserDataSource` chỉ
có **đọc** (Phase 3 chỉ đọc); phần ghi đi liền với lựa chọn lưu trữ.

**Phải trả lời trước Phase 5, không sớm hơn.** Đây là quyết định về hạ tầng và
chi phí, không phải quyết định kỹ thuật thuần — repo chưa có DB nào, site deploy
thẳng từ `main` lên Hostinger.

### Rủi ro lớn nhất: interface chưa từng chạy với backend thứ hai

`RecommendationDataSource` và `UserDataSource` chưa bao giờ chạy với thứ gì
ngoài bản đọc file / bản trong bộ nhớ. `inMemoryUserStore` trả về **bản sao**
(như một database thật) nên thu hẹp được một phần, nhưng nó vẫn không phải
database. Lần thử thật lùi tới lúc chọn chỗ lưu.

### Lưới an toàn bắt DỮ LIỆU sai tốt hơn bắt CODE KIỂM TRA sai

Ba lỗi nghiêm trọng nhất của Phase 1 và bốn của Phase 2 đều **im lặng** — audit
xanh, test xanh, build xanh — và chỉ lộ ra khi có người soi từ góc khác.
**Giữ thói quen cross-check với Codex.**

### Giới hạn của mô hình (đã cân nhắc, cố ý giữ)

| Chỗ | Ảnh hưởng Phase 3 |
| --- | --- |
| Award strategy phủ 1/5 vùng của §33 | Test C/D chưa chạy được; có trong `gaps`, nói "chưa có dữ liệu" chứ không đoán |
| `EarningRate.restrictedTo` là chuỗi tự do | Dùng tỷ lệ nền; validator cưỡng chế mỗi hạng mục có đúng một dòng không giới hạn |
| Bảo hiểm còn trong `textValue` | Chỉ so được có/không, chưa chấm điểm được |
| 11/34 thẻ chưa biết điều kiện riêng | Có trong `gaps` |
| Điểm **hết hạn** không mô hình hoá | Aeroplan® hết hạn sau 18 tháng không hoạt động; đừng nói "bạn đã đủ điểm" như thể số dư vĩnh viễn |
| Đổi hạng thẻ trông như đóng-rồi-mở | Với luật welcome bonus thì kết quả như nhau |
| Điểm ngoài 16 chương trình không khai được | §7 tính tập trung danh mục hơi thổi phồng. Đúng phạm vi V1 (§33) |
| Không có thẻ phụ / authorized user | Hưởng quyền lợi nhưng thường không mất quyền welcome bonus. V2 |
| "Tôi có nên mở thẻ X?" không phải `goal_type` | §5 chỉ có bốn loại. Câu người đọc hay hỏi nhất — cân nhắc V2 |
| `recordedAt` không dựng lại được việc **đóng** một dòng | §20 `recommendation_runs.input_snapshot` mới là cơ chế thật |

### `editorial_rules` (§15) cố ý CHƯA làm

§35 không xếp nó vào Phase 1 hay 2. Thêm sau là **thêm một entity**, không phải
migrate cái nào — đó là phép thử đúng.

---

## 10. Chạy gì

```bash
npx tsc --noEmit          # sạch (đã bao gồm scripts/)
npm run lint              # sạch
npm run build             # Compiled successfully
npm run test:reco         # 169/169 pass
npm run test:game         # 43/43 pass (không liên quan, kiểm không hồi quy)
npm run audit:reco-data   # 0 lỗi, 9 cảnh báo (đều là chỗ trống có chủ ý)
```

Đụng vào thẻ tín dụng thì chạy thêm `audit:trademarks`, `audit:rebate-prose`,
`audit:best-cards` — xem [CLAUDE.md](CLAUDE.md).

`test:reco` chạy bằng `node --test --experimental-strip-types`, nên **mọi import
tương đối trong module phải mang đuôi `.ts` tường minh**, và `offer-history.ts`
chỉ được import KIỂU từ `lib/offer-history.ts` (file kia nạp JSON, Node đòi
`with { type: "json" }`).

### Quy mô dữ liệu hiện tại

34 sản phẩm (6 họ) · 34 mức phí · 16 định giá · 34 offer · 73 component ·
152 tỷ lệ tích điểm · 4 trần dùng chung · 136 quyền lợi · 80 điều kiện ·
9 chặng chuyển · 9 award strategy · 25 chỗ trống khai tường minh.
13 nhân vật người dùng.

Đo trên bộ tổng hợp: 65,936 dòng → `validateDataset` 245 ms, `datasetAt` 1 ms,
`indexDataset` 0 ms. Tuyến tính. Validator dành cho CI/audit, không phải mỗi
request; Phase 3 đọc qua `datasetAt` + `indexDataset`.

---

## 11. Quy ước của repo

- **Tự commit và push lên `origin main`** sau khi build/lint xanh — user đã cho
  phép sẵn cho repo này, không cần hỏi lại.
- **Trả lời user bằng tiếng Việt**, gọi user là "bạn", tự xưng là "mình".
- Comment trong code: giải thích **vì sao**, không phải **làm gì**. Module này
  chủ yếu tiếng Việt.
- **Cross-check với Codex sau mỗi thay đổi:**
  ```bash
  cd "/Users/hoangle/Developer/Claude Code/ghe-1a" && codex exec review --commit HEAD -m gpt-5.6-sol -c model_reasoning_effort="high" < /dev/null 2>&1 | tail -40
  ```
  Vòng đáng giá nhất là vòng bắt Codex **bác lại chính bản vá của nó** — ba lựa
  chọn ĐÚNG / SAI / BẢN VÁ HỎNG, kết bằng "còn chặn Phase sau không?". Cũng bắt
  nó bác cả kết luận "sạch".
- ⚠️ **Có thể có phiên khác chạy song song trong cùng thư mục này.** Kiểm
  `git status` trước khi stage, và **stage theo đường dẫn cụ thể**, đừng
  `git add -A` — đã có lần quét nhầm file của phiên khác vào commit.
- ⚠️ **Đừng dùng `git checkout -- <file>` để hoàn tác thử nghiệm** khi file đó
  còn thay đổi chưa commit — đã mất việc hai lần trong Phase 1. Dùng bản sao.
