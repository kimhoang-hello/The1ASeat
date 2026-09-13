# Bàn giao: Recommendation Engine — bắt đầu Phase 5

Trạng thái **13/09/2026**. Phase 1–4 đã xong. Đọc file này là đủ để làm tiếp
Phase 5, không cần lịch sử chat.

Spec đầy đủ: [`docs/recommendation-engine-v1.md`](docs/recommendation-engine-v1.md).
Mọi tham chiếu "§n" trỏ vào nó.
Tài liệu module: [`src/lib/recommendation/README.md`](src/lib/recommendation/README.md)
— **đọc trước khi sửa bất cứ gì trong module**, nhất là mục Phase 4.

---

## 1. Trạng thái

| Phase | Nội dung | Trạng thái |
| --- | --- | --- |
| 1 | Lớp dữ liệu nền | ✅ |
| 2 | Hồ sơ người dùng, thẻ, số dư, goals | ✅ |
| 3 | Engine (Portfolio Analyzer → Ranking) | ✅ |
| 4 | `recommendation_runs` + Debugger + Test A–J | ✅ |
| 5 | **Frontend UX** | ⬅️ **BẮT ĐẦU Ở ĐÂY** — chặn bởi quyết định database (§3) |
| 6 | LLM giải thích | ⛔ |

Phase 4: nhánh `wt/reco-phase4`, 26 commit, 21 vòng Codex, **382 test**,
`ENGINE_VERSION` **4.23.0**. Chuỗi "bản vá đẻ ra lỗi" lặp lại lần thứ ba
(sau Phase 2 và 3), ba lần trong phase này: `tripCoverage` (vòng 3→7, dừng
khi viết lại thành một phép đánh giá), phạm vi chỗ trống khi nhiều mục tiêu
hoà nhau (vòng 8→11, dừng khi "mục tiêu có đọc X không" thành một hàm), và
độ tươi §29 (vòng 12→14, dừng khi `read-set.ts` gắn mỗi luật với một phép
tính). Từ vòng 14, Codex tách phát hiện thành nhóm A (sai khuyến nghị — chặn)
và nhóm B (độ chính xác §29 — ghi ở §7). Sau vòng rà theo spec (4.16–4.23)
user dừng cross-check Codex; vòng 21 là vòng cuối, mọi phát hiện của nó đã vá
và kiểm ngược — **các bản vá của vòng 21 chưa được Codex kiểm lại**.

### Tiêu chí Phase 4 — "admin tìm ra NHANH vì sao engine đưa ra khuyến nghị này"

Mọi tầng người dùng liệt kê đều truy được, và mỗi nguồn lỗi có một công cụ
trả lời nó:

| Nguồn lỗi | Công cụ trả lời |
| --- | --- |
| Dữ liệu nguồn | `why <thẻ>` → bản ghi nguồn engine đã đọc (offer, phí, tỷ lệ, trần, định giá, luật) kèm ngày kiểm + URL; `diff` → dòng nào, trường nào đổi |
| Đầu vào người dùng | mục 11: chỗ trống nào lấp thử vào LẬT được người thắng; `what-if` |
| Phân tích danh mục | mục 2 + tầng `portfolio_analysis` trong phép so |
| Sinh chiến lược | mục 4 |
| Tính nhu cầu | mục 3 |
| Điều kiện / phù hợp | mục 5 (thẻ bị loại + luật đã chặn), mục 6, `why` → bảng luật từng dòng |
| Chấm điểm | mục 8, `compare A B` — khoảng cách tách theo thành phần, cộng lại đúng |
| Luật §16 / biên tập §17 | mục 9; mỗi điều chỉnh mang `layer` |
| Xếp hạng | mục 7 — bảng ĐẦY ĐỦ, kể cả thẻ bị ẩn vì cùng họ / dưới vạch cắt |

Tái lập + version: `executeRun` lưu bản ghi §20 đúng các cột spec;
`replayRun` chạy lại ra đúng từng chữ số, và phân biệt HỒI QUY (khác mà
version đứng yên) với lần đổi version có chủ ý. `explainChange` đổi từng yếu
tố một (người dùng / dữ liệu / lịch sử offer) để chỉ ra yếu tố nào một mình
đủ đổi kết quả, và tách riêng tác động của engine khi version đã đổi.

