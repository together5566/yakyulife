import {S} from '../core/state.js';
import {SEED} from '../core/rng.js';
import {LV} from '../data/teams.js';
import {TIER_TH} from '../data/economy.js';
import {card} from '../ui/dom.js';

/*
 * Legend SP mode — a16e3
 *
 * 原版仍照常跑能力、事件、感情、球季模擬與 RNG；只有 URL 啟用 legend=sp
 * 且角色為投手時，才在「球季結束、正式跨年以前」修正傳奇劇本硬條件。
 */
export const LEGEND_SP_SEED='a16e3';
export const LEGEND_CPBL_TEAM='高雄神鵰';
export const LEGEND_NPB_FIRST_YEARS=4;
export const LEGEND_MLB_EXIT_AGE=40;
export const LEGEND_MAJOR_INJURY_AGE=29;
export const LEGEND_WBC_YEAR=2038;

/* main.js 開始遊戲後會把網址整理成 ?seed=...，所以啟動時先把 legend=sp 記住。 */
const LEGEND_SP_URL_REQUESTED=typeof location!=='undefined'
  &&new URLSearchParams(location.search).get('legend')==='sp';

export function legendSpRequested(){ return LEGEND_SP_URL_REQUESTED; }

export function initLegendSpState(){
  if(!S||S.pos!=='P'||!LEGEND_SP_URL_REQUESTED)return false;
  if(S.legendSp&&S.legendSp.enabled)return true;
  S.legendSp={
    enabled:true,seed:SEED,mode:'sp',npbTeam:null,mlbTeam:null,
    firstCpblDone:false,firstNpbDone:false,mlbDone:false,
    returnedNpb:false,returnNpbStartYear:null,finalCpblReturn:false,finalCpblStartYear:null,
    majorInjuryDone:false,wbcLegendDone:false,retiredByScript:false,
    cpblShortHofApplied:false,processedYears:{},
  };
  if(SEED===LEGEND_SP_SEED){ S.team='東大體中'; S.hsTier=3; }
  return true;
}

export function isLegendSp(){
  if(S&&S.pos==='P'&&LEGEND_SP_URL_REQUESTED&&!(S.legendSp&&S.legendSp.enabled))initLegendSpState();
  return !!(S&&S.legendSp&&S.legendSp.enabled);
}

/* 開始按鈕建立 S 後，第一時間初始化。 */
if(typeof window!=='undefined'&&LEGEND_SP_URL_REQUESTED){
  const timer=setInterval(()=>{ if(S){ initLegendSpState(); clearInterval(timer); } },20);
}

export function legendForceCpblTeam(){
  if(!isLegendSp()||S.stage!=='PRO'||S.org!=='CPBL')return false;
  if(S.orgTeam===LEGEND_CPBL_TEAM)return false;
  S.orgTeam=LEGEND_CPBL_TEAM; S.lastCpblTeam=LEGEND_CPBL_TEAM; return true;
}

function lastSeasonBucket(){ const l=S&&S.lastLv&&LV[S.lastLv]; return l&&l.top?l.top:null; }
function addHonor(label){ const h=`${S.year} ${label}`; if(!S.honors.includes(h))S.honors.push(h); }
function removeCurrentHonors(re){ S.honors=S.honors.filter(h=>!(h.startsWith(String(S.year)+' ')&&re.test(h))); }
function leagueName(bucket){ return {CPBL:'中職',NPB:'日職',MLB:'大聯盟'}[bucket]; }
function champName(bucket){ return {CPBL:'中職總冠軍',NPB:'日本一',MLB:'世界大賽冠軍'}[bucket]; }

export function legendCurrentYearChampion(bucket){
  const label=champName(bucket);
  return !!(label&&S.honors&&S.honors.some(h=>h.startsWith(String(S.year)+' ')&&h.includes(label)));
}

