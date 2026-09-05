import { getPostGameRecommendation, recommendationTracking } from './recommendations.js';
import { contentLinks } from './recommendation-config.js';
export function setupRecommendation(track, root = document, links = contentLinks) {
  const host = root.getElementById('recommendation');
  const link = root.getElementById('recommendation-link');
  let payload = null;
  link.addEventListener('click', () => { if (payload && !link.hidden) track('post_game_recommendation_clicked',payload); });
  return stats => {
    const result = getPostGameRecommendation(stats, links);
    payload = recommendationTracking(result,stats);
    for (const key of ['eyebrow','title','message']) root.getElementById(`recommendation-${key}`).textContent=result[key];
    root.getElementById('recommendation-cta').textContent=result.ctaText;
    link.hidden=!result.url;
    if (result.url) link.href=result.url; else link.removeAttribute('href');
    host.hidden=false;
    track('post_game_recommendation_shown',payload);
  };
}
