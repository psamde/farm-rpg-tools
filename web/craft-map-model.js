/* Pure graph accounting. Draft quantities are aims; the solver confirms outcomes. */
// Distinguish an unselected exploration source from an ingredient that cannot
// be explored for at all. Farm classification is crops only, not every passive item.
function craftMapExternalSource(item){
 if(item?.farm_produced||item?.type==='crop')return 'farming';
 if(item?.craftable===false&&item.explorable===false)return 'other';
 return null;
}
function craftMapAutoSupplied(item,settings){
 if(!craftMapExternalSource(item)||item?.explorable)return false;
 const inventory=JSON.parse((settings.planner_mode==='passive'?settings.passive_inventory:settings.inventory)||'{}');
 return !Object.hasOwn(inventory,item.id);
}
function craftMapInventoryNeed(node,item){
 if(node.free)return 0;
 const shortage=Math.max(node.missing||0,node.potentialMissing||0,
  !node.draft?(node.draftCrafts||0)*(item?.output_quantity||1):0);
 return shortage>0?Math.ceil(shortage):craftMapExternalSource(item)?1:0;
}
// Explain zero-output recipes without treating unsupplied ingredients
// as free. An intermediate already in stock can satisfy its branch directly.
function craftMapMissingInputs(items,nodes,itemId){
 const byId=new Map(nodes.map(n=>[n.id,n])),seen=new Set(),missing=[];
 function visit(id){
  if(seen.has(id))return;seen.add(id);
  const item=items[id],node=byId.get(id);
  if(!item||node?.free||node?.autoSupply||(id!==itemId&&(node?.stock||0)>1e-8))return;
  if(item.craftable){for(const child of Object.keys(item.direct_ingredients||{}))visit(child);}
  else if(node&&!(node.totalSupply>0))missing.push(id);
 }
 visit(itemId);
 return missing.sort((a,b)=>items[a].name.localeCompare(items[b].name));
}
// Solver shortages are useful when a recipe makes zero, including when its
// ingredients exist in the route but have already been reserved or consumed.
function craftMapShortages(plan,itemId){
 const goal=plan?.secondary?.targets?.find(g=>g.item_id===itemId);
 if(!goal||goal.crafts>=1||goal.cap===0)return [];
 return (goal.missing_for_next_craft||[]).filter(r=>r.quantity>1e-8).map(r=>{
  const balance=plan.item_balances.find(b=>b.item_id===r.item_id);
  const primary=!!balance&&(balance.original_leftover_pool??Infinity)<r.quantity&&(balance.used_by_leftover_craft||0)<1e-8&&((balance.consumed_by_crafting||0)+(balance.reserved_target_output||0)>0);
  return {...r,primary};
 });
}
function craftMapIsSoft(goal){
 if(goal.consumer_mode==='fixed')return false;
 return goal.consumer_mode==='available'||goal.available_only===true||goal.cap===null;
}
function craftMapDraftQuantity(goal){
 // A soft selection is not a zero-craft order. Only a separate display estimate
 // can supply its provisional quantity; the solver remains authoritative.
 const value=goal.estimated_crafts??goal.cap;
 return Number.isFinite(value)&&value>0?value:0;
}
function buildCraftMap(items,plan,settings,drafts=[],expanded=[]){
 if(settings.provided_targets)settings={...settings,targets:Object.fromEntries(Object.entries(settings.targets||{}).map(([id,q])=>[id,Math.max(0,q-(settings.provided_targets[id]?.quantity||0))]).filter(([,q])=>q>0))};
 const nodes=new Map(),links=new Map(),balances=Object.fromEntries(plan.item_balances.map(b=>[b.item_id,b]));
 // Optional outputs are reserved only for legacy report presentation. They
 // remain usable stock in the map; only primary-target reservations are held.
 const available=b=>Math.max(0,(b?.expected_unused||0)+(b?.reserved_secondary_output||0));
 const factor=1/(1+(settings.resource_saver||0)/100),free=id=>settings.iron_depot&&['Iron','Nails'].includes(items[id]?.name);
 const roots=new Set([...Object.keys(settings.targets||{}),...(settings.secondary||[]).map(g=>g.item_id),...drafts.map(g=>g.item_id)]);
 const order=[],seen=new Set();
 function visit(id){if(seen.has(id)||!items[id])return;seen.add(id);if(!free(id))for(const child of Object.keys(items[id].direct_ingredients))visit(child);order.push(id);}
 roots.forEach(visit);
 const draftCrafts={},demand={},missing={};
 for(const g of drafts)draftCrafts[g.item_id]=craftMapDraftQuantity(g);
 // All parent demands accumulate before a shared ingredient is evaluated.
 for(const id of [...order].reverse()){
  if(free(id)||craftMapAutoSupplied(items[id],settings))continue;
  const stock=available(balances[id]),short=Math.max(0,(demand[id]||0)-stock);
  if(items[id].craftable){
   const crafts=Math.max(draftCrafts[id]||0,Math.ceil(short/items[id].output_quantity-1e-8));
   draftCrafts[id]=crafts;
   for(const [child,q] of Object.entries(items[id].direct_ingredients))demand[child]=(demand[child]||0)+crafts*q*factor;
  }else if(short>1e-6)missing[id]=short;
 }
 // Show only recipe branches actually crafted in this plan or proposed draft.
 const crafted=id=>(balances[id]?.crafted||0)/(items[id]?.output_quantity||1)+(draftCrafts[id]||0);
 const active=new Set(),inactiveRecipes=new Set();
 function activate(id){if(active.has(id)||!items[id])return;active.add(id);if(!free(id)&&crafted(id)>1e-8)Object.keys(items[id].direct_ingredients).forEach(activate);}
 roots.forEach(activate);
 // Keep the recipe visible when a selected leftover craft currently makes zero.
 function showInactive(id){if(free(id)||!items[id]?.craftable||inactiveRecipes.has(id)||crafted(id)>1e-8)return;inactiveRecipes.add(id);for(const child of Object.keys(items[id].direct_ingredients)){active.add(child);showInactive(child);}}
 for(const goal of [...(settings.secondary||[]),...drafts])if(crafted(goal.item_id)<1e-8)showInactive(goal.item_id);
 const primaryCrafts=plan.crafts_in_dependency_order?Object.fromEntries(plan.crafts_in_dependency_order.map(c=>[c.item_id,c.crafts])):null;
 const requiredUse={};
 for(const [id,count] of Object.entries(primaryCrafts||{}))
  for(const [child,q] of Object.entries(items[id]?.direct_ingredients||{}))requiredUse[child]=(requiredUse[child]||0)+count*q*factor;
 const protectedIds=new Set();
 function protect(id){if(protectedIds.has(id)||!items[id])return;protectedIds.add(id);const count=primaryCrafts?primaryCrafts[id]||0:(balances[id]?.crafted||0);if(!free(id)&&count>1e-8)Object.keys(items[id].direct_ingredients).forEach(protect);}
 Object.keys(settings.targets||{}).forEach(protect);
 seen.clear();active.forEach(id=>seen.add(id));
 const ingredientIds=new Set(Object.values(items).flatMap(i=>Object.keys(i.direct_ingredients)));
 const spare=plan.item_balances.filter(b=>ingredientIds.has(b.item_id)&&available(b)>=1&&!seen.has(b.item_id)&&!free(b.item_id)).sort((a,b)=>available(b)-available(a));
 const limit=settings.map_unused_mode==='all'?spare.length:settings.map_unused_mode==='none'?0:(settings.map_unused_count??6);
 for(const b of spare.slice(0,limit))seen.add(b.item_id);
 const spareIds=new Set(spare.map(b=>b.item_id));
 for(const area of plan.areas)if((settings.map_expanded_areas||[]).includes(area.location_id))
  for(const output of area.items)if(output.expected_drops>0&&spareIds.has(output.item_id))seen.add(output.item_id);
 expanded.forEach(id=>{if(items[id])seen.add(id);});
 for(const id of seen){const b=balances[id]||{};nodes.set(id,{id,kind:'item',name:items[id].name,craftable:!!items[id].craftable,externalSource:craftMapExternalSource(items[id]),autoSupply:craftMapAutoSupplied(items[id],settings),automaticAmount:b.auto_starting_inventory||0,primary:Object.hasOwn(settings.targets||{},id),secondary:(settings.secondary||[]).some(g=>g.item_id===id),draft:drafts.some(g=>g.item_id===id),soft:[...drafts,...(settings.secondary||[])].some(g=>g.item_id===id&&craftMapIsSoft(g)),missing:missing[id]||0,need:demand[id]||0,crafts:(b.crafted||0)/items[id].output_quantity+(draftCrafts[id]||0),draftCrafts:draftCrafts[id]||0,stock:Math.max(0,available(b)+(draftCrafts[id]||0)*items[id].output_quantity-(demand[id]||0)),fromInventory:(b.starting_inventory||0)>0,currentStock:available(b),totalSupply:Math.max(available(b),(b.starting_inventory||0)+(b.expected_exploration_drops||0)+(b.free_perk_supply||0)+(b.crafted||0))+(draftCrafts[id]||0)*items[id].output_quantity,explorationSupplied:plan.areas.some(a=>a.items.some(o=>o.item_id===id&&o.expected_drops>0)),protected:protectedIds.has(id),voided:(settings.map_voided||[]).includes(id),useVoid:(settings.map_use_void||[]).includes(id),free:free(id),depth:1});}
 for(const n of nodes.values())n.requiredUse=(requiredUse[n.id]||0)+(balances[n.id]?.reserved_target_output||0);
 const blockedMemo=new Map();
 function blocked(id,threshold=1e-8){const key=id+':'+threshold;if(blockedMemo.has(key))return blockedMemo.get(key);const value=!free(id)&&Boolean((missing[id]||0)>=threshold||crafted(id)>1e-8&&Object.keys(items[id].direct_ingredients).some(child=>blocked(child,threshold)));blockedMemo.set(key,value);return value;}
 for(const node of nodes.values()){node.blocked=blocked(node.id);node.warningBlocked=blocked(node.id,10);}
 function link(from,to,q,phantom=false){const key=from+'>'+to;links.set(key,{from,to,quantity:q,phantom});}
 for(const id of order){const node=nodes.get(id);if(!node||free(id))continue;for(const [child,q] of Object.entries(items[id].direct_ingredients)){if(node.crafts>0||inactiveRecipes.has(id)){link(child,id,node.crafts*q*factor,Boolean(node.draftCrafts)||inactiveRecipes.has(id));node.depth=Math.max(node.depth,(nodes.get(child)?.depth||1)+1);}}}
 const sources=[];
 for(const area of plan.areas){const id='area:'+area.location_id;nodes.set(id,{id,location:area.location_id,kind:'area',name:area.name,explores:area.explores,depth:0,outputs:area.items.filter(i=>i.expected_drops>0)});sources.push(id);for(const output of area.items)if(nodes.has(output.item_id)&&output.expected_drops>0)link(id,output.item_id,output.expected_drops);}
 const supplied=[...nodes.values()].filter(n=>n.kind==='item'&&(balances[n.id]?.starting_inventory>0||n.free||n.autoSupply));
 if(supplied.length){nodes.set('inventory',{id:'inventory',kind:'inventory',name:settings.planner_mode==='passive'?'Passive production':'Starting supplies',depth:0});for(const n of supplied)link('inventory',n.id,balances[n.id]?.starting_inventory||0);}
 const maxDepth=Math.max(2,...[...nodes.values()].map(n=>n.depth));
 for(const n of nodes.values())if(n.primary)n.depth=maxDepth+1;
 return {nodes:[...nodes.values()],links:[...links.values()],missing,spare:spare.map(b=>b.item_id)};
}
function towerOpportunity(id,level,badges){
 const requirements=[...(badges.items?.[id]||[]).map(level=>({type:'MM',level})),...(badges.gm_items?.[id]||[]).map(level=>({type:'GM',level}))].sort((a,b)=>a.level-b.level);
 return requirements.find(r=>r.level>level)||requirements.at(-1)||null;
}
function layoutCraftMap(nodes,previous={}){
 const positions={...previous},columns=new Map();
 for(const n of nodes){if(!columns.has(n.depth))columns.set(n.depth,[]);columns.get(n.depth).push(n);}
 for(const [depth,rows] of columns){rows.sort((a,b)=>Number(b.primary)-Number(a.primary)||a.name.localeCompare(b.name));for(const n of rows){
  if(positions[n.id]){if(n.primary)positions[n.id]={...positions[n.id],x:Math.max(positions[n.id].x,32+depth*248)};continue;}
  const x=32+depth*248;let y=32;
  while(Object.values(positions).some(p=>Math.abs(p.x-x)<232&&Math.abs(p.y-y)<120))y+=126;
  positions[n.id]={x,y};
 }}
 return positions;
}
if(typeof module!=='undefined')module.exports={buildCraftMap,towerOpportunity,layoutCraftMap,craftMapExternalSource,craftMapInventoryNeed,craftMapMissingInputs,craftMapShortages,craftMapAutoSupplied};