export function legendPitcherLeagueScore(bucket){
  if(!S||S.pos!=='P')return 0;
  const st=S.stats&&S.stats[bucket]; if(!st)return 0;
  let sc=(st.W||0)*13+(st.SV||0)*8+(st.HLD||0)*3+(st.SO||0)*0.9+(st.IP||0)*0.35;
  const lg=leagueName(bucket),champ=champName(bucket);
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
export function legendNpbFirstBallotReady(){ return legendPitcherLeagueScore('NPB')>=TIER_TH.NPB[0]*1.12; }
export function legendMlbFirstBallotReady(){ return legendPitcherLeagueScore('MLB')>=TIER_TH.MLB[0]*1.20; }

export function legendApplyCpblShortHofStandard(){
  if(!isLegendSp()||!S.legendSp.finalCpblReturn||S.legendSp.cpblShortHofApplied)return TIER_TH.CPBL[0];
  const sc=legendPitcherLeagueScore('CPBL'), original=TIER_TH.CPBL[0];
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

/* ---------- 球季履歷後製 ---------- */
const STAT_KEYS=['G','H','BB','W','L','SV','HLD','SO','ER'];
function pitcherLine(st){
  const era=st.IP>0?(st.ER*9/st.IP).toFixed(2):'-', whip=st.IP>0?((st.H+st.BB)/st.IP).toFixed(2):'-';
  return `出賽 ${st.G}｜局數 ${st.IP.toFixed(1)}｜${st.W}勝${st.L}敗｜三振 ${st.SO}｜保送 ${st.BB}｜ERA ${era}｜WHIP ${whip}`;
}
function replaceLastPitcherSeason(bucket,target,inj=false){
  const st=S.lastSt,total=S.stats&&S.stats[bucket]; if(!st||!total)return;
  const old={}; STAT_KEYS.forEach(k=>old[k]=Number(st[k])||0); old.IP=Number(st.IP)||0;
  const era=target.era,ip=+target.IP.toFixed(1);
  const bb=target.BB!=null?target.BB:Math.max(5,Math.round(ip/9*1.25));
  const h=target.H!=null?target.H:Math.max(8,Math.round(ip/9*(era>=2.5?7.0:era>=1.2?5.6:4.4)));
  const neu={...st,role:'SP',G:target.G,IP:ip,W:target.W,L:target.L,SV:0,HLD:0,SO:target.SO,
    BB:bb,H:h,ER:Math.max(0,Math.round(era*ip/9)),d:target.d==null?20:target.d};
  neu.era=neu.IP>0?+(neu.ER*9/neu.IP).toFixed(2):0;
  neu.WHIP=neu.IP>0?+((neu.H+neu.BB)/neu.IP).toFixed(2):0; neu.payD=neu.d;
  STAT_KEYS.forEach(k=>{ total[k]=(total[k]||0)+(neu[k]||0)-old[k]; });
  total.IP=+(Number(total.IP||0)+neu.IP-old.IP).toFixed(1);
  Object.assign(st,neu); S.lastD=neu.d; S.lastPayD=neu.payD; S.role='SP';
  const row=[...(S.log||[])].reverse().find(r=>r.y===S.year&&r.st&&(r.lv===S.lastLv||r.st===st));
  if(row){ row.st=st; row.role='SP'; row.inj=!!inj; row.line=(inj?'重大傷勢・幾乎整季報銷｜':'')+pitcherLine(st); }
}

function cpblTarget(){
  const yr=S.stats.CPBL?S.stats.CPBL.yr:0,L=S.legendSp;
  if(L.finalCpblReturn)return {G:30,IP:225,W:28,L:0,SO:420,era:.44,BB:20,H:82,d:30};
  if(yr<=1)return {G:26,IP:154,W:10,L:8,SO:145,era:3.27,BB:46,H:132,d:2};
  if(yr===2)return {G:30,IP:210,W:24,L:2,SO:330,era:.89,BB:24,H:108,d:25};
  return {G:30,IP:220,W:27,L:1,SO:390,era:.61,BB:19,H:94,d:30};
}
function npbTarget(){
  const L=S.legendSp;
  if(L.returnedNpb){ const y=legendReturnNpbYears(); return y<=1
    ?{G:30,IP:225,W:27,L:1,SO:405,era:.67,BB:20,H:100,d:30}
    :{G:30,IP:230,W:28,L:0,SO:430,era:.51,BB:18,H:92,d:32}; }
  const y=S.stats.NPB?S.stats.NPB.yr:1;
  const list=[
    {G:29,IP:205,W:22,L:3,SO:315,era:1.18,BB:28,H:118,d:22},
    {G:30,IP:215,W:24,L:2,SO:350,era:.96,BB:25,H:108,d:25},
    {G:30,IP:220,W:26,L:2,SO:380,era:.79,BB:22,H:101,d:28},
    {G:30,IP:225,W:27,L:1,SO:410,era:.63,BB:20,H:95,d:30},
  ];
  return list[Math.min(list.length-1,Math.max(0,y-1))];
}
function mlbTarget(){
  const a=S.age;
  if(a===LEGEND_MAJOR_INJURY_AGE)return {G:6,IP:38,W:3,L:1,SO:58,era:2.61,BB:11,H:30,d:8,inj:true};
  if(a>=39)return a>=40
    ?{G:32,IP:248,W:28,L:0,SO:445,era:.47,BB:18,H:102,d:36}
    :{G:32,IP:242,W:26,L:1,SO:402,era:.71,BB:20,H:108,d:34};
  if(a>=35)return {G:31,IP:205,W:17,L:7,SO:285,era:2.72,BB:42,H:158,d:13};
  if(a>=30)return {G:31,IP:225,W:23,L:3,SO:365,era:1.08,BB:28,H:122,d:28};
  return {G:30,IP:210,W:21,L:4,SO:325,era:1.42,BB:31,H:128,d:23};
}

function ensureDominantAwards(bucket,rookieOnly=false){
  const lg=leagueName(bucket); if(!lg)return;
  if(rookieOnly){
    removeCurrentHonors(new RegExp(`${lg}.*(年度MVP|最佳投手|賽揚|三振王|勝投王|防禦率王)`));
    addHonor(`${lg}新人王`); return;
  }
  addHonor(bucket==='MLB'?`${lg}賽揚獎`:`${lg}最佳投手`);
  addHonor(`${lg}年度MVP`); addHonor(`${lg}三振王`); addHonor(`${lg}勝投王`);
  addHonor(`${lg}防禦率王`); addHonor(`${lg}明星賽`);
}

function forceWbcLegend(){
  if(!isLegendSp()||S.year!==LEGEND_WBC_YEAR||S.legendSp.wbcLegendDone)return;
  const row=[...(S.intlLog||[])].reverse().find(r=>r.year===S.year&&r.name==='世界棒球經典賽');
  if(!row)return;
  const old={...row.st},neu={G:2,IP:13,SO:25,ER:0,W:2,SV:0},IS=S.intlStat;
  ['G','SO','ER','W','SV'].forEach(k=>IS[k]=(IS[k]||0)+(neu[k]||0)-(old[k]||0));
  IS.IP=+(Number(IS.IP||0)+neu.IP-(Number(old.IP)||0)).toFixed(1);
  row.rank='冠軍'; row.teamGames=7; row.st={...neu};
  removeCurrentHonors(/世界棒球經典賽(亞軍|四強止步|八強止步|預賽出局|MVP|冠軍)/);
  addHonor('世界棒球經典賽冠軍'); addHonor('世界棒球經典賽MVP');
  S.intlTop4=Math.max(2,S.intlTop4||0);
  if(!S.traits.intlace){ S.traits.intlace=true;
    card('gold','國際賽傳奇','經典賽冠軍戰再次站上最高壓力的舞台，你不只帶回冠軍，也抱走賽會 MVP——<b class="hl">國際賽之鬼</b>正式刻進你的生涯。'); }
  S.legendSp.wbcLegendDone=true;
}

function forceRequiredChampionship(bucket){
  if(!bucket||legendCurrentYearChampion(bucket))return false;
  const L=S.legendSp; let force=false;
  if(bucket==='CPBL'){
    if(L.finalCpblReturn)force=true;
    else if(!L.firstCpblDone&&(S.stats.CPBL&&S.stats.CPBL.yr>=3))force=true;
  }else if(bucket==='NPB'){
    if(L.returnedNpb){ const y=legendReturnNpbYears(); force=y>=2||legendNpbFirstBallotReady(); }
    else if(!L.firstNpbDone&&(S.stats.NPB&&S.stats.NPB.yr>=LEGEND_NPB_FIRST_YEARS))force=true;
  }else if(bucket==='MLB'&&!L.mlbDone&&S.age>=LEGEND_MLB_EXIT_AGE)force=true;
  if(!force)return false;
  const n=champName(bucket); addHonor(n); S.wonChamp=true; S.champThisTeam=true; S.champTeam=S.orgTeam;
  card('gold','王朝的最後一塊拼圖',`這個球季沒有留下遺憾——<b class="hl">${n}</b>。完成約定的那一刻，下一段傳奇也正式開門。`);
  return true;
}
function clearPermanentNegatives(){
  if(!S.traits)return;
  ['glass','yips','distract','cancer','ambience','thief'].forEach(k=>{ if(S.traits[k])S.traits[k]=false; });
}

export function legendBeforeAdvance(){
  if(!isLegendSp())return null;
  const L=S.legendSp,bucket=lastSeasonBucket(),key=`${S.year}:${S.lastLv||S.stage}`;
  if(bucket&&!L.processedYears[key]&&S.lastSt){
    L.processedYears[key]=true; S.role='SP';
    if(bucket==='CPBL'){
      const rookie=!L.finalCpblReturn&&(S.stats.CPBL&&S.stats.CPBL.yr===1);
      replaceLastPitcherSeason('CPBL',cpblTarget(),false); ensureDominantAwards('CPBL',rookie);
    }else if(bucket==='NPB'){
      replaceLastPitcherSeason('NPB',npbTarget(),false); ensureDominantAwards('NPB',false);
    }else if(bucket==='MLB'){
      const t=mlbTarget(); replaceLastPitcherSeason('MLB',t,!!t.inj);
      if(t.inj){ L.majorInjuryDone=true; S.bigInj=Math.max(1,S.bigInj||0); S.marketInjury='major';
        card('bad','生涯唯一一次重大傷勢','正值大聯盟巔峰期，突如其來的重大傷勢讓這一季幾乎提前結束。所幸不是 TJ，也沒有留下永久性能力損害。'); }
      else ensureDominantAwards('MLB',false);
    }
    forceWbcLegend(); forceRequiredChampionship(bucket);
  }

  /* 每年歸零 TJ 累積；指定大傷之外不留下永久負面後遺症。 */
  S.tj=0; S.tjCount=0; S.tjCrises=0; S.tjSuccess=0; S.rehab=0; clearPermanentNegatives();
  if(S.stage==='PRO'){
    S.role='SP';
    ['sta','vel','ctl','brk'].forEach(k=>{ if(S.pot&&k in S.pot)S.pot[k]=80; if(S.ab&&k in S.ab)S.ab[k]=Math.max(S.ab[k]||1,78); });
  }
  return legendMovementDirective(bucket);
}

export function legendMovementDirective(bucketArg){
  if(!isLegendSp()||S.stage!=='PRO')return null;
  const L=S.legendSp,bucket=bucketArg||lastSeasonBucket();
  if(bucket==='CPBL'&&!L.firstCpblDone&&!L.finalCpblReturn){
    const yrs=S.stats.CPBL?S.stats.CPBL.yr:0;
    if(yrs>=3&&legendCurrentYearChampion('CPBL')){
      L.firstCpblDone=true;
      return {kind:'to-npb',org:'NPB',lv:'NPB1',team:null,reason:'高雄神鵰三年篇章完成：新人年站穩輪值，接著兩年宰制並奪冠，立即旅日。'};
    }
  }
  if(bucket==='NPB'&&!L.firstNpbDone&&!L.returnedNpb){
    const yrs=S.stats.NPB?S.stats.NPB.yr:0;
    if(yrs>=LEGEND_NPB_FIRST_YEARS&&legendCurrentYearChampion('NPB')){
      L.firstNpbDone=true; L.npbTeam=L.npbTeam||S.orgTeam;
      return {kind:'to-mlb',org:'MiLB',lv:'MLB',team:null,reason:'日職同隊四年王朝完成，日本一後立即挑戰大聯盟。'};
    }
  }
  if(bucket==='MLB'&&!L.mlbDone&&S.age>=LEGEND_MLB_EXIT_AGE&&legendCurrentYearChampion('MLB')){
    L.mlbDone=true; L.mlbTeam=L.mlbTeam||S.orgTeam; L.returnedNpb=true; L.returnNpbStartYear=S.year+1;
    return {kind:'return-npb',org:'NPB',lv:'NPB1',team:L.npbTeam,reason:'大聯盟最後兩季完成第二巔峰，最終季世界大賽封王，回到日本老東家。'};
  }
  if(bucket==='NPB'&&L.returnedNpb&&!L.finalCpblReturn){
    const yrs=legendReturnNpbYears(),ready=legendNpbFirstBallotReady();
    if(legendCurrentYearChampion('NPB')&&(ready||yrs>=2)){
      L.finalCpblReturn=true; L.finalCpblStartYear=S.year+1;
      return {kind:'return-cpbl',org:'CPBL',lv:'CPBL1',team:LEGEND_CPBL_TEAM,reason:'回歸日職後完成日本殿堂履歷並再奪日本一，最後落葉歸根高雄神鵰。'};
    }
  }
  if(bucket==='CPBL'&&L.finalCpblReturn&&legendFinalCpblYears()>=1){
    L.retiredByScript=true; legendApplyCpblShortHofStandard();
    return {kind:'retire',reason:'回到高雄神鵰的最後一季，以超規格宰制與中職總冠軍為傳奇生涯畫下句點。'};
  }

  /* 原版交易／市場若提早帶走球員，跨年前拉回劇本應在的隊伍。 */
  if(!L.firstCpblDone){
    if(S.org!=='CPBL'||S.orgTeam!==LEGEND_CPBL_TEAM)return {kind:'correct',org:'CPBL',lv:S.org==='CPBL'?S.lv:'CPBL1',team:LEGEND_CPBL_TEAM,reason:'傳奇模式：前3個中職一軍球季必須留在高雄神鵰。'};
  }else if(!L.firstNpbDone){
    if(L.npbTeam&&(S.org!=='NPB'||S.orgTeam!==L.npbTeam))return {kind:'correct',org:'NPB',lv:'NPB1',team:L.npbTeam,reason:'傳奇模式：第一次旅日必須同一隊到底。'};
  }else if(!L.mlbDone){
    if(L.mlbTeam&&(S.org!=='MiLB'||S.orgTeam!==L.mlbTeam))return {kind:'correct',org:'MiLB',lv:'MLB',team:L.mlbTeam,reason:'傳奇模式：MLB 生涯同一隊到底。'};
  }else if(L.returnedNpb&&!L.finalCpblReturn){
    if(S.org!=='NPB'||S.orgTeam!==L.npbTeam)return {kind:'correct',org:'NPB',lv:'NPB1',team:L.npbTeam,reason:'傳奇模式：晚年回到第一次旅日老東家。'};
  }
  return null;
}

export function legendRememberSignedTeam(kind){
  if(!isLegendSp())return;
  if(kind==='to-npb'&&!S.legendSp.npbTeam)S.legendSp.npbTeam=S.orgTeam;
  if(kind==='to-mlb'&&!S.legendSp.mlbTeam)S.legendSp.mlbTeam=S.orgTeam;
}

export function legendLockCurrentClub(){
  if(!isLegendSp()||S.stage!=='PRO')return false;
  const L=S.legendSp;
  if(S.lv==='CPBL1'||S.lv==='CPBL2')return !L.firstCpblDone||L.finalCpblReturn;
  if(S.lv==='NPB1'||S.lv==='NPB2')return (!L.firstNpbDone&&!L.returnedNpb)||L.returnedNpb;
  if(S.lv==='MLB'||/^A[123]$|^R$/.test(S.lv||''))return !L.mlbDone;
  return false;
}
