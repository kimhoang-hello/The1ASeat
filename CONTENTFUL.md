# Contentful content model

Khi bạn tạo Contentful Space, tạo 4 Content Type đầu tiên sau đây với đúng Field ID (chữ thường,
camelCase) để khớp với code trong `src/lib/content/contentful.ts`. Sau khi có
**Space ID** và một **Content Delivery API access token**, điền vào `.env.local`
(copy từ `.env.example`). Hai biến này bắt buộc: thiếu thì site không build được.

## `blogPost`

| Field ID      | Type                                   |
|---------------|-----------------------------------------|
| slug          | Short text (unique)                     |
| type          | Short text, validated: `post` or `video`|
| categoryVi    | Short text                              |
| categoryEn    | Short text                              |
| titleVi       | Short text                              |
| titleEn       | Short text                              |
| excerptVi     | Long text                               |
| excerptEn     | Long text                               |
| bodyVi        | Rich text                               |
| bodyEn        | Rich text                               |
| coverImage    | Short text, validated: `airplane`, `globe`, `building`, `armchair`, `credit-card`, or `avatar` (placeholder icon key — not a real photo yet) |
| videoUrl      | Short text (YouTube/Vimeo URL, optional)|
| publishedAt   | Date & time                              |
| minutesRead   | Integer                                 |
| author        | Short text                              |
| seoTitleVi    | Short text (tuỳ chọn, tối đa 70 ký tự)  |
| seoDescriptionVi | Long text (tuỳ chọn, tối đa 170 ký tự)|

### `seoTitleVi` và `seoDescriptionVi` — dùng khi nào?

Hai field này **không hiển thị trên trang**. Chúng chỉ thay đổi dòng tiêu đề
xanh và dòng mô tả xám mà Google hiện trong kết quả tìm kiếm.

- Để **trống** thì Google dùng `titleVi` và `excerptVi` như trước — không cần
  làm gì cả.
- Điền vào khi tiêu đề hiển thị không phải là thứ người Việt gõ vào Google.
  Đây chính là trường hợp của các bài **video**: tiêu đề là tiêu đề YouTube
  tiếng Anh (ví dụ *"I Flew Japan Airlines' NEW A350 1000 Business Class"*),
  nên gần như không ai tìm ra bài đó bằng tiếng Việt. Điền `seoTitleVi` là
  *"Review Business Class Japan Airlines A350-1000: JFK đi Tokyo"* thì trang
  vẫn hiện tiêu đề tiếng Anh cho người xem, nhưng Google lại xếp hạng theo
  cụm từ tiếng Việt.

Mẹo viết:

- `seoTitleVi`: dưới 70 ký tự, đặt từ khoá quan trọng nhất lên đầu.
- `seoDescriptionVi`: 120–170 ký tự, viết như một lời mời đọc, có nhắc lại
  từ khoá chính một cách tự nhiên.

## `creditCardOffer`

| Field ID       | Type                          |
|----------------|-------------------------------|
| slug           | Short text (unique)           |
| name           | Short text                    |
| issuer         | Short text                    |
| image          | Short text, validated: `airplane`, `globe`, `building`, `armchair`, `credit-card`, or `avatar` (placeholder icon key — not a real photo yet) |
| cardImage      | Media (image), optional — real photo of the card; falls back to the `image` placeholder icon when empty |
| country        | Short text, validated: `US` or `CA` |
| annualFeeVi    | Short text                    |
| annualFeeEn    | Short text                    |
| cardTypeVi     | Short text                    |
| cardTypeEn     | Short text                    |
| welcomeBonusVi | Short text (max 60), optional — chỉ con số welcome bonus, đủ ngắn để làm số lớn trên thẻ: "110,000 điểm Aeroplan®". Để trống ở thẻ không có welcome bonus (cashback, thẻ bán tỷ lệ tích điểm); thẻ đó hiển thị phí thường niên làm số lớn thay thế. |
| headlineVi     | Long text                     |
| headlineEn     | Long text                     |
| editorsTakeVi  | Long text                     |
| editorsTakeEn  | Long text                     |
| keyBenefitsVi  | Short text, list              |
| keyBenefitsEn  | Short text, list              |
| elevatedBonus  | Boolean                       |
| expiresAt      | Date & time, optional — offer/bonus expiry date, shown next to the badges when set |
| applyUrl       | Short text                    |
| rebateVi       | Short text, optional — số tiền rebate FinlyWealth, hiện thành badge trên ảnh thẻ |

