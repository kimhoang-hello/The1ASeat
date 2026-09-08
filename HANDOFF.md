# Bàn giao: Recommendation Engine — bắt đầu Phase 4

Trạng thái **08/09/2026**. Phase 1 (lớp dữ liệu), Phase 2 (trạng thái người
dùng) và Phase 3 (engine) đã xong và đã lên `origin/main`. Đọc file này là đủ
để làm tiếp Phase 4, không cần lịch sử chat.

Spec đầy đủ: [`docs/recommendation-engine-v1.md`](docs/recommendation-engine-v1.md).
Mọi tham chiếu "§n" trỏ vào nó.
Tài liệu module: [`src/lib/recommendation/README.md`](src/lib/recommendation/README.md)
— **đọc trước khi sửa bất cứ gì trong module.**

---

## 1. Trạng thái

| Phase | Nội dung | Trạng thái |
| --- | --- | --- |
| 1 | Lớp dữ liệu nền | ✅ XONG |
| 2 | Hồ sơ người dùng, thẻ, số dư, goals | ✅ XONG |
| 3 | Engine (Portfolio Analyzer → Ranking) | ✅ XONG |
| 4 | **`recommendation_runs` + Debugger** | ⬅️ **BẮT ĐẦU Ở ĐÂY** |
| 5 | Frontend | ⛔ |
| 6 | LLM giải thích | ⛔ |

Phase 1: 31 commit, 24 vòng Codex, 68 phát hiện.
Phase 2: 12 commit, 11 vòng, 19 phát hiện.
Phase 3: 24 commit, 10 vòng Codex (40 phát hiện, 11 P1, 2 bản vá bị bác) + 17
lỗi tự tìm khi đọc kết quả chạy. **272 test**, `ENGINE_VERSION` 4.0.0.

### Tiêu chí nghiệm thu Phase 3 — đã đạt, kiểm bằng chạy thật

| Tiêu chí | Bằng chứng |
| --- | --- |
| Cùng state + data + version = cùng đầu ra | 3 lượt × 15 nhân vật; đảo thứ tự mảng; đảo thứ tự sản phẩm |
| LLM không tham gia | không có lời gọi nào; `recommend()` thuần và đồng bộ |
| Affiliate không ảnh hưởng thứ hạng | đảo cờ trên MỌI sản phẩm + quét mã nguồn 21 file |
| `NO_NEW_CARD` thắng được | 0.723, hơn MỌI thẻ, có mặt mọi lượt chạy |
| Không đếm trùng điểm chuyển được | mỗi đích quy đổi theo tỷ lệ CỦA NÓ, `sources` chung |
| Mỗi mục tiêu một hàm chấm điểm | 4 ý định → 4 bộ thành phần khác nhau |

**Phép thử thật** — cùng chặng, khác đúng hai con số:

| | thắng | chiến lược |
| --- | --- | --- |
| 260K Aeroplan®, 1 người, VN business | **`NO_NEW_CARD`** 0.723 | `USE_EXISTING_POINTS` |
| 20K, 2 người, cùng chặng | `amex-gold-rewards` | `EARN_FLEXIBLE_POINTS` |

---

## 2. Phase 4 phải xây gì

### 2.1 MỞ `derived_state` RA TRƯỚC — đây là việc đầu tiên

**`RecommendationRun` hiện KHÔNG xuất ba thứ mà §22 bắt buộc**, dù engine đã
tính đủ cả ba rồi vứt đi:

| §22 đòi | Engine có? | Ở đâu trong `engine.ts` |
| --- | --- | --- |
| Normalized goal | ✅ | `goalResolution`, `results[].goalType` |
| **Portfolio analysis** | ❌ **vứt đi** | `analyzePortfolio(...)` — biến `portfolio` |
| **Derived needs** | ❌ **vứt đi** | `computeNeeds(...)` — biến `needs` |
| Generated strategies | ✅ | `results[].strategies` |
| **Excluded products** | ❌ **vứt đi** | `facts` trừ `selectable` |
| Suitability warnings | ⚠️ chỉ của thẻ CÒN trong bảng | `candidate.suitability` |
| Candidate products | ✅ | `primaryAction`, `alternatives` |
| Score breakdown | ✅ | `components`, `adjustments` |
| Editorial rule effects | ✅ | `adjustments` (§15 chưa làm nên rỗng) |
| Final recommendation | ✅ | `primaryAction` |
| Confidence | ✅ | `confidence` + 4 thừa số |

