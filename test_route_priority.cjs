const assert=require('node:assert/strict');
global.ciderEffectiveness=require('./web/costs.js').ciderEffectiveness;
const {inventoryRoute,craftworksDisplayOrder}=require('./web/route.js');
const item=(name,ingredients={})=>({name,direct_ingredients:ingredients,output_quantity:1});
const items={wood:item('Wood'),cloth:item('Cloth'),hide:item('Hide'),flower:item('Flower'),
 awl:item('Awl',{wood:1}),button:item('Wooden Button',{wood:1,awl:1}),
 doll:item('Required Doll',{button:1,cloth:1}),belt:item('Required Belt',{awl:1,hide:1}),
 needle:item('Optional Needle',{awl:1}),spear:item('Optional Spear',{wood:1}),dye:item('Independent Dye',{flower:1})};
const rows=value=>Object.entries(value).map(([item_id,crafts])=>({item_id,crafts}));
const plan={assumptions:{resource_saver:0,unlimited_free_items:[]},
 crafts_in_dependency_order:rows({awl:620,button:300,doll:300,belt:300}),
 secondary:{crafts_in_dependency_order:rows({awl:100,needle:100,spear:100,dye:200})},
 item_balances:Object.entries({awl:20,doll:300,belt:300}).map(([item_id,reserved_target_output])=>({item_id,starting_inventory:0,reserved_target_output})),
 areas:[{location_id:'early',name:'Small Spring',explores:1200,items:[{item_id:'wood',expected_drops:1200},{item_id:'flower',expected_drops:200}]},
 {location_id:'late',name:'Later location',explores:600,items:[{item_id:'cloth',expected_drops:300},{item_id:'hide',expected_drops:300}]}]};
const locations=plan.areas.map(a=>({id:a.location_id,base_drop_rate:1}));
for(const slots of [1,2,10])for(const rounds of [1,2,5]){
 const events=[],settings={inventory_size:2000,craftworks_slots:slots,_rounds:rounds,_trace:e=>events.push(e)};
 const r=inventoryRoute(plan,items,locations,settings);
 assert.equal(r.complete,true,`${slots} slots, ${rounds} loops: ${r.problem}`);
 assert.equal(r.priorityStages,true);assert.equal(r.continuous,false); // Spare slots cannot merge conflicting phases.
 assert.ok(r.activeGroups.every(g=>!g.recipes.includes('needle')&&!g.recipes.includes('spear')));
 assert.equal(r.deliveredTargets.awl,20);assert.equal(r.deliveredTargets.doll,300);assert.equal(r.deliveredTargets.belt,300);
 for(const id of ['needle','spear'])for(const e of events.filter(e=>e.type==='craft'&&e.id===id)){
  assert.equal(e.place,'late');
  assert.ok(events.slice(0,events.indexOf(e)).some(p=>p.type==='craft'&&p.round===e.round&&p.id==='doll'));
 }
 for(const kind of ['required','optional'])for(const row of (kind==='required'?plan:plan.secondary).crafts_in_dependency_order)
  assert.equal(events.filter(e=>e.type==='craft'&&e.id===row.item_id&&e.kind===kind).reduce((n,e)=>n+e.count,0),row.crafts);
 for(const stop of r.craftStops){
  assert.ok(stop.sets.every(s=>s.length<=slots));
  assert.ok(stop.setPhases.indexOf('optional')<0||stop.setPhases.lastIndexOf('required')<stop.setPhases.indexOf('optional'));
  for(const id of stop.recipes)assert.ok(Math.abs(stop.setAmounts.reduce((n,set)=>n+(set[id]||0),0)-stop.amounts[id])<1e-7);
 }
 assert.ok(Object.values(r.inventoryPeaks).every(n=>n<=2000+1e-7));
 const slow=inventoryRoute(plan,items,locations,{...settings,_trace:undefined,_singleClick:true});
 assert.equal(slow.complete,true);assert.deepEqual(slow.craftStops,r.craftStops);assert.deepEqual(slow.deliveredTargets,r.deliveredTargets);
}
// Non-competing leftovers remain fully craftable; finished items precede inputs.
const r=inventoryRoute(plan,items,locations,{inventory_size:2000,craftworks_slots:10,_rounds:1});
assert.equal((r.activeWork.dye||0)+r.craftStops.reduce((n,s)=>n+(s.amounts.dye||0)*(s.once?1:r.rounds),0),200);
assert.deepEqual(craftworksDisplayOrder(['awl','button','doll','dye'],['awl','button','doll']),['doll','button','awl','dye']);
// Inventory-only plans still run the required phase before the optional phase.
const stocked=structuredClone(plan);stocked.areas=[];
for(const [id,quantity] of Object.entries({wood:1200,flower:200,cloth:300,hide:300}))stocked.item_balances.push({item_id:id,starting_inventory:quantity});
const supply=inventoryRoute(stocked,items,locations,{inventory_size:2000,craftworks_slots:10,_rounds:1});
assert.equal(supply.complete,true,supply.problem);assert.deepEqual(supply.craftStops[0].setPhases,['required','optional']);
// Savings introduce fractional ingredient use. Carry reservations must prevent
// a rounding remainder from starving required outputs or deadlocking leftovers.
const saved={...plan,assumptions:{...plan.assumptions,resource_saver:45}};
const saving=inventoryRoute(saved,items,locations,{inventory_size:2000,craftworks_slots:2,_rounds:7});
assert.equal(saving.complete,true,saving.problem);assert.equal(saving.deliveredTargets.awl,20);
console.log('Required-first stages, shared intermediates, late supplies, reserved goals, spare slots, independent crafts and rounding passed');
// Already released leftovers may wait for a later shared setup; unrelated
// primary goals must never prevent their full quantity from being crafted.
const middle=structuredClone(plan);middle.crafts_in_dependency_order.push({item_id:'saltcraft',crafts:200});
middle.areas.push({location_id:'last',name:'Unrelated location',explores:200,items:[{item_id:'salt',expected_drops:200}]});
const midItems={...items,salt:item('Salt'),saltcraft:item('Required salt craft',{salt:1})};
const mid=inventoryRoute(middle,midItems,[...locations,{id:'last',base_drop_rate:1}],{inventory_size:2000,craftworks_slots:10,_rounds:1,_groupSpan:1});
assert.equal(mid.complete,true,mid.problem);
assert.equal((mid.activeWork.needle||0)+mid.craftStops.reduce((n,s)=>n+(s.amounts.needle||0)*(s.once?1:mid.rounds),0),100);
assert.ok(!mid.craftStops.find(s=>s.id==='early')?.recipes.includes('needle'));
// An exploration-only goal is also protected from optional consumption.
const rawGoal={assumptions:plan.assumptions,crafts_in_dependency_order:[],secondary:{crafts_in_dependency_order:rows({spear:100})},
 item_balances:[{item_id:'wood',starting_inventory:0,reserved_target_output:500}],
 areas:[{location_id:'early',name:'Forest',explores:600,items:[{item_id:'wood',expected_drops:600}]}]};
const raw=inventoryRoute(rawGoal,items,locations,{inventory_size:2000,_rounds:1});
assert.equal(raw.complete,true,raw.problem);assert.equal(raw.deliveredTargets.wood,500);
console.log('Earlier released branches and raw collection goals passed');