> **`rebateVi` và câu HOT TIP phải khớp nhau.** Cùng con số rebate thường được
> viết lại trong `editorsTakeVi` ("HOT TIP: Apply thẻ qua FinlyWealth để nhận
> thêm $140 rebate."). Job `check-rebates` chạy hai lượt mỗi ngày, giữ hai
> chỗ đó khớp nhau và báo lỗi nếu bạn sửa tay một chỗ mà quên chỗ kia — kiểm
> ngay bằng `npm run audit:rebate-prose` (thêm `-- --fix` để sửa luôn). Trước
> khi có
> lượt canh này, thẻ Scotiabank® Scene+™ Visa for Students hiện badge $50 mà
> editor's take vẫn hứa $125.

## `transferBonus`

| Field ID     | Type                |
|--------------|---------------------|
| slug         | Short text (unique) |
| fromProgram  | Short text          |
| toProgram    | Short text          |
| bonusPercent | Integer             |
| expiresAt    | Date & time         |
| url          | Short text          |
| noteVi       | Long text, optional — shown under the two program names, e.g. a "must register first" caveat |

> **Chỉ nhập transfer bonus CANADA ở đây** (Amex® Membership Rewards® bản
> Canada, RBC® Avion®…). Mọi entry `transferBonus` đều hiện trong mục **Canada**
> của `/transfer-bonuses`. Bonus của điểm thẻ **Mỹ** (Chase®, Amex® Mỹ, Capital
> One®, Citi®, Bilt, Wells Fargo®) KHÔNG nhập vào Contentful: một job GitHub
> đọc bảng của Daily Drop mỗi thứ Hai và tự cập nhật mục **Mỹ**. Muốn chạy ngay: GitHub → Actions → *Đồng bộ transfer bonus Mỹ
> từ Daily Drop* → **Run workflow**.
>
> `toProgram` viết đúng tên hàng trong bảng `/transfer-partners` (ví dụ
> `British Airways® Club`, `Marriott Bonvoy®`) thì trang tự thêm logo, dòng
> "Chuyển 1,000 điểm, nhận …" và nhãn xanh trong ô của bảng.

## `author`

| Field ID | Type        |
|----------|-------------|
| name     | Short text  |
| photo    | Media (image) |
| bioVi    | Long text   |
| bioEn    | Long text   |

Entry `author` bị unpublish thì trang chủ và trang Giới thiệu dùng bản bio dự
phòng trong repo (`src/lib/content/author-fallback.json`) cho tới khi publish lại.

## `gameHighScore` (không còn dùng)

Content type này là của mini-game Catch The Points. Game đã tắt từ 17/09/2026 và
code của nó được gỡ khỏi repo ngày 09/11/2026, nên website không còn đọc hay ghi
vào đây. Các entry kỷ lục cũ vẫn nằm trong Contentful; muốn dọn thì xoá cả content
type, không ảnh hưởng gì tới site.

## Auto-refresh site khi bấm Publish

Mặc định, sau khi Publish trong Contentful, thay đổi chỉ lên web ngay khi có deploy
code mới, hoặc bạn tự vào Hostinger bấm "Clear cache" thủ công (trang chủ và vài
trang khác được build tĩnh + CDN Hostinger cache tới 1 năm). Để việc này tự động,
route [`/api/revalidate`](src/app/api/revalidate/route.ts) làm 2 việc mỗi khi được
gọi: yêu cầu Next.js build lại toàn bộ trang, và gọi API Hostinger xoá cache CDN —
Contentful sẽ tự gọi route này mỗi khi bạn Publish/Unpublish một entry.

**1. Lấy Hostinger API token và username** — vào hPanel (trang quản lý Hostinger,
không phải dashboard website) → tìm mục **API** trong phần tài khoản/cài đặt → tạo
token mới (quyền Hosting là đủ). Ghi lại token đó và **username** hiển thị cùng chỗ
(khác email đăng nhập).

**2. Thêm biến môi trường** — vào đúng chỗ bạn đã điền `CONTENTFUL_SPACE_ID` lúc
trước cho site live (không phải file `.env.local` ở máy bạn, đó chỉ để chạy thử
local), thêm 4 biến:

| Biến                 | Giá trị                                              |
|----------------------|-------------------------------------------------------|
| `REVALIDATE_SECRET`  | một chuỗi bất kỳ bạn tự nghĩ ra (vd `ghe1a-xyz789`), dùng để không ai gọi được route này ngoài Contentful |
| `HOSTINGER_API_TOKEN`| token vừa tạo ở bước 1                                |
| `HOSTINGER_USERNAME` | username hPanel ở bước 1                              |
| `HOSTINGER_DOMAIN`   | `ghe1a.com`                                            |

**3. Tạo webhook trong Contentful** — app.contentful.com → chọn Space **Ghe1A** →
**Settings → Webhooks → Add Webhook**:
- Name: `Refresh Ghế 1A site`
- URL: `https://ghe1a.com/api/revalidate` — **không** kèm `?secret=...` vào đây
- Giữ method mặc định (POST)
- Triggers: chọn **Select specific triggering events** → tick ít nhất **Publish**
  (tick thêm Unpublish/Delete nếu muốn site cũng tự cập nhật khi bạn gỡ bài)
- Kéo xuống mục **Headers** → **Add custom header**, tick ô **Secret**:
  - Key: `Authorization`
  - Value: `Bearer <giá trị REVALIDATE_SECRET ở bước 2>` (có chữ `Bearer` và
    một dấu cách ở đầu)
- Save

> **Vì sao secret đi trong Header chứ không trong URL.** Webhook này trước đây
> gọi `...?secret=abc123`, và mọi thứ nằm trong URL đều bị ghi lại nguyên văn:
> access log của Hostinger, log của proxy, header referrer. Tức là mỗi lần bạn
> bấm Publish là secret lại được chép thêm vào một file log nữa. Header thì
> không bị ghi vào những chỗ đó, và tick ô **Secret** khiến Contentful cũng
> giấu luôn giá trị đó trong giao diện của nó. Từ 29/08/2026 route CHỈ còn
> nhận Header (xem [src/lib/job-auth.ts](src/lib/job-auth.ts)): webhook hay
> caller nào còn gọi `?secret=...` sẽ nhận 401. Hai job route
> (`expire-offers`, `sync-videos`) cũng chỉ còn nhận **POST**,
> không mở được bằng cách dán URL vào browser.

**4. Kiểm tra** — Publish thử 1 entry bất kỳ, đợi ~10 giây rồi mở lại `ghe1a.com`
(F5 mạnh / Ctrl+Shift+R) — nội dung phải lên ngay, không cần vào Hostinger bấm
Clear cache nữa.

Nếu 4 biến môi trường trên chưa được điền, route vẫn chạy bình thường (không lỗi)
nhưng chỉ làm mới cache của Next.js chứ không xoá được cache CDN Hostinger — bạn
vẫn cần bấm Clear cache thủ công như trước.

## Tự động gửi email cho subscriber khi có bài viết mới (chỉ bài Deals)

Route `/api/revalidate` ở trên giờ làm thêm 1 việc: mỗi khi 1 `blogPost` với
`type = "post"` (bài viết thường, **không phải video**) được Publish **lần
đầu tiên**, nó tự gửi 1 email broadcast qua Kit đến toàn bộ danh sách
subscriber, gồm tiêu đề + đoạn mô tả ngắn + link đến bài viết, trình bày theo
đúng thiết kế (nền kem, card trắng, logo + "Ghế 1A", nút bấm pill) như email
chào mừng subscriber mới — cả 2 dùng chung 1 template ở
[src/lib/subscriber-email.ts](src/lib/subscriber-email.ts). Sửa bài đã đăng
và Publish lại sẽ **không** gửi lại email (chỉ gửi ở lần Publish đầu).

**Chỉ bài Deals được tự gửi email (chốt 30/09/2026):** email chỉ tự gửi khi ô
`Category Vi` là **`Deals`** (không phân biệt hoa/thường). Mọi chủ đề khác —
`Kiến thức`, `Tips`, `Đánh giá`, `News`, `Khách sạn`, và bất kỳ chủ đề nào bạn
đặt ra sau này — chỉ lên site, **không** tự vào hộp thư subscriber, kể cả khi
đây là bài `post` và là lần Publish đầu tiên. Bài nào ngoài Deals mà bạn muốn
gửi cho subscriber thì cứ chỉ định bài đó, email sẽ được gửi tay riêng.

Đây là **danh sách cho phép**, không phải danh sách cấm: gõ một chủ đề mới lạ
vào `Category Vi` thì bài đó im lặng chứ không tự gửi mail. Gửi thiếu thì vào
Kit bấm gửi tay được; gửi thừa cho toàn bộ danh sách thì không rút lại được.
Muốn thêm chủ đề vào danh sách này thì sửa `BROADCAST_CATEGORIES` trong
[src/app/api/revalidate/route.ts](src/app/api/revalidate/route.ts).

Broadcast này (và mọi email khác gửi cho subscriber) giờ gửi từ địa chỉ
**info@ghe1a.com** — Kit yêu cầu địa chỉ gửi phải được thêm + xác minh trong
tài khoản Kit trước, xem bước 1 dưới đây.

**1. Xác minh info@ghe1a.com là địa chỉ gửi trong Kit** — đăng nhập Kit →
**Settings → Sending → Email addresses** (tên mục có thể khác chút tuỳ giao
diện) → **Add email address** → nhập `info@ghe1a.com` → Kit gửi 1 email xác
minh đến hộp thư đó, mở email và bấm xác nhận. Nếu bỏ qua bước này, broadcast
sẽ gửi bằng địa chỉ mặc định của tài khoản Kit thay vì info@ghe1a.com (hoặc
lỗi, tuỳ Kit xử lý).

**2. Tạo API Key mới của Kit (khác với `KIT_API_KEY` đang dùng cho form đăng
ký)** — đăng nhập Kit → **Settings → Developer** → **Add a new key** → đặt
tên bất kỳ (vd "Ghế 1A auto broadcast") → copy lại ngay (chỉ hiện 1 lần).

**3. Thêm biến môi trường cho site live** — vào đúng chỗ bạn đã điền
`CONTENTFUL_SPACE_ID` (hPanel → website → Environment variables), thêm:

| Biến             | Giá trị                                    |
|-------------------|---------------------------------------------|
| `KIT_V4_API_KEY`  | API key vừa tạo ở bước 2                    |

Route này cũng cần `CONTENTFUL_MANAGEMENT_TOKEN` để xác định chính xác "đây có
phải lần Publish đầu tiên" (payload webhook của Contentful không có đủ thông
tin đó) — nếu bạn đã làm phần "Tự động đăng bài khi có video YouTube mới" bên
dưới thì biến này đã có sẵn, dùng lại luôn, không cần tạo thêm. Nếu chưa, tạo
theo hướng dẫn ở mục đó (Content management token, khác Delivery API token).