Ba ô ❌ chính là `derived_state` của §20. Chúng là **cùng một việc**: thêm
chúng vào `RecommendationRun` vừa mở khoá debugger vừa lấp đúng cột schema.

**Thẻ BỊ LOẠI quan trọng ngang thẻ được chọn.** Câu admin hỏi nhiều nhất sẽ là
"vì sao thẻ X không hiện ra", và hôm nay engine không trả lời được — nó lọc
`ineligible` và `suitability.excluded` rồi im lặng. Giữ lại danh sách đó kèm
LÝ DO (`failedRuleIds`, `excludedReason`) là việc nhỏ ở `engine.ts`, và không
có nó thì debugger trả lời được một nửa câu hỏi.

⚠️ Thêm trường vào `RecommendationRun` **không** đổi thứ hạng, nên KHÔNG cần
tăng `ENGINE_VERSION` — nhưng bản chụp §20 phải chạy lại (xem §7).

### 2.2 `recommendation_runs` (§20)

```sql
recommendation_runs
-------------------
id, user_id nullable
engine_version text          -- ENGINE_VERSION
rule_version text            -- §15 chưa làm ⇒ hằng, nhưng giữ cột
data_snapshot_at timestamptz -- = asOf
input_snapshot   jsonb
derived_state    jsonb       -- portfolio + needs + excluded (xem 2.1)
output_snapshot  jsonb
created_at
```

**`input_snapshot` phải lưu ĐỦ để chạy lại, không chỉ `{ asOf, knownAt }`.**
README Phase 1 nói thẳng giới hạn: đóng một dòng cũ là SỬA dòng đó, và bản ghi
không giữ lại việc nó từng mở — nên `datasetAt` dựng lại một ngày trước lần
đóng sẽ thấy dòng đã đóng. Bản chụp đã lưu luôn đúng hơn mọi phép dựng lại.

Tối thiểu phải chụp:

1. `UserState` (nguyên vẹn),
2. `RecommendationDataset` đã cắt theo `asOf`/`knownAt` — hoặc một **dấu vân
   tay nội dung** cộng cam kết dữ liệu bất biến,
3. **`offerHistory`** — đây là cái dễ quên nhất. Nó là THAM SỐ của
   `recommend()`, không nằm trong `RecommendationDataset`, và thiếu nó thì
   percentile §12 chạy lại ra khác.

`engine.test.ts` đã có sẵn hàm băm FNV-1a trên nội dung dataset — dùng lại nó
thay vì viết cái thứ hai.

### 2.3 Debugger (§22) — **bắt buộc cho V1**

Admin nhập một hồ sơ giả, hệ thống in ra 11 mục ở bảng trên. Dữ liệu đã có
sẵn sau khi làm 2.1; việc còn lại là trình bày.

Bất biến đã có test, **giữ nó** — nó là thứ làm bảng debugger đáng tin:

> bảng điểm cộng lại ĐÚNG bằng `baseScore`, và `baseScore` + tổng
> `adjustments` ĐÚNG bằng `score`.

`scoreTable()` trong `explain.ts` sắp sẵn theo đóng góp giảm dần.

### 2.4 Quyết định DATABASE — **đến hạn ở đây**

Phase 2 và 3 chỉ ĐỌC, nên `UserDataSource` không có phần ghi. `recommendation_runs`
là chỗ đầu tiên cần **GHI thật**, nên câu hỏi này rơi vào đúng Phase 4 — sớm
hơn dự kiến của bản bàn giao Phase 3.

Ràng buộc có thật của repo, không phải sở thích:

- Chưa từng có database nào. Dữ liệu tham chiếu nằm trong module TS, nội dung
  biên tập ở Contentful, site deploy thẳng từ `main` lên Hostinger.
