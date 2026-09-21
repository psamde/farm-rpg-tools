const assert=require('node:assert/strict');
global.ciderEffectiveness=require('./web/costs.js').ciderEffectiveness;
const {inventoryRoute}=require('./web/route.js');
const items={a:{name:'Raw',direct_ingredients:{},output_quantity:1},b:{name:'Craft',direct_ingredients:{a:1},output_quantity:1}};
const plan={assumptions:{resource_saver:0,unlimited_free_items:[]},crafts_in_dependency_order:[{item_id:'b',crafts:1000}],item_balances:[],areas:[{location_id:'x',name:'Forest',explores:1000,items:[{item_id:'a',expected_drops:1000}]}]};
const loc=[{id:'x',base_drop_rate:1}];
let r=inventoryRoute(plan,items,loc,{inventory_size:400,route_method:'AP'});
assert.equal(r.complete,true);assert.ok(r.uses>=5);assert.ok(r.empties.length>0);assert.equal(r.uses,r.rounds*r.parts[0].batch);
assert.equal(r.visits.reduce((s,v)=>s+v.drinks,0),r.uses);
r=inventoryRoute(plan,items,loc,{inventory_size:100,route_method:'AP'});assert.equal(r.complete,false);assert.match(r.problem,/needs more room/);assert.equal(r.uses,0);
const paired={...plan,crafts_in_dependency_order:[{item_id:'b',crafts:200}],areas:[{location_id:'x',name:'A',explores:200,items:[{item_id:'a',expected_drops:200}]},{location_id:'y',name:'C',explores:200,items:[{item_id:'c',expected_drops:200}]}]};
const pairedItems={...items,c:{name:'Other',direct_ingredients:{},output_quantity:1},b:{name:'Craft',direct_ingredients:{a:1,c:1},output_quantity:1}};
r=inventoryRoute(paired,pairedItems,[...loc,{id:'y',base_drop_rate:1}],{inventory_size:200});assert.equal(r.complete,true);for(let k=0;k<r.rounds;k++)assert.deepEqual(r.visits.slice(k*2,k*2+2).map(v=>v.id),['x','y']);
console.log('Inventory route tests passed');
const baseCider=inventoryRoute(plan,items,loc,{inventory_size:10000,route_method:'Cider',wanderer:33});
const neighCider=inventoryRoute(plan,items,loc,{inventory_size:10000,route_method:'Cider',wanderer:33,route_foods:{neigh:true}});
assert.equal(baseCider.uses,neighCider.uses);assert.ok(Math.abs(neighCider.stamina-baseCider.stamina*.8)<1e-8);
const apFood=inventoryRoute(plan,items,loc,{inventory_size:10000,route_method:'AP',route_foods:{chowder:true,seltzer:true}});
assert.equal(apFood.parts[0].perDrink,320);assert.equal(apFood.stamina,0);
const pieRoute=inventoryRoute(plan,items,loc,{inventory_size:10000,route_method:'AP',route_foods:{pie:true}});
assert.equal(pieRoute.drinksPerClick,5);assert.ok(pieRoute.parts.every(p=>p.batch%5===0));
const pieOverflow=inventoryRoute(plan,items,loc,{inventory_size:400,route_method:'AP',route_foods:{pie:true}});
assert.equal(pieOverflow.complete,false); // Single AP fits; five simultaneous APs do not.
console.log('Food yields, five-drink capacity and stamina checks passed');

const larger={...paired,crafts_in_dependency_order:[{item_id:'b',crafts:10000}],areas:paired.areas.map(a=>({...a,explores:10000,items:a.items.map(d=>({...d,expected_drops:10000}))}))};
r=inventoryRoute(larger,pairedItems,[...loc,{id:'y',base_drop_rate:1}],{inventory_size:1000});
assert.equal(r.complete,true);assert.ok(r.rounds>1);
for(let k=0;k<r.rounds;k++)assert.deepEqual(r.visits.slice(k*2,k*2+2).map(v=>[v.id,v.drinks]),r.parts.map(p=>[p.id,p.batch]));
const cycleUses=r.parts.reduce((n,p)=>n+p.batch,0);assert.ok(r.empties.every(e=>e.after%cycleUses===0));
const bigger=inventoryRoute(larger,pairedItems,[...loc,{id:'y',base_drop_rate:1}],{inventory_size:2000});assert.equal(bigger.complete,true);assert.ok(bigger.rounds<=r.rounds);
const over={...plan,item_balances:[{item_id:'a',starting_inventory:10000}]};assert.equal(inventoryRoute(over,items,loc,{inventory_size:400}).complete,true);
console.log('Repeatable loop and capacity checks passed');