**4. Không cần tạo webhook mới** — nếu bạn đã làm xong phần "Auto-refresh
site khi bấm Publish" ở trên, webhook đó (`Refresh Ghế 1A site`) đã gửi kèm
đủ dữ liệu bài viết cho route này dùng luôn. Nếu chưa làm phần đó, làm theo
3 bước ở mục phía trên trước (đặc biệt bước 3: tạo webhook, nhớ tick
**Publish**).

**5. Kiểm tra** — viết 1 bài test `type = "post"` trên Contentful, Publish
lần đầu, đợi ~10 giây rồi kiểm tra hộp thư (hoặc vào Kit → Broadcasts xem có
broadcast mới không) — email nhận được phải hiện người gửi là info@ghe1a.com.
Nếu chưa thấy, gửi tôi ảnh log lỗi (Contentful → Settings → Webhooks → chọn
webhook → xem tab hoạt động gần nhất).

## Tự động đăng bài khi có video YouTube mới

Route [`/api/sync-videos`](src/app/api/sync-videos/route.ts) kiểm tra kênh
YouTube **@HoangLeCA**, và nếu thấy video nào chưa có trên site thì tự tạo +
Publish một `blogPost` (type "video") tương ứng — không cần vào Contentful
thêm tay. GitHub Actions ([`.github/workflows/sync-videos.yml`](.github/workflows/sync-videos.yml))
gọi route này mỗi 6 tiếng.

