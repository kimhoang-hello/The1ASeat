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
| **Xanh lá = tiền vào túi bạn** | `emerald` chỉ dành cho offer cao hơn bình thường, rebate và HOT TIP. Người đọc học nghĩa của màu xanh ở trang thẻ tín dụng thì sang trang ngân hàng không phải học lại. |
| **Hổ phách = đồng hồ đang chạy** | `amber` chỉ dành cho hạn chót (`Hết hạn 03/09/2026`). Không dùng amber cho gì khác. |
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
| `--secondary` | `bg-secondary` | `#F1E9D8` | Kem đậm — dải phân đoạn, nền hover, badge |
| `--secondary-foreground` | `text-secondary-foreground` | `#1A1613` | Chữ trên nền kem đậm |
| `--muted` | `bg-muted` | `#EFE6D3` | Nền chờ ảnh, vùng trung tính |
| `--muted-foreground` | `text-muted-foreground` | `#6B6259` | Chữ phụ: ngày tháng, mô tả, chú thích |
| `--border` | `border-border` | `#E5DAC3` | **Mọi** đường viền và đường kẻ ngang |
| `--destructive` | `text-destructive` | `#B3261E` | Lỗi form |
| `--destructive-foreground` | `text-destructive-foreground` | `#FFFFFF` | Chữ trên nền lỗi |
| `--navy-ink` | `bg-navy-ink` | `#0B2036` | Navy đậm hơn primary — chỉ dùng cho footer và khối CTA tối |

### 3.2 Màu trạng thái (lấy từ bảng màu mặc định của Tailwind)

Ba màu này **không có trong `globals.css`** — dùng thẳng palette của Tailwind.
Chúng mang nghĩa cố định, không được dùng sai chỗ:

| Nghĩa | Class đang dùng | Xuất hiện ở |
|---|---|---|
| **Ưu đãi cao hơn bình thường / tiền hoàn** | `bg-emerald-100` + `text-emerald-700` | badge "+ Ưu đãi cao", `RebateChip` |
| **Mẹo kiếm thêm điểm** | `bg-emerald-50` + `border-l-4 border-emerald-600` + `text-emerald-950` | `HotTip` |
| **Sắp hết hạn** | `text-amber-700` (viền `border-amber-300`, nền `bg-amber-50`) | ngày hết hạn của offer |
| **Thành công** | `text-emerald-500` | tick sau khi đăng ký bản tin |

### 3.3 Màu chữ theo độ mờ

Site dùng `text-foreground/xx` để tạo bậc thứ tự thay vì thêm token mới:

| Class | Dùng cho |
|---|---|
| `text-foreground` | Tiêu đề, chữ chính |
| `text-foreground/90` | Mục menu mobile không active |
| `text-foreground/80` | Nhãn form, chữ thân dài |
| `text-foreground/70` | Nhãn badge phụ |
| `text-foreground/55` | Mục nav desktop **không** active |
| `text-white/70` | Chữ trong footer |

### 3.4 Độ tương phản (đã tính, chuẩn WCAG AA = 4.5:1)

| Cặp màu | Tỉ lệ | Kết quả |
|---|---|---|
| `#1A1613` trên `#FAF6EC` | ~16:1 | ✅ Rất tốt |
| `#0F2A4A` trên `#FAF6EC` | ~12:1 | ✅ Rất tốt |
| `#6B6259` trên `#FAF6EC` (chữ phụ) | 5.5:1 | ✅ Đạt |
| `text-foreground/55` trên `#FAF6EC` (nav idle) | **3.9:1** | ⚠️ Không đạt AA cho chữ 16px |

