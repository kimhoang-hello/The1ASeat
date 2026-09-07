# Recommendation engine — Phase 1: lớp dữ liệu

Nguồn sự thật có cấu trúc cho **sản phẩm, offer, chương trình điểm, chặng
chuyển điểm, quyền lợi, tỷ lệ tích điểm, điều kiện mở thẻ và award strategy**.

Chỉ là DỮ LIỆU. Chưa có engine nào ở đây — Phase 3 mới có. Việc của Phase 1 là
làm sao đến lúc đó engine chỉ phải đọc, không phải đoán.

Spec đầy đủ: [`docs/recommendation-engine-v1.md`](../../../docs/recommendation-engine-v1.md).
Mọi tham chiếu dạng "spec §11" trong các file ở đây đều trỏ vào nó.

## Vì sao không phải Supabase

Spec đề xuất Supabase + Postgres. Repo này chưa từng có database nào: dữ liệu
miền có cấu trúc vẫn nằm trong module TS chú thích kỹ (`award-charts.ts`,
`transfer-partners.ts`, `points-programs.ts`), nội dung biên tập nằm ở
Contentful, và site deploy thẳng từ `main` lên Hostinger.

Dữ liệu Phase 1 là dữ liệu THAM CHIẾU do biên tập viên duy trì tay — spec §23
nói thẳng là V1 không scrape. Thứ nó cần là lịch sử đọc được và một vòng review
trước khi lên site. Đó đúng là thứ git cho sẵn.

Dữ liệu người dùng của Phase 2 (hồ sơ, thẻ đang giữ, số dư điểm) **rốt cuộc sẽ
phải có database thật** — nó không nằm trong git được. Nhưng "rốt cuộc" không
phải "ngay bây giờ": Phase 2 đã dựng xong mà chưa chọn chỗ lưu, vì việc của nó
là MÔ HÌNH và mô hình không đổi theo chỗ lưu (xem mục "Phase 2" bên dưới).
Chọn chỗ lưu là việc phải xong **trước Phase 5**.

Cả hai lớp đều đi qua một cửa duy nhất — `RecommendationDataSource` trong
[`source.ts`](source.ts) cho dữ liệu sản phẩm, `UserDataSource` trong
[`user-source.ts`](user-source.ts) cho dữ liệu người dùng: đổi implementation ở
đó, engine không đụng một dòng.

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

## Ngừng phát hành ≠ hết tồn tại (và mở lại được)

`product_availability` là các quãng thẻ còn **nhận đơn mới** — một BẢNG chứ
không phải một cặp trường, vì thẻ ngừng rồi mở lại là chuyện có thật và một cặp
`from/to` chỉ kể được một quãng. Nó TÁCH khỏi `effectiveFrom/effectiveTo` của
bản ghi sản phẩm, và phân biệt này quan trọng:

- Thẻ ngừng phát hành → đóng quãng khả dụng hiện tại (`effectiveTo` + `closedReason`). **Offer phải đóng theo** (không
  ai mở được nữa), nhưng **tỷ lệ tích điểm, quyền lợi và phí thì KHÔNG** —
  người đang giữ thẻ vẫn kiếm điểm, vẫn hưởng quyền lợi, vẫn trả phí hằng năm.
- Mở lại → thêm một quãng mới. Cả hai quãng ở lại; `isAvailableAt(windows, day)`
  trả lời "hôm đó có mở không".
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

## Họ thẻ và thứ hạng

`ProductFamily` + `Product.familyId` / `tierRank`. Ba thẻ CIBC® Aeroplan® là ba
**hạng** của một thẻ, không phải ba lựa chọn độc lập — Phase 3 cần biết để
không khuyên cả ba cùng lúc, để nói "bạn đang giữ hạng Infinite, cái này là nâng
hạng", và để tụt xuống hạng thấp hơn khi người dùng không đủ điều kiện hạng cao.

Không có nó thì cách duy nhất là `slug.startsWith("cibc-aeroplan")` — hard-code
tên sản phẩm vào logic, và sai cả hai chiều: `amex-aeroplan` cùng chứa
"aeroplan" mà khác họ, còn RBC® Avion® Visa Infinite và Visa Platinum cùng họ
mà không chung tiền tố nào đủ đặc trưng.