- `RecommendationDataSource` và `UserDataSource` **chưa bao giờ chạy với thứ gì
  ngoài bản đọc file / bản trong bộ nhớ.** `inMemoryUserStore` trả về BẢN SAO
  (như một database thật) nên thu hẹp được một phần, nhưng nó vẫn không phải
  database. Đây là rủi ro lớn nhất còn lại của cả ba phase.
- `recommendation_runs` ghi nhiều, đọc ít, không cần join phức tạp — nên nó
  KHÔNG ép lựa chọn nào. Đừng để một bảng append-only quyết định kiến trúc dữ
  liệu người dùng.

---

## 3. Đọc dữ liệu qua đâu

Import từ `@/lib/recommendation` (`index.ts`). Đừng import thẳng file con.

⚠️ **Test thì NGƯỢC LẠI: đừng import `index.ts`.** Nó tái xuất `source.ts`,
thứ import `@/lib/...` — alias chỉ tồn tại trong bundler của Next, nên
`node --test` nổ `ERR_MODULE_NOT_FOUND`. Import thẳng từng file.

```ts
const data = await repoDataSource.getDataset({ asOf: "2026-09-08" });
const ix = indexDataset(data);
const state = await store.getUserState(userId);
const run = recommend({ state, data, ix, asOf: "2026-09-08" });   // THUẦN, ĐỒNG BỘ
```

`recommend()` thuần và đồng bộ **là một lựa chọn thiết kế cho đúng Phase 4**:
chạy lại một lượt chạy cũ không phải đi qua lớp I/O nào. `recommendFromSource()`
là bản có I/O, chỉ để nạp lịch sử offer.

Bảng các hàm đọc trạng thái người dùng, hai trục thời gian, và các `Map` của
`indexDataset` — xem [README](src/lib/recommendation/README.md).

---

## 4. Sáu luật không được phá

1. **Affiliate không bao giờ ảnh hưởng thứ hạng** (§16 Rule 7). Cưỡng chế bằng
   SỰ VẮNG MẶT + hai test, một trong đó quét mã nguồn 21 file.
2. **Điểm tín dụng không phải điều kiện cứng** (§3.10).
3. **Không đếm trùng điểm chuyển được** (§7). Một đồng điểm chỉ tiêu được MỘT
   lần dù nó với tới năm chương trình.
4. **`NO_NEW_CARD` là ứng viên trong mọi lượt chạy** (§16 Rule 8).
5. **Mô hình người dùng không mã hoá thẻ nào nên được khuyên.** Thêm
   `preferredProductId` vào hồ sơ là test đỏ.
6. **`strategies.ts` và `needs.ts` không được nhắc tên sản phẩm nào**, và 21
   file engine không được nhắc slug/id sản phẩm hay chương trình. Có test cấu
   trúc quét cả hai.

---

## 5. Cạm bẫy cụ thể của Phase 4

**Dữ liệu không dùng được là CHƯA BIẾT, không phải một giá trị.** Ba phép kiểm
chung ở `user.ts` — `usableBalance`, `usablePassengers`, `usableRoundTrip`.
Dùng lại chúng, đừng viết phép kiểm mới. Engine KHÔNG gọi `validateUserState`
(§30 đòi nhận hồ sơ dở dang), nên nó tự phòng ở mọi biên giới.

**Lưới an toàn bắt DỮ LIỆU sai tốt hơn bắt CODE KIỂM TRA sai.** Ba lỗi nghiêm
trọng nhất của Phase 1, bốn của Phase 2 và toàn bộ Phase 3 đều **im lặng** —
audit xanh, test xanh, build xanh — và chỉ lộ ra khi có người in bảng số ra
rồi đọc từng dòng. Debugger của Phase 4 chính là dụng cụ đó; hãy dùng nó lên
chính các nhân vật mẫu ngay khi dựng xong.

**Phép thử một bài test:** nó có GỌI thứ nó đang kiểm không, và nó có ĐỎ được
không? Phase 3 có **ba** bài test xanh mà không bảo vệ gì, cả ba chỉ lộ ra khi
làm phép kiểm ngược.

