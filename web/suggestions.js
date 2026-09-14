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
