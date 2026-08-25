# Contentful content model

Khi bạn tạo Contentful Space, tạo 4 Content Type sau với đúng Field ID (chữ thường,
camelCase) để khớp với code trong `src/lib/content/contentful.ts`. Sau khi có
**Space ID** và một **Content Delivery API access token**, điền vào `.env.local`
(copy từ `.env.example`) — site sẽ tự chuyển từ nội dung mẫu sang Contentful.

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

## `author`

| Field ID | Type        |
|----------|-------------|
| name     | Short text  |
| photo    | Media (image) |
| bioVi    | Long text   |
| bioEn    | Long text   |

Cho tới khi bạn cấu hình xong, site chạy với nội dung mẫu ở `content/sample/*.json`
— chỉnh sửa trực tiếp các file này để thay nội dung demo bằng nội dung thật nhanh
hơn nếu bạn muốn bắt đầu với Markdown/JSON thay vì Contentful.

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
> giấu luôn giá trị đó trong giao diện của nó. Route vẫn nhận được cả hai
> kiểu (xem [src/lib/job-auth.ts](src/lib/job-auth.ts)) nên webhook cũ không
> gãy — nhưng cách đúng để tạo mới là Header.

**4. Kiểm tra** — Publish thử 1 entry bất kỳ, đợi ~10 giây rồi mở lại `ghe1a.com`
(F5 mạnh / Ctrl+Shift+R) — nội dung phải lên ngay, không cần vào Hostinger bấm
Clear cache nữa.

Nếu 4 biến môi trường trên chưa được điền, route vẫn chạy bình thường (không lỗi)
nhưng chỉ làm mới cache của Next.js chứ không xoá được cache CDN Hostinger — bạn
vẫn cần bấm Clear cache thủ công như trước.

## Tự động gửi email cho subscriber khi có bài viết mới (không gồm video và Deals)

Route `/api/revalidate` ở trên giờ làm thêm 1 việc: mỗi khi 1 `blogPost` với
`type = "post"` (bài viết thường, **không phải video**) được Publish **lần
đầu tiên**, nó tự gửi 1 email broadcast qua Kit đến toàn bộ danh sách
subscriber, gồm tiêu đề + đoạn mô tả ngắn + link đến bài viết, trình bày theo
đúng thiết kế (nền kem, card trắng, logo + "Ghế 1A", nút bấm pill) như email
chào mừng subscriber mới — cả 2 dùng chung 1 template ở
[src/lib/subscriber-email.ts](src/lib/subscriber-email.ts). Sửa bài đã đăng
và Publish lại sẽ **không** gửi lại email (chỉ gửi ở lần Publish đầu).

**Ngoại lệ `Deals` và `News`:** nếu ô `Category Vi` của bài viết là `Deals`
(transfer bonus, deal mua points, v.v.) hoặc `News` (tin ngắn phản ứng lại
thông báo của chương trình khác) thì email **sẽ không gửi**, kể cả khi đây là
bài `post` và là lần Publish đầu tiên — deal thì ngắn hạn và hết hạn nhanh,
còn tin thì lên site là đủ, không đáng gửi broadcast riêng cho từng cái. Chỉ
cần gõ đúng một trong hai chữ đó vào `Category Vi` (không phân biệt hoa/thường)
là được, không cần cấu hình gì thêm.

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

## Hai mục thẻ tín dụng: "Offers nổi bật" và "Các offers khác"

Trang `/credit-cards` có 2 tab, và thẻ nằm ở tab nào là do **một ô duy nhất**
quyết định — `Elevated Bonus`:

| `Elevated Bonus` | Thẻ hiện ở tab |
|------------------|----------------|
| ✅ bật            | Offers nổi bật |
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

  Phần chữ tiếng Việt (`Headline Vi`, `Key Benefits Vi`, `Editors Take Vi`)
  cũng được **viết lại theo offer mới**: route đọc phần "How to earn the
  welcome bonus" trên trang FinlyWealth của thẻ rồi nhờ Claude viết lại bằng
  tiếng Việt, đúng quy ước của site (dấu phẩy ngăn cách hàng nghìn, $ là CAD,
  giữ tiếng Anh các thuật ngữ, có ký hiệu ®/™, kết bằng dòng HOT TIP nếu thẻ
  có rebate).

