const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('web/craft-map.js','utf8');
const handlers=source.slice(source.indexOf(' function updateConsumer('),source.indexOf(" if($('mapExploreInstead'))"));
function fixture(applied=false){
 const elements=new Map();const $=id=>{if(!elements.has(id))elements.set(id,{value:id==='mapRawLimit'?'5000':undefined});return elements.get(id);};
 const goal={item_id:'necklace',cap:10000,allow_exploration:true};let previews=0;
 const ctx=vm.createContext({$,id:'amethyst',consumers:[goal],state:{secondary:applied?[goal]:[],map_use_void:[],map_voided:[],resource_saver:0},mapDrafts:applied?[]:[goal],mapPlan:{},mapOriginal:null,items:{necklace:{direct_ingredients:{amethyst:2},output_quantity:1},amethyst:{direct_ingredients:{},output_quantity:1}},mapChanged(){},mapSelect(){},mapBusy:()=>false,mapComputePreview:()=>previews++,craftMapAddOptions:()=>({available:4000,all:6000})});
 vm.runInContext('function mapBeginEdit(){if(!mapOriginal)mapOriginal={secondary:[...state.secondary]};}',ctx);
 vm.runInContext(handlers,ctx);
 return {ctx,$,previews:()=>previews,get:expr=>vm.runInContext(expr,ctx)};
}
for(const applied of [false,true]){
 const f=fixture(applied);
 f.$('mapRawSetLimit').onclick();assert.equal(f.get('mapDrafts[0].cap'),2500);assert.equal(f.get('mapDrafts[0].allow_exploration'),false);
 f.get("setSurplusMode('void')");assert.equal(f.get('mapDrafts[0].cap'),0);assert.equal(f.get("state.map_voided.includes('amethyst')"),true);
 f.get("setSurplusMode('use')");assert.equal(f.get('mapDrafts[0].cap'),4000);assert.equal(f.get('mapDrafts[0].void_source'),'amethyst');
 f.get("setSurplusMode('unused')");assert.equal(f.get('mapDrafts[0].cap'),0);assert.equal(f.get('state.map_voided.length'),0);
 f.$('mapRawForce').onclick();assert.equal(f.get('mapDrafts[0].cap'),6000);
 if(applied)assert.equal(f.previews(),5);
}
const f=fixture();f.get("consumers.push({item_id:'ring',cap:50});mapDrafts.push(consumers[1]);setSurplusMode('void')");assert.equal(f.get('mapDrafts.every(g=>g.cap===0)'),true);
console.log('Node actions update connected craft quantities, restore use, enforce ingredient limits, pause all consumers, and recompute applied plans.');