**1. Thêm 2 biến môi trường cho site live** — vào đúng chỗ bạn đã điền
`CONTENTFUL_SPACE_ID` (hPanel → website → Environment variables), thêm:

| Biến                          | Giá trị                                                                 |
|--------------------------------|--------------------------------------------------------------------------|
| `SYNC_VIDEOS_SECRET`           | một chuỗi bất kỳ bạn tự nghĩ ra, để không ai gọi được route này ngoài GitHub Actions |
| `CONTENTFUL_MANAGEMENT_TOKEN`  | Content management token tạo ở app.contentful.com → Settings → API keys → Content management tokens (khác với token Delivery API bạn đã có) |

**2. Thêm 1 secret trên GitHub** — vào repo trên GitHub → **Settings → Secrets
and variables → Actions → New repository secret**:
- Name: `SYNC_VIDEOS_SECRET`
- Value: giống hệt giá trị bạn vừa điền ở bước 1

**3. Kiểm tra** — vào tab **Actions** trên GitHub → chọn workflow
**Sync new YouTube videos to Contentful** → **Run workflow** để chạy thử ngay
thay vì chờ 6 tiếng.

Bài viết tự tạo chỉ có tiêu đề gốc + 1 câu mô tả ngắn chung chung (không phải
Claude Code viết riêng cho từng video như trước) — vào Contentful chỉnh lại
`excerptVi`/`bodyVi`/`categoryVi` nếu muốn, publish lại là xong.

