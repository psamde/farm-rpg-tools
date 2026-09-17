const fs=require('fs'),assert=require('assert/strict');
const {buildCraftMap,towerOpportunity}=require('./web/craft-map-model.js');
const items=JSON.parse(fs.readFileSync('data/catalog.json','utf8')).items;
const id=name=>Object.values(items).find(i=>i.name===name).id;
const stock={'White Parchment':200,'Purple Flower':300,'Fern Leaf':300};
const plan={item_balances:Object.entries(stock).map(([name,q])=>({item_id:id(name),expected_unused:q,crafted:0})),areas:[]};
const drafts=['Purple Diary','Green Diary'].map(name=>({item_id:id(name),cap:100}));
const graph=buildCraftMap(items,plan,{targets:{},secondary:[]},drafts);
assert.equal(new Set(graph.nodes.map(n=>n.id)).size,graph.nodes.length);
assert.equal(graph.missing[id('Mushroom')],600);
assert.equal(graph.nodes.find(n=>n.id===id('Mushroom Paste')).draftCrafts,200);
assert.equal(graph.links.filter(l=>l.from===id('White Parchment')).length,2);
assert.equal(graph.links.filter(l=>l.from===id('Mushroom Paste')).length,2);
assert.equal(graph.missing[id('Feathers')]||0,0);
const partial=structuredClone(plan);partial.item_balances.push({item_id:id('Mushroom Paste'),expected_unused:50,crafted:0});
assert.equal(buildCraftMap(items,partial,{targets:{},secondary:[]},drafts).missing[id('Mushroom')],450);
assert.equal(towerOpportunity('x',330,{items:{x:[321,340]},gm_items:{x:[350]}}).level,340);
console.log('One node per item, shared ghost demand, intermediate stock, Tower ranking passed.');

const {layoutCraftMap}=require('./web/craft-map-model.js');
const old=layoutCraftMap([{id:'a',name:'Alpha',depth:1},{id:'z',name:'Zulu',depth:1}]);
const next=layoutCraftMap([{id:'a',name:'Alpha',depth:1},{id:'b',name:'Beta',depth:1},{id:'z',name:'Zulu',depth:1}],old);
assert.deepEqual(next.z,old.z);
assert.notEqual(next.b.y,next.z.y);
const {laneLayoutCraftMap}=require('./web/craft-map-model.js');
const ns=[{id:'a',location:'a',name:'Forest',kind:'area',depth:0},{id:'b',location:'b',name:'Black Rock Canyon',kind:'area',depth:0},...['shared','exclusive','crop','external','crafted'].map(id=>({id,name:id,kind:'item',depth:id==='crafted'?2:1,crafts:id==='crafted'?10:0}))];
const ls=[{from:'a',to:'shared'},{from:'b',to:'shared'},{from:'b',to:'exclusive'},{from:'exclusive',to:'crafted'}];
const lanes=laneLayoutCraftMap(ns,ls,{crop:{farm_produced:true}},['a','b']);
assert.equal(lanes.assignments.shared,'shared');
assert.equal(lanes.assignments.exclusive,'b');
assert.equal(lanes.assignments.crafted,'flow');
assert.equal(lanes.assignments.crop,'farming');
assert.equal(lanes.assignments.external,'disconnected');
assert.equal(lanes.lanes[0].id,'disconnected');
assert.ok(lanes.positions.external.y<lanes.positions.exclusive.y);
assert.equal(lanes.positions.b.y,lanes.positions.exclusive.y);
for(const lane of lanes.lanes){const members=ns.filter(n=>lanes.assignments[n.id]===lane.id);for(const n of members)assert.ok(lanes.positions[n.id].y>=lane.y&&lanes.positions[n.id].y+110<lane.y+lane.height);}
console.log('Source lanes, shared drops, farm supplies, recipe alignment and lane bounds passed.');