`indexDataset(...).productsByFamily` trả về các hạng **đã sắp từ thấp tới cao**.

**Nghi ngờ thì đừng gom.** HỌ = các hạng của *cùng một thẻ*, nơi hạng cao là bản
đắt hơn của hạng thấp. Amex® Green / Cobalt® / Gold Rewards cùng kiếm Membership
Rewards® nhưng là **ba sản phẩm độc lập** với cấu trúc tích điểm khác hẳn — gom
chúng lại sẽ khiến engine im lặng giấu đi hai trong ba. Bỏ sót một họ chỉ làm
engine khuyên hơi thừa; gom nhầm thì nó giấu mất lựa chọn đúng.

## Định giá điểm cũng có phiên bản

`program_valuations`, không phải một trường trên `PointsProgram`. Đây là con số
**mọi hàm chấm điểm nhân vào**, và nó đổi mỗi lần một chương trình devalue. Ghi
đè nó là làm mọi khuyến nghị cũ không giải thích lại được — chúng sẽ được giải
thích bằng một định giá chưa tồn tại lúc chúng được đưa ra.

Cùng lý do phí thường niên phải ra khỏi `Product`; khác ở chỗ định giá ảnh
hưởng tới điểm số của **mọi** sản phẩm, không chỉ một.

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

## Đổi một sự thật = THÊM một phiên bản

Mọi thực thể có hiệu lực theo thời gian đều nhận `from` / `to` / `verifiedAt`
**trên từng dòng seed**, và id sinh từ `from` của chính dòng đó. Đóng dòng cũ,
thêm dòng mới:

```ts
["everything_else", 1,    { to: "2026-12-31" }],
["everything_else", 1.25, { from: "2027-01-01" }],
```

Một hằng ngày dùng chung cho cả file **không** làm được việc này: cách duy nhất
ghi lại một thay đổi khi đó là sửa hằng, tức ghi đè ngày hiệu lực của mọi dòng
cùng lúc. Với nhiều năm thay đổi tỷ lệ và quyền lợi thì đó là mất sạch lịch sử.

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
vào `data/points-programs.ts`, kèm `contentPattern` và một dòng trong
`PROGRAM_VALUATIONS`. Chip lọc trên `/credit-cards` **tự suy ra** từ đó —
`card-points-programs.ts` không còn danh sách viết tay riêng. Quyền lợi mới → thêm vào
`data/benefits.ts`, nhớ trả lời `duplicatesAcrossCards`.

Chỗ DUY NHẤT phải sửa kiểu chứ không phải dữ liệu là **hạng mục chi tiêu mới**
(`SPEND_CATEGORIES` trong `types.ts`) — cố ý, vì hạng mục là từ vựng chung với
hồ sơ chi tiêu người dùng ở Phase 2, và một hạng mục chỉ có ở một bên là một
hạng mục vô dụng.

## Hai trục thời gian

`effectiveFrom/To` = sự thật này ĐÚNG từ khi nào tới khi nào.
`recordedAt` = bản ghi được ĐƯA VÀO kho ngày nào.

Chúng tách ra ở đúng chỗ quan trọng: một đính chính lùi ngày nhập hôm nay có
`effectiveFrom` sáu tháng trước nhưng `recordedAt` là hôm nay.
`datasetAt(data, asOf, { knownAt })` cắt theo cả hai trục — không có `knownAt`
thì bản dựng lại của tháng trước chứa dữ kiện mà engine lúc ấy chưa hề biết.

`recordedAt` **độc lập với `verifiedAt`**: kiểm lại một dữ kiện không đổi ngày
nó vào kho. Buộc hai thứ vào nhau thì mỗi lần kiểm lại làm các lượt chạy trước
đó trông như chưa từng biết dòng này.