// Source lanes describe this route's contributions, not all potential catalog drops.
function laneLayoutCraftMap(nodes,links,items,areaOrder=[]){
 const byId=new Map(nodes.map(n=>[n.id,n])),incoming=new Map();
 for(const l of links){if(!incoming.has(l.to))incoming.set(l.to,[]);incoming.get(l.to).push(l.from);}
 const areas=nodes.filter(n=>n.kind==='area').sort((a,b)=>{
  const rank=n=>areaOrder.includes(n.location)?areaOrder.indexOf(n.location):999;
  return rank(a)-rank(b)||a.name.localeCompare(b.name);
 });
 const lanes=[{id:'disconnected',name:'No connected supply'},{id:'shared',name:'Multiple Explore Sources'},...areas.map(n=>({id:n.id,name:n.name})),{id:'farming',name:'Farming'},{id:'other',name:'Other Sources'}];
 const laneIndex=new Map(lanes.map((l,i)=>[l.id,i])),assigned=new Map();
 for(const n of nodes){
  const sourceIds=[...new Set((incoming.get(n.id)||[]).filter(id=>byId.get(id)?.kind==='area'))];
  if(n.kind==='area')assigned.set(n.id,laneIndex.get(n.id));
  else if(sourceIds.length)assigned.set(n.id,sourceIds.length>1?laneIndex.get('shared'):laneIndex.get(sourceIds[0]));
  else if(n.kind==='item'&&n.depth<=1&&craftMapExternalSource(items[n.id]))assigned.set(n.id,laneIndex.get(craftMapExternalSource(items[n.id])));
  else if(n.kind==='item'&&n.depth<=1&&!n.free&&(n.missing>=10||!(incoming.get(n.id)||[]).length&&!items[n.id]?.farm_produced&&items[n.id]?.type!=='crop'))assigned.set(n.id,laneIndex.get('disconnected'));
  else if(n.kind==='inventory')assigned.set(n.id,laneIndex.get('other'));
  else if(!n.crafts||n.free)assigned.set(n.id,laneIndex.get(items[n.id]?.farm_produced||items[n.id]?.type==='crop'?'farming':'other'));
 }
 const positions={};let top=24;
 for(let i=0;i<lanes.length;i++){
  const lane=lanes[i],members=nodes.filter(n=>assigned.get(n.id)===i&&(n.depth<=1||n.kind!=='item'));
  if(!members.length){lane.hidden=true;continue;}
  const columns=new Map();for(const n of members){if(!columns.has(n.depth))columns.set(n.depth,[]);columns.get(n.depth).push(n);}
  const maxRows=Math.max(...[...columns.values()].map(rows=>rows.length));
  lane.y=top;lane.height=72+maxRows*184;
  for(const [depth,rows] of [...columns].sort((a,b)=>a[0]-b[0])){
   const center=n=>{const ys=(incoming.get(n.id)||[]).map(id=>positions[id]?.y).filter(y=>y!=null);return ys.length?ys.reduce((a,b)=>a+b,0)/ys.length:top+58;};
   rows.sort((a,b)=>center(a)-center(b)||a.name.localeCompare(b.name));
   const occupied=new Set();
   for(const n of rows){
    const preferred=Math.max(0,Math.min(maxRows-1,Math.round((center(n)-top-58)/184)));
    const slots=Array.from({length:maxRows},(_,i)=>i).filter(i=>!occupied.has(i)).sort((a,b)=>Math.abs(a-preferred)-Math.abs(b-preferred)||a-b);
    const slot=slots[0];occupied.add(slot);positions[n.id]={x:32+depth*280,y:top+58+slot*184};
   }
  }
  top+=lane.height+20;
 }
 // Downstream columns float between their actual inputs rather than inheriting a lane.
 const floating=new Map();
 for(const n of nodes)if(!positions[n.id]){if(!floating.has(n.depth))floating.set(n.depth,[]);floating.get(n.depth).push(n);}
 for(const [depth,rows] of [...floating].sort((a,b)=>a[0]-b[0])){
  const desired=n=>{const all=[...new Set(incoming.get(n.id)||[])],paid=all.filter(id=>!byId.get(id)?.free),refs=paid.length?paid:all;const ys=refs.map(id=>positions[id]?.y).filter(y=>y!=null);return ys.length?ys.reduce((a,b)=>a+b,0)/ys.length:82;};
  rows.sort((a,b)=>desired(a)-desired(b)||a.name.localeCompare(b.name));
  // Pool adjacent blocks when their preferred centers would overlap (isotonic packing).
  const blocks=[];
  rows.forEach((n,i)=>{blocks.push({start:i,end:i,sum:desired(n)-i*184,count:1});
   while(blocks.length>1){const b=blocks.at(-1),a=blocks.at(-2);if(a.sum/a.count<=b.sum/b.count)break;blocks.splice(-2,2,{start:a.start,end:b.end,sum:a.sum+b.sum,count:a.count+b.count});}
  });
  for(const block of blocks)for(let i=block.start;i<=block.end;i++)positions[rows[i].id]={x:32+depth*280,y:Math.max(82,block.sum/block.count)+i*184};
 }
 return {positions,lanes:lanes.filter(l=>!l.hidden),height:Math.max(top,...Object.values(positions).map(p=>p.y+184)),assignments:Object.fromEntries(nodes.map(n=>[n.id,n.depth<=1||n.kind!=='item'?lanes[assigned.get(n.id)]?.id:'flow']))};
}
if(typeof module!=='undefined')module.exports.laneLayoutCraftMap=laneLayoutCraftMap;

