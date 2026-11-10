# Ghế 1A

Site tiếng Việt về Miles & Points, thẻ tín dụng và Award Travel cho người Việt ở
Canada. Next.js 16 (App Router), Tailwind CSS 4, nội dung từ Contentful.

## Chạy ở máy

```bash
npm install
npm run dev
```

Cần `.env.local` có `CONTENTFUL_SPACE_ID` và `CONTENTFUL_ACCESS_TOKEN` (mẫu ở
[.env.example](.env.example)). Site không có dữ liệu mẫu: thiếu hai biến này là
trang báo lỗi ngay.

## Tài liệu

| File | Nội dung |
|---|---|
| [CONTENT-GUIDE.md](CONTENT-GUIDE.md) | Sửa chữ giao diện và đăng bài, không cần biết code |
| [CONTENTFUL.md](CONTENTFUL.md) | Content model, webhook, các job tự động |
| [DEPLOY.md](DEPLOY.md) | Hostinger tự deploy khi push `main`; biến môi trường; cache |
| [DESIGN-SYSTEM.md](DESIGN-SYSTEM.md) | Token màu/chữ/khoảng cách, đặc tả thành phần UI |
| [SEO.md](SEO.md) | Việc SEO đã làm và còn lại |
| [AGENTS.md](AGENTS.md) | Ghi chú cho agent: sự thật đã kiểm, quyết định có chủ ý, chạy gì trước khi kết luận |
| [HANDOFF.md](HANDOFF.md) | Recommendation engine của trang Gợi ý thẻ |

## Cấu trúc

| Đường dẫn | Nội dung |
|---|---|
| `src/app/` | Trang và route API (App Router) |
| `src/components/` | Component UI |
| `src/lib/` | Dữ liệu trong repo (thẻ Mỹ, khách sạn, tài khoản ngân hàng, bảng award) và logic |
| `src/lib/content/` | Tầng đọc Contentful (bài viết, thẻ Canada, transfer bonus, tác giả) |
| `src/lib/recommendation/`, `src/lib/recommender/` | Engine và lớp trình bày của trang Gợi ý thẻ |
| `messages/vi.json` | Chuỗi giao diện tiếng Việt |
| `scripts/` | Audit và job (`npm run audit:*`, `npm run job:*`) |
| `data/` | Dữ liệu do job GitHub Actions ghi (lịch sử offer, transfer bonus Mỹ) |

## Kiểm trước khi push

```bash
npm run lint
npx tsc --noEmit
npm test
npm run build
```

Các audit nội dung (`npm run audit:*`) và khi nào chạy cái nào: xem
[CLAUDE.md](CLAUDE.md) và mục "Chạy gì trước khi kết luận" trong AGENTS.md.
