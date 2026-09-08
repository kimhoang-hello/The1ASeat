# Bàn giao: Recommendation Engine — bắt đầu Phase 4

Trạng thái **08/09/2026**. Phase 1 (lớp dữ liệu), Phase 2 (trạng thái người
dùng) và Phase 3 (engine) đã xong và đã lên `origin/main`. Đọc file này là đủ
để làm tiếp Phase 4, không cần lịch sử chat.

Spec đầy đủ: [`docs/recommendation-engine-v1.md`](docs/recommendation-engine-v1.md).
Mọi tham chiếu "§n" ở đây trỏ vào nó.
Tài liệu module: [`src/lib/recommendation/README.md`](src/lib/recommendation/README.md)
— **đọc trước khi sửa bất cứ gì trong module.**

---

## 1. Trạng thái

| Phase | Nội dung | Trạng thái |
| --- | --- | --- |
| 1 | Lớp dữ liệu nền | ✅ XONG |
| 2 | Hồ sơ người dùng, thẻ, số dư, goals | ✅ XONG |
| 3 | Engine (Portfolio Analyzer → Ranking) | ✅ XONG |
| 4 | **Debugger + `recommendation_runs`** | ⬅️ **BẮT ĐẦU Ở ĐÂY** |
| 5 | Frontend | ⛔ |
| 6 | LLM giải thích | ⛔ |

Phase 1: 31 commit, 24 vòng Codex, 68 phát hiện.
Phase 2: 12 commit, 11 vòng, 19 phát hiện.
Phase 3: 5 commit, 3 vòng Codex (20 phát hiện, 7 P1) + 4 lỗi tự tìm khi đọc
kết quả chạy. 232 test.

### Tiêu chí nghiệm thu Phase 3 — đã đạt

| Tiêu chí | Bằng chứng |
| --- | --- |
| Cùng đầu vào + cùng version = cùng đầu ra | test tất định, kể cả khi đảo thứ tự mọi mảng đầu vào |
| LLM không tham gia | không có lời gọi nào; `ENGINE_VERSION` thuần |
| Affiliate không ảnh hưởng thứ hạng | 2 test: đảo cờ trên toàn bộ sản phẩm, VÀ quét mã nguồn 21 file |
| `NO_NEW_CARD` thắng được | `vietnamTripFunded` → 0.503, độ tin cậy CAO |
| Không đếm trùng điểm chuyển được | `accessible` trả kèm `sources`; tập trung chia phân số |
| Mỗi mục tiêu một hàm chấm điểm | 4 bộ khoá thành phần khác nhau, test khoá trọng số theo §10 |

**Phép thử thật sự** — cùng chặng, cùng hạng ghế, khác đúng hai con số:

| | thắng | chiến lược | vì sao |
| --- | --- | --- | --- |
| `vietnamTripFunded` (260K Aeroplan®, 1 người) | **`NO_NEW_CARD`** | `USE_EXISTING_POINTS` | `pointsGapTypical: 0`, Rule 1 nổ |
| `vietnamTripShortfall` (20K, 2 người) | `amex-gold-rewards` | `EARN_FLEXIBLE_POINTS` | thiếu > 100,000; MR chuyển sang Aeroplan® |

---

## 2. Phase 4 phải xây gì (§20, §22)

### 2.1 `recommendation_runs` — bản chụp một lượt chạy

```sql
recommendation_runs
-------------------
id, user_id, engine_version, created_at
input_snapshot   jsonb   -- UserState + DatasetQuery { asOf, knownAt }
derived_state    jsonb   -- portfolio, strategies, needs
output           jsonb   -- RecommendationRun
```

**`input_snapshot` là cơ chế thật, không phải `datasetAt`.** README Phase 1 nói
rõ giới hạn: đóng một dòng cũ là SỬA dòng đó, và bản ghi không giữ lại việc nó
từng mở — nên dựng lại một ngày trước lần đóng sẽ thấy dòng đã đóng. Bản chụp
đã lưu luôn đúng hơn mọi phép dựng lại.

Dựng lại một lượt cũ phải truyền **CẢ HAI** trục thời gian:
`getDataset({ asOf, knownAt })`. Thiếu `knownAt` thì đính chính nhập sau sẽ lọt
vào lời giải thích của một lượt chạy trước đó.