function craftMapUsage(n){
 if(n.voided||n.useVoid)return 'void';
 if(n.kind!=='item'||n.free)return '';
 if(n.autoSupply)return 'fulfilled';
 if(n.missing>=10||n.warningBlocked)return 'pending';
 if(!n.primary&&n.totalSupply!=null&&n.totalSupply<1&&!n.explorationSupplied&&!n.fromInventory)return 'unused';
 const negligibleRemainder=n.totalSupply>0&&n.stock/n.totalSupply<0.001;
 return n.primary||n.stock<1||negligibleRemainder?'fulfilled':'unused';
}
if(typeof module!=='undefined')module.exports.craftMapUsage=craftMapUsage;

// Return the same pre-optional supply pool for every candidate. Solved plans
// include optional consumption and production; undo both, so reallocating an
// existing craft does not make its ingredients disappear from the estimate.
function craftMapSupplySnapshot(items,plan,settings,drafts=[],exclude=null){
 const produced=Object.fromEntries((plan.secondary?.crafts_in_dependency_order||[]).map(row=>[row.item_id,row.crafts*(items[row.item_id]?.output_quantity||1)]));
 const restored={...plan,secondary:undefined,item_balances:plan.item_balances.map(b=>({...b,
  expected_unused:Math.max(0,(b.expected_unused||0)+(b.reserved_secondary_output||0)+(b.used_by_leftover_craft||0)-(produced[b.item_id]||0)),
  reserved_secondary_output:0,
  crafted:Math.max(0,(b.crafted||0)-(produced[b.item_id]||0))
 }))};
 const selected=new Map([...(settings.secondary||[]),...drafts].map(g=>[g.item_id,g]));
 const fixed=[...selected.values()].filter(g=>g.item_id!==exclude&&!craftMapIsSoft(g));
 const graph=buildCraftMap(items,restored,{...settings,secondary:[]},fixed,restored.item_balances.map(b=>b.item_id));
 const stock=new Map(graph.nodes.filter(n=>n.kind==='item').map(n=>[n.id,n.stock]));
 const ids=new Set([...restored.item_balances.map(b=>b.item_id),...stock.keys()]);
 return {...restored,item_balances:[...ids].map(item_id=>({item_id,expected_unused:stock.get(item_id)||0,crafted:0})),areas:plan.areas||[]};
}
function craftMapGapsInSnapshot(items,snapshot,settings,id,count){
 const graph=buildCraftMap(items,snapshot,{...settings,secondary:[]},[{item_id:id,cap:count,consumer_mode:'fixed'}]),related=new Set();
 function visit(ref){if(related.has(ref))return;related.add(ref);for(const child of Object.keys(items[ref]?.direct_ingredients||{}))visit(child);}
 visit(id);return Object.entries(graph.missing).filter(([ref])=>related.has(ref)).sort((a,b)=>b[1]-a[1]);
}
function craftMapCandidateGaps(items,plan,settings,drafts,id,count){
 return craftMapGapsInSnapshot(items,craftMapSupplySnapshot(items,plan,settings,drafts,id),settings,id,count);
}
if(typeof module!=='undefined')module.exports.craftMapCandidateGaps=craftMapCandidateGaps;