Mục nav không-active mờ có chủ đích (để mục đang mở là thứ sáng nhất trong
hàng) nhưng đang dưới ngưỡng. Xem [phần 11](#11-khoảng-trống-đã-biết).

---

## 4. Chữ

### 4.1 Hai font

| Vai trò | Font | Biến CSS | Class | Weight nạp |
|---|---|---|---|---|
| Tiêu đề | **Plus Jakarta Sans** | `--font-heading` | `font-display` | 600, 700, 800 |
| Thân bài | **Inter** | `--font-body` | mặc định | 400, 500, 600, 700 |

Cả hai nạp qua `next/font/google` trong `src/app/layout.tsx` với subset
`["latin", "latin-ext", "vietnamese"]` — **subset `vietnamese` là bắt buộc**,
thiếu nó thì dấu tiếng Việt rơi về font hệ thống và tiêu đề trông vỡ.

### 4.2 Thang chữ

| Cấp | Class | Kích thước | Ghi chú |
|---|---|---|---|
| H1 hero (trang chủ) | `font-display text-4xl font-extrabold tracking-tight sm:text-5xl 2xl:text-6xl` | 36 → 48 → 60px | Chỉ dùng một lần, trên trang chủ |
| H1 trang | `font-display text-3xl font-extrabold sm:text-4xl` | 30 → 36px | Chuẩn của `PageHeader` |
| H2 khối lớn | `font-display text-2xl font-extrabold sm:text-3xl xl:text-4xl` | 24 → 30 → 36px | Đầu mỗi section trang chủ |
| H2 thường | `font-display text-xl font-bold` | 20px | Trong bài viết, trong panel |
| H3 | `font-display text-lg font-bold` | 18px | |
| Tiêu đề thẻ | `font-display text-base font-bold leading-snug` | 16px | `PostCard` |
| Thân bài | `text-base leading-relaxed` | 16px | |
| Phụ | `text-sm` | 14px | Mô tả, chữ trong nút |
| Chú thích | `text-xs` | 12px | Ngày, badge, nhãn |
| Vi nhãn | `text-[11px]` / `text-[10px]` | 11 / 10px | Badge dày đặc, chữ disclosure |

Quy tắc: **mọi tiêu đề đều có `font-display`**. Chữ không phải tiêu đề không bao
giờ dùng `font-display`.

### 4.3 Nhãn viết hoa

Mẫu lặp lại xuyên suốt site — nhãn nhỏ, viết hoa, giãn chữ:

```tsx
className="text-xs font-semibold uppercase tracking-wide text-primary"
```

Dùng cho: chuyên mục bài viết, eyebrow trên `PageHeader`, nhãn HOT TIP,
`RebateChip`.

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
| Bài viết (một cột chữ) | `max-w-3xl` |
| Đoạn dẫn dưới tiêu đề | `max-w-2xl` |
| Header & footer | không giới hạn — tràn hết bề ngang |

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
| Padding trong thẻ | `p-5` (thẻ bài viết), `p-5 sm:p-6` (panel công cụ), `p-4` (thẻ nhỏ) |
| Hàng badge / icon + chữ | `gap-2` |
| Hàng có icon lớn | `gap-3` |
| Lưới thẻ | `gap-5` |
| Sau tiêu đề | `mt-1` (eyebrow → H1), `mt-2`, `mt-3` (H1 → đoạn dẫn) |

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
 outline-none focus:ring-2 focus:ring-primary"
```

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

Không có ảnh → dùng `MediaPlaceholder` với `tone="navy"`, không để ô trống.

### 10.4 Badge và chip

| Thành phần | Class | Nghĩa |
|---|---|---|
| Ưu đãi cao | `rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700` | Offer đang cao hơn mức thường |
| `RebateChip` | `rounded-full bg-emerald-100 px-3 py-1 text-sm font-extrabold uppercase tracking-wide text-emerald-700` | Tiền hoàn thêm |
| Loại thẻ | `text-xs font-medium text-muted-foreground` | Trung tính, không có nền |
| Hết hạn | `text-xs font-medium text-amber-700` | Đồng hồ đang chạy |
| Badge video | `rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-foreground/70` | Bài này là video |

### 10.5 Hộp HOT TIP — `HotTip`

```tsx
"flex gap-2 rounded-md border-l-4 border-emerald-600 bg-emerald-50
 px-3 py-2 leading-relaxed text-emerald-950"
```

Viền trái dày 4px là dấu hiệu nhận dạng. Nhãn "HOT TIP" là
`font-extrabold uppercase tracking-wide text-emerald-700`. Prop `compact` hạ
xuống `text-sm`. Dùng chung cho trang thẻ tín dụng và trang tài khoản ngân hàng.

### 10.6 Đầu trang — `PageHeader`

```tsx
"border-b border-border bg-secondary px-4 py-12 sm:px-6 lg:px-8"
```

Ba tầng: eyebrow (`text-xs font-semibold tracking-wide text-primary`) → H1
(`text-balance font-display text-3xl font-extrabold sm:text-4xl`) → phụ đề
(`mt-3 max-w-2xl text-base text-muted-foreground`).

`text-balance` để một tiêu đề như "Thẻ Tín Dụng Đáng Chú Ý" không bị rớt một
chữ đơn độc xuống dòng dưới.

**Mọi trang không phải trang chủ đều mở đầu bằng component này.**

### 10.7 Mục nav — header

| Trạng thái | Desktop | Mobile |
|---|---|---|
| Đang mở | `border-primary font-bold text-primary` | `bg-secondary font-semibold text-primary` |
| Nghỉ | `border-transparent font-medium text-foreground/55` | `text-foreground/90` |
| Hover | `hover:text-primary` | `hover:bg-secondary` |

Trang đang mở được đánh dấu **ba cách cùng lúc** — navy, đậm hơn, và gạch chân
— vì không cách nào đứng một mình đủ rõ: navy cạnh chữ đen là hai màu tối khó
tách, còn độ đậm thì dễ bỏ sót. Mọi mục đều mang một gạch chân trong suốt
(`border-b-2 border-transparent`) nên không có gì nhảy khi highlight di chuyển.

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

---

## 11. Khoảng trống đã biết

Đây là những chỗ đã kiểm tra và biết là chưa hoàn chỉnh — ghi lại để lần sau
không phải phát hiện lại từ đầu. **Không có mục nào là lỗi đang gây hại; đừng
sửa hàng loạt nếu không có lý do cụ thể.**

1. **Tương phản nav 3.9:1** — `text-foreground/55` cho mục nav không active thấp
   hơn chuẩn AA (4.5:1). Đổi lên `/65` sẽ đạt ~4.6:1 mà vẫn giữ được thứ tự thị
   giác. Chưa đổi vì cần nhìn tận mắt để chắc mục đang mở vẫn nổi bật hơn.
2. **Màu trạng thái không có token** — `emerald`/`amber` lấy thẳng từ palette
   Tailwind, nằm rải trong các file `.tsx`. Muốn đổi tông xanh của toàn site thì
   phải sửa nhiều chỗ. Cách sửa: thêm `--success` / `--warning` vào `globals.css`
   khi nào thật sự cần đổi.
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
- [ ] Xanh lá chỉ dành cho tiền/ưu đãi; hổ phách chỉ dành cho hạn chót
- [ ] Kích thước đo bằng `rem`/class Tailwind, không phải `px` cứng
- [ ] Animation mới có nhánh `prefers-reduced-motion`
- [ ] Icon lấy từ Phosphor, đúng cỡ và weight ở [phần 9](#9-icon)
- [ ] Thiếu ảnh thì dùng `<MediaPlaceholder>`, không để ô trống
- [ ] Đã xem lại ở 375px, 768px, 1280px và 1920px

---

## 13. Tài liệu liên quan

| File | Nội dung |
|---|---|
| [`src/app/globals.css`](src/app/globals.css) | Nguồn sự thật của toàn bộ token |
| [`CONTENT-GUIDE.md`](CONTENT-GUIDE.md) | Cách viết và đăng nội dung |
| [`CONTENTFUL.md`](CONTENTFUL.md) | Cấu trúc content type và tự động hóa |
| [`PRODUCT.md`](PRODUCT.md) | Site này dành cho ai và để làm gì |
| [`SEO.md`](SEO.md) | Metadata, structured data, hiệu năng |
