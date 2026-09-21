const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const items=JSON.parse(fs.readFileSync('data/catalog.json','utf8')).items;
const id=name=>Object.values(items).find(i=>i.name===name).id;
const model=fs.readFileSync('web/craft-map-model.js','utf8');
const app=fs.readFileSync('web/app.js','utf8');
const map=fs.readFileSync('web/craft-map.js','utf8');
const html=fs.readFileSync('web/index.html','utf8');
assert.ok(html.indexOf('src="craft-map-model.js')<html.indexOf('src="app.js'),'intent rules must load before the initial calculation');
const state={map_planning:true,map_sources:{},planner_mode:'goals',targets:{[id('Ant Apple')]:125},secondary:[{item_id:id('Wooden Spear'),cap:null,consumer_mode:'available'}],areas:['explore:7'],map_node_usage:{[id('Straw')]:{mode:'void'}}};
const context=vm.createContext({items,state,revision:0,error(){},startingSupplyReport(){},inventoryData:()=>({})});
vm.runInContext(model,context);
// Execute the actual initial payload construction before craft-map.js exists.
const prefix=app.slice(app.indexOf('async function calculate(){'),app.indexOf('}catch{',app.indexOf('async function calculate(){')));
vm.runInContext(prefix+';return payload;}finally{}}',context);
async function run(){
 assert.equal(vm.runInContext('typeof mapGoalIntent',context),'undefined');
 const initial=await context.calculate();
 assert.equal(initial.secondary[0].cap,0,'reload must respect paused Straw through Twine');
 vm.runInContext(map.slice(map.indexOf('function mapGoalIntent('),map.indexOf('\nfunction mapRequestGoals')),context);
 const preview=vm.runInContext('mapGoalIntent(state.secondary[0])',context);
 assert.equal(preview.cap,initial.secondary[0].cap);
 assert.deepEqual(Array.from(context.craftMapBlockingInputs(items,state,id('Wooden Spear'))),[id('Straw')]);
 state.map_node_usage[id('Straw')]={mode:'use'};
 const resumed=await context.calculate();
 assert.equal(resumed.secondary[0].cap,null,'resuming Straw restores the original uncapped recipe');
 assert.equal(vm.runInContext('mapGoalIntent(state.secondary[0]).cap',context),null);
 assert.equal(state.secondary[0].cap,null,'request limits do not overwrite saved intent');
 state.map_node_usage[id('Straw')]={mode:'limit',amount:5000};
 const limited=await context.calculate();
 assert.equal(limited.map_node_usage[id('Straw')].amount,5000);
 assert.equal(limited.secondary[0].cap,null,'reload sends material limits independently of recipe caps');
 console.log('Initial load and map previews share identical node rules; Straw blocks Spear until resumed.');
}
run().catch(e=>{console.error(e);process.exitCode=1;});
