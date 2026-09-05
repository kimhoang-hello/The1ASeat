#!/usr/bin/env bash
#
# Rút phụ đề CHÁY VÀO HÌNH của một video trên kênh @HoangLeCA.
#
#   npm run captions -- <videoId> [<videoId>…]
#   scripts/burned-captions.sh 0UDgwRw4-SI
#
# Vì sao script này tồn tại. Video của kênh KHÔNG có lời bình — chúng là tour
# hình kèm nhạc, còn lời dẫn được ghi thẳng lên khung hình dưới dạng chữ. Hệ
# quả: `yt-dlp --write-auto-sub` báo "no automatic captions", YouTube Studio →
# Languages hiện bảng Translations trống, và ASR của YouTube không sinh ra gì
# vì không có tiếng nói để nghe. Đo ngày 05/09/2026 trên video AC Hotel Tokyo
# Ginza: toàn bộ "phụ đề" tự động đọc ra là `[Music]` lặp lại cùng vài từ ASR
# nghe nhầm tiếng nhạc.
#
# Nhưng nội dung thì có thật và đáng giá — chính câu "I redeemed 60,000 Bonvoy
# points for a one-night stay" nằm trong đó. Đường duy nhất tới nó là đọc từ
# pixel.
#
# 26 bài kèm video trên site đều ở tình trạng này (thân bài đúng một câu
# excerpt), nên script này là nguyên liệu cho việc viết lại chúng.
#
# Cần: yt-dlp, ffmpeg, tesseract (brew install yt-dlp ffmpeg tesseract).
set -euo pipefail

OUT_ROOT="${CAPTIONS_OUT:-/tmp/caps}"
command -v yt-dlp    >/dev/null || { echo "thiếu yt-dlp — brew install yt-dlp"; exit 1; }
command -v ffmpeg    >/dev/null || { echo "thiếu ffmpeg — brew install ffmpeg"; exit 1; }
command -v tesseract >/dev/null || { echo "thiếu tesseract — brew install tesseract"; exit 1; }
[ $# -gt 0 ] || { echo "dùng: $0 <videoId> [<videoId>…]"; exit 1; }

for ID in "$@"; do
  OUT="$OUT_ROOT/$ID"; mkdir -p "$OUT"; ( cd "$OUT"

  # 480p là đủ: chữ phụ đề chiếm gần hết bề ngang khung, còn tải bản gốc thì
  # chậm hơn nhiều lần mà OCR không đọc thêm được chữ nào.
  [ -f "$ID.mp4" ] || yt-dlp -q -f "bv*[height<=480]+ba/b[height<=480]" \
    --merge-output-format mp4 -o "$ID.%(ext)s" "https://www.youtube.com/watch?v=$ID"

  # Hai khung mỗi giây: câu ngắn nhất còn khoảng hai giây, lấy thưa hơn là rơi câu.
  #
  # `lut` mới là bước quyết định, không phải `crop`. Cắt dải chữ rồi OCR thẳng
  # thì phần HÌNH phía sau lớp nền mờ sinh ra hàng nghìn dòng rác — đo lần đầu:
  # 1,261 dòng cho một video bảy phút, gần hết là ký tự vô nghĩa. Chữ phụ đề là
  # trắng, còn nền mờ lẫn cảnh vật đều tối hơn, nên nhị phân hoá ở ngưỡng 185
  # rồi đảo thành chữ đen trên nền trắng — dạng tesseract đọc chuẩn nhất — làm
  # rác biến mất gần hết.
  rm -rf frames; mkdir -p frames
  ffmpeg -v error -i "$ID.mp4" \
    -vf "fps=2,crop=in_w:in_h*0.18:0:in_h*0.80,scale=1280:-1,format=gray,lut=y='if(gt(val,185),0,255)'" \
    frames/%05d.png -y

  # `--psm 6` = coi cả vùng ảnh là MỘT khối chữ. Mặc định (psm 3) đi tìm bố cục
  # trang, và với một dải hai dòng nó hay tách nhầm thành hai cột rồi trộn thứ tự.
  for img in frames/*.png; do tesseract "$img" stdout --psm 6 -l eng 2>/dev/null; done \
    | sed 's/[[:space:]]\+/ /g; s/^ //; s/ $//' | grep -v '^$' > raw.txt

  python3 - <<'PY' > captions.txt
import difflib, re

def looks_like_prose(line):
    """Phụ đề thật là câu tiếng Anh. Rác OCR đến từ chữ NẰM TRONG cảnh — biển
    hiệu, số phòng, logo thang máy — nên nó ngắn, lắm ký tự lạ và ít từ thật."""
    if len(line) < 20: return False
    junk = sum(1 for c in line if not (c.isalnum() or c in " ,.'’!?%$&:;-—–()"))
    if junk / len(line) > 0.08: return False
    if len([w for w in re.findall(r"[A-Za-z']+", line) if len(w) >= 3]) < 5: return False
    # OCR hỏng hay đẻ ra chuỗi phụ âm dài; câu tiếng Anh thật thì không.
    if re.search(r"[bcdfghjklmnpqrstvwxz]{5,}", line.lower()): return False
    return True

lines = [l.strip() for l in open("raw.txt", errors="ignore") if l.strip()]
out = []
for line in filter(looks_like_prose, lines):
    # Cùng một câu hiện ở nhiều khung liền nhau và mỗi lần OCR đọc lệch vài ký
    # tự, nên gộp theo ĐỘ GIỐNG chứ không so bằng. Nhìn lui sáu dòng chứ không
    # chỉ dòng ngay trước: một dòng rác lọt vào giữa hai lần đọc cùng một câu
    # sẽ làm phép so "chỉ với dòng trước" trượt, và câu đó lọt ra hai lần.
    hit = next((i for i in range(max(0, len(out) - 6), len(out))
                if difflib.SequenceMatcher(None, out[i], line).ratio() > 0.62), None)
    if hit is None:
        out.append(line)
    elif len(line) > len(out[hit]):
        out[hit] = line      # giữ bản OCR đọc được nhiều chữ nhất
print("\n".join(out))
PY

  echo "$ID → $(wc -l < captions.txt | tr -d ' ') câu · $OUT/captions.txt"
  ); done