### Lỗi engine của Phase 4

| Version | Lỗi |
| --- | --- |
| 4.0.1 | tổng chi tiêu cộng theo thứ tự khoá object ⇒ lượt chạy qua JSON lệch ở chữ số 16 |
| 4.1.0 | Test C: thiếu 5,000/205,000 điểm ⇒ mọi thẻ nhận trọn 20% "thu hẹp khoảng cách", gãy bậc ở mép đủ điểm; engine xếp `USE_EXISTING_POINTS` đầu chiến lược mà khuyên mở thẻ. `japanTripFunded` nay ra `NO_NEW_CARD` |
| 4.2.0–4.2.1 | §30 hỏi câu không đổi được gì ở 4/8 ca (khứ hồi cho chặng chưa có giá). Nay đo bằng câu trả lời thử, bỏ câu trả lời làm hồ sơ mâu thuẫn |
| 4.3.0 | (Codex vòng 3) số dư CHƯA BIẾT vẫn đi vào chiến lược/nhu cầu/điểm như số 0 — cờ "cận dưới" chỉ dùng khi trình bày. Bản vá đầu (`coverage: null`) HỎNG vì mượn nghĩa "chặng chưa có giá" (Codex vòng 4). Nay: điểm giữa của [cận dưới, 1], `coverageKnown` nói ra đó là ước lượng |
| 4.4.0 | `points_gap_reduction` đo trên `bestProgram`; người chưa có điểm nào thì đó là chương trình đầu theo id (`aadvantage`) ⇒ mọi thẻ Aeroplan® được 0. Nay là hiệu của CHÍNH `tripCoverage` chạy hai lần |
| 4.5.0–4.7.0 | (Codex vòng 5–7) giá chỉ biết SÀN, sàn động cạnh bảng cố định, chương trình được chọn — xong khi `tripCoverage` viết lại: mỗi chương trình một khoảng phủ [lo, hi], điểm giữa, một phép chọn |
| 4.8.0–4.11.0 | (Codex vòng 8–11) hai mục tiêu hoà nhau: độ tin cậy mỗi mục tiêu đọc chỗ trống CỦA NÓ, §30 đo và lọc theo mọi mục tiêu, chỗ trống của mục tiêu không chạy bị bỏ, tỷ lệ tích điểm chỉ tính khi mục tiêu đọc nó (`goalReadsEarn`) — cho cả ứng viên LẪN thẻ đang giữ |
| 4.12.0–4.13.0 | (Codex vòng 12–13) §29 đo độ tươi và độ đầy đủ trên hai tập dòng KHÁC nhau, lệch theo cả hai hướng (trần của thẻ đang giữ không được đo; định giá của chương trình không ai giữ vẫn trừ điểm). Nay `read-set.ts` là chỗ duy nhất trả lời "lượt chạy đã đọc dòng nào", mỗi luật gắn một phép tính |
| 4.14.0 | (Codex vòng 14, **lỗi từ Phase 3**) `SCORES_NEARLY_TIED` suy từ `confidence.level === "low"` — dữ liệu cũ kéo độ tin cậy xuống là in "hai ứng viên đầu sát nhau" cho khoảng cách 0.062, đẩy admin đi tìm ở tầng chấm điểm. Nay `scoresNearlyTied` là một định nghĩa cho cả trần độ tin cậy lẫn mã |
| 4.15.0 | (Codex vòng 15) welcome bonus rơi vào chương trình chỉ biết giá SÀN được cộng điểm từ điểm giữa của [0, bonus/sàn] mà thẻ không mang mã nào — người đọc chỉ thấy "phủ từ 0% lên 50%". Nay `tripGain` là một hàm cho cả điểm lẫn mã. Cùng vòng, hai lỗi DEBUGGER: provenance bỏ sót chặng chuyển của chương trình đặt mẫu số tầm với (`flexibilityScale`), và phép so báo "chuẩn hoá" khi thẻ trượt luật cứng (chỗ trống đã lọc chuyển sang tầng độ tin cậy) |
| 4.16.0–4.17.0 | **Vòng rà Phase 4 theo spec** — bản ghi nói ra các quyết định trước đó chạy ngầm: `followUp.basis` (câu §30 chọn vì câu nền / đo được / khẩn / bảng tĩnh), `unknownCause` của từng luật điều kiện (dữ liệu nguồn / đầu vào / engine), ghi chú bảng điểm mang con số đầu vào (năm vế §11, chương trình của `currency_fit`, mẫu số tầm với). Không đổi một chữ số điểm |
| 4.18.0–4.19.0 | (Codex vòng 16–17) §30 lọc câu thu nhập theo phần HIỆN RA của bảng, bỏ mất thẻ bị ẩn vì cùng họ; §11 chấm hiệu quả chi tiêu TỐI ĐA cho điều khoản offer chưa biết (**lỗi từ Phase 3**, đủ đổi người thắng); luật cư trú `not_in` hợp lệ theo validator mà engine không hiểu (hai bảng cho một khái niệm → `rule-shapes.ts`); cảnh báo "chỉ biết giá sàn" gắn nhầm thẻ |
| 4.20.0–4.23.0 | (Codex vòng 18–21, **lỗi từ Phase 3**) cửa welcome bonus: `unknown` bị đọc như `pass` (người chưa khai thẻ được hứa trọn bonus Amex® once-in-a-lifetime); bonus BỊ CHẶN vẫn được chấm §11 đầy đủ rồi trừ −0.15 cố định — cỡ của một bonus không nhận được xếp hạng thẻ (Amex® Gold hạng 20 → 1). Nay mất bonus đo ở MỌI chỗ đọc bonus: `offer_quality` (0 / một nửa), phần tăng chuyến đi (0 / một nửa), mốc chi (không có mốc / điểm giữa), mã offer, thị trường offer. Hệ quả nhân vật mẫu: `u_advanced` → amex-gold-rewards (mục tiêu đa dạng hoá, offer chỉ 10%), `u_sparse` → amex-green sát nút (+0.0024, §30 hỏi sức dồn) |

