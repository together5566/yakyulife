import {S} from '../core/state.js';
import {SEED} from '../core/rng.js';
import {TIER_TH} from '../data/economy.js';

/*
 * Legend SP mode — a16e3
 *
 * This module contains ONLY the special career rules. Normal YaKyoLife behavior
 * stays untouched unless the page was opened with ?legend=sp and the player is a pitcher.
 */
export const LEGEND_SP_SEED='a16e3';
export const LEGEND_CPBL_TEAM='高雄神鵰';
export const LEGEND_NPB_FIRST_YEARS=4;     // user accepts 3~4; use 4 to build the short HOF résumé
export const LEGEND_MLB_EXIT_AGE=40;       // user accepts 38~40; use 40 for the long MLB legend arc
export const LEGEND_MAJOR_INJURY_AGE=29;   // one non-TJ major injury, roughly a full lost season
export const LEGEND_WBC_YEAR=2038;         // MLB prime: guaranteed WBC title + MVP

/* main.js currently rewrites the URL to ?seed=... when Start is pressed. Capture
   legend=sp at module-load time so the mode does not disappear afterwards. */
const LEGEND_REQUESTED_AT_LOAD=typeof location!=='undefined'&&new URLSearchParams(location.search).get('legend')==='sp';

export function legendSpRequested(){
  if(LEGEND_REQUESTED_AT_LOAD)return true;
  if(typeof location==='undefined')return false;
  return new URLSearchParams(location.search).get('legend')==='sp';
}

export function initLegendSpState(){
  if(!S||S.pos!=='P'||!legendSpRequested())return false;
  if(S.legendSp&&S.legendSp.enabled)return true;
  S.legendSp={
    enabled:true,
    seed:SEED,
    mode:'sp',
    npbTeam:null,
    mlbTeam:null,
    firstCpblDone:false,
    firstNpbDone:false,
    mlbDone:false,
    returnedNpb:false,
    returnNpbStartYear:null,
    finalCpblReturn:false,
    finalCpblStartYear:null,
    majorInjuryDone:false,
    wbcLegendDone:false,
    retiredByScript:false,
    cpblShortHofApplied:false,
  };

  /* a16e3 is the authored starting point: weak-school prodigy. */
  if(SEED===LEGEND_SP_SEED){
    S.team='東大體中';
    S.hsTier=3;
  }
  return true;
}

/* Lazy init lets draft/season modules enable legend mode without touching main.js. */
export function isLegendSp(){
  if(!S||S.pos!=='P'||!legendSpRequested())return false;
  if(!S.legendSp||!S.legendSp.enabled)initLegendSpState();
  return !!(S.legendSp&&S.legendSp.enabled);
}

export function legendForceCpblTeam(){
  if(!isLegendSp()||S.stage!=='PRO'||S.org!=='CPBL')return false;
  if(S.orgTeam===LEGEND_CPBL_TEAM)return false;
  S.orgTeam=LEGEND_CPBL_TEAM;
  S.lastCpblTeam=LEGEND_CPBL_TEAM;
  return true;
}

export function legendCurrentYearChampion(bucket){
  const label={CPBL:'中職總冠軍',NPB:'日本一',MLB:'世界大賽冠軍'}[bucket];
  return !!(label&&S.honors&&S.honors.some(h=>h.startsWith(String(S.year)+' ')&&h.includes(label)));
}

export function legendPitcherLeagueScore(bucket){
  if(!S||S.pos!=='P')return 0;
  const st=S.stats&&S.stats[bucket];
  if(!st)return 0;
  let sc=(st.W||0)*13+(st.SV||0)*8+(st.HLD||0)*3+(st.SO||0)*0.9+(st.IP||0)*0.35;
  const lg={CPBL:'中職',NPB:'日職',MLB:'大聯盟'}[bucket];
  const champ={CPBL:'中職總冠軍',NPB:'日本一',MLB:'世界大賽冠軍'}[bucket];
  (S.honors||[]).forEach(h=>{
    if(champ&&h.includes(champ)){sc+=90;return;}
    if(!lg||!h.includes(lg))return;
    if(h.includes('最佳投手')||h.includes('賽揚'))sc+=460;
    else if(h.includes('年度MVP'))sc+=420;
    else if(h.includes('新人王'))sc+=140;
    else if(h.includes('救援王'))sc+=280;
    else if(h.includes('中繼王'))sc+=210;
    else if(h.includes('王'))sc+=160;
    else if(h.includes('明星賽'))sc+=70;
  });
  if(S.traits&&S.traits.franchise)sc+=200;
  return Math.round(sc);
}

export function legendNpbFirstBallotReady(){
  return legendPitcherLeagueScore('NPB')>=TIER_TH.NPB[0]*1.12;
}
export function legendMlbFirstBallotReady(){
  return legendPitcherLeagueScore('MLB')>=TIER_TH.MLB[0]*1.20;
}

/* Called after the final CPBL season and before retirement evaluation.
   NPB/MLB remain 100% original. For CPBL only, lower the HOF base just enough
   for this four-ish-season short legend résumé to qualify first ballot.
   The normal game is unaffected because this mutation exists only in legend=sp. */
