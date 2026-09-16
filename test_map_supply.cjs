const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const elements=new Map();let pending;
function el(id){if(!elements.has(id))elements.set(id,{classList:{contains:()=>false},addEventListener(){},before(){},after(){},focus(){},showModal(){this.open=true;},close(){this.open=false;},scrollIntoView(){},click(){pending=this.onclick?.();}});return elements.get(id);}
const calls=[];
const ctx=vm.createContext({document:{createElement:()=>el('section')},$:el,window:{addEventListener(){}},result:null,state:{secondary:[],targets:{},areas:['cave','forest']},revision:1,items:{},fmt:String,esc:String,craftMapDependents:()=>['canteen'],browserPlanner:{cancel(){}},setTimeout,clearTimeout,
 api:async(path,payload)=>{calls.push({path,payload});if(path==='/api/plan')return {job_id:'j'};return {status:'complete',result:{preview_plan:{},outputs:[],extra_explores:20,total_explores:120,new_locations:[],reduced:[],goals:[]}};},
 guidePayload:()=>({}),guidedExploreIncrease:()=>'+20%',catalog:{locations:[]}});
vm.runInContext(fs.readFileSync('web/craft-map.js','utf8'),ctx);
vm.runInContext(`mapRender=()=>{};mapSelect=()=>{};mapFocus=()=>{};mapPlan={areas:[{location_id:'cave'}]};mapGraph={missing:{wood:12}};mapDrafts=[{item_id:'canteen',cap:100,automatic_batch:true,automatic_supply:true}];`,ctx);
(async()=>{
 const area={dataset:{mapArea:'cave',mapSourceItem:'wood'}};
 await el('mapInspector').onclick({target:{closest:s=>s==='[data-map-area]'?area:null}});
 await pending;
 const request=calls.find(c=>c.path==='/api/plan').payload;
 assert.deepEqual(Array.from(request.automatic_areas),['cave']);
 assert.notEqual(el('mapReviewDialog').open,true);
 const beforeReview=calls.length;await el('mapPreview').onclick();
 assert.equal(el('mapReviewDialog').open,true);
 assert.equal(calls.length,beforeReview);
 assert.equal(request.chosen_goals[0].cap,100);
 assert.equal(request.chosen_goals[0].allow_exploration,true);
 assert.match(el('mapSummary').textContent,/Preview ready: 120/);
 assert.equal(vm.runInContext('!!mapPreview.preview_plan',ctx),true);
 console.log('Explore-more click immediately previews the existing area without disabling other ingredient sources, preserves cap, and retains solved map.');
})().catch(e=>{console.error(e);process.exitCode=1;});

