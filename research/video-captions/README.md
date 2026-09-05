# Phụ đề video của kênh @HoangLeCA

Mỗi file là lời dẫn của một video, một câu một dòng, kèm link tới video và tới
bài viết tương ứng trên site.

## Vì sao chúng nằm ở đây

26 bài kèm video trên site có **thân bài đúng một câu excerpt** — chúng là
video nhúng kèm chú thích, không phải bài viết. Nội dung thật nằm trong video,
và nằm dưới dạng **chữ cháy vào khung hình**: các video này không có lời bình,
chỉ có hình và nhạc, nên `yt-dlp` báo "no automatic captions", YouTube Studio
hiện bảng Translations trống, và ASR của YouTube không sinh ra gì.

Rút một lượt tốn hơn hai tiếng máy (tải video, cắt khung, OCR từng khung), nên
kết quả được lưu lại thay vì rút lại mỗi lần cần.

## Dùng để làm gì

Nguyên liệu viết lại 26 bài đó, và viết các trang cụm gom chúng theo chủ đề.
Chúng chứa đúng thứ không có ở đâu khác trên site — ví dụ *"I redeemed 60,000
Bonvoy points for a one-night stay"* — tức số điểm thật đã trả cho từng đêm.

## Đọc thế nào

**Đọc lấy ý, đừng trích nguyên văn mà không đối chiếu lại video.** Đây là chữ
đọc từ pixel: OCR còn sót rác bám đầu và cuối dòng, và thỉnh thoảng đọc lệch
con số. Đã gặp thật: một video ghi "18k điểm cho hai đêm" ở câu này nhưng "8K
một đêm" ở câu sau — hai con số không khớp nhau, và chỉ tác giả mới biết cái
nào đúng.

## Cập nhật

```bash
npm run captions:all          # chỉ rút video chưa có file
npm run captions:all -- --force
```

Video mới thì thêm một dòng `<videoId> <slug>` vào
[`scripts/video-slugs.txt`](../../scripts/video-slugs.txt). Script tự đối chiếu
slug với sitemap đang chạy trước khi bắt đầu, nên gõ sai sẽ đỏ ngay chứ không
phải sau hai tiếng.
