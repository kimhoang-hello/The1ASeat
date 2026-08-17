# Ghế 1A

Blog cá nhân về Miles & Points và Award Travel, xây bằng Next.js (App
Router), Tailwind CSS 4, và tích hợp Contentful (tuỳ chọn). Website chỉ có
phiên bản tiếng Việt.

## Bắt đầu

```bash
npm install
npm run dev
```

Mở [http://localhost:3000](http://localhost:3000).

## Sửa nội dung / viết bài

Xem [CONTENT-GUIDE.md](CONTENT-GUIDE.md) — hướng dẫn sửa text giao diện và
đăng bài blog mới, không cần biết code.

## Giao diện

Xem [DESIGN-SYSTEM.md](DESIGN-SYSTEM.md) — token màu/chữ/khoảng cách, đặc tả
từng thành phần UI, và checklist khi thêm giao diện mới.

## Cấu trúc chính

| Đường dẫn                        | Nội dung                                           |
|-----------------------------------|-----------------------------------------------------|
| `src/app/`                         | Các trang (App Router)                              |
| `src/components/`                 | Component UI (layout, home sections, calculator...)  |
| `src/lib/content/`                 | Tầng dữ liệu: Contentful hoặc nội dung mẫu           |
| `content/sample/*.json`           | Nội dung mẫu (bài viết, thẻ tín dụng, transfer bonus)|
| `messages/vi.json`                | Chuỗi giao diện tiếng Việt                           |

## Nội dung

Mặc định site chạy với nội dung mẫu trong `content/sample/`. Để chuyển sang
Contentful thật, xem [CONTENTFUL.md](CONTENTFUL.md) rồi điền `CONTENTFUL_SPACE_ID`
và `CONTENTFUL_ACCESS_TOKEN` vào `.env.local` (copy từ `.env.example`).

## Deploy

Xem [DEPLOY.md](DEPLOY.md) để deploy lên Hostinger VPS (PM2 + Nginx + GitHub Actions CI/CD).

## Stack

- [Next.js 16](https://nextjs.org) (App Router, Turbopack)
- [Tailwind CSS 4](https://tailwindcss.com)
- [Contentful](https://www.contentful.com) — CMS (tuỳ chọn, có fallback nội dung mẫu)
- [Phosphor Icons](https://phosphoricons.com)
