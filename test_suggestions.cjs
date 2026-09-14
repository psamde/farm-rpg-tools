const assert=require('node:assert/strict');const {suggestCrafts}=require('./web/suggestions.js');
const items={wood:{id:'wood',name:'Wood',craftable:false,explorable:true,direct_ingredients:{}},fish:{id:'fish',name:'Fish',craftable:false,explorable:false,direct_ingredients:{}},stone:{id:'stone',name:'Stone',craftable:false,explorable:true,direct_ingredients:{}},board:{id:'board',name:'Board',craftable:true,output_quantity:1,direct_ingredients:{wood:5}},mixed:{id:'mixed',name:'Mixed',craftable:true,output_quantity:1,direct_ingredients:{board:1,stone:2}},bait:{id:'bait',name:'Bait',craftable:true,output_quantity:1,direct_ingredients:{wood:1,fish:1}}};
const r=suggestCrafts(items,{wood:52},{},'wood');
assert.equal(r.ready[0].id,'board');assert.equal(r.ready[0].count,10);assert.equal(r.ready[0].score,50);
assert.ok(r.explore.some(x=>x.id==='mixed'));assert.ok(!r.explore.some(x=>x.id==='bait'));
assert.equal(suggestCrafts(items,{board:5,stone:10},{},'board').ready[0].count,5);
assert.equal(suggestCrafts(items,{wood:52},{secondary:[{item_id:'board'}]}).ready.length,0);
assert.equal(suggestCrafts(items,{},{}).ready.length,0);
console.log('Suggestion checks passed: quantities, intermediate stock, material filters, external supplies and exclusions');


const withoutPrimary=suggestCrafts(items,{wood:52},{targets:{board:100,mixed:100}});assert.ok(![...withoutPrimary.ready,...withoutPrimary.explore].some(r=>['board','mixed'].includes(r.id)));
