const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync('web/app.js', 'utf8');
const start = source.indexOf('function leftoverBottleneck(');
const end = source.indexOf("$('secondaryRows').onclick", start);
const nodes = {};
const context = {state:{secondary:[{item_id:'83',source_item_id:'73',cap:null}]},items:{'83':{name:'Purple Diary',direct_ingredients:{'73':1}},'73':{name:'Purple Parchment',direct_ingredients:{}}},selected:0,
 result:{plans:[{secondary:{targets:[{item_id:'83',crafts:0,anchor_limit:49223,missing_for_next_craft:[{item_id:'43',name:'Mushroom',quantity:2.07}]}]}}]},
 $:id=>nodes[id]??=( {classList:{contains:()=>false}} ),fmt:String,esc:String,itemName:(_,name)=>name};
vm.createContext(context);
vm.runInContext(source.slice(start,end)+';secondaryRows(true);',context);
let html=nodes.secondaryRows.innerHTML;
assert.match(html,/Cannot craft yet. Missing: Mushroom/);
assert.match(html,/data-secondary-explore="0"/);
assert.doesNotMatch(html,/data-secondary-anchor|Limit material/);
assert.doesNotMatch(html,/data-secondary-explore="0"[^>]*disabled/);
console.log('Leftover row rendering checks passed');

context.result.plans[0].secondary.targets[0].crafts=1000;
vm.runInContext('secondaryRows(true)',context);
assert.doesNotMatch(nodes.secondaryRows.innerHTML,/missinginputs|<small>missing ingredients<\/small>/);
console.log('Successful crafts do not display shortage notices');

assert.match(nodes.secondaryRows.innerHTML,/data-secondary-cap="0"/);

context.state.resource_saver=45;context.state.iron_depot=true;
context.items={ring:{name:'Aquamarine Ring',direct_ingredients:{gem:1,paste:1}},gem:{name:'Aquamarine',direct_ingredients:{}},paste:{name:'Mushroom Paste',direct_ingredients:{mushroom:3}},mushroom:{name:'Mushroom',direct_ingredients:{}}};
const p={item_balances:[{item_id:'gem',expected_final_inventory:121797},{item_id:'mushroom',expected_final_inventory:.1},{item_id:'paste',expected_final_inventory:.17}]};
assert.deepEqual(Array.from(context.leftoverBottleneck({item_id:'ring'},{crafts:1927},p).ids),['mushroom']);
assert.equal(context.leftoverBottleneck({item_id:'ring',cap:1927},{crafts:1927},p),null);
assert.equal(context.leftoverBottleneck({item_id:'ring'},{crafts:1927},{item_balances:p.item_balances.map(b=>({...b,expected_final_inventory:.1}))}),null);
console.log('Meaningful shortage, cap, and rounding suppression checks passed');
