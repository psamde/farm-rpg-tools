const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
global.ciderEffectiveness=require('./web/costs.js').ciderEffectiveness;
const {inventoryRoute}=require('./web/route.js');
const model=require('./web/craft-map-model.js');
const item=(direct_ingredients={})=>({direct_ingredients,output_quantity:1});
const items={wood:item(),board:item({wood:1}),goal:item({board:1}),bonus:item({board:1})};
const assumptions={resource_saver:0,unlimited_free_items:[]},locations=[{id:'woods',base_drop_rate:1}];
const plan=(crafts,raw)=>({assumptions,item_balances:[],crafts_in_dependency_order:[],secondary:{crafts_in_dependency_order:Object.entries(crafts).map(([item_id,crafts])=>({item_id,crafts}))},areas:[{location_id:'woods',name:'Woods',explores:2000,items:[{item_id:'wood',expected_drops:raw}]}]});
const sold=(r,id)=>r.sales.flatMap(s=>s.items).filter(i=>i.id===id).reduce((n,i)=>n+i.quantity,0);
function quantities(r){const counts={...r.activeWork};for(const s of r.craftStops)for(const [id,n] of Object.entries(s.amounts))counts[id]=(counts[id]||0)+n*(s.once?1:r.rounds);return counts;}
const small=inventoryRoute(plan({board:10},10),items,locations,{inventory_size:100,craftworks_slots:2,_rounds:10});
assert.equal(small.complete,true,small.problem);assert.equal(small.craftCadence.board,10);
assert.equal(sold(small,'board'),10);assert.ok(small.sales.every(s=>s.round===10));
assert.equal(quantities(small).board,10);assert.equal(small.uses,10);
const periodic=inventoryRoute(plan({board:100},100),items,locations,{inventory_size:25,craftworks_slots:2,_rounds:10});
assert.equal(periodic.complete,true,periodic.problem);assert.equal(periodic.craftCadence.board,2);
assert.deepEqual(periodic.sales.map(s=>s.round),[2,4,6,8,10]);assert.equal(sold(periodic,'board'),100);
assert.ok(Object.values(periodic.inventoryPeaks).every(n=>n<=25));assert.equal(quantities(periodic).board,100);
// No optional output or ingredient may be silently cleared; protected goal
// outputs leave through delivery, while only the manufactured surplus is sold.
const chain=plan({board:10,bonus:5},20);chain.crafts_in_dependency_order=[{item_id:'board',crafts:10},{item_id:'goal',crafts:10}];chain.item_balances=[{item_id:'goal',starting_inventory:0,reserved_target_output:10}];
const result=inventoryRoute(chain,items,locations,{inventory_size:100,craftworks_slots:3,_rounds:5});
assert.equal(result.complete,true,result.problem);assert.equal(result.deliveredTargets.goal,10);
assert.equal(sold(result,'goal'),0);assert.equal(sold(result,'board'),5);assert.equal(sold(result,'bonus'),5);
assert.equal(sold(result,'wood'),0,'raw surplus is not a crafted selling stop');
assert.deepEqual(quantities(result),{board:20,goal:10,bonus:5});
// Crafted and explored copies occupy the same stack. The visible sale must
// cover all stock cleared to make room, rather than just its crafted portion.
const mixed=plan({board:10},10);mixed.areas[0].items.push({item_id:'board',expected_drops:15});
const mix=inventoryRoute(mixed,items,locations,{inventory_size:100,craftworks_slots:2,_rounds:1});
assert.equal(mix.complete,true);assert.equal(sold(mix,'board'),25);
assert.equal(mix.sales.flatMap(s=>s.items).filter(i=>i.id==='board').reduce((n,i)=>n+i.craftedQuantity,0),10);
// Finishing a large inventory-only craft requires visible inter-batch sales.
const stocked=plan({board:300},0);stocked.areas=[];stocked.item_balances=[{item_id:'wood',starting_inventory:300}];
const batch=inventoryRoute(stocked,items,[],{inventory_size:100,craftworks_slots:1,_rounds:1});
assert.equal(batch.complete,true);assert.equal(sold(batch,'board'),300);assert.ok(batch.sales.length>=3);
assert.ok(batch.sales.flatMap(s=>s.items).every(i=>i.quantity<=100));
assert.equal(model.craftMapSurplusLabels({craftable:true,crafts:0}).sell,'Sell');
assert.equal(model.craftMapSurplusLabels({craftable:true,crafts:10,explorationSupplied:true}).sell,'Sell');
assert.equal(model.craftMapSurplusLabels({craftable:true,crafts:0,explorationSupplied:true}).sell,'Void/Sell');
assert.equal(model.craftMapSurplusLabels({craftable:false,explorationSupplied:true}).use,'Use + Void');
assert.equal(model.craftMapSurplusLabels({craftable:true,crafts:1}).use,'Use + Sell');
// Crafting and selling have independent schedules. A small output can be
// crafted each loop, sold every 50 loops, and cleared once at the end.
const gradualPlan=plan({board:123},123);
const gradual=inventoryRoute(gradualPlan,items,locations,{inventory_size:60,craftworks_slots:2,_rounds:123,_noCadence:true});
assert.equal(gradual.complete,true,gradual.problem);assert.equal(gradual.craftCadence.board,undefined);
assert.equal(gradual.saleCadence.board,50);assert.deepEqual(gradual.sales.map(s=>s.round),[50,100,123]);
assert.equal(sold(gradual,'board'),123);assert.equal(quantities(gradual).board,123);
assert.ok(Object.values(gradual.inventoryPeaks).every(q=>q<=60));
const held=inventoryRoute(plan({board:20},20),items,locations,{inventory_size:100,craftworks_slots:2,_rounds:20,_noCadence:true});
assert.equal(held.saleCadence.board,20);assert.deepEqual(held.sales.map(s=>s.round),[20]);
const slow=inventoryRoute(gradualPlan,items,locations,{inventory_size:60,craftworks_slots:2,_rounds:123,_noCadence:true,_singleClick:true});
assert.deepEqual(slow.sales,gradual.sales);assert.deepEqual(slow.inventoryPeaks,gradual.inventoryPeaks);
// Grouped instructions need no loop picker and preserve source-before-consumer
// setup ordering even when regular and occasional recipes are combined.
const src=fs.readFileSync('web/app.js','utf8'),ctx=vm.createContext({items,fmt:n=>Math.floor(n).toLocaleString('en-US'),esc:String,itemName:id=>id,craftworksDisplayOrder:ids=>ids});
vm.runInContext(src.slice(src.indexOf('function routeFrequencyLabel('),src.indexOf("$('routeCards').onclick=")),ctx);
ctx.small=small;ctx.periodic=periodic;ctx.batch=batch;ctx.gradual=gradual;
assert.match(vm.runInContext('craftworksSetup(null,small)',ctx),/At the end/);
assert.match(vm.runInContext('craftworksSetup(null,periodic)',ctx),/Every 2 loops/);
assert.match(vm.runInContext("routeSellSection(gradual,'woods')",ctx),/Every 50 loops/);
assert.match(vm.runInContext('routeTransition(periodic,periodic.parts[0],0)',ctx),/Sell these items/);
assert.match(vm.runInContext('craftworksSetup(null,batch)',ctx),/Sell these items/);
assert.match(vm.runInContext('craftworksSetup(null,batch)',ctx),/sell between them/);
assert.doesNotMatch(vm.runInContext('craftworksSetup(null,gradual)',ctx),/Show loop|type="number"|data-sale-loop|data-craft-loop/);
ctx.cross={recipes:['board','goal'],runs:{'required:board':{2:20},'required:goal':{1:5,2:5}}};ctx.loop={slots:1,rounds:2,craftCadence:{board:2}};
assert.equal(vm.runInContext("JSON.stringify(routeCraftRoutines(cross,loop)[1].batches.map(b=>b.ids))",ctx),JSON.stringify([['board'],['goal']]));
assert.equal(vm.runInContext("JSON.stringify(routeCraftRoutines(cross,loop)[0].batches.map(b=>b.ids))",ctx),JSON.stringify([['goal']]));
assert.match(vm.runInContext('routeTransition(periodic,periodic.parts[0],0)',ctx),/data-craft-stop="woods"/);
// All displayed routines together account for every recorded craft, without
// duplicating primary or periodic batches across routine alternatives.
ctx.conserve=periodic;
assert.ok(vm.runInContext(`conserve.craftStops.every(stop=>{
 const routines=routeCraftRoutines(stop,conserve);
 return Object.entries(stop.runs).every(([key,runs])=>{const [kind,id]=key.split(':');const reported=routines.reduce((total,r)=>total+r.batches.filter(b=>b.kind===kind&&b.ids.includes(id)).reduce((n,b)=>n+b.amounts[id]*r.rounds.length,0),0);return Math.abs(reported-Object.values(runs).reduce((a,b)=>a+b,0))<1e-7;});
})`,ctx));
console.log('Sales and cadence: final/periodic crafts, independent selling intervals, conservation, ordering, grouped UI and no loop selectors passed.');
