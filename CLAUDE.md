# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

# Git workflow

The user has pre-authorized automatic commits and pushes to `origin main`
for this repo: after any code/content edit is done and verified (build/
lint pass), commit and push immediately without asking for confirmation
first. Still use clear, descriptive commit messages; still avoid
destructive git operations (force-push, reset --hard, etc.) without
asking. This standing authorization applies only within this repo.

# Chạy song song nhiều phiên

Đừng để hai phiên cùng ghi vào thư mục này. Chúng đạp lên file của nhau, và
`git status` của phiên này hiện thay đổi của phiên kia — đã xảy ra 28/08/2026,
không hỏng gì chỉ vì tình cờ hai bên không sửa cùng file.

Phiên thứ hai dựng chỗ làm riêng:

    ./scripts/worktree.sh new <tên>

Nó tạo nhánh `wt/<tên>` tách từ `origin/main` trong thư mục riêng, rồi chuẩn bị
những thứ không nằm trong git mà thiếu là gãy: copy `.env.local`,
`.claude/settings.local.json` và `.claude/skills/` nếu repo gốc có, và chạy
`npm install` cho `node_modules`. Lệnh in ra một cổng dev chưa worktree nào dùng
để hai server không tranh cổng 3000.

`remove` có bốn cửa kiểm và không bao giờ tự xoá nhánh. Nó từ chối khi cây còn
thay đổi chưa commit, khi HEAD đang detached (commit ở đó không thuộc nhánh nào
nên xoá thư mục là mất hẳn), khi nhánh còn commit chưa vào `origin/main`, và khi
worktree có bất kỳ thứ gì git bỏ qua mà repo gốc không có — `git status` không
kể file bị ignore, còn `git worktree remove` thì xoá tuốt. Chỉ những thứ dựng
lại được (`node_modules/`, `.next/`, `.claude/skills/`…) mới được xoá không hỏi.

Giới hạn đã biết: nếu bạn tạo commit lúc HEAD đang detached rồi tự quay về nhánh
mà không giữ lại commit đó, `remove` không cứu được nó.

Quyền tự commit + push ở dưới chỉ áp cho `main`. Trên nhánh `wt/*` thì commit
bình thường, còn merge vào `main` là việc phải hỏi.

# Đụng vào thẻ tín dụng thì chạy hai audit này

Thêm thẻ mới, sửa offer, đổi link apply, sửa rebate — xong việc là chạy:

    npm run audit:trademarks     # thiếu ®/™
    npm run audit:rebate-prose   # badge rebate lệch số viết tay trong editor's take

Cả hai bắt loại lỗi mà `lint`, `tsc` và `build` đều không thấy, vì lỗi nằm
trong **nội dung Contentful** chứ không nằm trong code.

`audit:rebate-prose` tồn tại vì con số rebate nằm ở HAI chỗ trên cùng một
entry: field `rebateVi` (badge trên ảnh thẻ) và cùng con số đó viết tay trong
câu "HOT TIP: … nhận thêm $140 rebate." của `editorsTakeVi`. Job
`/api/check-rebates` chạy hai lượt mỗi ngày, giữ hai chỗ khớp nhau, nhưng chỉ
vào lúc FinlyWealth đổi số — người gõ nhầm tay thì phải audit mới thấy. Rà tay
01/09/2026: 3 trong 10 thẻ có rebate đang lệch, tệ nhất hứa dư $75 cho người
đọc.

`audit:trademarks` phải chạy **sau** khi sửa xong, không phải trước: nó tự học
thương hiệu từ chính nội dung, nên một thẻ mới mang tên hãng mới vào site sẽ
làm lộ ra mọi chỗ cũ đang viết trần. Thêm 2 thẻ CIBC® ngày 01/09/2026 làm nó
báo 15 chỗ, trong đó 11 chỗ là hệ quả trực tiếp.

Chi tiết và các audit còn lại: xem mục "Chạy gì trước khi kết luận" trong
[AGENTS.md](AGENTS.md).

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