`recommend()` là hàm **THUẦN và ĐỒNG BỘ** đúng để phục vụ việc này — dựng lại
một lượt chạy không phải đi qua lớp bất đồng bộ nào. `recommendFromSource()` là
bản có I/O, chỉ để nạp lịch sử offer.

### 2.2 Recommendation Debugger (§22)

Trả lời "vì sao thẻ này thắng". Dữ liệu đã có sẵn, chỉ cần trình bày:

- `Candidate.components` — bảng §19, dùng `scoreTable()` để sắp theo đóng góp.
  Mỗi dòng có `weight` (đúng con số §10), `raw`, `contribution`, và `note` giải
  thích `raw` từ đâu ra.
- `Candidate.adjustments` — từng luật §16 đã sửa điểm bao nhiêu, có tên.
- `Recommendation.strategies` — cả chín hành động và điểm của chúng.
- `Recommendation.confidence` — bốn thừa số của §29 + `notes`.
- `RecommendationRun.dataGaps` / `userGaps` — chỗ trống lượt chạy này chạm tới.

Bất biến đã có test: **bảng điểm cộng lại đúng bằng `baseScore`, và
`baseScore` + tổng `adjustments` đúng bằng `score`.** Giữ nó — nó là thứ làm
bảng debugger đáng tin.

### 2.3 Bộ test §32 còn thiếu gì

| Test | Nhân vật | Trạng thái |
| --- | --- | --- |
| A — người mới | `beginnerNoCards` | ✅ |
| B — dồn hết vào Aeroplan® | `aeroplanHeavy` | ✅ |
| C — đủ điểm | `vietnamTripFunded` | ✅ (xem dưới) |
| D — thiếu điểm | `vietnamTripShortfall` | ✅ (xem dưới) |
| E — mốc chi ngoài tầm | `lowSpendCapacity`, `highSpendLowCapacity` | ✅ |
| F — affiliate lớn | mọi nhân vật | ✅ |
| G — quyền lợi trùng | `duplicateBagBenefit` | ✅ |
| H — đủ điểm linh hoạt | `flexiblePointsSufficient` | ⚠️ chạy được nhưng EUROPE chưa có giá |
| I — offer đổi | mọi nhân vật | ✅ |
| J — thiếu dữ liệu | `nearlyEmpty`, `vagueEarner` | ✅ |

**Test C/D chạy trên chặng Việt Nam, không phải Nhật.** §33 mới phủ
`CANADA_US → SEA_VIETNAM`; JAPAN, EUROPE, EAST_ASIA còn trống và được khai
đúng là `award_route_uncovered`. Cách SAI để mở khoá là bịa một bảng giá. Hai
nhân vật Nhật **ở lại** làm ca "engine gặp chỗ trống của lớp dữ liệu".

Muốn Test H đầy đủ (và mọi chuyến châu Âu) thì bổ sung `data/award-strategies.ts`
— **đừng lấp bằng số phỏng đoán.**

---

## 3. Đọc dữ liệu qua đâu

Import từ `@/lib/recommendation` (`index.ts`). Đừng import thẳng file con.

⚠️ **Test thì NGƯỢC LẠI: đừng import `index.ts`.** Nó tái xuất `source.ts`,
thứ import `@/lib/...`, và alias đó chỉ tồn tại trong bundler của Next.
`node --test` sẽ nổ `ERR_MODULE_NOT_FOUND`. Import thẳng từng file.

```ts
const data = await repoDataSource.getDataset({ asOf: "2026-09-08" });
const ix = indexDataset(data);
const state = await store.getUserState(userId);
const run = recommend({ state, data, ix, asOf: "2026-09-08" });
```

Bảng các hàm đọc trạng thái người dùng, hai trục thời gian, và các `Map` của
`indexDataset` — xem [README](src/lib/recommendation/README.md), mục Phase 1/2.

---

## 4. Sáu luật không được phá

1. **Affiliate không bao giờ ảnh hưởng thứ hạng** (§16 Rule 7). Cưỡng chế bằng
   SỰ VẮNG MẶT + hai test, một trong đó quét mã nguồn.
2. **Điểm tín dụng không phải điều kiện cứng** (§3.10). `EligibilityRuleType`
   không có nhánh nào cho nó, và đừng thêm.
3. **Không đếm trùng điểm chuyển được** (§7). Một đồng điểm chỉ tiêu được MỘT
   lần dù nó với tới năm chương trình.
