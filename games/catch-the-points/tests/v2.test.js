import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../../../public/games/catch-the-points/src/game.js';
import { CONFIG } from '../../../public/games/catch-the-points/src/config.js';
import { createProfile, safeScore } from '../../../public/games/catch-the-points/src/profile.js';
import { parseChallenge, gameURL, sharePayload } from '../../../public/games/catch-the-points/src/challenge.js';
import { nativeShare } from '../../../public/games/catch-the-points/src/share.js';
import { earnedAchievements } from '../../../public/games/catch-the-points/src/achievements.js';
import { createAnalytics } from '../../../public/games/catch-the-points/src/analytics.js';
import { summaryFor } from '../../../public/games/catch-the-points/src/personality.js';

const round = () => { const game = new Game({random: () => .4}); game.start(); return game; };
const good = game => game.catch({type:'normal',program:0,x:100});
test('combo thresholds apply to the threshold catch, stay capped, and specials stay fixed', () => {
  const game = round();
  for(let i=0;i<2;i++) good(game);
  assert.equal(game.score,200); good(game); assert.equal(game.score,400);
  for(let i=0;i<3;i++) good(game); assert.equal(game.comboMultiplier,3);
  for(let i=0;i<4;i++) good(game); assert.equal(game.comboMultiplier,5);
  game.chaos=true; game.triggerEvent('category');
  const before=game.score; good(game); assert.equal(game.score-before,1000);
  game.catch({type:'welcome'}); assert.equal(game.score-before,1500);
  assert.equal(game.stats.longestCombo,12);
});
test('all bad items reset a combo, including surprise devaluation', () => {
  for(const type of ['fee','dynamic','interest','devaluation','balance']) {
    const game=round(); for(let i=0;i<10;i++) good(game);
    game.catch({type}); assert.equal(game.combo,0); assert.equal(game.comboMultiplier,1);
    assert.equal(game.stats.longestCombo,10);
  }
  const game=round(); good(game); game.triggerEvent('devaluation'); assert.equal(game.combo,0);
});
test('personal best survives a fresh profile and storage failures are harmless', () => {
  let saved=null; const storage={getItem:()=>saved,setItem:(_key,value)=>{saved=value;}};
  const profile=createProfile(()=>storage);
  assert.equal(profile.record(100).newBest,true); assert.equal(profile.record(90).newBest,false);
  assert.equal(createProfile(()=>storage).best,100);
  const restricted=createProfile(()=>{throw Error('blocked');});
  assert.equal(restricted.record(200).newBest,true); assert.equal(restricted.best,200);
  saved='broken json'; assert.equal(createProfile(()=>storage).best,0);
  saved='{"best": "NaN"}'; assert.equal(createProfile(()=>storage).best,0);
});
test('invalid numeric inputs cannot poison score, movement or timer', () => {
  const game=round(); const x=game.x; game.move(NaN); game.resize(0,0); game.update(Infinity);
  assert.equal(game.x,x); assert.equal(game.elapsed,0);
  game.score=NaN; good(game); assert.equal(game.score,100);
  for(const value of [NaN,Infinity,-Infinity,-5]) assert.equal(safeScore(value),0);
});
test('adaptive difficulty is mild and hazards retain an escape corridor', () => {
  const game=round(); game.score=999999; assert.equal(game.performanceScale,0);
  game.elapsed=30; assert.equal(game.performanceScale,1);
  assert.ok(game.spawnWeights.interest <= game.stage.weights.interest * CONFIG.adaptive.maxDanger);
  game.resize(320,500); game.items=[{type:'interest',x:65,y:-64,speed:200},{type:'fee',x:160,y:-64,speed:200}];
  assert.equal(game.hasEscapeLane({type:'balance',x:255,y:-64,speed:200}),false);
  assert.equal(game.hasEscapeLane({type:'balance',x:65,y:-64,speed:200}),true);
});
test('golden bonus is fixed, separately counted, and power-ups replace instead of stacking', () => {
  const game=round(); game.combo=10; game.chaos=true; game.triggerEvent('category');
  game.catch({type:'golden'}); assert.equal(game.score,1500); assert.equal(game.stats.golden,1);
  assert.deepEqual(game.bonusStats.golden,{catches:1,points:1500});
  game.catch({type:'partner'}); const selected=game.partner.program;
  game.catch({type:'partner'}); assert.equal(game.partner.program,selected);
  assert.equal(game.normalMultiplier(selected),10);
  game.update(5.1); assert.equal(game.partner,null);
  game.start(); assert.equal(game.stats.golden,0); assert.equal(game.combo,0);
});
test('partner boosts only its own currency and increases that currency spawn share', () => {
  const game=round(); game.boostPartner(); game.multiplier=1;
  assert.equal(game.normalMultiplier(game.partner.program),2);
  assert.equal(game.normalMultiplier((game.partner.program+1)%7),1);
  game.random=()=>0.1; game.spawn(); assert.equal(game.items[0].program,game.partner.program);
});
test('award window improves good/bad odds, credits catches, expires and never repeats', () => {
  const game=round(); game.elapsed=26; const before=game.spawnWeights;
  game.startAward(); const until=game.awardUntil;
  assert.ok(game.spawnWeights.normal>before.normal); assert.ok(game.spawnWeights.interest<before.interest);
  good(game); assert.equal(game.stats.awardCatches,1);
  game.elapsed++; game.startAward(); assert.equal(game.awardUntil,until);
  game.update(5); assert.equal(game.awardActive,false); game.startAward(); assert.equal(game.awardActive,false);
  game.start(); assert.equal(game.awardUsed,false); assert.equal(game.stats.awardCatches,0);
});
test('near misses never award points and have a cooldown', () => {
  const events=[]; const game=new Game({random:()=>0,emit:event=>events.push(event)}); game.start(); game.spawnIn=99;
  const near=()=>({type:'interest',x:game.x+74,y:game.playerY+79,speed:100});
  game.items=[near()]; game.update(.02); assert.equal(events.filter(e=>e.kind==='near-miss').length,1); assert.equal(game.score,0);
  game.items=[near()]; game.update(.02); assert.equal(events.filter(e=>e.kind==='near-miss').length,1);
});
test('challenge URLs reject malformed inputs, clamp large integers, and strip unrelated parameters', () => {
  for(const query of ['', '?challenge=-1','?challenge=NaN','?challenge=Infinity','?challenge=1.5','?challenge=1e4','?challenge=%3Cscript%3E','?challenge=2&challenge=3']) assert.equal(parseChallenge(query),null);
  assert.equal(parseChallenge('?challenge=14280'),14280);
  assert.equal(parseChallenge('?challenge=9999999999999999'),CONFIG.maxScore);
  assert.equal(parseChallenge('?challenge=0'),0);
  assert.equal(gameURL('https://game.test/play?private=abc#other',14280),'https://game.test/play?challenge=14280');
  assert.throws(()=>gameURL('javascript:alert(1)'));
});
test('a challenge celebrates once when strictly exceeded and resets on replay', () => {
  const events=[]; const game=new Game({challengeTarget:100,emit:e=>events.push(e)});game.start();good(game);
  assert.equal(game.challengeBeaten,false);good(game);good(game);
  assert.equal(events.filter(e=>e.kind==='challenge-beaten').length,1);
  game.start();assert.equal(game.challengeTarget,100);assert.equal(game.challengeBeaten,false);
});
test('share payload includes the actual route and native cancellation does not trigger fallback', async () => {
  const payload=sharePayload({score:14280,rank:'SEAT 1A'},'http://192.168.0.107:5173/',true);
  assert.equal(payload.url,'http://192.168.0.107:5173/?challenge=14280');assert.match(payload.text,/14,280/);
  assert.equal(await nativeShare(payload,{}),'fallback');
  assert.equal(await nativeShare(payload,{share:async()=>{}}),'shared');
  assert.equal(await nativeShare(payload,{share:async()=>{throw {name:'AbortError'};}}),'cancelled');
  assert.equal(await nativeShare(payload,{share:async()=>{throw {name:'NotAllowedError'};}}),'fallback');
});
test('achievements are earned once, survive reload, and completion awards exclude fatal runs', () => {
  const result={score:30000,reason:'time',stats:{interest:0,longestCombo:12,golden:1,awardCatches:3,devaluations:3}};
  assert.equal(earnedAchievements(result).length,6);
  const fatal=earnedAchievements({...result,reason:'balance'});
  assert.ok(!fatal.includes('paid-in-full')); assert.ok(!fatal.includes('survivor'));
  let saved;const storage={getItem:()=>saved,setItem:(_key,value)=>{saved=value;}};
  const profile=createProfile(()=>storage);assert.equal(profile.record(30000,earnedAchievements(result)).unlocked.length,6);
  assert.equal(createProfile(()=>storage).record(30000,earnedAchievements(result)).unlocked.length,0);
});
test('analytics are structured, allowlisted and cannot interrupt gameplay', () => {
  const events=[];const track=createAnalytics(event=>events.push(event));
  track('game_started',{challenge:true});track('unknown');
  assert.deepEqual(events,[{event:'game_started',version:2,challenge:true}]);
  assert.doesNotThrow(()=>createAnalytics(()=>{throw Error('provider failed');})('personal_best'));
});
test('one contextual result summary uses fatal and strong patterns first', () => {
  const stats={interest:0,longestCombo:20,golden:0,fees:0,dynamic:4};
  assert.equal(summaryFor({reason:'balance',score:10000,stats}),'The points weren’t worth the interest.');
  assert.equal(summaryFor({reason:'time',score:10000,stats}),'Aeroplan had other plans.');
});