## Hai mục thẻ tín dụng: "Elevated offers" và "Các offers khác"

Trang `/credit-cards` có 2 tab, và thẻ nằm ở tab nào là do **một ô duy nhất**
quyết định — `Elevated Bonus`:

| `Elevated Bonus` | Thẻ hiện ở tab |
|------------------|----------------|
| ✅ bật            | Elevated offers |
| ⬜ tắt            | Các offers khác |

Không cần làm gì thêm, không có trường nào khác phải điền.

## Tự động xử lý thẻ tín dụng / transfer bonus hết hạn

Route [`/api/expire-offers`](src/app/api/expire-offers/route.ts) chạy mỗi ngày
1 lần qua GitHub Actions
([`.github/workflows/expire-offers.yml`](.github/workflows/expire-offers.yml)),
xử lý mọi entry có `Expires At` đã qua:

- **Thẻ tín dụng** — thẻ vẫn còn tồn tại sau khi elevated offer kết thúc, chỉ
  là quay về offer thường. Nên route **không ẩn thẻ đi**: nó tắt `Elevated
  Bonus`, xoá `Expires At`, cập nhật lại rebate FinlyWealth, và thẻ tự chuyển
  sang tab **Các offers khác**.
- **Transfer bonus** — hết là hết, nên vẫn tự **Unpublish** (không xoá). Nếu
  sau này bonus quay lại, chỉ cần sửa `Expires At` rồi Publish lại.

  Phần chữ tiếng Việt (`Welcome Bonus Vi`, `Headline Vi`, `Key Benefits Vi`,
  `Editors Take Vi`) được **trả về bản của offer thường**: route lấy bản copy
  thẻ mang lần cuối trước khi bật `Elevated Bonus` (Contentful lưu một
  snapshot mỗi lần publish), đổi con số rebate trong câu HOT TIP theo
  FinlyWealth, rồi đối chiếu với trang FinlyWealth của thẻ trước khi publish.
  Không có mô hình AI nào viết chữ (từ 05/11/2026; trước đó route nhờ Claude
  viết lại). Chi tiết ở `src/lib/standing-offer.ts`.