function craftMapPotentialAim(items,snapshot,settings,id,focus){
 const stock=Object.fromEntries(snapshot.item_balances.map(b=>[b.item_id,Math.max(0,b.expected_unused||0)]));
 const factor=1/(1+(settings.resource_saver||0)/100),free=ref=>craftMapAutoSupplied(items[ref],settings)||settings.iron_depot&&['Iron','Nails'].includes(items[ref]?.name);
 function requirements(ref,q,out,stop,seen=new Set()){
  if(free(ref)||seen.has(ref))return;
  const item=items[ref];
  if(ref===stop||stock[ref]>1e-8||!item?.craftable){out[ref]=(out[ref]||0)+q;return;}
  const next=new Set(seen);next.add(ref);
  for(const [child,n] of Object.entries(item.direct_ingredients||{}))requirements(child,q*n*factor/(item.output_quantity||1),out,stop,next);
 }
 function craftRequirements(ref,stop){const out={};for(const [child,q] of Object.entries(items[ref]?.direct_ingredients||{}))requirements(child,q*factor,out,stop,new Set([ref]));return out;}
 function anchoredCapacity(ref){
  if(free(ref))return 0;
  if(stock[ref]>1e-8)return stock[ref];
  const costs=craftRequirements(ref,null),bounds=Object.entries(costs).filter(([child,q])=>q>0&&stock[child]>1e-8).map(([child,q])=>stock[child]/q);
  return bounds.length?Math.min(...bounds)*(items[ref]?.output_quantity||1):0;
 }
 if(focus&&!free(focus)){
  const coefficient=craftRequirements(id,focus)[focus]||0,quantity=anchoredCapacity(focus);
  if(coefficient>0&&quantity>0)return Math.min(100000000,Math.ceil(quantity/coefficient-1e-8));
 }
 // Missing inputs do not erase potential, but at least one finite, existing
 // ingredient must anchor it. Free Iron/Nails cannot create unbounded demand.
 const costs=craftRequirements(id,null),bounds=Object.entries(costs).filter(([ref,q])=>q>0&&stock[ref]>1e-8).map(([ref,q])=>stock[ref]/q);
 return bounds.length?Math.min(100000000,Math.ceil(Math.min(...bounds)-1e-8)):0;
}
function craftMapAddOptions(items,plan,settings,drafts,id,focus){
 const snapshot=craftMapSupplySnapshot(items,plan,settings,drafts,id);
 const all=craftMapPotentialAim(items,snapshot,settings,id,focus);
 let low=0,high=Math.max(0,all);
 while(low<high){const mid=Math.ceil((low+high)/2);if(craftMapGapsInSnapshot(items,snapshot,settings,id,mid).length)high=mid-1;else low=mid;}
 const result={all:Math.max(0,all),available:low};
 const others=[...(settings.secondary||[]),...drafts].filter(g=>g.item_id!==id&&craftMapIsSoft(g));
 if(low>0&&others.some(g=>craftMapDependents(items,[g],focus).length))result.rebalances=true;
 return result;
}
function craftMapDependents(items,goals,id){
 function uses(ref,seen=new Set()){if(ref===id)return true;if(seen.has(ref))return false;seen.add(ref);return Object.keys(items[ref]?.direct_ingredients||{}).some(child=>uses(child,seen));}
 return goals.filter(g=>uses(g.item_id)).map(g=>g.item_id);
}
if(typeof module!=='undefined')Object.assign(module.exports,{craftMapAddOptions,craftMapDependents});

