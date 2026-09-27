import { CONFIG } from './config.js';
export const ACHIEVEMENTS = [
  {id:'paid-in-full',name:'💳 TRẢ ĐỦ MỖI KỲ',description:'Hoàn thành với 0 lần trúng lãi suất.',earned:r=>r.reason==='time' && r.stats.interest===0},
  {id:'on-fire',name:'🔥 ĐANG SUNG',description:'Đạt combo 10 lần hứng.',earned:r=>r.stats.longestCombo>=10},
  {id:'targeted',name:'✨ TARGETED',description:'Hứng được Golden Welcome Bonus.',earned:r=>r.stats.golden>0},
  {id:'award-hunter',name:'✈️ THỢ SĂN VÉ AWARD',description:'Hứng điểm trong Award Availability.',earned:r=>r.stats.awardCatches>0},
  {id:'seat-1a',name:'👑 GHẾ 1A',description:'Đạt hạng GHẾ 1A hoặc cao hơn.',earned:r=>r.score>=CONFIG.ranks.find(rank=>rank.name==='GHẾ 1A').min},
  {id:'survivor',name:'💀 SỐNG SÓT QUA DEVALUATION',description:'Hoàn thành sau ít nhất 3 lần devaluation.',earned:r=>r.reason==='time' && r.stats.devaluations>=3},
];
export const earnedAchievements = result => ACHIEVEMENTS.filter(achievement=>achievement.earned(result)).map(achievement=>achievement.id);
export function renderAchievements(ids) {
  const host=document.getElementById('achievements');host.replaceChildren();host.hidden=!ids.length;
  if (!ids.length) return;
  const title=document.createElement('p');title.textContent='VỪA MỞ KHÓA';host.append(title);
  for(const achievement of ACHIEVEMENTS.filter(a=>ids.includes(a.id))) {
    const badge=document.createElement('span');badge.textContent=achievement.name;badge.title=achievement.description;host.append(badge);
  }
}