const mixed=laneLayoutCraftMap([...ns,{id:'twine',kind:'item',name:'Twine',depth:2,crafts:2}], [...ls,{from:'exclusive',to:'twine'},{from:'crop',to:'twine'}],{crop:{farm_produced:true}},['a','b']);
assert.ok(mixed.positions.twine.y>mixed.positions.exclusive.y);
assert.ok(mixed.positions.twine.y<mixed.positions.crop.y);
const crowded=laneLayoutCraftMap([...ns,...Array.from({length:6},(_,i)=>({id:'c'+i,name:'Craft'+i,kind:'item',depth:2,crafts:1}))],[...ls,...Array.from({length:6},(_,i)=>({from:'exclusive',to:'c'+i}))],{crop:{farm_produced:true}},['a','b']);
const ys=['crafted',...Array.from({length:6},(_,i)=>'c'+i)].map(id=>crowded.positions[id].y).sort((a,b)=>a-b);
for(let i=1;i<ys.length;i++)assert.ok(ys[i]-ys[i-1]>=141.99);
const {craftMapUsage}=require('./web/craft-map-model.js');
assert.equal(craftMapUsage({kind:'item',stock:100}),'unused');
assert.equal(craftMapUsage({kind:'item',stock:.4}),'fulfilled');
assert.equal(craftMapUsage({kind:'item',stock:1,totalSupply:369613}),'fulfilled');
assert.equal(craftMapUsage({kind:'item',stock:99,totalSupply:100000}),'fulfilled');
assert.equal(craftMapUsage({kind:'item',stock:100,totalSupply:100000}),'unused');
assert.equal(craftMapUsage({kind:'item',stock:1,totalSupply:369613,missing:10}),'pending');
assert.equal(craftMapUsage({kind:'item',stock:0,missing:10}),'pending');
console.log('Floating crafts center between ingredients; crowded columns do not overlap; usage colors passed.');
const {craftMapCandidateGaps}=require('./web/craft-map-model.js');
const gapRows=craftMapCandidateGaps(items,plan,{targets:{},secondary:[]},[],id('Green Diary'),100);
assert.ok(gapRows.some(([ref,q])=>ref===id('Mushroom')&&q===300));
const stocked={...plan,item_balances:[...plan.item_balances,{item_id:id('Mushroom'),expected_unused:300,crafted:0}]};
assert.equal(craftMapCandidateGaps(items,stocked,{targets:{},secondary:[]},[],id('Green Diary'),100).length,0);
console.log('Candidate supplied/gap estimates passed.');
const {craftMapAddOptions,craftMapDependents}=require('./web/craft-map-model.js');
const supply=(entries)=>({areas:[],item_balances:Object.entries(entries).map(([name,q])=>({item_id:id(name),expected_unused:q,crafted:0}))});
const twineSupply=supply({Wood:10,Straw:100});
const modes=craftMapAddOptions(items,twineSupply,{targets:{},secondary:[]},[],id('Twine'),id('Straw'));
assert.deepEqual(modes,{all:50,available:10});
assert.equal(craftMapCandidateGaps(items,twineSupply,{targets:{},secondary:[]},[],id('Twine'),modes.available).length,0);
assert.ok(craftMapCandidateGaps(items,twineSupply,{targets:{},secondary:[]},[],id('Twine'),modes.all).some(([ref,q])=>ref===id('Wood')&&q===40));
const emeraldSupply=supply({Emerald:10,Stone:10,'Mushroom Paste':10});
const ringGraph=buildCraftMap(items,emeraldSupply,{iron_depot:true,targets:{},secondary:[]},[{item_id:id('Emerald Ring'),cap:10}]);
assert.deepEqual(ringGraph.missing,{});
assert.equal(ringGraph.nodes.find(n=>n.id===id('Iron Ring')).blocked,false);
assert.equal(ringGraph.nodes.find(n=>n.id===id('Stone')).stock,0);
const noPerk=buildCraftMap(items,emeraldSupply,{iron_depot:false,targets:{},secondary:[]},[{item_id:id('Emerald Ring'),cap:10}]);
assert.equal(noPerk.missing[id('Iron')],20);
const protectedGraph=buildCraftMap(items,{...emeraldSupply,crafts_in_dependency_order:[{item_id:id('Emerald Ring'),crafts:10},{item_id:id('Iron Ring'),crafts:10}],item_balances:[...emeraldSupply.item_balances,{item_id:id('Emerald Ring'),crafted:10},{item_id:id('Iron Ring'),crafted:10}]},{iron_depot:true,targets:{[id('Emerald Ring')]:10},secondary:[]});
assert.ok(protectedGraph.nodes.find(n=>n.id===id('Iron Ring')).protected);
assert.equal(craftMapDependents(items,[{item_id:id('Emerald Ring')}],id('Iron Ring')).length,1);
assert.equal(craftMapUsage({kind:'item',stock:100,voided:true}),'void');
console.log('Use-all/available amounts, free supplies, draft usage, primary protection and void styling passed.');
const {craftMapNodeLabels}=require('./web/craft-map-model.js');
assert.deepEqual(craftMapNodeLabels({kind:'item',protected:true,useVoid:true},[],[]),{requirement:'REQUIRED NODE',mode:'Use + Void'});
assert.deepEqual(craftMapNodeLabels({kind:'item',voided:true,useVoid:true},[],[]),{requirement:'OPTIONAL NODE',mode:'Void/Sell'});
assert.equal(craftMapNodeLabels({id:'area',kind:'area'},[{id:'raw',protected:true}],[{from:'area',to:'raw'}]).requirement,'REQUIRED NODE');
console.log('Requirement labels and explicit choice labels passed.');