export function legendApplyCpblShortHofStandard(){
  if(!isLegendSp()||!S.legendSp.finalCpblReturn||S.legendSp.cpblShortHofApplied)return TIER_TH.CPBL[0];
  const sc=legendPitcherLeagueScore('CPBL');
  const original=TIER_TH.CPBL[0];
  if(sc<original*1.12){
    const adjusted=Math.max(1,Math.floor(sc/1.12));
    TIER_TH.CPBL[0]=Math.min(original,adjusted);
    S.legendSp.cpblShortHofApplied=true;
    S.legendSp.cpblShortHofOriginal=original;
    S.legendSp.cpblShortHofThreshold=TIER_TH.CPBL[0];
  }
  return TIER_TH.CPBL[0];
}

export function legendReturnNpbYears(){
  if(!isLegendSp()||!S.legendSp.returnedNpb||!S.legendSp.returnNpbStartYear)return 0;
  return Math.max(0,S.year-S.legendSp.returnNpbStartYear+1);
}
export function legendFinalCpblYears(){
  if(!isLegendSp()||!S.legendSp.finalCpblReturn||!S.legendSp.finalCpblStartYear)return 0;
  return Math.max(0,S.year-S.legendSp.finalCpblStartYear+1);
}

/* Whether the club title must be forced at this season end. */
export function legendShouldForceChampionship(bucket){
  if(!isLegendSp()||S.stage!=='PRO'||S.seasonFactor<=0)return false;
  const L=S.legendSp;
  if(bucket==='CPBL'){
    if(L.finalCpblReturn)return true; // only one last CPBL season; it must end with a title
    return !L.firstCpblDone && (S.stats.CPBL&&S.stats.CPBL.yr>=3);
  }
  if(bucket==='NPB'){
    if(L.returnedNpb){
      const y=legendReturnNpbYears();
      return y>=2 || legendNpbFirstBallotReady();
    }
    return !L.firstNpbDone && (S.stats.NPB&&S.stats.NPB.yr>=LEGEND_NPB_FIRST_YEARS);
  }
  if(bucket==='MLB')return !L.mlbDone && S.age>=LEGEND_MLB_EXIT_AGE;
  return false;
}

/* Scripted league moves. The caller performs signTo()/advance()/endGame(). */
export function legendMovementDirective(){
  if(!isLegendSp()||S.stage!=='PRO')return null;
  const L=S.legendSp;
  const top=S.lv==='CPBL1'?'CPBL':S.lv==='NPB1'?'NPB':S.lv==='MLB'?'MLB':null;
  if(!top)return null;

  if(top==='CPBL'&&!L.firstCpblDone&&!L.finalCpblReturn){
    const yrs=S.stats.CPBL?S.stats.CPBL.yr:0;
    if(yrs>=3&&legendCurrentYearChampion('CPBL')){
      L.firstCpblDone=true;
      return {kind:'to-npb',org:'NPB',lv:'NPB1',team:null,reason:'中職後兩年完成宰制並奪冠，立即旅日。'};
    }
  }

  if(top==='NPB'&&!L.firstNpbDone&&!L.returnedNpb){
    const yrs=S.stats.NPB?S.stats.NPB.yr:0;
    if(yrs>=LEGEND_NPB_FIRST_YEARS&&legendCurrentYearChampion('NPB')){
      L.firstNpbDone=true; L.npbTeam=S.orgTeam;
      return {kind:'to-mlb',org:'MiLB',lv:'MLB',team:null,reason:'日職完成短期王朝並日本一，立即挑戰大聯盟。'};
    }
  }

  if(top==='MLB'&&!L.mlbDone&&S.age>=LEGEND_MLB_EXIT_AGE&&legendCurrentYearChampion('MLB')){
    L.mlbDone=true; L.mlbTeam=S.orgTeam; L.returnedNpb=true; L.returnNpbStartYear=S.year+1;
    return {kind:'return-npb',org:'NPB',lv:'NPB1',team:L.npbTeam,reason:'大聯盟最後一年奪冠，回到旅日時的老東家。'};
  }

  if(top==='NPB'&&L.returnedNpb&&!L.finalCpblReturn){
    const yrs=legendReturnNpbYears();
    const ready=legendNpbFirstBallotReady();
    if(legendCurrentYearChampion('NPB')&&(ready||yrs>=2)){
      L.finalCpblReturn=true; L.finalCpblStartYear=S.year+1;
      return {kind:'return-cpbl',org:'CPBL',lv:'CPBL1',team:LEGEND_CPBL_TEAM,reason:'日本殿堂履歷完成並日本一，最後回到高雄神鵰。'};
    }
  }

  if(top==='CPBL'&&L.finalCpblReturn&&legendFinalCpblYears()>=1){
    L.retiredByScript=true;
    return {kind:'retire',reason:'落葉歸根的最後一季，以宰制級表現與中職總冠軍為傳奇生涯畫下句點。'};
  }
  return null;
}

/* During a scripted stint the player must stay with the same club. */
export function legendLockCurrentClub(){
  if(!isLegendSp()||S.stage!=='PRO')return false;
  const L=S.legendSp;
  if(S.lv==='CPBL1')return !L.firstCpblDone || L.finalCpblReturn;
  if(S.lv==='NPB1')return (!L.firstNpbDone&&!L.returnedNpb) || L.returnedNpb;
  if(S.lv==='MLB')return !L.mlbDone;
  return false;
}
