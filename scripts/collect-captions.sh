#!/usr/bin/env bash
#
# Rút phụ đề của MỌI video trên kênh rồi lưu vào research/video-captions/.
#
#   npm run captions:all            # bỏ qua video đã có file
#   npm run captions:all -- --force # làm lại từ đầu
#
# Vì sao lưu vào repo. Phụ đề này là NGUYÊN LIỆU DUY NHẤT để viết lại 26 bài
# kèm video — thân bài của chúng hiện đúng một câu excerpt, và nội dung thật
# nằm trong video dưới dạng chữ cháy vào khung hình (xem burned-captions.sh).
# Rút lại một lượt tốn hơn hai tiếng máy, nên kết quả phải nằm cạnh nội dung
# chứ không nằm ở /tmp.
#
# Danh sách video lấy từ chính RSS của kênh — cùng nguồn mà `sync-videos` dùng
# để tạo entry, nên hai bên không bao giờ lệch nhau. Slug đọc từ Contentful
# qua trang blog đang chạy, để tên file khớp tên bài.
set -euo pipefail
cd "$(dirname "$0")/.."

MAP="${CAPTIONS_MAP:-scripts/video-slugs.txt}"
OUT="research/video-captions"
FORCE="${1:-}"
mkdir -p "$OUT"

# Đối chiếu slug với site đang chạy TRƯỚC khi tốn hai tiếng OCR: một slug gõ
# sai chỉ lộ ra ở dòng "# bài:" trong file kết quả, mà lúc đó thì đã muộn.
live=$(mktemp)
if curl -sf --max-time 30 https://ghe1a.com/sitemap.xml \
   | grep -o 'blog/[a-z0-9-]*' | sed 's|blog/||' | sort > "$live" && [ -s "$live" ]; then
  bad=0
  while read -r id slug; do
    case "$id" in ''|'#'*) continue ;; esac
    grep -qx "$slug" "$live" || { echo "slug không có bài nào trên site: $slug"; bad=1; }
  done < "$MAP"
  [ "$bad" -eq 0 ] || { echo "Sửa scripts/video-slugs.txt rồi chạy lại."; exit 1; }
else
  echo "(không đọc được sitemap — bỏ qua bước đối chiếu slug)"
fi
rm -f "$live"

total=$(grep -cve '^\s*$' -e '^#' "$MAP")
i=0
while read -r id slug; do
  case "$id" in ''|'#'*) continue ;; esac
  i=$((i+1))
  dest="$OUT/$slug.txt"
  if [ -s "$dest" ] && [ "$FORCE" != "--force" ]; then
    echo "[$i/$total] $slug — đã có, bỏ qua"
    continue
  fi
  echo "[$i/$total] $slug ($id)…"

  # Giữ lại stderr thay vì đổ vào /dev/null. Lượt đầu có sáu video hỏng và log
  # chỉ nói "hỏng, bỏ qua" — không đủ để biết là YouTube chặn hay OCR chết.
  log="${CAPTIONS_OUT:-/tmp/caps}/$slug.log"
  ok=""
  for attempt in 1 2; do
    # `< /dev/null` là lớp chắn thứ hai cho cùng cái bẫy mà `-nostdin` bịt bên
    # burned-captions.sh: bất cứ thứ gì bên trong lỡ đọc stdin sẽ ăn mất các
    # dòng còn lại của "$MAP" đang được vòng lặp này đọc dở.
    if bash scripts/burned-captions.sh -- "$id" > "$log" 2>&1 < /dev/null; then ok=1; break; fi
    echo "  … lượt $attempt hỏng, nghỉ rồi thử lại"
    tail -2 "$log" | sed 's/^/    /'
    sleep 60
  done
  [ -n "$ok" ] || { echo "  ✗ bỏ qua — xem $log"; continue; }

  src="${CAPTIONS_OUT:-/tmp/caps}/$id/captions.txt"
  [ -s "$src" ] || { echo "  ✗ không rút được câu nào — xem $log"; continue; }
  {
    echo "# $slug"
    echo "# video: https://www.youtube.com/watch?v=$id"
    echo "# bài:   https://ghe1a.com/blog/$slug"
    echo "# rút:   $(date +%Y-%m-%d) bằng scripts/burned-captions.sh"
    echo "#"
    echo "# Đây là chữ ĐỌC TỪ PIXEL, không phải caption track — video không có"
    echo "# lời bình. OCR còn sót rác bám đầu/cuối dòng; đọc lấy ý, đừng trích"
    echo "# nguyên văn mà không đối chiếu lại video."
    echo
    cat "$src"
  } > "$dest"
  echo "  ✓ $(grep -cve '^#' -e '^\s*$' "$dest") câu → $dest"

  # Tải hai mươi video liên tiếp là đủ để YouTube trả 429. Nghỉ giữa các lượt
  # rẻ hơn nhiều so với việc phải chạy lại cả mẻ.
  sleep 20
done < "$MAP"
