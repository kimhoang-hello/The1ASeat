# Recommendation engine — Phase 1: lớp dữ liệu

Nguồn sự thật có cấu trúc cho **sản phẩm, offer, chương trình điểm, chặng
chuyển điểm, quyền lợi, tỷ lệ tích điểm, điều kiện mở thẻ và award strategy**.

Chỉ là DỮ LIỆU. Chưa có engine nào ở đây — Phase 3 mới có. Việc của Phase 1 là
làm sao đến lúc đó engine chỉ phải đọc, không phải đoán.

## Vì sao không phải Supabase

Spec đề xuất Supabase + Postgres. Repo này chưa từng có database nào: dữ liệu
miền có cấu trúc vẫn nằm trong module TS chú thích kỹ (`award-charts.ts`,
`transfer-partners.ts`, `points-programs.ts`), nội dung biên tập nằm ở
Contentful, và site deploy thẳng từ `main` lên Hostinger.

Dữ liệu Phase 1 là dữ liệu THAM CHIẾU do biên tập viên duy trì tay — spec §23
nói thẳng là V1 không scrape. Thứ nó cần là lịch sử đọc được và một vòng review
trước khi lên site. Đó đúng là thứ git cho sẵn.

Phase 2 (hồ sơ người dùng, thẻ đang giữ, số dư điểm) thì bắt buộc phải có
database thật. Vì vậy mọi thứ đi qua `RecommendationDataSource` trong
[`source.ts`](source.ts): đổi implementation ở đó, engine không đụng một dòng.

## Nối với Contentful

`Product.slug` **bằng đúng** slug entry `creditCardOffer`. Ranh giới:

| Contentful giữ | Kho này giữ |
| --- | --- |
| Tên, ảnh thẻ, apply URL | Phí thường niên dạng số, nhà phát hành, network |
| Copy tiếng Việt (headline, editor's take, key benefits) | Tỷ lệ tích điểm, trần, hạng mục |
| Badge welcome bonus, badge rebate | Thành phần offer, mốc chi, cửa sổ thời gian |
| Cờ elevated offer | Quyền lợi có cấu trúc, điều kiện mở thẻ |

Không chép chéo. Chỗ nào buộc phải trùng (phí, rebate) thì
`npm run audit:reco-data` so hai bên mỗi lần chạy.

## Thêm một thẻ mới

**Chỉ sửa dữ liệu, không viết code.** Đã chứng minh: ba thẻ CIBC® Aeroplan®
được thêm nguyên vẹn bằng cách này, không đụng một dòng logic nào.

1. `data/products.ts` — một dòng. `slug` phải khớp Contentful, `annualFee` là
   con số mở đầu `annualFeeVi`.
2. `data/offers.ts` — một `OfferSeed`. Tách welcome bonus thành `components`
   đúng như điều khoản viết: mốc nào, chi bao nhiêu, trong bao nhiêu ngày. Mốc
   mở ở tháng thứ 13 thì khai `startsAfterDays: 365`.
   `minimumSpend`, `spendPerNinetyDays` và `minimumSpendMonths` tự tính ra —
   đừng viết tay.
3. `data/earning-rates.ts` — các tỷ lệ nội dung site NÓI RA. Site không nêu tỷ
   lệ nền thì để trống; audit sẽ cảnh báo, và cảnh báo không chặn.
4. `data/product-benefits.ts` và `data/eligibility-rules.ts` — tương tự.
5. `npm run audit:reco-data`.

Nhà phát hành mới → thêm vào `data/issuers.ts`. Chương trình điểm mới → thêm
vào `data/points-programs.ts` **và** thêm rule vào
[`../card-points-programs.ts`](../card-points-programs.ts), nếu không thẻ mất
chip lọc trên `/credit-cards` một cách im lặng. Quyền lợi mới → thêm vào
`data/benefits.ts`, nhớ trả lời `duplicatesAcrossCards`.

Chỗ DUY NHẤT phải sửa kiểu chứ không phải dữ liệu là **hạng mục chi tiêu mới**
(`SPEND_CATEGORIES` trong `types.ts`) — cố ý, vì hạng mục là từ vựng chung với
hồ sơ chi tiêu người dùng ở Phase 2, và một hạng mục chỉ có ở một bên là một
hạng mục vô dụng.

## Trống ≠ bằng không

Bộ dữ liệu nói ra chỗ nó không biết thay vì lấp bằng phỏng đoán:

- Thẻ không có dòng điều kiện thu nhập = **chưa biết**. Thẻ site nói rõ là
  không yêu cầu thì có dòng với giá trị `0` — "đã kiểm và bằng không" là một dữ
  kiện khác hẳn "chưa kiểm".
- Offer không có `components` = mức dùng được **chưa biết**, không phải bằng
  con số quảng cáo. Lý do khai trong `INCOMPLETE_OFFERS`.
- Vùng không có award strategy = **chưa có bảng giá**. Chương trình đã tra và
  kết luận không quote được thì khai trong `UNQUOTABLE_AWARD_PROGRAMS`, kèm lý
  do — để Phase 3 phân biệt "chưa ai làm" với "đã làm và không nói được".

Phase 3 phải hạ độ tin cậy khi chạm vào chỗ trống, không được coi chúng là 0.

## Ba luật không được phá

1. **Affiliate không bao giờ ảnh hưởng thứ hạng** (spec §16 Rule 7).
   `affiliateAvailable` không viết tay được — nó vắng khỏi `ProductSeed` và
   được `source.ts` tính bằng chính `isReferralUrl` quyết định
   `rel="sponsored"` trên trang thẻ.
2. **Điểm tín dụng không phải điều kiện cứng** (spec §3.10). Kiểu
   `EligibilityRuleType` không có nhánh nào cho nó, nên không thêm vào được.
3. **Không đếm trùng điểm chuyển được** (spec §7). Chỉ chương trình
   `transferable` mới sinh ra "số dư tiếp cận được", và một điểm chỉ tiêu được
   một lần dù nó với tới năm chương trình. Validator chặn chặng chuyển đi từ
   một chương trình `transferable: false`.

## Chạy gì

```
npm run audit:reco-data   # toàn vẹn nội bộ + đối chiếu Contentful + drift nguồn
npm run test:reco         # phép tính chi tiêu của welcome offer
```

`audit:reco-data` bắt ba lớp lỗi:

- **Toàn vẹn nội bộ** — tham chiếu gãy, id trùng, offer chồng thời gian, trần
  khai thiếu, hạng mục có hai tỷ lệ nền. Ở database thì đây là khoá ngoại.
- **Lệch với Contentful** — slug hai chiều, annual fee, rebate. Thêm thẻ trên
  Contentful mà quên thêm ở đây thì engine không bao giờ khuyên nó, và không
  lỗi nào nổ ra. Đây là lớp bắt được nó.
- **Drift với nguồn cùng repo** — bộ seed chép số từ `points-programs.ts`,
  `transfer-partners.ts` và `award-charts.ts`. Bản chép không ai canh thì đứng
  yên trong khi bản gốc đi tiếp, và hậu quả không phải engine đỏ mà là engine
  XANH trong khi nói một con số trang bên cạnh đã sửa.

Cảnh báo (`⚠︎`) không chặn. Lỗi (`✗`) chặn.