Tất cả đều xanh qua mọi test Phase 3. 4.3.0–4.7.0 là **cùng lớp lỗi Phase 3 đã
vá một nửa**: "chưa biết" / "chọn bừa" được giữ đúng ở ĐẦU RA mà vẫn thủng ở
QUYẾT ĐỊNH.

---

## 2. Dùng debugger

```bash
npm run reco:debug -- run u_japan_gap --top 8
```

```bash
npm run reco:debug -- why u_japan_gap amex-business-gold
```

```bash
npm run reco:debug -- what-if u_beginner --set 'profile.annualHouseholdIncome={"low":40000,"high":50000}'
```

Còn `compare`, `replay`, `diff`, `list`, `fixtures`, `--save` — xem đầu
`scripts/reco-debug.mts`. Lượt `--save` nằm ở `.reco-runs/` (gitignore).

Trang `/admin/reco-debugger` làm cùng những việc đó bằng form, trên đúng dữ
liệu Contentful + lịch sử offer của production. **Chỉ bật dưới `next dev`
hoặc với `RECO_DEBUGGER=1`** — site chưa có đăng nhập, và server action nhận
POST trực tiếp. Bản build production trả 404 (đã kiểm).

---

## 3. Quyết định DATABASE — nay CHẶN Phase 5

Phase 4 cố ý không chọn: nó chỉ ghi lượt chạy của admin, và kho file đủ cho
việc đó. Phase 5 có người dùng thật — hồ sơ, thẻ, số dư, và bản ghi §20 của
họ — nên không đi tiếp được mà không có chỗ lưu.

Hai interface đã sẵn và đã chạy với HAI backend mỗi cái:

- `UserDataSource` (`user-source.ts`) — hiện chỉ có ĐỌC; Phase 5 thêm ghi.
- `RunStore` (`run-store.ts`) — chỉ thêm; bộ nhớ + file. Bản database là
  thêm một file: `saveDataset` (khoá = dấu vân tay, nổ khi va chạm),
  `saveRun` (từ chối id trùng), `getRun`, `listRuns`.

