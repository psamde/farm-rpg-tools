const assert=require('node:assert/strict');
global.ciderEffectiveness=require('./web/costs.js').ciderEffectiveness;
const {inventoryRoute}=require('./web/route.js');
const item=(name,direct_ingredients={})=>({name,direct_ingredients});
const items={stone:item('Stone'),gem:item('Gem'),leaf:item('Leaf'),salt:item('Salt'),block:item('Block',{stone:3}),ring:item('Ring',{gem:1}),paper:item('Paper',{leaf:1}),seasoning:item('Seasoning',{salt:1})};
const plan={assumptions:{resource_saver:0,unlimited_free_items:[]},item_balances:[{item_id:'ring',starting_inventory:0,reserved_target_output:100}],
 crafts_in_dependency_order:[{item_id:'block',crafts:200},{item_id:'ring',crafts:100},{item_id:'paper',crafts:100},{item_id:'seasoning',crafts:100}],
 areas:[{location_id:'first',name:'First',explores:2000,items:[{item_id:'stone',expected_drops:300},{item_id:'gem',expected_drops:100}]},
 {location_id:'last',name:'Last',explores:2000,items:[{item_id:'stone',expected_drops:300},{item_id:'leaf',expected_drops:100},{item_id:'salt',expected_drops:100}]}]};
const locations=plan.areas.map(a=>({id:a.location_id,base_drop_rate:1}));
const settings={inventory_size:500,craftworks_slots:3,_rounds:1};
const flow=[];const r=inventoryRoute(plan,items,locations,{...settings,_traceInventory:e=>flow.push(e)});
assert.equal(r.complete,true,r.problem);assert.equal(r.deliveredTargets.ring,100);
assert.deepEqual(r.activeGroups.map(g=>g.recipes),[['block']]);
assert.deepEqual(r.craftStops.map(s=>s.id),['last']);assert.deepEqual(r.craftStops[0].recipes,['ring','paper','seasoning']);
assert.equal(r.activeGroups[0].amounts.block,200);
assert.equal(flow.length,2);assert.equal(flow[0].stock.ring||0,0);assert.equal(flow[0].stock.gem,100);
assert.ok(Object.values(r.inventoryPeaks).every(q=>q<=500+1e-7));
const delayed=inventoryRoute(plan,items,locations,{...settings,_noConsolidation:true,_activeGroups:[{start:0,end:1,recipes:[]}],_groupSpan:1});
assert.equal(delayed.complete,false);assert.equal(delayed.failure.kind,'needed_supply');assert.deepEqual(delayed.failure.items,['stone']);
// Extra room removes the reason to craft blocks during exploration at all.
const roomy=inventoryRoute(plan,items,locations,{...settings,inventory_size:1000});
assert.equal(roomy.complete,true);assert.ok(roomy.activeGroups.every(g=>!g.recipes.length));
assert.deepEqual(roomy.craftStops.map(s=>s.id),['last']);assert.equal(roomy.craftStops[0].amounts.block,200);
// Inventory snapshots and the optimized batch verifier agree with single clicks.
const slow=inventoryRoute(plan,items,locations,{...settings,_singleClick:true});
assert.deepEqual(slow.craftStops,r.craftStops);assert.deepEqual(slow.inventoryPeaks,r.inventoryPeaks);
assert.equal(slow.uses,r.uses);
// An equally cheap end-only setup wins over crafting early without a need.
const simple={assumptions:plan.assumptions,item_balances:[],crafts_in_dependency_order:[{item_id:'ring',crafts:100}],areas:[plan.areas[0]]};
const tied=inventoryRoute(simple,items,locations,{inventory_size:1000,craftworks_slots:3,_rounds:1});
assert.ok(tied.activeGroups.every(g=>!g.recipes.length));assert.equal(tied.craftStops[0].amounts.ring,100);
// Route caching is insensitive to appearance but invalidates for real inputs,
// including in-place edits to a plan or recipe and changes to drink bonuses.
const plain={inventory_size:1000,craftworks_slots:2},cached=inventoryRoute(plan,items,locations,plain);
assert.strictEqual(inventoryRoute(plan,items,locations,{...plain,theme:'dark'}),cached);
const changed=inventoryRoute(plan,items,locations,{...plain,inventory_size:2000});assert.notStrictEqual(changed,cached);
const edited=structuredClone(plan);const before=inventoryRoute(edited,items,locations,plain);
edited.areas[0].items[0].expected_drops+=1;assert.notStrictEqual(inventoryRoute(edited,items,locations,plain),before);
console.log('Capacity-driven stages: only pressure-relief crafts stay active, small finished crafts wait, quantities and snapshots match, cache invalidation passed');
