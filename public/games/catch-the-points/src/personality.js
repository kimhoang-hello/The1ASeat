import { CONFIG, ITEMS } from './config.js';
const eggs = { dynamic: '75K → 92K → 187K', devaluation: 'Effective immediately.', transfer: 'Speculative transfer?', fee: 'Retention offer unavailable.' };
export function catchMessage(type, random = Math.random) {
  if (eggs[type] && random() < CONFIG.easterEggChance) return eggs[type];
  return ITEMS[type]?.message;
}
export function summaryFor(result) {
  if (result.reason === 'balance') return 'The points weren’t worth the interest.';
  if (result.stats.dynamic >= 3) return 'Aeroplan had other plans.';
  if (result.stats.fees >= 3) return 'You might want to check those retention offers.';
  if (result.stats.golden) return 'That targeted offer had your name on it.';
  if (result.stats.longestCombo >= 15) return 'Your points game is dangerously efficient.';
  if (result.score < 3000) return 'We all started somewhere.';
  if (result.stats.interest === 0) return 'Thanh toán đủ mỗi kỳ sao kê. Nể thật!';
  return 'Same carry-on. Bigger ambitions. One more try?';
}