**Giới hạn, nói thẳng:** một `recordedAt` duy nhất không dựng lại được *mọi*
chuyện. Đóng một dòng cũ là SỬA dòng đó (đặt `effectiveTo`), và bản ghi không
giữ lại việc nó từng mở — nên dựng lại một ngày trước lần đóng sẽ thấy dòng đã
đóng. Đúng tuyệt đối đòi mọi dòng bất biến và mỗi lần đóng là một phiên bản
mới. Phase 1 **cố ý không làm vậy**: spec §20 đã yêu cầu `recommendation_runs`
lưu `input_snapshot` + `derived_state` của chính lượt chạy đó, và một bản chụp
đã lưu luôn đúng hơn mọi phép dựng lại. `datasetAt` là lưới thứ hai cho những
lượt chạy không có bản chụp.

## Trống ≠ bằng không, và trống là DỮ LIỆU

`dataset.gaps` là danh sách chỗ trống **máy đọc được** (`DataGap`), suy ra từ
chính dữ liệu bởi [`gaps.ts`](gaps.ts) — không phải một danh sách viết tay chạy
song song sẽ lệch, và không phải chuỗi cảnh báo của audit mà Phase 3 phải parse.
Sáu loại: `no_award_chart`, `award_route_uncovered`, `offer_terms_unknown`,
`base_earn_rate_unknown`, `eligibility_unknown`, `transfer_paths_unmodelled`.

`datasetAt` tính LẠI `gaps` cho từng thời điểm: thẻ hồi đó chưa có tỷ lệ nền mà
nay đã có thì bản dựng lại phải nói đúng cái engine thiếu **lúc ấy**.

Lưu ý `eligibility_unknown`: luật cư trú áp cho mọi thẻ, nên "có luật" không có
nghĩa là "đã biết điều kiện". Chỉ luật đặc thù mới tính.

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

`Product.previousSlugs` gộp lịch sử qua các lần đổi tên. Một ca nhật ký gốc
không kể lại được: thẻ đổi A→B→A rồi quay về đúng mức cũ của A thì recorder
không sinh dòng nào (nó chỉ ghi khi số ĐỔI), và mức cuối của B ở lại như thể
vẫn đang chạy. Validator cảnh báo khi thấy hình dạng đó; sửa thật vẫn là việc
của recorder.

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

## Phase 2 — trạng thái người dùng

Phase 1 mô tả thế giới sản phẩm; Phase 2 mô tả một CON NGƯỜI trong thế giới đó:
**họ đang có gì, họ bị ràng buộc bởi cái gì, họ muốn làm gì**. Câu hỏi thứ tư —
"nên khuyên thẻ nào" — cố ý không có chỗ nào để trả lời, vì khoảnh khắc mô hình
người dùng mã hoá kết quả thì engine ở Phase 3 hết tất định.

| File | Vai trò |
| --- | --- |
| `user-types.ts` | `UserProfile`, `UserSpendProfile`, `UserCard`, `UserPointBalance`, `Goal`, `UserState`, `UserDataGap` |
| `user.ts` | Phép đọc mà viết tay ở chỗ gọi thì sai âm thầm (`everHeld`, `unallocatedMonthly`, `resolveTripGoal`, `compareToThreshold`) |
| `user-gaps.ts` | Suy ra chỗ chưa biết, máy đọc được |
| `user-validate.ts` | Ở database thì đây là FK + CHECK |
| `user-source.ts` | `UserDataSource` — cửa duy nhất engine đọc trạng thái người dùng |
| `data/user-fixtures.ts` | 13 nhân vật: bộ test §32 + 12 kiểu người dùng khác hẳn nhau |

### Chưa chọn database, và không cần chọn để làm xong Phase 2

Bàn giao Phase 1 để ngỏ câu hỏi chỗ lưu. Nó là quyết định hạ tầng/chi phí, còn
việc Phase 2 thật sự phải làm là **mô hình** — mô hình không đổi theo chỗ lưu.
`UserDataSource` chỉ có ĐỌC: Phase 3 chỉ đọc, còn phần ghi dính chặt vào
transaction, migration và quyền truy cập của một backend cụ thể, nên dựng sẵn
bây giờ là đoán hình dạng của thứ chưa tồn tại.

`inMemoryUserStore` trả về **bản sao**. Database nào cũng trả bản sao; trả object
gốc thì engine lỡ tay sửa sẽ chạy đúng ở đây và hỏng khi đổi backend.

