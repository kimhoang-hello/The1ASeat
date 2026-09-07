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

## Khoá chính là `id`, không phải `slug`

`Product.id` (`prd_<slug lúc seed>`) là **khoá thay thế bất biến**. `slug` là
khoá tự nhiên nối sang Contentful và **đổi được** — nhà phát hành đổi tên thẻ
thì `slug` và `name` đổi, `id` giữ nguyên, nên không một khoá ngoại nào gãy và
mọi khuyến nghị cũ vẫn tra ra đúng sản phẩm. Đừng bao giờ suy `id` từ `slug`
trong code; việc chúng trông giống nhau là tiện cho người đọc, không phải một
bất biến.

Bản ghi có hiệu lực theo thời gian mang `effectiveFrom` **trong id** — bản thứ
hai của cùng một sự thật nằm cạnh bản thứ nhất, nên không có ngày trong id là
hai bản trùng id. Và không bao giờ đánh số theo vị trí trong mảng: chèn một
dòng vào giữa sẽ đổi id của mọi dòng phía sau, im lặng. Dùng `makeId`.

## Ngừng phát hành ≠ hết tồn tại

`Product.availableFrom/availableTo` là cửa sổ thẻ còn **nhận đơn mới**. Nó
TÁCH khỏi `effectiveFrom/effectiveTo` của bản ghi, và phân biệt này quan trọng:

- Thẻ ngừng phát hành → `availableTo` đóng lại. **Offer phải đóng theo** (không
  ai mở được nữa), nhưng **tỷ lệ tích điểm, quyền lợi và phí thì KHÔNG** —
  người đang giữ thẻ vẫn kiếm điểm, vẫn hưởng quyền lợi, vẫn trả phí hằng năm.
- Sản phẩm KHÔNG bị loại khỏi `datasetAt` khi hết khả dụng. Danh tính là vĩnh
  viễn. Gộp hai thứ này lại sẽ làm Portfolio Analyzer ở Phase 3 quên mất một
  thẻ đang nằm trong ví người dùng — không cộng điểm nó kiếm, và đếm quyền lợi
  của thẻ mới như thể chưa ai có.
- Thẻ bị thay bằng thẻ kế nhiệm → thêm `supersededByProductId`. Khác với đổi
  tên: đổi tên là cùng một sản phẩm (`id` giữ nguyên), kế nhiệm là hai sản phẩm.

## Phí thường niên nằm ở bảng riêng

`product_fees`, có hiệu lực theo thời gian, **không** phải một trường trên
`Product`. Lý do là ràng buộc cứng chứ không phải sở thích: phí đổi, và nếu nó
nằm trên `Product` thì cách duy nhất giữ lịch sử là đóng cả dòng sản phẩm rồi
mở dòng mới với id mới — kéo theo mọi khoá ngoại gãy cùng lúc. Tức là **không
thể ghi lại một lần đổi phí mà không phá lịch sử**.

Miễn phí năm đầu là ưu đãi của một OFFER (`Offer.annualFeeFirstYear`). Miễn phí
theo điều kiện là một QUYỀN LỢI (`annual_fee_waiver_conditional`). Ba thứ khác
nhau, ba chỗ khác nhau.

## Trần tích điểm dùng chung

`earning_caps` là entity riêng, và `EarningRate.capId` **trỏ** vào nó. Không
chép trần vào từng dòng tỷ lệ: TD® Cash Back có một trần $450/năm dùng chung
cho bốn hạng mục và một trần $450 khác cho hai hạng mục nữa. Chép vào từng dòng
thì sáu dòng trông như sáu trần độc lập và engine cấp $2,700 thay vì $900.
Cobalt cũng vậy với ba nhóm 5x dùng chung 12,500 điểm/tháng.

## Quyền lợi: đơn vị và nhà cung cấp

`Benefit.unit` nói `numericValue` đo bằng gì (`cad`, `visits`, `guests`,
`nights`, `credits`, `count`). Không có nó thì `4` là bốn lượt lounge, bốn trăm
đô, hay bốn người đi cùng — cả ba đều có thật trong bộ này.

`ProductBenefit.provider` là hãng cấp quyền lợi. Hai quyền lợi chỉ trùng nhau
khi **cùng `benefitId` VÀ cùng `provider`** — "miễn hành lý" của Air Canada® và
của United® là hai thứ khác nhau, và cờ `duplicatesAcrossCards` một mình sẽ
triệt tiêu giá trị thẻ United® chỉ vì người dùng đã có thẻ Aeroplan®.

## Đọc dữ liệu tại một thời điểm

`datasetAt(data, "2026-10-01")` trả về cả thế giới như nó ở ngày đó;
`activeAt` / `oneActiveAt` cho từng quan hệ. Đây là nửa còn lại của hợp đồng
chỉ-thêm — giữ lịch sử mà không hỏi được "hôm đó trông thế nào" thì lịch sử chỉ
là rác chiếm chỗ.

`RecommendationDataSource.getDataset({ asOf })` đẩy phép lọc xuống backend —
bản trong repo lọc mảng, bản PostgreSQL sau này sẽ dịch thành `WHERE` và dùng
index thay vì nạp cả lịch sử về ứng dụng.

`indexDataset(data)` dựng các `Map` tra theo khoá ngoại. Dùng nó thay vì
`.filter()` trong vòng lặp ứng viên: ở database thì đây là index, và hình dạng
dữ liệu quyết định hình dạng code Phase 3 sẽ viết.