const chainItems={a:{name:'Raw',direct_ingredients:{}},b:{name:'Middle',direct_ingredients:{a:1}},c:{name:'Final',direct_ingredients:{b:1}}};
const chain={...plan,crafts_in_dependency_order:[{item_id:'b',crafts:1000},{item_id:'c',crafts:1000}]};
const limited=inventoryRoute(chain,chainItems,loc,{inventory_size:400,craftworks_slots:1});
assert.equal(limited.complete,true);assert.deepEqual(limited.setups,[['b'],['c']]);
assert.ok(limited.setups.every(s=>s.length<=limited.slots));
assert.throws(()=>inventoryRoute(chain,chainItems,loc,{craftworks_slots:0}),/slots/);
console.log('Slot-limited Craftworks chain checks passed');

// Solver ordering and catalog insertion order must not determine the loop order.
const shuffled={...plan,crafts_in_dependency_order:[],areas:[9,7,2,8,6,3].map(id=>({location_id:`explore:${id}`,name:String(id),explores:200,items:[{item_id:'a',expected_drops:200}]}))};
const before=JSON.stringify(shuffled.areas);
const menuRoute=inventoryRoute(shuffled,items,shuffled.areas.map(a=>({id:a.location_id,base_drop_rate:1})),{inventory_size:10000});
const expected=['explore:7','explore:2','explore:3','explore:6','explore:8','explore:9'];
assert.equal(menuRoute.complete,true);assert.deepEqual(menuRoute.parts.map(p=>p.id),expected);
for(let k=0;k<menuRoute.rounds;k++)assert.deepEqual(menuRoute.visits.slice(k*6,k*6+6).map(v=>v.id),expected);
assert.equal(JSON.stringify(shuffled.areas),before);
console.log('Exploration menu order checks passed');

assert.equal(limited.continuous,false);
assert.equal(limited.minimumContinuousSlots,2);
assert.equal(limited.minimumStopSlots,2);
for(const stop of limited.craftStops)assert.ok(stop.sets.every(set=>set.length<=1));
for(const id of ['b','c'])assert.ok(Math.abs((limited.activeWork[id]||0)+limited.craftStops.reduce((n,s)=>n+(s.amounts[id]||0)*(s.id==='start'?1:limited.rounds),0)-1000)<1e-6);
const allActive=inventoryRoute(chain,chainItems,loc,{inventory_size:400,craftworks_slots:2});assert.equal(allActive.continuous,true);
console.log('Location checkpoint and slot threshold checks passed');
const stretchItems={};for(const id of ['a','b','c']){stretchItems[id]={name:id,direct_ingredients:{},output_quantity:1};stretchItems[id+'craft']={name:id+'craft',direct_ingredients:{[id]:1},output_quantity:1};}
const stretchPlan={assumptions:plan.assumptions,item_balances:[],crafts_in_dependency_order:['a','b','c'].map(id=>({item_id:id+'craft',crafts:400})),areas:['a','a','b','b','c','c'].map((id,i)=>({location_id:'zone'+i,name:'Zone '+i,explores:200,items:[{item_id:id,expected_drops:200}]}))};
const stretchLocations=stretchPlan.areas.map(a=>({id:a.location_id,base_drop_rate:1}));
const narrow=inventoryRoute(stretchPlan,stretchItems,stretchLocations,{inventory_size:1000,craftworks_slots:1});
assert.equal(narrow.complete,true);assert.deepEqual(narrow.activeGroups.map(g=>[g.start,g.end]),[[0,1],[2,3],[4,5]]);
assert.ok(narrow.activeGroups.every(g=>g.recipes.length<=1));
assert.deepEqual(narrow.craftStops,[]); // All work already completes in the active setups.
assert.deepEqual(narrow.activeWork,{acraft:400,bcraft:400,ccraft:400});
const wide=inventoryRoute(stretchPlan,stretchItems,stretchLocations,{inventory_size:1000,craftworks_slots:2});
assert.equal(wide.complete,true);assert.deepEqual(wide.activeGroups.map(g=>[g.start,g.end]),[[0,3],[4,5]]);
assert.ok(wide.activeGroups.length<narrow.activeGroups.length);
console.log('Consecutive Craftworks stretches: 2 locations per setup, extending to 4 with more slots');
// A shared ingredient must not pull an unavailable gemstone recipe into a setup.
const selectiveItems={wood:{name:'Wood',direct_ingredients:{}},gem:{name:'Unpolished Ruby',direct_ingredients:{}},board:{name:'Board',direct_ingredients:{wood:1}},ruby:{name:'Ruby',direct_ingredients:{wood:1,gem:1}}};
const selectivePlan={assumptions:plan.assumptions,item_balances:[],crafts_in_dependency_order:[{item_id:'board',crafts:200},{item_id:'ruby',crafts:200}],areas:[{location_id:'forest',name:'Forest',explores:200,items:[{item_id:'wood',expected_drops:200}]},{location_id:'spring',name:'Small Spring',explores:200,items:[{item_id:'wood',expected_drops:200}]},{location_id:'cave',name:'Cave',explores:200,items:[{item_id:'gem',expected_drops:200}]}]};
const selective=inventoryRoute(selectivePlan,selectiveItems,selectivePlan.areas.map(a=>({id:a.location_id,base_drop_rate:1})),{inventory_size:1000,craftworks_slots:1});
assert.equal(selective.complete,true);
assert.deepEqual(selective.activeGroups[0].recipes,['board']);
assert.equal(selective.activeGroups[0].end,1);
assert.deepEqual(selective.activeGroups[1].recipes,['ruby']);
console.log('Unavailable Ruby excluded; Forest and Small Spring share the useful setup');

