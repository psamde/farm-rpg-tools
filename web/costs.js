'use strict';
function ciderEffectiveness(settings, areaId) {
  const upgrades=Number(settings.effectiveness_upgrades?.[areaId]||0);
  const shoes=Number(settings.sprint_shoes||0);
  if(!Number.isInteger(upgrades)||upgrades<0||!Number.isInteger(shoes)||shoes<0||shoes>3)throw Error('Invalid exploration upgrade count.');
  const effectiveness=(1+upgrades)*2**shoes;
  const rolls=(1000+10*effectiveness)*(settings.cinnamon?1.25:1);
  // Preserve older custom values until the player explicitly sets this area.
  const legacy=settings.cider_rolls?.[areaId];
  const custom=legacy && settings.effectiveness_upgrades?.[areaId]===undefined;
  return {upgrades,effectiveness,rolls:custom?Number(legacy):rolls,custom:!!custom};
}
// Yield equivalents for an existing explore allocation, not a new optimization.
function explorationCosts(plan, locations, settings) {
  const wanderer=Number(settings.wanderer||0)/100;
  if(!Number.isFinite(wanderer)||wanderer<0||wanderer>.33)throw Error('Wanderer must be from 0 to 33%.');
  const parts=plan.areas.map(a=>{
    const loc=locations.find(l=>l.id===a.location_id);
    if(!loc||!Number.isFinite(loc.base_drop_rate)||loc.base_drop_rate<=0)throw Error('Missing area base drop rate.');
    const rolls=ciderEffectiveness(settings,a.location_id).rolls;
    if(!Number.isFinite(rolls)||rolls<1)throw Error('Cider rolls must be positive.');
    return {drops:a.explores*loc.base_drop_rate,rolls};
  });
  const ceil=n=>Math.ceil(n-1e-9);
  const sum=f=>parts.reduce((s,p)=>s+f(p),0);
  const rows=[];
  const apBase=settings.lemon_squeezer?500:200;
  for(const chowder of [false,true])for(const seltzer of [false,true])for(const pie of [false,true]){
    // Both plausible stacking rules are exposed until independently confirmed.
    const factors=chowder&&seltzer?[1.6,1.65]:[1+(chowder?.1:0)+(seltzer?.5:0)];
    const quantities=factors.map(f=>sum(p=>ceil(p.drops/(apBase*f))));
    const low=Math.min(...quantities), high=Math.max(...quantities);
    rows.push({method:'AP',foods:[chowder&&'Quandary Chowder',seltzer&&'Lemon Seltzer',pie&&'Lemon Cream Pie'].filter(Boolean).join(' + ')||'None',
      drinks:low,drinks_high:high,stamina:0,clicks:Math.min(...factors.map(f=>sum(p=>ceil(ceil(p.drops/(apBase*f))/(pie?5:1))))),
      clicks_high:Math.max(...factors.map(f=>sum(p=>ceil(ceil(p.drops/(apBase*f))/(pie?5:1))))),
      seltzers:seltzer?ceil(low/50):0,seltzers_high:seltzer?ceil(high/50):0,uncertain:chowder&&seltzer});
  }
  const ciders=sum(p=>ceil(p.drops/(p.rolls*.4)));
  for(const neigh of [false,true])for(const cabbage of [false,true]){
    const clicks=sum(p=>ceil(ceil(p.drops/(p.rolls*.4))/(cabbage?5:1)));
    rows.push({method:'Cider',foods:[neigh&&'Neigh',cabbage&&'Cabbage Stew'].filter(Boolean).join(' + ')||'None',drinks:ciders,drinks_high:ciders,
      stamina:sum(p=>ceil(p.drops/(p.rolls*.4))*p.rolls*(1-wanderer)*(neigh?.8:1)),clicks,clicks_high:clicks});
  }
  return {rows,manual_stamina:plan.optimal_total_explores*(1-wanderer)};
}
if(typeof module!=='undefined')module.exports={explorationCosts,ciderEffectiveness};