| Lựa chọn | Được | Mất |
| --- | --- | --- |
| Postgres có quản lý (Supabase/Neon) | spec viết sẵn bằng Postgres (`jsonb`); JSONB nén tự động (một lượt chạy ~170 KB, dữ liệu ~300 KB mỗi dấu vân tay) | thêm một nhà cung cấp, một bộ secret |
| MySQL của Hostinger | cùng nhà cung cấp site đang dùng | kiểu `JSON` kém `jsonb`; phải kiểm gói hosting có kèm không |
| SQLite trên đĩa Hostinger | không thêm gì | đĩa không hứa sống qua một lần deploy — loại |

Mình nghiêng về Postgres có quản lý, nhưng đây là quyết định chi phí/hạ tầng
của user.

---

## 4. Phase 5 phải xây gì (§35)

adaptive questionnaire · result page · alternatives · warnings · confidence ·
affiliate CTA. Tiêu chí: không bắt điền đủ, thiếu thì hỏi một câu tiếp
theo, hiện được `NO_NEW_CARD`, CTA affiliate chỉ khi có, và affiliate không
bao giờ đổi khuyến nghị.

Những thứ đã có sẵn cho nó:

- **Câu hỏi tiếp theo**: `run.followUp` — đã đo bằng thực nghiệm (§30).
  Questionnaire thích ứng = hỏi `followUp`, ghi câu trả lời, chạy lại.
- **Mỗi lượt chạy của người dùng thật nên đi qua `executeRun`** và lưu bằng
  `RunStore` — đó là thứ làm "khuyến nghị này sai" trả lời được sau này.
- **Affiliate CTA**: đọc `Product.affiliateAvailable` ở TRANG, không bao giờ
  ở engine. Test F và test quét mã nguồn 26 file canh chuyện đó.
- Engine phát MÃ (`reasonCodes`, `warnings`), không phát câu tiếng Việt —
  Phase 5 dịch mã thành chữ; `REASON_CODE_NOTES` là điểm khởi đầu.

---

## 5. Sáu luật không được phá

1. **Affiliate không bao giờ ảnh hưởng thứ hạng** (§16 Rule 7).
2. **Điểm tín dụng không phải điều kiện cứng** (§3.10).
3. **Không đếm trùng điểm chuyển được** (§7).
4. **`NO_NEW_CARD` là ứng viên trong mọi lượt chạy** (§16 Rule 8).
5. **Mô hình người dùng không mã hoá thẻ nào nên được khuyên.**
6. **`strategies.ts` và `needs.ts` không nhắc tên sản phẩm nào**; 26 file
   engine (21 cũ + `trace.ts`, `read-set.ts`, `sensitivity.ts`,
   `rule-shapes.ts`, `scoring/shared.ts`) không nhắc slug/id sản phẩm hay
   chương trình.

Cộng một luật Phase 4:

7. **Mọi thứ trong `RecommendationRun` phải đi qua JSON nguyên vẹn** — không
   `Map`, không `Set`, không `undefined` mang nghĩa. `canonicalJson` ném khi
   gặp `Map`/`Set`; `runs.test.ts` đòi lượt chạy qua JSON bằng lượt chạy trên
   object gốc.

---

## 6. Cạm bẫy — mới từ Phase 4

**Chạy debugger lên nhân vật mẫu NGAY khi dựng xong.** Mọi lỗi engine của
Phase 4 đều xanh qua 272 test cũ; ba cái đầu lộ ra khi đọc bảng in ra.

**Bản vá đừng MƯỢN nghĩa đã có của một giá trị.** `coverage: null` vốn nghĩa
"chặng chưa có giá"; dùng nó cho "số dư chưa biết" làm mọi tầng đọc `null`
theo nghĩa cũ và gãy theo cách mới (Codex vòng 4). Nghĩa mới → trường mới.

**Hai phép đo cho cùng một câu hỏi thì dùng CHÍNH một hàm chạy hai lần.**
`points_gap_reduction` từng có phép đo riêng cạnh `tripCoverage` và hỏng ba
kiểu; nay nó là hiệu `tripCoverage(có bonus) − tripCoverage(không bonus)`.

**Nhiều mục tiêu hoà nhau là một ca Phase 3 chưa ai thử.** 15 nhân vật mẫu
đều một mục tiêu, và bản chụp §20 chỉ ghi `results[0]` — nên bốn lỗi phạm
vi chỗ trống sống qua mọi test. Test hai mục tiêu nay ở `acceptance.test.ts`;
bản chụp vẫn chưa khoá chúng (xem §7).

