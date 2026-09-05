import { sharePayload } from './challenge.js';

export async function nativeShare(payload, navigatorAPI) {
  if (typeof navigatorAPI.share !== 'function') return 'fallback';
  try { await navigatorAPI.share(payload); return 'shared'; }
  catch (error) { return error?.name === 'AbortError' ? 'cancelled' : 'fallback'; }
}

export function setupSharing(track) {
  const dialog = document.getElementById('share-dialog');
  const text = document.getElementById('share-text');
  const status = document.getElementById('share-status');
  document.getElementById('share-close').addEventListener('click', () => dialog.close());
  document.getElementById('copy-share').addEventListener('click', async () => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(text.value);
      status.textContent = 'Đã sao chép. Gửi cho hội Miles & Points nhé!';
    } catch {
      text.focus(); text.select(); text.setSelectionRange(0, text.value.length);
      status.textContent = 'Nội dung đã được chọn. Nhấn giữ hoặc dùng Ctrl/Cmd + C để sao chép.';
    }
  });
  return async (result, challenge = false) => {
    const payload = sharePayload(result, location.href, challenge);
    // Call native sharing immediately from the click to preserve user activation.
    const pending = nativeShare(payload, navigator);
    track(challenge ? 'challenge_created' : 'share_score', { score: result.score, rank: result.rank });
    const outcome = await pending;
    if (outcome !== 'fallback') return;
    text.value = `${payload.text}\n${payload.url}`;
    status.textContent = challenge ? 'Gửi link này để bạn bè chơi cùng mục tiêu điểm.' : 'Sao chép nội dung và gửi qua ứng dụng bạn thích.';
    document.getElementById('share-dialog-title').textContent = challenge ? 'Thách đấu bạn bè' : 'Chia sẻ điểm';
    if (!dialog.open) dialog.showModal();
  };
}
