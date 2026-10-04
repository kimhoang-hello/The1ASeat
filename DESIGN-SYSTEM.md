# Design System — Ghế 1A

Tài liệu này mô tả **hệ thống thiết kế đang chạy thật** của ghe1a.com: màu, chữ,
khoảng cách, bo góc, chuyển động và đặc tả từng thành phần giao diện.

Mục đích: mỗi lần thêm một trang, một khối hay một nút mới, không phải nghĩ lại
từ đầu — tra bảng, dùng lại token có sẵn, và trang mới tự động trông giống phần
còn lại của site.

> **Nguồn sự thật duy nhất là [`src/app/globals.css`](src/app/globals.css).**
> Tài liệu này mô tả file đó, không thay thế nó. Đổi màu/bo góc thì sửa
> `globals.css` rồi cập nhật bảng ở đây — không tạo thêm file token JSON song
> song, vì hai nguồn sẽ lệch nhau trong vài tuần.

---

## 1. Nguyên tắc thiết kế

| Nguyên tắc | Nghĩa là gì trong code |
|---|---|
| **Editorial, không phải fintech** | Nền kem (`#FAF6EC`) chứ không phải trắng; chữ tiêu đề đậm; ảnh lớn. Site đọc như một tạp chí du lịch, không như một trang so sánh thẻ. |
| **Navy là màu của hành động** | Navy `#0F2A4A` chỉ dùng cho: link, nút chính, mục nav đang mở, nhãn chuyên mục. Không dùng navy để trang trí — nếu một thứ màu navy, người đọc phải bấm được vào nó hoặc nó phải đang nói "bạn đang ở đây". |
| **Ba màu trạng thái, mỗi màu một nghĩa** | `success` (xanh) = có lợi / chắc chắn: offer nâng, rebate, HOT TIP, chart có công bố, surcharge thấp. `warning` (hổ phách) = cần chú ý: hạn chót, chưa công bố, bản nháp, Beta. `destructive` (đỏ) = bất lợi / lỗi. Nhãn chỉ là TÊN (nguồn điểm Amex®/RBC®) thì luôn trung tính. Xem 3.2. |
| **Một nền, một bề mặt** | Nền kem cho trang, trắng cho thẻ/panel. Không dải nền xen kẽ (kẻ sọc), không hộp lồng hộp trong một ô thẻ (chốt 03/10/2026). Tách khối bằng khoảng trắng và đường kẻ `border-border`. |
| **Một thứ, một chỗ** | Nút "Đăng ký ngay" nằm trong `ApplyButton`, hộp HOT TIP nằm trong `HotTip`, thẻ bài viết nằm trong `PostCard`. Không copy class ra chỗ khác — sửa component gốc. |
| **Không hex thô trong component** | Luôn dùng `bg-primary`, `text-muted-foreground`… Nếu cần một màu chưa có token, thêm token vào `globals.css` trước. |

---

## 2. Kiến trúc token

Hệ thống chuẩn có ba lớp: **primitive → semantic → component**.

```
Primitive (giá trị thô)      #0F2A4A
        ↓
Semantic (theo mục đích)     --primary
        ↓
Component (theo thành phần)  --button-bg
```

**Ghế 1A hiện dùng 2 lớp**, và như vậy là đúng với quy mô hiện tại:

| Lớp | Trạng thái | Nằm ở đâu |
|---|---|---|
| Primitive | *Chưa tách riêng* — hex nằm thẳng trong biến semantic | `:root` trong `globals.css` |
| **Semantic** | ✅ Đầy đủ | `:root` trong `globals.css` |
| **Cầu nối Tailwind** | ✅ Đầy đủ | khối `@theme inline` — biến `--primary` thành class `bg-primary` |
| Component | *Chưa có* — dùng utility class của Tailwind trực tiếp | trong từng file `.tsx` |

