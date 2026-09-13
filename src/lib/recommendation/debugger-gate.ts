/**
 * Debugger §22 có bật trên máy chủ này không.
 *
 * Site chưa có đăng nhập nào, và Server Function thì ai gửi được POST là gọi
 * được (xem guide `server-actions` của Next). Nên debugger TẮT mặc định ở mọi
 * nơi trừ `next dev` trên máy mình; bật ở chỗ khác phải đặt tường minh
 * `RECO_DEBUGGER=1`. Đặt nó trên production là quyết định có người ký — ngày
 * đó cũng là ngày phải có đăng nhập admin.
 *
 * Kiểm ở CẢ trang lẫn từng action: chặn ở trang thôi thì action vẫn nhận POST.
 */
export function recoDebuggerEnabled(): boolean {
  return process.env.NODE_ENV === "development" || process.env.RECO_DEBUGGER === "1";
}