**Cần thêm 1 biến môi trường cho phần viết lại bonus** — vào hPanel →
website → Environment variables, thêm `ANTHROPIC_API_KEY` (lấy ở
console.anthropic.com). Nếu chưa có biến này, mọi thứ khác vẫn chạy bình
thường, chỉ riêng phần viết lại lời văn là bỏ qua.

> ⚠️ **Vẫn nên soát lại:** thẻ nào không viết lại được (FinlyWealth đổi cấu
> trúc trang, thiếu API key, mạng lỗi...) sẽ nằm trong danh sách `needsReview`
> kèm lý do; thẻ viết lại thành công nằm trong `bonusRewritten`. Vào tab
> **Actions** trên GitHub, mở lần chạy gần nhất là thấy cả hai danh sách. Máy
> viết đúng số liệu FinlyWealth công bố, nhưng bạn nên đọc lại lời văn một
> lượt trước khi yên tâm.

## Tự động kiểm tra rebate FinlyWealth

FinlyWealth đổi số tiền rebate mà không báo trước (thẻ BMO® VIPorter® từng đổi
từ $125 lên $200). Route
[`/api/check-rebates`](src/app/api/check-rebates/route.ts) chạy mỗi ngày, mở
trang FinlyWealth của từng thẻ, đọc số rebate hiện tại rồi ghi đè vào ô
`Rebate Vi` nếu lệch — nên con số hiển thị trên web luôn khớp với số người đọc
thực nhận. Chỉ những thẻ có `Apply Url` trỏ tới trang `/rebates/...` của
FinlyWealth mới được kiểm tra; thẻ dùng link referral riêng của ngân hàng thì
route bỏ qua.

Workflow: [`.github/workflows/check-rebates.yml`](.github/workflows/check-rebates.yml).
Dùng chung `EXPIRE_OFFERS_SECRET` bên dưới, không cần thêm biến mới.

**1. Thêm 1 biến môi trường cho site live** — vào đúng chỗ bạn đã điền
`CONTENTFUL_SPACE_ID` (hPanel → website → Environment variables), thêm:

| Biến                   | Giá trị                                                                 |
|-------------------------|--------------------------------------------------------------------------|
| `EXPIRE_OFFERS_SECRET`  | một chuỗi bất kỳ bạn tự nghĩ ra, để không ai gọi được route này ngoài GitHub Actions |

(`CONTENTFUL_MANAGEMENT_TOKEN` đã cần có sẵn từ phần "Tự động đăng bài khi có
video YouTube mới" ở trên — route này dùng lại, không cần thêm.)

**2. Thêm 1 secret trên GitHub** — vào repo trên GitHub → **Settings → Secrets
and variables → Actions → New repository secret**:
- Name: `EXPIRE_OFFERS_SECRET`
- Value: giống hệt giá trị bạn vừa điền ở bước 1

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

## Bình luận dưới bài viết/video (Cusdis)

Mỗi trang bài viết và video (`/blog/[slug]`) giờ có sẵn khung bình luận ở cuối
bài, dùng dịch vụ miễn phí **Cusdis**. Chưa cấu hình gì thì khung này tự ẩn đi
(không lỗi, không hiện gì cả) — cần làm theo các bước dưới đây để bật:

**1. Tạo tài khoản Cusdis** — vào [cusdis.com](https://cusdis.com) → đăng ký
miễn phí.

**2. Tạo project mới** — Dashboard → **Create Website** (hoặc tương đương) →
đặt tên (vd "Ghế 1A") → điền domain `ghe1a.com`.

**3. Lấy App ID** — sau khi tạo xong, project sẽ có 1 **App ID** (chuỗi ký tự
dài) hiện ngay trên trang cài đặt/embed code của project đó — copy lại.

**4. Thêm biến môi trường cho site live** — vào đúng chỗ bạn đã điền
`CONTENTFUL_SPACE_ID` (hPanel → website → Environment variables), thêm:

| Biến                          | Giá trị                  |
|--------------------------------|---------------------------|
| `NEXT_PUBLIC_CUSDIS_APP_ID`   | App ID vừa copy ở bước 3  |

**5. Kiểm tra** — mở thử 1 bài viết bất kỳ trên site live, cuộn xuống cuối bài
sẽ thấy khung bình luận.

Bình luận mới cần bạn duyệt trước khi hiện công khai — vào Cusdis Dashboard →
project của bạn → **Moderation** để duyệt/xoá.