Site chỉ có **một theme sáng**, không có dark mode (0 class `dark:` trong toàn
bộ `src/`). Vì chỉ một theme nên tách lớp primitive lúc này chưa mang lại gì —
xem [phần 11](#11-khoảng-trống-đã-biết) nếu sau này cần theme thứ hai.

### Cách một màu đi từ CSS ra màn hình

```css
/* 1. globals.css — khai báo semantic */
:root { --primary: #0f2a4a; }

/* 2. globals.css — nối vào Tailwind 4 */
@theme inline { --color-primary: var(--primary); }
```
```tsx
/* 3. component — dùng class, không bao giờ dùng hex */
<a className="bg-primary text-primary-foreground">Đăng ký ngay</a>
```

---

## 3. Màu

### 3.1 Token nền tảng (từ `globals.css`)

| Token | Class Tailwind | Hex | Dùng cho |
|---|---|---|---|
| `--background` | `bg-background` | `#FAF6EC` | Nền kem của toàn site |
| `--foreground` | `text-foreground` | `#1A1613` | Chữ chính (đen ngả nâu, không phải đen tuyền) |
| `--card` | `bg-card` | `#FFFFFF` | Nền thẻ/panel nổi trên nền kem |
| `--card-foreground` | `text-card-foreground` | `#1A1613` | Chữ trong thẻ |
| `--primary` | `bg-primary` / `text-primary` | `#0F2A4A` | Navy — link, nút chính, nhãn chuyên mục |
| `--primary-hover` | `hover:bg-primary-hover` | `#123A63` | Navy sáng hơn khi rê chuột |
| `--primary-foreground` | `text-primary-foreground` | `#FFFFFF` | Chữ trên nền navy |
| `--secondary` | `bg-secondary` | `#F1E9D8` | Kem đậm — nền hover, badge, chip, ô tỷ lệ trung tính. KHÔNG làm nền cả một section hay một hộp trong ô thẻ (bỏ 03/10/2026) |
| `--secondary-foreground` | `text-secondary-foreground` | `#1A1613` | Chữ trên nền kem đậm |
| `--muted` | `bg-muted` | `#EFE6D3` | Nền chờ ảnh, vùng trung tính |
| `--muted-foreground` | `text-muted-foreground` | `#6B6259` | Chữ phụ: ngày tháng, mô tả, chú thích |
| `--border` | `border-border` | `#E5DAC3` | **Mọi** đường viền và đường kẻ ngang |
| `--success` / `--success-soft` | `text-success` / `bg-success-soft` | `#1F6F43` / `#E7F2EA` | Có lợi, chắc chắn (xem 3.2) |
| `--warning` / `--warning-soft` | `text-warning` / `bg-warning-soft` | `#8A5A10` / `#FDF1D8` | Cần chú ý (xem 3.2) |
| `--destructive` / `--destructive-soft` | `text-destructive` / `bg-destructive-soft` | `#A3352B` / `#F8E4E1` | Lỗi form, bất lợi |
| `--destructive-foreground` | `text-destructive-foreground` | `#FFFFFF` | Chữ trên nền lỗi |
| `--navy-ink` | `bg-navy-ink` | `#0B2036` | Navy đậm hơn primary — chỉ dùng cho footer và khối CTA tối |

### 3.2 Màu trạng thái (token, từ 03/10/2026)

Trước 03/10/2026 site có HAI bộ màu cho cùng một nghĩa: emerald/amber của
Tailwind ở trang thẻ, và bộ hex tự đặt (`#1f6f43`, `#8a5a10`, `#a3352b`) ở công
cụ award — còn chip TÊN nguồn điểm RBC® mang đúng màu "chưa công bố". Nay là ba
token trong `globals.css`, mỗi token một nghĩa. Bộ hex của công cụ award được
giữ làm giá trị vì tương phản cao hơn (5.36 và 5.28 trên nền nhạt của chính nó,
so với 4.84 và 4.65 của emerald-700/amber-700) và hợp tông kem hơn.

| Nghĩa | Class | Xuất hiện ở |
|---|---|---|
| **Có lợi / chắc chắn** | `bg-success-soft` + `text-success` | badge "+ Elevated offer", `RebateChip`, `HotTip`, "Hãng công bố chart", surcharge thấp, tick thành công |
| **Cần chú ý** | `text-warning` (nền `bg-warning-soft`, viền `border-warning/30`) | ngày hết hạn, "Không tra trước được", surcharge trung bình, dải Beta/nháp |
| **Bất lợi / lỗi** | `text-destructive` (nền `bg-destructive-soft`) | lỗi form, surcharge cao |
| **Tên, không đánh giá** | `bg-secondary` + `text-foreground` | chip nguồn điểm Amex® MR / RBC® Avion®, ô tỷ lệ ở `/transfer-partners` |

Ngoại lệ duy nhất còn palette Tailwind: `text-red-300` cho câu lỗi của form bản
tin trên nền navy (token đỏ là cho nền sáng).

### 3.3 Màu chữ theo độ mờ

Site dùng `text-foreground/xx` để tạo bậc thứ tự thay vì thêm token mới:

| Class | Dùng cho |
|---|---|
| `text-foreground` | Tiêu đề, chữ chính |
| `text-foreground/90` | Mục menu mobile không active |
| `text-foreground/80` | Nhãn form, chữ thân dài |
| `text-foreground/70` | Nhãn badge phụ |
| `text-foreground/65` | Mục nav desktop **không** active |
| `text-white/70` | Chữ trong footer |

### 3.4 Độ tương phản (đã tính, chuẩn WCAG AA = 4.5:1)

| Cặp màu | Tỉ lệ | Kết quả |
|---|---|---|
| `#1A1613` trên `#FAF6EC` | ~16:1 | ✅ Rất tốt |
| `#0F2A4A` trên `#FAF6EC` | ~12:1 | ✅ Rất tốt |
| `#6B6259` trên `#FAF6EC` (chữ phụ) | 5.5:1 | ✅ Đạt |
| `text-foreground/65` trên `#FAF6EC` (nav idle) | 5.45:1 | ✅ Đạt (`/55` cũ chỉ 3.9:1) |

Mục nav không-active mờ có chủ đích: mục đang mở phải là thứ sáng nhất trong
hàng — nhờ navy, chữ đậm và gạch chân, không nhờ bậc mờ này.

---

## 4. Chữ

### 4.1 Một font: Be Vietnam Pro (từ 03/10/2026)

| Vai trò | Font | Biến CSS | Class | Weight nạp |
|---|---|---|---|---|
| Tiêu đề | **Be Vietnam Pro** | `--font-heading` (trỏ về `--font-body`) | `font-display` | 700 |
| Thân bài, nhãn, nút | **Be Vietnam Pro** | `--font-body` | mặc định | 400, 500, 600 |

Thay cặp Plus Jakarta Sans + Inter sau audit UX/UI 03/10/2026, theo lựa chọn của
tác giả: một họ gọn hơn hai, và Be Vietnam Pro (Lâm Bảo, Tony Le, ViệtAnh
Nguyễn, OFL) vẽ dấu tiếng Việt theo dạng thích ứng thay vì gắn thêm vào chữ
Latin. Tự host bốn file tĩnh trong `src/app/fonts/` (67 KB), cắt về đúng
unicode-range `latin` + `vietnamese` của Google — cách dựng ghi trong
`src/app/layout.tsx`. `font-extrabold` không có file riêng và hiện bằng 700; đừng
dùng nó cho chữ mới. Ảnh OG (`app/opengraph-image.tsx`) dùng cùng họ font, cắt về
đúng các ký tự của tên site + tagline trong `assets/og-*.woff`.

### 4.2 Thang chữ

| Cấp | Class | Kích thước | Ghi chú |
|---|---|---|---|
| H1 hero (trang chủ) | `font-display text-4xl font-bold sm:text-5xl 2xl:text-6xl` | 36 → 48 → 60px | Chỉ dùng một lần, trên trang chủ |
| H1 trang | `font-display text-3xl font-bold sm:text-4xl` | 30 → 36px | Chuẩn của `PageHeader` |
| H1 bài viết | `font-display text-3xl font-bold sm:text-4xl lg:text-[2.75rem]` | 30 → 36 → 44px | Trang đọc: tiêu đề phải lớn hơn hẳn thân bài 18px |
| H2 khối lớn | `font-display text-2xl font-bold sm:text-3xl xl:text-4xl` | 24 → 30 → 36px | Đầu mỗi section trang chủ |
| H2 thường | `font-display text-xl font-bold` | 20px | Trong bài viết, trong panel |
| H3 | `font-display text-lg font-bold` | 18px | |
| Tiêu đề thẻ | `font-display text-base font-bold leading-snug` | 16px | `PostCard` |
| Thân bài | `text-base leading-relaxed` | 16px | |
| Phụ | `text-sm` | 14px | Mô tả, chữ trong nút |
| Chú thích | `text-xs` | 12px | Ngày, badge, nhãn — và là **sàn** cho mọi chữ mang dữ liệu |
| Vi nhãn | `text-[11px]` | 11px | CHỈ badge/chip ngắn trên nền màu (tag thẻ, loại tài khoản, VIDEO, surcharge) |

Quy tắc: **mọi tiêu đề đều có `font-display`**. Chữ không phải tiêu đề không bao
giờ dùng `font-display`. Tiêu đề **đậm 700, không giãn chữ âm** (`tracking-tight`
đã bỏ), và **viết hoa đầu câu** — "Thẻ tín dụng đáng chú ý", không phải "Thẻ Tín
Dụng Đáng Chú Ý"; tên riêng, thương hiệu và tên công cụ (Award Flight Finder,
Transfer Partners) giữ nguyên. Giãn dòng của `text-2xl` → `text-6xl` đặt ở
`@theme` (1.3 → 1.18) vì chữ hoa tiếng Việt chồng dấu trên lẫn dưới.