**"Chưa biết" có HÌNH DẠNG.** Số dư chưa biết: phủ trong [cận dưới, 1]. Giá
chỉ biết sàn: phủ trong [0, điểm/sàn]. Hai thứ cùng tên "chưa biết" mà hai
khoảng khác nhau — một quy ước chung cho cả hai là vòng Codex 5.

**"Chưa biết" phải giữ ở QUYẾT ĐỊNH, không chỉ ở ĐẦU RA.** Phase 3 đã sửa để
số liệu in ra không nói "thiếu 140,000" dựa trên cận dưới — nhưng chiến lược,
nhu cầu và điểm vẫn đọc chính cận dưới đó (Codex vòng 3, P1). Mọi cờ kiểu
`...IsLowerBound` phải được hỏi: tầng nào QUYẾT ĐỊNH bằng con số này?

**"Đã đọc" nghĩa là CÓ THỂ ĐỔI MỘT ĐẦU RA, không phải "được truy cập".**
Engine tính dữ kiện cho cả thẻ nó sắp loại; dòng bị truy cập rồi vứt đi không
làm khuyến nghị kém tươi. Ngược lại, `flexibilityReach` đọc MỌI chặng chuyển
kể cả của chương trình không ai giữ. Mỗi lần có người hỏi "dòng X có tính
không", câu trả lời là tìm phép tính dùng X — không phải bảng X nằm gần ai.
`read-set.ts` là bản sao VIẾT TAY của các phép tính đó: đổi phép tính mà quên
sửa luật thì hai bên lệch — mỗi luật có một test đỏ canh, nhưng test chỉ canh
luật đã có.

**Mã lý do phải suy từ CHÍNH điều kiện nó gọi tên.** `SCORES_NEARLY_TIED`
sống từ Phase 3 dưới dạng `level === "low"` — đúng khi khoảng cách điểm là
nguyên nhân duy nhất của `low`, sai từ ngày dữ liệu cũ cũng kéo được xuống
`low`. Với debugger, một mã sai tệ hơn không có mã: nó chỉ admin sang nhầm tầng.

**Test và luật có thể SAI KHỚP NHAU.** Luật vòng 13 "phí của mọi thẻ vì trung
vị" có test xanh — dựng trên hồ sơ đã khai ngưỡng phí, tức hồ sơ mà trung vị
không bao giờ được dùng. Kiểm ngược (gỡ luật → đỏ) không bắt được: gỡ luật thì
test đỏ thật, chỉ là cả hai cùng nói điều sai. Hỏi thêm: cơ chế mình viện dẫn
có CHẠY trên fixture này không?

**Một giá trị thuộc về tầng TÍNH ra nó, không phải tầng nó trông giống.**
Chỗ trống dữ liệu trông như việc của chuẩn hoá, nhưng bản lượt chạy lưu là bản
ĐÃ lọc theo thẻ chọn được — tức sau tầng điều kiện. Để nó ở tầng chuẩn hoá thì
thu nhập về 0 (một thẻ trượt luật cứng) bị báo là lỗi chuẩn hoá (Codex vòng 15).

**Phép so lượt chạy là phép chiếu VIẾT TAY — kiểm nó bằng vét cạn.** Vòng
rà đổi TỪNG loại lá của một bản ghi và đòi một tầng tính báo: lộ ra cả
`tripCoverage`, đầu vào độ tin cậy, mã của mọi ứng viên, `rank`/`hiddenBy`
chưa nằm ở tầng nào. Hai bẫy khi viết bài vét: (1) vét trên bản ghi TRONG BỘ
NHỚ thì đầu ra và bảng xếp hạng dùng CHUNG object — đổi một chỗ đổi cả hai, bài
xanh giả; phải vét trên bản đã qua JSON như trong kho. (2) Miễn trừ theo TÊN
trường (`.kind`) che cả trường thật cùng tên — miễn trừ theo đường dẫn chính xác.

**Bản chụp phải chụp TOÀN BỘ lượt chạy.** Bản chụp §20 cũ chỉ ghi vài trường
của mục tiêu đầu: 4.12–4.14 đổi độ tin cậy mà bản chụp đứng yên, tức quên tăng
version thì không test nào đỏ. Nay mỗi lượt chạy mang dấu vân tay toàn phần.

