'use strict';
// Forest first, corrected from the in-game menu by the user (2026-09-14).
// Remaining locations retain their existing order; Buddy lists Forest later.
const explorationMenuOrder=[7,1,2,3,4,5,6,8,9,10,11,13,14,20,22].map(id=>`explore:${id}`);
// Expected-yield scheduling. Craftworks is assumed to finish available crafts
// between individual drinks; real tick timing and random bursts are not modeled.
function simulateInventoryRoute(plan, items, locations, settings){
 const capacity=Number(settings.inventory_size??10000),method=settings.route_method||'AP';
 const foods=settings.route_foods||{},drinksPerClick=(method==='AP'?foods.pie:foods.cabbage)?5:1;
 const dropFactor=method==='AP'?1+(foods.chowder?.1:0)+(foods.seltzer?.5:0):1;
 const wanderer=Number(settings.wanderer||0)/100;
 if(!Number.isFinite(wanderer)||wanderer<0||wanderer>.33)throw Error('Wanderer must be from 0 to 33%.');
 if(!Number.isInteger(capacity)||capacity<1)throw Error('Inventory size must be a positive whole number.');
 const factor=1/(1+Number(plan.assumptions.resource_saver||0)/100),free=new Set(plan.assumptions.unlimited_free_items.map(r=>r.id));
 // Incoming supplies are a finite reserve outside the loop's inventory cap.
 // Only drops and items crafted in the loop occupy its limited inventory.
 const stock={},craftedStock={},incoming={},remaining={},requiredRemaining={},optionalRemaining={},order=[],seen=new Set();
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
 const continuous=slots>=order.length&&!priorityStages, stopWork=new Map(),stopPhases=new Map(),stopRounds=new Map(),stopRuns=new Map(),activeWork={},groupWork={},unsafeMerges=new Map();
 let recording=null,currentPlace='start',currentIndex=-1,currentGroup=null;
 const setups=[];for(let i=0;i<order.length;i+=slots)setups.push(order.slice(i,i+slots));
 const menuRank=id=>{const i=explorationMenuOrder.indexOf(id);return i<0?explorationMenuOrder.length:i;};
 const parts=[...plan.areas].sort((a,b)=>menuRank(a.location_id)-menuRank(b.location_id)).map(a=>{
  const loc=locations.find(l=>l.id===a.location_id),rolls=ciderEffectiveness(settings,a.location_id).rolls;
  const perDrink=(method==='AP'?(settings.lemon_squeezer?500:200)*dropFactor:rolls*.4)/loc.base_drop_rate;
  return {id:a.location_id,name:a.name,explores:a.explores,perDrink,staminaPerDrink:method==='Cider'?rolls*(1-wanderer)*(foods.neigh?.8:1):0,left:Math.ceil(a.explores/perDrink-1e-9),total:Math.ceil(a.explores/perDrink-1e-9),
   drops:Object.entries(a.items.filter(d=>!free.has(d.item_id)).reduce((totals,d)=>{totals[d.item_id]=(totals[d.item_id]||0)+d.expected_drops/a.explores*perDrink;return totals;},{})).map(([id,q])=>({id,q}))};
 });
 const totals={...remaining},requiredTotals={...requiredRemaining},optionalTotals={...optionalRemaining},produced={},demand={...targetReserves};
 for(const [id,n] of Object.entries(totals)){
  if(!free.has(id))produced[id]=n*recipes[id].out;
  for(const [child,q] of recipes[id].ingredients)demand[child]=(demand[child]||0)+n*q;
 }
 // Size the initial loop from planned work, never from unused exploration
 // drops. Incoming supplies live outside the cap; crafted output still needs room.
 const requiredExploreSupply=Object.fromEntries(Object.entries(demand).filter(([id])=>!free.has(id)).map(([id,q])=>[id,Math.max(0,q-(produced[id]||0)-(incoming[id]||0))]));
 let rounds=settings._rounds||Math.max(1,...Object.values(requiredExploreSupply).concat(Object.values(produced)).map(n=>Math.ceil(2*n/capacity)));
 for(const p of parts){p.batch=Math.max(drinksPerClick,Math.ceil(p.total/rounds/drinksPerClick)*drinksPerClick);p.left=p.batch*rounds;p.scheduled=p.left;}
 const dropTotals={},lost={},lostByLocation={};
 for(const p of parts)for(const d of p.drops)dropTotals[d.id]=(dropTotals[d.id]||0)+d.q*p.scheduled;
 // Only mathematically surplus drops may be lost. Reject earlier than the
 // final replay check when overflow would consume any needed supply.
 const surplusRoom=id=>Math.max(0,(dropTotals[id]||0)-(requiredExploreSupply[id]||0)-(lost[id]||0));
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
 // Consolidation replays a candidate schedule with the same drink batches.
 // Recipe order is always rebuilt from the dependency graph, not set insertion.
 if(settings._activeGroups){
  activeGroups.splice(0,activeGroups.length,...settings._activeGroups.map(g=>({...g,recipes:order.filter(id=>g.recipes.includes(id))})));
  let next=0;
  for(const group of activeGroups){
   if(group.start!==next||group.end<group.start||group.end>=parts.length||group.recipes.length>slots)throw Error('Invalid Craftworks schedule.');
   next=group.end+1;
  }
  if(next!==parts.length)throw Error('Incomplete Craftworks schedule.');
 }
 const interval=Math.max(1,...activeGroups.map(g=>g.end-g.start+1));
 const visitRecipes=parts.map((_,i)=>activeGroups.find(g=>i>=g.start&&i<=g.end).recipes);
 const stopPlaces=new Set(activeGroups.map(g=>g.end));
 for(const p of parts)p.dropRates=Object.fromEntries(p.drops.map(d=>[d.id,d.q]));
 const visits=[],empties=[],sales=[];let uses=0,crafts=0,round=1,problem=null,failure=null,verificationSteps=0;
 const requiredAllowance={},optionalAllowance={},delivered={},needed={},future={};
 let requiredHoldsCache=null,checkpointPlace=-1;
 const targetHeld=id=>Math.max(0,(targetReserves[id]||0)*Math.min(round,rounds)/rounds-(delivered[id]||0));
 const spendable=id=>Math.max(0,available(id)-targetHeld(id));
 for(const id of order){for(const [child,q] of recipes[id].ingredients)needed[child]=(needed[child]||0)+remaining[id]*q;future[id]=(future[id]||0)+remaining[id]*recipes[id].out;}
 for(const p of parts)for(const d of p.drops)future[d.id]=(future[d.id]||0)+p.left*d.q;
 const cadence=settings._craftCadence||{},saleCadence=settings._saleCadence||{},saleReserve=settings._saleReserve||{};
 function craftCutoff(id){const every=cadence[id]||1;return round>=rounds?rounds:round%every===0?round:0;}
 function consumeStock(id,quantity){stock[id]=Math.max(0,(stock[id]||0)-quantity);craftedStock[id]=Math.max(0,(craftedStock[id]||0)-quantity);}
 function allowRound(){
  requiredHoldsCache=null;
  for(const id of order){
   requiredAllowance[id]=Math.max(0,Math.min(requiredRemaining[id]||0,Math.ceil((requiredTotals[id]||0)*craftCutoff(id)/rounds)-((requiredTotals[id]||0)-(requiredRemaining[id]||0))));
   optionalAllowance[id]=Math.max(0,Math.min(optionalRemaining[id]||0,Math.ceil((optionalTotals[id]||0)*craftCutoff(id)/rounds)-((optionalTotals[id]||0)-(optionalRemaining[id]||0))));
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
 function optionalAllowed(id,atCheckpoint){return !contestedOptional.has(id)||(!atCheckpoint&&currentGroup?.optionalActive?.includes(id))||(atCheckpoint&&releasePlace[id]!==undefined&&checkpointPlace>=releasePlace[id]);}
 function craft(ids=order,atCheckpoint=false){
  const selectedIds=new Set(ids);
  function run(id,kind,pending,quota){
   if(problem||!pending[id]||quota[id]<=0)return;
   let count=quota[id];const {ingredients,out}=recipes[id],holds=kind==='optional'&&contestedOptional.has(id)?requiredHolds():null;
   const promoted=kind==='optional'&&!recording&&contestedOptional.has(id)&&currentGroup?.optionalActive?.includes(id);
   if(promoted){
    let unreserved=count;
    for(const [child,q] of ingredients)unreserved=Math.min(unreserved,Math.floor((spendable(child)+1e-8)/q));
    if(!free.has(id))unreserved=Math.min(unreserved,Math.floor((capacity-(stock[id]||0)+1e-8)/out));
    // A merge cannot rely on secretly pausing an enabled optional recipe. If it
    // could run before its required branch is ready, or use reserved inputs,
    // retain a real setup change instead.
    if(unreserved>0&&(releasePlace[id]===undefined||currentIndex<releasePlace[id]||ingredients.some(([child,q])=>available(child)-unreserved*q+1e-7<(holds?.[child]||0))))
     unsafeMerges.set(currentGroup.start+':'+id,{start:currentGroup.start,id});
   }
   for(const [child,q] of ingredients)count=Math.min(count,Math.floor(((kind==='required'?spendable(child):Math.max(0,available(child)-(holds?.[child]||0)))+1e-8)/q));
   if(!free.has(id))count=Math.min(count,Math.floor((capacity-(stock[id]||0)+1e-8)/out));
   if(count<=0)return;
   for(const [child,q] of ingredients){
    const used=count*q,provided=Math.min(incoming[child]||0,used);
    incoming[child]=(incoming[child]||0)-provided;consumeStock(child,used-provided);needed[child]-=used;
   }
   if(!free.has(id)){stock[id]=(stock[id]||0)+count*out;craftedStock[id]=(craftedStock[id]||0)+count*out;}
   remaining[id]-=count;pending[id]-=count;quota[id]-=count;future[id]-=count*out;crafts+=count;checkStock(id);
   if(kind==='required')requiredHoldsCache=null;
   if(settings._trace)settings._trace({type:'craft',round,place:recording||currentPlace,id,kind,count,held:kind==='optional'?{...requiredHolds()}:null});
   if(recording){
    if(!stopRounds.has(recording))stopRounds.set(recording,new Set());
    stopRounds.get(recording).add(round);
    if(!stopWork.has(recording))stopWork.set(recording,{});
    const work=stopWork.get(recording);work[id]=(work[id]||0)+count;
    if(!stopPhases.has(recording))stopPhases.set(recording,{required:{},optional:{}});
    const phase=stopPhases.get(recording)[kind];phase[id]=(phase[id]||0)+count;
    if(!stopRuns.has(recording))stopRuns.set(recording,{});
    const runs=stopRuns.get(recording),key=kind+':'+id,byRound=runs[key]||(runs[key]={}),at=Math.min(round,rounds);byRound[at]=(byRound[at]||0)+count;
   }else{activeWork[id]=(activeWork[id]||0)+count;if(currentGroup){const work=groupWork[currentGroup.start]||(groupWork[currentGroup.start]={});work[id]=(work[id]||0)+count;}}
  }
  // Simulate ingredient production in dependency order, completing all payable
  // required crafts before the optional pass. Display order is reversed within
  // each priority, so finished recipes still sit above their ingredients.
  for(const id of order)if(selectedIds.has(id))run(id,'required',requiredRemaining,requiredAllowance);
  for(const id of order)if(selectedIds.has(id)&&optionalAllowed(id,atCheckpoint))run(id,'optional',optionalRemaining,optionalAllowance);
 }
 function atStop(key){
  // Finishing the already loaded recipes is not a Craftworks swap.
  if(currentGroup)craft(currentGroup.recipes);
  recording=key;checkpointPlace=key==='finish'?parts.length-1:parts.findIndex(p=>p.id===key);craft(order.filter(id=>(!settings._checkpointRecipes||settings._checkpointRecipes[key]?.includes(id))&&!settings._deferredStops?.[key]?.includes(id)),true);recording=null;
 }
 function deliverTargets(){
  requiredHoldsCache=null;
  for(const id of Object.keys(targetReserves)){
   const amount=Math.min(available(id),targetHeld(id)),provided=Math.min(incoming[id]||0,amount);
   incoming[id]=(incoming[id]||0)-provided;consumeStock(id,amount-provided);delivered[id]=(delivered[id]||0)+amount;
  }
 }
 function clearFinished(){if(problem)return false;
  deliverTargets();
  const cleared=[],sold=[];
  for(const [id,n] of Object.entries(stock)){
   const keep=Math.max(round<rounds?(saleReserve[id]||0):0,(needed[id]||0)+(targetReserves[id]||0)-(delivered[id]||0)-(future[id]||0)-(incoming[id]||0));
   const every=saleCadence[id]||1;
   // Hold completed crafted surplus until its scheduled selling stop. Final
   // cleanup remains available for batches larger than one inventory stack.
   if((produced[id]||0)>0&&round<rounds&&round%every!==0)continue;
   const quantity=Math.floor(n-keep+1e-8);if(quantity<=0)continue;
   // Drops can be discarded. Manufactured stock leaves inventory only through
   // an explicit sale, never through exploration overflow or an invisible empty.
   const crafted=Math.min(quantity,craftedStock[id]||0);
   cleared.push({id,quantity});consumeStock(id,quantity);
   // Mixed-source stacks need the entire cleared surplus sold too: leaving
   // collected copies behind would invalidate space reserved for future crafts.
   if((produced[id]||0)>0)sold.push({id,quantity,craftedQuantity:crafted,keep:stock[id]||0});
  }
  if(sold.length)sales.push({round:Math.min(round,rounds),place:round>rounds?'finish':currentPlace,after:uses,items:sold});
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
   currentPlace=p.id;currentIndex=placeIndex;currentGroup=activeGroups.find(g=>g.start<=placeIndex&&g.end>=placeIndex);
   // Carry-over ingredients can make a loaded recipe payable before any drink.
   craft(visitRecipes[placeIndex]);
   const v={id:p.id,name:p.name,drinks:0,explores:0,after:uses,round};visits.push(v);
   for(let j=0;j<p.batch&&!problem;){
    let clicks=(p.batch-j)/drinksPerClick;
    for(const d of p.drops)if(d.q>0)clicks=Math.min(clicks,Math.floor((capacity-(stock[d.id]||0)+surplusRoom(d.id)+1e-7)/(d.q*drinksPerClick)));
    if(clicks<1){const ids=p.drops.filter(d=>(stock[d.id]||0)+d.q*drinksPerClick>capacity+surplusRoom(d.id)+1e-7).map(d=>d.id);failure={kind:'needed_supply',round,place:placeIndex,items:ids,remaining:{...remaining}};problem='These visits would lose '+ids.slice(0,4).map(id=>items[id]?.name||id).join(', ')+' needed for planned crafts or targets.';break;}
    // Exploration overflow is surplus only if all planned work still finishes.
    // Keep the physical cap: clip drops, never invent stock or discard crafted
    // output. The completion checks reject schedules that lose needed supply.
    // Until another recipe becomes payable, stock can only rise or saturate,
    // so this endpoint is equivalent to checking each whole drink/food click.
    clicks=settings._singleClick?1:Math.min(clicks,nextCraftClick(p,visitRecipes[placeIndex]));
    verificationSteps++;
    const drinks=clicks*drinksPerClick;
    for(const d of p.drops){const quantity=d.q*drinks,total=(stock[d.id]||0)+quantity,overflow=Math.max(0,total-capacity);if(overflow){lost[d.id]=(lost[d.id]||0)+overflow;const at=lostByLocation[p.id]||(lostByLocation[p.id]={});at[d.id]=(at[d.id]||0)+overflow;}stock[d.id]=total-overflow;future[d.id]-=quantity;checkStock(d.id);}if(problem)break;
    p.left-=drinks;uses+=drinks;j+=drinks;v.drinks+=drinks;v.explores+=p.perDrink*drinks;craft(visitRecipes[placeIndex]);
   }
   if(stopPlaces.has(placeIndex))atStop(p.id);
   if(settings._traceInventory)settings._traceInventory({round,place:p.id,stock:{...stock},incoming:{...incoming},remaining:{...remaining}});
  }
  clearFinished();atStop(parts.at(-1)?.id||'start');clearFinished();
 }
 // Empty completed stacks when needed to finish the remaining crafts.
 if(!problem){allowRound();let previous=-1;while(Object.values(remaining).some(n=>n)&&previous!==crafts){previous=crafts;clearFinished();atStop('finish');}
  if(Object.values(remaining).some(n=>n)){const unfinished=Object.keys(remaining).filter(id=>remaining[id]>0);failure={kind:'craft_shortfall',items:unfinished,remaining:{...remaining}};problem='These visits cannot finish every planned craft: '+unfinished.slice(0,4).map(id=>items[id]?.name||id).join(', ')+'. Needed ingredients must fit before crafting.';}
 }
 if(!problem){deliverTargets();if(Object.entries(targetReserves).some(([id,q])=>(delivered[id]||0)+1e-6<q)){failure={kind:'target_shortfall',items:Object.keys(targetReserves).filter(id=>(delivered[id]||0)+1e-6<targetReserves[id])};problem='The route does not preserve every required target output.';}}
 if(!problem)clearFinished();
 if(!problem&&!settings._rounds&&rounds>1){
  let best=simulateInventoryRoute(plan,items,locations,{...settings,_rounds:rounds}),low=1,high=rounds-1;
  // A bounded search for larger batches; this is a heuristic, not a global optimum.
  for(let attempt=0;attempt<7&&low<=high;attempt++){
   const mid=Math.floor((low+high)/2),candidate=simulateInventoryRoute(plan,items,locations,{...settings,_rounds:mid});
   if(candidate.complete){best=candidate;high=mid-1;}else low=mid+1;
  }
  return best;
 }
 if(problem&&!settings._groupSpan&&interval>1){
  for(let span=interval-1;span>=1;span--){const candidate=simulateInventoryRoute(plan,items,locations,{...settings,_rounds:rounds,_groupSpan:span});if(candidate.complete)return candidate;}
 }
 const stopRank=id=>id==='finish'?parts.length:parts.findIndex(p=>p.id===id);
 const craftStops=[...stopWork].sort(([a],[b])=>stopRank(a)-stopRank(b)).map(([id,work])=>{
  const atRounds=[...stopRounds.get(id)],recipes=order.filter(ref=>work[ref]>0),sets=[],setPhases=[],setAmounts=[],once=id==='start'||id==='finish';
  for(const kind of ['required','optional']){
   const amounts=stopPhases.get(id)[kind],refs=order.filter(ref=>amounts[ref]>0);
   for(let i=0;i<refs.length;i+=slots){
    const group=refs.slice(i,i+slots);
    sets.push(group);setPhases.push(kind);setAmounts.push(Object.fromEntries(group.map(ref=>[ref,amounts[ref]/(once?1:rounds)])));
   }
  }
  return {id,name:id==='start'?'Before the first location':id==='finish'?'After the final loop':`After ${parts.find(p=>p.id===id)?.name||'the final location'}`,once,firstRound:atRounds[0],lastRound:atRounds.at(-1),runCount:atRounds.length,runs:stopRuns.get(id),recipes,sets,setPhases,setAmounts,amounts:Object.fromEntries(recipes.map(ref=>[ref,work[ref]/(once?1:rounds)]))};
 });
 return {craftCadence:{...cadence},saleCadence:{...saleCadence},saleReserve:{...saleReserve},sales,requiredExploreSupply,dropTotals,overflow:lost,overflowByLocation:lostByLocation,surplusOverflow:Object.entries(lost).filter(([,q])=>q>1e-7).map(([id,quantity])=>({id,quantity,percent:100*quantity/dropTotals[id],expectedDrops:dropTotals[id]})).sort((a,b)=>b.quantity-a.quantity),failure,deferredStops:settings._deferredStops||{},unsafeMerges:[...unsafeMerges.values()],priorityStages,releasePlace,requiredRecipes:[...requiredIds],contestedOptional:[...contestedOptional],deliveredTargets:delivered,capacity,inventoryPeaks,verificationSteps,inventoryVerified:!problem,method,drinksPerClick,activeWork,stamina:parts.reduce((n,p)=>n+p.scheduled*p.staminaPerDrink,0),rounds,slots,setups,continuous,interval,activeGroups:activeGroups.map(g=>({...g,amounts:Object.fromEntries(Object.entries(groupWork[g.start]||{}).map(([id,q])=>[id,q/rounds])),from:parts[g.start].name,to:parts[g.end].name,after:g.start?parts[g.start-1].id:null})),craftStops,minimumContinuousSlots:order.length,minimumStopSlots:Math.max(0,...craftStops.map(s=>s.recipes.length)),crafting:order.map(id=>({id,perLoop:totals[id]/rounds,total:totals[id]})),extraExplores:parts.reduce((n,p)=>n+p.scheduled*p.perDrink-p.explores,0),parts:parts.map(p=>({...p,visits:visits.filter(v=>v.id===p.id).length,maxRun:visits.reduce((n,v)=>v.id===p.id?Math.max(n,v.drinks):n,0)})),visits,empties,problem,uses,complete:!problem};
}
// Choose where crafting is necessary, rather than where it first becomes payable.
// Every accepted schedule is replayed over all loops with the same craft totals.
function computeInventoryRoute(plan,items,locations,settings){
 const quiet={...settings,_trace:undefined,_traceInventory:undefined};
 let best=simulateInventoryRoute(plan,items,locations,quiet);
 if(settings._noConsolidation||settings._activeGroups||!best.complete||!best.parts.length){
  if(settings._trace||settings._traceInventory)return simulateInventoryRoute(plan,items,locations,{...settings,_rounds:best.rounds,_activeGroups:best.activeGroups,_groupSpan:1});
  return best;
 }
 const original=best;
 const ids=best.crafting.map(c=>c.id),last=best.parts.at(-1).id,end=best.parts.length-1;
 const finalOnly={[last]:ids,finish:ids};
 const schedule=r=>r.activeGroups.map(g=>({start:g.start,end:g.end,recipes:[...g.recipes],optionalActive:[...(g.optionalActive||[])]}));
 // Count location visits, setup loads and the trip to/from Craftworks at an
 // intermediate location. Recipe entries break ties in favor of less editing.
 function effort(r){
  let loads=0,midway=0,entries=0,early=0;
  for(const [i,g] of r.activeGroups.entries())if(g.recipes.length){loads++;entries+=g.recipes.length;early+=g.recipes.length*(g.end-g.start+1);if(i>0)midway++;}
  for(const stop of r.craftStops)if(!stop.once){loads+=stop.sets.length;entries+=stop.sets.reduce((n,ids)=>n+ids.length,0);if(stop.id!==last)midway++;}
  return [r.rounds*(r.parts.length+loads+2*midway),r.rounds*entries,r.uses,early];
 }
 const better=(a,b)=>{const x=effort(a),y=effort(b);for(let i=0;i<x.length;i++)if(x[i]!==y[i])return x[i]<y[i];return false;};
 let calls=0;const tried=new Map();
 function replay(groups,checkpoints,rounds){
  const key=JSON.stringify([groups,checkpoints,rounds]);if(tried.has(key))return tried.get(key);
  if(calls>=80)return null;calls++;
  const r=simulateInventoryRoute(plan,items,locations,{...quiet,_rounds:rounds,_activeGroups:groups,_checkpointRecipes:checkpoints,_deferredStops:{},_groupSpan:1});
  tried.set(key,r);return r;
 }
 function valid(r){return r?.complete&&!r.unsafeMerges.length;}
 let chosen={groups:schedule(best),checkpoints:null};
 function consider(r,groups,checkpoints){if(valid(r)&&better(r,best)){best=r;chosen={groups,checkpoints};}}

 // First try collecting everything and crafting after the final location.
 // Search whole-drink batches for the largest visits that make this possible.
 const noActive=[{start:0,end,recipes:[],optionalActive:[]}];
 let low=1,high=best.rounds,late=replay(noActive,finalOnly,high);
 if(!valid(late)&&!settings._rounds){
  // A simpler route can justify more loops, but not more total navigation.
  const minimumLoads=Math.max(1,Math.ceil(ids.length/best.slots));
  const limit=Math.max(high,Math.floor(effort(best)[0]/(best.parts.length+minimumLoads)));
  low=high+1;high=limit;late=replay(noActive,finalOnly,high);
 }
 if(valid(late)){
  let accepted=late;consider(late,noActive,finalOnly);
  if(!settings._rounds)for(let n=0;n<11&&low<high;n++){
   const mid=Math.floor((low+high)/2),r=replay(noActive,finalOnly,mid);
   if(valid(r)){accepted=r;high=mid;consider(r,noActive,finalOnly);}else low=mid+1;
  }
  consider(accepted,noActive,finalOnly);
 }

 // Keep useful active sets from the original verified schedule, but defer ALL
 // additional checkpoint work, not only recipes already seen at a later stop.
 let groups=schedule(original),candidate=replay(groups,finalOnly,original.rounds);
 if(valid(candidate)){
  consider(candidate,groups,finalOnly);
  // Remove whole groups/chunks first. A failed removal is split to identify the
  // small set of crafts that truly has to happen before the end of the loop.
  function remove(i,refs,limit=65){
   if(!refs.length||calls>=limit)return;
   const next=groups.map(g=>({...g,recipes:[...g.recipes],optionalActive:[...g.optionalActive]}));
   next[i].recipes=next[i].recipes.filter(id=>!refs.includes(id));next[i].optionalActive=next[i].optionalActive.filter(id=>next[i].recipes.includes(id));
   const r=replay(next,finalOnly,original.rounds);
   if(valid(r)){groups=next;candidate=r;consider(r,groups,finalOnly);return;}
   if(refs.length>1){const mid=Math.floor(refs.length/2);remove(i,refs.slice(0,mid),limit);remove(i,refs.slice(mid),limit);}
  }
  for(let i=0;i<groups.length;i++)remove(i,[...groups[i].recipes].reverse());
  // Identical/empty stretches do not require a setup change. Union small sets
  // only when a full replay proves they can stay loaded across both stretches.
  for(let i=0;i+1<groups.length;i++){
   const a=groups[i],b=groups[i+1],recipes=[...new Set([...a.recipes,...b.recipes])];if(recipes.length>best.slots)continue;
   const next=groups.map(g=>({...g}));next.splice(i,2,{start:a.start,end:b.end,recipes,optionalActive:[...new Set([...a.optionalActive,...b.optionalActive])]});
   const r=replay(next,finalOnly,original.rounds);
   if(valid(r)){groups=next;candidate=r;consider(r,groups,finalOnly);i--;}
  }
  // Coalescing stretches changes ingredient availability. Recheck the small
  // remaining sets so obsolete early recipes do not survive the first pass.
  for(let i=0;i<groups.length;i++)remove(i,[...groups[i].recipes].reverse(),80);
 }
 // Batch infrequent checkpoint crafts. The largest interval is tried first;
 // failed replays are split so one storage-heavy recipe cannot prevent other
 // branches from waiting. No added exploration and no changed craft targets.
 let cadence={...(settings._craftCadence||{})},cadenceCalls=0;
 const active=new Set(chosen.groups.flatMap(g=>g.recipes));
 const totals=Object.fromEntries(best.crafting.map(c=>[c.id,c.total]));
 const factor=1/(1+Number(plan.assumptions.resource_saver||0)/100);
 const free=new Set(plan.assumptions.unlimited_free_items.map(i=>i.id));
 const volume=id=>Math.max(totals[id]*(items[id].output_quantity||1),...Object.entries(items[id].direct_ingredients||{}).filter(([ref])=>!free.has(ref)).map(([,q])=>totals[id]*q*factor));
 const candidates=ids.filter(id=>!active.has(id)).sort((a,b)=>volume(a)-volume(b));
 const intervals=[best.rounds,...[100,50,20,10,5,2].filter(n=>n<best.rounds)];
 function delay(refs,every){
  if(!refs.length||cadenceCalls>=40)return;
  const next={...cadence,...Object.fromEntries(refs.map(id=>[id,every]))};cadenceCalls++;
  const r=simulateInventoryRoute(plan,items,locations,{...quiet,_rounds:best.rounds,_activeGroups:chosen.groups,_checkpointRecipes:chosen.checkpoints,_craftCadence:next,_groupSpan:1});
  if(valid(r)){best=r;cadence=next;return;}
  if(refs.length>1){const mid=Math.floor(refs.length/2);delay(refs.slice(0,mid),every);delay(refs.slice(mid),every);}
 }
 if(!settings._noCadence&&!settings._craftCadence&&best.rounds>1)for(const every of intervals){
  // This volume bound selects candidates only. Full shared-stock replay, not
  // the estimate, decides whether a schedule may be accepted.
  if(every>1)delay(candidates.filter(id=>!cadence[id]&&volume(id)*every/best.rounds<=best.capacity),every);
 }
 // Selling gets its own cadence: crafting each loop does not mean selling
 // each loop. Use the verified trace to bound retained surplus, then replay
 // the combined schedule so shared materials and mixed-source stacks stay safe.
 let saleCadence={...(settings._saleCadence||{})},saleReserve={...(settings._saleReserve||{})};
 // A constant reserve makes selling instructions usable without a loop picker.
 // Adopt it only if the full route remains feasible with that stock retained.
 if(!settings._saleReserve&&!settings._noSaleBatching){
  const proposal={};for(const sale of best.sales)if(sale.round<best.rounds)for(const row of sale.items)proposal[row.id]=Math.max(proposal[row.id]||0,Math.ceil(row.keep-1e-7));
  const r=simulateInventoryRoute(plan,items,locations,{...quiet,_rounds:best.rounds,_activeGroups:chosen.groups,_checkpointRecipes:chosen.checkpoints,_craftCadence:cadence,_saleReserve:proposal,_groupSpan:1});
  if(valid(r)){best=r;saleReserve=proposal;}
 }
 if(!settings._saleCadence&&!settings._noSaleBatching&&best.rounds>1){
  const perItem={};
  for(const sale of best.sales)for(const row of sale.items){const runs=perItem[row.id]||(perItem[row.id]={});runs[sale.round]=(runs[sale.round]||0)+row.quantity;}
  const proposal={};
  for(const [id,runs] of Object.entries(perItem)){
   for(const every of intervals){
    if(every<=1)continue;
    let retained=0,safe=true;
    for(let round=1;round<=best.rounds;round++){
     if((best.inventoryPeaks[id]||0)+retained>best.capacity+1e-7){safe=false;break;}
     retained+=runs[round]||0;
     if(round%every===0||round===best.rounds)retained=0;
    }
    if(safe){proposal[id]=every;break;}
   }
  }
  let attempts=0;
  function batchSales(refs){
   if(!refs.length||attempts++>=16)return;
   const next={...saleCadence,...Object.fromEntries(refs.map(id=>[id,proposal[id]]))};
   const r=simulateInventoryRoute(plan,items,locations,{...quiet,_rounds:best.rounds,_activeGroups:chosen.groups,_checkpointRecipes:chosen.checkpoints,_craftCadence:cadence,_saleCadence:next,_saleReserve:saleReserve,_groupSpan:1});
   if(valid(r)){best=r;saleCadence=next;return;}
   if(refs.length>1){const mid=Math.floor(refs.length/2);batchSales(refs.slice(0,mid));batchSales(refs.slice(mid));}
  }
  batchSales(Object.keys(proposal));
 }
 best.scheduleEffort=effort(best);best.checkpointRecipes=chosen.checkpoints;
 if(settings._trace||settings._traceInventory){const r=simulateInventoryRoute(plan,items,locations,{...settings,_rounds:best.rounds,_activeGroups:chosen.groups,_checkpointRecipes:chosen.checkpoints,_craftCadence:cadence,_saleCadence:saleCadence,_saleReserve:saleReserve,_groupSpan:1});r.scheduleEffort=best.scheduleEffort;r.checkpointRecipes=chosen.checkpoints;return r;}
 return best;
}
// UI-only changes must not rerun the complete schedule search. Cache by values,
// including catalog and plan data, so edits and data refreshes cannot go stale.
let lastInventoryRoute=null;
function inventoryRoute(plan,items,locations,settings){
 if(Object.keys(settings).some(key=>key.startsWith('_')))return computeInventoryRoute(plan,items,locations,settings);
 const options=Object.fromEntries(['inventory_size','craftworks_slots','route_method','route_foods','wanderer','lemon_squeezer','cinnamon','sprint_shoes','effectiveness_upgrades','cider_rolls'].map(key=>[key,settings[key]]));
 const key=JSON.stringify([plan,items,locations,options]);
 if(lastInventoryRoute?.key===key)return lastInventoryRoute.result;
 const result=computeInventoryRoute(plan,items,locations,settings);lastInventoryRoute={key,result};return result;
}
function craftworksDisplayOrder(ids,requiredIds){const required=new Set(requiredIds);return [...ids].reverse().filter(id=>required.has(id)).concat([...ids].reverse().filter(id=>!required.has(id)));}
if(typeof module!=='undefined')module.exports={inventoryRoute,craftworksDisplayOrder};