### Trống ≠ bằng không, ở BA mức

Phase 1 có luật này cho từng trường. Ở dữ liệu người dùng nó phân ra ba mức, và
mất mức nào cũng dẫn tới một khuyến nghị sai mà không có lỗi nào nổ ra:

1. **Trường** — `grocery: 0` là "đã hỏi, người này không đi siêu thị"; vắng mặt
   là "chưa hỏi". `annualFeeTolerancePerCard: 0` là "chỉ thẻ miễn phí"; `null` là
   chưa hỏi.
2. **Bộ sưu tập** — `cards: []` một mình không kể được nó là "tôi chưa có thẻ
   nào" (Test A, tín hiệu mạnh nhất dẫn tới thẻ khởi đầu) hay "tôi bấm bỏ qua".
   `UserState.declared` tách hai ca đó.
3. **Dòng** — `balance: null` là "có tài khoản, không nhớ số dư": chặng chuyển
   điểm vẫn dùng được, chỉ con số là chưa biết. Khác cả "không có dòng nào" lẫn
   "0 điểm".

`userGaps(state)` gom mọi chỗ chưa biết thành `UserDataGap` máy đọc được. Thứ
tự cố định đòi hỏi **sắp xếp** `cards`/`balances`/`goals` trước khi duyệt, không
chỉ viết các khối theo thứ tự cố định: chúng đến từ một truy vấn database, và
truy vấn không hứa thứ tự nào — hai trạng thái giống hệt nhau sẽ sinh hai danh
sách khác nhau. Danh sách này — §29 (hạ độ tin cậy) và §30 (chọn câu hỏi tiếp theo) đều đọc nó.
Chỗ trống **không phải lỗi**: hồ sơ thiếu dữ liệu là ca bình thường nhất của
Phase 2, nên `validateUserState` không nói gì về chúng.

### `everHeld`, không phải `status === "previously_held"`

`closed` và `previously_held` CÙNG nghĩa "từng giữ". Luật Amex® once-in-a-lifetime
(`EligibilityRule.previous_cardholder_excluded`, `scope: "welcome_offer"`) viết
bằng phép so `previously_held` sẽ để mọi thẻ `closed` lọt qua — và hậu quả không
phải một lỗi, mà là một khuyến nghị trông hợp lý hứa khoản bonus ngân hàng sẽ từ
chối. Dùng `holdsNow` / `everHeld` / `everHeldProductIds`.

Thẻ đã đóng mà không rõ ngày đóng sinh `card_closed_date_unknown`: luật "không có
bonus nếu từng giữ trong N tháng qua" không đánh giá được, và mặc định là đủ điều
kiện lại hứa một khoản bonus không có thật. `lastClosed` trả về **ba** trạng thái
(`never_closed` / `closed` / `unknown`) và chuyển sang `unknown` khi CHỈ MỘT quãng
thiếu ngày — trả về ngày đã biết ở đó là trình bày một ngày cũ như thể nó là lần
đóng gần nhất.

Và `validateUserState` kiểm `status` thuộc đúng ba giá trị: một status gõ sai làm
`holdsNow` và `everHeld` **cùng** trả false, tức thẻ biến mất khỏi cả danh mục lẫn
lịch sử mà không phép kiểm nào khác nhận ra.

### Thu nhập cá nhân và hộ gia đình là HAI trường

