/* Pure graph accounting. Draft quantities are aims; the solver confirms outcomes. */
function buildCraftMap(items,plan,settings,drafts=[],expanded=[]){
 const nodes=new Map(),links=new Map(),balances=Object.fromEntries(plan.item_balances.map(b=>[b.item_id,b]));
 const factor=1/(1+(settings.resource_saver||0)/100),free=id=>settings.iron_depot&&['Iron','Nails'].includes(items[id]?.name);
 const roots=new Set([...Object.keys(settings.targets||{}),...(settings.secondary||[]).map(g=>g.item_id),...drafts.map(g=>g.item_id)]);
 const order=[],seen=new Set();
 function visit(id){if(seen.has(id)||!items[id])return;seen.add(id);if(!free(id))for(const child of Object.keys(items[id].direct_ingredients))visit(child);order.push(id);}
 roots.forEach(visit);
 const draftCrafts={},demand={},missing={};
 for(const g of drafts)draftCrafts[g.item_id]=g.cap;
 // All parent demands accumulate before a shared ingredient is evaluated.
 for(const id of [...order].reverse()){
  if(free(id))continue;
  const stock=Math.max(0,balances[id]?.expected_unused||0),short=Math.max(0,(demand[id]||0)-stock);
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
 const protectedIds=new Set();
 function protect(id){if(protectedIds.has(id)||!items[id])return;protectedIds.add(id);const count=primaryCrafts?primaryCrafts[id]||0:(balances[id]?.crafted||0);if(!free(id)&&count>1e-8)Object.keys(items[id].direct_ingredients).forEach(protect);}
 Object.keys(settings.targets||{}).forEach(protect);
 seen.clear();active.forEach(id=>seen.add(id));
 const ingredientIds=new Set(Object.values(items).flatMap(i=>Object.keys(i.direct_ingredients)));
 const spare=plan.item_balances.filter(b=>ingredientIds.has(b.item_id)&&b.expected_unused>=1&&!seen.has(b.item_id)&&!free(b.item_id)).sort((a,b)=>b.expected_unused-a.expected_unused);
 const limit=settings.map_unused_mode==='all'?spare.length:settings.map_unused_mode==='none'?0:(settings.map_unused_count??6);
 for(const b of spare.slice(0,limit))seen.add(b.item_id);
 const spareIds=new Set(spare.map(b=>b.item_id));
 for(const area of plan.areas)if((settings.map_expanded_areas||[]).includes(area.location_id))
  for(const output of area.items)if(output.expected_drops>0&&spareIds.has(output.item_id))seen.add(output.item_id);
 expanded.forEach(id=>{if(items[id])seen.add(id);});
 for(const id of seen){const b=balances[id]||{};nodes.set(id,{id,kind:'item',name:items[id].name,primary:Object.hasOwn(settings.targets||{},id),secondary:(settings.secondary||[]).some(g=>g.item_id===id),draft:drafts.some(g=>g.item_id===id),missing:missing[id]||0,need:demand[id]||0,crafts:(b.crafted||0)/items[id].output_quantity+(draftCrafts[id]||0),draftCrafts:draftCrafts[id]||0,stock:Math.max(0,(b.expected_unused||0)+(draftCrafts[id]||0)*items[id].output_quantity-(demand[id]||0)),fromInventory:(b.starting_inventory||0)>0,currentStock:Math.max(0,b.expected_unused||0),totalSupply:Math.max(b.expected_unused||0,(b.starting_inventory||0)+(b.expected_exploration_drops||0)+(b.free_perk_supply||0)+(b.crafted||0))+(draftCrafts[id]||0)*items[id].output_quantity,explorationSupplied:plan.areas.some(a=>a.items.some(o=>o.item_id===id&&o.expected_drops>0)),protected:protectedIds.has(id),voided:(settings.map_voided||[]).includes(id),useVoid:(settings.map_use_void||[]).includes(id),free:free(id),depth:1});}
 const blockedMemo=new Map();
 function blocked(id,threshold=1e-8){const key=id+':'+threshold;if(blockedMemo.has(key))return blockedMemo.get(key);const value=!free(id)&&Boolean((missing[id]||0)>=threshold||crafted(id)>1e-8&&Object.keys(items[id].direct_ingredients).some(child=>blocked(child,threshold)));blockedMemo.set(key,value);return value;}
 for(const node of nodes.values()){node.blocked=blocked(node.id);node.warningBlocked=blocked(node.id,10);}
 function link(from,to,q,phantom=false){const key=from+'>'+to;links.set(key,{from,to,quantity:q,phantom});}
 for(const id of order){const node=nodes.get(id);if(!node||free(id))continue;for(const [child,q] of Object.entries(items[id].direct_ingredients)){if(node.crafts>0||inactiveRecipes.has(id)){link(child,id,node.crafts*q*factor,Boolean(node.draftCrafts)||inactiveRecipes.has(id));node.depth=Math.max(node.depth,(nodes.get(child)?.depth||1)+1);}}}
 const sources=[];
 for(const area of plan.areas){const id='area:'+area.location_id;nodes.set(id,{id,location:area.location_id,kind:'area',name:area.name,explores:area.explores,depth:0,outputs:area.items.filter(i=>i.expected_drops>0)});sources.push(id);for(const output of area.items)if(nodes.has(output.item_id)&&output.expected_drops>0)link(id,output.item_id,output.expected_drops);}
 const supplied=[...nodes.values()].filter(n=>n.kind==='item'&&(balances[n.id]?.starting_inventory>0||n.free));
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
if(typeof module!=='undefined')module.exports={buildCraftMap,towerOpportunity,layoutCraftMap};

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
 if(n.missing>=10||n.warningBlocked)return 'pending';
 if(!n.primary&&n.totalSupply!=null&&n.totalSupply<1&&!n.explorationSupplied&&!n.fromInventory)return 'unused';
 return n.primary||n.stock<1?'fulfilled':'unused';
}
if(typeof module!=='undefined')module.exports.craftMapUsage=craftMapUsage;

function craftMapCandidateGaps(items,plan,settings,drafts,id,count){
 const graph=buildCraftMap(items,plan,settings,[...drafts,{item_id:id,cap:count}]),related=new Set();
 function visit(ref){if(related.has(ref))return;related.add(ref);for(const child of Object.keys(items[ref]?.direct_ingredients||{}))visit(child);}
 visit(id);return Object.entries(graph.missing).filter(([ref])=>related.has(ref)).sort((a,b)=>b[1]-a[1]);
}
if(typeof module!=='undefined')module.exports.craftMapCandidateGaps=craftMapCandidateGaps;

function craftMapAddOptions(items,plan,settings,drafts,id,focus){
 const current=buildCraftMap(items,plan,settings,drafts,[focus]),stock=current.nodes.find(n=>n.id===focus)?.stock||0;
 const factor=1/(1+(settings.resource_saver||0)/100),free=ref=>settings.iron_depot&&['Iron','Nails'].includes(items[ref]?.name);
 function amount(ref,q){if(free(ref))return 0;if(ref===focus)return q;return Object.entries(items[ref]?.direct_ingredients||{}).reduce((sum,[child,n])=>sum+amount(child,q*n*factor/(items[ref].output_quantity||1)),0);}
 const coefficient=Object.entries(items[id].direct_ingredients).reduce((sum,[ref,q])=>sum+amount(ref,q*factor),0);
 const all=coefficient>0?Math.min(100000000,Math.ceil(stock/coefficient-1e-8)):1;
 let low=0,high=Math.max(0,all);
 while(low<high){const mid=Math.ceil((low+high)/2);if(craftMapCandidateGaps(items,plan,settings,drafts,id,mid).length)high=mid-1;else low=mid;}
 return {all:Math.max(1,all),available:low};
}
function craftMapDependents(items,goals,id){
 function uses(ref,seen=new Set()){if(ref===id)return true;if(seen.has(ref))return false;seen.add(ref);return Object.keys(items[ref]?.direct_ingredients||{}).some(child=>uses(child,seen));}
 return goals.filter(g=>uses(g.item_id)).map(g=>g.item_id);
}
if(typeof module!=='undefined')Object.assign(module.exports,{craftMapAddOptions,craftMapDependents});

function craftMapNodeLabels(n,nodes,links){
 const required=Boolean(n.protected||n.primary||(n.kind!=='item'&&links.some(l=>l.from===n.id&&nodes.some(child=>child.id===l.to&&child.protected))));
 return {requirement:n.explorationSupplied?'EXPLORE OUTPUT NODE':required?'REQUIRED NODE':'OPTIONAL NODE',mode:n.voided?'Void/Sell':n.useVoid?'Use + Void':n.fromInventory?'FROM INVENTORY':''};
}
if(typeof module!=='undefined')module.exports.craftMapNodeLabels=craftMapNodeLabels;

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
 const proposed=drafts.map(g=>({...g})), goals=[];
 for(const g of proposed){
  if(!(g.available_only||g.cap===0))continue;
  const others=proposed.filter(x=>x!==g), graph=buildCraftMap(items,plan,settings,others);
  const focus=g.void_source||Object.keys(items[g.item_id]?.direct_ingredients||{}).filter(ref=>!graph.nodes.find(n=>n.id===ref)?.free).sort((a,b)=>(graph.nodes.find(n=>n.id===b)?.stock||0)-(graph.nodes.find(n=>n.id===a)?.stock||0))[0];
  if(!focus)continue;
  const stock=graph.nodes.find(n=>n.id===focus)?.stock||0;
  if(stock<1)continue;
  const aim=craftMapAddOptions(items,plan,settings,others,g.item_id,focus).all;
  if(aim>g.cap){g.cap=aim;goals.push({...g});}
 }
 const graph=buildCraftMap(items,plan,settings,proposed);
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
if(typeof module!=='undefined')module.exports.craftMapDemandAllocation=craftMapDemandAllocation;