**Sàn 12px cho chữ dữ liệu** (03/10/2026): tên hãng, số miles, đơn vị điểm, ghi
chú dưới con số — thứ người đọc cần đọc để quyết định — không nhỏ hơn
`text-xs`. `text-[11px]` chỉ còn cho viên badge viết hoa trên nền màu, và
`text-[10px]` đã bỏ hẳn. PRODUCT.md: có độc giả lớn tuổi, đọc chủ yếu trên điện thoại.

### 4.3 Nhãn viết hoa — chỉ còn cho nhãn có việc riêng

Từ 03/10/2026 **không còn eyebrow** (nhãn nhỏ viết hoa nằm trên tiêu đề) ở
`PageHeader` và các khối trang chủ: nó chỉ nhắc lại tên mục mà menu đã sáng, và
thêm một tầng chữ nhỏ viết hoa khó đọc với độc giả lớn tuổi. Trang sâu dùng
`Breadcrumbs` (`components/ui/breadcrumbs.tsx`) — vừa nói vị trí vừa bấm được.

Mẫu `text-xs font-semibold uppercase tracking-wide` chỉ còn cho: chuyên mục trên
thẻ bài viết, nhãn HOT TIP, `RebateChip`, badge VIDEO/Beta, tiêu đề cột bảng.

Mọi nhãn khác viết thường đầu câu, `text-sm` (04/10/2026): nhãn nhóm lọc
("Điểm thưởng", "Chuyên mục", "Ngân hàng" — `font-medium text-muted-foreground`),
nhãn mục con trong công cụ ("Các lựa chọn hành trình", "Chuyển điểm từ"), tiêu đề
mục lục, "Bước n" ở trang Bắt đầu, nhãn cặp gợi ý ở hai trang so sánh. Nhãn không
bấm được thì không dùng navy — navy là màu của hành động.

### 4.4 Cỡ chữ gốc tự giãn theo màn hình

```css
@media (width >= 120rem) { :root { font-size: 17px; } }
@media (width >= 150rem) { :root { font-size: 18px; } }
```

Vì mọi thứ đo bằng `rem`, nâng cỡ gốc sẽ kéo cả chữ, khoảng cách và nút to lên
cùng lúc trên màn hình rất rộng. **Hệ quả: không đo kích thước bằng `px` cứng
trong component mới** — nếu không, nó sẽ không giãn cùng phần còn lại.

---

## 5. Khoảng cách & bố cục

### 5.1 Bề ngang trang

```css
.max-w-page { max-width: 72rem; }
@media (width >= 80rem) { .max-w-page { max-width: min(94vw, 110rem); } }
```

`max-w-page` là bề ngang chung của **mọi** section full-width. Giữ ở 72rem (bề
ngang đọc thoải mái), rồi bám theo viewport trên màn hình lớn thay vì nằm im
trong một dải hẹp.

| Ngữ cảnh | Bề ngang |
|---|---|
| Section thường | `mx-auto max-w-page` |
| Bài viết (một cột chữ) | `max-w-2xl`, nới `xl:max-w-[68rem]` khi có mục lục |
| Trang chi tiết một mục (thẻ, tài khoản) | `max-w-3xl` |
| Đoạn dẫn dưới tiêu đề | `max-w-2xl` |
| Header & footer | không giới hạn — tràn hết bề ngang |

### 5.1.1 Bề ngang thêm ra KHÔNG dùng để kéo dài dòng chữ

Cột chữ 42rem ở cỡ 16px đã là **75 ký tự một dòng** — kịch trần khoảng dễ đọc,
và tiếng Việt có dấu còn nặng hơn tiếng Anh ở khoảng này. Nên khi một trang
đọc được nới rộng, phần rộng thêm phải đựng thứ khác: ảnh cover, mục lục dính
bên phải, các khối "đi tiếp" cuối trang. Cột chữ vẫn 42rem, chỉ chữ to lên
(`xl:prose-lg`, 18px) để khối chữ chiếm nhiều chỗ hơn mà số ký tự trên dòng
đứng yên.