Ngân hàng Canada công bố điều kiện theo cặp nối bằng HOẶC ("$60,000 cá nhân
HOẶC $100,000 hộ gia đình"), và `income()` trong `data/eligibility-rules.ts` đã
dựng đúng cấu trúc đó. Vế hộ gia đình sinh ra để nhận những người có thu nhập
cá nhân **dưới** ngưỡng — nên một trường thu nhập duy nhất làm nó vô dụng:
engine hoặc so cùng một con số với cả hai ngưỡng (chỉ giúp người vốn đã đạt),
hoặc loại thẳng đúng những người vế kia sinh ra để cứu.

`isStudent` cũng vậy, ở quy mô nhỏ hơn: `student_status_required` là luật
`hard` có thật trong bộ dữ liệu. Không có trường thì hoặc loại thẻ sinh viên
khỏi cả sinh viên, hoặc khuyên nó cho người bốn mươi lăm tuổi.

`personalIncomeDeclined` / `householdIncomeDeclined` là câu trả lời "tôi không
muốn nói" của spec §4.1, tách khỏi "chưa hỏi": cả hai để trường thu nhập ở
`null`, nhưng chỉ một trong hai còn đi hỏi lại được. Không tách thì §30 sẽ mãi
chọn thu nhập làm câu hỏi đáng giá nhất và hỏi lại đúng điều người dùng vừa từ
chối. Cùng luật với `declared`, chỉ ở mức trường thay vì mức bộ sưu tập.

**HAI cờ chứ không một**, vì hai câu hỏi được hỏi ở hai thời điểm: thu nhập hộ
gia đình chỉ đáng hỏi SAU KHI biết thu nhập cá nhân không đủ. Khai câu đầu rồi
từ chối câu sau là chuyện bình thường — với một cờ chung thì trạng thái đó hoặc
bị validator từ chối, hoặc phải để cờ `false` rồi bị hỏi lại mãi.

Cả hai đều mặc định `null` và **không cần hỏi trước**: chúng chỉ đổi kết quả
trong những ca cụ thể, nên chúng là câu hỏi §30 điển hình — hỏi lúc câu trả
lời quyết định điều gì đó.

`business_required` thì KHÔNG có trường riêng: spec §31 hỏi đúng một câu
"business cards allowed: yes/no", và `businessCardsAllowed` là câu trả lời cho
cả điều kiện lẫn sở thích.

### Tiền là KHOẢNG

`EstimatedAmount { low, high }`, `high: null` = khoảng mở ("150K+"). Cùng luật
với `AwardStrategy` của Phase 1, ở đầu kia của cùng một phép so. Hệ quả quan
trọng nhất: `compareToThreshold` cho **ba** kết quả, không phải hai — thu nhập
"60–80K" so với thẻ đòi $80,000 là `straddles`, và trả về "không đạt" ở đó là
loại oan đúng những người khoảng đó bao trùm (§14 tách eligibility khỏi
suitability đúng vì thế). `typicalAmount` của khoảng mở trả về `low`: engine
không được tự bịa ra một trần rồi lấy chính con số bịa để kết luận.

### Chi tiêu khoá theo `SpendCategory`, không theo sáu cột của spec §4.2

`types.ts` đã nói danh sách hạng mục là từ vựng chung hai bên. Sáu cột riêng thì
`food_delivery`, `streaming`, `transit`, `foreign_currency` — những chỗ các thẻ
khác nhau NHIỀU NHẤT — không có chỗ nào để khai.

`monthlyTotal` và các hạng mục **không suy ra nhau**. `unallocatedMonthly` trả về
phần chưa phân bổ; coi nó bằng không là kết luận người ta không đi du lịch từ một
câu chưa ai hỏi. `minimumSpendCapacity3m` cũng KHÔNG suy từ `monthlyTotal` — spec
gọi nó "especially important" đúng vì phần lớn chi tiêu đã nằm trên thẻ khác.

### `primaryGoal` nói thẳng khi không xác định được

Trả về `{ kind: "none" | "resolved" | "ambiguous" }`, không trả về
`sortedGoals(state)[0]`. Phép sắp xếp đó tất định, nhưng **tất định không phải
là đúng**: nhiều mục tiêu cùng `priority: null` thì thứ quyết định người thắng
là `GoalId` — một chuỗi sinh lúc lưu — và §10 dùng hàm chấm điểm KHÁC NHAU cho
từng loại mục tiêu, nên id đó đổi luôn cả khuyến nghị. `ambiguous` để Phase 3
hỏi người dùng xếp thứ tự, hoặc chạy cả hai rồi trình bày song song.

### Không hỏi thứ không ai đọc

Tiêu chí Phase 2 có hai vế, và vế thứ hai dễ quên: mô hình phải biểu diễn đủ,
**và không được bắt thu thập thứ Phase 3 không cần**. Hai luật rút ra:

- **Trạng thái hợp lệ tối thiểu chỉ cần MỘT câu trả lời: người này muốn gì.**
  Thu nhập, phí chấp nhận được, thẻ đang giữ, số dư, chi tiêu — bỏ trống hết
  vẫn hợp lệ. Có test dựng đúng hồ sơ trống nhất đó và đòi nó sạch.
- **Một `UserDataGap` chỉ được tồn tại nếu có dữ liệu hoặc quy tắc chấm điểm
  THẬT SỰ đọc nó.** Chỗ trống không chặn điều gì mà vẫn khai ra là chiếm suất
  câu hỏi của những thứ đổi được kết quả (§30) và trừ độ tin cậy không lý do
  (§29). `province` là ca đầu tiên rơi vào luật này: trường vẫn được lưu (điều
  khoản một số ngân hàng viết khác cho Quebec, ngày có luật đó thì cần ngay),
  nhưng hôm nay cả 34 luật `residency` đều là `"CA"` — không luật nào theo tỉnh
  bang — nên nó KHÔNG sinh chỗ trống. Một test khoá từng `kind` với lý do tồn
  tại của nó.

### Sở thích và điều kiện là hai trường khác nhau

`businessCardsAllowed` = có MUỐN xét thẻ doanh nghiệp không (suitability, §14).
`hasBusiness` = có doanh nghiệp không (eligibility, `business_required` — luật
`hard` trên 4 sản phẩm). Gộp lại thì sai theo cả hai hướng: người muốn xét mà
không có doanh nghiệp sẽ được khuyên một thẻ ngân hàng từ chối, còn người có
doanh nghiệp mà không muốn thêm thẻ bị đánh dấu KHÔNG ĐỦ ĐIỀU KIỆN thay vì
KHÔNG PHÙ HỢP. §14 tách hai khái niệm đó đúng vì thế.

Spec §31 hỏi một câu, nhưng một câu hỏi không bắt buộc phải ánh xạ thành một
trường — cả hai mặc định `null` và chỉ hỏi khi thẻ doanh nghiệp còn là ứng viên.

### Chuyến đi dùng VÙNG

`TripGoal.destinationRegion` bắt buộc, sân bay không. `originRegion` để `null` thì
`resolveTripGoal` điền từ `profile.country` — suy được thì đừng hỏi lại. Ngược
lại `passengers` **không** mặc định là 1: mặc định 1 chia nhỏ số điểm cần cho một
gia đình bốn người rồi để `NO_NEW_CARD` thắng nhờ một giả định.

### Không có chỗ nào nhét được số tài khoản

Spec §4.4 cấm lưu số tài khoản loyalty, và ở đây điều đó được cưỡng chế bằng việc
**không có một trường chuỗi tự do nào trong cả mô hình** — mã sân bay bị ràng
buộc `^[A-Z]{3}$`. Không có tên, email, ngày sinh; `UserId` là khoá vô nghĩa.
Thu nhập là khoảng chứ không phải con số.

### Validator phải chịu được dữ liệu KHÔNG đúng kiểu

TypeScript vắng mặt lúc chạy, còn dữ liệu tới từ database hoặc JSON. Nên
`validateUserState` kiểm cả những thứ kiểu đã hứa: `status` thuộc đúng ba giá
trị, `businessCardsAllowed`/`isStudent`/`incomeDeclined`/`declared.*` là
boolean thật (chuỗi `"false"` là truthy — nó lặng lẽ đảo ngược câu trả lời), và
mọi phép so `null` — ở **cả** `user-validate.ts` lẫn `user-gaps.ts` — dùng
`== null` để bắt cả `undefined`.

Chuyện `undefined` đáng nói riêng vì nó im lặng theo đúng hướng tệ nhất. Một
dòng cũ thiếu trường mới thêm trượt qua mọi phép so `=== null`: validator không
báo gì, `userGaps` không sinh chỗ trống nào, nên **dữ liệu THIẾU được trình bày
như dữ liệu ĐẦY ĐỦ**. Hai lớp chặn: `requirePresent` báo lỗi trường vắng mặt
(`undefined ≠ null`), và các phép so `== null` vẫn sinh chỗ trống để engine
không bao giờ coi nó là đã biết.

**`validateUserState` TRẢ VỀ danh sách vấn đề, không bao giờ NÉM.** Nó chạy trên
dữ liệu chưa đáng tin, nên một `TypeError` ở đó là chính lớp bảo vệ tự sập trước
thứ nó sinh ra để chặn. Vì vậy mọi phép duyệt object mang `?? {}` và mọi phép so
null mang `== null` — kể cả trong `user.ts`.

Nhưng "không ném" và "không im lặng" là HAI yêu cầu, và bản vá đầu tiên đạt vế
đầu bằng cách phá vế sau: đổi hàng loạt sang `== null` khiến `createdAt`,
`updatedAt` và ngày của goal — những trường KHÔNG được phép trống — thiếu hẳn mà
vẫn trượt qua sạch. Cách giữ cả hai:

- `requirePresent` chạy trên **danh sách khoá đầy đủ** của từng thực thể
  (`PROFILE_KEYS`, `SPEND_KEYS`, `CARD_KEYS`, `BALANCE_KEYS`, và ba biến thể
  goal), không chỉ trên các trường tuỳ chọn.
- Danh sách đó được **cưỡng chế khớp với kiểu lúc biên dịch** bằng
  `AssertAllKeys`: thêm một trường vào `UserProfile` mà quên thêm vào danh sách
  là lỗi biên dịch **nêu đích danh trường bị bỏ sót**. Đã thử thật.
- `checkDate` phân biệt `null` (được phép trống) với `undefined` (trường vắng
  mặt) thay vì nuốt cả hai.

Test quét xoá **TỪNG khoá một** của profile/spend/card/balance/goal — danh sách
khoá lấy từ chính fixture nên trường mới tự động được kiểm — rồi đòi cả validator
lẫn `userGaps` không ném VÀ vẫn báo lỗi. Đã kiểm ngược: gỡ phép kiểm hiện diện
của goal ra là test đỏ, nêu đích danh `goal.priority`.

`user.test.ts` chốt hai luật này bằng cấu trúc: một test kiểm bộ khoá của mọi
dòng số dư, một test kiểm không trường nào ngoài `cards` nhắc tới một `ProductId`
— thêm `preferredProductId` vào hồ sơ sẽ làm nó đỏ.

Nhưng test chỉ chạy trên fixture, mà dữ liệu thật tới từ database. Nên
`checkKeys` cưỡng chế cả hai luật **lúc chạy**: bộ khoá của mỗi dòng phải khớp
ĐÚNG danh sách, nên một `loyaltyAccountNumber` hay `preferredProductId` lọt vào
từ JSON là một dòng LỖI, không phải một trường được lưu im lặng rồi giao cho
Phase 3.

## Chạy gì

```
npm run audit:reco-data   # toàn vẹn nội bộ + đối chiếu Contentful + drift nguồn
npm run test:reco         # 160 test: chi tiêu, bất biến, vòng đời, quy mô, trạng thái người dùng
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

## Quy mô

Đo trên bộ dữ liệu tổng hợp (nhân bản seed thật):

| Dòng | `validateDataset` | `datasetAt` | `indexDataset` |
| --- | --- | --- | --- |
| 500 | 5 ms | 0 ms | 0 ms |
| 7,628 | 30 ms | 0 ms | 0 ms |
| 60,280 | 178 ms | 1 ms | 0 ms |

Tuyến tính. `validateDataset` dành cho CI và audit, không phải cho mỗi request;
Phase 3 đọc qua `datasetAt` + `indexDataset`, và cả hai ~1 ms ở 60k dòng.

`scripts/` **được kiểm kiểu** (`tsconfig.json`). Lý do trước đây loại nó ra đã
được `allowImportingTsExtensions` gỡ, và đổi lại vì một lỗi thật: audit đọc một
trường đã bị đổi tên, `undefined` là falsy nên MỌI thẻ bị bỏ qua và 31 phép so
phí/rebate chết lặng suốt trong khi audit vẫn in "✓ Không lỗi".
