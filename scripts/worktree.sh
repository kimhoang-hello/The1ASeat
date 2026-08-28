#!/usr/bin/env bash
#
# Dựng chỗ làm việc riêng cho một phiên Claude thứ hai.
#
# VÌ SAO CẦN: hai phiên cùng ghi vào một thư mục thì chúng đạp lên file của
# nhau, và `git status` của phiên này thấy thay đổi của phiên kia. Đã xảy ra
# ngày 28/08/2026 — không hỏng gì vì tình cờ hai bên không sửa cùng file, chứ
# không phải vì an toàn.
#
# Worktree cho mỗi phiên một thư mục và một nhánh riêng, dùng chung một .git.
#
#   ./scripts/worktree.sh new <tên>      dựng worktree + nhánh wt/<tên>
#   ./scripts/worktree.sh list           liệt kê worktree đang có
#   ./scripts/worktree.sh remove <tên>   gỡ worktree (từ chối nếu còn việc dở)
#
# Bốn thứ dưới đây KHÔNG nằm trong git nên worktree mới không tự có; script
# copy/cài lại từng cái:
#   .env.local                  Contentful, Hostinger, Kit — thiếu là build gãy
#   node_modules                cài mới
#   .claude/skills/             bản vendored của impeccable
#   .claude/settings.local.json quyền đã cấp cho phiên
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# Cạnh repo, không nằm trong nó: worktree lồng trong cây làm việc là mời gọi
# chuyện tự commit chính mình.
ROOT="$(dirname "$REPO")/$(basename "$REPO")-worktrees"

# File local cần copy sang worktree mới. Đây là danh sách "mang theo", KHÔNG
# phải danh sách "được bảo vệ" — xem EXPENDABLE bên dưới.
LOCAL_FILES=(".env.local" ".claude/settings.local.json")

# Những thứ git bỏ qua mà xoá đi cũng dựng lại được. MỌI thứ bị ignore khác đều
# được coi là việc thật và chặn đường gỡ.
#
# Danh sách này cố ý là "vứt được" chứ không phải "quý giá": danh sách quý giá
# phải tự bảo trì và sẽ luôn thiếu — `.gitignore` che cả `.env*`, `*.pem`,
# `.vercel/`, `.impeccable/`, nên chỉ cần tạo `.env.development.local` trong
# worktree là bản cũ xoá mất nó không một lời báo. Lật chiều lại thì file lạ
# mặc định được giữ, và sai sót nghiêng về phía an toàn.
EXPENDABLE=("node_modules/" ".next/" "out/" "build/" "coverage/" ".claude/skills/" ".DS_Store" "next-env.d.ts" "*.tsbuildinfo")