Hệ quả cho `/blog/[slug]`: khung chỉ nới **khi bài có từ 2 `h2` trở lên** (có
mục lục để lấp cột phải). Bài không có đầu mục — review khách sạn, video — giữ
nguyên 42rem ở mọi bề ngang.

### 5.1.2 `PageHeader` luôn `max-w-page`

Dải tiêu đề KHÔNG có prop đổi bề ngang. Tên trang phải bắt đầu ở cùng một mép
trái trên mọi trang của site — đó là thứ người dùng thấy khi bấm qua lại giữa
các mục, và nó thắng việc khớp mép với thân trang bên dưới.

Đã thử hướng ngược lại ngày 08/09/2026 (mỗi trang tự khai bề ngang cho khớp
thân trang) và đã bỏ trong cùng ngày: thân trang hẹp thì canh giữa, nên dải
tiêu đề khớp theo cũng thành canh giữa, và tên các trang trong mục Miles &
Points nhảy vào giữa màn hình trong khi mọi trang khác vẫn nằm sát trái.

Trang nào thấy chật thì cách sửa là **nới thân trang cho lấp hết `max-w-page`**
— như `/credit-cards/tot-nhat` làm với lưới 2×2 — chứ không phải bóp dải tiêu
đề lại cho vừa thân trang.

### 5.2 Nhịp dọc của section

| Loại section | Class |
|---|---|
| Chuẩn | `px-4 py-12 sm:px-6 lg:px-8` |
| Nhấn mạnh (có nền riêng) | `px-4 py-16 sm:px-6 lg:px-8` |
| Hero | `px-4 py-20 sm:px-6 lg:px-8 2xl:py-28` |
| Trang trắng (404, cảm ơn) | `py-24 text-center` |

Padding ngang **luôn** là `px-4 sm:px-6 lg:px-8`. Không tự nghĩ ra bộ khác.

### 5.3 Khoảng cách bên trong

| Chỗ | Giá trị |
|---|---|
| Padding trong thẻ | `p-5` (thẻ bài viết), `p-5 sm:p-6` (panel công cụ), `p-4` (thẻ nhỏ), `p-4 sm:p-5` (dòng gọn trong danh sách) |
| Hàng badge / icon + chữ | `gap-2` |
| Hàng có icon lớn | `gap-3` |
| Lưới thẻ | `gap-5`; danh sách dòng gọn `gap-4 xl:gap-5` |
| Sau tiêu đề | `mb-3` (breadcrumb → H1), `mt-2`, `mt-3` (H1 → đoạn dẫn) |

### 5.4 Trên điện thoại (đo 03/10/2026 ở 320, 375 và 375×812 cảm ứng)

| Luật | Vì sao | Cách làm |
|---|---|---|
| **Vùng chạm 44px** cho nút/link đứng cạnh một thứ bấm được khác | Độc giả lớn tuổi; chạm hụt "Xem chi tiết" là bấm nhầm nút Apply ngay cạnh | Không muốn đổi bố cục thì nới bằng `::before` (`relative before:absolute before:inset-x-0 before:-inset-y-3 before:content-['']`) — nhưng KHÔNG nới cả hai thứ kề nhau theo cách đó: hàng gãy dòng ở 320px là hai vùng ảo chồng lên nhau. Một bên nới ảo, bên kia cao thật (`py-3`). Link xếp hàng (footer) thì `py-2.5`. Chip lọc `pointer-coarse:py-2` (38px). |
| **Khung `overflow-x-auto` phải `relative`** | `sr-only` trong ô bảng là `position: absolute`; khung không định vị thì không cắt được chúng, và cả trang kéo ngang được (đo: 204px ở 320px) | Thêm `relative` vào chính khung cuộn. |
| **Panel thả xuống từ khối dính phải tự cuộn** | Phần nào của khối `sticky` thò khỏi mép dưới màn hình thì không cuộn tới được | Panel nằm trong luồng (menu mobile): khối dính là cột flex `max-h-dvh`, panel `min-h-0 overflow-y-auto overscroll-contain` — CSS tự đúng khi dải offer đổi chiều cao. Panel `absolute` (kết quả tìm kiếm) không ăn trần đó: đo `innerHeight − top` bằng JS, nghe `resize` + `ResizeObserver` trên khối dính. |
| **Phần tử dính trong thân trang dùng `top-chrome`**, không tự đặt `top-*` | Khối dính desktop cao 113–137px; `top-24` cũ nằm khuất dưới nó | Mục lục: thêm `max-h-[calc(100vh-10rem)] overflow-y-auto` để tự cuộn ở cửa sổ thấp. Khối không nên cuộn bên trong (cột ảnh thẻ + nút Apply): chỉ dính khi cửa sổ đủ cao — `xl:tall:sticky` (`@custom-variant tall`, ≥34rem — `rem` trong media query luôn là 16px). |
| **Khung tự cuộn có `scroll-py-2` + đệm đáy** | Tab tới dòng sát mép thì viền focus bị mép khung cắt | Dropdown, menu mobile, kết quả tìm kiếm, mục lục. |
| **Công cụ đọc `useSearchParams`: fallback là chính nó ở trạng thái mặc định** | Fallback ô xám rồi công cụ thật cao vài nghìn px đẩy trang xuống — CLS 0.161 ở `/award-flight-finder`; HTML server cũng rỗng với crawler | `<Suspense fallback={<View selection={DEFAULT} update={() => {}} />}>` như `bank-account-finder` và `award-chart-finder`. |
| **Ghi chú chữ nhỏ (`text-xs`) trong khung rộng: `max-w-prose`** | 12px chạy hết bề ngang 1137px là 133 ký tự/dòng | Disclaimer, ghi chú phí/lãi suất, lời dặn dưới bảng. |
| **Đích `#anchor` dùng `scroll-mt-chrome`**, không tự đặt `scroll-mt-*` | Khối dính cao 113–163px tuỳ dải offer; số tự đặt sẽ lệch khi khối đổi chiều cao | Utility trong `globals.css`: 11rem dưới `sm`, 9rem từ `sm`. Bài viết: `prose-headings:scroll-mt-chrome`. |
| **Khoá hay ẩn phần tử đang giữ focus thì trả focus** | `disabled` hay ẩn một phần tử đang được focus là trình duyệt thả focus về `body` — người dùng bàn phím bị đá về đầu trang | `ComparePicker` trả focus về ô vừa chọn khi điều hướng xong; Esc đóng dropdown nav trả về `summary`, đóng menu mobile trả về nút Menu (04/10/2026). |
| **Dải link có CTA bên phải: xuống dòng dưới `sm`** | Ở 375px CTA giành gần nửa bề ngang, tiêu đề gãy ba dòng | `flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3`. |

