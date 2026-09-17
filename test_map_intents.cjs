const fs=require('fs'),assert=require('assert/strict');
const {buildCraftMap,craftMapIsSoft,craftMapPotential,craftMapAddOptions,craftMapSupplySnapshot,craftMapCandidateGaps}=require('./web/craft-map-model.js');
const items=JSON.parse(fs.readFileSync('data/catalog.json','utf8')).items;
const id=name=>Object.values(items).find(item=>item.name===name).id;
const settings={targets:{},secondary:[],iron_depot:true,resource_saver:0};
const supply=stock=>({areas:[],item_balances:Object.entries(stock).map(([name,expected_unused])=>({item_id:id(name),expected_unused,crafted:0}))});
const soft=name=>({item_id:id(name),consumer_mode:'available',cap:null});
const diaryNames=['Leather Diary','Green Diary','Purple Diary'];
const parchmentNames=['White Parchment','Green Parchment','Purple Parchment'];
const permutations=xs=>xs.length?xs.flatMap((x,i)=>permutations(xs.filter((_,j)=>i!==j)).map(rest=>[x,...rest])):[[]];
const base=supply({Feathers:300,'Fern Leaf':300,'Purple Flower':300});
const before=JSON.stringify(base);

// The user can add the same recipes in any order. Shared feathers bound each
// independent opportunity; calculating one opportunity must not spend another's.
for(const names of permutations(diaryNames)){
 const drafts=[...parchmentNames.map(soft),...names.map(soft)],saved=JSON.stringify(drafts);
 const potential=craftMapPotential(items,base,settings,drafts);
 const aims=Object.fromEntries(potential.goals.map(g=>[items[g.item_id].name,g.potential_crafts]));
 for(const name of diaryNames)assert.equal(aims[name],100,`${names.join(', ')}: ${name}`);
 for(const name of parchmentNames)assert.equal(aims[name],100);
 assert.equal(JSON.stringify(drafts),saved,'potential must not write quantity constraints into selected recipes');
 assert.equal(JSON.stringify(base),before,'potential must not spend the underlying shared inventory');
 assert(drafts.every(g=>g.cap===null&&craftMapIsSoft(g)));
 // These are independent what-if estimates, not a promise that all 300 diaries
 // can share the same 100 parchment. Only the solver may choose actual totals.
 assert.equal(potential.graph.missing[id('Mushroom')],900);
}

// Existing intermediates anchor potential without manufacturing their raw
// inputs again, including when the item isn't one of the top visible leftovers.
const intermediate=supply({'White Parchment':90,'Green Parchment':75,'Purple Parchment':60});
const intermediatePotential=craftMapPotential(items,intermediate,{...settings,map_unused_mode:'none'},diaryNames.map(soft));
const intermediateAims=Object.fromEntries(intermediatePotential.goals.map(g=>[items[g.item_id].name,g.cap]));
assert.deepEqual(intermediateAims,{'Leather Diary':90,'Green Diary':75,'Purple Diary':60});
assert.equal(craftMapPotential(items,supply({}),settings,diaryNames.map(soft)).goals.length,0);
assert.deepEqual(craftMapAddOptions(items,supply({}),settings,[],id('Purple Diary'),id('Purple Parchment')),{all:0,available:0});

// A soft zero-output selection keeps its recipe connected and its original
// null cap. A supplied preview gives the exact current result, independently
// of how high its potential estimate was.
const unfilled=buildCraftMap(items,base,settings,[soft('Green Diary')]);
const unfilledDiary=unfilled.nodes.find(n=>n.id===id('Green Diary'));
assert.equal(unfilledDiary.soft,true);
assert.equal(unfilledDiary.crafts,0);
assert(unfilled.links.some(l=>l.from===id('Mushroom Paste')&&l.to===id('Green Diary')));
const solved=supply({'Green Diary':27});solved.item_balances[0].crafted=27;
const solvedGraph=buildCraftMap(items,solved,{...settings,secondary:[soft('Green Diary')]});
assert.equal(solvedGraph.nodes.find(n=>n.id===id('Green Diary')).crafts,27);
const estimateGoal={...soft('Green Diary'),estimated_crafts:12};
assert.equal(buildCraftMap(items,base,settings,[estimateGoal]).nodes.find(n=>n.id===id('Green Diary')).draftCrafts,12);
assert.equal(estimateGoal.cap,null);
assert.equal(craftMapIsSoft({item_id:id('Green Diary'),cap:0,consumer_mode:'fixed'}),false);

