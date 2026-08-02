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
| headlineVi     | Long text                     |
| headlineEn     | Long text                     |
| editorsTakeVi  | Long text                     |
| editorsTakeEn  | Long text                     |
| keyBenefitsVi  | Short text, list              |
| keyBenefitsEn  | Short text, list              |
| elevatedBonus  | Boolean                       |
| expiresAt      | Date & time, optional — offer/bonus expiry date, shown next to the badges when set |
| applyUrl       | Short text                    |

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
- URL: `https://ghe1a.com/api/revalidate?secret=<giá trị REVALIDATE_SECRET ở bước 2>`
- Giữ method mặc định (POST)
- Triggers: chọn **Select specific triggering events** → tick ít nhất **Publish**
  (tick thêm Unpublish/Delete nếu muốn site cũng tự cập nhật khi bạn gỡ bài)
- Save

**4. Kiểm tra** — Publish thử 1 entry bất kỳ, đợi ~10 giây rồi mở lại `ghe1a.com`
(F5 mạnh / Ctrl+Shift+R) — nội dung phải lên ngay, không cần vào Hostinger bấm
Clear cache nữa.

Nếu 4 biến môi trường trên chưa được điền, route vẫn chạy bình thường (không lỗi)
nhưng chỉ làm mới cache của Next.js chứ không xoá được cache CDN Hostinger — bạn
vẫn cần bấm Clear cache thủ công như trước.