---

## 6. Bo góc

```css
--radius: 0.75rem;                        /* 12px */
--radius-lg: var(--radius);               /* 12px  → rounded-lg  */
--radius-md: calc(var(--radius) - .25rem);/*  8px  → rounded-md  */
--radius-sm: calc(var(--radius) - .4rem); /*  5.6px→ rounded-sm  */
```

| Class | Dùng cho |
|---|---|
| `rounded-full` | **Mọi nút và mọi pill** — nút đăng ký, ô email bản tin, badge, chip |
| `rounded-2xl` | Thẻ và panel lớn (thẻ bài viết, panel công cụ) |
| `rounded-xl` | Thẻ nhỏ lồng bên trong |
| `rounded-lg` | Ô nhập form, ô icon trong menu |
| `rounded-md` | Hộp HOT TIP, mục menu mobile, ô logo nhỏ |

Quy tắc rút gọn: **bấm được thì bo tròn hoàn toàn, đọc được thì bo góc mềm.**

---

## 7. Bóng đổ

Site gần như không dùng bóng — độ sâu đến từ viền và nền, không từ bóng.

| Class | Chỗ duy nhất dùng |
|---|---|
| `hover:shadow-md` | `PostCard` khi rê chuột (cùng `transition-shadow`) |
| `shadow-md` | Nút play trên thumbnail video |
| `shadow-sm` | `RebateChip` treo ở mép dưới ảnh thẻ — tách viên pill khỏi ảnh |
| `shadow-lg` | Panel nổi trên nội dung: dropdown header, ô tìm kiếm mở rộng |

Thẻ ở trạng thái nghỉ **không có bóng** — chỉ `border border-border bg-card`.

---

## 8. Chuyển động

| Token | Giá trị | Dùng cho |
|---|---|---|
| `.animate-offer-in` | `offer-in 450ms ease-out` (mờ + trượt xuống 4px) | Dải offer trên header khi đổi thẻ |
| `transition-transform duration-200 ease-out` + `-translate-y-full` | khối dính trượt lên khi cuộn xuống, chỉ dưới `lg`; `motion-reduce:transition-none` | `StickyChrome` |
| `transition-colors` | mặc định Tailwind (150ms) | Nút, link, mục nav |
| `transition-shadow` | mặc định Tailwind | Thẻ bài viết |
| `animate-spin` | mặc định Tailwind | Vòng xoay khi form đang gửi |

Toàn bộ animation phải tôn trọng:

```css
@media (prefers-reduced-motion: reduce) { .animate-offer-in { animation: none; } }
```

**Bất kỳ animation mới nào cũng phải thêm nhánh `prefers-reduced-motion`.**

---

## 9. Icon

