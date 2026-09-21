const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('web/craft-map.js','utf8');
const handlers=source.slice(source.indexOf(' function finishUsageChange('),source.indexOf(" if($('mapExploreInstead'))"));
const goalAdapter=source.slice(source.indexOf('function mapGoals()'),source.indexOf('function mapQueuePreview()'));
function fixture(applied=false){
 const elements=new Map();const $=id=>{if(!elements.has(id))elements.set(id,{value:id==='mapRawLimit'?'5000':undefined});return elements.get(id);};
 const goal={item_id:'necklace',cap:10000,consumer_mode:'available',allow_exploration:true};let previews=0;
 const ctx=vm.createContext({$,n:{stock:12000},id:'amethyst',consumers:[goal],state:{secondary:applied?[goal]:[],map_node_usage:{},map_use_void:[],map_voided:[],resource_saver:0},mapDrafts:applied?[]:[goal],mapPlan:{},mapPreview:null,mapOriginal:null,items:{necklace:{direct_ingredients:{amethyst:2},output_quantity:1},ring:{direct_ingredients:{amethyst:1},output_quantity:1},bow:{direct_ingredients:{wood:2},output_quantity:1},wood:{direct_ingredients:{},output_quantity:1},amethyst:{direct_ingredients:{},output_quantity:1}},mapChanged(){},mapSelect(){},mapBusy:()=>false,mapQueuePreview:()=>previews++,craftMapAddOptions:()=>({available:4000,all:6000})});
 vm.runInContext(fs.readFileSync('web/craft-map-model.js','utf8'),ctx);
 // Use a deterministic per-consumer estimate so mode tests do not depend on a
 // catalog recipe. Actual dependency traversal and request derivation run here.
 ctx.craftMapAddOptions=()=>({available:4000,all:6000});
 vm.runInContext('function mapBeginEdit(){if(!mapOriginal)mapOriginal={secondary:[...state.secondary]};}',ctx);
 vm.runInContext(goalAdapter,ctx);
 vm.runInContext(handlers,ctx);
 return {ctx,$,previews:()=>previews,get:expr=>vm.runInContext(expr,ctx)};
}
for(const applied of [false,true]){
 const f=fixture(applied),original=f.get('JSON.stringify(mapGoals())');
 assert.equal(f.get('mapRequestGoals()[0].cap'),null);
 f.$('mapRawSetLimit').onclick();
 assert.equal(f.get("state.map_node_usage.amethyst.mode"),'limit');
 assert.equal(f.get("state.map_node_usage.amethyst.amount"),5000);
 assert.equal(f.get('mapRequestGoals()[0].cap'),null,'aggregate material limit must not become a per-recipe cap');
 f.get("setSurplusMode('void')");assert.equal(f.get('mapRequestGoals()[0].cap'),0);
 f.get("setSurplusMode('use')");assert.equal(f.get('mapRequestGoals()[0].cap'),null);
 f.get("setSurplusMode('unused')");assert.equal(f.get('mapRequestGoals()[0].cap'),0);
 f.$('mapRawForce').onclick();
 assert.equal(f.get("state.map_node_usage.amethyst.mode"),'force');
 assert.equal(f.get('mapRequestGoals()[0].consumer_mode'),'available');
 assert.equal(f.get('mapRequestGoals()[0].cap'),null,'force the input usage without changing downstream recipes');
 assert.equal(f.get('JSON.stringify(mapGoals())'),original,'all node mode changes preserve consumer intent');
 assert.equal(f.previews(),5);
}
const f=fixture();f.get("consumers.push({item_id:'ring',cap:50,consumer_mode:'fixed'});mapDrafts.push(consumers[1],{item_id:'bow',cap:25,consumer_mode:'fixed'});setSurplusMode('void')");
assert.equal(f.get('mapDrafts[0].cap'),10000);assert.equal(f.get('mapDrafts[1].cap'),50);assert.equal(f.get('mapRequestGoals().slice(0,2).every(g=>g.cap===0)'),true);assert.equal(f.get('mapRequestGoals()[2].cap'),25,'unrelated consumers must not be paused');
f.get("setSurplusMode('use')");assert.equal(f.get('mapRequestGoals()[0].cap'),null);assert.equal(f.get('mapRequestGoals()[1].cap'),50,'fixed consumer resumes its own quantity');
console.log('Node mode choices derive reversible request limits, preserve consumer intent, respect user caps, and queue recomputation.');