> ⚠️ **Thẻ không khôi phục được thì phải sửa tay:** thẻ chưa từng có bản offer
> thường trên site (bật elevated ngay từ lần publish đầu), bản offer thường cũ
> hơn 120 ngày, con số welcome bonus không còn khớp FinlyWealth, copy còn nhắc
> một ngày đã qua, hay thẻ không có trang rebate FinlyWealth (các thẻ Amex®,
> RBC® Avion®). Job không ghi gì, giữ `Expires At`, và đỏ ở mọi lượt kèm lý do
> cho tới khi bạn sửa chữ rồi xoá `Expires At`. Trang vẫn gỡ thẻ khỏi tab
> elevated ngay khi qua hạn (lúc render), nên không cần tắt cờ. Thẻ khôi phục thành
> công nằm trong danh sách `restored` của lần chạy (tab **Actions** trên
> GitHub).

## Tự động kiểm tra rebate FinlyWealth

FinlyWealth đổi số tiền rebate mà không báo trước (thẻ BMO® VIPorter® từng đổi
từ $125 lên $200). Job `check-rebates` chạy hai lượt mỗi ngày, mở trang
FinlyWealth của từng thẻ, đọc số rebate hiện tại rồi ghi đè vào ô `Rebate Vi`
nếu lệch — nên con số hiển thị trên web luôn khớp với số người đọc thực nhận.
Chỉ những thẻ có `Apply Url` trỏ tới trang `/rebates/...` của FinlyWealth mới
được kiểm tra; thẻ dùng link referral riêng của ngân hàng thì job bỏ qua.

Phép so nằm trong [`src/lib/check-rebates.ts`](src/lib/check-rebates.ts), gọi
bằng `npm run job:check-rebates`:

- Theo lịch: [`.github/workflows/check-rebates.yml`](.github/workflows/check-rebates.yml)
  chạy lệnh đó **thẳng trong runner**. Cần các secret trong **environment
  `contentful-write`** (không phải secret cấp repo): `CONTENTFUL_SPACE_ID`,
  `CONTENTFUL_ACCESS_TOKEN` (CDA), `CONTENTFUL_MANAGEMENT_TOKEN` (CMA) và
  `FINLY_API_KEY`.
- Chạy tay: bấm **Run workflow** trên `main`, hoặc chạy cùng lệnh trên máy có
  `.env.local`.

Trước 09/09/2026 workflow gọi route `/api/check-rebates` trên site bằng `curl`.
Bỏ vì edge Hostinger chặn IP của runner GitHub — 403 rồi tới chặn thẳng ở tầng
TCP, mất đều một trong hai lượt mỗi ngày trong khi site vẫn khoẻ (lý do đầy đủ ở
đầu [`scripts/check-rebates.mts`](scripts/check-rebates.mts)). Route đó gỡ hẳn
ngày 09/11/2026: nó chỉ còn là một cửa gọi tay thứ ba cho cùng một việc.

