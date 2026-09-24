const assert=require('node:assert/strict');
global.ciderEffectiveness=require('./web/costs.js').ciderEffectiveness;
const {inventoryRoute}=require('./web/route.js');
const items={stone:{name:'Stone',direct_ingredients:{}},trash:{name:'Unused drop',direct_ingredients:{}},primary:{name:'Primary',direct_ingredients:{stone:1}},optional:{name:'Optional',direct_ingredients:{stone:1}}};
const locations=[{id:'first',base_drop_rate:1},{id:'last',base_drop_rate:1}];
const plan={assumptions:{resource_saver:0,unlimited_free_items:[]},item_balances:[{item_id:'primary',starting_inventory:0,reserved_target_output:100}],crafts_in_dependency_order:[{item_id:'primary',crafts:100}],secondary:{crafts_in_dependency_order:[{item_id:'optional',crafts:100}]},areas:[{location_id:'first',name:'First',explores:200,items:[{item_id:'stone',expected_drops:200}]}]};
const settings={inventory_size:500,craftworks_slots:2};
const base=inventoryRoute(plan,items,locations,settings);
const noisy=structuredClone(plan);noisy.areas[0].items.push({item_id:'trash',expected_drops:1e9});
const extra=inventoryRoute(noisy,items,locations,settings);
assert.equal(extra.complete,true);assert.equal(extra.rounds,base.rounds);assert.equal(extra.uses,base.uses);
assert.deepEqual(extra.craftStops,base.craftStops);assert.equal(extra.overflow.trash,1e9-500);assert.equal(extra.inventoryPeaks.trash,500);
assert.equal(extra.requiredExploreSupply.trash,undefined);
// Even an ingredient's UNUSED portion cannot force additional loops.
const surplus=structuredClone(plan);surplus.areas[0].items[0].expected_drops=4000;
const events=[],r=inventoryRoute(surplus,items,locations,{...settings,_trace:e=>events.push(e)});
assert.equal(r.complete,true);assert.equal(r.rounds,1);assert.equal(r.uses,1);
assert.equal(r.requiredExploreSupply.stone,200);assert.equal(r.overflow.stone,3500);assert.equal(r.deliveredTargets.primary,100);
assert.equal(events.filter(e=>e.kind==='required').reduce((n,e)=>n+e.count,0),100);
assert.equal(events.filter(e=>e.kind==='optional').reduce((n,e)=>n+e.count,0),100);
assert.ok(Object.values(r.inventoryPeaks).every(q=>q<=500+1e-7));
// Added optional demand reduces the surplus allowance; it is never discarded.
const demand=structuredClone(surplus);demand.secondary.crafts_in_dependency_order[0].crafts=600;
const blocked=inventoryRoute(demand,items,locations,{...settings,_rounds:1});assert.equal(blocked.complete,false);assert.equal(blocked.failure.kind,'needed_supply');
// External stock offsets exploration demand, without occupying loop capacity.
const stocked=structuredClone(surplus);stocked.item_balances.push({item_id:'stone',starting_inventory:150});
const supplied=inventoryRoute(stocked,items,locations,settings);assert.equal(supplied.complete,true);assert.equal(supplied.requiredExploreSupply.stone,50);
// Raw collection goals count as needed even though they are not craft ingredients.
const raw={...surplus,crafts_in_dependency_order:[],secondary:null,item_balances:[{item_id:'stone',starting_inventory:0,reserved_target_output:600}]};
assert.equal(inventoryRoute(raw,items,locations,{...settings,_rounds:1}).complete,false);
const collection=inventoryRoute(raw,items,locations,settings);assert.equal(collection.complete,true);assert.equal(collection.deliveredTargets.stone,600);
// Clipping after whole clicks agrees with individual-click replay, also when
// a later source supplies the second ingredient needed for active crafting.
const linkedItems={...items,other:{name:'Other',direct_ingredients:{}},primary:{name:'Primary',direct_ingredients:{stone:1,other:1}}};
const linked={...surplus,secondary:null,areas:[{...surplus.areas[0],explores:2000,items:[{item_id:'stone',expected_drops:4000},{item_id:'trash',expected_drops:20000}]},{location_id:'last',name:'Last',explores:2000,items:[{item_id:'other',expected_drops:200}]}]};
for(const pie of [false,true]){
 const cfg={...settings,_rounds:2,route_foods:{pie}},fast=inventoryRoute(linked,linkedItems,locations,cfg),slow=inventoryRoute(linked,linkedItems,locations,{...cfg,_singleClick:true});
 assert.equal(fast.complete,true);assert.equal(slow.complete,true);assert.equal(fast.uses,slow.uses);assert.deepEqual(fast.craftStops,slow.craftStops);
 for(const [id,q] of Object.entries(fast.overflow))assert.ok(Math.abs(q-(slow.overflow[id]||0))<1e-6);
}
console.log('Surplus does not size loops; partial ingredients, primary/optional craft preservation, external reserves, raw goals and clipped-click equivalence passed');
