const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('web/craft-map.js','utf8');
const handlers=source.slice(source.indexOf(' function updateConsumer('),source.indexOf(" if($('mapExploreInstead'))"));
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
 const f=fixture(applied);
 assert.equal(f.get('mapRequestGoals()[0].cap'),null,'legacy availability estimate must not cap an uncapped Use + Void goal');
 f.$('mapRawSetLimit').onclick();assert.equal(f.get('mapDrafts[0].cap'),2500);assert.equal(f.get('mapDrafts[0].allow_exploration'),false);assert.equal(f.get('mapDrafts[0].consumer_mode'),'available');assert.equal(f.get('mapDrafts[0].user_cap'),true);assert.equal(f.get('mapRequestGoals()[0].cap'),2500);
 f.get("setSurplusMode('void')");assert.equal(f.get('mapDrafts[0].cap'),2500,'pausing a source must preserve the saved consumer limit');assert.equal(f.get('mapDrafts[0].consumer_mode'),'available');assert.equal(f.get('mapRequestGoals()[0].cap'),0);assert.equal(f.get("state.map_voided.includes('amethyst')"),true);
 f.get("setSurplusMode('use')");assert.equal(f.get('mapRequestGoals()[0].cap'),2500,'resume the previous user limit');assert.equal(f.get('mapDrafts[0].user_cap'),true);
 f.get("setSurplusMode('unused')");assert.equal(f.get('mapDrafts[0].cap'),2500);assert.equal(f.get('mapRequestGoals()[0].cap'),0);assert.equal(f.get('state.map_voided.length'),0);
 f.$('mapRawForce').onclick();assert.equal(f.get('mapDrafts[0].cap'),6000);assert.equal(f.get('mapRequestGoals()[0].consumer_mode'),'fixed');assert.equal(f.get('mapRequestGoals()[0].user_cap'),false);
 assert.equal(f.previews(),5,'every mode action queues recomputation, including applied consumers');
}
const f=fixture();f.get("consumers.push({item_id:'ring',cap:50,consumer_mode:'fixed'});mapDrafts.push(consumers[1],{item_id:'bow',cap:25,consumer_mode:'fixed'});setSurplusMode('void')");
assert.equal(f.get('mapDrafts[0].cap'),10000);assert.equal(f.get('mapDrafts[1].cap'),50);assert.equal(f.get('mapRequestGoals().slice(0,2).every(g=>g.cap===0)'),true);assert.equal(f.get('mapRequestGoals()[2].cap'),25,'unrelated consumers must not be paused');
f.get("setSurplusMode('use')");assert.equal(f.get('mapRequestGoals()[0].cap'),null);assert.equal(f.get('mapRequestGoals()[1].cap'),50,'fixed consumer resumes its own quantity');
console.log('Node mode choices derive reversible request limits, preserve consumer intent, respect user caps, and queue recomputation.');
