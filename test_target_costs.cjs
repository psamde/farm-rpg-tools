const assert=require('node:assert/strict'),fs=require('node:fs');
const T=require('./web/target-costs.js'),Tower=require('./web/tower-model.js');
const state={targets:{a:100,b:30},inventory:'{"a":40,"b":10}',provided_targets:{}};
T.provide(state,'a');
assert.deepEqual(T.remaining(state),{b:30});
assert.equal(JSON.parse(state.inventory).a,0);
assert.deepEqual(state.provided_targets.a,{quantity:100,taken:40});
T.provide(state,'a');assert.equal(state.provided_targets.a.taken,40);
state.targets.a+=20;assert.equal(T.remaining(state).a,20);
T.provide(state,'a');assert.equal(state.provided_targets.a.quantity,120);
const restored=JSON.parse(JSON.stringify(state));T.undo(restored,'a');
assert.equal(JSON.parse(restored.inventory).a,40);
assert.equal(T.remaining(restored).a,120);
T.undo(restored,'a');assert.equal(JSON.parse(restored.inventory).a,40);
T.provide(state,'b');assert.deepEqual(T.remaining(state),{});

const metadata={effort_locations:{forest:{name:'Forest',kind:'explore'}},items:[
 {id:'a',name:'A',sources:[{kind:'explore',location_id:'forest',actions_per_drop:2}],craftable:false,direct_ingredients:{}},
 {id:'b',name:'B',sources:[],craftable:true,direct_ingredients:{a:3}}
]};
const settings={targets:{a:100,b:100},resource_saver:45,areas:['forest']};
const personal={weights:{explore:4}};
const ranking=T.rank(metadata,settings,personal);
const expected=Tower.estimate({items:Object.fromEntries(metadata.items.map(i=>[i.id,i])),locations:metadata.effort_locations},{...personal,resourceSaver:45,locations:['forest']},'b',100);
assert.equal(ranking[0].id,'b');assert.equal(ranking[0].cost.points,expected.points);
settings.provided_targets={b:{quantity:100,taken:0}};
assert.equal(T.rank(metadata,settings,personal)[0].id,'a');
const {metadata:real}=JSON.parse(fs.readFileSync('web/catalog.json','utf8'));
const {catalog}=JSON.parse(fs.readFileSync('web/catalog.json','utf8'));
for(const item of real.items){
 const expected=catalog.items[item.id].source_ids.some(id=>catalog.sources[id].kind==='trading');
 assert.equal(item.mailable,expected,item.name);
}
assert(real.items.some(i=>i.mailable));assert(real.items.some(i=>!i.mailable));
console.log('Reserved targets, Undo, additive quest imports, shared Tower scoring and every Mailable flag passed.');