// Exploration-only stacks may overflow; manufactured stacks must be sold.
function craftMapSellOnly(n){return !!(n?.crafts>0||n?.craftable&&!n?.explorationSupplied);}
function craftMapSurplusLabels(n){return craftMapSellOnly(n)?{sell:'Sell',use:'Use + Sell'}:{sell:'Void/Sell',use:'Use + Void'};}
function craftMapNodeLabels(n,nodes,links){
 const required=Boolean(n.protected||n.primary||(n.kind!=='item'&&links.some(l=>l.from===n.id&&nodes.some(child=>child.id===l.to&&child.protected))));
 return {requirement:n.explorationSupplied?'EXPLORE OUTPUT NODE':required?'REQUIRED NODE':'OPTIONAL NODE',mode:n.voided?(n.requiredUse>0?'Use required + '+craftMapSurplusLabels(n).sell:craftMapSurplusLabels(n).sell):n.useVoid?craftMapSurplusLabels(n).use:n.autoSupply?'AUTO SUPPLIED':n.fromInventory?'FROM INVENTORY':''};
}
if(typeof module!=='undefined')Object.assign(module.exports,{craftMapNodeLabels,craftMapSellOnly,craftMapSurplusLabels});

// Use the rendered graph, including idle recipes and proposed supplies, so the
// inspector lists exactly the connections visible on the canvas.
function craftMapConnections(id,nodes,links){
 const byId=new Map(nodes.map(n=>[n.id,n]));
 const direction=incoming=>{
  const connected=new Map();
  for(const link of links){
   if((incoming?link.to:link.from)!==id)continue;
   const ref=incoming?link.from:link.to,node=byId.get(ref);
   if(!node||ref===id)continue;
   const previous=connected.get(ref);
   if(!previous||link.quantity>previous.quantity)connected.set(ref,{node,quantity:link.quantity||0,phantom:!!link.phantom});
  }
  return [...connected.values()].sort((a,b)=>a.node.name.localeCompare(b.node.name));
 };
 return {inputs:direction(true),outputs:direction(false)};
}
if(typeof module!=='undefined')module.exports.craftMapConnections=craftMapConnections;

