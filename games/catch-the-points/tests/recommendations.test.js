import test from 'node:test';
import assert from 'node:assert/strict';
import { Game, rankFor } from '../../../public/games/catch-the-points/src/game.js';
import { CONFIG } from '../../../public/games/catch-the-points/src/config.js';
import { getPostGameRecommendation as recommend, buildRecommendationStats, recommendationURL, recommendationTracking } from '../../../public/games/catch-the-points/src/recommendations.js';
import { setupRecommendation } from '../../../public/games/catch-the-points/src/recommendation-view.js';
const baseline={finalScore:4000,rank:rankFor(4000),totalPositivePointsEarned:4000};
const category=stats=>recommend({...baseline,...stats}).category;
for (const [name,stats,expected] of [
  ['A: repeated interest on a low score',{finalScore:500,interestHits:2,interestDamage:300},'interest'],
  ['B: carrying a balance overrides expert and all other signals',{gameEndedByCarryingBalance:true,interestHits:5,finalScore:50000,rank:rankFor(50000),welcomeBonusCaught:20},'carrying_balance'],
  ['C: many welcome bonuses on a strong run',{finalScore:15000,totalPositivePointsEarned:15000,welcomeBonusCaught:8,rank:rankFor(15000),longestCombo:10},'welcome_bonus'],
  ['D: actual devaluation damage exceeds more frequent fees',{devaluationHits:2,devaluationDamage:1850,dynamicPricingHits:4,dynamicPricingDamage:1200,annualFeeHits:3,annualFeeDamage:600},'devaluation'],
  ['E: dynamic pricing does the greatest damage',{dynamicPricingHits:5,dynamicPricingDamage:1500,devaluationDamage:900},'dynamic_pricing'],
  ['F: award window earns substantial points',{awardAvailabilityTriggered:true,awardAvailabilityPointsEarned:4000},'award_hunter'],
  ['G: legend with low damage gets an expert insight',{finalScore:31000,rank:rankFor(31000),totalPositivePointsEarned:31200,annualFeeDamage:200},'expert'],
  ['H: weak fee signal yields to welcome bonuses',{finalScore:15000,totalPositivePointsEarned:15200,annualFeeHits:1,annualFeeDamage:200,welcomeBonusCaught:8},'welcome_bonus'],
  ['I: no meaningful signal gets a neutral fallback',{},'general'],
  ['transfer boosts and earnings compete with welcome catches',{transferBonusCaught:2,transferPartnerBoostsCaught:2,transferPartnerPointsEarned:4000,welcomeBonusCaught:4},'transfer_bonus'],
  ['golden bonuses have extra weight',{goldenWelcomeBonusCaught:2},'welcome_bonus'],
  ['meaningful annual fee insight works with no article',{annualFeeDamage:1000},'annual_fees'],
  ['zero actual loss is not a biggest enemy',{annualFeeHits:10,annualFeeDamage:0},'general'],
]) test(name,()=>assert.equal(category(stats),expected));

test('recommendations are deterministic and CTA destinations are safe and preserve queries',()=>{
  const s={...baseline,welcomeBonusCaught:8};
  assert.deepEqual(recommend(s),recommend(s));
  const url=new URL(recommend(s).url);
  assert.equal(url.searchParams.get('type'),'noi-bat');
  assert.equal(url.searchParams.get('utm_source'),'catch-the-points');
  assert.equal(url.searchParams.get('utm_medium'),'game');
  assert.equal(url.searchParams.get('utm_campaign'),'post-game');
  assert.equal(url.searchParams.get('utm_content'),'welcome-bonus');
  const fees=new URL(recommend({...baseline,annualFeeDamage:1000}).url);
  assert.equal(fees.pathname,'/blog/3-dieu-uoc-gi-biet-truoc-mile-points');
  assert.equal(fees.searchParams.get('utm_content'),'annual-fees');
  // Destination chưa có bài thì insight vẫn hiện, chỉ CTA là ẩn.
  assert.equal(recommend({...baseline,annualFeeDamage:1000},{annualFees:null}).url,null);
  for(const value of [null,'','/bad','javascript:alert(1)','https://affiliate.test','https://ghe1a.com.evil.test','http://ghe1a.com','https://user:pass@ghe1a.com']) assert.equal(recommendationURL(value,'general'),null);
  assert.equal(category({interestDamage:NaN,annualFeeDamage:Infinity}), 'general');
});
const caught=(g,type,program=0)=>g.catch({type,program,x:g.x});
test('damage records clamped actual losses including rounded percentage surprise events',()=>{
  const g=new Game();g.start();g.score=100;caught(g,'fee');
  assert.equal(g.damage.fee,100);assert.equal(g.score,0);
  caught(g,'interest');assert.equal(g.damage.interest,0);assert.equal(g.stats.interest,1);
  g.score=8250;caught(g,'devaluation');assert.equal(g.damage.devaluation,1650);assert.equal(g.score,6600);
  g.triggerEvent('devaluation');assert.equal(g.damage.devaluation,2640);assert.equal(g.score,5610);
  g.start();assert.deepEqual(g.damage,{dynamic:0,fee:0,interest:0,devaluation:0});
});
test('earnings capture actual gains, award and selected partner windows, and reset each run',()=>{
  const g=new Game({random:()=>0});g.start();g.startAward();caught(g,'partner');
  const before=g.score;caught(g,'normal',0);
  assert.equal(g.earnings.partner,g.score-before);assert.equal(g.earnings.award,g.score);assert.equal(g.earnings.total,g.score);
  const boost=g.earnings.partner;caught(g,'normal',1);assert.equal(g.earnings.partner,boost);
  caught(g,'welcome');caught(g,'golden');caught(g,'transfer');
  g.end('time');const s=buildRecommendationStats(g,10000);
  assert.equal(s.normalPointsCaught,2);assert.equal(s.welcomeBonusCaught,1);assert.equal(s.goldenWelcomeBonusCaught,1);assert.equal(s.transferBonusCaught,1);assert.equal(s.transferPartnerBoostsCaught,1);assert.equal(s.awardAvailabilityTriggered,true);assert.equal(s.personalBest,10000);assert.equal(s.finalScore,g.score);
  g.start();assert.deepEqual(g.earnings,{total:0,award:0,partner:0});
  g.score=CONFIG.maxScore-10;caught(g,'welcome');assert.equal(g.earnings.total,10);
});
test('one recommendation impression per render; replay replaces click payload without duplicate listeners',()=>{
  const nodes=new Map();const root={getElementById:id=>{if(!nodes.has(id)) nodes.set(id,{hidden:true,handlers:[],addEventListener(_event,fn){this.handlers.push(fn);},removeAttribute(key){delete this[key];}});return nodes.get(id);}};
  const events=[];const render=setupRecommendation((event,payload)=>events.push({event,payload}),root);
  render(baseline);const link=nodes.get('recommendation-link');link.handlers[0]();
  assert.equal(events[0].event,'post_game_recommendation_shown');assert.equal(events[1].event,'post_game_recommendation_clicked');
  assert.deepEqual(events[0].payload,recommendationTracking(recommend(baseline),baseline));
  render({...baseline,welcomeBonusCaught:8});link.handlers[0]();
  assert.equal(link.handlers.length,1);assert.equal(events.at(-1).payload.recommendation_category,'welcome_bonus');
  const renderNoArticle=setupRecommendation((event,payload)=>events.push({event,payload}),root,{annualFees:null});
  renderNoArticle({...baseline,annualFeeDamage:1000});assert.equal(link.hidden,true);assert.equal(link.href,undefined);
  const count=events.length;link.handlers[0]();assert.equal(events.length,count);
});
