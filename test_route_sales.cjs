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
// Exercise the production renderers: final-only counts, per-loop sale amounts,
// a visible checkpoint, and inventory-only final batches.
const src=fs.readFileSync('web/app.js','utf8'),ctx=vm.createContext({items,fmt:n=>Math.floor(n).toLocaleString('en-US'),esc:String,itemName:id=>id,craftworksDisplayOrder:ids=>ids});
vm.runInContext(src.slice(src.indexOf('function routeBatchTiming('),src.indexOf("$('routeCards').onclick=")),ctx);
ctx.small=small;ctx.periodic=periodic;ctx.batch=batch;
assert.match(vm.runInContext('craftworksSetup(null,small)',ctx),/Final loop only/);
assert.match(vm.runInContext('craftworksSetup(null,periodic)',ctx),/Every 2 loops/);
assert.match(vm.runInContext("routeSaleRows(periodic,'woods',1)",ctx),/No selling needed/);
assert.match(vm.runInContext("routeSaleRows(periodic,'woods',2)",ctx),/20/);
assert.match(vm.runInContext('routeTransition(periodic,periodic.parts[0],0)',ctx),/Sell these items/);
assert.match(vm.runInContext('craftworksSetup(null,batch)',ctx),/Sell these items/);
// A periodic intermediate must precede its regular consumer on the loops
// when both run. Pack the filtered dependency order, never cadence order.
ctx.cross={recipes:['board','goal'],runs:{'required:board':{2:20},'required:goal':{1:5,2:5}}};ctx.loop={slots:1};
assert.equal(vm.runInContext("JSON.stringify(routeStopBatches(cross,loop,2).map(b=>b.ids))",ctx),JSON.stringify([['board'],['goal']]));
assert.equal(vm.runInContext("JSON.stringify(routeStopBatches(cross,loop,1).map(b=>b.ids))",ctx),JSON.stringify([['goal']]));
assert.match(vm.runInContext('routeTransition(periodic,periodic.parts[0],0)',ctx),/data-craft-stop="woods"/);
console.log('Sales and cadence: final/periodic batches, ingredient protection, primary delivery, multi-batch selling, mixed sources and route UI passed.');
