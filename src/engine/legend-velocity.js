import {S} from '../core/state.js';

/* 傳奇先發模式：球速永久鎖定 80。
   只在網址帶 ?legend=sp 且角色為投手時生效；普通模式完全不受影響。 */
const LEGEND_SP=typeof location!=='undefined'
  &&new URLSearchParams(location.search).get('legend')==='sp';

export function forceLegendVelocity80(){
  if(!LEGEND_SP||!S||S.pos!=='P'||!S.ab)return false;
  S.ab.vel=80;
  if(S.pot)S.pot.vel=80;
  return true;
}

/* 開局建立角色前 S 尚不存在，因此持續輕量同步。
   也能抵消晚年自然衰退、事件與傷病對球速的扣減。 */
if(typeof window!=='undefined'&&LEGEND_SP){
  setInterval(forceLegendVelocity80,100);
}
