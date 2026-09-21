'use strict';
// Forest first, corrected from the in-game menu by the user (2026-09-14).
// Remaining locations retain their existing order; Buddy lists Forest later.
const explorationMenuOrder=[7,1,2,3,4,5,6,8,9,10,11,13,14,20,22].map(id=>`explore:${id}`);
// Expected-yield scheduling. Craftworks is assumed to finish available crafts
// between individual drinks; real tick timing and random bursts are not modeled.
function inventoryRoute(plan, items, locations, settings){
 const capacity=Number(settings.inventory_size??10000),method=settings.route_method||'AP';
 const foods=settings.route_foods||{},drinksPerClick=(method==='AP'?foods.pie:foods.cabbage)?5:1;
 const dropFactor=method==='AP'?1+(foods.chowder?.1:0)+(foods.seltzer?.5:0):1;
 const wanderer=Number(settings.wanderer||0)/100;
 if(!Number.isFinite(wanderer)||wanderer<0||wanderer>.33)throw Error('Wanderer must be from 0 to 33%.');
 if(!Number.isInteger(capacity)||capacity<1)throw Error('Inventory size must be a positive whole number.');
 const factor=1/(1+Number(plan.assumptions.resource_saver||0)/100),free=new Set(plan.assumptions.unlimited_free_items.map(r=>r.id));
 // Incoming supplies are a finite reserve outside the loop's inventory cap.
 // Only drops and items crafted in the loop occupy its limited inventory.
 const stock={},incoming={},remaining={},order=[],seen=new Set();
 for(const b of plan.item_balances)incoming[b.item_id]=b.starting_inventory+(b.auto_starting_inventory===undefined?(b.required_external_supply||0):0);
 const available=id=>(incoming[id]||0)+(stock[id]||0);
 for(const c of [...plan.crafts_in_dependency_order,...(plan.secondary?.crafts_in_dependency_order||[])])remaining[c.item_id]=(remaining[c.item_id]||0)+c.crafts;
 function visit(id){if(seen.has(id))return;seen.add(id);for(const child of Object.keys(items[id]?.direct_ingredients||{}))visit(child);if(remaining[id])order.push(id);}
 Object.keys(remaining).forEach(visit);
 const recipes=Object.fromEntries(order.map(id=>[id,{id,out:items[id].output_quantity||1,
  ingredients:Object.entries(items[id].direct_ingredients||{}).filter(([child])=>!free.has(child)).map(([child,q])=>[child,q*factor])}]));
 const slots=Number(settings.craftworks_slots??10);
 if(!Number.isInteger(slots)||slots<1||slots>100)throw Error('Craftworks slots must be a whole number from 1 to 100.');
 const continuous=slots>=order.length, stopWork=new Map(),activeWork={};
 let recording=null;
 const setups=[];for(let i=0;i<order.length;i+=slots)setups.push(order.slice(i,i+slots));
 const menuRank=id=>{const i=explorationMenuOrder.indexOf(id);return i<0?explorationMenuOrder.length:i;};
 const parts=[...plan.areas].sort((a,b)=>menuRank(a.location_id)-menuRank(b.location_id)).map(a=>{
  const loc=locations.find(l=>l.id===a.location_id),rolls=ciderEffectiveness(settings,a.location_id).rolls;
  const perDrink=(method==='AP'?(settings.lemon_squeezer?500:200)*dropFactor:rolls*.4)/loc.base_drop_rate;
  return {id:a.location_id,name:a.name,explores:a.explores,perDrink,staminaPerDrink:method==='Cider'?rolls*(1-wanderer)*(foods.neigh?.8:1):0,left:Math.ceil(a.explores/perDrink-1e-9),total:Math.ceil(a.explores/perDrink-1e-9),
   drops:Object.entries(a.items.filter(d=>!free.has(d.item_id)).reduce((totals,d)=>{totals[d.item_id]=(totals[d.item_id]||0)+d.expected_drops/a.explores*perDrink;return totals;},{})).map(([id,q])=>({id,q}))};
 });
 const totals={...remaining},gross={};
 for(const p of parts)for(const d of p.drops)gross[d.id]=(gross[d.id]||0)+d.q*p.total;
 for(const [id,n] of Object.entries(totals))if(!free.has(id))gross[id]=(gross[id]||0)+n*(items[id].output_quantity||1);
 let rounds=settings._rounds||Math.max(1,...Object.values(gross).map(n=>Math.ceil(2*n/capacity)));
 for(const p of parts){p.batch=Math.max(drinksPerClick,Math.ceil(p.total/rounds/drinksPerClick)*drinksPerClick);p.left=p.batch*rounds;p.scheduled=p.left;}
 // Forecast actual payable crafts, consuming ingredients as we go. A single
 // shared ingredient is not enough to put every descendant into Craftworks.
 const activeGroups=[],forecastStock={...incoming},forecastRemaining=Object.fromEntries(order.map(id=>[id,Math.ceil(totals[id]/rounds)]));
 function forecast(start,end){
  const available={...forecastStock},work={};
  for(let place=start;place<=end;place++)for(const drop of parts[place].drops)available[drop.id]=(available[drop.id]||0)+drop.q*parts[place].batch;
  for(const id of order){
   const recipe=items[id].direct_ingredients,out=items[id].output_quantity||1;
   let count=forecastRemaining[id];
   for(const [child,q] of Object.entries(recipe))if(!free.has(child))count=Math.min(count,Math.floor(((available[child]||0)+1e-8)/(q*factor)));
   if(count<=0)continue;
   work[id]=count;
   for(const [child,q] of Object.entries(recipe))if(!free.has(child))available[child]-=count*q*factor;
   if(!free.has(id))available[id]=(available[id]||0)+count*out;
  }
  return {available,work,recipes:order.filter(id=>work[id]>0)};
 }
 for(let start=0;start<parts.length;){
  let end=start,projection=forecast(start,end);
  while(end+1<parts.length&&end-start+1<(settings._groupSpan||parts.length)){
   const next=forecast(start,end+1);
   if(!continuous&&next.recipes.length>slots)break;
   projection=next;end++;
  }
  activeGroups.push({start,end,recipes:continuous?[...order]:projection.recipes.slice(0,slots)});
  Object.assign(forecastStock,projection.available);for(const [id,n] of Object.entries(projection.work))forecastRemaining[id]-=n;start=end+1;
 }
 const interval=Math.max(1,...activeGroups.map(g=>g.end-g.start+1));
 const visitRecipes=parts.map((_,i)=>activeGroups.find(g=>i>=g.start&&i<=g.end).recipes);
 const stopPlaces=new Set(activeGroups.map(g=>g.end));
 for(const p of parts)p.dropRates=Object.fromEntries(p.drops.map(d=>[d.id,d.q]));
 const visits=[],empties=[];let uses=0,crafts=0,round=1,problem=null,verificationSteps=0;
 const allowance={},needed={},future={};
 for(const id of order){for(const [child,q] of recipes[id].ingredients)needed[child]=(needed[child]||0)+remaining[id]*q;future[id]=(future[id]||0)+remaining[id]*recipes[id].out;}
 for(const p of parts)for(const d of p.drops)future[d.id]=(future[d.id]||0)+p.left*d.q;
 function allowRound(){for(const id of order)allowance[id]=Math.min(remaining[id],Math.ceil(totals[id]*round/rounds)-(totals[id]-remaining[id]));}
 allowRound();
 // Track every stock increase, including intermediate crafted outputs. A route
 // is complete only if its entire expected inventory flow stays within capacity.
 const inventoryPeaks={};
 function checkStock(id){if(free.has(id))return;const quantity=stock[id]||0;
  inventoryPeaks[id]=Math.max(inventoryPeaks[id]||0,quantity);
  if(!Number.isFinite(quantity)||quantity < -1e-7||quantity>capacity+1e-7){problem=problem||`Expected inventory for ${items[id]?.name||id} exceeds the ${capacity} item limit. This loop is not verified.`;}
 }
 Object.keys(stock).forEach(checkStock);
 function craft(ids=order){for(const id of ids){if(problem)return;if(!remaining[id]||allowance[id]<=0)continue;let count=allowance[id];const {ingredients,out}=recipes[id];
  for(const [child,q] of ingredients)count=Math.min(count,Math.floor((available(child)+1e-8)/q));
  if(!free.has(id))count=Math.min(count,Math.floor((capacity-(stock[id]||0)+1e-8)/out));
  if(count<=0)continue;
  for(const [child,q] of ingredients){
   const used=count*q,provided=Math.min(incoming[child]||0,used);
   incoming[child]=(incoming[child]||0)-provided;stock[child]=Math.max(0,(stock[child]||0)-(used-provided));needed[child]-=used;
  }
  if(!free.has(id))stock[id]=(stock[id]||0)+count*out;remaining[id]-=count;allowance[id]-=count;future[id]-=count*out;crafts+=count;checkStock(id);
  if(recording){if(!stopWork.has(recording))stopWork.set(recording,{});const work=stopWork.get(recording);work[id]=(work[id]||0)+count;}else activeWork[id]=(activeWork[id]||0)+count;
 }}
 function atStop(key){recording=key;craft();recording=null;}
 function clearFinished(){if(problem)return false;
  const cleared=[];for(const [id,n] of Object.entries(stock)){const keep=Math.max(0,(needed[id]||0)-(future[id]||0)-(incoming[id]||0));const quantity=Math.floor(n-keep+1e-8);if(quantity>0){cleared.push({id,quantity});stock[id]=n-quantity;}}
  if(cleared.length){empties.push({after:uses,items:cleared});return true;}return false;
 }
 function nextCraftClick(p,ids){
  let next=Infinity;
  for(const id of ids){
   if(allowance[id]<=0||remaining[id]<=0)continue;
   const {ingredients,out}=recipes[id];
   if(!free.has(id)&&capacity-(stock[id]||0)+1e-8<out)continue;
   let clicks=1;
   for(const [child,q] of ingredients){
    const missing=q-available(child)-1e-8;
    if(missing>0){const perClick=(p.dropRates[child]||0)*drinksPerClick;if(!perClick){clicks=Infinity;break;}clicks=Math.max(clicks,Math.ceil(missing/perClick));}
   }
   next=Math.min(next,clicks);if(next===1)break;
  }
  return next;
 }
 atStop('start');
 for(round=1;round<=rounds&&!problem;round++){
  allowRound();
  for(const [placeIndex,p] of parts.entries()){
   const v={id:p.id,name:p.name,drinks:0,explores:0,after:uses,round};visits.push(v);
   for(let j=0;j<p.batch&&!problem;){
    let clicks=(p.batch-j)/drinksPerClick;
    for(const d of p.drops)if(d.q>0)clicks=Math.min(clicks,Math.floor((capacity-(stock[d.id]||0)+1e-7)/(d.q*drinksPerClick)));
    if(clicks<1){const blockers=p.drops.filter(d=>(stock[d.id]||0)+d.q*drinksPerClick>capacity+1e-7).map(d=>items[d.id]?.name||d.id);problem=`The loop needs more room for ${blockers.slice(0,4).join(', ')}. Its full inventory sequence could not be verified.`;break;}
    // Until the next payable craft, drops only increase stock. Checking the
    // endpoint proves every intervening click fits, including five-drink food.
    clicks=settings._singleClick?1:Math.min(clicks,nextCraftClick(p,visitRecipes[placeIndex]));
    verificationSteps++;
    const drinks=clicks*drinksPerClick;
    for(const d of p.drops){const quantity=d.q*drinks;stock[d.id]=(stock[d.id]||0)+quantity;future[d.id]-=quantity;checkStock(d.id);}if(problem)break;
    p.left-=drinks;uses+=drinks;j+=drinks;v.drinks+=drinks;v.explores+=p.perDrink*drinks;craft(visitRecipes[placeIndex]);
   }
   if(!continuous&&stopPlaces.has(placeIndex))atStop(p.id);
  }
  clearFinished();atStop(parts.at(-1)?.id||'start');
 }
 // Empty completed stacks when needed to finish the remaining crafts.
 if(!problem){allowRound();let previous=-1;while(Object.values(remaining).some(n=>n)&&previous!==crafts){previous=crafts;clearFinished();atStop(parts.at(-1)?.id||'start');}
  if(Object.values(remaining).some(n=>n))problem='The expected drops do not finish every craft within this inventory size. Increase capacity or review the starting inventory.';
 }
 if(!problem&&!settings._rounds&&rounds>1){
  let best=inventoryRoute(plan,items,locations,{...settings,_rounds:rounds}),low=1,high=rounds-1;
  // A bounded search for larger batches; this is a heuristic, not a global optimum.
  for(let attempt=0;attempt<7&&low<=high;attempt++){
   const mid=Math.floor((low+high)/2),candidate=inventoryRoute(plan,items,locations,{...settings,_rounds:mid});
   if(candidate.complete){best=candidate;high=mid-1;}else low=mid+1;
  }
  return best;
 }
 if(problem&&!settings._groupSpan&&interval>1){
  for(let span=interval-1;span>=1;span--){const candidate=inventoryRoute(plan,items,locations,{...settings,_rounds:rounds,_groupSpan:span});if(candidate.complete)return candidate;}
 }
 const craftStops=[...stopWork].map(([id,work])=>{const recipes=order.filter(ref=>work[ref]>0),sets=[];for(let i=0;i<recipes.length;i+=slots)sets.push(recipes.slice(i,i+slots));return {id,name:id==='start'?'Before the first location':`After ${parts.find(p=>p.id===id)?.name||'the final location'}`,recipes,sets,amounts:Object.fromEntries(recipes.map(ref=>[ref,work[ref]/(id==='start'?1:rounds)]))};});
 return {capacity,inventoryPeaks,verificationSteps,inventoryVerified:!problem,method,drinksPerClick,activeWork,stamina:parts.reduce((n,p)=>n+p.scheduled*p.staminaPerDrink,0),rounds,slots,setups,continuous,interval,activeGroups:activeGroups.map(g=>({...g,from:parts[g.start].name,to:parts[g.end].name,after:g.start?parts[g.start-1].id:null})),craftStops,minimumContinuousSlots:order.length,minimumStopSlots:Math.max(0,...craftStops.map(s=>s.recipes.length)),crafting:order.map(id=>({id,perLoop:totals[id]/rounds,total:totals[id]})),extraExplores:parts.reduce((n,p)=>n+p.scheduled*p.perDrink-p.explores,0),parts:parts.map(p=>({...p,visits:visits.filter(v=>v.id===p.id).length,maxRun:visits.reduce((n,v)=>v.id===p.id?Math.max(n,v.drinks):n,0)})),visits,empties,problem,uses,complete:!problem};
}
if(typeof module!=='undefined')module.exports={inventoryRoute};