const {visibleCraftMapGaps}=require('./web/craft-map-model.js');
assert.deepEqual(visibleCraftMapGaps([['a',1],['b',9.99],['c',10]]),[['c',10]]);
assert.equal(craftMapUsage({kind:'item',stock:0,missing:3}),'fulfilled');

// Directly acquired intermediates must not pull unused recipes into the map.
const bottlePlan={areas:[],crafts_in_dependency_order:[{item_id:id('Glass Bottle'),crafts:10}],item_balances:[
 {item_id:id('Glass Bottle'),crafted:10,expected_unused:0},
 {item_id:id('Glass Orb'),crafted:0,expected_unused:5,expected_exploration_drops:15},
 {item_id:id('Stone'),crafted:0,expected_unused:0}
]};
const bottleSettings={targets:{[id('Glass Bottle')]:10},secondary:[]};
const directGraph=buildCraftMap(items,bottlePlan,bottleSettings);
assert.ok(directGraph.nodes.find(n=>n.id===id('Glass Orb')).protected);
assert.ok(!directGraph.nodes.some(n=>n.id===id('Shimmer Stone')));
assert.ok(!directGraph.nodes.some(n=>n.id===id('Unpolished Shimmer Stone')));
assert.ok(directGraph.links.every(l=>directGraph.nodes.some(n=>n.id===l.from)&&directGraph.nodes.some(n=>n.id===l.to)));
// A later draft can introduce this branch, but it is optional, not primary-protected.
const withDraft=buildCraftMap(items,bottlePlan,bottleSettings,[{item_id:id('Glass Orb'),cap:10}]);
assert.ok(withDraft.nodes.some(n=>n.id===id('Shimmer Stone')));
assert.equal(withDraft.nodes.find(n=>n.id===id('Shimmer Stone')).protected,false);
assert.ok(withDraft.nodes.some(n=>n.id===id('Unpolished Shimmer Stone')));
assert.ok(Object.keys(withDraft.missing).length>0);
// A separately supplied leftover may still appear, correctly marked optional.
const surplusGraph=buildCraftMap(items,{...bottlePlan,item_balances:[...bottlePlan.item_balances,{item_id:id('Shimmer Stone'),crafted:0,expected_unused:20}]},bottleSettings);
assert.equal(surplusGraph.nodes.find(n=>n.id===id('Shimmer Stone')).protected,false);
console.log('Collected intermediates prune inactive recipes; draft branches and optional leftovers remain available.');

// Solved previews keep requested roots even if the solver makes none.
const canteen=id('Horn Canteen');
for(const made of [0,9999]){
 const solved={item_balances:[{item_id:canteen,crafted:made,expected_unused:made}],areas:[]};
 const preview=buildCraftMap(items,solved,{targets:{},secondary:[{item_id:canteen,cap:10000}]},[]);
 assert.equal(preview.nodes.find(n=>n.id===canteen).crafts,made);
 assert.equal(preview.nodes.find(n=>n.id===canteen).secondary,true);
 assert.equal(preview.nodes.find(n=>n.id===canteen).draftCrafts,0);
}
console.log('Solved preview retains zero-output requested crafts without double-counting drafts.');

// Global top-N and per-location expansion share nodes and preserve recipe inputs.
const visibleItems={};for(let i=1;i<=9;i++)visibleItems[i]={id:String(i),name:'Material '+i,craftable:false,direct_ingredients:{},output_quantity:1};
visibleItems.recipe={id:'recipe',name:'Recipe',craftable:true,direct_ingredients:Object.fromEntries(Object.keys(visibleItems).map(id=>[id,1])),output_quantity:1};
const visibilityPlan={item_balances:Object.keys(visibleItems).filter(id=>id!=='recipe').map(id=>({item_id:id,expected_unused:100-Number(id),crafted:0})),areas:[{location_id:'desert',name:'Desert',explores:100,items:[1,2,3,4,5,6].map(id=>({item_id:String(id),expected_drops:100}))},{location_id:'forest',name:'Forest',explores:10,items:[1,7,8,9].map(id=>({item_id:String(id),expected_drops:10}))}]};
const view=opts=>buildCraftMap(visibleItems,visibilityPlan,{targets:{},secondary:[],...opts}).nodes.filter(n=>n.kind==='item').map(n=>n.id);
assert.equal(view({}).length,6);
assert.equal(view({map_unused_mode:'none'}).length,0);
assert.equal(view({map_unused_mode:'all'}).length,9);
assert.deepEqual(view({map_unused_mode:'none',map_expanded_areas:['forest']}),['1','7','8','9']);
assert.equal(view({map_unused_count:2,map_expanded_areas:['forest']}).length,5);
assert.equal(view({map_unused_count:2,map_expanded_areas:[]}).length,2);
assert.equal(view({map_unused_mode:'none',targets:{recipe:1}}).includes('recipe'),true);
console.log('Top unused All / X / None and location expansion preserve shared unique nodes and required roots.');
const suppliedGraph=buildCraftMap(visibleItems,visibilityPlan,{targets:{},secondary:[],map_unused_mode:'all'});
assert(suppliedGraph.nodes.filter(n=>n.kind==='item').every(n=>n.explorationSupplied));
assert.equal(buildCraftMap(items,plan,{targets:{},secondary:[]},drafts).nodes.find(n=>n.id===id('Purple Diary')).explorationSupplied,false);
console.log('Exploration drop nodes are protected from deletion independently of primary goals.');

