/* Shared Tower effort scoring and reserved, supplied primary goals. */
(function(root){
 'use strict';
 const tower=typeof module!=='undefined'&&module.exports?require('./tower-model.js'):root.TowerModel;
 function remaining(settings){
  return Object.fromEntries(Object.entries(settings.targets||{}).map(([id,q])=>[id,Math.max(0,q-(settings.provided_targets?.[id]?.quantity||0))]).filter(([,q])=>q>0));
 }
 function split(settings,id,plan){
  const total=settings.targets?.[id]||0,allocated=settings.provided_targets?.[id]?.quantity||0;
  const balance=plan?.item_balances?.find(b=>b.item_id===id),credit=balance?.reserved_external_target_output||0;
  const available=balance?Math.min(Math.max(0,(balance.expected_unused||0)+credit),Math.max(0,(balance.expected_exploration_drops||0)+(balance.crafted||0))):0;
  const routeCapacity=Math.min(total,Math.floor(available+1e-8)),fromRoute=Math.min(allocated,routeCapacity);
  return {total,craft:total-allocated,fromRoute,external:allocated-fromRoute,routeCapacity};
 }
 function setProvided(settings,id,quantity){
  const total=settings.targets?.[id];
  if(!Number.isSafeInteger(quantity)||quantity<0||quantity>total||!total)throw Error('Sourced externally must be a whole number between zero and the total goal.');
  const old=settings.provided_targets?.[id]||{quantity:0,taken:0};
  if(quantity===old.quantity)return;
  const stock=JSON.parse(settings.inventory||'{}');let taken=old.taken;
  if(quantity>old.quantity){const extra=Math.min(quantity-old.quantity,stock[id]||0);taken+=extra;if(extra)stock[id]-=extra;}
  // Release only real stock that was reserved. Assumed/bought supplies never
  // become starting inventory when the user moves the split back to crafting.
  else if(taken>quantity){stock[id]=(stock[id]||0)+taken-quantity;taken=quantity;}
  settings.inventory=JSON.stringify(stock);settings.provided_targets??={};
  if(quantity)settings.provided_targets[id]={quantity,taken};else delete settings.provided_targets[id];
 }
 function setTotal(settings,id,quantity){
  if(!Number.isSafeInteger(quantity)||quantity<1||quantity>100000000)throw Error('Total goals must be whole numbers from 1 to 100,000,000.');
  settings.targets[id]=quantity;
  if((settings.provided_targets?.[id]?.quantity||0)>quantity)setProvided(settings,id,quantity);
 }
 function provide(settings,id){if(settings.targets?.[id])setProvided(settings,id,settings.targets[id]);}
 function undo(settings,id){if(settings.provided_targets?.[id])setProvided(settings,id,0);}
 function rank(metadata,settings,personal={}){
  const locations=metadata.effort_locations||{},data={items:Object.fromEntries(metadata.items.map(i=>[i.id,i])),locations};
  const profile={...personal,resourceSaver:settings.resource_saver,ironDepot:settings.iron_depot,runecube:settings.runecube,
   locations:[...(settings.areas||[]),...Object.keys(locations).filter(id=>locations[id].kind!=='explore'&&(!personal.locations||personal.locations.includes(id)))]};
  const pending=remaining(settings);
  return Object.entries(settings.targets||{}).map(([id,quantity])=>{
   const cost=tower.estimate(data,profile,id,pending[id]||0);
   return {id,quantity,remaining:pending[id]||0,cost};
  }).sort((a,b)=>Number(b.remaining>0)-Number(a.remaining>0)||((Number.isFinite(b.cost.points)?b.cost.points:-1)-(Number.isFinite(a.cost.points)?a.cost.points:-1))||data.items[a.id].name.localeCompare(data.items[b.id].name));
 }
 const api={remaining,split,provide,undo,setProvided,setTotal,rank};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.TargetCosts=api;
})(globalThis);