4. **`NO_NEW_CARD` là ứng viên trong mọi lượt chạy** (§16 Rule 8).
5. **Mô hình người dùng không mã hoá thẻ nào nên được khuyên.** Thêm
   `preferredProductId` vào hồ sơ là test đỏ.
6. **`strategies.ts` và `needs.ts` không được nhắc tên sản phẩm nào.** Khoảnh
   khắc một chiến lược sinh ra vì một cái thẻ cụ thể, thứ tự suy luận của spec
   đã bị đảo ngược.

---

## 5. Bài học lớn nhất của Phase 3

> **Lỗi nằm ở chỗ engine ĐỌC CÁI CỜ thay vì ĐỌC DỮ LIỆU.**

Cả ba lỗi tự tìm được đều biên dịch sạch, test xanh, và cho ra những con số
trông hợp lý. Không lỗi nào lộ ra khi viết code; cả ba lộ ra khi **in bảng điểm
của một lượt chạy thật rồi đọc từng dòng**.

1. `marriott-bonvoy` khai `transferable: true` với ĐÚNG KHÔNG chặng nào. Lớp dữ
   liệu đã khai `transfer_paths_unmodelled`, và `audit:reco-data` cảnh báo bằng
   một câu tiên đoán chính xác lỗi này. Engine vẫn đọc cờ → Bonvoy® đứng đầu
   bảng cho một người muốn BAY.
2. Miễn phí năm đầu ĐẾM HAI LẦN trên cả 9 thẻ có `fee_waiver`.
3. Trần `kind: "spend"` đem trần-ĐÔ chia cho tổng-ĐIỂM.

### Chuỗi review lặp lại y hệt Phase 2

| Vòng | Số lỗi | Lỗi nằm ở đâu |
| --- | --- | --- |
| 1 | 12 (4 P1) | code gốc |
| 2 | 5 (2 P1) | **toàn bộ trong bản vá của vòng 1** |
| 3 | 3 (1 P1) | **toàn bộ trong bản vá của vòng 2** |

Rõ nhất là câu chuyện ĐƠN VỊ của offer tiền mặt: ba cách đoán, ba vòng, ba
kiểu hỏng — tra ngược theo con số, gán cứng `cash → dollar`, lấy đơn vị đợt
gần nhất. Chuỗi chỉ dừng khi **thôi đoán** và trả `null` lúc không chắc.

> **Khi một bản vá là bản vá thứ ba cho cùng một chỗ, vấn đề không nằm ở cách
> vá.** Nó nằm ở việc đang cố suy ra một thứ không tồn tại trong dữ liệu.

Và bài học của vòng 1: **bốn lỗi P1 đều là những chỗ mình TƯỞNG đã làm mà
chưa nối dây.** Lọc `ineligible` khỏi ứng viên — tưởng đã có, thật ra chỉ lọc
`suitability.excluded`. `eligibility_unknown` — tưởng đọc rồi, thật ra chưa
truyền vào. Ba lần test đỏ trong vòng vá là ASSERTION quá chặt, không phải code
sai; một lần là test bắt đúng lỗi trong chính bản vá vừa viết.

> **Kiểm ngược mọi bản vá quan trọng: gỡ nó ra, test phải ĐỎ.** Đã làm thật với
> 9 bản vá của Phase 3. Một lần đầu tiên test KHÔNG đỏ — và nó lộ ra rằng bài
> test đang chứng minh một chuyện khác với chuyện nó tưởng.

⚠️ Và một cái bẫy đã sập lần thứ ba: **đừng dùng `git checkout -- <file>` để
hoàn tác một thử nghiệm** khi file đó còn thay đổi chưa commit. Nó quay về bản
đã commit, tức bản CÒN LỖI. Dùng bản sao (`cp` sang `/tmp`).

---

## 6. Rủi ro và giới hạn đã biết

### Chưa chọn database — **phải trả lời TRƯỚC Phase 5**

`UserDataSource` chỉ có ĐỌC, và Phase 3 chỉ đọc, nên tới đây vẫn chưa cần. Phần
GHI đi liền với lựa chọn lưu trữ. Phase 4 (`recommendation_runs`) là chỗ đầu
tiên cần GHI thật — nên **câu hỏi database rơi vào đúng Phase 4**, sớm hơn dự
kiến của bản bàn giao trước.

### Giới hạn của mô hình (đã cân nhắc, cố ý giữ)