**Toàn vẹn bản ghi tách "kho hỏng" khỏi "engine hồi quy".** Hồ sơ, lịch sử
offer và kết quả đều mang dấu vân tay lúc lưu; `executeRun` từ chối bộ dữ liệu
hay lịch sử chưa cắt theo `asOf`/`knownAt` mà bản ghi khai.

**Một khái niệm có NHIỀU chỗ đọc thì vá ở mọi chỗ, hoặc đo ở gốc.** "Bonus bị
chặn" có sáu chỗ đọc (điểm offer, phần tăng chuyến đi, mốc chi, mã offer, thị
trường offer, §30 qua chạy lại). Mức phạt cố định −0.15 của Phase 3 vá một chỗ
và để năm chỗ kia đọc bonus như còn nguyên — ba vòng Codex (19–21) mỗi vòng bới
ra một chỗ. Bài học Phase 1 ("bản vá chỉ lan một nửa") lặp lại nguyên dạng.

**Thứ tự "tầng" phải là thứ tự TÍNH.** Spec vẽ Strategies → Needs →
Eligibility; engine tính dữ kiện thẻ và điều kiện TRƯỚC chiến lược. Xếp theo
spec thì "tầng khác đầu tiên" chỉ sai chỗ (Codex bắt).

**Một phép đo trên hồ sơ giả định phải chịu cùng luật với hồ sơ thật.** Câu
trả lời thử của §30 từng tạo ra hồ sơ mà validator từ chối, rồi đem nó ra làm
bằng chứng (Codex bắt).

**Test viết SAI bất biến hai lần trong phase này**, đúng như bàn giao Phase 3
cảnh báo: thẻ giữ chỗ của họ có thể nằm dưới vạch cắt; ba đợt lịch sử thì
"thấp nhất" là percentile 33, chưa tới ngưỡng yếu 30. Hỏi trước: bất biến
mình vừa viết có đúng không.

**Kiểm ngược đã làm thật**: gỡ vá gap reduction → Test C đỏ; gỡ tầng đo §30 →
Test J đỏ; gỡ lọc hồ sơ mâu thuẫn → test §30 đỏ; gỡ lý do eligibility / phép
gom họ khỏi trace → hai test §22 đỏ.

Cạm bẫy cũ vẫn còn nguyên: **đừng `git checkout -- <file>`** khi file còn
thay đổi chưa commit; **phiên song song** — dùng `./scripts/worktree.sh`,
stage theo đường dẫn cụ thể.

---

## 7. Rủi ro và giới hạn đã biết