**Khi một bài kiểm đỏ, hỏi TRƯỚC: bất biến mình vừa viết ra có ĐÚNG không?**
Trong vòng rà cuối, ba lần liên tiếp câu trả lời là không — bài kiểm sai, engine
đúng ("mọi đích ≤ pool gốc" quên tỷ lệ 1000:1200; "bonus lớn nhất" xếp theo SỐ
ĐIỂM thay vì GIÁ TRỊ; "điểm thẻ thắng phải đơn điệu" so hai bảng khác nhau).

**Bản vá đẻ ra lỗi tiếp theo.** Phase 2 gặp 8 vòng liên tiếp; Phase 3 gặp lại
y hệt: 12 → 5 → 3 → 2 → 1 → 1, và mọi lỗi từ vòng 2 trở đi đều nằm trong bản vá
của vòng ngay trước. Chuỗi chỉ dừng khi sửa NGUYÊN NHÂN GỐC.

**Một bản vá "phòng thủ" có thể vô hiệu hoá đúng thứ nó bảo vệ.** Dấu hiệu: nó
nuốt một lỗi VÀ nó nằm trên đường đi của một phép kiểm.

**Hai phép kiểm cùng một khái niệm thì phải là MỘT hàm** — ba lần trả giá:
`isObject` (Phase 2), đơn vị offer (Phase 3 vòng 4), tính hợp lệ giá trị người
dùng (vòng rà đối kháng). Gọi LẠI cùng hàm đó ở một biên giới khác thì KHÔNG
vi phạm luật này.

⚠️ **Đừng dùng `git checkout -- <file>`** để hoàn tác một thử nghiệm khi file
còn thay đổi chưa commit — nó quay về bản đã commit, tức bản CÒN LỖI. Đã sập
ba lần. Dùng bản sao (`cp` sang `/tmp`).

⚠️ **Có thể có phiên khác chạy song song.** Kiểm `git status` trước khi stage,
và **stage theo đường dẫn cụ thể**, đừng `git add -A`. Đã xảy ra thật trong
Phase 3 (một phiên khác đang làm blog TOC).

---

## 6. Rủi ro và giới hạn đã biết

| Chỗ | Ảnh hưởng |
| --- | --- |
| `UserDataSource` chưa chạy với backend thứ hai | **Rủi ro lớn nhất.** Lần thử thật rơi vào chính Phase 4 |
| Award chart phủ 3/4 cặp vùng | Chỉ còn `CANADA_US → EUROPE`; audit cảnh báo, độ tin cậy bị đặt trần `medium` |
| Percentile lịch sử gần như luôn `null` | Nhật ký mới từ 29/08/2026; §12 hiện là tín hiệu chết |
| Hệ sinh thái = CHƯƠNG TRÌNH, không phải liên minh | Aeroplan® và United® đếm thành hai ⇒ tập trung đo THIẾU (hướng an toàn) |
| Chặng chuyển đòi hạng thành viên bị BỎ | Ước lượng thiếu; không hứa điểm người dùng không với tới |
| `editorial_rules` (§15) chưa làm | 5% trọng số bằng 0 cho MỌI ứng viên nên không đổi thứ hạng; chỗ áp đã có và đã bị chặn ±10% |
| Bảo hiểm còn trong `textValue` | Chỉ so được có/không |
| Điểm **hết hạn** không mô hình hoá | Mọi câu "đã đủ điểm" kèm `POINTS_EXPIRY_NOT_MODELLED` |
| Không có thẻ phụ / authorized user | V2 |
| "Tôi có nên mở thẻ X?" không phải `goal_type` | §5 chỉ có bốn loại — câu người đọc hay hỏi nhất. Cân nhắc V2 |

### Trọng số nào của SPEC, trọng số nào của ENGINE

Bốn bảng §10 chép nguyên văn, **có test khoá tới từng phần trăm**. Những chỗ
engine tự chọn — và đều nói ra ngay đầu file:

- `scoring/earning.ts` — cả bảng (spec nêu tên hàm, không cho trọng số)
- `rank.ts` — bảng của `NO_NEW_CARD`
- `offer-quality.ts` — năm vế của §11
- `confidence.ts` — cách trộn bốn thừa số của §29

### Lấp `CANADA_US → EUROPE` (nếu cần)