// Every expected inventory increase is audited, not just drops or final balances.
for(const capacity of [200,400,1000])for(const slots of [1,2]){
 const audited=inventoryRoute(chain,chainItems,loc,{inventory_size:capacity,craftworks_slots:slots});
 assert.equal(audited.complete,true);assert.equal(audited.inventoryVerified,true);
 assert.ok(Object.values(audited.inventoryPeaks).every(q=>q<=capacity+1e-7));
 assert.ok(audited.inventoryPeaks.b>0&&audited.inventoryPeaks.c>0);
}
// Incoming stock is outside the cap, even when that item also drops in the loop.
const carry=inventoryRoute({...plan,item_balances:[{item_id:'a',starting_inventory:10000}],crafts_in_dependency_order:[],areas:[{location_id:'x',name:'Forest',explores:200,items:[{item_id:'a',expected_drops:200}]}]},items,loc,{inventory_size:300,_rounds:1});
assert.equal(carry.complete,true);assert.equal(carry.inventoryVerified,true);assert.equal(carry.inventoryPeaks.a,200);
// Multiple rows for one drop must be summed before checking a whole click.
const repeatedDrops={...plan,crafts_in_dependency_order:[],areas:[{location_id:'x',name:'Forest',explores:200,items:[{item_id:'a',expected_drops:150},{item_id:'a',expected_drops:150}]}]};
const repeated=inventoryRoute(repeatedDrops,items,loc,{inventory_size:200});
assert.equal(repeated.complete,false);assert.equal(repeated.uses,0);
// Combined five-drink click is checked before any crafting; no within-click relief.
assert.equal(pieOverflow.inventoryVerified,false);
assert.throws(()=>inventoryRoute(plan,items,loc,{inventory_size:0}),/Inventory size/);
console.log('Expected-flow peaks, intermediate outputs, incoming reserves, duplicate drops and whole-click limits passed');

const suppliedItems={...items,potato:{name:'Potato',direct_ingredients:{}},b:{...items.b,direct_ingredients:{a:1,potato:8}}};
const suppliedPlan={...plan,item_balances:[{item_id:'potato',starting_inventory:8000,auto_starting_inventory:8000}]};
const supplied=inventoryRoute(suppliedPlan,suppliedItems,loc,{inventory_size:400});
assert.equal(supplied.complete,true);
assert.ok(Object.values(supplied.inventoryPeaks).every(n=>n<=400+1e-7));
assert.ok(supplied.rounds>1);assert.ok(!supplied.inventoryPeaks.potato);
assert.equal((supplied.activeWork.b||0)+supplied.craftStops.reduce((n,s)=>n+(s.amounts.b||0)*(s.id==='start'?1:supplied.rounds),0),1000);
// The exemption removes the capacity limit, not the supplied quantity limit.
const insufficient=inventoryRoute({...suppliedPlan,item_balances:[{item_id:'potato',starting_inventory:4000,auto_starting_inventory:4000}]},suppliedItems,loc,{inventory_size:400});
assert.equal(insufficient.complete,false);
// Supplied crafted items are external; newly crafted copies still need room.
const suppliedCraft=inventoryRoute({...plan,item_balances:[{item_id:'b',starting_inventory:10000}]},items,loc,{inventory_size:400});
assert.equal(suppliedCraft.complete,true);assert.ok(suppliedCraft.inventoryPeaks.b>0&&suppliedCraft.inventoryPeaks.b<=400);
console.log('Large external supplies, finite amounts and separate crafted output capacity passed');