## Thêm một thẻ mới

**Chỉ sửa dữ liệu, không viết code.** Đã chứng minh: ba thẻ CIBC® Aeroplan®
được thêm nguyên vẹn bằng cách này, không đụng một dòng logic nào.

1. `data/products.ts` — một dòng trong `SEEDS`. `slug` phải khớp Contentful,
   `annualFee` là con số mở đầu `annualFeeVi` (nó đi vào `PRODUCT_FEES`, không
   vào `PRODUCTS`).
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

## Thẻ ngừng bán: ĐÓNG, không XOÁ

`isActive: false` + `effectiveTo` = ngày cuối còn mở được +
`contentfulLinked: false` nếu entry đã gỡ. Dòng sản phẩm ở lại vĩnh viễn.

Xoá dòng là để lại một rừng tham chiếu mồ côi — offer, tỷ lệ tích điểm, quyền
lợi và điều kiện đều trỏ vào `productId` — và `recommendation_runs` của Phase 4,
thứ sinh ra để trả lời "vì sao khuyến nghị tháng trước khác tháng này", sẽ trỏ
vào một sản phẩm không còn ai giải thích được.

Validator cưỡng chế cả hai chiều: tham chiếu mồ côi là lỗi, và `isActive: false`
mà thiếu `effectiveTo` cũng là lỗi. Audit khi thấy entry biến mất khỏi Contentful
sẽ nói thẳng cách sửa là ĐÓNG, vì cách sửa tự nhiên nhất — xoá cho hết đỏ — là
cách phá lịch sử.

## Lịch sử offer

`RecommendationDataSource.getOfferHistory(slug)` trả về mọi lần mức welcome
bonus của thẻ đổi, đọc từ [`../../../data/offer-history.json`](../../../data/offer-history.json)
(GitHub Action ghi mỗi ngày, chỉ ghi thêm khi số đổi). Nối được vì cả hai kho
đánh khoá bằng đúng slug Contentful.

Đây là primitive cho §12 (percentile lịch sử) và là nửa còn thiếu của §11:
"70,000 điểm" một mình không trả lời được câu quyết định — nên mở NGAY hay chờ.

Mỗi điểm mang `unit` (`points` / `dollar` / `percent`), và Phase 3 **chỉ được
so hai điểm cùng đơn vị**. Thẻ cashback đổi từ "Hoàn tiền 15%" sang "$250 tiền
mặt" là đổi đơn vị: so thẳng 15 với 250 rồi nói "từng lên tới $250" là một câu
về tiền, nói sai thì người đọc mở nhầm thẻ.

Mỗi đợt mang `at`, `until`, và hai cờ nói ra chỗ dữ liệu KHÔNG biết:

- `until` nằm trên chính điểm dữ liệu chứ không để người dùng suy từ `at` của
  điểm kế tiếp — thẻ chạy 70,000 từ 01/08, bỏ bonus ngày 10/08, chạy lại
  70,000 từ 01/09 thì cách suy đó kết luận đợt đầu kéo dài suốt tháng 8.
- `startCensored` — `at` chỉ là lần ĐẦU TIÊN nhìn thấy mức này, không phải
  ngày nó bắt đầu. Đúng với đợt đầu của mọi thẻ, vì nhật ký chỉ ghi khi số
  ĐỔI. Tính thời lượng đợt đó như con số chắc chắn là luôn ước lượng thiếu.
- `endCensored` — `until: null` nghĩa là **chưa quan sát thấy kết thúc**, KHÔNG
  phải "đang chạy". Thẻ bị gỡ khỏi Contentful thì nhật ký chỉ đơn giản dừng
  lại, không có bia mộ. Chỉ `Product.isActive` / `effectiveTo` mới phân biệt
  được thẻ chết với thẻ còn sống — tra chỗ đó trước khi nói bất cứ điều gì ở
  thì hiện tại.

Những lần ghi mà mức bonus KHÔNG đổi đã bị bỏ trước khi trả về — file gốc ghi
thêm một dòng khi welcome bonus HOẶC rebate đổi, nên không lọc thì Scotiabank®
Gold trả về 50,000 điểm hai lần chỉ vì rebate đi từ $150 lên $200. So bằng
(SỐ, ĐƠN VỊ) chứ không bằng nhãn: Momentum đã đổi chữ "Hoàn tiền 15%" →
"Cashback 15%" mà ưu đãi y nguyên.

**Mọi ngày trong lịch sử offer là NGÀY GHI NHẬN**, không phải ngày nhà phát
hành đổi offer. Nhật ký ghi mỗi ngày một lượt, và khi một thẻ bị unpublish tạm
thì recorder cố ý không ghi gì — nên một đợt có thể kết thúc, và đợt sau có thể
bắt đầu, ở bất kỳ đâu trong khoảng thẻ vắng mặt. Dùng để xếp thứ tự và ước
lượng thời lượng thì được; đừng trình bày với người đọc như ngày công bố.

Muốn chính xác hơn thì phải sửa `record-offer-history.mts` ghi thêm một dòng
"không thấy thẻ này" — việc của recorder, không phải của lớp dữ liệu này.

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
npm run test:reco         # phép tính chi tiêu, bất biến dữ liệu, lịch sử offer
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
