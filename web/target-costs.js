/* Shared Tower effort scoring and reserved, supplied primary goals. */
(function(root){
 'use strict';
 const tower=typeof module!=='undefined'&&module.exports?require('./tower-model.js'):root.TowerModel;
 function remaining(settings){
  return Object.fromEntries(Object.entries(settings.targets||{}).map(([id,q])=>[id,Math.max(0,q-(settings.provided_targets?.[id]?.quantity||0))]).filter(([,q])=>q>0));
 }
 function provide(settings,id){
  const q=remaining(settings)[id]||0;if(!q)return;
  const stock=JSON.parse(settings.inventory||'{}'),taken=Math.min(q,stock[id]||0),old=settings.provided_targets?.[id];
  if(taken)stock[id]-=taken;
  settings.inventory=JSON.stringify(stock);
  settings.provided_targets={...settings.provided_targets,[id]:{quantity:(old?.quantity||0)+q,taken:(old?.taken||0)+taken}};
 }
 function undo(settings,id){
  const row=settings.provided_targets?.[id];if(!row)return;
  const stock=JSON.parse(settings.inventory||'{}');if(row.taken)stock[id]=(stock[id]||0)+row.taken;
  settings.inventory=JSON.stringify(stock);delete settings.provided_targets[id];
 }
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
 const api={remaining,provide,undo,rank};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.TargetCosts=api;
})(globalThis);
