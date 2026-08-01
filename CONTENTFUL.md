# Contentful content model

Khi bạn tạo Contentful Space, tạo 4 Content Type sau với đúng Field ID (chữ thường,
camelCase) để khớp với code trong `src/lib/content/contentful.ts`. Sau khi có
**Space ID** và một **Content Delivery API access token**, điền vào `.env.local`
(copy từ `.env.example`) — site sẽ tự chuyển từ nội dung mẫu sang Contentful.

## `blogPost`

| Field ID      | Type                  |
|---------------|-----------------------|
| slug          | Short text (unique)   |
| categoryVi    | Short text            |
| categoryEn    | Short text            |
| titleVi       | Short text            |
| titleEn       | Short text            |
| excerptVi     | Long text             |
| excerptEn     | Long text             |
| bodyVi        | Rich text             |
| bodyEn        | Rich text             |
| coverImage    | Media (image)         |
| publishedAt   | Date & time           |
| minutesRead   | Integer               |
| author        | Short text            |

## `creditCardOffer`

| Field ID       | Type                          |
|----------------|-------------------------------|
| slug           | Short text (unique)           |
| name           | Short text                    |
| issuer         | Short text                    |
| image          | Media (image)                 |
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
