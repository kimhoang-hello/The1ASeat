# Ghế 1A

Blog cá nhân về Miles & Points và Award Travel — song ngữ Việt/Anh, xây bằng
Next.js (App Router), Tailwind CSS 4, và tích hợp Contentful (tuỳ chọn).

## Bắt đầu

```bash
npm install
npm run dev
```

Mở [http://localhost:3000](http://localhost:3000). Mặc định chạy tiếng Việt ở `/`,
tiếng Anh ở `/en`.

## Cấu trúc chính

| Đường dẫn                        | Nội dung                                           |
|-----------------------------------|-----------------------------------------------------|
| `src/app/[locale]/`               | Các trang (App Router), theo từng ngôn ngữ          |
| `src/components/`                 | Component UI (layout, home sections, calculator...)  |
| `src/lib/content/`                 | Tầng dữ liệu: Contentful hoặc nội dung mẫu           |
| `content/sample/*.json`           | Nội dung mẫu (bài viết, thẻ tín dụng, transfer bonus)|
| `messages/{vi,en}.json`           | Chuỗi giao diện đa ngôn ngữ (next-intl)              |

## Nội dung

Mặc định site chạy với nội dung mẫu trong `content/sample/`. Để chuyển sang
Contentful thật, xem [CONTENTFUL.md](CONTENTFUL.md) rồi điền `CONTENTFUL_SPACE_ID`
và `CONTENTFUL_ACCESS_TOKEN` vào `.env.local` (copy từ `.env.example`).

## Deploy

Xem [DEPLOY.md](DEPLOY.md) để deploy lên Hostinger VPS (PM2 + Nginx + GitHub Actions CI/CD).

## Stack

- [Next.js 16](https://nextjs.org) (App Router, Turbopack)
- [Tailwind CSS 4](https://tailwindcss.com)
- [next-intl](https://next-intl.dev) — đa ngôn ngữ VI/EN
- [Contentful](https://www.contentful.com) — CMS (tuỳ chọn, có fallback nội dung mẫu)
- [Phosphor Icons](https://phosphoricons.com)