1. **Đừng tra lại từ đầu** — `src/lib/award-charts.ts` đã có ba bảng giá đã
   kiểm kèm ngày verify. Chúng là NGUỒN.
2. **Band khoảng cách TÍNH ĐƯỢC, đừng nhớ** — file đó có `lat`/`lon` từng sân
   bay và `greatCircleMiles`.
3. Một vùng của engine có thể bắc qua nhiều band/vùng của hãng — đó là lý do
   `pointsLow/Typical/High` tồn tại.
4. Châu Âu cần bộ chương trình KHÁC: Flying Blue® và Avios® quan trọng hơn
   hẳn, Asia Miles® gần như vô nghĩa. **Không phải chép lại việc đã làm cho
   JAPAN/EAST_ASIA.** Cả hai chương trình đó hiện nằm trong
   `UNQUOTABLE_AWARD_PROGRAMS`, nên lấp châu Âu là gỡ chúng ra khỏi đó trước.
5. Chương trình không quote được thì khai vào `UNQUOTABLE_AWARD_PROGRAMS`,
   đừng để trống im lặng.

---

## 7. Chạy gì

```bash
npx tsc --noEmit          # sạch (đã bao gồm scripts/)
npm run lint              # sạch
npm run build             # Compiled successfully
npm run test:reco         # 272/272 pass
npm run test:game         # 43/43 pass (không liên quan, kiểm không hồi quy)
npm run audit:reco-data   # 0 lỗi, 10 cảnh báo (đều là chỗ trống có chủ ý)
```

Đụng vào thẻ tín dụng thì chạy thêm `audit:trademarks`, `audit:rebate-prose`,
`audit:best-cards` — xem [CLAUDE.md](CLAUDE.md).

### Bản chụp hành vi §20

```bash
npm run test:reco                              # chỉ ĐỌC và SO
UPDATE_ENGINE_SNAPSHOT=1 npm run test:reco     # ghi lại, rồi COMMIT file
```

`engine.snapshot.json` **phải được commit** — CI đọc nó, không dựng lại nó. Nó
giữ RIÊNG `engineVersion` và `datasetFingerprint`:

- đổi **logic** → tăng `ENGINE_VERSION`
- đổi **dữ liệu** → dấu vân tay tự đổi, KHÔNG cần tăng version
- cả hai đứng yên mà kết quả đổi → **hồi quy**, cả hai đường đều đỏ

`test:reco` chạy bằng `node --test --experimental-strip-types`, nên **mọi
import tương đối trong module phải mang đuôi `.ts` tường minh**, và
`offer-history.ts` chỉ được import KIỂU từ `lib/offer-history.ts`.

---

## 8. Quy ước của repo

- **Tự commit và push lên `origin main`** sau khi build/lint xanh.
- **Trả lời user bằng tiếng Việt**, gọi user là "bạn", tự xưng là "mình".
- Comment trong code: giải thích **vì sao**, không phải **làm gì**.
- **Cross-check với Codex sau mỗi thay đổi:**
  ```bash
  cd "/Users/hoangle/Developer/Claude Code/ghe-1a" && codex exec review --commit HEAD -m gpt-5.6-sol -c model_reasoning_effort="high" < /dev/null 2>&1 | tail -40
  ```
  **Vòng đắt giá nhất** là vòng bắt Codex bác lại chính bản vá của nó. Đề bài
  đã dùng ở Phase 3, dùng lại nguyên văn:

  > Với MỖI bản vá trong commit HEAD, chọn đúng MỘT: **ĐÚNG** (giải quyết
  > nguyên nhân gốc) / **SAI** (vấn đề vốn không phải lỗi) / **BẢN VÁ HỎNG**
  > (vấn đề có thật nhưng bản vá sai, hoặc mở ra ca hỏng mới). Bắt buộc bác
  > lại chính mình nếu đề nghị cũ của bạn là sai. Kết bằng một câu: còn lỗi
  > nào CHẶN Phase sau không? Nếu định kết luận "sạch", hãy tự bác lại kết
  > luận đó trước khi viết ra.

  Vòng đó bác 2 bản vá của chính nó, giữ 1, và bắt được 2 bài test diễn.
