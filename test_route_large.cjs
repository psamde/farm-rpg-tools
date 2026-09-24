const assert=require('node:assert/strict');
global.ciderEffectiveness=require('./web/costs.js').ciderEffectiveness;
const {inventoryRoute}=require('./web/route.js');
const items={a:{name:'Raw',direct_ingredients:{}},b:{name:'Middle',direct_ingredients:{a:2}},c:{name:'Final',direct_ingredients:{b:1,d:1}},d:{name:'Other',direct_ingredients:{}}};
const locations=[{id:'x',base_drop_rate:1},{id:'y',base_drop_rate:1}];
const assumptions={resource_saver:0,unlimited_free_items:[]};
const large={assumptions,item_balances:[],crafts_in_dependency_order:[],
 areas:[{location_id:'x',name:'Forest',explores:200*300000,items:[{item_id:'a',expected_drops:300000}]}]};
const verified=inventoryRoute(large,items,locations,{inventory_size:1000,_rounds:600});
assert.equal(verified.complete,true);assert.equal(verified.uses,300000);
assert.equal(verified.verificationSteps,600); // One safe batch per visit, not per drink.
assert.equal(verified.inventoryPeaks.a,500);
const manyRounds=inventoryRoute({...large,areas:[{...large.areas[0],explores:200*26001,items:[{item_id:'a',expected_drops:26001}]}]},items,locations,{inventory_size:10,_rounds:26001});
assert.equal(manyRounds.complete,true);assert.equal(manyRounds.uses,26001);
assert.equal(manyRounds.visits.length,26001);

function near(actual,expected){assert.ok(Math.abs(actual-expected)<1e-5,`${actual} != ${expected}`);}
function same(fast,slow){
 assert.equal(fast.complete,slow.complete);assert.equal(fast.problem,slow.problem);
 assert.equal(fast.uses,slow.uses);assert.deepEqual(fast.activeWork,slow.activeWork);
 assert.deepEqual(fast.craftStops,slow.craftStops);
 assert.deepEqual(fast.visits.map(v=>[v.id,v.drinks]),slow.visits.map(v=>[v.id,v.drinks]));
 for(const id of new Set([...Object.keys(fast.inventoryPeaks),...Object.keys(slow.inventoryPeaks)]))near(fast.inventoryPeaks[id]||0,slow.inventoryPeaks[id]||0);
 const emptied=r=>{const counts={};for(const e of r.empties)for(const row of e.items)counts[row.id]=(counts[row.id]||0)+row.quantity;return counts;};
 assert.deepEqual(emptied(fast),emptied(slow));
}
// Compare batched verification against each individual click, across slot
// changes, external inputs, shared ingredients, bonus output and food bursts.
for(const factor of [0,45])for(const slots of [1,2])for(const food of [false,true])for(const stock of [0,250]){
 const plan={assumptions:{...assumptions,resource_saver:factor},
  item_balances:[{item_id:'d',starting_inventory:stock}],
  crafts_in_dependency_order:[{item_id:'b',crafts:600},{item_id:'c',crafts:400}],
  areas:[{location_id:'x',name:'Forest',explores:20000,items:[{item_id:'a',expected_drops:2000}]},
         {location_id:'y',name:'Cave',explores:20000,items:[{item_id:'d',expected_drops:1000}]}]};
 const settings={inventory_size:500,craftworks_slots:slots,route_method:'AP',route_foods:{pie:food},_rounds:10};
 same(inventoryRoute(plan,items,locations,settings),inventoryRoute(plan,items,locations,{...settings,_singleClick:true}));
}
// Unneeded overflow cannot block a long route. A required target still can.
const lateOverflow={assumptions,item_balances:[],crafts_in_dependency_order:[],areas:[
 {...large.areas[0],items:[{item_id:'a',expected_drops:300}]},
 {location_id:'y',name:'Cave',explores:200,items:[{item_id:'d',expected_drops:2000}]}]};
const blocked=inventoryRoute(lateOverflow,items,locations,{inventory_size:1000,_rounds:1});
assert.equal(blocked.uses,300001);assert.equal(blocked.complete,true);assert.equal(blocked.overflow.d,1000);
const target=inventoryRoute({...lateOverflow,item_balances:[{item_id:'d',starting_inventory:0,reserved_target_output:1500}]},items,locations,{inventory_size:1000,_rounds:1});assert.equal(target.complete,false);assert.equal(target.failure.kind,'needed_supply');
console.log('Large routes: 300,000 drinks, 26,001 rounds, late overflow, and 16 single-click equivalence cases passed.');
