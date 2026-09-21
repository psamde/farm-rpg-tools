const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const elements=new Map();
function el(id){if(!elements.has(id))elements.set(id,{classList:{contains:()=>false},addEventListener(){},before(){},after(){},focus(){},showModal(){this.open=true;},close(){this.open=false;},scrollIntoView(){},click(){return this.onclick?.();}});return elements.get(id);}
const calls=[];let request;
const ctx=vm.createContext({document:{createElement:()=>el('section')},$:el,window:{addEventListener(){}},result:null,state:{secondary:[],targets:{},map_sources:{},map_node_usage:{},map_use_void:[],map_voided:[],areas:['cave','forest']},revision:1,items:{canteen:{name:'Canteen'},wood:{name:'Wood'}},itemName:(_id,name)=>name,fmt:String,esc:String,craftMapDependents:()=>['canteen'],browserPlanner:{cancel(){}},setTimeout:()=>1,clearTimeout(){},
 api:async(path,payload)=>{calls.push({path,payload,inert:el('mapNodes').inert});if(path==='/api/plan'){request=payload;return {job_id:'j'};}return {status:'complete',result:{preview_plan:{areas:[{location_id:'cave',name:'Cave',explores:100,items:[{item_id:'wood',expected_drops:200}]}],item_balances:[{item_id:'wood',expected_unused:40,expected_exploration_drops:200},{item_id:'canteen',crafted:80,expected_unused:80}],optimal_total_explores:120},outputs:[{item_id:'canteen',crafts:80,remaining:80}],extra_explores:20,total_explores:120,new_locations:[],reduced:[],goals:request.replacement_goals}};},
 inventoryData:()=>({}),guidePayload:()=>({}),guidedExploreIncrease:()=>'+20%',catalog:{locations:[{id:'forest',name:'Forest'},{id:'cave',name:'Cave'}]}});
vm.runInContext(fs.readFileSync('web/craft-map-model.js','utf8'),ctx);
vm.runInContext(fs.readFileSync('web/craft-map.js','utf8'),ctx);
vm.runInContext(`mapRender=()=>{};mapSelect=()=>{};mapFocus=()=>{};mapPlan={areas:[{location_id:'cave'}]};mapGraph={nodes:[{id:'wood',missing:12}]};mapDrafts=[{item_id:'canteen',cap:100,user_cap:true,consumer_mode:'available',available_only:true,allow_exploration:false}];`,ctx);
(async()=>{
 const area={dataset:{mapArea:'forest',mapSourceItem:'wood',mapRate:'2'}};
 await el('mapInspector').onclick({target:{closest:s=>s==='[data-map-area]'?area:null}});
 const initial=calls.find(c=>c.path==='/api/plan').payload;assert.equal(calls.find(c=>c.path==='/api/plan').inert,true,'block node clicks while the graph is being replaced');assert.equal(el('mapNodes').inert,false,'node clicks resume after preview');
 assert.deepEqual(Array.from(initial.automatic_areas),['forest'],'primary Cave is not silently added to selected-source requests');
 assert.equal(initial.map_source_explores.wood.forest,6);assert.equal(initial.map_planning,true);assert.deepEqual(Array.from(initial.map_sources.wood),['forest']);
 assert.notEqual(el('mapReviewDialog').open,true);
 const beforeReview=calls.length;await el('mapPreview').onclick();
 assert.equal(el('mapReviewDialog').open,true);
 assert.equal(calls.length,beforeReview);
 assert.equal(initial.replacement_goals[0].cap,100);assert.equal(initial.replacement_goals[0].user_cap,true);
 assert.equal(initial.replacement_goals[0].consumer_mode,'available');assert.equal(initial.replacement_goals[0].available_only,true);
 assert.equal(initial.replacement_goals[0].allow_exploration,false,'a source choice does not grant generic extra exploration');
 assert.equal(vm.runInContext('mapDrafts[0].cap',ctx),100);assert.equal(vm.runInContext('mapDrafts[0].available_only',ctx),true);
 assert.match(el('mapSummary').textContent,/Preview: 120/);
 assert.equal(vm.runInContext('!!mapPreview.preview_plan',ctx),true);
 assert.equal(vm.runInContext('mapPreview.shortfalls.length',ctx),0,'80 crafts below a user maximum of 100 is not a required-quantity shortfall');
 vm.runInContext('mapSources=async()=>{};',ctx);
 const remove={dataset:{mapRemoveSource:'forest',mapSourceItem:'wood'}};
 await el('mapInspector').onclick({target:{closest:s=>s==='[data-map-remove-source]'?remove:null}});
 assert.equal(vm.runInContext('state.map_sources.wood.length',ctx),0);
 assert.equal(vm.runInContext('mapDrafts[0].cap',ctx),100);
 assert.equal(vm.runInContext('mapDrafts[0].allow_exploration',ctx),false);
 assert.equal(vm.runInContext('mapDrafts[0].consumer_mode',ctx),'available');assert.equal(vm.runInContext('mapDrafts[0].user_cap',ctx),true);
 assert.deepEqual(Array.from(request.automatic_areas),[],'removal must not substitute another source');
 assert.equal(vm.runInContext('mapProposedLinks.length',ctx),0);
 console.log('Source choices preview without opening review, preserve soft caps and modes, use only explicit source requests, and remove without substitution.');
})().catch(e=>{console.error(e);process.exitCode=1;});