**1. Thêm 1 biến môi trường cho site live** — vào đúng chỗ bạn đã điền
`CONTENTFUL_SPACE_ID` (hPanel → website → Environment variables), thêm:

| Biến                   | Giá trị                                                                 |
|-------------------------|--------------------------------------------------------------------------|
| `EXPIRE_OFFERS_SECRET`  | một chuỗi bất kỳ bạn tự nghĩ ra, để không ai gọi được route dưới đây nếu không có nó |

Secret này che đúng MỘT route: `/api/expire-offers` (GitHub Actions gọi theo
lịch). Hai route từng dùng chung nó, `/api/check-rebates` và
`/api/offer-snapshot`, đã gỡ 09/11/2026 — hai job đó nay chạy thẳng trong runner.

(`CONTENTFUL_MANAGEMENT_TOKEN` đã cần có sẵn từ phần "Tự động đăng bài khi có
video YouTube mới" ở trên — route này dùng lại, không cần thêm.)

**2a. Secret cấp repo** — **Settings → Secrets and variables → Actions → New
repository secret**:

| Secret | Dùng cho | Giá trị |
|---|---|---|
| `EXPIRE_OFFERS_SECRET` | `expire-offers` (gọi route qua HTTP) | giống hệt giá trị bạn vừa điền ở bước 1 |

**2b. Secret của environment `contentful-write`** — **Settings → Environments →
`contentful-write` → Environment secrets**. Environment này đã tạo sẵn và **chỉ
cho phép branch `main`**:

| Secret | Giá trị |
|---|---|
| `CONTENTFUL_SPACE_ID` | giống biến cùng tên trên hPanel |
| `CONTENTFUL_ACCESS_TOKEN` | giống biến cùng tên trên hPanel (token Delivery API) |
| `CONTENTFUL_MANAGEMENT_TOKEN` | giống biến cùng tên trên hPanel (token Content management) |

`check-rebates` cần cả ba, vì từ 09/09/2026 job đó chạy THẲNG TRONG RUNNER thay
vì gọi route qua HTTP. `offer-history` (từ 09/11/2026) chỉ đọc hai biến đầu. Thiếu chúng thì job đỏ ngay ở bước đầu với
câu `Thiếu biến môi trường: …`, không chạy nửa vời.

> **Vì sao là environment chứ không phải secret cấp repo.**
> `CONTENTFUL_MANAGEMENT_TOKEN` là token duy nhất có quyền GHI vào Contentful,
> và repo này PUBLIC. Với secret cấp repo, ai có quyền write chỉ cần đẩy một
> branch sửa `scripts/check-rebates.mts` rồi bấm **Run workflow** vào chính
> branch đó — `workflow_dispatch` nhận branch/tag bất kỳ — và mã tuỳ ý chạy
> với token ghi. Buộc environment theo `main` thì lượt dispatch từ branch lạ
> không đọc được secret nào.
>
> **Giới hạn, nói cho rõ:** cách này KHÔNG ngăn được người đã có quyền write.
> `main` chưa bật branch protection, nên họ push thẳng vào `main` là xong.
> Thứ environment mua được là đóng đường chạy mã với token ghi mà không để
> lại dấu trong lịch sử `main`. Muốn chặn hẳn thì bật branch protection cho
> `main`.
>
> Kiểm 09/09/2026: repo PUBLIC, 1 collaborator, 0 deploy key, 0 webhook,
> `GITHUB_TOKEN` mặc định chỉ đọc, workflow này không có trigger `pull_request`
> (nên fork PR không chạm tới). **Chưa kiểm kê được GitHub Apps** — token hiện
> tại không liệt kê được; nếu sau này cài app có quyền `Actions: write` thì
> xem lại chỗ này.

**3. Kiểm tra** — vào tab **Actions** trên GitHub → chọn workflow **Unpublish
expired credit card offers & transfer bonuses** (hoặc **Check FinlyWealth rebate amounts**) → **Run workflow** để chạy thử
ngay thay vì chờ đến giờ chạy tự động.

## Email chào mừng cho subscriber mới

Route [`/api/subscribe`](src/app/api/subscribe/route.ts) (form đăng ký bản tin
trên trang chủ) giờ làm thêm 1 việc: ngay sau khi đăng ký subscriber mới vào
Kit, nó tự gửi 1 email chào mừng đến đúng subscriber đó (không phải gửi cho cả
danh sách), từ địa chỉ **info@ghe1a.com**, qua dịch vụ **Resend**. Nếu bước
gửi email này lỗi thì việc đăng ký vẫn thành công bình thường (không ảnh hưởng
người dùng) — chỉ ghi log lỗi để bạn kiểm tra sau.

Nội dung email hiện tại (tiêu đề + phần thân, ở đầu `route.ts`) chỉ là placeholder
tạm — gửi nội dung thật cho Claude Code bất cứ lúc nào để thay vào.

**1. Tạo tài khoản Resend** — vào [resend.com](https://resend.com) → đăng ký
miễn phí (gói free đủ dùng cho quy mô site này).

**2. Thêm domain `ghe1a.com` vào Resend** — Resend Dashboard → **Domains** →
**Add Domain** → nhập `ghe1a.com`. Resend sẽ đưa ra vài bản ghi DNS (thường là
2-3 bản ghi loại `TXT`/`CNAME`, dùng để xác minh domain + chống email bị đánh
dấu spam).

**3. Thêm các bản ghi DNS đó trên Hostinger** — hPanel → **Domains** → chọn
`ghe1a.com` → **DNS / Nameservers** → **Manage records** → **Add record**,
điền đúng Type/Name/Value Resend đưa ra ở bước 2 (copy chính xác, không thêm
bớt). Sau vài phút đến vài giờ, quay lại Resend Dashboard bấm **Verify** —
domain sẽ chuyển sang trạng thái "Verified".

**4. Tạo API key** — Resend Dashboard → **API Keys** → **Create API Key** →
đặt tên bất kỳ (vd "Ghế 1A welcome email") → copy lại ngay (chỉ hiện 1 lần).

**5. Thêm biến môi trường cho site live** — vào đúng chỗ bạn đã điền
`CONTENTFUL_SPACE_ID` (hPanel → website → Environment variables), thêm:

| Biến              | Giá trị                        |
|--------------------|---------------------------------|
| `RESEND_API_KEY`  | API key vừa tạo ở bước 4        |

**6. Kiểm tra** — đăng ký thử 1 email bất kỳ ở form trên trang chủ, kiểm tra
hộp thư trong vài giây. Nếu chưa thấy, kiểm tra domain đã "Verified" ở bước 3
chưa, và xem log lỗi ở Resend Dashboard → **Logs**.

Domain chưa verify xong ở Resend thì bước gửi email sẽ lỗi (subscriber vẫn
đăng ký bình thường) — verify xong mới gửi được.

## Bình luận dưới bài viết/video — ĐÃ GỠ (03/10/2026)

Site từng có khung bình luận Cusdis ở cuối mỗi bài. Từ trước 26/09/2026 máy chủ
của Cusdis không phục vụ file nhúng nữa (lỗi 521), nên khung chỉ còn là một vùng
trống ở mọi bài. Ngày 03/10/2026 khung đã được gỡ khỏi site.

Biến `NEXT_PUBLIC_CUSDIS_APP_ID` trong hPanel → Environment variables không còn
được dùng — xoá đi cũng được, để nguyên cũng không sao.
