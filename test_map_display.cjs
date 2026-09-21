const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const elements=new Map();
function el(id){if(!elements.has(id))elements.set(id,{innerHTML:'completed graph',textContent:'',classList:{contains:()=>false},addEventListener(){},after(){},querySelectorAll:()=>[]});return elements.get(id);}
const ctx=vm.createContext({document:{createElement:()=>el('section')},$:el,window:{addEventListener(){}},result:null,state:{targets:{},secondary:[],map_use_void:[]},setTimeout(){},clearTimeout(){},items:{},browserPlanner:{cancel(){}}});
vm.runInContext(fs.readFileSync('web/craft-map.js','utf8'),ctx);
vm.runInContext(`
const completed={areas:[],item_balances:[],optimal_total_explores:100};
result={plans:[completed]};selected=0;mapPlan=completed;mapGraph={nodes:[],links:[]};
mapOriginal={secondary:[]};mapDrafts=[{item_id:'new',cap:500}];
buildCraftMap=()=>{throw Error('rebuilt');};
mapChanged();
`,ctx);
assert.equal(el('mapNodes').innerHTML,'completed graph','a draft must not replace solved numbers with recipe-expansion guesses');
assert.match(el('mapPending').textContent,/recalculating/);
vm.runInContext('mapBusy=()=>true;',ctx);
assert.doesNotThrow(()=>vm.runInContext('mapRender()',ctx),'keep the last map during a global recalculation');
vm.runInContext('result={plans:[{...completed}]};',ctx);
assert.throws(()=>vm.runInContext('mapRender()',ctx),/rebuilt/,'a newly published result must render even before the loading status is cleared');
vm.runInContext('mapBusy=()=>false;mapOriginal={secondary:[]};mapPreview={preview_plan:completed};',ctx);
assert.throws(()=>vm.runInContext('mapRender()',ctx),/rebuilt/,'a solved draft replaces the previous map');
console.log('Map quantities stay frozen during recalculation and refresh when a solved draft or primary plan arrives.');