function visibleCraftMapGaps(gaps){return gaps.filter(([,quantity])=>quantity>=10);}
if(typeof module!=='undefined')module.exports.visibleCraftMapGaps=visibleCraftMapGaps;

// Count distinct other ingredients across the chain; free perk supplies need no setup.
function craftMapRecipeComplexity(items,id,focus,settings){
 const seen=new Set();
 function visit(ref){if(ref===focus||seen.has(ref)||settings.iron_depot&&['Iron','Nails'].includes(items[ref]?.name))return;seen.add(ref);for(const child of Object.keys(items[ref]?.direct_ingredients||{}))visit(child);}
 for(const ref of Object.keys(items[id]?.direct_ingredients||{}))visit(ref);
 return seen.size;
}
if(typeof module!=='undefined')module.exports.craftMapRecipeComplexity=craftMapRecipeComplexity;

// A separate, bounded what-if: use existing supplies, never drops from hypothetical exploration.
function craftMapPotential(items,plan,settings,drafts){
 const proposed=drafts.map(g=>({...g})),goals=[];
 const snapshot=craftMapSupplySnapshot(items,plan,settings,drafts);
 // Every soft goal looks at the same snapshot. Neither list order nor an
 // earlier hypothetical craft is allowed to consume another goal's potential.
 for(const g of proposed){
  if(!craftMapIsSoft(g))continue;
  let aim=craftMapPotentialAim(items,snapshot,settings,g.item_id,g.void_source);
  if(g.cap>0)aim=Math.min(aim,g.cap);
  if(aim<=0)continue;
  g.cap=aim;g.estimated_crafts=aim;
  goals.push({...g,potential_crafts:aim});
 }
 const graph=buildCraftMap(items,plan,settings,proposed);
 // Free perk inputs can appear in recipe links but never need a source.
 for(const node of graph.nodes)if(node.free||node.autoSupply){node.need=0;node.missing=0;}
 return {goals,graph};
}
if(typeof module!=='undefined')module.exports.craftMapPotential=craftMapPotential;

