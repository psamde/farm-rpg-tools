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
const {leftoverNeeds}=require('./web/suggestions.js');
const dyeItems={
 flower:{name:'Flower',direct_ingredients:{}},sand:{name:'Sand',direct_ingredients:{}},stone:{name:'Stone',direct_ingredients:{}},
 bottle:{name:'Glass Bottle',output_quantity:1,direct_ingredients:{sand:2,stone:1}},
 dye:{name:'Dye',output_quantity:1,direct_ingredients:{flower:3,bottle:1}}
};
let need=leftoverNeeds(dyeItems,{flower:300},{},{item_id:'dye'},0);
assert.equal(need.batch,100);assert.equal(need.direct.bottle,100);assert.deepEqual(need.raw,{sand:200,stone:100});
need=leftoverNeeds(dyeItems,{flower:300,bottle:20,sand:50},{},{item_id:'dye'},0);
assert.equal(need.direct.bottle,80);assert.deepEqual(need.raw,{sand:110,stone:80});
assert.equal(leftoverNeeds(dyeItems,{flower:300,bottle:100},{},{item_id:'dye'},0),null);
need=leftoverNeeds(dyeItems,{flower:300},{resource_saver:50},{item_id:'dye',cap:60},10);
assert.equal(need.batch,50);assert.ok(Math.abs(need.direct.bottle-100/3)<1e-8);
assert.ok(Math.abs(need.raw.sand-136/3)<1e-8); // 34 bottle crafts, perk at both levels
assert.equal(leftoverNeeds(dyeItems,{flower:1},{},{item_id:'dye'},1000),null);
assert.equal(leftoverNeeds(dyeItems,{flower:300},{},{item_id:'dye',cap:10},10),null);
console.log('Needs estimates: direct bottles, raw shortages, existing stocks, caps, perks and tiny tails passed');
const {priorityConflicts}=require('./web/suggestions.js');
const priorities=[{item_id:'mixed',prioritize:true},{item_id:'board',prioritize:true}];
assert.deepEqual(priorityConflicts(items,priorities,{}).mixed[0].ingredients,['wood']);
assert.equal(priorityConflicts(items,[{item_id:'mixed',prioritize:true},{item_id:'board'}],{}).mixed.length,0);
const perkItems={iron:{name:'Iron',direct_ingredients:{}},a:{direct_ingredients:{iron:1}},b:{direct_ingredients:{iron:2}}};
assert.equal(priorityConflicts(perkItems,[{item_id:'a',prioritize:true},{item_id:'b',prioritize:true}],{iron_depot:true}).a.length,0);
assert.equal(priorityConflicts(perkItems,[{item_id:'a',prioritize:true},{item_id:'b',prioritize:true}],{iron_depot:false}).a.length,1);
console.log('Priority conflicts: recursive ingredients, single priority and free perk inputs passed');