| Chỗ | Ảnh hưởng |
| --- | --- |
| Award strategy phủ 1/5 vùng của §33 | Chuyến Nhật/Âu/Đông Á rơi vào nhánh "chưa có giá"; §29 hạ độ tin cậy |
| Hệ sinh thái = CHƯƠNG TRÌNH, không phải liên minh | Aeroplan® và United® đếm thành hai. Tập trung bị đo THIẾU chứ không thừa — engine khuyên đa dạng hoá ít hơn mức đáng, không ép vô cớ |
| Chặng chuyển đòi hạng thành viên bị BỎ khỏi điểm tiếp cận được | Ước lượng thiếu; hướng an toàn (không hứa điểm người dùng không với tới) |
| `editorial_rules` (§15) chưa làm | 5% trọng số editorial của §10 bằng 0 cho MỌI ứng viên, nên không đổi thứ hạng. `editorialAdjustment()` đã có chỗ và đã bị chặn ±10% |
| Percentile lịch sử gần như luôn `null` | Nhật ký mới bắt đầu 29/08/2026, dưới 3 đợt thì trả `null`. Đúng — "mới theo dõi một tháng" không được nói thành "cao nhất từng thấy" |
| Bảo hiểm còn trong `textValue` | Chỉ so được có/không, chưa chấm điểm được |
| Điểm **hết hạn** không mô hình hoá | Mọi câu "bạn đã đủ điểm" đi kèm `POINTS_EXPIRY_NOT_MODELLED` |
| Không có thẻ phụ / authorized user | V2 |
| "Tôi có nên mở thẻ X?" không phải `goal_type` | §5 chỉ có bốn loại. Câu người đọc hay hỏi nhất — cân nhắc V2 |

### Trọng số nào là của SPEC, trọng số nào là của ENGINE

Bốn bảng §10 chép nguyên văn, có test khoá. Những chỗ engine tự chọn — và đều
nói ra ngay đầu file:

- `scoring/earning.ts` — cả bảng (spec nêu tên hàm, không cho trọng số).
- `rank.ts` — bảng của `NO_NEW_CARD`.
- `offer-quality.ts` — năm vế của §11 (spec liệt kê thành phần, không cho tỷ lệ).
- `confidence.ts` — cách trộn bốn thừa số của §29.

---

## 7. Chạy gì

```bash
npx tsc --noEmit          # sạch (đã bao gồm scripts/)
npm run lint              # sạch
npm run build             # Compiled successfully
npm run test:reco         # 232/232 pass
npm run test:game         # 43/43 pass (không liên quan, kiểm không hồi quy)
npm run audit:reco-data   # 0 lỗi, 9 cảnh báo (đều là chỗ trống có chủ ý)
```

Đụng vào thẻ tín dụng thì chạy thêm `audit:trademarks`, `audit:rebate-prose`,
`audit:best-cards` — xem [CLAUDE.md](CLAUDE.md).

`test:reco` chạy bằng `node --test --experimental-strip-types`, nên **mọi import
tương đối trong module phải mang đuôi `.ts` tường minh**, và `offer-history.ts`
chỉ được import KIỂU từ `lib/offer-history.ts`.

---

## 8. Quy ước của repo

- **Tự commit và push lên `origin main`** sau khi build/lint xanh.
- **Trả lời user bằng tiếng Việt**, gọi user là "bạn", tự xưng là "mình".
- Comment trong code: giải thích **vì sao**, không phải **làm gì**.
- **Cross-check với Codex sau mỗi thay đổi:**
  ```bash
  cd "/Users/hoangle/Developer/Claude Code/ghe-1a" && codex exec review --commit HEAD -m gpt-5.6-sol -c model_reasoning_effort="high" < /dev/null 2>&1 | tail -40
  ```
  Vòng đáng giá nhất là vòng bắt Codex **bác lại chính bản vá của nó** — ba lựa
  chọn ĐÚNG / SAI / BẢN VÁ HỎNG, kết bằng "còn chặn Phase sau không?". Cũng bắt
  nó bác cả kết luận "sạch".
- ⚠️ **Có thể có phiên khác chạy song song.** Kiểm `git status` trước khi stage,
  và **stage theo đường dẫn cụ thể**, đừng `git add -A`.
- ⚠️ **Đừng dùng `git checkout -- <file>` để hoàn tác thử nghiệm** khi file đó
  còn thay đổi chưa commit. Dùng bản sao.