Thư viện duy nhất: **[Phosphor Icons](https://phosphoricons.com)**
(`@phosphor-icons/react`), dùng ở 14 component.

| Ngữ cảnh | Cỡ | Weight |
|---|---|---|
| Icon trong menu | 18 (desktop) / 16 (mobile) | `bold` |
| Icon trong nút, chữ | 18–20 | `bold` hoặc `fill` |
| Icon chờ ảnh (placeholder) | 40 | `light` |
| Nút play trên video | 20 | `fill` |

Import từ `@phosphor-icons/react/ssr` trong component server (xem
`media-placeholder.tsx`), từ `@phosphor-icons/react` trong component `"use client"`.

Không thêm thư viện icon thứ hai.

**Cờ quốc gia: `Flag`** ([`src/components/ui/flag.tsx`](src/components/ui/flag.tsx)),
SVG nội tuyến cỡ theo `em`, `aria-hidden`. KHÔNG dùng emoji cờ (🇺🇸 🇨🇦): Chrome và
Edge trên Windows không có font emoji cờ, "🇺🇸 Thẻ Mỹ" hiện thành "US Thẻ Mỹ"
(04/10/2026). Chuỗi trong `messages/vi.json` không mang emoji cờ — component đặt
`<Flag>` cạnh chữ.

---

## 10. Đặc tả thành phần

### 10.1 Nút chính — `ApplyButton`

Nguồn: [`src/components/ui/apply-button.tsx`](src/components/ui/apply-button.tsx)

```tsx
className="inline-block cursor-pointer rounded-full bg-primary px-6 py-3
           text-sm font-semibold text-primary-foreground hover:bg-primary-hover"
```

| Thuộc tính | Mặc định | Hover | Disabled |
|---|---|---|---|
| Nền | `bg-primary` | `bg-primary-hover` | `opacity-70` |
| Chữ | `text-primary-foreground` | như cũ | như cũ |
| Bo góc | `rounded-full` | — | — |
| Padding | `px-6 py-3` | — | — |
| Con trỏ | `cursor-pointer` | — | `cursor-not-allowed` |

**Đây là nút "Đăng ký ngay" duy nhất của site.** Mọi trang (trang chủ, danh
sách thẻ, trang thẻ, danh sách ngân hàng) dùng chung component này — cùng hình
dạng, cùng chữ. Prop `affiliate` **chỉ** đổi thuộc tính `rel`:

- `affiliate={true}` (mặc định) → `rel="sponsored nofollow noopener noreferrer"`
- `affiliate={false}` → `rel="nofollow noopener noreferrer"` — dùng cho link
  không có hoa hồng (tài khoản ngân hàng). Khai báo quan hệ trả tiền không có
  thật cũng là một kiểu nói dối.

### 10.2 Ô nhập form

```tsx
"mt-1.5 w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm
 outline-none pointer-coarse:text-base focus:ring-2 focus:ring-primary"
```

**`pointer-coarse:text-base` là bắt buộc** cho mọi `input`/`select`/`textarea`
nhỏ hơn 16px. Safari trên iPhone tự phóng to CẢ TRANG khi chạm vào ô có chữ
dưới 16px và không tự thu lại — người đọc phải tự véo màn hình để ra. Gắn theo
`pointer: coarse` (máy cảm ứng, kể cả iPhone xoay ngang rộng hơn 640px) chứ
không theo bề ngang, nên desktop vẫn 14px như cũ. Ô đã `text-base` sẵn (ô tìm
kiếm, form bản tin cỡ hero, công cụ Gợi ý thẻ) thì không cần.

| Thuộc tính | Mặc định | Focus | Lỗi |
|---|---|---|---|
| Viền | `border-border` | `ring-2 ring-primary` | giữ viền, chữ lỗi `text-destructive` |
| Nền | `bg-white` | — | — |
| Bo góc | `rounded-lg` | — | — |

Nhãn: `text-sm font-medium text-foreground/80`.
Riêng ô email bản tin dùng `rounded-full` để khớp với nút bên cạnh.

### 10.3 Thẻ bài viết — `PostCard`

| Thuộc tính | Mặc định | Hover |
|---|---|---|
| Khung | `rounded-2xl border border-border bg-card` | `shadow-md` |
| Tiêu đề | `text-foreground` | `text-primary` |
| Ảnh | cao `h-44`, `object-cover` | — |

Thứ tự bên trong: chuyên mục (nhãn hoa navy) → tiêu đề (`font-display text-base
font-bold`) → tóm tắt (`text-sm text-muted-foreground line-clamp-2`) → chân thẻ
(ngày · số phút đọc, `text-xs`).

Prop `headingLevel` cho phép hạ xuống `h3` khi thẻ nằm dưới một `h2` — giữ cấu
trúc heading hợp lệ cho SEO.

Ảnh `alt=""`: tiêu đề nằm ngay dưới trong cùng link, có alt là trình đọc màn hình
đọc tên bài hai lần.

`listOnMobile` (04/10/2026): dưới `sm` thẻ thành một dòng — ảnh `aspect-video w-28`
bên trái, chuyên mục + nhãn Video, tiêu đề, ngày · thời lượng; bỏ tóm tắt. Bật ở
`/blog`, trang chuyên mục và "Bài viết liên quan" (lưới `gap-3 sm:gap-6`); KHÔNG bật
ở carousel trang chủ. `/blog` ở 375px: 22,967 → 9,977px.

Không có ảnh → dùng `MediaPlaceholder` với `tone="navy"`, không để ô trống.

### 10.4 Badge và chip

| Thành phần | Class | Nghĩa |
|---|---|---|
| Ưu đãi cao | `rounded-full bg-success-soft px-2.5 py-0.5 text-xs font-semibold text-success` | Offer đang cao hơn mức thường |
| `RebateChip` | `rounded-full bg-success-soft px-3 py-1 text-sm font-bold uppercase tracking-wide text-success` | Tiền hoàn thêm |
| Loại thẻ | `text-xs font-medium text-muted-foreground` | Trung tính, không có nền |
| Hết hạn | `text-xs font-medium text-warning` | Cần chú ý |
| Badge video | `rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-foreground/70` | Bài này là video |

### 10.5 Hộp HOT TIP — `HotTip`

```tsx
"flex gap-2 rounded-lg bg-success-soft px-3 py-2 leading-relaxed text-foreground"
```

Nền xanh nhạt + nhãn "HOT TIP" `font-bold uppercase tracking-wide text-success`
là dấu hiệu nhận dạng. **Không viền trái dày** (bỏ 03/10/2026, bộ quét thiết kế
gắn cờ kiểu viền này). HOT TIP phải là thứ nổi nhất trong ô thẻ vì nó là đường
nhận tiền rebate — làm phẳng các hộp khác, không làm phẳng hộp này. Prop
`compact` hạ xuống `text-sm`. Dùng chung cho trang thẻ tín dụng và trang tài
khoản ngân hàng.

### 10.6 Đầu trang — `PageHeader`

```tsx
"border-b border-border px-4 pb-8 pt-10 sm:px-6 lg:px-8"
```

Không nền riêng (bỏ dải beige 03/10/2026). Ba tầng: `breadcrumbs` (chỉ trang
sâu — các bậc PHÍA TRÊN trang này, khớp `breadcrumbJsonLd` của trang) → H1
(`text-balance font-display text-3xl font-bold sm:text-4xl`, nhãn Beta đứng
ngay sau) → phụ đề (`mt-3 max-w-2xl text-base text-muted-foreground`). Không còn
prop `eyebrow`.

Trang chi tiết không dùng `PageHeader` (thẻ, tài khoản, thẻ Mỹ, bài viết) mở đầu
bằng `<Breadcrumbs>` ở cùng chỗ, thay cho link "← Xem tất cả…" cũ.

**Mọi trang không phải trang chủ đều mở đầu bằng component này.**

### 10.7 Mục nav — header

| Trạng thái | Desktop | Mobile |
|---|---|---|
| Đang mở | `border-primary font-bold text-primary` | `bg-secondary font-semibold text-primary` |
| Nghỉ | `border-transparent font-medium text-foreground/65` (5.45:1) | `text-foreground/90` |
| Hover | `hover:text-primary` | `hover:bg-secondary` |

Trang đang mở được đánh dấu **ba cách cùng lúc** — navy, đậm hơn, và gạch chân
— vì không cách nào đứng một mình đủ rõ: navy cạnh chữ đen là hai màu tối khó
tách, còn độ đậm thì dễ bỏ sót. Mọi mục đều mang một gạch chân trong suốt
(`border-b-2 border-transparent`) nên không có gì nhảy khi highlight di chuyển.

Sáu mục (03/10/2026): Trang chủ · Thẻ & Ngân hàng · Thẻ Mỹ · Bay về Việt Nam ·
Công cụ · Blog. Dropdown chỉ chứa TRANG, không chứa trạng thái lọc của một trang
(`?type=` là việc của tab ngay đầu danh sách). Chữ mục và nút "Đăng ký bản tin"
`text-[15px] xl:text-base`, `whitespace-nowrap`; lề thanh `px-6 xl:px-10`. Đo ở
1024px: cần 970px trong 1,024px (16px + lề 40px là 1,041px — chữ gãy hai dòng).
**Đổi hay thêm nhãn menu là phải đo lại ở 1024px.**

### 10.8 Dòng menu — `MenuItem`

Icon trong ô vuông + nhãn + một dòng mô tả. Ô icon là navy nhạt (`bg-primary/10
text-primary`) ở trạng thái nghỉ, đảo thành navy đặc (`bg-primary
text-primary-foreground`) khi đang mở — nền kem của hàng hover không nuốt mất nó.

### 10.9 Footer

`border-t border-border bg-navy-ink text-white/70`. Đây là một trong hai chỗ duy
nhất dùng `--navy-ink` (chỗ còn lại là khối CTA tối). Link trong footer:
`hover:text-white`.

### 10.10 Nội dung bài viết (rich text)

```tsx
className="prose prose-neutral mt-8 max-w-none prose-headings:font-display prose-a:text-primary"
```

Dùng plugin `@tailwindcss/typography`. Hai override bắt buộc: tiêu đề phải dùng
`font-display`, link phải là navy. Trang pháp lý thêm `prose-h2:mt-10
prose-h2:text-xl`.

### 10.11 Dòng thẻ gọn — `CardRow`

Nguồn: [`src/components/credit-cards/card-row.tsx`](src/components/credit-cards/card-row.tsx).
Một mẫu cho mọi danh sách thẻ: `/credit-cards`, `/us-credit-cards` (qua
`UsCardSummary`) và bốn thẻ ở trang chủ (03/10/2026); từ 04/10/2026 cả khối thẻ ở
bốn trang "Các thẻ tốt nhất" và giữa thân bài viết (`CardSpotlight` =
`CardRow showHeadline={false}`, tên thẻ `h3` / `p`). Thứ tự: badge (offer nâng,
US, loại thẻ, hạn) → tên → **bonus + annual fee** trên một hàng (hai phần tử flex,
không phải chữ nối tiếp) → ghi chú phí ngay dưới phí → `RebateChip` → headline →
phần riêng của nơi dùng (`children`: tag, điều kiện chi tiêu, HOT TIP) → link
trang thẻ bên trái, `ApplyButton` bên phải.

- Điện thoại: ảnh 80px cạnh tên, phần còn lại chạy hết bề ngang. Từ `sm`: cột ảnh
  144px. Ba hàng `auto 1fr auto` giữ hàng nút ở đáy khi lưới hai cột kéo cao.
- KHÔNG có khối "Quyền lợi chính" trong danh sách — đầy đủ ở trang thẻ.
- Link trang thẻ: "Ghế 1A đánh giá" cho MỌI dòng thẻ Canada (danh sách, trang chủ, Các
  thẻ tốt nhất, giữa thân bài — tác giả chốt 04/10/2026); "Xem chi tiết" cho thẻ Mỹ,
  tài khoản ngân hàng và hai bảng so sánh. Tên thẻ nối vào link và `ApplyButton`
  (`name`) bằng `sr-only`; mũi tên `aria-hidden`.
- Root mang `data-affiliate-self-tracked`: ảnh và nút Apply tự bắn `apply_clicked`,
  `AffiliateClickTracker` trong thân bài bỏ qua chúng.
- Ghi chú phí KHÔNG cắt, dù dài: "miễn phí năm đầu", phí sắp tăng là dữ kiện quyết
  định. Rebate đứng SAU ghi chú phí — chen vào giữa thì ghi chú đọc như điều kiện
  của rebate.

Tài khoản ngân hàng có mẫu RIÊNG (`AccountCard` trong `bank-account-finder.tsx`)
vì quyết định bằng dữ kiện khác: con số chính (bonus / lãi suất / phí) + monthly
fee trên một hàng, rồi ghi chú khuyến mãi lãi suất, cách miễn phí, khối điều kiện
nhận bonus, HOT TIP. Rebate ở góc phải hàng nhãn.

### 10.12 Bộ lọc danh sách — `FilterPanel`

Nguồn: [`src/components/ui/filter-panel.tsx`](src/components/ui/filter-panel.tsx).
Dưới `lg`: một nút "Lọc · Sắp xếp (n)" (n = số bộ lọc khác mặc định, gồm cả thứ tự
sắp xếp) cạnh dòng số kết quả; bảng lọc mở khi bấm. Từ `lg`: bảng lọc luôn mở, nút
ẩn, số kết quả xuống dưới bảng lọc. Dùng ở `/credit-cards` và `/bank-accounts`.
Ô sắp xếp trong bảng `sm:max-w-xs`.

### 10.13 Thông tin nhanh — `CardFacts`

Nguồn: [`src/components/credit-cards/card-facts.tsx`](src/components/credit-cards/card-facts.tsx),
dữ liệu ở [`src/lib/card-facts.ts`](src/lib/card-facts.ts). Bốn dòng — Tích điểm (thẻ
cashback: Hoàn tiền), Điều kiện mở thẻ, Phòng chờ, Bảo hiểm — dạng `<dl>` hai cột từ
`sm` (nhãn 9.5rem), một cột trên điện thoại, kẻ `divide-y` không hộp. Trên trang thẻ:
sau tag, TRƯỚC nhận định. Trong bảng so sánh: cùng các dòng, cùng chữ (qua
`CardFactValue`), đặt sau các hàng ngắn và trước "Quyền lợi chính".

- Dòng rỗng in "Chưa kiểm" bằng `text-muted-foreground`; không bao giờ để trống hay
  in "—" (gạch ngang đọc như "không có").
- Câu giải thích chữ "Chưa kiểm" dưới khối/bảng chỉ in khi có chỗ chưa kiểm
  (`hasUnchecked`: dòng rỗng HOẶC ý mang cờ `unchecked` — "trần: chưa kiểm", "Mọi chi
  tiêu khác: chưa kiểm", "số lượt miễn phí chưa kiểm"). Câu phạm vi Canada luôn in.
- Hàng dài trong bảng so sánh (tích điểm, bảo hiểm, quyền lợi, nhận định) lặp tên
  thẻ đầu ô (`text-xs text-muted-foreground`, `aria-hidden`) — hàng tên ở đầu bảng
  trôi khỏi màn hình, và bảng nằm trong khung cuộn ngang nên không làm nó dính được.

---

## 11. Khoảng trống đã biết

Đây là những chỗ đã kiểm tra và biết là chưa hoàn chỉnh — ghi lại để lần sau
không phải phát hiện lại từ đầu. **Không có mục nào là lỗi đang gây hại; đừng
sửa hàng loạt nếu không có lý do cụ thể.**

1. ~~Tương phản nav 3.9:1~~ — mục nav không active đã là `text-foreground/65`
   (5.45:1), xem 10.7.
2. ~~Màu trạng thái không có token~~ — đã có `--success`, `--warning`,
   `--destructive` (+ `-soft`) từ 03/10/2026, xem 3.2.
3. **Chưa có lớp component token** — mọi thứ dùng utility Tailwind trực tiếp.
   Đúng cho quy mô hiện tại; chỉ cần thêm khi có nhiều biến thể của cùng một
   thành phần.
4. **Chưa có lớp primitive** — hex nằm thẳng trong biến semantic. Nếu sau này
   thêm dark mode thì phải tách lớp này trước (semantic sẽ trỏ vào primitive
   khác nhau theo theme).
5. **Chưa có dark mode** — 0 class `dark:` trong toàn bộ `src/`.

---

## 12. Danh sách kiểm tra khi thêm giao diện mới

- [ ] Không có hex thô nào trong file `.tsx` — chỉ dùng class từ token
- [ ] Mọi tiêu đề có `font-display`; chữ thường thì không
- [ ] Section dùng `px-4 py-12 sm:px-6 lg:px-8` và `mx-auto max-w-page`
- [ ] Nút và pill dùng `rounded-full`; thẻ dùng `rounded-2xl`
- [ ] Mọi viền dùng `border-border` — không có màu viền tùy ý
- [ ] Nút "Đăng ký ngay" dùng `<ApplyButton>`, không viết lại
- [ ] Mẹo kiếm điểm dùng `<HotTip>`, không tự dựng hộp xanh mới
- [ ] Màu trạng thái qua token: `success` có lợi, `warning` cần chú ý, `destructive` bất lợi; tên thì trung tính
- [ ] Không eyebrow trên tiêu đề; trang sâu dùng `Breadcrumbs`; tiêu đề viết hoa đầu câu, đậm 700
- [ ] Không hộp nền kem lồng trong ô thẻ trắng; không dải nền xen kẽ giữa các section
- [ ] Kích thước đo bằng `rem`/class Tailwind, không phải `px` cứng
- [ ] Ô nhập dưới 16px có `pointer-coarse:text-base` (không thì iPhone phóng to cả trang)
- [ ] Chữ mang dữ liệu ≥ `text-xs`; `text-[11px]` chỉ cho badge
- [ ] Khung `overflow-x-auto` có `relative`; panel thả xuống từ khối dính tự cuộn
- [ ] Nút/link đứng cạnh thứ bấm được khác có vùng chạm ≥44px (xem 5.4)
- [ ] Animation mới có nhánh `prefers-reduced-motion`
- [ ] Icon lấy từ Phosphor, đúng cỡ và weight ở [phần 9](#9-icon)
- [ ] Thiếu ảnh thì dùng `<MediaPlaceholder>`, không để ô trống
- [ ] Danh sách dài dùng dòng gọn (`CardRow` / mẫu tài khoản) và `FilterPanel`, không dựng ô thẻ mới
- [ ] Đổi nhãn menu → đo lại hàng nav ở 1024px
- [ ] Đã xem lại ở 375px, 768px, 1024px, 1280px và 1920px

---

## 13. Tài liệu liên quan

| File | Nội dung |
|---|---|
| [`src/app/globals.css`](src/app/globals.css) | Nguồn sự thật của toàn bộ token |
| [`CONTENT-GUIDE.md`](CONTENT-GUIDE.md) | Cách viết và đăng nội dung |
| [`CONTENTFUL.md`](CONTENTFUL.md) | Cấu trúc content type và tự động hóa |
| [`PRODUCT.md`](PRODUCT.md) | Site này dành cho ai và để làm gì |
| [`SEO.md`](SEO.md) | Metadata, structured data, hiệu năng |