| Chỗ | Ảnh hưởng |
| --- | --- |
| Chưa có database | **Chặn Phase 5** — xem §3 |
| Award chart phủ 3/4 cặp vùng | `CANADA_US → EUROPE` còn trống; `flexiblePointsSufficient` bay châu Âu nên Test H phải dựng lại trên chặng Nhật |
| Percentile lịch sử gần như luôn `null` | Nhật ký từ 29/08/2026; §12 hiện là tín hiệu chết — Test I dùng lịch sử tổng hợp |
| §30 đo bằng câu trả lời ĐIỂN HÌNH | Nói được "câu này CÓ THỂ đổi kết quả", không chứng minh "KHÔNG thể". `cards/balances_undeclared` không đo được, giữ chỗ theo bảng tĩnh |
| §30 chạy engine thêm ~30 lần mỗi lượt | ~30 ms; `test:reco` từ ~1 s lên ~6 s |
| `explainChange` đổi từng yếu tố MỘT | Nhiều yếu tố tương tác thì là bằng chứng, không phải phép chia trách nhiệm |
| Replay dùng engine HÔM NAY | Tách được tác động của lần đổi version, không dựng lại được engine cũ |
| Bản chụp §20 chỉ ghi mục tiêu đầu | Hành vi nhiều mục tiêu được test (`acceptance.test.ts`), chưa được khoá bằng bản chụp |
| Chặng chuyển chỉ dành cho hạng Elite | Engine bỏ ở mọi phép tính; `gaps.ts` vẫn coi chúng là "đã dựng" — hôm nay không chương trình nào chỉ có chặng Elite, nên chưa sai gì |
| `editorial_rules` (§15) chưa làm | `RULE_VERSION = "0"`; chỗ áp đã có, đã chặn ±10%, đã có `layer: "editorial"` |
| Điểm hết hạn không mô hình hoá | Mọi câu "đã đủ điểm" kèm `POINTS_EXPIRY_NOT_MODELLED` |
| §30 hỏi câu NỀN (thẻ, số dư, nước ở, mục tiêu) trước câu ĐO ĐƯỢC là đổi người thắng | Quyết định thiết kế, giữ nguyên: câu nền không đo được bằng câu trả lời thử mà có thể đổi cả tập ứng viên. `followUp.basis = "gatekeeper"` nói ra điều đó. Codex vòng 17 phản đối — Phase 5 có thể xem lại khi có dữ liệu người dùng thật |
| Bonus CHƯA CHẮC = điểm giữa hai thế giới ở từng thành phần | Xấp xỉ có chủ ý: trung vị percentile của thị trường cân offer chưa chắc bằng 0.5 (không phải kỳ vọng thật qua mọi tổ hợp thế giới); mã `MIN_SPEND_*` vẫn giữ vì đúng trong thế giới nhận được bonus |
| Thẻ không có bonus (hoặc bonus bị chặn) nhận `spend_fit` = 1 | Quy ước Phase 3 ("không có mốc = phù hợp tối đa"). Khi chưa biết sức dồn, thẻ có bonus nhận 0.5 — nên thẻ không bonus hơn 0.105 ở vế này, bù lại mất `offer_quality`. Ca `u_sparse` sát nút vì đúng điểm này |
| Lưới `unmapped` của phép so chỉ bắt ca IM LẶNG hoàn toàn | Trường chưa ánh xạ đổi cùng lúc với trường đã ánh xạ thì lưới không thấy; thứ đóng lỗ là bài vét cạn (đỏ khi thêm trường mà quên `stageValue`) |
| `read-set.ts` đo §29 THỪA ở vài chỗ (nhóm B vòng Codex 14) | Lấy MỌI tỷ lệ/trần của một thẻ thay vì những dòng khớp chi tiêu (tỷ lệ bị `restrictedTo` loại, trần của hạng mục người dùng không chi); luật điều kiện `soft`/`unknown` không tham gia cửa cứng; `eligibility_unknown` của thẻ đã trượt luật cứng. Mỗi ca chỉ trừ độ tin cậy, không đổi người thắng, điểm hay câu hỏi — nhưng có thể đẩy `medium` xuống `low` |

---

## 8. Chạy gì

```bash
npx tsc --noEmit
```

```bash
npm run lint
```

```bash
npm run build
```

```bash
npm run test:reco
```

`test:reco` 382/382. Bản chụp hành vi §20:

```bash
UPDATE_ENGINE_SNAPSHOT=1 npm run test:reco
```

Đổi **logic** → tăng `ENGINE_VERSION`; đổi **dữ liệu** → dấu vân tay tự đổi;
cả hai đứng yên mà kết quả đổi → hồi quy. Dấu vân tay nay dùng
`fingerprint.ts` (cả bộ dữ liệu, khoá sắp, 64 bit) — cùng hàm kho lưu dùng.

Đụng vào thẻ tín dụng thì chạy thêm `audit:trademarks`, `audit:rebate-prose`,
`audit:reco-data`, `audit:best-cards` — xem [CLAUDE.md](CLAUDE.md).

---

## 9. Quy ước của repo

- **Tự commit và push lên `origin main`** sau khi build/lint xanh — chỉ trên
  `main`; nhánh `wt/*` merge vào `main` là việc phải hỏi.
- **Trả lời user bằng tiếng Việt**, gọi user là "bạn", tự xưng là "mình".
- Comment trong code: giải thích **vì sao**, không phải **làm gì**.
- **Cross-check với Codex sau mỗi thay đổi.** `codex exec review --commit
  HEAD` cho từng commit; vòng bác-lại-bản-vá thì dùng `codex exec` (vì
  `review --base` không nhận prompt) với đề bài của bàn giao Phase 3.