// The Python report keeps chosen optional outputs in a separate field. They
// are still available to use in the map, not fulfilled/empty primary reserves.
const parchmentResult={areas:[],item_balances:[
 {item_id:id('White Parchment'),expected_unused:0,reserved_secondary_output:178651,crafted:178651},
 {item_id:id('Purple Parchment'),expected_unused:0,reserved_secondary_output:100,crafted:100},
 {item_id:id('Mushroom Paste'),expected_unused:100,crafted:0}
]};
const parchmentSettings={...settings,secondary:[soft('White Parchment'),soft('Purple Parchment')]};
const parchmentGraph=buildCraftMap(items,parchmentResult,parchmentSettings);
const white=parchmentGraph.nodes.find(n=>n.id===id('White Parchment'));
assert.equal(white.stock,178651);
assert.equal(white.currentStock,178651);
assert.equal(require('./web/craft-map-model.js').craftMapUsage(white),'unused');
const diaryDraft=buildCraftMap(items,parchmentResult,parchmentSettings,[{item_id:id('Purple Diary'),consumer_mode:'fixed',cap:100}]);
assert.equal(diaryDraft.nodes.find(n=>n.id===id('White Parchment')).stock,178551);
assert.equal(diaryDraft.nodes.find(n=>n.id===id('White Parchment')).draftCrafts,0);
assert.equal(diaryDraft.missing[id('Feathers')]||0,0);
assert.deepEqual(diaryDraft.missing,{});
// Raw report input and actual primary reservations must remain untouched.
assert.equal(parchmentResult.item_balances[0].expected_unused,0);
const reservedPrimary=buildCraftMap(items,{areas:[],item_balances:[{item_id:id('White Parchment'),expected_unused:0,reserved_target_output:50,crafted:50}]},{...settings,targets:{[id('White Parchment')]:50}});
assert.equal(reservedPrimary.nodes.find(n=>n.id===id('White Parchment')).stock,0);

// Release optional commitments for a new candidate, but retain explicit fixed
// commitments. Empty optional output is not evidence that the pool is empty.
const shared=supply({Wood:100,Straw:200});
const selectedTwine={...soft('Twine'),estimated_crafts:100};
const boards=craftMapAddOptions(items,shared,settings,[selectedTwine],id('Board'),id('Wood'));
assert.equal(boards.available,20);
assert.equal(boards.rebalances,true);
const fixedTwine={item_id:id('Twine'),consumer_mode:'fixed',cap:90};
assert.equal(craftMapAddOptions(items,shared,settings,[fixedTwine],id('Board'),id('Wood')).available,2);

// Reopening an applied plan must undo optional consumption AND optional
// production exactly once. The primary goal's wood remains reserved.
const applied={areas:[],crafts_in_dependency_order:[{item_id:id('Board'),crafts:10}],
 secondary:{crafts_in_dependency_order:[{item_id:id('Twine'),crafts:100}]},
 item_balances:[
  {item_id:id('Wood'),expected_unused:0,used_by_leftover_craft:100,crafted:0,consumed_by_crafting:150},
  {item_id:id('Straw'),expected_unused:0,used_by_leftover_craft:200,crafted:0},
  {item_id:id('Twine'),expected_unused:0,reserved_secondary_output:100,used_by_leftover_craft:0,crafted:100},
  {item_id:id('Board'),expected_unused:0,reserved_target_output:10,crafted:10}
 ]};
const appliedSettings={...settings,targets:{[id('Board')]:10},secondary:[soft('Twine')]};
const restored=craftMapSupplySnapshot(items,applied,appliedSettings);
assert.equal(restored.item_balances.find(b=>b.item_id===id('Wood')).expected_unused,100);
assert.equal(restored.item_balances.find(b=>b.item_id===id('Twine')).expected_unused,0);
assert.equal(restored.item_balances.find(b=>b.item_id===id('Board')).expected_unused,0);
assert.equal(craftMapAddOptions(items,applied,appliedSettings,[],id('Board'),id('Wood')).available,20);

// Free perk inputs never become a finite missing-source opportunity.
const bow=supply({Wood:60,Straw:40,'Fern Leaf':10});
assert.deepEqual(craftMapCandidateGaps(items,bow,settings,[],id('Wooden Bow'),10),[]);
const bowPotential=craftMapPotential(items,bow,settings,[soft('Wooden Bow')]);
const iron=bowPotential.graph.nodes.find(n=>n.id===id('Iron'));
assert.equal(iron.free,true);
assert.equal(iron.need,0);
assert.equal(iron.missing,0);
assert(craftMapPotential(items,base,{...settings,resource_saver:45},diaryNames.map(soft)).goals.every(g=>g.cap>100));

// The authoritative preview connects every contributed material from a chosen
// location, regardless of which material was used to open the source picker.
const forestPlan=supply({Mushroom:300,Hide:200});
forestPlan.areas=[{location_id:'explore:7',name:'Forest',explores:5000,items:[
 {item_id:id('Mushroom'),expected_drops:300},{item_id:id('Hide'),expected_drops:200}
]}];
const forest=buildCraftMap(items,forestPlan,{...settings,secondary:diaryNames.map(soft)});
for(const name of ['Mushroom','Hide'])assert(forest.links.some(l=>l.from==='area:explore:7'&&l.to===id(name)));
console.log('Map intents: six diary orders, shared potential, zero supplies, authoritative previews, reallocation, primary reserves, free perks and all-source connections passed.');
