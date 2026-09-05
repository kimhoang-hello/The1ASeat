import { contentLinks, recommendationRules as rules, recommendationContent as content } from './recommendation-config.js';
import { rankFor } from './game.js';

const nonnegative = value => Number.isFinite(value) ? Math.max(0, value) : 0;
const numericFields = ['dynamicPricingHits','dynamicPricingDamage','annualFeeHits','annualFeeDamage','interestHits','interestDamage','devaluationHits','devaluationDamage','welcomeBonusCaught','goldenWelcomeBonusCaught','transferBonusCaught','transferPartnerBoostsCaught','transferPartnerPointsEarned','awardAvailabilityPointsEarned','normalPointsCaught','longestCombo','finalScore','personalBest','totalPositivePointsEarned'];
export function buildRecommendationStats(game, personalBest) {
  return {
    dynamicPricingHits:game.stats.dynamic, dynamicPricingDamage:game.damage.dynamic,
    annualFeeHits:game.stats.fees, annualFeeDamage:game.damage.fee,
    interestHits:game.stats.interest, interestDamage:game.damage.interest,
    devaluationHits:game.stats.devaluations, devaluationDamage:game.damage.devaluation,
    welcomeBonusCaught:game.stats.welcome, goldenWelcomeBonusCaught:game.stats.golden,
    transferBonusCaught:game.bonusStats.transfer.catches, transferPartnerBoostsCaught:game.stats.partners,
    transferPartnerPointsEarned:game.earnings.partner, awardAvailabilityTriggered:game.awardUsed,
    awardAvailabilityPointsEarned:game.earnings.award,
    normalPointsCaught:Object.values(game.programStats).reduce((total,p)=>total+p.catches,0),
    longestCombo:game.stats.longestCombo, finalScore:game.score, rank:rankFor(game.score), personalBest,
    gameEndedByCarryingBalance:game.reason==='balance', totalPositivePointsEarned:game.earnings.total,
  };
}
export function recommendationURL(destination, category) {
  if (!destination) return null;
  try {
    const url = new URL(destination);
    if (url.protocol !== 'https:' || !['ghe1a.com','www.ghe1a.com'].includes(url.hostname) || url.username || url.password || url.port) return null;
    for (const [key,value] of Object.entries({source:'catch-the-points',medium:'game',campaign:'post-game',content:category.replaceAll('_','-')})) url.searchParams.set(`utm_${key}`, value);
    return url.href;
  } catch { return null; }
}
export function getPostGameRecommendation(input = {}, links = contentLinks) {
  const s = {...input, ...Object.fromEntries(numericFields.map(key=>[key,nonnegative(input[key])]))};
  const damage = [ ['devaluation',s.devaluationDamage], ['dynamic_pricing',s.dynamicPricingDamage], ['annual_fees',s.annualFeeDamage], ['interest',s.interestDamage] ];
  const totalDamage = damage.reduce((sum,[,value])=>sum+value,0);
  const potential = Math.max(1,s.totalPositivePointsEarned,s.finalScore+totalDamage);
  const meaningful = (value,threshold) => value >= threshold.absolute || (value >= threshold.minimum && value/potential >= threshold.ratio);
  let category = 'general', signal = {name:'final_score',value:s.finalScore};
  if (s.gameEndedByCarryingBalance === true) { category='carrying_balance'; signal={name:'carrying_balance',value:true}; }
  else if (s.interestHits >= rules.interest.hits || meaningful(s.interestDamage,rules.interest)) { category='interest'; signal={name:'interest_damage',value:s.interestDamage}; }
  else if (rules.expert.ranks.includes(s.rank) && s.interestHits===0 && (totalDamage<=rules.expert.damage || totalDamage/potential<=rules.expert.ratio) && (s.longestCombo>=rules.expert.combo || s.finalScore>=rules.expert.score)) { category='expert'; signal={name:'final_score',value:s.finalScore}; }
  else {
    const negative = damage.filter(([,value])=>meaningful(value,rules.negative)).sort((a,b)=>b[1]-a[1])[0];
    if (negative) { category=negative[0]; signal={name:`${category}_damage`,value:negative[1]}; }
    else {
      const p=rules.positive;
      const positive = [
        ['welcome_bonus',(s.welcomeBonusCaught*p.welcomeWeight+s.goldenWelcomeBonusCaught*p.goldenWeight)/p.welcomeMinimum,'welcome_bonuses',s.welcomeBonusCaught+s.goldenWelcomeBonusCaught],
        ['transfer_bonus',(s.transferBonusCaught+s.transferPartnerBoostsCaught+s.transferPartnerPointsEarned/p.partnerPointsPerUnit)/p.transferMinimum,'transfer_boost_points',s.transferPartnerPointsEarned],
        ['award_hunter',s.awardAvailabilityTriggered ? s.awardAvailabilityPointsEarned/p.awardMinimum : 0,'award_points',s.awardAvailabilityPointsEarned],
      ].filter(([,strength])=>strength>=1).sort((a,b)=>b[1]-a[1])[0];
      if (positive) { category=positive[0]; signal={name:positive[2],value:positive[3]}; }
    }
  }
  const selected = content[category];
  return {type:selected.type,category,eyebrow:selected.eyebrow,title:selected.title,message:selected.message(s),ctaText:selected.ctaText,url:recommendationURL(links[selected.destination],category),trackingId:selected.trackingId,primaryGameplaySignal:signal};
}
export function recommendationTracking(recommendation, stats) {
  return {recommendation_type:recommendation.type,recommendation_category:recommendation.category,tracking_id:recommendation.trackingId,final_score:stats.finalScore,rank:stats.rank,primary_gameplay_signal:recommendation.primaryGameplaySignal};
}