// Freeze demand before adding exploration: extra drops cannot grow these goals.
function craftMapDemandAllocation(items,goals,potential,id,percent){
 const aims=new Map(potential.map(g=>[g.item_id,g.cap]));
 const connected=goals.filter(g=>g.item_id!==id&&craftMapDependents(items,[g],id).length);
 const available=g=>g.consumer_mode==='available'||(!g.consumer_mode&&g.available_only===true);
 return connected.filter(available).map(g=>{
  const basis=g.demand_group===id?g.demand_basis:Math.max(g.cap||0,aims.get(g.item_id)||0);
  return {...g,cap:Math.floor(basis*percent/100),consumer_mode:'available',demand_group:id,demand_basis:basis,demand_percent:percent,available_only:false,void_source:null,automatic_batch:true,prioritize:false};
 }).filter(g=>g.demand_basis>0);
}
if(typeof module!=='undefined')Object.assign(module.exports,{craftMapDemandAllocation,craftMapIsSoft,craftMapDraftQuantity,craftMapSupplySnapshot,craftMapPotentialAim});

// Shared by initial calculation and draft previews; independent of map UI startup.
function craftMapBlockingInputs(items,settings,itemId){
 return Object.entries(settings.map_node_usage||{}).filter(([id,v])=>
  id!==itemId&&['unused','void'].includes(v.mode)&&craftMapDependents(items,[{item_id:itemId}],id).length).map(([id])=>id);
}
function craftMapGoalIntent(items,settings,g,applyBlocks=true){
 const mode=g.consumer_mode||(g.available_only?'available':g.automatic_batch?'fixed':'available');
 const blocked=applyBlocks&&craftMapBlockingInputs(items,settings,g.item_id).length>0;
 return {...g,consumer_mode:mode,cap:blocked?0:mode==='available'&&!g.user_cap?null:g.cap,user_cap:blocked||g.user_cap===true,automatic_batch:mode==='fixed',allow_exploration:false};
}
if(typeof module!=='undefined')Object.assign(module.exports,{craftMapGoalIntent,craftMapBlockingInputs});