usage() { sed -n '2,26p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 1; }
die()   { printf '\nDỪNG: %s\n' "$1" >&2; exit 1; }

# Tên phải qua cửa này ở CẢ `new` LẪN `remove`. Thiếu ở `remove` thì
# `remove ../worktrees/nan-nhan` trỏ được sang worktree khác.
check_name() {
  [ "$#" -eq 1 ] || die "cần đúng một tên, không hơn không kém. Ví dụ: ./scripts/worktree.sh $ACTION audit-blog"
  [[ "$1" =~ ^[a-z0-9][a-z0-9-]*$ ]] || die "tên chỉ dùng chữ thường, số và dấu gạch ngang: '$1' không hợp lệ."
}

is_expendable() {
  local path="$1" pattern
  for pattern in "${EXPENDABLE[@]}"; do
    # shellcheck disable=SC2053  -- vế phải là glob có chủ ý
    [[ "$path" == $pattern ]] && return 0
  done
  return 1
}

# Cổng ghi vào thư mục metadata riêng của worktree (.git/worktrees/<tên>/), chứ
# không phải vào cây làm việc — một file lạ trong cây sẽ làm `git status` bẩn và
# chặn luôn đường gỡ. Đếm số worktree thì không dùng được: tạo A, B, gỡ A, tạo C
# là C trùng cổng của B.
port_file() {
  local gitdir
  # Gán riêng: `echo "$(git ...)"` nuốt mất mã lỗi của git vì echo luôn thành công.
  gitdir="$(git -C "$1" rev-parse --absolute-git-dir)" || return 1
  echo "$gitdir/worktree-port"
}

claimed_ports() {
  local wt f value
  # `|| continue` và `if` chứ không phải `[ ... ] && cat`: dưới `pipefail`, một
  # vòng lặp kết thúc bằng lệnh trả khác 0 làm hỏng cả pipeline, và worktree gốc
  # thì không bao giờ có file cổng — tức là luôn hỏng ở vòng đầu tiên.
  git -C "$REPO" worktree list --porcelain | awk '/^worktree /{print substr($0,10)}' | while read -r wt; do
    [ -d "$wt" ] || continue
    f="$(port_file "$wt" 2>/dev/null)" || continue
    [ -f "$f" ] || continue
    # Đọc bằng `read` chứ không `cat`: file thiếu newline cuối sẽ dính liền với
    # file kế tiếp, "3100" + "3101" thành "31003101" và CẢ HAI cổng trông như
    # đang rảnh. Giá trị không phải số thì bỏ qua có chủ ý — cùng lắm là cấp
    # trùng một cổng, còn dừng hẳn vì một file rác thì tệ hơn.
    read -r value < "$f" || true
    [[ "$value" =~ ^[0-9]+$ ]] && echo "$value"
  done
  return 0
}

cmd_new() {
  ACTION=new check_name "$@"
  # Tách từng dòng: trong CÙNG một câu `local`, bash khai báo hết các biến
  # (rỗng) rồi mới chạy phép gán, nên `$name` ở vế sau là rỗng — với `set -u`
  # là lỗi "unbound variable" ngay dòng đầu.
  local name="$1"
  local dir="$ROOT/$name"
  local branch="wt/$name"

  [ -e "$dir" ] && die "đã có $dir"
  git -C "$REPO" show-ref --verify --quiet "refs/heads/$branch" && die "đã có nhánh $branch"

  echo "==> lấy bản mới nhất của main"
  git -C "$REPO" fetch --quiet origin

  # Trap đặt TRƯỚC `worktree add`, không phải sau: bản thân lệnh add cũng có thể
  # đăng ký worktree rồi mới hỏng ở bước checkout, và lúc đó vẫn cần chỉ đường.
  # Hỏng thì KHÔNG tự xoá — xoá thư mục là việc chỉ `remove` (có cửa kiểm) mới
  # được làm.
  trap 'printf "\nHỎNG GIỮA CHỪNG khi dựng %s.\nXem đã tạo tới đâu:  ./scripts/worktree.sh list\nNếu worktree đã tạo, gỡ bằng:  ./scripts/worktree.sh remove %s\n" "$name" "$name" >&2' ERR

  echo "==> dựng worktree $dir trên nhánh $branch"
  mkdir -p "$ROOT"
  git -C "$REPO" worktree add -b "$branch" "$dir" origin/main

  # Không có .env.local thì `npm run build` gãy ngay ở bước gọi Contentful, và
  # thông báo lỗi không hề nhắc tới worktree — mất cả buổi mới lần ra.
  local extra
  for extra in "${LOCAL_FILES[@]}" ".claude/skills"; do
    if [ -e "$REPO/$extra" ]; then
      mkdir -p "$dir/$(dirname "$extra")"
      cp -R "$REPO/$extra" "$dir/$extra"
      echo "==> đã copy $extra"
    elif [ "$extra" = ".env.local" ]; then
      echo "==> CẢNH BÁO: repo gốc không có .env.local, worktree cũng sẽ không có"
    fi
  done

  echo "==> npm install (worktree không dùng chung node_modules)"
  (cd "$dir" && npm install --silent)

  # Cổng riêng cho mỗi worktree, nếu không hai dev server tranh nhau 3000 và cái
  # thứ hai lặng lẽ nhảy sang cổng khác — rồi mình mở nhầm cổng và tưởng code
  # không ăn thua.
  local port=3100 taken
  taken="$(claimed_ports)"
  while echo "$taken" | grep -qx "$port"; do port=$((port + 1)); done
  echo "$port" > "$(port_file "$dir")"

  trap - ERR

  cat <<EOF

XONG. Phiên thứ hai làm việc ở đây:

  cd "$dir"
  npm run dev -- -p $port

Nhánh: $branch (tách từ origin/main). Commit trên nhánh này thoải mái; đưa nó
vào main là việc phải hỏi user — quyền tự push chỉ áp cho main.
Gỡ khi xong:  ./scripts/worktree.sh remove $name
EOF
}

cmd_list() {
  git -C "$REPO" worktree list
}

cmd_remove() {
  ACTION=remove check_name "$@"
  local name="$1"
  local dir="$ROOT/$name"

  [ -d "$dir" ] || die "không có $dir"
  # Đúng worktree do repo này quản, không phải một thư mục trùng tên.
  git -C "$REPO" worktree list --porcelain | grep -qxF "worktree $dir" \
    || die "$dir không phải worktree của repo này."

  # --- cửa 1: thay đổi chưa commit ---
  # Gán riêng rồi mới kiểm: `[ -z "$(git ...)" ]` mà git hỏng thì cho ra chuỗi
  # rỗng và cửa này tưởng cây sạch.
  local dirty
  dirty="$(git -C "$dir" status --porcelain)"
  [ -z "$dirty" ] || die "$dir còn thay đổi chưa commit. Commit hoặc bỏ đi trước."

  # --- cửa 2: phải đang trên một nhánh, không phải detached HEAD ---
  # Cửa 3 hỏi "nhánh này còn commit nào chưa vào main chưa?". Nếu HEAD rời khỏi
  # nhánh thì câu hỏi đó trả lời cho nhánh cũ, còn commit vừa tạo nằm ngoài mọi
  # ref và biến mất cùng thư mục.
  local head_branch
  head_branch="$(git -C "$dir" symbolic-ref --quiet --short HEAD)" \
    || die "$dir đang ở detached HEAD. Đưa HEAD về một nhánh trước (git -C \"$dir\" switch -c wt/$name-cuu), rồi gỡ."

  # --- cửa 3: commit chưa có trên origin/main ---
  # Không nuốt lỗi bằng `|| true`: git hỏng thì phải dừng, chứ không được biến
  # thành "không có commit nào" rồi xoá.
  local unmerged
  unmerged="$(git -C "$dir" log --oneline "origin/main..HEAD")"
  [ -z "$unmerged" ] || die "nhánh $head_branch còn commit chưa vào origin/main:
$unmerged
Đưa chúng vào main trước đã (việc này cần hỏi user)."

  # --- cửa 4: mọi thứ git bỏ qua, trừ những gì dựng lại được ---
  # `git status` không kể file bị ignore, mà `git worktree remove` thì xoá tuốt.
  # Nên hỏi thẳng git xem worktree đang có những gì bị ignore, rồi chặn tất cả
  # trừ EXPENDABLE. `--ignored` gộp cả thư mục thành một dòng nên danh sách này
  # ngắn, không phải từng file trong node_modules.
  local ignored line rel
  ignored="$(git -C "$dir" status --porcelain --ignored)"
  while IFS= read -r line; do
    case "$line" in "!! "*) rel="${line#!! }" ;; *) continue ;; esac
    is_expendable "$rel" && continue

    # So với bản ở repo gốc. Khác, hoặc repo gốc không có, là việc chỉ tồn tại
    # trong worktree — gỡ đi là mất hẳn vì git không giữ bản nào.
    # `diff -rq` lo được cả file lẫn thư mục; đường dẫn lạ làm diff hỏng thì
    # cũng vào nhánh từ chối, tức là sai về phía an toàn.
    if [ ! -e "$REPO/$rel" ] || ! diff -rq "$dir/$rel" "$REPO/$rel" >/dev/null 2>&1; then
      die "$dir/$rel chỉ có trong worktree (git không theo dõi nó), gỡ là mất hẳn.
Chép đi nơi khác nếu cần giữ, hoặc xoá nó khỏi worktree rồi gỡ tiếp."
    fi
  done <<< "$ignored"

  # Không dùng --force: để git tự từ chối nốt những ca mình chưa nghĩ tới.
  git -C "$REPO" worktree remove "$dir"
  echo "==> đã gỡ worktree $dir"
  # `--` và nháy: tên nhánh do git chấp nhận có thể chứa `;`, mà dòng này sinh
  # ra để người ta copy-paste thẳng vào terminal.
  printf 'Nhánh %s vẫn còn. Chắc chắn không cần nữa thì:  git branch -d -- %q\n' "$head_branch" "$head_branch"
}

case "${1:-}" in
  new)    shift; cmd_new "$@" ;;
  list)   cmd_list ;;
  remove) shift; cmd_remove "$@" ;;
  *)      usage ;;
esac
