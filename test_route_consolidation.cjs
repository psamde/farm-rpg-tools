const assert=require('node:assert/strict');
global.ciderEffectiveness=require('./web/costs.js').ciderEffectiveness;
const {inventoryRoute}=require('./web/route.js');
const item=(direct_ingredients={})=>({direct_ingredients,output_quantity:1});
const rows=counts=>Object.entries(counts).map(([item_id,crafts])=>({item_id,crafts}));
const area=(id,drops)=>({location_id:id,name:id,explores:2000,items:Object.entries(drops).map(([item_id,expected_drops])=>({item_id,expected_drops}))});
const locations=p=>p.areas.map(a=>({id:a.location_id,base_drop_rate:1}));
const assumptions={resource_saver:0,unlimited_free_items:[]};
const counted=(r,id)=>(r.activeWork[id]||0)+r.craftStops.reduce((n,s)=>n+(s.amounts[id]||0)*(s.once?1:r.rounds),0);
function checkTotals(p,r,capacity){
 assert.equal(r.complete,true,r.problem);assert.deepEqual(r.unsafeMerges,[]);
 assert.ok(Object.values(r.inventoryPeaks).every(q=>q<=capacity+1e-7));
 assert.ok(r.activeGroups.every(g=>g.recipes.length<=r.slots&&new Set(g.recipes).size===g.recipes.length));
 const expected={};for(const c of [...p.crafts_in_dependency_order,...(p.secondary?.crafts_in_dependency_order||[])])expected[c.item_id]=(expected[c.item_id]||0)+c.crafts;
 for(const [id,q] of Object.entries(expected))assert.ok(Math.abs(counted(r,id)-q)<1e-7,`${id}: ${counted(r,id)} instead of ${q}`);
}

// A saved fractional gem from an earlier loop makes Final payable at Early.
// The first-loop forecast misses this; the complete trace must merge that swap.
const carryItems={wood:item(),paper:item(),gem:item(),coal:item(),board:item({wood:1}),final:item({board:1,gem:1}),paperCraft:item({paper:1}),coalCraft:item({coal:1})};
const carry={assumptions:{...assumptions,resource_saver:45},crafts_in_dependency_order:rows({board:10,final:10,paperCraft:10,coalCraft:10}),item_balances:[],areas:[area('early',{wood:10,paper:10}),area('late',{gem:11.3,coal:10})]};
const carrySettings={inventory_size:100,craftworks_slots:3,_rounds:3};
const baseline=inventoryRoute(carry,carryItems,locations(carry),{...carrySettings,_noConsolidation:true});
assert.deepEqual(baseline.craftStops.map(s=>s.id),['early']);
assert.equal(baseline.craftStops[0].firstRound,2);assert.equal(baseline.craftStops[0].runCount,1);
const merged=inventoryRoute(carry,carryItems,locations(carry),carrySettings);
checkTotals(carry,merged,100);assert.equal(merged.uses,baseline.uses);assert.equal(merged.rounds,baseline.rounds);
assert.equal(merged.craftStops.length,0);assert.ok(merged.activeGroups[0].recipes.includes('final'));
assert.deepEqual(merged.parts.map(p=>p.batch),baseline.parts.map(p=>p.batch));
const single=inventoryRoute(carry,carryItems,locations(carry),{...carrySettings,_singleClick:true});
assert.deepEqual(single.activeGroups,merged.activeGroups);assert.deepEqual(single.craftStops,merged.craftStops);
for(const [id,q] of Object.entries(merged.inventoryPeaks))assert.ok(Math.abs(single.inventoryPeaks[id]-q)<1e-7);

// Required dye uses leaf at Early. Its surplus can safely feed optional
// parchment at Late, even though another required recipe there uses the dye.
const safeItems={leaf:item(),cotton:item(),dye:item({leaf:1}),chair:item({dye:1,cotton:1}),parchment:item({leaf:1})};
const safe={assumptions,crafts_in_dependency_order:rows({dye:200,chair:200}),secondary:{crafts_in_dependency_order:rows({parchment:200})},item_balances:[],areas:[area('early',{leaf:600}),area('late',{cotton:200})]};
const safeSettings={inventory_size:1000,craftworks_slots:3,_rounds:2,_groupSpan:1};
const safeResult=inventoryRoute(safe,safeItems,locations(safe),safeSettings);
checkTotals(safe,safeResult,1000);assert.equal(safeResult.craftStops.length,0);
assert.ok(!safeResult.activeGroups[0].recipes.includes('parchment'));
assert.ok(safeResult.activeGroups.find(g=>g.start===1).recipes.includes('parchment'));

// Spear cannot stay active across Early -> Middle: it could spend the wood
// before required chairs get cloth. Move its checkpoint batch to the existing
// Late setup instead; keep the protected stretch and avoid a redundant swap.
const deferItems={wood:item(),cloth:item(),salt:item(),chair:item({wood:1,cloth:1}),spear:item({wood:1}),saltcraft:item({salt:1})};
const defer={assumptions,crafts_in_dependency_order:rows({chair:100,saltcraft:100}),secondary:{crafts_in_dependency_order:rows({spear:100})},item_balances:[{item_id:'chair',starting_inventory:0,reserved_target_output:100}],areas:[area('early',{wood:140}),area('middle',{cloth:100}),area('late',{wood:60,salt:100})]};
const deferSettings={inventory_size:1000,craftworks_slots:3,_rounds:1,_groupSpan:2};
const original=inventoryRoute(defer,deferItems,locations(defer),{...deferSettings,_noConsolidation:true});
assert.deepEqual(original.craftStops.map(s=>s.id),['middle','late']);
const events=[],deferred=inventoryRoute(defer,deferItems,locations(defer),{...deferSettings,_trace:e=>events.push(e)});
checkTotals(defer,deferred,1000);assert.equal(deferred.deliveredTargets.chair,100);assert.equal(deferred.uses,original.uses);
assert.ok(!deferred.activeGroups[0].recipes.includes('spear'));assert.equal(deferred.craftStops.length,0);
assert.deepEqual(deferred.deferredStops.middle,['spear']);
assert.ok(events.filter(e=>e.id==='spear').every(e=>e.place==='late'));
assert.equal(events.filter(e=>e.id==='spear').reduce((n,e)=>n+e.count,0),100);

// Finishing an inventory-only batch may require several empty/craft passes.
// These are final cleanup, not a recurring post-location instruction.
const finish={assumptions,crafts_in_dependency_order:rows({board:300}),item_balances:[{item_id:'wood',starting_inventory:300}],areas:[]};
const finished=inventoryRoute(finish,carryItems,[],{inventory_size:100,craftworks_slots:1,_rounds:2});
checkTotals(finish,finished,100);
const cleanup=finished.craftStops.find(s=>s.id==='finish');assert.ok(cleanup);assert.equal(cleanup.once,true);
assert.equal(cleanup.amounts.board,50);assert.equal(counted(finished,'board'),300);
console.log('Craftworks consolidation: carry-over, safe spare slots, real priority barriers, deferred swaps, conserved outputs and final cleanup passed');
