import { ASSET_BASE } from './config.js';
// Local Canvas export: no screenshot libraries, remote services or uploaded data.
export async function scoreCard(result) {
  await document.fonts.ready;
  const canvas = document.createElement('canvas');
  canvas.width = 1080; canvas.height = 1350;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');
  const cream = '#faf6ec', navy = '#0f2a4a', muted = '#6b6259';
  ctx.fillStyle = cream; ctx.fillRect(0, 0, 1080, 1350);
  ctx.strokeStyle = '#ded5c5'; ctx.lineWidth = 2; ctx.strokeRect(42,42,996,1266);
  ctx.fillStyle = navy; ctx.font = '800 42px "Plus Jakarta Sans", sans-serif';
  const logo = new Image(); logo.src = `${ASSET_BASE}ghe1a-logo.png`;
  try { await logo.decode(); ctx.drawImage(logo, 84, 82, 72, 72); } catch { /* Wordmark remains. */ }
  ctx.fillText('Ghế 1A', 176, 135);
  ctx.textAlign = 'center';
  ctx.font = '700 32px "Plus Jakarta Sans", sans-serif'; ctx.fillText('CATCH THE POINTS', 540, 270);
  ctx.fillStyle = muted; ctx.font = '500 21px Inter, sans-serif'; ctx.fillText('FINAL SCORE', 540, 354);
  const fit = (text, size, weight = 800) => {
    do { ctx.font = `${weight} ${size}px "Plus Jakarta Sans", sans-serif`; size -= 2; } while (ctx.measureText(text).width > 870 && size > 20);
  };
  const score = result.score.toLocaleString('en-US');
  ctx.fillStyle = navy; fit(score, 220); ctx.fillText(score, 540, 555);
  fit(result.rank, 56); ctx.fillText(result.rank, 540, 696);
  ctx.strokeStyle = '#bfa77a'; ctx.beginPath();ctx.moveTo(150,758);ctx.lineTo(930,758);ctx.stroke();
  ctx.font = '600 30px Inter, sans-serif';ctx.fillText(`Longest combo: ${result.stats.longestCombo} catches`,540,844);
  ctx.fillStyle = '#8b682d'; ctx.font = '700 23px Inter, sans-serif';
  if (result.newBest) ctx.fillText('NEW PERSONAL BEST',540,915);
  ctx.fillStyle = muted; ctx.font = '400 28px Inter, sans-serif'; ctx.fillText('Think you can beat me?',540,1100);
  ctx.fillStyle = navy;ctx.font = '700 28px Inter, sans-serif';ctx.fillText('ghe1a.com',540,1180);
  return new Promise((resolve,reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Image export failed')), 'image/png'));
}

export function setupScoreCard() {
  const button = document.getElementById('save-card');
  const dialog = document.getElementById('card-dialog');
  const image = document.getElementById('card-image');
  const download = document.getElementById('card-download');
  const status = document.getElementById('social-status');
  let version=0, url=null;
  document.getElementById('card-close').addEventListener('click',()=>dialog.close());
  button.addEventListener('click',()=>{ if(url) dialog.showModal(); });
  return {
    reset() { version++; if(url) URL.revokeObjectURL(url); url=null; image.removeAttribute('src'); download.removeAttribute('href'); button.disabled=true; if(dialog.open) dialog.close(); },
    async prepare(result) {
      const current=++version; button.disabled=true; status.textContent='';
      try {
        const blob=await scoreCard(result);
        if(current!==version) return;
        if(url) URL.revokeObjectURL(url);
        url=URL.createObjectURL(blob);image.src=url;download.href=url;
        download.download=`ghe1a-${result.score}.png`;button.disabled=false;
      } catch {
        if(current===version) status.textContent='Không tạo được ảnh trên trình duyệt này. Bạn vẫn có thể chia sẻ điểm hoặc chụp màn hình.';
      }
    },
  };
}