assert.equal(require('./web/craft-map-model.js').craftMapNodeLabels({kind:'item',explorationSupplied:true},[],[]).requirement,'EXPLORE OUTPUT NODE');

const missingFarm=laneLayoutCraftMap([...ns,{id:'straw',name:'Straw',kind:'item',depth:1,missing:95126,crafts:0}],ls,{crop:{farm_produced:true},straw:{farm_produced:true}},['a','b']);
assert.equal(missingFarm.assignments.straw,'disconnected');
assert.ok(missingFarm.positions.straw.y<missingFarm.positions.crop.y);
assert.ok(missingFarm.positions.straw.y<missingFarm.positions.exclusive.y);

// Zero-output optional crafts can expose bounded demand without adding exploration.
{
 const {craftMapPotential}=require('./web/craft-map-model.js');
 const supplies={ 'White Parchment':100, 'Purple Parchment':100 };
 const p={areas:[],item_balances:Object.entries(supplies).map(([name,q])=>({item_id:id(name),expected_unused:q,crafted:0}))};
 const ds=[{item_id:id('Purple Diary'),cap:0,available_only:true,void_source:id('White Parchment')}];
 const before=JSON.stringify(ds);
 const potential=craftMapPotential(items,p,{targets:{},secondary:[]},ds);
 assert.equal(potential.goals[0].cap,100);
 assert.equal(potential.graph.missing[id('Mushroom')],300);
 assert.equal(potential.graph.nodes.find(n=>n.id===id('Mushroom Paste')).need,100);
 assert.equal(JSON.stringify(ds),before);
 const fixed=potential.goals.map(g=>({...g,available_only:false,void_source:null}));
 assert.equal(craftMapPotential(items,p,{targets:{},secondary:[]},fixed).goals.length,0);
 const graph=buildCraftMap(items,p,{targets:{},secondary:[]},ds);
 assert(graph.nodes.some(n=>n.id===id('Mushroom')));
 assert(graph.links.some(l=>l.from===id('Mushroom Paste')&&l.to===id('Purple Diary')));
 console.log('Zero-output diary potential is bounded by existing parchment, keeps recipe links, and freezes when accepted.');
}
const {craftMapDemandAllocation}=require('./web/craft-map-model.js');
{
 const catalog={raw:{direct_ingredients:{}},a:{direct_ingredients:{raw:1}},b:{direct_ingredients:{raw:2}}};
 const goals=[{item_id:'a',cap:0,consumer_mode:'available'},{item_id:'b',cap:20,consumer_mode:'available'}];
 const half=craftMapDemandAllocation(catalog,goals,[{item_id:'a',cap:100},{item_id:'b',cap:200}],'raw',50);
 assert.deepEqual(half.map(g=>g.cap),[50,100]);
 const quarter=craftMapDemandAllocation(catalog,half,[],'raw',25);
 assert.deepEqual(quarter.map(g=>g.cap),[25,50]);
 assert.deepEqual(goals.map(g=>g.cap),[0,20]);
 assert(quarter.every(g=>g.demand_group==='raw'));
 console.log('Shared demand percentages use fixed original aims, include zero crafts, and never compound after edits.');
}

{ const rows=craftMapDemandAllocation({raw:{direct_ingredients:{}},a:{direct_ingredients:{raw:1}},b:{direct_ingredients:{raw:1}}},[{item_id:'a',cap:100,consumer_mode:'available'},{item_id:'b',cap:200,consumer_mode:'fixed'}],[],'raw',50);assert.equal(rows.length,1);assert.equal(rows[0].cap,50);assert.equal(rows[0].demand_group,'raw');}

{
 const straw={id:'straw',name:'Straw',kind:'item',depth:1,crafts:0};
 const meta={straw:{farm_produced:false}};
 assert.equal(laneLayoutCraftMap([straw],[],meta).assignments.straw,'disconnected');
 const forest={id:'area:forest',location:'forest',kind:'area',name:'Forest',depth:0};
 assert.equal(laneLayoutCraftMap([straw,forest],[{from:forest.id,to:'straw'}],meta).assignments.straw,forest.id);
}
