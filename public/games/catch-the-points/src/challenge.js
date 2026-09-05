import { safeScore } from './profile.js';

export function parseChallenge(search) {
  const values = new URLSearchParams(search).getAll('challenge');
  if (values.length !== 1 || !/^\d{1,16}$/.test(values[0])) return null;
  return safeScore(Number(values[0]));
}
export function gameURL(href, target = null) {
  const url = new URL(href);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Unsupported game URL');
  url.search = ''; url.hash = '';
  if (target !== null) url.searchParams.set('challenge', String(safeScore(target)));
  return url.href;
}
export function sharePayload(result, href, challenge = false) {
  const url = gameURL(href, challenge ? result.score : null);
  return { title: 'Catch The Points — Ghế 1A', url,
    text: `I scored ${result.score.toLocaleString('en-US')} and reached ${result.rank} ✈️\n\n${challenge ? 'Beat my score in this challenge!' : 'Think you can beat me?'}\n\nCatch The Points — Ghế 1A\nghe1a.com` };
}
