/* Quick recipe estimates; the planner solves the route after selection. */
function suggestCrafts(items, stock, settings, material=null){
 const factor=1/(1+(settings.resource_saver||0)/100), free=id=>settings.iron_depot&&['Iron','Nails'].includes(items[id].name);
 const excluded=new Set([...Object.keys(settings.targets||{}),...(settings.secondary||[]).map(g=>String(g.item_id))]);
 function simulate(id,count){
  const left={...stock},missing={};
  function need(ref,q){
   if(free(ref))return;
   const used=Math.min(left[ref]||0,q);left[ref]=(left[ref]||0)-used;q-=used;
   if(q<1e-7)return;
   const item=items[ref];
   if(!item.craftable){missing[ref]=(missing[ref]||0)+q;return;}
   const n=Math.ceil(q/item.output_quantity-1e-9);
   for(const [child,amount] of Object.entries(item.direct_ingredients))need(child,n*amount*factor);
   left[ref]+=n*item.output_quantity-q;
  }
  for(const [ref,q] of Object.entries(items[id].direct_ingredients))need(ref,q*count*factor);
  const used=Object.fromEntries(Object.entries(stock).map(([ref,q])=>[ref,Math.max(0,q-(left[ref]||0))]).filter(([,q])=>q>1e-6));
  return {id,count,used,missing,score:Object.values(used).reduce((a,b)=>a+b,0)};
 }
 const ready=[],explore=[];
 for(const item of Object.values(items)){
  if(!item.craftable||excluded.has(item.id))continue;
  const needs={};
  function walk(id,q){if(free(id))return;needs[id]=(needs[id]||0)+q;for(const [child,n] of Object.entries(items[id].direct_ingredients))walk(child,q*n*factor/items[id].output_quantity);}
  for(const [id,q] of Object.entries(item.direct_ingredients))walk(id,q*factor);
  if(material&&!needs[material])continue;
  const bound=Math.min(100000000,Math.ceil(Object.entries(stock).reduce((sum,[id,q])=>sum+(needs[id]?q/needs[id]:0),0)));
  if(!bound)continue;
  let low=0,high=bound;
  while(low<high){const mid=Math.ceil((low+high)/2),r=simulate(item.id,mid);if(Object.keys(r.missing).length)high=mid-1;else low=mid;}
  if(low){const r=simulate(item.id,low);if(r.score>0&&(!material||r.used[material]))ready.push(r);}
  const r=simulate(item.id,bound);
  if(r.score>0&&Object.keys(r.missing).length&&Object.keys(r.missing).every(id=>items[id].explorable)&&(!material||r.used[material]))explore.push(r);
 }
 const rank=rows=>rows.sort((a,b)=>b.score-a.score||items[a.id].name.localeCompare(items[b.id].name)).slice(0,5);
 return {ready:rank(ready),explore:rank(explore)};
}
if(typeof module!=='undefined')module.exports={suggestCrafts};
/* Missing supplies for a useful additional batch, using the final shared pool.
   This is an item-by-item estimate, not a promise that every row can use the
   same stock simultaneously. Counts are craft actions, as in the planner. */
function leftoverNeeds(items,stock,settings,goal,current=0){
 const factor=1/(1+(settings.resource_saver||0)/100);
 const free=id=>settings.iron_depot&&['Iron','Nails'].includes(items[id]?.name);
 const coefficients={};
 function walk(id,q){if(free(id))return;coefficients[id]=(coefficients[id]||0)+q;const item=items[id];for(const [child,n] of Object.entries(item?.direct_ingredients||{}))walk(child,q*n*factor/(item.output_quantity||1));}
 for(const [id,q] of Object.entries(items[goal.item_id]?.direct_ingredients||{}))walk(id,q*factor);
 const candidates=Object.keys(coefficients).filter(id=>(stock[id]||0)/coefficients[id]>=1);
 const focus=candidates.includes(goal.exploration_item_id)?goal.exploration_item_id:candidates.sort((a,b)=>stock[b]/coefficients[b]-stock[a]/coefficients[a])[0];
 let batch=focus?Math.floor(stock[focus]/coefficients[focus]+1e-8):1;
 batch=Math.min(100000000,batch,goal.cap==null?Infinity:Math.max(0,goal.cap-current));
 if(!batch||current>0&&(!focus||batch<Math.max(10,current*.05)))return null;
 const left={...stock},raw={},direct={};
 function need(id,q){if(free(id))return;const used=Math.min(left[id]||0,q);left[id]=(left[id]||0)-used;q-=used;if(q<1e-7)return;
  const item=items[id],children=Object.entries(item?.direct_ingredients||{});
  if(!children.length){raw[id]=(raw[id]||0)+q;return;}
  const crafts=Math.ceil(q/(item.output_quantity||1)-1e-9);
  for(const [child,n] of children)need(child,n*factor*crafts);
  left[id]+=crafts*(item.output_quantity||1)-q;
 }
 for(const [id,q] of Object.entries(items[goal.item_id].direct_ingredients)){
  if(free(id))continue;
  const amount=q*factor*batch,short=Math.max(0,amount-(left[id]||0));
  const before={...raw};need(id,amount);
  // Only list a direct shortage when its ingredients cannot already supply it.
  if(short>1e-7&&Object.keys(raw).some(r=>raw[r]>(before[r]||0)+1e-7))direct[id]=short;
 }
 if(!Object.keys(raw).length)return null;
 return {batch,focus,focusQuantity:focus?stock[focus]:0,direct,raw};
}
if(typeof module!=='undefined')module.exports.leftoverNeeds=leftoverNeeds;
