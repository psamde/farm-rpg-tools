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
 const stock={},incoming={},remaining={},requiredRemaining={},optionalRemaining={},order=[],seen=new Set();
 for(const b of plan.item_balances)incoming[b.item_id]=b.starting_inventory+(b.auto_starting_inventory===undefined?(b.required_external_supply||0):0);
 const available=id=>(incoming[id]||0)+(stock[id]||0);
 for(const [rows,pool] of [[plan.crafts_in_dependency_order,requiredRemaining],[plan.secondary?.crafts_in_dependency_order||[],optionalRemaining]])for(const c of rows)if(c.crafts>0){pool[c.item_id]=(pool[c.item_id]||0)+c.crafts;remaining[c.item_id]=(remaining[c.item_id]||0)+c.crafts;}
 const requiredIds=new Set(Object.keys(requiredRemaining));
 const targetReserves=Object.fromEntries(plan.item_balances.filter(b=>b.reserved_target_output>0&&!free.has(b.item_id)).map(b=>[b.item_id,b.reserved_target_output]));
 // Until a required branch finishes this loop, its materials stay protected,
 // including intermediates already made for a later location's required craft.
 const branches={};
 function branch(id,seen=new Set()){
  if(free.has(id)||seen.has(id))return seen;
  seen.add(id);for(const child of Object.keys(items[id]?.direct_ingredients||{})){if(free.has(child))continue;if(requiredIds.has(child))branch(child,seen);else seen.add(child);}return seen;
 }
 for(const id of requiredIds)branches[id]=branch(id);
 function protectedMaterials(pending){const refs=new Set();for(const id of requiredIds)if(pending[id]>1e-7)for(const ref of branches[id])refs.add(ref);return refs;}
 const allProtected=protectedMaterials(requiredRemaining);
 for(const id of Object.keys(targetReserves))allProtected.add(id);
 const contestedOptional=new Set(Object.keys(optionalRemaining).filter(id=>Object.keys(items[id]?.direct_ingredients||{}).some(child=>allProtected.has(child))));
 function visit(id){if(seen.has(id))return;seen.add(id);for(const child of Object.keys(items[id]?.direct_ingredients||{}))visit(child);if(remaining[id])order.push(id);}
 Object.keys(remaining).forEach(visit);
 const recipes=Object.fromEntries(order.map(id=>[id,{id,out:items[id].output_quantity||1,
  ingredients:Object.entries(items[id].direct_ingredients||{}).filter(([child])=>!free.has(child)).map(([child,q])=>[child,q*factor])}]));
 const slots=Number(settings.craftworks_slots??10);
 if(!Number.isInteger(slots)||slots<1||slots>100)throw Error('Craftworks slots must be a whole number from 1 to 100.');
 const priorityStages=contestedOptional.size>0;
 const continuous=slots>=order.length&&!priorityStages, stopWork=new Map(),stopPhases=new Map(),activeWork={};
 let recording=null,currentPlace='start';
 const setups=[];for(let i=0;i<order.length;i+=slots)setups.push(order.slice(i,i+slots));
 const menuRank=id=>{const i=explorationMenuOrder.indexOf(id);return i<0?explorationMenuOrder.length:i;};
 const parts=[...plan.areas].sort((a,b)=>menuRank(a.location_id)-menuRank(b.location_id)).map(a=>{
  const loc=locations.find(l=>l.id===a.location_id),rolls=ciderEffectiveness(settings,a.location_id).rolls;
  const perDrink=(method==='AP'?(settings.lemon_squeezer?500:200)*dropFactor:rolls*.4)/loc.base_drop_rate;
  return {id:a.location_id,name:a.name,explores:a.explores,perDrink,staminaPerDrink:method==='Cider'?rolls*(1-wanderer)*(foods.neigh?.8:1):0,left:Math.ceil(a.explores/perDrink-1e-9),total:Math.ceil(a.explores/perDrink-1e-9),
   drops:Object.entries(a.items.filter(d=>!free.has(d.item_id)).reduce((totals,d)=>{totals[d.item_id]=(totals[d.item_id]||0)+d.expected_drops/a.explores*perDrink;return totals;},{})).map(([id,q])=>({id,q}))};
 });
 const totals={...remaining},requiredTotals={...requiredRemaining},optionalTotals={...optionalRemaining},gross={};
 for(const p of parts)for(const d of p.drops)gross[d.id]=(gross[d.id]||0)+d.q*p.total;
 for(const [id,n] of Object.entries(totals))if(!free.has(id))gross[id]=(gross[id]||0)+n*(items[id].output_quantity||1);
 let rounds=settings._rounds||Math.max(1,...Object.values(gross).map(n=>Math.ceil(2*n/capacity)));
 for(const p of parts){p.batch=Math.max(drinksPerClick,Math.ceil(p.total/rounds/drinksPerClick)*drinksPerClick);p.left=p.batch*rounds;p.scheduled=p.left;}
 // Forecast actual payable crafts, consuming ingredients as we go. A single
 // shared ingredient is not enough to put every descendant into Craftworks.
 const activeGroups=[],forecastStock={...incoming};
 const forecastRequired=Object.fromEntries(order.map(id=>[id,(requiredTotals[id]||0)/rounds]));
 const forecastOptional=Object.fromEntries(order.map(id=>[id,(optionalTotals[id]||0)/rounds]));
 function forecastWork(available,primary,optional,allowContested){
  const work={},requiredWork={},optionalWork={};
  function run(id,pending,kind){
   let count=pending[id]||0;const {ingredients,out}=recipes[id];
   for(const [child,q] of ingredients)count=Math.min(count,Math.max(0,(available[child]||0)-(targetReserves[child]||0)/rounds)/q);
   if(count<=1e-7)return;
   work[id]=(work[id]||0)+count;kind[id]=count;pending[id]-=count;
   for(const [child,q] of ingredients)available[child]=(available[child]||0)-count*q;
   if(!free.has(id))available[id]=(available[id]||0)+count*out;
  }
  for(const id of order)run(id,primary,requiredWork);
  const protectedRefs=protectedMaterials(primary);
  for(const id of order)if((allowContested||!contestedOptional.has(id))&&!recipes[id].ingredients.some(([child])=>protectedRefs.has(child)))run(id,optional,optionalWork);
  return {work,requiredWork,optionalWork};
 }
 // Establish the first location where each required branch has enough supply
 // on the expected flow. Whole-craft rounding is handled by reservations below,
 // rather than keeping optional crafts locked forever by a one-craft remainder.
 const releasePlace={},releaseStock={...incoming},releaseRequired={...forecastRequired};
 for(let place=-1;place<parts.length;place++){
  for(const drop of parts[place]?.drops||[])releaseStock[drop.id]=(releaseStock[drop.id]||0)+drop.q*parts[place].batch;
  forecastWork(releaseStock,releaseRequired,{},false);
  const pending=protectedMaterials(releaseRequired);
  for(const id of contestedOptional)if(releasePlace[id]===undefined&&!recipes[id].ingredients.some(([child])=>pending.has(child)))releasePlace[id]=place;
 }
 function forecast(start,end){
  const available={...forecastStock},primary={...forecastRequired},optional={...forecastOptional};
  for(let place=start;place<=end;place++)for(const drop of parts[place].drops)available[drop.id]=(available[drop.id]||0)+drop.q*parts[place].batch;
  const work=forecastWork(available,primary,optional,false);
  return {available,primary,optional,...work,recipes:order.filter(id=>work.work[id]>0)};
 }
 for(let start=0;start<parts.length;){
  let end=start,projection=forecast(start,end);
  while(end+1<parts.length&&end-start+1<(settings._groupSpan||parts.length)){
   const next=forecast(start,end+1);
   if(!continuous&&next.recipes.length>slots)break;
   projection=next;end++;
  }
  const useful=projection.recipes.filter(id=>requiredIds.has(id)).concat(projection.recipes.filter(id=>!requiredIds.has(id)));
  activeGroups.push({start,end,recipes:continuous?[...order]:useful.slice(0,slots)});
  // Work that cannot fit in the active set finishes at the checkpoint. Only
  // then may released ingredients enter an optional set.
  forecastWork(projection.available,projection.primary,projection.optional,true);
  Object.assign(forecastStock,projection.available);Object.assign(forecastRequired,projection.primary);Object.assign(forecastOptional,projection.optional);start=end+1;
 }
 const interval=Math.max(1,...activeGroups.map(g=>g.end-g.start+1));
 const visitRecipes=parts.map((_,i)=>activeGroups.find(g=>i>=g.start&&i<=g.end).recipes);
 const stopPlaces=new Set(activeGroups.map(g=>g.end));
 for(const p of parts)p.dropRates=Object.fromEntries(p.drops.map(d=>[d.id,d.q]));
 const visits=[],empties=[];let uses=0,crafts=0,round=1,problem=null,verificationSteps=0;
 const requiredAllowance={},optionalAllowance={},delivered={},needed={},future={};
 let requiredHoldsCache=null,checkpointPlace=-1;
 const targetHeld=id=>Math.max(0,(targetReserves[id]||0)*Math.min(round,rounds)/rounds-(delivered[id]||0));
 const spendable=id=>Math.max(0,available(id)-targetHeld(id));
 for(const id of order){for(const [child,q] of recipes[id].ingredients)needed[child]=(needed[child]||0)+remaining[id]*q;future[id]=(future[id]||0)+remaining[id]*recipes[id].out;}
 for(const p of parts)for(const d of p.drops)future[d.id]=(future[d.id]||0)+p.left*d.q;
 function allowRound(){
  requiredHoldsCache=null;
  for(const id of order){
   requiredAllowance[id]=Math.max(0,Math.min(requiredRemaining[id]||0,Math.ceil((requiredTotals[id]||0)*Math.min(round,rounds)/rounds)-((requiredTotals[id]||0)-(requiredRemaining[id]||0))));
   optionalAllowance[id]=Math.max(0,Math.min(optionalRemaining[id]||0,Math.ceil((optionalTotals[id]||0)*Math.min(round,rounds)/rounds)-((optionalTotals[id]||0)-(optionalRemaining[id]||0))));
  }
 }
 allowRound();
 // Track every stock increase, including intermediate crafted outputs. A route
 // is complete only if its entire expected inventory flow stays within capacity.
 const inventoryPeaks={};
 function checkStock(id){if(free.has(id))return;const quantity=stock[id]||0;
  inventoryPeaks[id]=Math.max(inventoryPeaks[id]||0,quantity);
  if(!Number.isFinite(quantity)||quantity < -1e-7||quantity>capacity+1e-7){problem=problem||`Expected inventory for ${items[id]?.name||id} exceeds the ${capacity} item limit. This loop is not verified.`;}
 }
 Object.keys(stock).forEach(checkStock);
 function requiredHolds(){
  if(requiredHoldsCache)return requiredHoldsCache;
  const holds={};
  for(const id of order)for(const [child,q] of recipes[id].ingredients)holds[child]=(holds[child]||0)+(requiredAllowance[id]||0)*q;
  for(const id of new Set([...Object.keys(holds),...Object.keys(targetReserves)]))holds[id]=Math.max(0,(holds[id]||0)+targetHeld(id)-(requiredAllowance[id]||0)*(recipes[id]?.out||1));
  return requiredHoldsCache=holds;
 }
 function optionalAllowed(id,atCheckpoint){return !contestedOptional.has(id)||(atCheckpoint&&releasePlace[id]!==undefined&&checkpointPlace>=releasePlace[id]);}
 function craft(ids=order,atCheckpoint=false){
  const selectedIds=new Set(ids);
  function run(id,kind,pending,quota){
   if(problem||!pending[id]||quota[id]<=0)return;
   let count=quota[id];const {ingredients,out}=recipes[id],holds=kind==='optional'&&contestedOptional.has(id)?requiredHolds():null;
   for(const [child,q] of ingredients)count=Math.min(count,Math.floor(((kind==='required'?spendable(child):Math.max(0,available(child)-(holds?.[child]||0)))+1e-8)/q));
   if(!free.has(id))count=Math.min(count,Math.floor((capacity-(stock[id]||0)+1e-8)/out));
   if(count<=0)return;
   for(const [child,q] of ingredients){
    const used=count*q,provided=Math.min(incoming[child]||0,used);
    incoming[child]=(incoming[child]||0)-provided;stock[child]=Math.max(0,(stock[child]||0)-(used-provided));needed[child]-=used;
   }
   if(!free.has(id))stock[id]=(stock[id]||0)+count*out;
   remaining[id]-=count;pending[id]-=count;quota[id]-=count;future[id]-=count*out;crafts+=count;checkStock(id);
   if(kind==='required')requiredHoldsCache=null;
   if(settings._trace)settings._trace({type:'craft',round,place:recording||currentPlace,id,kind,count,held:kind==='optional'?{...requiredHolds()}:null});
   if(recording){
    if(!stopWork.has(recording))stopWork.set(recording,{});
    const work=stopWork.get(recording);work[id]=(work[id]||0)+count;
    if(!stopPhases.has(recording))stopPhases.set(recording,{required:{},optional:{}});
    const phase=stopPhases.get(recording)[kind];phase[id]=(phase[id]||0)+count;
   }else activeWork[id]=(activeWork[id]||0)+count;
  }
  // Simulate ingredient production in dependency order, completing all payable
  // required crafts before the optional pass. Display order is reversed within
  // each priority, so finished recipes still sit above their ingredients.
  for(const id of order)if(selectedIds.has(id))run(id,'required',requiredRemaining,requiredAllowance);
  for(const id of order)if(selectedIds.has(id)&&optionalAllowed(id,atCheckpoint))run(id,'optional',optionalRemaining,optionalAllowance);
 }
 function atStop(key){recording=key;checkpointPlace=parts.findIndex(p=>p.id===key);craft(order,true);recording=null;}
 function deliverTargets(){
  requiredHoldsCache=null;
  for(const id of Object.keys(targetReserves)){
   const amount=Math.min(available(id),targetHeld(id)),provided=Math.min(incoming[id]||0,amount);
   incoming[id]=(incoming[id]||0)-provided;stock[id]=Math.max(0,(stock[id]||0)-(amount-provided));delivered[id]=(delivered[id]||0)+amount;
  }
 }
 function clearFinished(){if(problem)return false;
  deliverTargets();
  const cleared=[];for(const [id,n] of Object.entries(stock)){const keep=Math.max(0,(needed[id]||0)+(targetReserves[id]||0)-(delivered[id]||0)-(future[id]||0)-(incoming[id]||0));const quantity=Math.floor(n-keep+1e-8);if(quantity>0){cleared.push({id,quantity});stock[id]=n-quantity;}}
  if(cleared.length){empties.push({after:uses,items:cleared});return true;}return false;
 }
 function nextCraftClick(p,ids){
  let next=Infinity;
  for(const id of ids){
   if(remaining[id]<=0||(!(requiredAllowance[id]>0)&&(!(optionalAllowance[id]>0)||!optionalAllowed(id,false))))continue;
   const {ingredients,out}=recipes[id];
   if(!free.has(id)&&capacity-(stock[id]||0)+1e-8<out)continue;
   let clicks=1;
   for(const [child,q] of ingredients){
    const missing=q-spendable(child)-1e-8;
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
   currentPlace=p.id;
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
 if(!problem){deliverTargets();if(Object.entries(targetReserves).some(([id,q])=>(delivered[id]||0)+1e-6<q))problem='The route does not preserve every required target output.';}
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
 const craftStops=[...stopWork].sort(([a],[b])=>parts.findIndex(p=>p.id===a)-parts.findIndex(p=>p.id===b)).map(([id,work])=>{
  const recipes=order.filter(ref=>work[ref]>0),sets=[],setPhases=[],setAmounts=[];
  for(const kind of ['required','optional']){
   const amounts=stopPhases.get(id)[kind],refs=order.filter(ref=>amounts[ref]>0);
   for(let i=0;i<refs.length;i+=slots){const group=refs.slice(i,i+slots);sets.push(group);setPhases.push(kind);setAmounts.push(Object.fromEntries(group.map(ref=>[ref,amounts[ref]/(id==='start'?1:rounds)])));}
  }
  return {id,name:id==='start'?'Before the first location':`After ${parts.find(p=>p.id===id)?.name||'the final location'}`,recipes,sets,setPhases,setAmounts,amounts:Object.fromEntries(recipes.map(ref=>[ref,work[ref]/(id==='start'?1:rounds)]))};
 });
 return {priorityStages,releasePlace,requiredRecipes:[...requiredIds],contestedOptional:[...contestedOptional],deliveredTargets:delivered,capacity,inventoryPeaks,verificationSteps,inventoryVerified:!problem,method,drinksPerClick,activeWork,stamina:parts.reduce((n,p)=>n+p.scheduled*p.staminaPerDrink,0),rounds,slots,setups,continuous,interval,activeGroups:activeGroups.map(g=>({...g,from:parts[g.start].name,to:parts[g.end].name,after:g.start?parts[g.start-1].id:null})),craftStops,minimumContinuousSlots:order.length,minimumStopSlots:Math.max(0,...craftStops.map(s=>s.recipes.length)),crafting:order.map(id=>({id,perLoop:totals[id]/rounds,total:totals[id]})),extraExplores:parts.reduce((n,p)=>n+p.scheduled*p.perDrink-p.explores,0),parts:parts.map(p=>({...p,visits:visits.filter(v=>v.id===p.id).length,maxRun:visits.reduce((n,v)=>v.id===p.id?Math.max(n,v.drinks):n,0)})),visits,empties,problem,uses,complete:!problem};
}
function craftworksDisplayOrder(ids,requiredIds){const required=new Set(requiredIds);return [...ids].reverse().filter(id=>required.has(id)).concat([...ids].reverse().filter(id=>!required.has(id)));}
if(typeof module!=='undefined')module.exports={inventoryRoute,craftworksDisplayOrder};
