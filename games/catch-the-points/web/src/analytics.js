export const ANALYTICS_EVENTS = new Set(['game_started','game_completed','game_over_balance','play_again','share_score','challenge_created','challenge_started','challenge_completed','personal_best','rank_achieved','post_game_recommendation_shown','post_game_recommendation_clicked']);
// Listen to `ghe1a:analytics` to connect a provider later. No networking or tracking SDK.
export function createAnalytics(dispatch = detail => window.dispatchEvent(new CustomEvent('ghe1a:analytics', {detail}))) {
  return (event, properties = {}) => {
    if (!ANALYTICS_EVENTS.has(event)) return;
    try { dispatch({ ...properties, event, version: 2 }); } catch { /* Analytics must never affect play. */ }
  };
}
