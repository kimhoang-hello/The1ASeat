# Task queue của autonomous loop

Hàng đợi này là source of truth cho vòng lặp phát triển tự động. Một task đi
qua bốn thư mục theo đúng thứ tự:

```
backlog/  →  active/  →  done/
                 ↓
              review/     (BLOCKED — cần người quyết)
```

- **`backlog/`** — task đã sẵn sàng làm, chưa ai nhận.
- **`active/`** — task đang làm trong phiên hiện tại. Bình thường chỉ có một.
- **`review/`** — task BLOCKED: agent đã thử nhưng không thể hoàn thành an toàn,
  hoặc Codex vẫn REJECT sau 3 vòng review. Không được push/deploy task ở đây.
- **`done/`** — đã commit, push, deploy và verify xong trên production.

Nhật ký phiên nằm ở [LOOP.md](LOOP.md).

## Viết một task mới

Tạo file `backlog/NNN-slug-ngan.md` theo mẫu:

```markdown
# <Tên task>

## Objective
Task này cần làm gì.

## Requirements
- Requirement 1

## Acceptance Criteria
- [ ] Criterion 1

## Priority
High / Medium / Low

## Dependencies
None

## Notes
Thông tin bổ sung nếu cần.
```

Viết acceptance criteria sao cho kiểm được bằng máy (lint, `tsc --noEmit`,
`npm run build`, các script `audit:*`, hoặc một trang cụ thể trên
https://ghe1a.com). Tiêu chí kiểu "trông đẹp hơn" thì agent không tự kết luận
PASS được và task sẽ dừng ở `review/`.

## Quality gate bắt buộc

Không task nào được commit khi còn một gate đỏ:

```
npm run lint
npx tsc --noEmit
npm run build
npm run audit:trademarks
npm run audit:rebates
npm run audit:awards
```

Sau đó là Codex review (`codex exec review`) rồi mới tới commit → push →
Hostinger tự deploy → kiểm lại trên site thật. Xem [../AGENTS.md](../AGENTS.md)
để biết những chỗ đã kiểm chứng rồi, đừng đoán lại.
